const Market = require("../models/Market");
const { adminDb } = require("../lib/firebaseAdmin");

const DELETE_LIVE_MARKETS_ENABLED = false; // 🔴 turn ON manually

async function deleteAllLiveMarkets() {
  try {
    if (!DELETE_LIVE_MARKETS_ENABLED) {
      throw new Error("❌ Deletion disabled. Enable flag first.");
    }

    console.log("🧨 Starting deletion of LIVE markets...");

    // 1️⃣ Get all live markets from Mongo
    const liveMarkets = await Market.find({ status: "LIVE" });

    console.log(`Found ${liveMarkets.length} LIVE markets`);

    for (const market of liveMarkets) {
      const id = market._id.toString();

      // 2️⃣ Delete from MongoDB
      await Market.findByIdAndDelete(id);

      // 3️⃣ Delete from Firestore
      await adminDb.collection("markets").doc(id).delete();

      console.log(`🗑 Deleted market: ${id}`);
    }

    console.log("✅ All LIVE markets deleted successfully");

    return {
      success: true,
      deletedCount: liveMarkets.length
    };

  } catch (err) {
    console.error("❌ Delete failed:", err.message);
    throw err;
  }
}

module.exports = { deleteAllLiveMarkets };


async function run() {
  await deleteAllLiveMarkets();
}

run();