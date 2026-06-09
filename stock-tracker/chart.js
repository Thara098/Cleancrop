let priceChart = null;

function renderChart(labels, prices, sma20Line, sma50Line) {
  const ctx = document.getElementById("price-chart").getContext("2d");

  if (priceChart) priceChart.destroy();

  priceChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Price",
          data: prices,
          borderColor: "#6c63ff",
          backgroundColor: "rgba(108, 99, 255, 0.08)",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3,
          fill: true,
        },
        {
          label: "SMA 20",
          data: sma20Line,
          borderColor: "#f59e0b",
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.3,
          borderDash: [4, 4],
        },
        {
          label: "SMA 50",
          data: sma50Line,
          borderColor: "#10b981",
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.3,
          borderDash: [4, 4],
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { labels: { color: "#e2e8f0" } },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: $${ctx.parsed.y?.toFixed(2) ?? "—"}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: "#94a3b8", maxTicksLimit: 8 },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
        y: {
          ticks: { color: "#94a3b8", callback: (v) => "$" + v.toFixed(0) },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
      },
    },
  });
}
