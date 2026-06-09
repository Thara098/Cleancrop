async function callClaude(prompt) {
  let response;
  try {
    response = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
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
  return callClaude(`You are the Lead Analyst delivering a final investment verdict on ${d.ticker} based on past price behavior and the debate below.

--- BULL ANALYST ---
${bullText}

--- BEAR ANALYST ---
${bearText}

--- RISK ANALYST ---
${riskText}

--- CURRENT DATA ---
${buildContext(d)}

Produce your verdict in this exact format:

PAST BEHAVIOR ANALYSIS
[3 sentences analyzing what the historical price action reveals: has this asset trended consistently, recovered well from dips, shown high volatility, broken down under pressure? What does the 52W range and distance from SMA tell us about its behavior pattern?]

DEBATE SYNTHESIS
[2 sentences on which analyst made the stronger case and the single most important factor right now]

SHORT-TERM OUTLOOK (1–2 weeks)
Bull case: [price target or % move]
Bear case: [price target or % move]
Most likely: [which and why in one sentence]

MEDIUM-TERM OUTLOOK (1–3 months)
[One sentence on trend direction and what would reverse it]

KEY LEVELS TO WATCH
Support: $[level] | Resistance: $[level]
Breakout trigger: [specific condition]

PROBABILITY ASSESSMENT
Bullish: [X]%  |  Neutral: [Y]%  |  Bearish: [Z]%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL CONCLUSION: [INVEST / WATCH / AVOID]
Confidence: [LOW / MEDIUM / HIGH]
Reasoning: [1-2 sentences — based purely on past behavior patterns and current technicals, state clearly why this is the conclusion]
Entry condition: [what price level or signal would make this a better entry point]
Exit / Stop-loss: [at what level the thesis is broken]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Note: This is technical analysis based on historical price data only. It does not account for news, earnings, or macro events. Use as one input among many.`);
}
