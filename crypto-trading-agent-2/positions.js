// Tracks entry price, stop loss, and take profit for each position in memory
const positions = {};

function recordEntry(symbol, entryPrice, stopLoss, takeProfit, dollars) {
  positions[symbol] = { entryPrice, stopLoss, takeProfit, dollars, enteredAt: new Date().toISOString() };
  console.log(`[Positions] ${symbol} entry recorded — stop: $${stopLoss?.toFixed(2)} | target: $${takeProfit?.toFixed(2)}`);
}

function clearEntry(symbol) {
  delete positions[symbol];
}

function getEntry(symbol) {
  return positions[symbol] || null;
}

function getAll() {
  return { ...positions };
}

// Check if any position has hit stop loss or take profit
function checkExits(currentPrices) {
  const exits = [];
  for (const [symbol, entry] of Object.entries(positions)) {
    const price = currentPrices[symbol];
    if (!price) continue;

    const pnlPct = ((price - entry.entryPrice) / entry.entryPrice) * 100;

    if (entry.stopLoss && price <= entry.stopLoss) {
      exits.push({ symbol, reason: "stop-loss", price, pnlPct: pnlPct.toFixed(2) });
    } else if (entry.takeProfit && price >= entry.takeProfit) {
      exits.push({ symbol, reason: "take-profit", price, pnlPct: pnlPct.toFixed(2) });
    }
  }
  return exits;
}

module.exports = { recordEntry, clearEntry, getEntry, getAll, checkExits };
