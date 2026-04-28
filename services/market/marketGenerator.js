const { QUESTION_TEMPLATES } = require("../../confiq/questionTemplate");
const Market = require("../../models/Market");
const mongoose = require("mongoose");
const { adminDb } = require("../../lib/firebaseAdmin"); // ✅ correct
const conversation = require("../../models/conversation");
const { TOKENS } = require("../../confiq/assets");
const { getPrice } = require("../price/priceOracle");


// console.log("SUPPORTED_ASSETS:", SUPPORTED_ASSETS);

// ✅ Set this to true to enable test mode
const TEST_MODE = false;

function getDirectionWord(direction) {
  return direction === "UP" ? "up" : "down";
}

function getMarketCycleStart() {
  const now = new Date();

  const today9AM = new Date(now);
  today9AM.setHours(9, 0, 0, 0);

  // if it's before 9AM → use yesterday 9AM
  if (now < today9AM) {
    today9AM.setDate(today9AM.getDate() - 1);
  }

  return today9AM;
}

function normalizeToken(token) {
  const map = {
    avalanche: "avalanche-2",
    shib: "shiba-inu",
    doge: "dogecoin"
  };

  return map[token] || token;
}

function getNextRoundTime(minutes) {
  const now = new Date();

  const ms = minutes * 60 * 1000;
  const rounded = Math.ceil(now.getTime() / ms) * ms;

  return new Date(rounded);
}


function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5);
}

const shuffledTokens = shuffle([...TOKENS]);
const shuffledTemplates = shuffle([...QUESTION_TEMPLATES]);

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

function formatDuration(minutes) {
  if (minutes >= 60) {
    const hrs = Math.round(minutes / 60); // round to nearest hour
    return `${hrs}h`;
  }
  return `${minutes}m`;
}

async function createMarket({
  asset,
  question,
  currentPrice,
  targetPrice,
  direction,
  durationMinutes,
  endDate,
  cycleStart   
}) {
  try {
    // 1️⃣ Create conversation first
    const convo = await conversation.create({
      market: null,
      participants: [],
      conv_type: "group"
    });

    if (!convo?._id) {
      throw new Error("Conversation creation failed");
    }

    // 2️⃣ Create base subMarkets (DEFAULT TEMPLATE)
    const baseSubMarkets = [
      {
        question,
        marketType: "CRYPTO",
        outcomes: [
          { label: "Yes", result: false, odds: 2.0, pool: 0, liquidity: 0, volume: 0, count: 0 },
          { label: "No", result: false, odds: 2.0, pool: 0, liquidity: 0, volume: 0, count: 0 }
        ],
        status: "LIVE",
        totalVolume: 0,
        tradeCount: 0
      }
    ];

    // 3️⃣ Create market (MONGO)
    const market = new Market({
      question,
      marketType: "CRYPTO",
      conversationId: convo._id,

      subMarkets: baseSubMarkets,

      metadata: {
        asset,
        startPrice: currentPrice,
        targetPrice,
        assetSymbol: getSymbol(asset),
        direction
      },

      startDate:  cycleStart,
      endDate,
      durationMinutes,
      status: "LIVE"
    });

    const savedMarket = await market.save();

    if (!savedMarket?._id) {
      throw new Error("Market save failed");
    }

    // 4️⃣ Link conversation back to market
    await conversation.findByIdAndUpdate(convo._id, {
      market: savedMarket._id
    });

    const plainMarket = savedMarket.toObject();

    // 5️⃣ FIRESTORE SAFE SUBMARKETS (FULL NORMALIZATION)
    const firestoreSubMarkets = [];

    plainMarket.subMarkets.forEach(sub => {
      const outcomes = (sub.outcomes || []).map(o => ({
        label: o.label || "",
        result: o.result ?? null,
        odds: Number(o.odds ?? 2),
        pool: Number(o.pool ?? 0),
        liquidity: Number(o.liquidity ?? 0),
        volume: Number(o.volume ?? 0),
        count: Number(o.count ?? 0),
      }));

      const totalVolume = outcomes.reduce((a, o) => a + o.volume, 0);
      const tradeCount = outcomes.reduce((a, o) => a + o.count, 0);

      firestoreSubMarkets.push({
        id: sub._id.toString(),
        question: sub.question,
        marketType: sub.marketType,
        status: sub.status,

        outcomes,
        totalVolume,
        tradeCount,
        resolution: sub.resolution || null
      });
    });
    // 6️⃣ FIRESTORE PAYLOAD
    const firestorePayload = {
      id: plainMarket._id.toString(),
      question: plainMarket.question,
      marketType: plainMarket.marketType,

      conversationId: convo._id.toString(),

      metadata: {
        asset: plainMarket.metadata.asset,
        startPrice: plainMarket.metadata.startPrice,
        targetPrice: plainMarket.metadata.targetPrice,
        assetSymbol: plainMarket.metadata.assetSymbol,
        direction: plainMarket.metadata.direction
      },

      currentPrice: plainMarket.metadata.startPrice,
      targetPrice: plainMarket.metadata.targetPrice,
      direction: plainMarket.metadata.direction,

      totalVolume: plainMarket.totalVolume || 0,
      tradeCount: plainMarket.tradeCount || 0,
      status: plainMarket.status,

startDate: cycleStart,
      endDate: plainMarket.endDate.getTime(),
      durationMinutes: plainMarket.durationMinutes,


      subMarkets: firestoreSubMarkets,

      createdAt: Date.now()
    };

    // 7️⃣ SAVE TO FIRESTORE
    await adminDb
      .collection("markets")
      .doc(plainMarket._id.toString())
      .set(firestorePayload);

    return savedMarket;

  } catch (err) {
    console.error("❌ createMarket failed:", err.message);
    throw err;
  }
}

async function generateMarkets() {
  try {
    const directions = ["UP", "DOWN"];
    const jobs = [];

    // 🧠 FIXED DAILY ANCHOR
const cycleStart = getMarketCycleStart();
  const endMap = {
  720: new Date(cycleStart.getTime() + 12 * 60 * 60 * 1000),
  1440: new Date(cycleStart.getTime() + 24 * 60 * 60 * 1000)
};

    for (const durationMinutes of [720, 1440]) {

      const endDate = endMap[durationMinutes];

      for (const asset of shuffledTokens) {
        const currentPrice = getPrice(asset);
        if (!currentPrice) continue;

        for (const direction of directions) {

          let percentMove;

          if (TEST_MODE) {
            percentMove = Math.random() * 0.5 + 0.5;
          } else {
            if (durationMinutes === 720) {
              percentMove = Math.random() * 3 + 1;
            } else {
              percentMove = Math.random() * 5 + 2;
            }
          }

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
              endDate,
              cycleStart   
            })
          );
        }
      }
    }

    const delay = ms => new Promise(res => setTimeout(res, ms));

    for (const job of jobs) {
      await job;
      await delay(200);
    }

    console.log(`🔥 ${jobs.length} markets created (expected: 20)`);
  } catch (err) {
    console.error("❌ Bulk generation failed:", err.message);
  }
}


module.exports = { generateMarkets, TEST_MODE };