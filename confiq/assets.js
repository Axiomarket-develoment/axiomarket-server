const { TOKENS } = require("./coinGeckoTokens");
const { PRICE_FEEDS, BINANCE_SYMBOLS } = require("./priceFeeds");

const SUPPORTED_ASSETS = Array.from(
  new Set([
    ...Object.keys(PRICE_FEEDS),
    ...Object.keys(BINANCE_SYMBOLS),
    ...TOKENS   // ✅ FIXED
  ])
);

// console.log("SUPPORTED_ASSETS:", SUPPORTED_ASSETS);
// console.log("PRICE_FEEDS:", PRICE_FEEDS);
// console.log("BINANCE_SYMBOLS:", BINANCE_SYMBOLS);
// console.log("TOKENS:", TOKENS);

module.exports = {
  SUPPORTED_ASSETS
};


// Merge all tokens into a single set
const ALL_TOKENS = Array.from(
  new Set([
    ...TOKENS,
    ...Object.keys(PRICE_FEEDS),
    ...Object.keys(BINANCE_SYMBOLS)
  ])
);

// Map each token to a Binance symbol if available, else null
const TOKEN_CHART_SYMBOLS = ALL_TOKENS.reduce((acc, token) => {
  acc[token] = BINANCE_SYMBOLS[token] || null; // null means no Binance chart available
  return acc;
}, {});

module.exports = {
  ALL_TOKENS,
  TOKEN_CHART_SYMBOLS
};