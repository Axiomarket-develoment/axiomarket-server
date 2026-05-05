const cron = require("node-cron");
const Market = require("../models/Market");
const { fetchOutcomeFromOracle } = require("../utils/oracle");
const { settleMarket } = require("../services/market/settlement");

function startMarketCron() {
  let running = false;

  cron.schedule("* * * * *", async () => {
    if (running) return;

    running = true;

    try {
      const now = new Date();
      console.log("\n⏱ MAIN CRON:", now.toISOString());

      // 1. END MARKETS
      const ended = await Market.updateMany(
        { status: "LIVE", endDate: { $lte: now } },
        { $set: { status: "ENDED" } }
      );

      if (ended.modifiedCount > 0) {
        console.log(`🛑 Ended ${ended.modifiedCount} markets`);
      }

      // 2. SETTLE MARKETS
      const marketsToSettle = await Market.find({
        status: "ENDED",
        processing: false,
        marketType: "CRYPTO"
      }).limit(10);

      for (const m of marketsToSettle) {
        const market = await Market.findOneAndUpdate(
          { _id: m._id, status: "ENDED", processing: false },
          { $set: { processing: true, status: "SETTLING" } },
          { returnDocument: "after" }
        );

        if (!market) continue;

        try {
          const outcome = await fetchOutcomeFromOracle(market);

          if (!outcome) {
            await Market.updateOne(
              { _id: market._id },
              { $set: { processing: false, status: "ENDED" } }
            );
            continue;
          }

          await settleMarket(market, outcome);

          await Market.updateOne(
            { _id: market._id },
            {
              $set: {
                status: "SETTLED",
                processing: false,
                result: outcome
              }
            }
          );

          console.log(`✅ Settled: ${market._id}`);
        } catch (err) {
          console.log("❌ Settlement error:", err.message);

          await Market.updateOne(
            { _id: market._id },
            { $set: { processing: false, status: "ENDED" } }
          );
        }
      }
    } catch (err) {
      console.error("❌ MAIN CRON ERROR:", err.message);
    }

    running = false;
  });
}

module.exports = { startMarketCron };