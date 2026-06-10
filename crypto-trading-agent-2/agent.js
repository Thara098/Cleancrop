// agent.js — Agent 2 (ML-enhanced)
// Adds: RSI divergence, MACD momentum, BB state, ML win-rate confidence, adaptive scoring
const fetch = (...a) => import("node-fetch").then(({ default: f }) => f(...a));
const { ANTHROPIC_KEY } = require("./config");

function fmt(n)  { return n != null ? parseFloat(n).toFixed(4) : "N/A"; }
function fmtP(n) { return n != null ? parseFloat(n).toFixed(2) + "%" : "N/A"; }

// ATR-based position sizing: risk 1% of portfolio per trade, stop at 1.5x ATR
// Hard cap: 8% of portfolio OR $8,000 max per trade (prevents BTC ATR blowing up sizes)
function calcPositionSize(portfolioValue, price, atr, availableCash) {
  const hardCap = Math.min(portfolioValue * 0.08, 8000);
  if (!atr || !price) return Math.min(portfolioValue * 0.07, hardCap, availableCash * 0.95);
  const riskDollars = portfolioValue * 0.01;
  const slFraction  = (atr * 1.5) / price;
  return Math.min(riskDollars / slFraction, hardCap, availableCash * 0.95);
}

// patterns + mlBonus + winRate are Agent 2 additions (all optional, gracefully ignored if null)
async function getDecision(
  indicators, position, portfolioValue, entryData,
  availableCash, openPositionCount, maxPositions,
  fearAndGreed, history,
  patterns = null, mlBonus = 0, winRate = null
) {
  const {
    symbol, type, price, rsi, macd, macdSignal, macdHist,
    bbUpper, bbMiddle, bbLower, bbWidth,
    ema20, ema50, ema200, atr, adx,
    supertrendDir, obv, regime,
  } = indicators;

  const fg = fearAndGreed || { value: 50, classification: "Neutral" };

  const isLong  = position && (position.side === "long"  || parseFloat(position.qty) > 0);
  const isShort = position && (position.side === "short" || parseFloat(position.qty) < 0);
  const canShort = type === "stock";

  const posInfo = position
    ? `${isShort ? "SHORT" : "LONG"} — avg entry: $${parseFloat(position.avg_entry_price).toFixed(2)} | P&L: $${parseFloat(position.unrealized_pl).toFixed(2)} (${(parseFloat(position.unrealized_plpc)*100).toFixed(2)}%)`
    : "No position.";
  const entryInfo = entryData
    ? `SL: $${entryData.stopLoss?.toFixed(2)} | TP: $${entryData.takeProfit?.toFixed(2)}`
    : "";

  const priceVsBB  = price && bbUpper && bbLower
    ? (price >= bbUpper ? "AT/ABOVE upper" : price <= bbLower ? "AT/BELOW lower" : "inside bands") : "N/A";
  const macdCross  = macd && macdSignal ? (macd > macdSignal ? "BULLISH" : "BEARISH") : "N/A";
  const emaTrend   = ema20 && ema50 ? (ema20 > ema50 ? "UPTREND" : "DOWNTREND") : "N/A";
  const ema200Bias = price && ema200 ? (price > ema200 ? "ABOVE (bullish)" : "BELOW (bearish)") : "N/A";
  const stDir      = supertrendDir ? (supertrendDir === "long" ? "BULLISH (long)" : "BEARISH (short)") : "N/A";

  const tooManyPositions = openPositionCount >= maxPositions;
  const atrPos     = calcPositionSize(portfolioValue, price, atr, availableCash);
  const highSize   = Math.round(atrPos);
  const mediumSize = Math.round(atrPos * 0.75);

  const fgContext = fg.value <= 24 ? "EXTREME FEAR — historically best buying opportunity. Strong contrarian BUY signal."
    : fg.value <= 44 ? "FEAR — lean toward buying dips on strong setups."
    : fg.value <= 54 ? "NEUTRAL — no directional sentiment bias."
    : fg.value <= 74 ? "GREED — tighten buy criteria, consider taking profits."
    : "EXTREME GREED — dangerous to buy. Prioritize exits and shorts.";

  const regimeContext = regime === "STRONG_TREND"   ? "STRONG TREND (ADX>30) — trend-following most effective."
    : regime === "WEAK_TREND"                       ? "WEAK TREND (ADX 20-30) — moderate trending. Require score 4+."
    : regime === "RANGING_VOLATILE"                 ? "RANGING VOLATILE (ADX<20, wide BB) — risky. Only extremes qualify."
    : regime === "RANGING_QUIET"                    ? "RANGING QUIET (ADX<20, tight BB) — no direction. HOLD only."
    : "UNKNOWN regime — be conservative.";

  // ── Pattern analysis block (Agent 2 exclusive) ──────────────────────────
  const patternBlock = patterns ? `
PATTERN ANALYSIS (Agent 2 ML — multi-candle 4H data):
- RSI Divergence:    ${patterns.rsiBullishDiv ? "BULLISH DIVERGENCE DETECTED (+1 bullish)" : patterns.rsiBearishDiv ? "BEARISH DIVERGENCE DETECTED (+1 bearish)" : "None"}
- MACD Momentum:     ${patterns.macdMomentum}${patterns.macdMomentum === "ACCELERATING_UP" ? " (+1 bullish — histogram rising 3+ candles)" : patterns.macdMomentum === "ACCELERATING_DOWN" ? " (+1 bearish — histogram falling 3+ candles)" : patterns.macdMomentum === "RECOVERING" ? " (+0.5 bullish — turning from bear)" : patterns.macdMomentum === "FADING" ? " (+0.5 bearish — bull fading)" : ""}
- BB State:          ${patterns.bbState}${patterns.bbState === "SQUEEZE" ? " ⚠ breakout imminent — direction unclear, wait for break" : patterns.bbState === "EXPANSION" ? " — trend in motion, ride it" : ""}
- Price ROC (20H):   ${patterns.priceROC5 > 0 ? "+" : ""}${patterns.priceROC5}% | ROC (48H): ${patterns.priceROC12 > 0 ? "+" : ""}${patterns.priceROC12}%
PATTERN SCORING RULES:
  +1 bullish: RSI Bullish Divergence (price lower low + RSI higher low = reversal likely)
  +1 bearish: RSI Bearish Divergence (price higher high + RSI lower high = reversal likely)
  +1 bullish: MACD ACCELERATING_UP (histogram rising 3 consecutive candles)
  +1 bearish: MACD ACCELERATING_DOWN (histogram falling 3 consecutive candles)
  +0 (caution): BB SQUEEZE — wait for direction confirmation before entering
  +1 bullish: BB EXPANSION + price rising (trend confirmed)
  +1 bearish: BB EXPANSION + price falling (trend confirmed)` : "";

  // ── ML confidence block (journal win-rate learning) ─────────────────────
  const mlBlock = `
ML CONFIDENCE (learned from trade history):
- ML signal bonus/penalty: ${mlBonus > 0 ? "+" : ""}${mlBonus} (based on historical accuracy of current signals)${mlBonus === 0 ? " — not enough data yet or signals are neutral" : mlBonus > 0 ? " — these signals have been profitable recently, slight size increase" : " — these signals have been losing recently, reduce size"}
${winRate ? `- This symbol past performance: ${winRate.winRate}% win rate over ${winRate.trades} trades (${winRate.wins}W / ${winRate.losses}L | total P&L: ${winRate.totalPnl}%)` : "- This symbol: no recorded trades yet (journal empty)"}
ML RULES:
  ML bonus +2 → add +1 to final bullish score (strong historical edge)
  ML bonus +1 → lower buy threshold by 0.5 (slightly lower bar)
  ML bonus -1 → raise buy threshold by 0.5 (slightly higher bar)
  ML bonus -2 → add -1 to final bullish score (historically poor)`;

  const histBlock = history ? `
HISTORICAL CONTEXT (365 days of daily data):
- Macro trend:       ${history.ltTrend} (price ${history.ltTrend === "BULL" ? "ABOVE" : "BELOW"} 200d SMA $${history.sma200.toLocaleString()})
- Mid trend:         ${history.mtTrend} (20d SMA $${history.sma20.toLocaleString()} vs 50d $${history.sma50.toLocaleString()})
- 52w high/low:      $${history.high52.toLocaleString()} / $${history.low52.toLocaleString()}
- From ATH:          ${history.distFromHigh}% | From yearly low: +${history.distFromLow}%
- 30d / 90d / 1y:    ${history.change30d}% / ${history.change90d}% / ${history.change1y}%
- Key supports:      $${history.supports.map(s => s.toLocaleString()).join(" · $")}
- Key resistances:   $${history.resistances.map(r => r.toLocaleString()).join(" · $")}
- Near support:      ${history.nearSupport ? "YES — strong historical buy zone (+1 bullish)" : "No"}
- Near resistance:   ${history.nearResistance ? "YES — strong historical sell zone (+1 bearish)" : "No"}
- Volatility (30d):  ${history.hvol30d}% annualized
- Volume trend:      ${history.volTrend}
HISTORICAL RULES:
- BEAR macro + price below 200d → don't fight it with longs; prefer SHORT for stocks
- BULL macro + price above 200d → macro tailwind, buy dips
- Near support → +1 bullish | Near resistance → +1 bearish
- distFromHigh > -3% → near ATH, risky to buy | distFromHigh < -40% → deep value` : "";

  // ── LONG scoring rules ────────────────────────────────────────────────────
  const longRules = tooManyPositions ? "MAX POSITIONS — no new longs" : type === "stock" ? `
LONG (BUY) HARD FILTERS FOR STOCKS — must all pass:
  ✗ Price below EMA200 by more than 3% → NO BUY
  ✗ Regime RANGING_QUIET → NO BUY
  ✗ Fear & Greed >= 80 → NO BUY
LONG SCORING FOR STOCKS (+1 each):
  1. MACD hist > 0 AND MACD > signal (+1) | MACD bearish (-1 penalty)
  2. RSI STRICTLY < 40.0
  3. Price at/below BB lower band
  4. EMA20 > EMA50
  5. Price > EMA20
  PATTERN BONUS +1: RSI Bullish Divergence detected above
  PATTERN BONUS +1: MACD ACCELERATING_UP above
  BONUS +1: F&G <= 25 | BONUS +1: regime STRONG_TREND or WEAK_TREND
STOCK BUY DECISIONS:
  Score >= 3, all hard filters pass, no position → BUY HIGH ($${highSize})
  Score = 2, RSI < 35 AND price > EMA200 → BUY MEDIUM ($${mediumSize}) [deep oversold]
  Score <= 1 → HOLD
STOCK SELL DECISIONS (has long position):
  Bearish score >= 2 → SELL
  RSI > 65 → SELL (take profit)` : `
LONG (BUY) HARD FILTERS FOR CRYPTO:
  ✗ Regime RANGING_QUIET → NO BUY
  ✗ Fear & Greed >= 75 → NO BUY
  ✗ BB SQUEEZE with no direction → wait for breakout, no BUY yet
LONG SCORING FOR CRYPTO (+1 each, only if strictly true):
  1. MACD hist > 0 AND MACD > signal (+1) | MACD bearish = -1 penalty
  2. RSI STRICTLY < 40.0
  3. Price at/below BB lower band
  4. EMA20 > EMA50
  5. Price > EMA20
  PATTERN BONUS +1: RSI Bullish Divergence (powerful reversal signal — count this!)
  PATTERN BONUS +1: MACD ACCELERATING_UP (momentum building)
  PATTERN BONUS +1: BB EXPANSION + price rising (trend confirmed by volatility)
  BONUS +1: F&G <= 25 | BONUS +1: regime STRONG_TREND or WEAK_TREND
  BONUS +1: price above EMA200 (macro bull)
  PENALTY -1: Supertrend BEARISH | PENALTY -1: price >15% below EMA200
  ML BONUS: apply mlBonus directly to final score (+1 or -1 based on journal data)
CRYPTO BUY DECISIONS:
  Score >= 4, all hard filters pass, no position → BUY HIGH ($${highSize})
  Score = 3, all hard filters pass, no position → BUY MEDIUM ($${mediumSize})
  Score <= 2 → HOLD
CRYPTO SELL DECISIONS (has long position):
  Bearish score >= 3 → SELL
  RSI > 70 → SELL (take profit, overbought)`;

  // ── SHORT rules ───────────────────────────────────────────────────────────
  const shortRules = !canShort ? "SHORT SELLING: not available for crypto on this platform." : `
SHORT SELLING (stocks only):
SHORT HARD FILTERS:
  ✗ F&G <= 10 (extreme fear bottom) → NO SHORT
  ✗ Price above EMA200 by more than 3% → NO SHORT
  ✗ Max positions reached → NO SHORT
SHORT SCORING (+1 each):
  1. MACD hist < 0 AND MACD < signal
  2. RSI STRICTLY > 55
  3. Price at/above BB upper band
  4. EMA20 < EMA50
  5. Price < EMA20
  PATTERN BONUS +1: RSI Bearish Divergence | PATTERN BONUS +1: MACD ACCELERATING_DOWN
  BONUS +1: regime STRONG_TREND or WEAK_TREND downward | BONUS +1: F&G >= 65
SHORT DECISIONS:
  Bearish score >= 3, all filters pass, no position → SHORT ($${highSize})
  Bearish score = 2, MACD bearish AND price < EMA20 → SHORT MEDIUM ($${mediumSize})
COVER DECISIONS:
  Has SHORT + bullish score >= 3 → COVER
  Has SHORT + RSI < 30 → COVER (bounce likely)
SHORT SL/TP:
  Stop loss   = entry + (1.5 × ATR)
  Take profit = entry − (3.0 × ATR)`;

  const prompt = `You are Agent 2 — an AI trading agent with machine learning capabilities for ${symbol} (${type}).
MISSION: Make profit in BOTH directions. Protect capital. Use pattern analysis and ML data to improve accuracy.

LIVE INDICATORS (4H timeframe):
- Price:      $${fmt(price)}
- RSI(14):    ${fmt(rsi)} — ${rsi != null ? (rsi < 30 ? "EXTREMELY OVERSOLD" : rsi < 40 ? "OVERSOLD" : rsi > 70 ? "EXTREMELY OVERBOUGHT" : rsi > 60 ? "OVERBOUGHT" : "NEUTRAL") : "N/A"}
- MACD:       ${fmt(macd)} | Signal: ${fmt(macdSignal)} | Hist: ${fmt(macdHist)} → ${macdCross}
- Bollinger:  Lower $${fmt(bbLower)} | Mid $${fmt(bbMiddle)} | Upper $${fmt(bbUpper)} | Width: ${fmtP(bbWidth)} → ${priceVsBB}
- EMA20/50:   $${fmt(ema20)} / $${fmt(ema50)} → ${emaTrend}
- EMA200:     $${fmt(ema200)} → price ${ema200Bias}
- Supertrend: ${stDir}
- ADX:        ${fmt(adx)} — ${adx != null ? (adx > 30 ? "strong trend" : adx > 20 ? "weak trend" : "ranging/no trend") : "N/A"}
- ATR:        ${fmt(atr)} (ATR-sized position: $${highSize} | capped at $8,000 max)

MARKET REGIME: ${regimeContext}
FEAR & GREED:  ${fg.value}/100 — ${fg.classification}. ${fgContext}
${patternBlock}
${mlBlock}
${histBlock}
PORTFOLIO:
- Value: $${portfolioValue.toFixed(2)} | Cash: $${availableCash.toFixed(2)}
- Open positions: ${openPositionCount}/${maxPositions}${tooManyPositions ? " — MAX REACHED" : ""}
- This position: ${posInfo} ${entryInfo}

${longRules}

${shortRules}

EXISTING POSITION MANAGEMENT:
- Has LONG + bearish score >= 3 → SELL
- Has SHORT + bullish score >= 3 → COVER

Respond in raw JSON only (no markdown):
{
  "action": "BUY" or "SELL" or "HOLD" or "SHORT" or "COVER",
  "dollars": <number or 0>,
  "confidence": "LOW" or "MEDIUM" or "HIGH",
  "bullish_score": <0-9>,
  "bearish_score": <0-8>,
  "hard_filters_passed": true or false,
  "pattern_signals": "<which patterns fired>",
  "ml_applied": "<how ML bonus was used>",
  "regime": "<regime>",
  "signals_summary": "<all signals that fired>",
  "reasoning": "<2-3 sentences with exact numbers>",
  "risk_note": "<what invalidates this trade>",
  "stop_loss": <price or null>,
  "take_profit": <price or null>
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages:   [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Claude API failed");

  let raw = data.content[0].text.trim()
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/, "");

  if (!raw.endsWith("}")) {
    const lastBrace = raw.lastIndexOf("}");
    raw = lastBrace > 0 ? raw.slice(0, lastBrace + 1) : raw + "}";
  }

  return JSON.parse(raw);
}

module.exports = { getDecision };
