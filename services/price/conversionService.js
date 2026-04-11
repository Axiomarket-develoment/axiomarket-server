const { getPrice } = require("../price/priceOracle");

function convertUsdToAvax(usd) {
  const price = getPrice("avalanche-2");
  if (!price) return 0;
  return usd / price;
}

function convertAvaxToUsd(avax) {
  const price = getPrice("avalanche-2");
  if (!price) return 0;
  return avax * price;
}

module.exports = { convertUsdToAvax, convertAvaxToUsd };