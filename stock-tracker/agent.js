async function callClaude(prompt) {
  let response;
  try {
    response = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 350,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch (networkErr) {
    throw new Error("Network error: " + networkErr.message);
  }

  const data = await response.json();
  console.log("Anthropic response:", data);

  if (!response.ok) {
    throw new Error(data.error?.message || `HTTP ${response.status}: ${JSON.stringify(data)}`);
  }

  return data.content[0].text;
}

function buildContext(d) {
  return `Ticker: ${d.ticker}
Current Price: $${d.currentPrice.toFixed(2)}
SMA 20: $${d.sma20?.toFixed(2) ?? "N/A"}
SMA 50: $${d.sma50?.toFixed(2) ?? "N/A"}
RSI (14): ${d.rsi?.toFixed(1) ?? "N/A"}
Price change over period: ${d.priceChangePct.toFixed(2)}%
52-Week High: $${d.high52?.toFixed(2) ?? "N/A"}
52-Week Low: $${d.low52?.toFixed(2) ?? "N/A"}`;
}

async function runBullAgent(d) {
  return callClaude(`You are the Bull Analyst. Your job is to argue the bullish case for ${d.ticker}.
Given the technical data below, identify 3-4 specific reasons this stock could go UP.
Focus on: price above moving averages, RSI momentum, trend strength, proximity to highs.
Be concise. Use bullet points. Label each point clearly.

${buildContext(d)}

Disclaimer: This is educational technical analysis only, not financial advice.`);
}

async function runBearAgent(d) {
  return callClaude(`You are the Bear Analyst. Your job is to argue the bearish case for ${d.ticker}.
Given the technical data below, identify 3-4 specific reasons this stock could go DOWN.
Focus on: price below moving averages, overbought RSI, weak momentum, proximity to lows.
Be concise. Use bullet points. Label each point clearly.

${buildContext(d)}

Disclaimer: This is educational technical analysis only, not financial advice.`);
}

async function runRiskAgent(d) {
  return callClaude(`You are the Risk Analyst. Your job is to evaluate the risk profile of ${d.ticker}.
Given the technical data below, assess:
- Volatility signals (distance from 52W high/low, RSI extremes)
- Downside risk (how far price could fall to key levels)
- Risk/reward balance at the current price
Be concise. Use bullet points.

${buildContext(d)}

Disclaimer: This is educational technical analysis only, not financial advice.`);
}

async function runSummaryAgent(d, bullText, bearText, riskText) {
  return callClaude(`You are the Lead Analyst. Three analysts have debated ${d.ticker}. Synthesize their full arguments and current data into a structured verdict.

--- BULL ANALYST ---
${bullText}

--- BEAR ANALYST ---
${bearText}

--- RISK ANALYST ---
${riskText}

--- CURRENT DATA ---
${buildContext(d)}

Produce your verdict in this exact format:

DEBATE SYNTHESIS
[2-3 sentences weighing which case is stronger and why, referencing specific points from each analyst]

SHORT-TERM OUTLOOK (1–2 weeks)
Scenario A (Bull): [specific price target or % move if momentum continues]
Scenario B (Bear): [specific price target or % move if it breaks down]
Most likely: [which scenario and why]

MEDIUM-TERM OUTLOOK (1–3 months)
[Key trend and what would need to happen for a reversal]

KEY LEVELS TO WATCH
Support: [price level]
Resistance: [price level]
Breakout trigger: [what event/level changes the picture]

PROBABILITY ASSESSMENT
Bullish: [X]%  |  Neutral: [Y]%  |  Bearish: [Z]%

OVERALL VERDICT: [BULLISH / NEUTRAL / BEARISH] — Confidence: [LOW / MEDIUM / HIGH]

Disclaimer: Educational technical analysis only, not financial advice.`);
}
