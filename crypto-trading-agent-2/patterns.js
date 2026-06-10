// patterns.js — multi-candle pattern detection for Agent 2
// Uses CoinGecko 4H data to detect RSI divergence, MACD momentum, BB state
const fetch = (...a) => import("node-fetch").then(({ default: f }) => f(...a));

const COINGECKO_IDS = {
  "BTC/USDT":  "bitcoin",
  "ETH/USDT":  "ethereum",
  "SOL/USDT":  "solana",
  "XRP/USDT":  "ripple",
  "DOGE/USDT": "dogecoin",
  "AVAX/USDT": "avalanche-2",
};

const cache = {};
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

// ── Math helpers ─────────────────────────────────────────────────────────────

function ema(prices, period) {
  const k = 2 / (period + 1);
  let val = prices[0];
  const arr = [val];
  for (let i = 1; i < prices.length; i++) {
    val = prices[i] * k + val * (1 - k);
    arr.push(val);
  }
  return arr;
}

// Wilder's smoothing RSI — returns array of RSI values (same length as closes minus warmup)
function calcRSIArray(closes, period = 14) {
  if (closes.length < period + 2) return [];
  const gains = [], losses = [];
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gains.push(Math.max(d, 0));
    losses.push(Math.max(-d, 0));
  }
  let avgG = gains.slice(0, period).reduce((s, v) => s + v, 0) / period;
  let avgL = losses.slice(0, period).reduce((s, v) => s + v, 0) / period;
  const out = [];
  for (let i = period; i < gains.length; i++) {
    avgG = (avgG * (period - 1) + gains[i]) / period;
    avgL = (avgL * (period - 1) + losses[i]) / period;
    const rs = avgL === 0 ? 100 : avgG / avgL;
    out.push(100 - 100 / (1 + rs));
  }
  return out;
}

// MACD histogram array
function calcMACDHistArray(closes) {
  if (closes.length < 36) return [];
  const e12 = ema(closes, 12);
  const e26 = ema(closes, 26);
  // Use offset 25 so ema26 is reasonably warmed up
  const macdLine = e12.map((v, i) => v - e26[i]).slice(25);
  const signal   = ema(macdLine, 9);
  return macdLine.map((v, i) => v - signal[i]);
}

// Bollinger width (normalized by midline) — array
function calcBBWidths(closes, period = 20) {
  const out = [];
  for (let i = period - 1; i < closes.length; i++) {
    const sl   = closes.slice(i - period + 1, i + 1);
    const mean = sl.reduce((s, v) => s + v, 0) / period;
    const std  = Math.sqrt(sl.reduce((s, v) => s + (v - mean) ** 2, 0) / period);
    out.push(mean > 0 ? (std * 2) / mean : 0);
  }
  return out;
}

// ── Pattern detectors ─────────────────────────────────────────────────────────

function detectBullishDivergence(prices, rsiArr) {
  if (prices.length < 14 || rsiArr.length < 14) return false;
  const p = prices.slice(-16);
  const r = rsiArr.slice(-16);
  const lows = [];
  for (let i = 2; i < p.length - 2; i++) {
    if (p[i] <= p[i-1] && p[i] <= p[i-2] && p[i] <= p[i+1] && p[i] <= p[i+2]) {
      lows.push({ price: p[i], rsi: r[i] });
    }
  }
  if (lows.length < 2) return false;
  const [a, b] = lows.slice(-2);
  // Price lower low but RSI higher low = bullish divergence
  return b.price < a.price * 0.998 && b.rsi > a.rsi + 1;
}

function detectBearishDivergence(prices, rsiArr) {
  if (prices.length < 14 || rsiArr.length < 14) return false;
  const p = prices.slice(-16);
  const r = rsiArr.slice(-16);
  const highs = [];
  for (let i = 2; i < p.length - 2; i++) {
    if (p[i] >= p[i-1] && p[i] >= p[i-2] && p[i] >= p[i+1] && p[i] >= p[i+2]) {
      highs.push({ price: p[i], rsi: r[i] });
    }
  }
  if (highs.length < 2) return false;
  const [a, b] = highs.slice(-2);
  // Price higher high but RSI lower high = bearish divergence
  return b.price > a.price * 1.002 && b.rsi < a.rsi - 1;
}

// Is MACD histogram accelerating up, down, or mixed?
function detectMACDMomentum(histArr) {
  if (histArr.length < 4) return "UNKNOWN";
  const [h1, h2, h3, h4] = histArr.slice(-4);
  if (h4 > h3 && h3 > h2 && h2 > h1) return "ACCELERATING_UP";
  if (h4 < h3 && h3 < h2 && h2 < h1) return "ACCELERATING_DOWN";
  if (h4 > h3 && h4 > 0)  return "BULLISH_SLOWING";
  if (h4 < h3 && h4 < 0)  return "BEARISH_SLOWING";
  if (h4 > h3 && h4 <= 0) return "RECOVERING";
  if (h4 < h3 && h4 >= 0) return "FADING";
  return "MIXED";
}

// Is BB squeezing (breakout imminent) or expanding (trend moving)?
function detectBBState(widths) {
  if (widths.length < 10) return "UNKNOWN";
  const recent = widths.slice(-10);
  const avg    = recent.reduce((s, v) => s + v, 0) / recent.length;
  const curr   = widths[widths.length - 1];
  if (curr < avg * 0.65) return "SQUEEZE";    // tight → breakout imminent
  if (curr > avg * 1.40) return "EXPANSION";  // wide → trend in motion
  return "NORMAL";
}

// 5-period rate of change as a %
function calcROC(prices, n = 5) {
  if (prices.length < n + 1) return 0;
  const curr = prices[prices.length - 1];
  const past = prices[prices.length - 1 - n];
  return past > 0 ? +((curr - past) / past * 100).toFixed(2) : 0;
}

// ── Main export ───────────────────────────────────────────────────────────────

async function getPatterns(symbol) {
  const coinId = COINGECKO_IDS[symbol];
  if (!coinId) return null; // stocks not supported here

  const now = Date.now();
  if (cache[symbol] && (now - cache[symbol].fetchedAt) < CACHE_TTL) {
    return cache[symbol].data;
  }

  try {
    // 12 days of hourly → ~72 4H candles — enough for divergence + MACD
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=12`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;

    const json    = await res.json();
    const hourly  = json.prices.map(([, p]) => p);

    // Downsample to 4H: take every 4th close price
    const prices4h = [];
    for (let i = 3; i < hourly.length; i += 4) prices4h.push(hourly[i]);

    const rsiArr  = calcRSIArray(prices4h, 14);
    const histArr = calcMACDHistArray(prices4h);
    const bbW     = calcBBWidths(prices4h, 20);

    const patterns = {
      rsiBullishDiv: detectBullishDivergence(prices4h, rsiArr),
      rsiBearishDiv: detectBearishDivergence(prices4h, rsiArr),
      macdMomentum:  detectMACDMomentum(histArr),
      bbState:       detectBBState(bbW),
      priceROC5:     calcROC(prices4h, 5),   // 5-candle momentum (~20H)
      priceROC12:    calcROC(prices4h, 12),  // 12-candle momentum (~48H)
      candleCount:   prices4h.length,
    };

    cache[symbol] = { data: patterns, fetchedAt: now };
    const divStr = patterns.rsiBullishDiv ? "BULL_DIV" : patterns.rsiBearishDiv ? "BEAR_DIV" : "none";
    console.log(`[Patterns] ${symbol}: div=${divStr} | macd=${patterns.macdMomentum} | bb=${patterns.bbState} | ROC5=${patterns.priceROC5}%`);
    return patterns;

  } catch (e) {
    console.warn(`[Patterns] ${symbol}:`, e.message);
    return null;
  }
}

module.exports = { getPatterns };
