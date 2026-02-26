const fetch = require("node-fetch");

async function getAvalancheTokens() {
  try {
    const res = await fetch("https://api.dexscreener.com/chains/avalanche/pairs");
    const data = await res.json();

    // Extract unique token addresses
    const tokensSet = new Set();
    data.forEach(pair => {
      tokensSet.add(pair.baseToken.address);
      tokensSet.add(pair.quoteToken.address);
    });

    const tokens = Array.from(tokensSet);
    console.log("🔥 Avalanche Tokens:");
    console.log(tokens.slice(0, 10)); // show first 10 tokens as example
  } catch (err) {
    console.error("Error fetching Avalanche tokens:", err);
  }
}

getAvalancheTokens();