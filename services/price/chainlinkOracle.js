// testChainlinkPrices.js

const { PRICE_FEEDS } = require("../../config/priceFeeds");
const { fetchCurrentPrice } = require("../../utils/oracle");

(async () => {
  console.log("🔎 Testing Chainlink prices via fetchCurrentPrice...\n");

  for (const asset of Object.keys(PRICE_FEEDS)) {
    if (!PRICE_FEEDS[asset]) {
      console.log(`⚠️ ${asset} has no Chainlink feed, skipping.`);
      continue;
    }

    try {
      const price = await fetchCurrentPrice(asset);
      console.log(`💰 ${asset} price (Chainlink): $${price}`);
    } catch (err) {
      console.error(`❌ Failed to fetch ${asset}:`, err.message);
    }
  }

  console.log("\n✅ Test complete.");
})();