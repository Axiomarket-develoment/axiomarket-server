const cron = require("node-cron");
const Market = require("../models/Market");
const { generateRandomMarket } = require("../services/market/marketGenerator");
const Conversation = require("../models/conversation");
const Message = require("../models/Message");
const { fetchOutcomeFromOracle } = require("../utils/oracle");
const { settleMarket } = require("../services/market/settlement");
const { adminDb } = require("../lib/firebaseAdmin");
const Fill = require("../models/Fill");

function startMarketCron() {
  // ✅ Runs every 1 minute
  cron.schedule("*/1 * * * *", async () => {
    const now = new Date();

    // 0️⃣ Generate a new market
    try {
      await generateRandomMarket();
    } catch (err) {
      console.error("❌ Market generation failed:", err.message);
    }

    // 1️⃣ End LIVE markets whose endDate has passed
    const liveMarkets = await Market.find({
      status: "LIVE",
      endDate: { $lte: now }
    });

    for (const market of liveMarkets) {
      market.status = "ENDED";
      await market.save();
      console.log(`✅ Market ended: ${market.question}`);
    }

    // 2️⃣ Settle ENDED markets with participants
    const endedMarkets = await Market.find({
      status: "ENDED",
    });

    for (const market of endedMarkets) {
      try {
        // Only settle if there are participants
      

        // Fetch outcome from oracle
        const outcome = await fetchOutcomeFromOracle(market);

        // Call settleMarket which handles payouts & Firestore sync
        await settleMarket(market, outcome);

        console.log(`🏁 Market ${market._id} settled with outcome: ${outcome}`);

      } catch (err) {
        console.error(`❌ Failed to settle market ${market._id}:`, err.message);
      }
    }
  });

  // 🧹 CLEANUP CRON (every 30 mins)
  cron.schedule("*/30 * * * *", async () => {
    console.log("🧹 Running cleanup cron...");

    try {
      const settledMarkets = await Market.find({ status: "SETTLED" });

      for (const market of settledMarkets) {
        try {
          const marketId = market._id.toString();
          const convoId = market.conversationId?.toString();

          console.log(`🗑 Cleaning market: ${marketId}`);

          // Delete Mongoose data
          if (convoId) {
            await Message.deleteMany({ conversation_id: convoId });
            await Conversation.findByIdAndDelete(convoId);
          }
          await Market.findByIdAndDelete(marketId);

          // Delete Firestore data
          await adminDb.collection("markets").doc(marketId).delete();

          if (convoId) {
            const messagesSnap = await adminDb
              .collection("conversations")
              .doc(convoId)
              .collection("messages")
              .get();

            const batch = adminDb.batch();
            messagesSnap.docs.forEach(doc => batch.delete(doc.ref));
            batch.delete(adminDb.collection("conversations").doc(convoId));
            await batch.commit();
          }

          console.log(`✅ Deleted market + conversation: ${marketId}`);
        } catch (err) {
          console.error(`❌ Failed cleanup for market ${market._id}:`, err.message);
        }
      }
    } catch (err) {
      console.error("❌ Cleanup cron failed:", err.message);
    }
  });
}

module.exports = { startMarketCron };