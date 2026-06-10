const cron        = require("node-cron");
const { getIndicators, getFearAndGreed } = require("./taapi");
const { getStockIndicators }   = require("./twelvedata");
const { getDecision }          = require("./agent");
const { getHistoricalContext } = require("./history");
const { getPatterns }          = require("./patterns");
const journal                  = require("./journal");
const alpaca      = require("./alpaca");
const posTracker  = require("./positions");
const config      = require("./config");

// Correlation guard — prevents buying multiple highly-correlated assets in same cycle
const CORRELATED_GROUPS = [
  ["BTCUSD", "ETHUSD", "SOLUSD"],
  ["XRPUSD", "DOGEUSD"],
];

function isCorrelationBlocked(alpacaSymbol, boughtThisCycle) {
  for (const group of CORRELATED_GROUPS) {
    if (!group.includes(alpacaSymbol)) continue;
    const already = group.filter(s => boughtThisCycle.has(s));
    if (already.length >= 1) {
      console.log(`[Correlation] ${alpacaSymbol} blocked — already bought correlated ${already[0]} this cycle`);
      return true;
    }
  }
  return false;
}

let tradeLog  = [];
let isRunning = false;
let cronJob   = null;

// Cancel any orders still stuck as "new" after one full cycle (5 mins)
// BTC paper orders sometimes never fill — this prevents cash getting frozen
async function cancelStaleOrders() {
  try {
    const orders = await alpaca.getOpenOrders();
    if (!orders.length) return;
    const staleMs = 6 * 60 * 1000; // 6 minutes
    const now = Date.now();
    let cancelled = 0;
    for (const order of orders) {
      const age = now - new Date(order.created_at).getTime();
      if (age > staleMs) {
        await alpaca.cancelOrder(order.id);
        cancelled++;
        console.log(`[Agent2] Cancelled stale order: ${order.symbol} ${order.side} $${order.notional} (${Math.round(age/60000)}m old)`);
      }
    }
    if (cancelled > 0) console.log(`[Agent2] Cancelled ${cancelled} stale order(s) — cash freed up`);
  } catch (e) {
    console.warn("[Agent2] Stale order cleanup error:", e.message);
  }
}

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

async function analyzeSymbol(symbol, type, positions, portfolioValue, availableCash, fearAndGreed, livePositionCount, boughtThisCycle) {
  const log = { symbol, type, timestamp: new Date().toISOString() };

  try {
    const indicatorFn = type === "stock" ? getStockIndicators : (s) => getIndicators(s, type);

    // Fetch indicators + history + patterns in parallel (patterns only for crypto)
    const [indicators, history, patterns] = await Promise.all([
      indicatorFn(symbol),
      getHistoricalContext(symbol),
      type === "crypto" ? getPatterns(symbol) : Promise.resolve(null),
    ]);
    if (!indicators) throw new Error("Failed to fetch indicators");
    log.indicators = indicators;
    log.history    = history;
    log.patterns   = patterns;

    const alpacaSymbol = type === "crypto"
      ? (config.CRYPTO_ALPACA[symbol] || symbol.replace("/", ""))
      : symbol;

    const position  = positions.find(p => p.symbol === alpacaSymbol) || null;
    const entryData = posTracker.getEntry(alpacaSymbol);

    // ML bonus from journal — adjusts position size and scoring
    const mlBonus = journal.getMLBonus(indicators, patterns);
    const winRate  = journal.getWinRate(alpacaSymbol);

    const MAX_TOTAL_POSITIONS = 5;
    const decision = await getDecision(
      indicators, position, portfolioValue, entryData,
      availableCash, livePositionCount, MAX_TOTAL_POSITIONS,
      fearAndGreed, history,
      patterns, mlBonus, winRate
    );
    log.decision = decision;
    log.mlBonus  = mlBonus;

    const fgLabel  = `F&G:${fearAndGreed?.value ?? "?"}`;
    const patLabel = patterns
      ? `DIV:${patterns.rsiBullishDiv ? "B+" : patterns.rsiBearishDiv ? "B-" : "─"} ${patterns.macdMomentum?.replace("_", "")?.slice(0, 6) ?? "?"}`
      : "";
    console.log(`[${symbol}] ${indicators.regime} | ${fgLabel} | ${patLabel} | ML:${mlBonus >= 0 ? "+" : ""}${mlBonus} | Bull:${decision.bullish_score} Bear:${decision.bearish_score} → ${decision.action} (${decision.confidence})`);

    const rawDollars  = decision.dollars || (portfolioValue * 0.10);
    const sizeDollars = Math.min(rawDollars * weekendSizeFactor(), availableCash * 0.98);
    const isBuy  = decision.action === "BUY";
    const isShrt = decision.action === "SHORT";
    const isSell = decision.action === "SELL";
    const isCovr = decision.action === "COVER";

    if ((isBuy || isShrt) && decision.confidence !== "LOW") {
      if (circuitBreakerActive) {
        log.status = "skipped"; log.reason = "Circuit breaker active";
        return log;
      }
      if (availableCash <= 0) {
        log.status = "skipped"; log.reason = `Cash is $${availableCash.toFixed(0)}`;
        return log;
      }
      if (availableCash < 500) {
        log.status = "skipped"; log.reason = `Insufficient cash $${availableCash.toFixed(0)}`;
        return log;
      }
      // Correlation guard — only applies to crypto buys
      if (type === "crypto" && isBuy && isCorrelationBlocked(alpacaSymbol, boughtThisCycle)) {
        log.status = "skipped"; log.reason = "Correlation guard — already bought correlated asset this cycle";
        return log;
      }

      const side  = isBuy ? "buy" : "sell";
      const order = await alpaca.placeNotionalOrder(alpacaSymbol, sizeDollars, side);
      log.order  = order;
      log.status = "executed";

      if (decision.stop_loss || decision.take_profit) {
        posTracker.recordEntry(alpacaSymbol, indicators.price, decision.stop_loss, decision.take_profit, sizeDollars);
      }

      // Record trade in journal so ML can learn from outcome
      journal.recordEntry({
        symbol, alpacaSymbol, action: isBuy ? "BUY" : "SHORT",
        dollars: sizeDollars, indicators, patterns,
      });

      log.entryOpened = true;
      if (isBuy) boughtThisCycle.add(alpacaSymbol);
      console.log(`[${symbol}] ${isBuy ? "BUY" : "SHORT"} $${sizeDollars.toFixed(0)} | SL:$${decision.stop_loss?.toFixed(2)} | TP:$${decision.take_profit?.toFixed(2)}${weekendSizeFactor() < 1 ? " [weekend -40%]" : ""} | ML:${mlBonus >= 0 ? "+" : ""}${mlBonus}`);

    } else if ((isSell || isCovr) && position) {
      const currentPrice = parseFloat(position.current_price);
      const pnlPct       = parseFloat(position.unrealized_plpc) * 100;
      const order = await alpaca.closePosition(alpacaSymbol);
      log.order        = order;
      log.status       = "executed";
      log.exitExecuted = true;
      log.exitValue    = Math.abs(parseFloat(position.market_value) || 0);
      // Record exit so journal can update win/loss stats and retrain signal weights
      journal.recordExit({ alpacaSymbol, exitPrice: currentPrice, pnlPct });
      posTracker.clearEntry(alpacaSymbol);
      console.log(`[${symbol}] ${isCovr ? "COVERED" : "SOLD"} | P&L: ${pnlPct.toFixed(2)}%`);

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
  console.log(`\n[Agent2] ── Cycle ${new Date().toLocaleTimeString()} ──`);

  try {
    // Clean up any orders stuck as "new" before doing anything else
    await cancelStaleOrders();

    const [positions, account] = await Promise.all([
      alpaca.getPositions(),
      alpaca.getAccount(),
    ]);
    const portfolioValue = parseFloat(account.portfolio_value);
    const availableCash  = parseFloat(account.cash);
    const marketOpen     = await alpaca.isMarketOpen();

    updateCircuitBreaker(portfolioValue);

    const fearAndGreed = await getFearAndGreed();

    if (positions.length > 0) {
      await checkStopLossAndTakeProfit(positions);
    }

    // Live trackers — update during cycle so each symbol sees accurate state
    let livePositionCount = positions.length;
    let liveCash          = availableCash;
    const boughtThisCycle = new Set(); // correlation guard tracking

    const mlStats = journal.getAllStats();
    console.log(`[Agent2] F&G:${fearAndGreed.value}/100 | Portfolio:$${portfolioValue.toFixed(0)} | Trades recorded:${mlStats.totalRecorded} | Circuit:${circuitBreakerActive ? "ACTIVE" : "OK"}`);

    // Crypto — runs 24/7
    for (const symbol of config.CRYPTO_WATCHLIST) {
      const log = await analyzeSymbol(symbol, "crypto", positions, portfolioValue, liveCash, fearAndGreed, livePositionCount, boughtThisCycle);
      if (log.entryOpened)  { livePositionCount++; liveCash -= (log.decision?.dollars || 0); }
      if (log.exitExecuted) { liveCash += (log.exitValue || 0); livePositionCount = Math.max(0, livePositionCount - 1); }
      tradeLog.unshift(log);
      await new Promise(r => setTimeout(r, 16000)); // Taapi rate limit: 1 req/15s
    }

    // Stocks — market hours only
    if (marketOpen) {
      for (const symbol of config.STOCK_WATCHLIST) {
        const log = await analyzeSymbol(symbol, "stock", positions, portfolioValue, liveCash, fearAndGreed, livePositionCount, boughtThisCycle);
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
  console.log("[Agent2] Started — patterns + ML journal + correlation guard + circuit breaker active");
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
    mlStats:        journal.getAllStats(),
  };
}

function getTradeLog() { return tradeLog; }

module.exports = { start, stop, runCycle, getStatus, getTradeLog };
