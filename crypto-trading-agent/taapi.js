const fetch = (...a) => import("node-fetch").then(({ default: f }) => f(...a));
const { TAAPI_SECRET } = require("./config");

async function getIndicators(symbol, type = "crypto") {
  const isCrypto = type === "crypto";
  const exchange = isCrypto ? "binance" : "stocks";
  const interval = isCrypto ? "1h" : "1h";

  const res = await fetch("https://api.taapi.io/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: TAAPI_SECRET,
      construct: {
        exchange,
        symbol,
        interval,
        indicators: [
          { id: "rsi",    indicator: "rsi" },
          { id: "macd",   indicator: "macd" },
          { id: "bbands", indicator: "bbands" },
          { id: "ema20",  indicator: "ema", optInTimePeriod: 20 },
          { id: "ema50",  indicator: "ema", optInTimePeriod: 50 },
          { id: "atr",    indicator: "atr" },
          { id: "candle", indicator: "candle" },
        ],
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Taapi error (${symbol}): ${err}`);
  }

  const data = await res.json();
  const out  = {};
  for (const item of data.data) {
    out[item.id] = item.result;
  }

  return {
    symbol, type,
    price:      out.candle?.close          ?? null,
    rsi:        out.rsi?.value             ?? null,
    macd:       out.macd?.valueMACD        ?? null,
    macdSignal: out.macd?.valueMACDSignal  ?? null,
    macdHist:   out.macd?.valueMACDHist    ?? null,
    bbUpper:    out.bbands?.valueUpperBand  ?? null,
    bbMiddle:   out.bbands?.valueMiddleBand ?? null,
    bbLower:    out.bbands?.valueLowerBand  ?? null,
    ema20:      out.ema20?.value           ?? null,
    ema50:      out.ema50?.value           ?? null,
    atr:        out.atr?.value             ?? null,
  };
}

module.exports = { getIndicators };
