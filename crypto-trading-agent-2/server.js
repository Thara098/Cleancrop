const express   = require("express");
const path      = require("path");
const alpaca    = require("./alpaca");
const scheduler = require("./scheduler");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Dashboard data
app.get("/api/dashboard", async (req, res) => {
  try {
    const [account, positions, orders] = await Promise.all([
      alpaca.getAccount(),
      alpaca.getPositions(),
      alpaca.getOrders(),
    ]);
    res.json({ account, positions, orders: orders.slice(0, 30) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Portfolio equity curve
app.get("/api/portfolio-history", async (req, res) => {
  try {
    const history = await alpaca.getPortfolioHistory();
    res.json(history);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Trade log from scheduler
app.get("/api/trade-log", (req, res) => {
  res.json(scheduler.getTradeLog());
});

// Scheduler controls
app.get("/api/scheduler/status", (req, res) => {
  res.json(scheduler.getStatus());
});

app.post("/api/scheduler/start", (req, res) => {
  scheduler.start();
  res.json({ ok: true, status: scheduler.getStatus() });
});

app.post("/api/scheduler/stop", (req, res) => {
  scheduler.stop();
  res.json({ ok: true, status: scheduler.getStatus() });
});

app.post("/api/scheduler/run-now", async (req, res) => {
  scheduler.runCycle();
  res.json({ ok: true, message: "Cycle triggered" });
});

// Manual order
app.post("/api/order", async (req, res) => {
  const { symbol, qty, side } = req.body;
  try {
    const order = await alpaca.placeOrder(symbol, qty, side);
    res.json(order);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`\n🤖 AI Trading Agent running at http://localhost:${PORT}`);
  console.log("   Waiting for API keys before starting scheduler...\n");
});
