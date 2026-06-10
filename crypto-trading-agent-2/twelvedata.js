const fetch = (...a) => import("node-fetch").then(({ default: f }) => f(...a));
const { TWELVEDATA_KEY } = require("./config");

// Cache per symbol — 4H candles only change every 4 hours
const cache = {};
const CACHE_TTL = 4 * 60 * 60 * 1000;

// ── Indicator math ────────────────────────────────────────────────────────────

function sma(arr, period) {
  if (arr.length < period) return null;
  return arr.slice(-period).reduce((s, v) => s + v, 0) / period;
}

function ema(arr, period) {
  if (arr.length < period) return null;
  const k = 2 / (period + 1);
  let val = arr.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < arr.length; i++) val = arr[i] * k + val * (1 - k);
  return val;
}

// Returns full EMA array (needed for MACD signal calculation)
function emaArray(arr, period) {
  if (arr.length < period) return [];
  const k = 2 / (period + 1);
  const out = [arr.slice(0, period).reduce((s, v) => s + v, 0) / period];
  for (let i = period; i < arr.length; i++) {
    out.push(arr[i] * k + out[out.length - 1] * (1 - k));
  }
  return out;
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  let ag = gains / period, al = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    ag = (ag * (period - 1) + Math.max(d, 0)) / period;
    al = (al * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (al === 0) return 100;
  return 100 - 100 / (1 + ag / al);
}

function calcMACD(closes, fast = 12, slow = 26, signal = 9) {
  const fastArr = emaArray(closes, fast);
  const slowArr = emaArray(closes, slow);
  if (!fastArr.length || !slowArr.length) return { macd: null, signal: null, hist: null };

  // Align arrays (slow is shorter)
  const offset = fastArr.length - slowArr.length;
  const macdArr = slowArr.map((_, i) => fastArr[i + offset] - slowArr[i]);

  const sigArr = emaArray(macdArr, signal);
  const macdVal = macdArr[macdArr.length - 1];
  const sigVal  = sigArr[sigArr.length - 1];
  return { macd: macdVal, signal: sigVal, hist: macdVal - sigVal };
}

function calcBB(closes, period = 20, mult = 2) {
  if (closes.length < period) return { upper: null, middle: null, lower: null };
  const slice = closes.slice(-period);
  const mid   = slice.reduce((s, v) => s + v, 0) / period;
  const std   = Math.sqrt(slice.reduce((s, v) => s + Math.pow(v - mid, 2), 0) / period);
  return { upper: mid + mult * std, middle: mid, lower: mid - mult * std };
}

function calcATR(highs, lows, closes, period = 14) {
  if (closes.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < closes.length; i++) {
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  let atr = trs.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < trs.length; i++) atr = (atr * (period - 1) + trs[i]) / period;
  return atr;
}

function calcADX(highs, lows, closes, period = 14) {
  if (closes.length < period * 2) return null;
  const trs = [], pdms = [], mdms = [];
  for (let i = 1; i < closes.length; i++) {
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
    const up = highs[i] - highs[i - 1], down = lows[i - 1] - lows[i];
    pdms.push(up > down && up > 0 ? up : 0);
    mdms.push(down > up && down > 0 ? down : 0);
  }
  // Wilder smoothing
  let satr = trs.slice(0, period).reduce((s, v) => s + v, 0);
  let spdm = pdms.slice(0, period).reduce((s, v) => s + v, 0);
  let smdm = mdms.slice(0, period).reduce((s, v) => s + v, 0);
  const dxArr = [];
  for (let i = period; i < trs.length; i++) {
    satr = satr - satr / period + trs[i];
    spdm = spdm - spdm / period + pdms[i];
    smdm = smdm - smdm / period + mdms[i];
    const pdi = satr ? 100 * spdm / satr : 0;
    const mdi = satr ? 100 * smdm / satr : 0;
    const sum = pdi + mdi;
    dxArr.push(sum ? 100 * Math.abs(pdi - mdi) / sum : 0);
  }
  if (dxArr.length < period) return null;
  let adx = dxArr.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < dxArr.length; i++) adx = (adx * (period - 1) + dxArr[i]) / period;
  return adx;
}

// ── Main fetch ────────────────────────────────────────────────────────────────

async function getStockIndicators(symbol) {
  const now = Date.now();
  if (cache[symbol] && (now - cache[symbol].fetchedAt) < CACHE_TTL) {
    console.log(`[TwelveData] ${symbol} — from cache`);
    return cache[symbol].data;
  }

  console.log(`[TwelveData] Fetching ${symbol} OHLCV...`);
  try {
    // ONE API call — 200 candles of 4H OHLCV data, calculate everything ourselves
    const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=4h&outputsize=200&apikey=${TWELVEDATA_KEY}`;
    const res  = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.status === "error") throw new Error(json.message);

    // Twelve Data returns newest first — reverse to oldest first
    const candles = json.values.reverse();
    const closes  = candles.map(c => parseFloat(c.close));
    const highs   = candles.map(c => parseFloat(c.high));
    const lows    = candles.map(c => parseFloat(c.low));

    const price    = closes[closes.length - 1];
    const rsi      = calcRSI(closes);
    const macdData = calcMACD(closes);
    const bb       = calcBB(closes);
    const ema20    = ema(closes, 20);
    const ema50    = ema(closes, 50);
    const ema200   = ema(closes, 200);
    const atr      = calcATR(highs, lows, closes);
    const adx      = calcADX(highs, lows, closes);

    const bbWidth = (bb.upper && bb.lower && bb.middle)
      ? ((bb.upper - bb.lower) / bb.middle * 100) : null;

    let regime = "UNKNOWN";
    if (adx !== null) {
      if      (adx > 30)                      regime = "STRONG_TREND";
      else if (adx > 20)                      regime = "WEAK_TREND";
      else if (bbWidth != null && bbWidth > 3) regime = "RANGING_VOLATILE";
      else                                     regime = "RANGING_QUIET";
    }

    const data = {
      symbol, type: "stock", price,
      rsi,
      macd: macdData.macd, macdSignal: macdData.signal, macdHist: macdData.hist,
      bbUpper: bb.upper, bbMiddle: bb.middle, bbLower: bb.lower, bbWidth,
      ema20, ema50, ema200, atr, adx,
      supertrendDir: null,
      obv: null,
      regime,
    };

    cache[symbol] = { data, fetchedAt: now };
    console.log(`[TwelveData] ${symbol} OK — $${price?.toFixed(2)} | RSI ${rsi?.toFixed(1)} | ADX ${adx?.toFixed(1)} | ${regime}`);
    return data;

  } catch (e) {
    console.error(`[TwelveData] ${symbol} error:`, e.message);
    return null;
  }
}

module.exports = { getStockIndicators };
