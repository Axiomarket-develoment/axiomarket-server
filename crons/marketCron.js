const cron = require("node-cron");
const Market = require("../models/Market");
const { generateRandomMarket } = require("../services/market/marketGenerator");

const Conversation = require("../models/conversation");
const Message = require("../models/Message"); // make sure this exists

const { fetchOutcomeFromOracle } = require("../utils/oracle");
const { settleMarket } = require("../services/market/settlement");

function startMarketCron() {
  // ✅ Runs every 1 minute
  cron.schedule("*/1 * * * *", async () => {
    const now = new Date();

    // console.log("⏱ Running market cron:", now.toISOString());

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
      // console.log(`✅ Market ended: ${market.question}`);
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


// 🧹 CLEANUP CRON (every 30 mins)
cron.schedule("*/30 * * * *", async () => {
  console.log("🧹 Running cleanup cron...");

  try {
    // 1️⃣ Find settled markets
    const settledMarkets = await Market.find({
      status: "SETTLED"
    });

    for (const market of settledMarkets) {
      try {
        const marketId = market._id.toString();
        const convoId = market.conversationId?.toString();

        console.log(`🗑 Cleaning market: ${marketId}`);

        // ==========================
        // 🔥 DELETE MONGOOSE DATA
        // ==========================

        if (convoId) {
          // delete messages
          await Message.deleteMany({ conversation_id: convoId });

          // delete conversation
          await Conversation.findByIdAndDelete(convoId);
        }

        // delete market
        await Market.findByIdAndDelete(marketId);

        // ==========================
        // 🔥 DELETE FIREBASE DATA
        // ==========================

        // delete market doc
        await adminDb.collection("markets").doc(marketId).delete();

        if (convoId) {
          // delete messages subcollection
          const messagesSnap = await adminDb
            .collection("conversations")
            .doc(convoId)
            .collection("messages")
            .get();

          const batch = adminDb.batch();

          messagesSnap.docs.forEach((doc) => {
            batch.delete(doc.ref);
          });

          // delete conversation doc
          const convoRef = adminDb.collection("conversations").doc(convoId);
          batch.delete(convoRef);

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


module.exports = { startMarketCron };