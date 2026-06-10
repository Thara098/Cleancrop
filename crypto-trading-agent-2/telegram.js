// telegram.js — send trade alerts to your phone via Telegram bot
const fetch = (...a) => import("node-fetch").then(({ default: f }) => f(...a));

let _token, _chatId, _agentName;
try {
  const cfg = require("./config");
  _token     = cfg.TELEGRAM_BOT_TOKEN;
  _chatId    = cfg.TELEGRAM_CHAT_ID;
  _agentName = cfg.AGENT_NAME || "Agent";
} catch {}

async function send(text) {
  if (!_token || !_chatId || _token === "YOUR_BOT_TOKEN") return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${_token}/sendMessage`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: _chatId, text, parse_mode: "HTML" }),
    });
    if (!res.ok) {
      const err = await res.json();
      console.warn("[Telegram] Failed:", err.description);
    }
  } catch (e) {
    console.warn("[Telegram] Send error:", e.message);
  }
}

// ── Notification helpers ──────────────────────────────────────────────────────

function notifyTradeOpened(symbol, action, dollars, entryPrice, stopLoss, takeProfit) {
  const emoji  = action === "BUY" ? "🟢" : "🔴";
  const sl     = stopLoss   ? `\nSL:     $${stopLoss.toFixed(4)}`   : "";
  const tp     = takeProfit ? `\nTP:     $${takeProfit.toFixed(4)}`  : "";
  return send(
    `${emoji} <b>${_agentName} — ${action} ${symbol}</b>\n` +
    `Amount: $${Math.round(dollars).toLocaleString()}\n` +
    `Entry:  $${entryPrice?.toFixed(4) || "market"}` +
    sl + tp
  );
}

function notifyTradeClosed(symbol, action, pnlPct, exitPrice, reason) {
  const emoji = pnlPct >= 0 ? "✅" : "❌";
  return send(
    `${emoji} <b>${_agentName} — ${action} ${symbol}</b>\n` +
    `Exit:   $${exitPrice?.toFixed(4) || "market"}\n` +
    `P&L:    ${pnlPct >= 0 ? "+" : ""}${pnlPct?.toFixed(2)}%\n` +
    `Reason: ${reason}`
  );
}

function notifyStopLossTakeProfit(symbol, exitReason, currentPrice, pnlPct) {
  const emoji = exitReason === "take-profit" ? "🎯" : "🛑";
  return send(
    `${emoji} <b>${_agentName} — ${exitReason.toUpperCase()} ${symbol}</b>\n` +
    `Price: $${currentPrice?.toFixed(4)}\n` +
    `P&L:   ${pnlPct >= 0 ? "+" : ""}${pnlPct?.toFixed(2)}%`
  );
}

function notifyCircuitBreaker(active, drawdownPct, portfolioValue) {
  if (active) {
    return send(
      `⚠️ <b>${_agentName} — CIRCUIT BREAKER ACTIVE</b>\n` +
      `Drawdown: ${drawdownPct.toFixed(1)}% from peak\n` +
      `Portfolio: $${Math.round(portfolioValue).toLocaleString()}\n` +
      `No new buys until recovery.`
    );
  }
  return send(
    `✅ <b>${_agentName} — Circuit breaker cleared</b>\n` +
    `Trading resumed. Portfolio: $${Math.round(portfolioValue).toLocaleString()}`
  );
}

function notifyStaleOrderCancelled(symbol, dollars) {
  return send(`🗑 <b>${_agentName}</b> Cancelled stuck order: ${symbol} $${Math.round(dollars)} — cash freed`);
}

// Daily summary — call once per day
function notifyDailySummary(portfolioValue, cash, positions, totalTrades) {
  const posText = positions.length
    ? positions.map(p => {
        const pnl = parseFloat(p.unrealized_plpc) * 100;
        return `  ${p.symbol}: ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}%`;
      }).join("\n")
    : "  No open positions";
  return send(
    `📊 <b>${_agentName} — Daily Summary</b>\n` +
    `Portfolio: $${Math.round(portfolioValue).toLocaleString()}\n` +
    `Cash:      $${Math.round(cash).toLocaleString()}\n` +
    `Trades today: ${totalTrades}\n` +
    `Open positions:\n${posText}`
  );
}

module.exports = {
  send,
  notifyTradeOpened,
  notifyTradeClosed,
  notifyStopLossTakeProfit,
  notifyCircuitBreaker,
  notifyStaleOrderCancelled,
  notifyDailySummary,
};
