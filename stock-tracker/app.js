const CACHE_TTL_MS = 60 * 60 * 1000;

let currentData = null;

const QUICK_PICKS = {
  stock:  ["AAPL", "TSLA", "NVDA", "MSFT", "AMZN", "META", "GOOGL", "AMD"],
  crypto: ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX"],
  etf:    ["SPY", "QQQ", "VTI", "IWM", "GLD", "ARKK", "SOXX", "DIA"],
};

// CoinGecko IDs for popular coins
const COINGECKO_IDS = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", BNB: "binancecoin",
  XRP: "ripple", DOGE: "dogecoin", ADA: "cardano", AVAX: "avalanche-2",
  DOT: "polkadot", MATIC: "matic-network", LINK: "chainlink", LTC: "litecoin",
  UNI: "uniswap", ATOM: "cosmos", TRX: "tron", NEAR: "near", APT: "aptos",
  ARB: "arbitrum", OP: "optimism", SHIB: "shiba-inu",
};

function renderQuickPicks() {
  const type = document.getElementById("asset-type").value;
  const container = document.getElementById("qp-buttons");
  container.innerHTML = "";
  QUICK_PICKS[type].forEach(t => {
    const btn = document.createElement("button");
    btn.className = "qp-btn";
    btn.textContent = t;
    btn.addEventListener("click", () => {
      document.getElementById("ticker-input").value = t;
      analyze();
    });
    container.appendChild(btn);
  });
}

// --- Crypto via CoinGecko (free, no key) ---
async function getCoinGeckoId(symbol) {
  if (COINGECKO_IDS[symbol]) return COINGECKO_IDS[symbol];

  // Search for unknown coins
  const res = await fetch(`https://api.coingecko.com/api/v3/search?query=${symbol}`);
  const json = await res.json();
  const match = json.coins?.find(c => c.symbol.toUpperCase() === symbol);
  if (!match) throw new Error(`Crypto "${symbol}" not found on CoinGecko.`);
  return match.id;
}

async function fetchCryptoData(symbol, days) {
  const cacheKey = `crypto_${symbol}_${days}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_TTL_MS) return data;
  }

  const id = await getCoinGeckoId(symbol);
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}&interval=daily`
  );

  if (!res.ok) throw new Error("CoinGecko request failed. Try again shortly.");
  const json = await res.json();
  if (!json.prices?.length) throw new Error("No price data returned for " + symbol);

  const data = { prices: json.prices, id };
  localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
  return data;
}

function parseCryptoData(data) {
  const entries = data.prices;
  const labels  = entries.map(([ts]) => new Date(ts).toISOString().slice(0, 10));
  const prices  = entries.map(([, p]) => p);
  const high52  = Math.max(...prices);
  const low52   = Math.min(...prices);
  return { labels, prices, high52, low52 };
}

// --- Stocks/ETFs via Alpha Vantage ---
async function fetchStockData(ticker) {
  const cacheKey = `stock_${ticker}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_TTL_MS) return data;
  }

  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${ticker}&apikey=${CONFIG.ALPHA_VANTAGE_KEY}`;
  const res  = await fetch(url);
  const json = await res.json();

  if (json["Error Message"]) throw new Error("Invalid ticker symbol.");
  if (json["Note"])          throw new Error("API rate limit reached. Try again in a minute.");
  if (json["Information"])   throw new Error("Alpha Vantage: " + json["Information"]);
  if (!json["Time Series (Daily)"]) throw new Error("Unexpected response: " + JSON.stringify(json).slice(0, 200));

  localStorage.setItem(cacheKey, JSON.stringify({ data: json, timestamp: Date.now() }));
  return json;
}

function parseStockData(json, days) {
  const series  = json["Time Series (Daily)"];
  const entries = Object.entries(series)
    .sort(([a], [b]) => new Date(a) - new Date(b))
    .slice(-days);

  const labels    = entries.map(([date]) => date);
  const prices    = entries.map(([, v]) => parseFloat(v["4. close"]));
  const allPrices = Object.values(series).map(v => parseFloat(v["4. close"]));
  const high52    = Math.max(...allPrices.slice(0, 252));
  const low52     = Math.min(...allPrices.slice(0, 252));

  return { labels, prices, high52, low52 };
}

function showError(msg) {
  const el = document.getElementById("error-msg");
  el.textContent = msg;
  el.classList.remove("hidden");
  document.getElementById("main-content").classList.add("hidden");
}

function clearError() {
  document.getElementById("error-msg").classList.add("hidden");
}

async function analyze() {
  const ticker = document.getElementById("ticker-input").value.trim().toUpperCase();
  const days   = parseInt(document.getElementById("range-select").value);
  const type   = document.getElementById("asset-type").value;

  if (!ticker) return showError("Please enter a ticker symbol.");
  clearError();

  const btn = document.getElementById("analyze-btn");
  btn.textContent = "Loading...";
  btn.disabled = true;

  try {
    let labels, prices, high52, low52;

    if (type === "crypto") {
      const data = await fetchCryptoData(ticker, days);
      ({ labels, prices, high52, low52 } = parseCryptoData(data));
    } else {
      const json = await fetchStockData(ticker);
      ({ labels, prices, high52, low52 } = parseStockData(json, days));
    }

    const sma20 = calcSMA(prices, 20);
    const sma50 = calcSMA(prices, 50);
    const rsi   = calcRSI(prices);
    const sma20Line = calcSMALine(prices, 20);
    const sma50Line = calcSMALine(prices, 50);

    const currentPrice   = prices[prices.length - 1];
    const firstPrice     = prices[0];
    const priceChangePct = ((currentPrice - firstPrice) / firstPrice) * 100;
    const priceChangeAbs = currentPrice - firstPrice;

    const assetLabel = type === "crypto" ? "Crypto" : type === "etf" ? "ETF" : "Stock";
    currentData = { ticker, type: assetLabel, currentPrice, sma20, sma50, rsi, priceChangePct, high52, low52 };

    document.getElementById("stock-name").textContent = ticker;
    document.getElementById("stock-ticker-label").textContent = `${assetLabel} · ${days}-day view`;
    document.getElementById("current-price").textContent = `$${currentPrice.toFixed(2)}`;

    const changeEl = document.getElementById("price-change");
    changeEl.textContent = `${priceChangeAbs >= 0 ? "+" : ""}$${priceChangeAbs.toFixed(2)} (${priceChangePct >= 0 ? "+" : ""}${priceChangePct.toFixed(2)}%)`;
    changeEl.className = `change ${priceChangePct >= 0 ? "positive" : "negative"}`;

    document.getElementById("sma20").textContent = sma20 ? `$${sma20.toFixed(2)}` : "N/A";
    document.getElementById("sma50").textContent = sma50 ? `$${sma50.toFixed(2)}` : "N/A";

    const rsiEl = document.getElementById("rsi");
    rsiEl.textContent = rsi ? rsi.toFixed(1) : "N/A";
    rsiEl.className = `value ${rsi > 70 ? "overbought" : rsi < 30 ? "oversold" : ""}`;

    document.getElementById("high52").textContent = `$${high52.toFixed(2)}`;
    document.getElementById("low52").textContent  = `$${low52.toFixed(2)}`;

    renderChart(labels, prices, sma20Line, sma50Line);

    document.getElementById("main-content").classList.remove("hidden");
    document.getElementById("agents-results").classList.add("hidden");
    document.getElementById("agents-loading").classList.add("hidden");
  } catch (err) {
    showError(err.message);
  } finally {
    btn.textContent = "Analyze";
    btn.disabled = false;
  }
}

function setStatus(id, icon, text) {
  document.getElementById(id).innerHTML = `${icon} ${text}`;
}

async function runAgents() {
  if (!currentData) return;

  const btn     = document.getElementById("run-agents-btn");
  const loading = document.getElementById("agents-loading");
  const results = document.getElementById("agents-results");

  btn.disabled = true;
  loading.classList.remove("hidden");
  results.classList.add("hidden");

  ["bull-result", "bear-result", "risk-result", "summary-result"].forEach(id => {
    document.getElementById(id).textContent = "";
  });

  setStatus("status-bull",    "🟡", "Bull Agent — thinking...");
  setStatus("status-bear",    "🟡", "Bear Agent — thinking...");
  setStatus("status-risk",    "🟡", "Risk Agent — thinking...");
  setStatus("status-summary", "⏳", "Summary Agent — waiting...");

  try {
    const [bullText, bearText, riskText] = await Promise.all([
      runBullAgent(currentData).then(t => { setStatus("status-bull", "✅", "Bull Agent — done"); return t; })
        .catch(e => { setStatus("status-bull", "❌", "Bull Agent — failed"); return "Failed: " + e.message; }),
      runBearAgent(currentData).then(t => { setStatus("status-bear", "✅", "Bear Agent — done"); return t; })
        .catch(e => { setStatus("status-bear", "❌", "Bear Agent — failed"); return "Failed: " + e.message; }),
      runRiskAgent(currentData).then(t => { setStatus("status-risk", "✅", "Risk Agent — done"); return t; })
        .catch(e => { setStatus("status-risk", "❌", "Risk Agent — failed"); return "Failed: " + e.message; }),
    ]);

    document.getElementById("bull-result").textContent = bullText;
    document.getElementById("bear-result").textContent = bearText;
    document.getElementById("risk-result").textContent = riskText;

    setStatus("status-summary", "🟡", "Summary Agent — synthesizing...");
    const summaryText = await runSummaryAgent(currentData, bullText, bearText, riskText);
    setStatus("status-summary", "✅", "Summary Agent — done");
    document.getElementById("summary-result").textContent = summaryText;

    results.classList.remove("hidden");
  } catch (err) {
    setStatus("status-summary", "❌", "Summary Agent — failed: " + err.message);
  } finally {
    loading.classList.add("hidden");
    btn.disabled = false;
  }
}

document.getElementById("asset-type").addEventListener("change", renderQuickPicks);
document.getElementById("analyze-btn").addEventListener("click", analyze);
document.getElementById("run-agents-btn").addEventListener("click", runAgents);
document.getElementById("ticker-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") analyze();
});

renderQuickPicks();
