const fetch = (...a) => import("node-fetch").then(({ default: f }) => f(...a));

// Map our symbols to CoinGecko IDs
const COINGECKO_IDS = {
  "BTC/USDT":  "bitcoin",
  "ETH/USDT":  "ethereum",
  "SOL/USDT":  "solana",
  "XRP/USDT":  "ripple",
  "DOGE/USDT": "dogecoin",
  "BTCUSD":    "bitcoin",
  "ETHUSD":    "ethereum",
  "SOLUSD":    "solana",
  "XRPUSD":    "ripple",
  "DOGEUSD":   "dogecoin",
  "TSLA":      "tesla",
  "NVDA":      "nvidia",
  "MSFT":      "microsoft",
};

// Cache historical data for 1 hour — daily candles don't change every 5 minutes
const cache = {};
const CACHE_TTL = 60 * 60 * 1000;

async function getHistoricalContext(symbol) {
  const coinId = COINGECKO_IDS[symbol];
  if (!coinId) return null;

  // Return cached data if fresh
  const now = Date.now();
  if (cache[coinId] && (now - cache[coinId].fetchedAt) < CACHE_TTL) {
    return cache[coinId].data;
  }

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=365&interval=daily`,
      { headers: { "Accept": "application/json" } }
    );
    if (!res.ok) return null;

    const json    = await res.json();
    const prices  = json.prices.map(([, p]) => p);
    const volumes = json.total_volumes.map(([, v]) => v);
    const current = prices[prices.length - 1];

    // 52-week stats
    const high52      = Math.max(...prices);
    const low52       = Math.min(...prices);
    const distFromHigh = +((current - high52) / high52 * 100).toFixed(1);
    const distFromLow  = +((current - low52)  / low52  * 100).toFixed(1);

    // Period returns
    const change30d = +((current - prices[prices.length - 31]) / prices[prices.length - 31] * 100).toFixed(1);
    const change90d = +((current - prices[prices.length - 91]) / prices[prices.length - 91] * 100).toFixed(1);
    const change1y  = +((current - prices[0])                  / prices[0]                  * 100).toFixed(1);

    // Moving averages (daily)
    const sma200 = avg(prices.slice(-200));
    const sma50  = avg(prices.slice(-50));
    const sma20  = avg(prices.slice(-20));

    // Long-term trend
    const ltTrend = current > sma200 ? "BULL" : "BEAR";
    const mtTrend = sma20  > sma50   ? "UPTREND" : "DOWNTREND";

    // Support / resistance from swing lows and highs
    const supports    = findSwingLevels(prices, "low",  3);
    const resistances = findSwingLevels(prices, "high", 3);

    // Is price currently near a key level? (within 3%)
    const nearSupport    = supports.some(s    => Math.abs(current - s)    / current < 0.03);
    const nearResistance = resistances.some(r => Math.abs(current - r)    / current < 0.03);

    // Historical volatility — annualized, based on 30 daily returns
    const returns30 = prices.slice(-31).map((p, i, a) => i === 0 ? null : (p - a[i-1]) / a[i-1]).slice(1);
    const hvol30d   = +(stdDev(returns30) * Math.sqrt(365) * 100).toFixed(1);

    // Volume trend: is recent volume above/below 30-day average?
    const avgVol30  = avg(volumes.slice(-30));
    const avgVol7   = avg(volumes.slice(-7));
    const volTrend  = avgVol7 > avgVol30 * 1.1 ? "RISING" : avgVol7 < avgVol30 * 0.9 ? "FALLING" : "FLAT";

    const data = {
      symbol, coinId, current,
      high52: Math.round(high52),
      low52:  Math.round(low52),
      distFromHigh,
      distFromLow,
      change30d, change90d, change1y,
      sma20:  Math.round(sma20),
      sma50:  Math.round(sma50),
      sma200: Math.round(sma200),
      ltTrend,
      mtTrend,
      supports,
      resistances,
      nearSupport,
      nearResistance,
      hvol30d,
      volTrend,
    };

    cache[coinId] = { data, fetchedAt: now };
    console.log(`[History] ${symbol} loaded — ${ltTrend} | ${change30d}% 30d | ${distFromHigh}% from ATH`);
    return data;

  } catch (e) {
    console.warn(`[History] Failed to fetch ${symbol}:`, e.message);
    return null;
  }
}

function avg(arr) {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stdDev(arr) {
  const mean = avg(arr);
  return Math.sqrt(arr.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / arr.length);
}

// Find the top N distinct swing highs or swing lows over the past year
// Uses a 5-candle lookback window on each side
function findSwingLevels(prices, type, count) {
  const isExtreme = type === "low"
    ? (i) => prices[i] === Math.min(...prices.slice(i - 5, i + 6))
    : (i) => prices[i] === Math.max(...prices.slice(i - 5, i + 6));

  const levels = [];
  for (let i = 5; i < prices.length - 5; i++) {
    if (isExtreme(i)) levels.push({ price: prices[i], index: i });
  }

  // Sort by recency (most recent first), then deduplicate levels within 5% of each other
  levels.sort((a, b) => b.index - a.index);
  const result = [];
  for (const lvl of levels) {
    if (!result.some(r => Math.abs(r - lvl.price) / lvl.price < 0.05)) {
      result.push(Math.round(lvl.price));
      if (result.length >= count) break;
    }
  }
  return result;
}

module.exports = { getHistoricalContext };
