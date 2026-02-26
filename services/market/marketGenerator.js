// server/services/marketGenerator.js
const { SUPPORTED_ASSETS } = require("../../config/assets");
const { QUESTION_TEMPLATES } = require("../../config/questionTemplate");
const Market = require("../../models/Market");
const { getUnifiedPrice } = require("../../utils/priceRouer");



function getDirectionWord(direction) {
  return direction === "UP" ? "up" : "down";
}

async function generateRandomMarket() {
  try {
    const now = new Date();

    console.log("⏱ Current time:", now);

    // Skip if too many live markets
    const liveCount = await Market.countDocuments({ status: "LIVE" });
    console.log("👀 Current live markets:", liveCount);
    if (liveCount >= 5) {
      console.log("⚠️ Too many live markets. Skipping generation.");
      return;
    }

    // Pick a random asset
    const asset = SUPPORTED_ASSETS[Math.floor(Math.random() * SUPPORTED_ASSETS.length)];
    console.log("💹 Selected asset:", asset);


    // Get current price
    const { price: currentPrice, source } = await getUnifiedPrice(asset);

    console.log(`💲 Current price of ${asset}: $${currentPrice} (source: ${source})`);
    // Random duration
    const durationMinutes = 5;
    console.log("🕒 Duration:", durationMinutes, "minutes");

    // Random direction
    const direction = Math.random() > 0.5 ? "UP" : "DOWN";
    console.log("🔀 Direction:", direction);

    // Random percent move 1-5%

    // Calculate target price
    const percentMove = Math.random() * 10; // 0–10%
    console.log("📈 Percent move:", percentMove);
    let targetPrice = direction === "UP"
      ? currentPrice * (1 + percentMove / 100)
      : currentPrice * (1 - percentMove / 100);


    if (currentPrice < 1) {
      targetPrice = Number(targetPrice.toFixed(8));
    } else {
      targetPrice = Number(targetPrice.toFixed(2));
    } console.log("🎯 Target price:", targetPrice);

    // End time
    const endDate = new Date(now.getTime() + durationMinutes * 60000);
    const endTime = endDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    console.log("⏰ End date/time:", endDate);

    // Random question template
    const template = QUESTION_TEMPLATES[Math.floor(Math.random() * QUESTION_TEMPLATES.length)];
    const question = template
      .replace("{asset}", asset)
      .replace("{directionWord}", getDirectionWord(direction))
      .replace("{duration}", durationMinutes)
      .replace("{percent}", percentMove)
      .replace("{target}", targetPrice)
      .replace("{endTime}", endTime);
    console.log("📝 Generated question:", question);

    // Create market
    const market = new Market({
      question,
      asset,
      startPrice: currentPrice,
      targetPrice,
      direction,
      startDate: now,
      endDate,
      durationMinutes,
      resolutionSource: source,
      status: "LIVE"
    });

    await market.save();
    console.log(`🔥 Market Created: ${question}`);

  } catch (err) {
    console.error("❌ Market generation failed:", err.message);
  }
}

module.exports = { generateRandomMarket };