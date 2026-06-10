const fetch = (...a) => import("node-fetch").then(({ default: f }) => f(...a));
const { ALPACA_KEY, ALPACA_SECRET, PAPER_BASE_URL, DATA_BASE_URL } = require("./config");

const headers = () => ({
  "APCA-API-KEY-ID":     ALPACA_KEY,
  "APCA-API-SECRET-KEY": ALPACA_SECRET,
  "Content-Type":        "application/json",
});

async function alpacaGet(path, base = PAPER_BASE_URL) {
  const res = await fetch(`${base}${path}`, { headers: headers() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  return data;
}

async function alpacaPost(path, body) {
  const res = await fetch(`${PAPER_BASE_URL}${path}`, {
    method: "POST", headers: headers(), body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  return data;
}

async function alpacaDelete(path) {
  const res = await fetch(`${PAPER_BASE_URL}${path}`, {
    method: "DELETE", headers: headers(),
  });
  if (res.status === 204) return {};
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  return data;
}

// Market hours check
async function isMarketOpen() {
  const data = await alpacaGet("/v2/clock");
  return data.is_open;
}

// Account
const getAccount    = ()          => alpacaGet("/v2/account");
const getPositions  = ()          => alpacaGet("/v2/positions");
const getOrders     = ()          => alpacaGet("/v2/orders?status=all&limit=50");
const getOpenOrders = ()          => alpacaGet("/v2/orders?status=open&limit=50");
const closePosition = (symbol)    => alpacaDelete(`/v2/positions/${symbol}`);
const cancelOrder   = (orderId)   => alpacaDelete(`/v2/orders/${orderId}`);
const cancelAllOrders = ()        => alpacaDelete("/v2/orders");

// Place market order
function placeOrder(symbol, qty, side) {
  return alpacaPost("/v2/orders", {
    symbol, qty: String(qty), side,
    type: "market", time_in_force: "gtc",
  });
}

// Notional order — buy/sell by dollar amount
// Stocks require time_in_force "day" for notional orders; crypto uses "gtc"
function placeNotionalOrder(symbol, dollars, side) {
  const isCrypto = symbol.endsWith("USD") && !["MSFT", "TSLA", "NVDA", "AAPL"].includes(symbol);
  return alpacaPost("/v2/orders", {
    symbol, notional: dollars.toFixed(2), side,
    type: "market", time_in_force: isCrypto ? "gtc" : "day",
  });
}

// Latest bar price
async function getLatestPrice(symbol) {
  const data = await alpacaGet(`/v2/stocks/${symbol}/bars/latest`, DATA_BASE_URL);
  return data.bar?.c ?? null;
}

// Historical bars for signal calculation
async function getBars(symbol, days = 60) {
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const data  = await alpacaGet(
    `/v2/stocks/${symbol}/bars?timeframe=1Day&start=${start}&limit=${days}`,
    DATA_BASE_URL
  );
  return data.bars ?? [];
}

// Portfolio history (equity curve)
async function getPortfolioHistory() {
  return alpacaGet("/v2/account/portfolio/history?period=1A&timeframe=1D");
}

module.exports = { getAccount, getPositions, getOrders, getOpenOrders, getLatestPrice, getBars, placeOrder, placeNotionalOrder, closePosition, cancelOrder, cancelAllOrders, getPortfolioHistory, isMarketOpen };
