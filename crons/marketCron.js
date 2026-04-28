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

  // 🔵 15 MINUTE MARKETS
 // 🕘 DAILY MARKET GENERATION (9 AM)
cron.schedule("30 9 * * *", async () => {
  console.log("🌅 Generating markets...");
  await generateMarkets();
}, {
  timezone: "Africa/Lagos"
});



  // 🔴 END MARKETS (runs every minute)
cron.schedule("0 */2 * * *", async () => {
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

  // 🟣 SETTLEMENT EVERY 12 HOURS
// 🟣 SETTLEMENT EVERY 2 HOURS
cron.schedule("0 */2 * * *", async () => {
  console.log("🏁 Running 2-hour settlement...");

  const markets = await Market.find({
    status: "ENDED",
    result: null,
    processing: { $ne: true }
  });

  for (const market of markets) {
    try {
      // 🔒 lock
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

      // 🔓 unlock
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