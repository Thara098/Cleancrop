const express = require("express");
const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Read keys from config.js at startup
const fs = require("fs");
const configSrc = fs.readFileSync(path.join(__dirname, "config.js"), "utf8");
const anthropicKey = configSrc.match(/ANTHROPIC_KEY:\s*"([^"]+)"/)?.[1];

app.post("/api/claude", async (req, res) => {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Stock Tracker running at http://localhost:${PORT}`);
});
