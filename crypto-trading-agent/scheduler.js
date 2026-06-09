const cron        = require("node-cron");
const { getIndicators } = require("./taapi");
const { getDecision }   = require("./agent");
const alpaca      = require("./alpaca");
const posTracker  = require("./positions");
const config      = require("./config");

let tradeLog  = [];
let isRunning = false;
let cronJob   = null;

async function checkStopLossAndTakeProfit(positions, portfolioValue) {
  const exits = [];
  for (const position of positions) {
    const entry = posTracker.getEntry(position.symbol);
    if (!entry) continue;

    const currentPrice = parseFloat(position.current_price);
    const pnlPct       = parseFloat(position.unrealized_plpc) * 100;

    let exitReason = null;
    if (entry.stopLoss   && currentPrice <= entry.stopLoss)   exitReason = "stop-loss";
    if (entry.takeProfit && currentPrice >= entry.takeProfit) exitReason = "take-profit";

    if (exitReason) {
      console.log(`[${position.symbol}] 🚨 ${exitReason.toUpperCase()} triggered at $${currentPrice} (${pnlPct.toFixed(2)}%)`);
      try {
        const order = await alpaca.closePosition(position.symbol);
        posTracker.clearEntry(position.symbol);
        const log = {
          symbol:    position.symbol,
          type:      "auto-exit",
          timestamp: new Date().toISOString(),
          status:    "executed",
          order,
          decision: {
            action:          "SELL",
            dollars:         entry.dollars,
            confidence:      "HIGH",
            signals_summary: exitReason === "stop-loss" ? "🛑 Stop loss triggered — cutting loss" : "✅ Take profit triggered — locking in gain",
            reasoning:       exitReason === "stop-loss"
              ? `Price $${currentPrice} hit stop loss $${entry.stopLoss?.toFixed(2)}. Exiting to protect capital. P&L: ${pnlPct.toFixed(2)}%`
              : `Price $${currentPrice} hit take profit $${entry.takeProfit?.toFixed(2)}. Locking in gain. P&L: ${pnlPct.toFixed(2)}%`,
            risk_note: "Automatic exit — no further action needed",
          },
        };
        tradeLog.unshift(log);
        exits.push(log);
      } catch (e) {
        console.error(`[${position.symbol}] Auto-exit failed:`, e.message);
      }
    }
  }
  return exits;
}

async function analyzeSymbol(symbol, type, positions, portfolioValue, availableCash) {
  const log = { symbol, type, timestamp: new Date().toISOString() };

  try {
    const indicators   = await getIndicators(symbol, type);
    log.indicators     = indicators;

    const alpacaSymbol = type === "crypto"
      ? (config.CRYPTO_ALPACA[symbol] || symbol.replace("/", ""))
      : symbol;

    const position  = positions.find(p => p.symbol === alpacaSymbol) || null;
    const entryData = posTracker.getEntry(alpacaSymbol);
    const decision  = await getDecision(indicators, position, portfolioValue, entryData, availableCash, positions.length, 4);
    log.decision    = decision;

    console.log(`[${symbol}] B:${decision.bullish_score} vs Bear:${decision.bearish_score} → ${decision.action} (${decision.confidence})`);

    const dollars = decision.dollars || (portfolioValue * 0.10);

    if (decision.action === "BUY" && decision.confidence !== "LOW") {
      if (availableCash < 100) {
        log.status = "skipped";
        log.reason = `Insufficient cash — $${availableCash.toFixed(0)} available`;
        console.log(`[${symbol}] ⏸ Skipped — not enough cash ($${availableCash.toFixed(0)})`);
        return log;
      }
      const buyDollars = Math.min(dollars, availableCash * 0.98);
      const order = await alpaca.placeNotionalOrder(alpacaSymbol, buyDollars, "buy");
      log.order  = order;
      log.status = "executed";

      if (decision.stop_loss || decision.take_profit) {
        posTracker.recordEntry(alpacaSymbol, indicators.price, decision.stop_loss, decision.take_profit, buyDollars);
      }
      console.log(`[${symbol}] ✅ BUY $${buyDollars.toFixed(0)} | SL: $${decision.stop_loss?.toFixed(2)} | TP: $${decision.take_profit?.toFixed(2)}`);

    } else if (decision.action === "SELL" && position) {
      const order = await alpaca.closePosition(alpacaSymbol);
      log.order  = order;
      log.status = "executed";
      posTracker.clearEntry(alpacaSymbol);
      console.log(`[${symbol}] ✅ CLOSED full position`);

    } else {
      log.status = "held";
    }

  } catch (e) {
    log.status = "error";
    log.error  = e.message;
    console.error(`[${symbol}] Error:`, e.message);
  }

  return log;
}

async function runCycle() {
  if (isRunning) return;
  isRunning = true;
  console.log(`\n[Scheduler] ── Cycle ${new Date().toLocaleTimeString()} ──`);

  try {
    const [positions, account] = await Promise.all([
      alpaca.getPositions(),
      alpaca.getAccount(),
    ]);
    const portfolioValue = parseFloat(account.portfolio_value);
    const availableCash  = parseFloat(account.cash);
    const marketOpen     = await alpaca.isMarketOpen();

    // Check stop loss / take profit on all open positions first
    if (positions.length > 0) {
      await checkStopLossAndTakeProfit(positions, portfolioValue);
    }

    // Crypto — always runs
    for (const symbol of config.CRYPTO_WATCHLIST) {
      const log = await analyzeSymbol(symbol, "crypto", positions, portfolioValue, availableCash);
      tradeLog.unshift(log);
      await new Promise(r => setTimeout(r, 16000));
    }

    // Stocks — market hours only
    if (marketOpen) {
      for (const symbol of config.STOCK_WATCHLIST) {
        const log = await analyzeSymbol(symbol, "stock", positions, portfolioValue, availableCash);
        tradeLog.unshift(log);
        await new Promise(r => setTimeout(r, 16000));
      }
    } else {
      for (const symbol of config.STOCK_WATCHLIST) {
        tradeLog.unshift({ symbol, type: "stock", timestamp: new Date().toISOString(), status: "market-closed", reason: "US market closed" });
      }
    }

    if (tradeLog.length > 300) tradeLog = tradeLog.slice(0, 300);

  } catch (e) {
    console.error("[Scheduler] Cycle error:", e.message);
  } finally {
    isRunning = false;
  }
}

function start() {
  if (cronJob) return;
  cronJob = cron.schedule(config.SCHEDULE, runCycle);
  console.log("[Scheduler] Started");
  runCycle();
}

function stop() {
  if (cronJob) { cronJob.stop(); cronJob = null; }
  console.log("[Scheduler] Stopped");
}

function getStatus()   { return { running: isRunning, active: !!cronJob, schedule: config.SCHEDULE, positions: posTracker.getAll() }; }
function getTradeLog() { return tradeLog; }

module.exports = { start, stop, runCycle, getStatus, getTradeLog };
