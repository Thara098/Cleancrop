let equityChart   = null;
let pollInterval  = null;
let seenLogTimes  = new Set();

// --- Browser Notifications ---
function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function notify(title, body, type = "default") {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const icons = { buy: "📈", sell: "📉", hold: "⏸", error: "⚠️" };
  const icon  = icons[type] ?? "🤖";
  new Notification(`${icon} ${title}`, { body, icon: "/favicon.ico" });
}

function checkForNewTrades(logs) {
  for (const log of logs) {
    if (seenLogTimes.has(log.timestamp)) continue;
    seenLogTimes.add(log.timestamp);

    if (log.status === "executed" && log.decision) {
      const { action, shares, confidence } = log.decision;
      const type = action === "BUY" ? "buy" : "sell";
      notify(
        `${action} ${log.symbol}`,
        `${shares} units · ${confidence} confidence\n${log.decision.reasoning?.slice(0, 80)}...`,
        type
      );
    } else if (log.status === "error") {
      notify(`Agent Error — ${log.symbol}`, log.error ?? "Unknown error", "error");
    }
  }
}

async function api(path, method = "GET", body = null) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || JSON.stringify(data));
  return data;
}

function fmt(n)  { return "$" + parseFloat(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtPL(n) {
  const v = parseFloat(n);
  return `<span class="${v >= 0 ? "positive" : "negative"}">${v >= 0 ? "+" : ""}${fmt(v)}</span>`;
}

// --- Dashboard ---
async function loadDashboard() {
  try {
    const { account, positions, orders } = await api("/api/dashboard");

    document.getElementById("portfolio-value").textContent = fmt(account.portfolio_value);
    document.getElementById("cash").textContent = fmt(account.cash);
    document.getElementById("position-count").textContent = positions.length;

    const todayPL = parseFloat(account.equity) - parseFloat(account.last_equity);
    const totalPL = parseFloat(account.equity) - 100000;
    document.getElementById("today-pl").innerHTML  = fmtPL(todayPL);
    document.getElementById("total-pl").innerHTML  = fmtPL(totalPL);

    renderPositions(positions);
    renderOrders(orders);
    document.getElementById("error-banner").classList.add("hidden");
  } catch (e) { showError(e.message); }
}

function renderPositions(positions) {
  const el = document.getElementById("positions-table");
  if (!positions.length) { el.innerHTML = '<p class="empty-msg">No open positions</p>'; return; }
  el.innerHTML = `<table>
    <thead><tr><th>Symbol</th><th>Qty</th><th>Avg Cost</th><th>Current</th><th>P&L</th><th>%</th></tr></thead>
    <tbody>${positions.map(p => `<tr>
      <td><strong>${p.symbol}</strong></td>
      <td>${p.qty}</td>
      <td>${fmt(p.avg_entry_price)}</td>
      <td>${fmt(p.current_price)}</td>
      <td>${fmtPL(p.unrealized_pl)}</td>
      <td class="${parseFloat(p.unrealized_plpc) >= 0 ? "positive" : "negative"}">${(parseFloat(p.unrealized_plpc)*100).toFixed(2)}%</td>
    </tr>`).join("")}</tbody>
  </table>`;
}

function renderOrders(orders) {
  const el = document.getElementById("orders-table");
  if (!orders.length) { el.innerHTML = '<p class="empty-msg">No orders yet</p>'; return; }
  el.innerHTML = `<table>
    <thead><tr><th>Symbol</th><th>Side</th><th>Qty</th><th>Status</th><th>Time</th></tr></thead>
    <tbody>${orders.map(o => `<tr>
      <td><strong>${o.symbol}</strong></td>
      <td class="${o.side === "buy" ? "positive" : "negative"}">${o.side.toUpperCase()}</td>
      <td>${o.qty}</td>
      <td>${o.status}</td>
      <td>${new Date(o.created_at).toLocaleTimeString()}</td>
    </tr>`).join("")}</tbody>
  </table>`;
}

// --- Equity Chart ---
async function loadEquityChart() {
  try {
    const history = await api("/api/portfolio-history");
    if (!history.equity?.length) return;

    // Filter out zero-equity entries (before account existed)
    const combined = history.timestamp.map((t, i) => ({ t, v: history.equity[i] })).filter(d => d.v > 0);
    const labels = combined.map(d => new Date(d.t * 1000).toLocaleDateString());
    const values = combined.map(d => d.v);
    const ctx = document.getElementById("equity-chart").getContext("2d");
    if (equityChart) equityChart.destroy();

    equityChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Portfolio Value",
          data: values,
          borderColor: "#6c63ff",
          backgroundColor: "rgba(108,99,255,0.1)",
          borderWidth: 2, pointRadius: 0, fill: true, tension: 0.3,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#475569", maxTicksLimit: 6 }, grid: { color: "rgba(255,255,255,0.03)" } },
          y: { ticks: { color: "#475569", callback: v => "$" + v.toLocaleString() }, grid: { color: "rgba(255,255,255,0.03)" } },
        },
      },
    });
  } catch (e) { console.warn("Equity chart:", e.message); }
}

// --- Trade Log ---
async function loadTradeLog() {
  try {
    const logs = await api("/api/trade-log");
    const el   = document.getElementById("trade-log");
    document.getElementById("log-count").textContent = `${logs.length} decisions`;
    if (!logs.length) { el.innerHTML = '<p class="empty-msg">Click "Start Agent" or "Run Now" to begin.</p>'; return; }
    checkForNewTrades(logs);
    el.innerHTML = logs.map(buildLogEntry).join("");
  } catch (e) { console.warn("Trade log:", e.message); }
}

function buildLogEntry(log) {
  if (log.status === "market-closed") {
    return `<div class="log-entry hold">
      <div class="log-header">
        <span class="log-symbol">${log.symbol} <span class="type-badge stock">STOCK</span></span>
        <span class="log-action action-HOLD">CLOSED</span>
      </div>
      <div class="log-reasoning" style="color:#475569">US market closed — will analyze when open (Mon–Fri 9:30 AM–4 PM ET)</div>
      <div class="log-footer"><span></span><span>${new Date(log.timestamp).toLocaleTimeString()}</span></div>
    </div>`;
  }

  const action  = log.decision?.action ?? (log.status === "error" ? "ERROR" : "HOLD");
  const cls     = action === "BUY" ? "buy" : action === "SELL" ? "sell" : action === "ERROR" ? "error" : "hold";
  const time    = new Date(log.timestamp).toLocaleTimeString();
  const conf    = log.decision?.confidence ?? "";
  const typeBadge = log.type ? `<span class="type-badge ${log.type}">${log.type.toUpperCase()}</span>` : "";
  const signals = log.decision?.signals_summary ? `<div class="log-signals">📊 ${log.decision.signals_summary}</div>` : "";
  const reason  = log.decision?.reasoning ?? log.error ?? log.reason ?? "—";
  const risk    = log.decision?.risk_note ? `<div class="log-risk">⚠ ${log.decision.risk_note}</div>` : "";
  const stop    = log.decision?.stop_loss ? ` · Stop: $${log.decision.stop_loss}` : "";
  const amt     = log.decision?.dollars ? ` · $${parseFloat(log.decision.dollars).toFixed(0)}` : (log.decision?.shares > 0 ? ` · ${log.decision.shares} units` : "");
  const badge   = log.status === "executed" ? `<span class="executed-badge">✓ executed</span>` : `<span style="color:#475569">${log.status}</span>`;
  const scores  = (log.decision?.bullish_score != null) ? `<span style="color:#34d399">▲${log.decision.bullish_score}</span> <span style="color:#f87171">▼${log.decision.bearish_score}</span> · ` : "";
  const sltp    = (log.decision?.stop_loss || log.decision?.take_profit)
    ? `<div style="font-size:11px;color:#475569;margin-top:4px">SL: $${log.decision.stop_loss?.toFixed(2) ?? "—"} · TP: $${log.decision.take_profit?.toFixed(2) ?? "—"}</div>`
    : "";

  return `<div class="log-entry ${cls}">
    <div class="log-header">
      <span class="log-symbol">${log.symbol} ${typeBadge}</span>
      <span class="log-action action-${action}">${action}${amt}</span>
    </div>
    ${signals}
    <div class="log-reasoning">${reason}</div>
    ${risk}
    ${sltp}
    <div class="log-footer">
      ${badge}
      <span>${scores}${conf} · ${time}</span>
    </div>
  </div>`;
}

// --- Scheduler ---
async function loadSchedulerStatus() {
  try {
    const { running, active } = await api("/api/scheduler/status");
    const statusEl = document.getElementById("scheduler-status");
    const startBtn = document.getElementById("start-btn");
    const stopBtn  = document.getElementById("stop-btn");

    if (active) {
      statusEl.className = "scheduler-status running";
      statusEl.innerHTML = `<span class="running-dot"></span>Running`;
      startBtn.classList.add("hidden");
      stopBtn.classList.remove("hidden");
      startPolling();
    } else {
      statusEl.className = "scheduler-status stopped";
      statusEl.textContent = "● Stopped";
      startBtn.classList.remove("hidden");
      stopBtn.classList.add("hidden");
      stopPolling();
    }
  } catch (e) { console.warn("Scheduler status:", e.message); }
}

function startPolling() {
  if (pollInterval) return;
  pollInterval = setInterval(() => {
    loadDashboard();
    loadTradeLog();
  }, 15000);
}

function stopPolling() {
  clearInterval(pollInterval);
  pollInterval = null;
}

async function startAgent() {
  try {
    await api("/api/scheduler/start", "POST");
    await loadSchedulerStatus();
  } catch (e) { showError(e.message); }
}

async function stopAgent() {
  try {
    await api("/api/scheduler/stop", "POST");
    await loadSchedulerStatus();
  } catch (e) { showError(e.message); }
}

async function runNow() {
  const btn = document.getElementById("run-now-btn");
  btn.textContent = "Running...";
  btn.disabled = true;
  try {
    await api("/api/scheduler/run-now", "POST");
    setTimeout(async () => {
      await loadDashboard();
      await loadTradeLog();
    }, 5000);
  } catch (e) { showError(e.message); }
  finally { btn.textContent = "Run Now"; btn.disabled = false; }
}

function showError(msg) {
  const el = document.getElementById("error-banner");
  el.textContent = "Error: " + msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 8000);
}

// Events
document.getElementById("start-btn").addEventListener("click", startAgent);
document.getElementById("stop-btn").addEventListener("click", stopAgent);
document.getElementById("run-now-btn").addEventListener("click", runNow);
document.getElementById("refresh-btn").addEventListener("click", () => {
  loadDashboard(); loadEquityChart(); loadTradeLog(); loadSchedulerStatus();
});

// Init
requestNotificationPermission();
loadDashboard();
loadEquityChart();
loadTradeLog();
loadSchedulerStatus();
