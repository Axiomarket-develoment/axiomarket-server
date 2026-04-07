// utils/constants.js
const { TOKENS } = require("../confiq/coinGeckoTokens");
const { PRICE_FEEDS, BINANCE_SYMBOLS } = require("../confiq/priceFeeds");

const SUPPORTED_ASSETS = Array.from(
  new Set([...Object.keys(PRICE_FEEDS), ...Object.keys(BINANCE_SYMBOLS), ...TOKENS])
);

module.exports = { SUPPORTED_ASSETS, TOKENS, PRICE_FEEDS, BINANCE_SYMBOLS };