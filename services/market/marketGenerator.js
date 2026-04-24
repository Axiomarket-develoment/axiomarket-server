const { QUESTION_TEMPLATES } = require("../../confiq/questionTemplate");
const Market = require("../../models/Market");
const mongoose = require("mongoose");
const { adminDb } = require("../../lib/firebaseAdmin"); // ✅ correct
const conversation = require("../../models/conversation");
const { TOKENS } = require("../../confiq/assets");
const { getPrice } = require("../price/priceOracle");


// console.log("SUPPORTED_ASSETS:", SUPPORTED_ASSETS);

// ✅ Set this to true to enable test mode
const TEST_MODE = true;

function getDirectionWord(direction) {
  return direction === "UP" ? "up" : "down";
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
  endDate
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

      startDate: new Date(endDate.getTime() - durationMinutes * 60000),
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
    const firestoreSubMarkets = {};

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

      firestoreSubMarkets[sub._id.toString()] = {
        id: sub._id.toString(),
        question: sub.question,
        marketType: sub.marketType,
        status: sub.status,

        outcomes,
        totalVolume,
        tradeCount,
        resolution: sub.resolution || null
      };
    });

    // 6️⃣ FIRESTORE PAYLOAD
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


async function generateMarkets(durationMinutes) {
  try {
    const now = new Date();
    const endDate = getNextRoundTime(durationMinutes);

    const MAX_MARKETS = 5;
    let count = 0;

    const jobs = [];

    for (const asset of shuffledTokens) {
      const currentPrice = getPrice(asset);

      if (!currentPrice) continue;

      for (const template of shuffledTemplates) {
        if (count >= MAX_MARKETS) break;

        const direction = Math.random() > 0.5 ? "UP" : "DOWN";

        const percentMove = TEST_MODE
          ? Math.random() * 0.1 + 0.5
          : Math.random() * 2 + 0.2;

        let targetPrice =
          direction === "UP"
            ? currentPrice * (1 + percentMove / 100)
            : currentPrice * (1 - percentMove / 100);

        targetPrice =
          currentPrice < 1
            ? Number(targetPrice.toFixed(8))
            : Number(targetPrice.toFixed(2));

        const question = template
          .replace("{asset}", asset)
          .replace("{assetSymbol}", getSymbol(asset))
          .replace("{directionWord}", getDirectionWord(direction))
          .replace("{duration}", formatDuration(durationMinutes))
          .replace("{percent}", percentMove.toFixed(2))
          .replace("{target}", targetPrice)
          .replace(
            "{endTime}",
            endDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          );

        jobs.push(createMarket({
          asset,
          question,
          currentPrice,
          targetPrice,
          direction,
          durationMinutes,
          endDate
        }));

        count++;
      }
    }

    const delay = ms => new Promise(res => setTimeout(res, ms));

    // 🚀 RUN ALL AT ONCE
    for (const job of jobs) {
      await job;
      await delay(200); // add this
    }


    console.log(`🔥 ${jobs.length} markets created at same time`);
  } catch (err) {
    console.error("❌ Bulk generation failed:", err.message);
  }
}




module.exports = { generateMarkets, TEST_MODE };