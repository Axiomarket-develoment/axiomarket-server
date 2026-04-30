const cron = require("node-cron");
const Market = require("../models/Market");
const { generateMarkets } = require("../services/market/marketGenerator");
const { fetchOutcomeFromOracle } = require("../utils/oracle");
const { settleMarket } = require("../services/market/settlement");

function startMarketCron() {

  let generating = false;

  // ===============================
  // 🟢 MARKET GENERATION (5 MIN)
  // ===============================
  cron.schedule("*/5 * * * *", async () => {
    try {
      const liveCount = await Market.countDocuments({ status: "LIVE" });

      if (liveCount < 5 && !generating) {
        generating = true;

        try {
          await generateMarkets();
        } catch (err) {
          console.error("generateMarkets failed:", err.message);
        } finally {
          generating = false;
        }
      }

    } catch (err) {
      console.error("Market generation error:", err.message);
    }
  });

  // ===============================
  // 🔴 END MARKETS (EVERY 1 MIN)
  // ===============================
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();

      const markets = await Market.find({
        status: "LIVE",
        endDate: { $lte: now }
      }).limit(20);

      for (const market of markets) {
        await Market.updateOne(
          { _id: market._id },
          { $set: { status: "ENDED" } }
        );
      }

    } catch (err) {
      console.error("Market end error:", err.message);
    }
  });

  // ===============================
  // 🏁 SETTLEMENT (EVERY 5 MIN)
  // ===============================
  cron.schedule("*/5 * * * *", async () => {
    try {
      const markets = await Market.find({
        status: "ENDED",
        processing: { $ne: true }
      }).limit(20);

      for (const m of markets) {

        const market = await Market.findOneAndUpdate(
          { _id: m._id, processing: { $ne: true } },
          { $set: { processing: true } },
          { new: true }
        );

        if (!market) continue;

        try {
          const outcome = await fetchOutcomeFromOracle(market);

          if (!outcome) {
            await Market.updateOne(
              { _id: market._id },
              { $set: { processing: false } }
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

        } catch (err) {
          await Market.updateOne(
            { _id: market._id },
            { $set: { processing: false } }
          );
        }
      }

    } catch (err) {
      console.error("Settlement error:", err.message);
    }
  });

}

module.exports = { startMarketCron };