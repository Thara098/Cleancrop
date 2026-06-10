const fetch = (...a) => import("node-fetch").then(({ default: f }) => f(...a));
const { TAAPI_SECRET } = require("./config");

// 4H timeframe — research shows 62% win rate vs 51% on 1H
// Retries up to 2 times on 504 timeout (Taapi server-side issue)
async function getIndicators(symbol, type = "crypto", retries = 2) {
  const exchange = type === "crypto" ? "binance" : "stocks";
  const interval  = "4h";

  const body = JSON.stringify({
    secret: TAAPI_SECRET,
    construct: {
      exchange, symbol, interval,
      indicators: [
        { id: "rsi",        indicator: "rsi" },
        { id: "macd",       indicator: "macd" },
        { id: "bbands",     indicator: "bbands" },
        { id: "ema20",      indicator: "ema",        optInTimePeriod: 20  },
        { id: "ema50",      indicator: "ema",        optInTimePeriod: 50  },
        { id: "ema200",     indicator: "ema",        optInTimePeriod: 200 },
        { id: "atr",        indicator: "atr" },
        { id: "adx",        indicator: "adx" },
        { id: "supertrend", indicator: "supertrend", optInTimePeriod: 10, optInMultiplier: 3.5 },
        { id: "obv",        indicator: "obv" },
        { id: "candle",     indicator: "candle" },
      ],
    },
  });

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const res = await fetch("https://api.taapi.io/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 504 && attempt <= retries) {
        console.warn(`[Taapi] ${symbol} timeout (attempt ${attempt}) — retrying in 20s...`);
        await new Promise(r => setTimeout(r, 20000));
        continue;
      }
      throw new Error(`Taapi error (${symbol}): ${text}`);
    }

    const data = await res.json();
    const out  = {};
    for (const item of data.data) out[item.id] = item.result;

    const price    = out.candle?.close ?? null;
    const adxVal   = out.adx?.adx     ?? out.adx?.value ?? null;
    const bbUpper  = out.bbands?.valueUpperBand  ?? null;
    const bbLower  = out.bbands?.valueLowerBand  ?? null;
    const bbMiddle = out.bbands?.valueMiddleBand ?? null;

    const bbWidth = (bbUpper && bbLower && bbMiddle)
      ? ((bbUpper - bbLower) / bbMiddle * 100)
      : null;

    let regime = "UNKNOWN";
    if (adxVal !== null) {
      if      (adxVal > 30)                    regime = "STRONG_TREND";
      else if (adxVal > 20)                    regime = "WEAK_TREND";
      else if (bbWidth != null && bbWidth > 3) regime = "RANGING_VOLATILE";
      else                                     regime = "RANGING_QUIET";
    }

    return {
      symbol, type, price,
      rsi:           out.rsi?.value             ?? null,
      macd:          out.macd?.valueMACD        ?? null,
      macdSignal:    out.macd?.valueMACDSignal  ?? null,
      macdHist:      out.macd?.valueMACDHist    ?? null,
      bbUpper, bbMiddle, bbLower, bbWidth,
      ema20:         out.ema20?.value           ?? null,
      ema50:         out.ema50?.value           ?? null,
      ema200:        out.ema200?.value          ?? null,
      atr:           out.atr?.value             ?? null,
      adx:           adxVal,
      supertrendLine: out.supertrend?.value      ?? null,
      supertrendDir:  out.supertrend?.valueAdvice ?? null,
      obv:           out.obv?.value             ?? null,
      regime,
    };
  }

  throw new Error(`Taapi error (${symbol}): failed after ${retries + 1} attempts`);
}

// Fear & Greed Index — free, no API key needed
// 0-24: Extreme Fear | 25-44: Fear | 45-54: Neutral | 55-74: Greed | 75-100: Extreme Greed
async function getFearAndGreed() {
  try {
    const res  = await fetch("https://api.alternative.me/fng/?limit=1");
    if (!res.ok) return { value: 50, classification: "Neutral" };
    const data = await res.json();
    return {
      value:          parseInt(data.data[0].value),
      classification: data.data[0].value_classification,
    };
  } catch {
    return { value: 50, classification: "Neutral" };
  }
}

module.exports = { getIndicators, getFearAndGreed };
