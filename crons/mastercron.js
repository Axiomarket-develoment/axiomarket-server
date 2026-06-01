const { startOracle, getPrice } = require("../services/price/priceOracle");
const { generateMarkets } = require("../services/market/marketGenerator");
const Market = require("../models/Market");
const { settleMarket } = require("../services/market/settlement");
const { syncWalletBalances } = require("../services/wallet/syncWalletBalance");
const { fetchOutcomeFromOracle } = require("../utils/oracle");

let running = false;

async function mainCycle() {
  if (running) return;
  running = true;

  try {
    console.log("\n🚀 START MASTER CYCLE");

    // 1. UPDATE PRICES FIRST
    // await startOracle(); // or better: fetchPrices()

    // 2. CREATE MARKETS
    await generateMarkets({ durationMinutes: 15 });
    // await generateMarkets({ durationMinutes: 5 });

    await generateMarkets({ durationMinutes: 60 });

    await generateMarkets({ durationMinutes: 360 });

    await generateMarkets({ durationMinutes: 720 });
    // 3. END MARKETS
    const now = new Date();

    await Market.updateMany(
      { status: "LIVE", endDate: { $lte: now } },
      { $set: { status: "ENDED" } }
    );

    // 4. SETTLE MARKETS
    const markets = await Market.find({
      status: "ENDED",
      processing: false
    }).limit(10);

    for (const m of markets) {
      const outcome = await fetchOutcomeFromOracle(m);

      if (!outcome) continue;

      await settleMarket(m, outcome);

      await Market.updateOne(
        { _id: m._id },
        {
          status: "SETTLED",
          result: outcome
        }
      );
    }

    // 5. SYNC WALLET LAST
    await syncWalletBalances();

    console.log("✅ MASTER CYCLE COMPLETE\n");

  } catch (err) {
    console.log("❌ CYCLE ERROR:", err.message);
  }

  running = false;
}

function startEngine() {
  console.log("🟢 ENGINE STARTED");

  setInterval(mainCycle,60 * 1000); // every 1 min
}

module.exports = { startEngine };