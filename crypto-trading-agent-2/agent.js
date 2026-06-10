const fetch = (...a) => import("node-fetch").then(({ default: f }) => f(...a));
const { ANTHROPIC_KEY } = require("./config");

function fmt(n) { return n != null ? parseFloat(n).toFixed(4) : "N/A"; }
function fmtP(n) { return n != null ? parseFloat(n).toFixed(2) + "%" : "N/A"; }

// ATR-based position sizing: risk 1% of portfolio per trade, stop at 1.5x ATR
function calcPositionSize(portfolioValue, price, atr, availableCash) {
  if (!atr || !price) return Math.min(portfolioValue * 0.10, availableCash * 0.95);
  const riskDollars = portfolioValue * 0.01;
  const slFraction  = (atr * 1.5) / price;
  return Math.min(riskDollars / slFraction, portfolioValue * 0.15, availableCash * 0.95);
}

async function getDecision(indicators, position, portfolioValue, entryData, availableCash, openPositionCount, maxPositions, fearAndGreed, history) {
  const {
    symbol, type, price, rsi, macd, macdSignal, macdHist,
    bbUpper, bbMiddle, bbLower, bbWidth,
    ema20, ema50, ema200, atr, adx,
    supertrendDir, obv, regime,
  } = indicators;

  const fg = fearAndGreed || { value: 50, classification: "Neutral" };

  // Detect if existing position is long or short
  const isLong  = position && (position.side === "long"  || parseFloat(position.qty) > 0);
  const isShort = position && (position.side === "short" || parseFloat(position.qty) < 0);
  const canShort = type === "stock"; // Alpaca only supports short selling for stocks

  const posInfo = position
    ? `${isShort ? "SHORT" : "LONG"} — avg entry: $${parseFloat(position.avg_entry_price).toFixed(2)} | P&L: $${parseFloat(position.unrealized_pl).toFixed(2)} (${(parseFloat(position.unrealized_plpc)*100).toFixed(2)}%)`
    : "No position.";
  const entryInfo = entryData
    ? `SL: $${entryData.stopLoss?.toFixed(2)} | TP: $${entryData.takeProfit?.toFixed(2)}`
    : "";

  const priceVsBB   = price && bbUpper && bbLower
    ? (price >= bbUpper ? "AT/ABOVE upper" : price <= bbLower ? "AT/BELOW lower" : "inside bands") : "N/A";
  const macdCross   = macd && macdSignal ? (macd > macdSignal ? "BULLISH" : "BEARISH") : "N/A";
  const emaTrend    = ema20 && ema50 ? (ema20 > ema50 ? "UPTREND" : "DOWNTREND") : "N/A";
  const ema200Bias  = price && ema200 ? (price > ema200 ? "ABOVE (bullish)" : "BELOW (bearish)") : "N/A";
  const stDir       = supertrendDir ? (supertrendDir === "long" ? "BULLISH (long)" : "BEARISH (short)") : "N/A";

  const tooManyPositions = openPositionCount >= maxPositions;
  const atrPos     = calcPositionSize(portfolioValue, price, atr, availableCash);
  const highSize   = Math.round(atrPos);
  const mediumSize = Math.round(atrPos * 0.75);

  const fgContext = fg.value <= 24 ? "EXTREME FEAR — historically best buying opportunity. Strong contrarian BUY signal."
    : fg.value <= 44 ? "FEAR — lean toward buying dips on strong setups."
    : fg.value <= 54 ? "NEUTRAL — no directional sentiment bias."
    : fg.value <= 74 ? "GREED — tighten buy criteria, consider taking profits."
    : "EXTREME GREED — dangerous to buy. Prioritize exits and shorts.";

  const regimeContext = regime === "STRONG_TREND"   ? "STRONG TREND (ADX>30) — trend-following most effective. Trade in trend direction."
    : regime === "WEAK_TREND"                       ? "WEAK TREND (ADX 20-30) — moderate trending. Require score 4+ to enter."
    : regime === "RANGING_VOLATILE"                 ? "RANGING VOLATILE (ADX<20, wide BB) — risky. Only extremes qualify."
    : regime === "RANGING_QUIET"                    ? "RANGING QUIET (ADX<20, tight BB) — no direction. HOLD only."
    : "UNKNOWN regime — be conservative.";

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
- Near support → +1 bullish bonus | Near resistance → +1 bearish bonus
- distFromHigh > -3% → near ATH, risky to buy | distFromHigh < -40% → deep value territory
` : "";

  // ── LONG decision rules — stricter for crypto, looser for stocks ─────
  const longRules = tooManyPositions ? "MAX POSITIONS — no new longs" : type === "stock" ? `
LONG (BUY) HARD FILTERS FOR STOCKS — must all pass:
  ✗ Price below EMA200 by more than 3% → NO BUY (allow up to 3% below as margin)
  ✗ Regime RANGING_QUIET → NO BUY
  ✗ Fear & Greed >= 80 → NO BUY
  NOTE: MACD bearish is NOT a hard block for stocks — it reduces score instead
LONG SCORING FOR STOCKS (+1 each):
  1. MACD hist > 0 AND MACD > signal (+1) | MACD bearish (-1 penalty, not a block)
  2. RSI STRICTLY < 40.0
  3. Price at/below BB lower band
  4. EMA20 > EMA50
  5. Price > EMA20
  BONUS +1: F&G <= 25 (extreme fear)
  BONUS +1: regime STRONG_TREND or WEAK_TREND
STOCK BUY DECISIONS:
  Score >= 3, all hard filters pass, no position → BUY HIGH ($${highSize})
  Score = 2, RSI < 35 AND price > EMA200 → BUY MEDIUM ($${mediumSize}) [deep oversold]
  Score <= 1 → HOLD
STOCK SELL DECISIONS (has long position):
  Bearish score >= 2 → SELL (quicker exits than crypto)
  RSI > 65 → SELL (take profit, overbought)` : `
LONG (BUY) HARD FILTERS FOR CRYPTO:
  ✗ Regime RANGING_QUIET → NO BUY (no direction at all)
  ✗ Fear & Greed >= 75 → NO BUY (euphoria = danger)
  NOTE: EMA200, Supertrend, MACD are scoring factors not hard blocks — bear markets need contrarian entries
LONG SCORING FOR CRYPTO (+1 each, only if strictly true):
  1. MACD hist > 0 AND MACD > signal (+1) | MACD bearish = -1 penalty
  2. RSI STRICTLY < 40.0
  3. Price at/below BB lower band
  4. EMA20 > EMA50
  5. Price > EMA20
  BONUS +1: F&G <= 25 (extreme fear — historically best crypto buy signal)
  BONUS +1: regime STRONG_TREND or WEAK_TREND
  BONUS +1: price above EMA200 (macro bull trend)
  PENALTY -1: Supertrend BEARISH
  PENALTY -1: price more than 15% below EMA200 (deep bear, too risky)
CRYPTO BUY DECISIONS:
  Score >= 4, all hard filters pass, no position → BUY HIGH ($${highSize})
  Score = 3, all hard filters pass, no position → BUY MEDIUM ($${mediumSize})
  Score <= 2 → HOLD
CRYPTO SELL DECISIONS (has long position):
  Bearish score >= 3 → SELL
  RSI > 70 → SELL (take profit, overbought)`;

  // ── SHORT decision rules (stocks only) ──────────────────────────────
  const shortRules = !canShort ? "SHORT SELLING: not available for crypto on this platform." : `
SHORT SELLING (stocks only — profit when price falls):
SHORT HARD FILTERS — must pass for new short:
  ✗ F&G <= 10 (extreme fear bottom) → NO SHORT (too risky near capitulation)
  ✗ Price above EMA200 by more than 3% → NO SHORT
  ✗ Max positions reached → NO SHORT
SHORT SCORING (+1 each, only if strictly true):
  1. MACD hist < 0 AND MACD < signal (bearish momentum)
  2. RSI STRICTLY > 55 (leaning overbought for stocks — lower bar than crypto)
  3. Price at/above BB upper band
  4. EMA20 < EMA50 (downtrend)
  5. Price < EMA20 (momentum down)
  BONUS +1: regime STRONG_TREND or WEAK_TREND downward | BONUS +1: F&G >= 65
SHORT DECISIONS:
  Bearish score >= 3, all short filters pass, no position → SHORT ($${highSize})
  Bearish score = 2, MACD bearish AND price < EMA20 → SHORT MEDIUM ($${mediumSize})
COVER (close short) DECISIONS:
  Has SHORT position + bullish score >= 3 → COVER (lock in profit / cut loss)
  Has SHORT position + RSI < 30 (extremely oversold) → COVER (bounce likely)
SHORT SL/TP (reversed from longs):
  Stop loss   = entry price + (1.5 × ATR)  ← loss if price rises above this
  Take profit = entry price − (3.0 × ATR)  ← profit if price falls to this`;

  const prompt = `You are a disciplined AI trading agent for ${symbol} (${type}).
MISSION: Make profit in BOTH directions. Protect capital. Only trade HIGH CONVICTION setups.

LIVE INDICATORS (4h timeframe):
- Price:      $${fmt(price)}
- RSI(14):    ${fmt(rsi)} — ${rsi != null ? (rsi < 30 ? "EXTREMELY OVERSOLD" : rsi < 40 ? "OVERSOLD" : rsi > 70 ? "EXTREMELY OVERBOUGHT" : rsi > 60 ? "OVERBOUGHT" : "NEUTRAL") : "N/A"}
- MACD:       ${fmt(macd)} | Signal: ${fmt(macdSignal)} | Hist: ${fmt(macdHist)} → ${macdCross}
- Bollinger:  Lower $${fmt(bbLower)} | Mid $${fmt(bbMiddle)} | Upper $${fmt(bbUpper)} | Width: ${fmtP(bbWidth)} → ${priceVsBB}
- EMA20/50:   $${fmt(ema20)} / $${fmt(ema50)} → ${emaTrend}
- EMA200:     $${fmt(ema200)} → price ${ema200Bias}
- Supertrend: ${stDir}
- ADX:        ${fmt(adx)} — ${adx != null ? (adx > 30 ? "strong trend" : adx > 20 ? "weak trend" : "ranging/no trend") : "N/A"}
- ATR:        ${fmt(atr)} (ATR-sized position: $${highSize})

MARKET REGIME: ${regimeContext}
FEAR & GREED:  ${fg.value}/100 — ${fg.classification}. ${fgContext}
${histBlock}
PORTFOLIO:
- Value: $${portfolioValue.toFixed(2)} | Cash: $${availableCash.toFixed(2)}
- Open positions: ${openPositionCount}/${maxPositions}${tooManyPositions ? " — MAX REACHED" : ""}
- This position: ${posInfo} ${entryInfo}

${longRules}

${shortRules}

EXISTING POSITION MANAGEMENT:
- Has LONG + bearish score >= 3 → SELL (exit long, protect capital)
- Has SHORT + bullish score >= 3 → COVER (exit short, lock in profit or cut loss)

Respond in raw JSON only (no markdown):
{
  "action": "BUY" or "SELL" or "HOLD" or "SHORT" or "COVER",
  "dollars": <number or 0>,
  "confidence": "LOW" or "MEDIUM" or "HIGH",
  "bullish_score": <0-7>,
  "bearish_score": <0-6>,
  "hard_filters_passed": true or false,
  "regime": "<regime>",
  "signals_summary": "<signals that fired>",
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
      max_tokens: 1000,
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
