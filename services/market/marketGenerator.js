const Market = require("../../models/Market");
const conversation = require("../../models/conversation");
const { adminDb } = require("../../lib/firebaseAdmin");
const { TOKENS } = require("../../confiq/assets");
const { getPrice } = require("../price/priceOracle");

const TEST_MODE = false;

/* =========================
   TIME ENGINE (CORE FIX)
========================= */

function getMarketEndDate(durationMinutes, now = new Date()) {
  const today9AM = new Date(now);
  today9AM.setHours(9, 0, 0, 0);

  const today9PM = new Date(now);
  today9PM.setHours(21, 0, 0, 0);

  const tomorrow9AM = new Date(today9AM);
  tomorrow9AM.setDate(tomorrow9AM.getDate() + 1);

  if (durationMinutes === 720) return today9PM;     // 12h → 9PM fixed
  if (durationMinutes === 1440) return tomorrow9AM; // 24h → 9AM next day

  return today9PM;
}

function formatDuration(minutes) {
  if (minutes >= 60) return `${Math.round(minutes / 60)}h`;
  return `${minutes}m`;
}

function getSymbol(asset) {
  const map = {
    bitcoin: "BTC",
    ethereum: "ETH",
    binancecoin: "BNB",
    solana: "SOL",
    "avalanche-2": "AVAX",
    sui: "SUI",
    dogecoin: "DOGE"
  };

  return `$${map[asset] || asset.toUpperCase()}`;
}

/* =========================
   MARKET CREATION
========================= */

async function createMarket({
  asset,
  question,
  currentPrice,
  targetPrice,
  direction,
  durationMinutes,
  endDate
}) {
  try {
    // 1. conversation
    const convo = await conversation.create({
      market: null,
      participants: [],
      conv_type: "group"
    });

    if (!convo?._id) throw new Error("Conversation creation failed");

    // 2. Mongo Market
    const market = new Market({
      question,
      marketType: "CRYPTO",
      conversationId: convo._id,

      subMarkets: [
        {
          question,
          marketType: "CRYPTO",
          outcomes: [
            { label: "Yes", result: false, odds: 2, pool: 0, liquidity: 0, volume: 0, count: 0 },
            { label: "No", result: false, odds: 2, pool: 0, liquidity: 0, volume: 0, count: 0 }
          ],
          status: "LIVE",
          totalVolume: 0,
          tradeCount: 0
        }
      ],

      metadata: {
        asset,
        startPrice: currentPrice,
        targetPrice,
        assetSymbol: getSymbol(asset),
        direction
      },

      startDate: new Date(),
      endDate,
      durationMinutes,
      status: "LIVE"
    });

    const saved = await market.save();
    if (!saved?._id) throw new Error("Market save failed");

    // 3. link conversation
    await conversation.findByIdAndUpdate(convo._id, {
      market: saved._id
    });

    const plain = saved.toObject();

    // 4. Firestore payload (SAFE + CONSISTENT)
    const firestorePayload = {
      id: plain._id.toString(),
      question: plain.question,
      marketType: plain.marketType,

      conversationId: convo._id.toString(),

      metadata: plain.metadata,

      currentPrice: plain.metadata.startPrice,
      targetPrice: plain.metadata.targetPrice,
      direction: plain.metadata.direction,

      totalVolume: 0,
      tradeCount: 0,
      status: plain.status,

      startDate: plain.startDate.getTime(),
      endDate: plain.endDate.getTime(),
      durationMinutes: plain.durationMinutes,

      createdAt: Date.now()
    };

    await adminDb
      .collection("markets")
      .doc(plain._id.toString())
      .set(firestorePayload);

    return saved;
  } catch (err) {
    console.error("❌ createMarket failed:", err.message);
    throw err;
  }
}

/* =========================
   MARKET GENERATOR
========================= */

async function generateMarkets() {
  try {
    const directions = ["UP", "DOWN"];
    const jobs = [];

    const shuffledTokens = [...TOKENS].sort(() => Math.random() - 0.5);

    for (const durationMinutes of [720, 1440]) {
      const endDate = getMarketEndDate(durationMinutes);

      for (const asset of shuffledTokens) {
        const currentPrice = getPrice(asset);
        if (!currentPrice) continue;

        for (const direction of directions) {
          const percentMove = TEST_MODE
            ? Math.random() * 0.5 + 0.5
            : durationMinutes === 720
              ? Math.random() * 3 + 1
              : Math.random() * 5 + 2;

          let targetPrice =
            direction === "UP"
              ? currentPrice * (1 + percentMove / 100)
              : currentPrice * (1 - percentMove / 100);

          targetPrice =
            currentPrice < 1
              ? Number(targetPrice.toFixed(8))
              : Number(targetPrice.toFixed(2));

          const question =
            direction === "UP"
              ? `Will ${getSymbol(asset)} be above $${targetPrice} in ${formatDuration(durationMinutes)}?`
              : `Will ${getSymbol(asset)} be below $${targetPrice} in ${formatDuration(durationMinutes)}?`;

          jobs.push(
            createMarket({
              asset,
              question,
              currentPrice,
              targetPrice,
              direction,
              durationMinutes,
              endDate
            })
          );
        }
      }
    }

    for (const job of jobs) {
      await job;
      await new Promise(res => setTimeout(res, 200));
    }

    console.log(`🔥 ${jobs.length} markets created`);
  } catch (err) {
    console.error("❌ Bulk generation failed:", err.message);
  }
}

module.exports = {
  generateMarkets,
  TEST_MODE
};