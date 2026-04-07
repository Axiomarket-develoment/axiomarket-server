const { QUESTION_TEMPLATES } = require("../../confiq/questionTemplate");
const Market = require("../../models/Market");
const { getUnifiedPrice } = require("../../utils/priceRouer");
const mongoose = require("mongoose");
const { adminDb } = require("../../lib/firebaseAdmin"); // ✅ correct
const conversation = require("../../models/conversation");
const { SUPPORTED_ASSETS } = require("../../utils/constants");


// console.log("SUPPORTED_ASSETS:", SUPPORTED_ASSETS);

// ✅ Set this to true to enable test mode
const TEST_MODE = true;

function getDirectionWord(direction) {
  return direction === "UP" ? "up" : "down";
}

function formatDuration(minutes) {
  if (minutes >= 60) {
    const hrs = Math.round(minutes / 60); // round to nearest hour
    return `${hrs}h`;
  }
  return `${minutes}m`;
}

async function generateRandomMarket() {
  try {
    const now = new Date();

    // Skip if too many live markets
    const liveCount = await Market.countDocuments({ status: "LIVE" });
    if (liveCount >= 5) return;

    // Pick random asset
    const asset =
      SUPPORTED_ASSETS[Math.floor(Math.random() * SUPPORTED_ASSETS.length)];

    // Get price
    const { price: currentPrice } = await getUnifiedPrice(asset);

    // ✅ Determine a dynamic end time
    let minDurationMinutes, maxDurationMinutes;

    if (TEST_MODE) {
      // For testing: 3-6 minutes
      minDurationMinutes = 2;
      maxDurationMinutes = 3;
    } else {
      // Normal flow: 5m quick, 1h normal
      const isQuickMarket = Math.random() < 0.33;
      minDurationMinutes = isQuickMarket ? 5 : 60;
      maxDurationMinutes = isQuickMarket ? 40 : 24 * 60;
    }

    const durationMinutes =
      Math.floor(Math.random() * (maxDurationMinutes - minDurationMinutes + 1)) +
      minDurationMinutes;

    const endDate = new Date(now.getTime() + durationMinutes * 60000);

    // Determine market direction and target price
    const direction = Math.random() > 0.5 ? "UP" : "DOWN";
    let percentMove;

    if (TEST_MODE) {
      percentMove = Math.random() * 0.05 + 0.01; // 0.1% → 0.6%
    } else {
      percentMove = Math.random() * 2 + 0.2; // 0.2% → 2.2%
    }
    let targetPrice =
      direction === "UP"
        ? currentPrice * (1 + percentMove / 100)
        : currentPrice * (1 - percentMove / 100);

    targetPrice =
      currentPrice < 1
        ? Number(targetPrice.toFixed(8))
        : Number(targetPrice.toFixed(2));

    // Pick a question template
    const SHORT_TERM_TEMPLATES = QUESTION_TEMPLATES.filter(
      (q) =>
        q.includes("{duration}") ||
        q.includes("{percent}") ||
        q.includes("{directionWord}")
    );

    const template =
      SHORT_TERM_TEMPLATES[
      Math.floor(Math.random() * SHORT_TERM_TEMPLATES.length)
      ];

    // Replace placeholders dynamically
    const question = template
      .replace("{asset}", asset)
      .replace("{directionWord}", getDirectionWord(direction))
      .replace("{duration}", formatDuration(durationMinutes))
      .replace("{percent}", percentMove.toFixed(2))
      .replace("{target}", targetPrice)
      .replace(
        "{endTime}",
        endDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );

    // ✅ CREATE MARKET
    const market = new Market({
      question,
      marketType: "CRYPTO",
      subMarkets: [
        {
          question,
          marketType: "CRYPTO",
          outcomes: [
            { label: "Yes", result: false, odds: 2.0, liquidity: 0, volume: 0, count: 0 },
            { label: "No", result: false, odds: 2.0, liquidity: 0, volume: 0, count: 0 },
          ],
          tradeCount: 0,
          totalVolume: 0,
          status: "LIVE",
          resolution: {
            method: "MANUAL",
            source: "SYSTEM",
            value: null,
          },
        },
      ],
      metadata: {
        asset,
        assetLogo: null,
        chartImage: null,
        startPrice: currentPrice,
        targetPrice,
        direction,
      },
      startDate: now,
      endDate,
      durationMinutes,
      status: "LIVE",
    });

    const savedMarket = await market.save();
    // console.log(`🔥 Market Created: ${question}`);

    const convo = await conversation.create({
      market: savedMarket._id,
      participants: [],
      conv_type: "group"
    })

    savedMarket.conversationId = convo._id
    await savedMarket.save()

    // 🔥 Push to Firebase
    await adminDb
      .collection("markets")
      .doc(savedMarket._id.toString())
      .set({
        id: savedMarket._id.toString(),
        question: savedMarket.question,
        marketType: savedMarket.marketType,

        conversationId: convo._id.toString(),

        metadata: JSON.parse(JSON.stringify(savedMarket.metadata)),
        currentPrice: savedMarket.metadata.startPrice,
        targetPrice: savedMarket.metadata.targetPrice,
        direction: savedMarket.metadata.direction,
        totalVolume: savedMarket.totalVolume,
        tradeCount: savedMarket.tradeCount,
        status: savedMarket.status,
        startDate: savedMarket.startDate.getTime(),
        endDate: savedMarket.endDate.getTime(),
        durationMinutes: savedMarket.durationMinutes,
        subMarkets: savedMarket.subMarkets.map((sub) =>
          JSON.parse(
            JSON.stringify({
              id: sub._id.toString(),
              question: sub.question,
              outcomes: sub.outcomes,
              tradeCount: sub.tradeCount,
              totalVolume: sub.totalVolume,
              status: sub.status,
            })
          )
        ),
        createdAt: Date.now(),
      });
    // console.log("⚡ Synced to Firebase");

    return savedMarket;
  } catch (err) {
    console.error("❌ Market generation failed:", err);
  }
}

module.exports = { generateRandomMarket, TEST_MODE };