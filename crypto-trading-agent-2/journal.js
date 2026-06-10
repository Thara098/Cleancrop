// journal.js — trade journal + adaptive ML learning for Agent 2
// Records every trade entry/exit, learns which signal combinations win most often,
// and returns a ML bonus/penalty to adjust position sizing and scoring thresholds.
const fs   = require("fs");
const path = require("path");

const JOURNAL_FILE = path.join(__dirname, "journal.json");

function load() {
  try {
    if (fs.existsSync(JOURNAL_FILE)) {
      return JSON.parse(fs.readFileSync(JOURNAL_FILE, "utf8"));
    }
  } catch {}
  return { trades: [], stats: {}, signalAccuracy: {} };
}

function save(j) {
  try { fs.writeFileSync(JOURNAL_FILE, JSON.stringify(j, null, 2)); }
  catch (e) { console.warn("[Journal] Save failed:", e.message); }
}

// ── Entry recording ───────────────────────────────────────────────────────────

function recordEntry({ symbol, alpacaSymbol, action, dollars, indicators, patterns }) {
  const j = load();
  const id = `${alpacaSymbol}_${Date.now()}`;
  j.trades.push({
    id,
    symbol,
    alpacaSymbol,
    action,
    dollars,
    entryTime: new Date().toISOString(),
    // Snapshot of key indicators at entry — used to build signal accuracy map
    snap: {
      rsi:          indicators.rsi    != null ? +indicators.rsi.toFixed(2)    : null,
      macdHist:     indicators.macdHist != null ? +indicators.macdHist.toFixed(4) : null,
      adx:          indicators.adx    != null ? +indicators.adx.toFixed(2)    : null,
      bbWidth:      indicators.bbWidth != null ? +indicators.bbWidth.toFixed(4) : null,
      regime:       indicators.regime,
      rsiBullDiv:   patterns?.rsiBullishDiv ?? false,
      rsiBearDiv:   patterns?.rsiBearishDiv ?? false,
      macdMomentum: patterns?.macdMomentum ?? null,
      bbState:      patterns?.bbState      ?? null,
      priceROC5:    patterns?.priceROC5    ?? null,
    },
    exitTime:  null,
    exitPrice: null,
    pnlPct:    null,
    outcome:   null,
  });
  if (j.trades.length > 500) j.trades = j.trades.slice(-500);
  save(j);
  console.log(`[Journal] Entry recorded: ${action} ${symbol} $${dollars?.toFixed(0)} | id=${id}`);
  return id;
}

// ── Exit recording + learning ─────────────────────────────────────────────────

function recordExit({ alpacaSymbol, exitPrice, pnlPct }) {
  const j = load();
  // Find the most recent open trade for this symbol
  const trade = [...j.trades].reverse().find(t => t.alpacaSymbol === alpacaSymbol && t.outcome === null);
  if (!trade) return;

  trade.exitTime  = new Date().toISOString();
  trade.exitPrice = exitPrice;
  trade.pnlPct    = pnlPct;
  trade.outcome   = pnlPct >= 0 ? "WIN" : "LOSS";

  // Per-symbol win/loss stats
  if (!j.stats[alpacaSymbol]) j.stats[alpacaSymbol] = { wins: 0, losses: 0, totalPnl: 0, trades: 0 };
  j.stats[alpacaSymbol].trades++;
  j.stats[alpacaSymbol].totalPnl = +(j.stats[alpacaSymbol].totalPnl + pnlPct).toFixed(4);
  if (trade.outcome === "WIN") j.stats[alpacaSymbol].wins++;
  else                         j.stats[alpacaSymbol].losses++;

  // Signal accuracy: which signals were present when this trade was entered?
  _updateSignalAccuracy(j, trade);

  save(j);
  const s = j.stats[alpacaSymbol];
  const wr = s.trades >= 3 ? `${(s.wins/s.trades*100).toFixed(0)}% WR` : "building history...";
  console.log(`[Journal] ${alpacaSymbol} ${trade.outcome} | PnL ${pnlPct?.toFixed(2)}% | ${wr}`);
}

function _updateSignalAccuracy(j, trade) {
  if (!j.signalAccuracy) j.signalAccuracy = {};
  const s = trade.snap;
  const win = trade.outcome === "WIN";

  const signals = [];
  if (s.rsi != null && s.rsi < 40)          signals.push("rsi_oversold");
  if (s.rsi != null && s.rsi > 60)          signals.push("rsi_overbought");
  if (s.macdHist != null && s.macdHist > 0) signals.push("macd_hist_bull");
  if (s.macdHist != null && s.macdHist < 0) signals.push("macd_hist_bear");
  if (s.rsiBullDiv)                          signals.push("rsi_bull_divergence");
  if (s.rsiBearDiv)                          signals.push("rsi_bear_divergence");
  if (s.macdMomentum === "ACCELERATING_UP")   signals.push("macd_accel_up");
  if (s.macdMomentum === "ACCELERATING_DOWN") signals.push("macd_accel_down");
  if (s.macdMomentum === "RECOVERING")        signals.push("macd_recovering");
  if (s.bbState === "SQUEEZE")               signals.push("bb_squeeze");
  if (s.bbState === "EXPANSION")             signals.push("bb_expansion");
  if (s.regime === "STRONG_TREND")           signals.push("regime_strong");
  if (s.adx != null && s.adx > 30)           signals.push("adx_strong");

  for (const sig of signals) {
    if (!j.signalAccuracy[sig]) j.signalAccuracy[sig] = { wins: 0, losses: 0 };
    if (win) j.signalAccuracy[sig].wins++;
    else     j.signalAccuracy[sig].losses++;
  }
}

// ── ML scoring ────────────────────────────────────────────────────────────────

// Returns +1 (historically reliable setup), 0 (neutral/not enough data), or -1 (historically poor)
// Minimum 5 recorded outcomes before influencing anything
function getMLBonus(indicators, patterns) {
  const j = load();
  const sa = j.signalAccuracy || {};
  let score = 0;
  const MIN_SAMPLES = 5;

  function check(key, bullish) {
    const rec = sa[key];
    if (!rec) return;
    const total = rec.wins + rec.losses;
    if (total < MIN_SAMPLES) return;
    const wr = rec.wins / total;
    if (bullish) {
      if (wr >= 0.65) score++;
      else if (wr <= 0.35) score--;
    } else {
      // For bearish signals, high win rate on BEAR signal = bad for BULL
      if (wr >= 0.65) score--;
      else if (wr <= 0.35) score++;
    }
  }

  check("rsi_oversold",        true);
  check("macd_hist_bull",      true);
  check("macd_hist_bear",      false);
  check("rsi_bull_divergence", true);
  check("rsi_bear_divergence", false);
  check("macd_accel_up",       true);
  check("macd_accel_down",     false);
  check("macd_recovering",     true);
  check("bb_squeeze",          true); // squeeze = neutral (can break either way)
  check("regime_strong",       true);
  check("adx_strong",          true);

  return Math.max(-2, Math.min(2, score)); // clamp to -2..+2
}

// ── Stats accessors ───────────────────────────────────────────────────────────

function getWinRate(alpacaSymbol) {
  const j = load();
  const s = j.stats?.[alpacaSymbol];
  if (!s || s.trades < 3) return null;
  return {
    symbol:   alpacaSymbol,
    trades:   s.trades,
    winRate:  +((s.wins / s.trades) * 100).toFixed(1),
    wins:     s.wins,
    losses:   s.losses,
    totalPnl: +s.totalPnl.toFixed(2),
  };
}

function getSignalStats() {
  const j = load();
  const sa = j.signalAccuracy || {};
  return Object.fromEntries(
    Object.entries(sa).map(([k, v]) => {
      const total = v.wins + v.losses;
      return [k, { ...v, total, winRate: total > 0 ? +((v.wins/total)*100).toFixed(1) : 0 }];
    })
  );
}

function getAllStats() {
  const j = load();
  const completedTrades = j.trades.filter(t => t.outcome !== null).length;
  return {
    totalRecorded:  completedTrades,
    symbolStats:    j.stats,
    signalAccuracy: getSignalStats(),
  };
}

module.exports = { recordEntry, recordExit, getWinRate, getMLBonus, getAllStats };
