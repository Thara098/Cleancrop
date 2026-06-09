const fetch = (...a) => import("node-fetch").then(({ default: f }) => f(...a));
const { ANTHROPIC_KEY } = require("./config");

function fmt(n) { return n != null ? parseFloat(n).toFixed(4) : "N/A"; }

async function getDecision(indicators, position, portfolioValue, entryData, availableCash, openPositionCount, maxPositions) {
  const { symbol, type, price, rsi, macd, macdSignal, macdHist,
          bbUpper, bbMiddle, bbLower, ema20, ema50, atr } = indicators;

  const posInfo   = position
    ? `Holding — avg entry: $${parseFloat(position.avg_entry_price).toFixed(2)} | P&L: $${parseFloat(position.unrealized_pl).toFixed(2)} (${(parseFloat(position.unrealized_plpc)*100).toFixed(2)}%)`
    : "No position.";
  const entryInfo = entryData
    ? `SL: $${entryData.stopLoss?.toFixed(2)} | TP: $${entryData.takeProfit?.toFixed(2)}`
    : "";

  const bbWidth    = bbUpper && bbLower ? ((bbUpper - bbLower) / bbMiddle * 100).toFixed(2) : "N/A";
  const priceVsBB  = price && bbUpper && bbLower
    ? (price >= bbUpper ? "AT/ABOVE upper" : price <= bbLower ? "AT/BELOW lower" : "inside bands")
    : "N/A";
  const macdCross  = macd && macdSignal ? (macd > macdSignal ? "BULLISH" : "BEARISH") : "N/A";
  const emaTrend   = ema20 && ema50 ? (ema20 > ema50 ? "UPTREND" : "DOWNTREND") : "N/A";

  const mediumSize = Math.min(portfolioValue * 0.10, availableCash * 0.98);
  const highSize   = Math.min(portfolioValue * 0.12, availableCash * 0.98);
  const tooManyPositions = openPositionCount >= maxPositions;

  const prompt = `You are a disciplined AI trading agent for ${symbol} (${type}).
Goal: protect capital first, grow second. Only trade on HIGH CONVICTION setups.

LIVE INDICATORS (1h):
- Price:       $${fmt(price)}
- RSI(14):     ${fmt(rsi)} — ${rsi < 35 ? "OVERSOLD (strong buy signal)" : rsi > 65 ? "OVERBOUGHT (strong sell signal)" : rsi < 45 ? "leaning oversold" : rsi > 55 ? "leaning overbought" : "NEUTRAL (no signal)"}
- MACD:        ${fmt(macd)} | Signal: ${fmt(macdSignal)} | Hist: ${fmt(macdHist)} → ${macdCross} cross
- Bollinger:   Lower $${fmt(bbLower)} | Mid $${fmt(bbMiddle)} | Upper $${fmt(bbUpper)} → price is ${priceVsBB}
- EMA20/50:    $${fmt(ema20)} / $${fmt(ema50)} → ${emaTrend}
- ATR:         ${fmt(atr)}

PORTFOLIO:
- Value: $${portfolioValue.toFixed(2)} | Cash: $${availableCash.toFixed(2)}
- Open positions: ${openPositionCount}/${maxPositions}${tooManyPositions ? " — MAX REACHED, NO NEW BUYS" : ""}
- This position: ${posInfo} ${entryInfo}

STRICT SCORING RULES:
BULLISH points (+1 each, only if clearly true):
  1. MACD histogram > 0 AND MACD > signal line (both must be true)
  2. RSI < 40 (genuinely oversold, not just below 50)
  3. Price at or below BB lower band
  4. EMA20 > EMA50 (uptrend confirmed)
  5. Price > EMA20 (above short-term average)

BEARISH points (+1 each, only if clearly true):
  1. MACD histogram < 0 AND MACD < signal line (both must be true)
  2. RSI > 60 (genuinely overbought, not just above 50)
  3. Price at or above BB upper band
  4. EMA20 < EMA50 (downtrend confirmed)
  5. Price < EMA20 (below short-term average)

DECISION (follow strictly):
- ${tooManyPositions ? "MAX POSITIONS REACHED → HOLD only, no new buys" : "Bullish >= 4, no position → BUY HIGH, $" + highSize.toFixed(0)}
- ${tooManyPositions ? "" : "Bullish = 3, no position → BUY MEDIUM, $" + mediumSize.toFixed(0)}
- Bullish <= 2, no position → HOLD (not enough signals)
- Bearish >= 3, has position → SELL (exit to protect capital)
- Bearish <= 2, has position → HOLD (let it develop)
- Any MACD bearish cross when considering BUY → automatic HOLD

Respond in raw JSON only (no markdown):
{
  "action": "BUY" or "SELL" or "HOLD",
  "dollars": <number or 0>,
  "confidence": "LOW" or "MEDIUM" or "HIGH",
  "bullish_score": <0-5>,
  "bearish_score": <0-5>,
  "signals_summary": "<specific signals that fired>",
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
      max_tokens: 450,
      messages:   [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Claude API failed");

  const raw = data.content[0].text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "");
  return JSON.parse(raw);
}

module.exports = { getDecision };
