const { TOKENS } = require("./coinGeckoTokens");
const { PRICE_FEEDS, BINANCE_SYMBOLS } = require("./priceFeeds");

const SUPPORTED_ASSETS = Array.from(
  new Set([
    ...Object.keys(PRICE_FEEDS),
    ...Object.keys(BINANCE_SYMBOLS),
    ...TOKENS   // ✅ FIXED
  ])
);

module.exports = {
  SUPPORTED_ASSETS
};