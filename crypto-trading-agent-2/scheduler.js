const cron        = require("node-cron");
const { getIndicators, getFearAndGreed } = require("./taapi");
const { getStockIndicators } = require("./twelvedata");
const { getDecision }   = require("./agent");
const { getHistoricalContext } = require("./history");
const alpaca      = require("./alpaca");
const posTracker  = require("./positions");
const config      = require("./config");

let tradeLog  = [];
let isRunning = false;
let cronJob   = null;

// Circuit breaker — halts new buys if portfolio drops 5% from peak
let peakEquity           = 0;
let circuitBreakerActive = false;

function updateCircuitBreaker(equity) {
  if (equity > peakEquity) {
    peakEquity = equity;
    if (circuitBreakerActive) {
      console.log(`[CircuitBreaker] Recovered — equity $${equity.toFixed(0)} above previous peak. Trading resumed.`);
      circuitBreakerActive = false;
    }
  }
  const drawdown = peakEquity > 0 ? (peakEquity - equity) / peakEquity : 0;
  if (drawdown >= 0.05 && !circuitBreakerActive) {
    circuitBreakerActive = true;
    console.log(`[CircuitBreaker] ACTIVE — drawdown ${(drawdown*100).toFixed(1)}% from peak $${peakEquity.toFixed(0)}. No new buys until recovery.`);
  }
  return circuitBreakerActive;
}

// Reduce position sizes by 40% on weekends (lower liquidity, higher manipulation risk)
function weekendSizeFactor() {
  const day = new Date().getDay(); // 0=Sun, 6=Sat
  return (day === 0 || day === 6) ? 0.60 : 1.0;
}

async function checkStopLossAndTakeProfit(positions) {
  for (const position of positions) {
    const entry = posTracker.getEntry(position.symbol);
    if (!entry) continue;

    const currentPrice = parseFloat(position.current_price);
    const pnlPct       = parseFloat(position.unrealized_plpc) * 100;

    const isShortPos = position.side === "short" || parseFloat(position.qty) < 0;
    let exitReason = null;
    if (!isShortPos) {
      if (entry.stopLoss   && currentPrice <= entry.stopLoss)   exitReason = "stop-loss";
      if (entry.takeProfit && currentPrice >= entry.takeProfit) exitReason = "take-profit";
    } else {
      // For shorts: SL is above entry, TP is below entry
      if (entry.stopLoss   && currentPrice >= entry.stopLoss)   exitReason = "stop-loss";
      if (entry.takeProfit && currentPrice <= entry.takeProfit) exitReason = "take-profit";
    }

    if (exitReason) {
      console.log(`[${position.symbol}] ${exitReason.toUpperCase()} at $${currentPrice} (${pnlPct.toFixed(2)}%)`);
      try {
        const order = await alpaca.closePosition(position.symbol);
        posTracker.clearEntry(position.symbol);
        tradeLog.unshift({
          symbol:    position.symbol,
          type:      "auto-exit",
          timestamp: new Date().toISOString(),
          status:    "executed",
          order,
          decision: {
            action:          "SELL",
            dollars:         entry.dollars,
            confidence:      "HIGH",
            signals_summary: exitReason === "stop-loss"
              ? "Stop loss triggered — cutting loss"
              : "Take profit triggered — locking in gain",
            reasoning: exitReason === "stop-loss"
              ? `Price $${currentPrice} hit stop loss $${entry.stopLoss?.toFixed(2)}. P&L: ${pnlPct.toFixed(2)}%`
              : `Price $${currentPrice} hit take profit $${entry.takeProfit?.toFixed(2)}. P&L: ${pnlPct.toFixed(2)}%`,
            risk_note: "Automatic exit",
          },
        });
      } catch (e) {
        console.error(`[${position.symbol}] Auto-exit failed:`, e.message);
      }
    }
  }
}

async function analyzeSymbol(symbol, type, positions, portfolioValue, availableCash, fearAndGreed, livePositionCount) {
  const log = { symbol, type, timestamp: new Date().toISOString() };

  try {
    const indicatorFn = type === "stock" ? getStockIndicators : (s) => getIndicators(s, type);
    const [indicators, history] = await Promise.all([
      indicatorFn(symbol),
      getHistoricalContext(symbol),
    ]);
    if (!indicators) throw new Error("Failed to fetch indicators");
    log.indicators = indicators;
    log.history    = history;

    const alpacaSymbol = type === "crypto"
      ? (config.CRYPTO_ALPACA[symbol] || symbol.replace("/", ""))
      : symbol;

    const position  = positions.find(p => p.symbol === alpacaSymbol) || null;
    const entryData = posTracker.getEntry(alpacaSymbol);
    const MAX_TOTAL_POSITIONS = 5; // hard cap across ALL assets combined
    const decision  = await getDecision(
      indicators, position, portfolioValue, entryData,
      availableCash, livePositionCount, MAX_TOTAL_POSITIONS, fearAndGreed, history
    );
    log.decision = decision;

    const fgLabel = `F&G:${fearAndGreed?.value ?? "?"}`;
    console.log(`[${symbol}] ${indicators.regime} | ${fgLabel} | Bull:${decision.bullish_score} Bear:${decision.bearish_score} → ${decision.action} (${decision.confidence})`);

    const rawDollars  = decision.dollars || (portfolioValue * 0.10);
    const sizeDollars = Math.min(rawDollars * weekendSizeFactor(), availableCash * 0.98);
    const isBuy  = decision.action === "BUY";
    const isShrt = decision.action === "SHORT";
    const isSell = decision.action === "SELL";
    const isCovr = decision.action === "COVER";

    if ((isBuy || isShrt) && decision.confidence !== "LOW") {
      if (circuitBreakerActive) {
        log.status = "skipped";
        log.reason = "Circuit breaker active — portfolio down 5%+ from peak";
        console.log(`[${symbol}] Circuit breaker — no new entries`);
        return log;
      }
      if (availableCash <= 0) {
        log.status = "skipped";
        log.reason = `Cash is negative ($${availableCash.toFixed(0)}) — no buying until account recovers`;
        console.log(`[${symbol}] Negative cash — skipping all buys`);
        return log;
      }
      if (availableCash < 500) {
        log.status = "skipped";
        log.reason = `Insufficient cash — only $${availableCash.toFixed(0)} available`;
        console.log(`[${symbol}] Not enough cash ($${availableCash.toFixed(0)})`);
        return log;
      }

      const side  = isBuy ? "buy" : "sell"; // SHORT = sell side on Alpaca
      const order = await alpaca.placeNotionalOrder(alpacaSymbol, sizeDollars, side);
      log.order  = order;
      log.status = "executed";

      if (decision.stop_loss || decision.take_profit) {
        posTracker.recordEntry(alpacaSymbol, indicators.price, decision.stop_loss, decision.take_profit, sizeDollars);
      }
      log.entryOpened = true; // signal to caller to increment live count
      console.log(`[${symbol}] ${isBuy ? "BUY" : "SHORT"} $${sizeDollars.toFixed(0)} | SL:$${decision.stop_loss?.toFixed(2)} | TP:$${decision.take_profit?.toFixed(2)}${weekendSizeFactor() < 1 ? " [weekend -40%]" : ""}`);

    } else if ((isSell || isCovr) && position) {
      const order = await alpaca.closePosition(alpacaSymbol);
      log.order        = order;
      log.status       = "executed";
      log.exitExecuted = true;
      log.exitValue    = Math.abs(parseFloat(position.market_value) || 0);
      posTracker.clearEntry(alpacaSymbol);
      console.log(`[${symbol}] ${isCovr ? "COVERED short" : "SOLD long"} — position closed`);

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

    // Update circuit breaker state
    updateCircuitBreaker(portfolioValue);

    // Fetch Fear & Greed once per cycle — applies to all symbols
    const fearAndGreed = await getFearAndGreed();
    console.log(`[Scheduler] F&G: ${fearAndGreed.value}/100 (${fearAndGreed.classification}) | Portfolio: $${portfolioValue.toFixed(0)} | Circuit: ${circuitBreakerActive ? "ACTIVE" : "OK"}`);

    // Check stop loss / take profit on all open positions first
    if (positions.length > 0) {
      await checkStopLossAndTakeProfit(positions);
    }

    // Live trackers — update during cycle so each symbol sees accurate state
    let livePositionCount = positions.length;
    let liveCash          = availableCash;

    // Crypto — runs 24/7 (crypto never sleeps)
    for (const symbol of config.CRYPTO_WATCHLIST) {
      const log = await analyzeSymbol(symbol, "crypto", positions, portfolioValue, liveCash, fearAndGreed, livePositionCount);
      if (log.entryOpened)  { livePositionCount++; liveCash -= (log.decision?.dollars || 0); }
      if (log.exitExecuted) { liveCash += (log.exitValue || 0); livePositionCount = Math.max(0, livePositionCount - 1); }
      tradeLog.unshift(log);
      await new Promise(r => setTimeout(r, 16000)); // Taapi rate limit: 1 req/15s
    }

    // Stocks — market hours only
    if (marketOpen) {
      for (const symbol of config.STOCK_WATCHLIST) {
        const log = await analyzeSymbol(symbol, "stock", positions, portfolioValue, liveCash, fearAndGreed, livePositionCount);
        if (log.entryOpened)  { livePositionCount++; liveCash -= (log.decision?.dollars || 0); }
        if (log.exitExecuted) { liveCash += (log.exitValue || 0); livePositionCount = Math.max(0, livePositionCount - 1); }
        tradeLog.unshift(log);
        await new Promise(r => setTimeout(r, 16000));
      }
    } else {
      for (const symbol of config.STOCK_WATCHLIST) {
        tradeLog.unshift({
          symbol, type: "stock",
          timestamp: new Date().toISOString(),
          status: "market-closed",
          reason: "US market closed",
        });
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
  console.log("[Scheduler] Started — 4H indicators, regime detection, Fear&Greed, circuit breaker active");
  runCycle();
}

function stop() {
  if (cronJob) { cronJob.stop(); cronJob = null; }
  console.log("[Scheduler] Stopped");
}

function getStatus() {
  return {
    running:        isRunning,
    active:         !!cronJob,
    schedule:       config.SCHEDULE,
    positions:      posTracker.getAll(),
    circuitBreaker: { active: circuitBreakerActive, peakEquity },
  };
}

function getTradeLog() { return tradeLog; }

module.exports = { start, stop, runCycle, getStatus, getTradeLog };
