const cron = require("node-cron");
const Market = require("../models/Market");
const { generateRandomMarket } = require("../services/market/marketGenerator");
const { fetchOutcomeFromOracle } = require("../utils/oracle");
const { settleMarket } = require("../services/market/settlement");

function startMarketCron() {
  // ✅ Runs every 1 minute
  cron.schedule("*/2 * * * *", async () => {
    const now = new Date();

    console.log("⏱ Running market cron:", now.toISOString());

    // 0️⃣ Generate a new market
    try {
      await generateRandomMarket();
    } catch (err) {
      console.error("❌ Market generation failed:", err.message);
    }

    // 1️⃣ End LIVE markets
    const liveMarkets = await Market.find({
      status: "LIVE",
      endDate: { $lte: now }
    });

    for (const market of liveMarkets) {
      market.status = "ENDED";
      await market.save();
      console.log(`✅ Market ended: ${market.question}`);
    }

    // 2️⃣ Settle ENDED markets
    const endedMarkets = await Market.find({
      status: "ENDED",
      result: null
    });

    for (const market of endedMarkets) {
      try {
        const outcome = await fetchOutcomeFromOracle(market);

        market.result = outcome;
        await market.save();

        console.log(
          `Before settleMarket: result=${market.result}, status=${market.status}`
        );

        await settleMarket(market, outcome);

      } catch (err) {
        console.error(
          `❌ Failed to settle market ${market._id}:`,
          err.message
        );
      }
    }
  });
}

module.exports = { startMarketCron };