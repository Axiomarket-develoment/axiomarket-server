const { QUESTION_TEMPLATES } = require("../../confiq/questionTemplate");
const Market = require("../../models/Market");
const mongoose = require("mongoose");
// const { adminDb } = require("../../lib/firebaseAdmin"); // ✅ correct
const conversation = require("../../models/conversation");
const { TOKENS } = require("../../confiq/assets");
const { getPrice } = require("../price/priceOracle");
const { get12hCycleTimes } = require("../marketTiming/12hCycle");
const { get24hCycleTimes } = require("../marketTiming/24hCycle");
const { get5mCycleTimes } = require("../marketTiming/5mCycle");
const { get1hCycleTimes } = require("../marketTiming/1hrCycle");

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
  cycleStart,
  startDate,
}) {

  const exists = await Market.findOne({
    "metadata.asset": asset,
    durationMinutes,
    startDate
  });

  if (exists) {
    console.log(`⏭ Skipping ${asset} (${durationMinutes}) — already exists`);
    return null;
  }

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

      startDate,
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

    return savedMarket;

  } catch (err) {
    console.error("❌ createMarket failed:", err.message);
    throw err;
  }
}

async function generateMarkets({ durationMinutes }) {
  try {
    const jobs = [];

    const cycleTimes =
      durationMinutes === 5 ? get5mCycleTimes() : get5mCycleTimes()


    // : durationMinutes === 720
    //   ? get12hCycleTimes()
    //   : get24hCycleTimes();

    const { startDate, endDate } = cycleTimes;

    for (const asset of shuffledTokens) {
      const currentPrice = await getPrice(asset);

      if (!currentPrice) {
        console.log(`❌ No price for asset: ${asset}`);
        continue;
      }

      let percentMove;
      if (TEST_MODE) {
        percentMove = Math.random() * 0.02 + 0.01; // 0.01% → 0.03%
      } else {
        if (durationMinutes === 5) {
          percentMove = Math.random() * 0.04 + 0.01; // 🔥 0.01% → 0.05%
        }
        else if (durationMinutes === 60) {
          percentMove = Math.random() * 0.08 + 0.02; // 0.02% → 0.10%
        }
        else if (durationMinutes === 720) {
          percentMove = Math.random() * 0.15 + 0.05; // 0.05% → 0.20%
        }
        else {
          percentMove = Math.random() * 0.25 + 0.08; // 0.08% → 0.33%
        }
      }

      const targetPriceRaw =
        currentPrice * (1 + percentMove / 100);

      const targetPrice =
        currentPrice < 1
          ? Number(targetPriceRaw.toFixed(8))
          : Number(targetPriceRaw.toFixed(2));

      const question = `Will ${getSymbol(asset)} be above $${targetPrice} in ${formatDuration(durationMinutes)}?`;

      jobs.push(
        createMarket({
          asset,
          question,
          currentPrice,
          targetPrice,
          direction: "UP",
          durationMinutes,
          endDate,
          startDate
        })
      );
    }

    const delay = (ms) => new Promise((res) => setTimeout(res, ms));

    const results = [];

    for (const job of jobs) {
      const res = await job;
      if (res) results.push(res);
      await delay(200);
    }

    console.log(`🔥 ${results.length} markets created`);
    console.log(`📊 Expected jobs: ${jobs.length}`);
  } catch (err) {
    console.error("❌ Bulk generation failed:", err.message);
  }
}


module.exports = { generateMarkets, TEST_MODE };