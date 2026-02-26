const cron = require("node-cron");
const Market = require("../models/Market");
const { fetchOutcomeFromOracle } = require("../utils/oracle"); // hypothetical
const { generateRandomMarket } = require("../services/market/marketGenerator");

function startMarketCron() {
  cron.schedule("*/30 * * * * *", async () => {
    const now = new Date();

    await generateRandomMarket();

    // ✅ 1. End LIVE markets
    const liveMarkets = await Market.find({ status: "LIVE", endDate: { $lte: now } });
    for (const market of liveMarkets) {
      market.status = "ENDED";
      await market.save();
      console.log(`✅ Market ended: ${market.question}`);
    }

    // ✅ 2. Settle ENDED markets
    const endedMarkets = await Market.find({ status: "ENDED", result: null });
    for (const market of endedMarkets) {
      try {
        const outcome = await fetchOutcomeFromOracle(market); // "YES" or "NO"
        market.result = outcome;
        market.status = "SETTLED";
        await market.save();
        console.log(`🎯 Market settled: ${market.question} → ${outcome}`);
      } catch (err) {
        console.error(`❌ Failed to settle market ${market._id}:`, err.message);
      }
    }
  });
}

module.exports = { startMarketCron };