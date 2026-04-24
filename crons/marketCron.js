const cron = require("node-cron");
const Market = require("../models/Market");
const { generateMarkets } = require("../services/market/marketGenerator");
const Conversation = require("../models/conversation");
const Message = require("../models/Message");
const { fetchOutcomeFromOracle } = require("../utils/oracle");
const { settleMarket } = require("../services/market/settlement");
const { adminDb } = require("../lib/firebaseAdmin");
const Fill = require("../models/Fill");

function startMarketCron() {

  // 🟢 5 MINUTE MARKETS
  cron.schedule("*/5 * * * *", async () => {
    console.log("⏱ Generating 5m markets...");
    await generateMarkets(5);
  });

  // 🔵 15 MINUTE MARKETS
  cron.schedule("*/15 * * * *", async () => {
    console.log("⏱ Generating 15m markets...");
    await generateMarkets(15);
  });

  // 🔴 END MARKETS (runs every minute)
  cron.schedule("*/3 * * * *", async () => {
    const now = new Date();

    const markets = await Market.find({
      status: "LIVE",
      endDate: { $lte: now }
    }).limit(10);

    for (const market of markets) {
      market.status = "ENDED";
      await market.save();

      console.log(`✅ Ended: ${market.question}`);
    }
  });

  // 🟣 SETTLEMENT (every 5 minutes)
  cron.schedule("*/5 * * * *", async () => {
    console.log("🏁 Running settlement...");

    const markets = await Market.find({
      status: "ENDED",
      result: null,
      processing: { $ne: true }
    }).limit(10);

    for (const market of markets) {
      try {
        // 🔒 LOCK IT FIRST
        market.processing = true;
        await market.save();

        const outcome = await fetchOutcomeFromOracle(market);

        if (!outcome) {
          market.processing = false;
          await market.save();
          console.log("⚠️ No outcome, skipping");
          continue;
        }

        await settleMarket(market, outcome);

        // 🔓 UNLOCK AFTER
        market.processing = false;
        await market.save();

        console.log(`✅ Settled: ${market._id}`);
      } catch (err) {
        market.processing = false;
        await market.save();

        console.error("❌ Settlement failed:", err.message);
      }
    }
  });



  // every 15 minutes
  // cron.schedule("*/15 * * * *", async () => {
  //   console.log("💰 Running wallet sync...");
  //   await syncWalletBalances();
  // });
}


module.exports = { startMarketCron };