const { SUPPORTED_ASSETS } = require("../../confiq/assets");
const { QUESTION_TEMPLATES } = require("../../confiq/questionTemplate");
const Market = require("../../models/Market");
const { getUnifiedPrice } = require("../../utils/priceRouer");

function getDirectionWord(direction) {
  return direction === "UP" ? "up" : "down";
}

async function generateRandomMarket() {
  try {
    const now = new Date();

    // Skip if too many live markets
    const liveCount = await Market.countDocuments({ status: "LIVE" });
    if (liveCount >= 5) return;

    // Pick a random crypto asset
    const cryptoAssets = SUPPORTED_ASSETS.filter(a => a.type === "CRYPTO");
    const assetObj = cryptoAssets[Math.floor(Math.random() * cryptoAssets.length)];
    const asset = assetObj.symbol;

    // Get current price
    const { price: currentPrice, source } = await getUnifiedPrice(asset);

    const durationMinutes = 5;
    const direction = Math.random() > 0.5 ? "UP" : "DOWN";
    const percentMove = Math.random() * 10;
    let targetPrice = direction === "UP"
      ? currentPrice * (1 + percentMove / 100)
      : currentPrice * (1 - percentMove / 100);

    targetPrice = currentPrice < 1 ? Number(targetPrice.toFixed(8)) : Number(targetPrice.toFixed(2));
    const endDate = new Date(now.getTime() + durationMinutes * 60000);

    const template = QUESTION_TEMPLATES[Math.floor(Math.random() * QUESTION_TEMPLATES.length)];
    const question = template
      .replace("{asset}", asset)
      .replace("{directionWord}", getDirectionWord(direction))
      .replace("{duration}", durationMinutes)
      .replace("{percent}", percentMove)
      .replace("{target}", targetPrice)
      .replace("{endTime}", endDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));

    // Create subMarket
    const subMarket = {
      question,
      marketType: "CRYPTO",
      outcomes: [
        { label: "Yes", result: null },
        { label: "No", result: null }
      ],
      totalVolume: 0,
      tradeCount: 0,
      status: "LIVE"
    };

    // Create market
    const market = new Market({
      question,
      marketType: "CRYPTO",
      subMarkets: [subMarket],
      metadata: {
        asset,
        startPrice: currentPrice,
        targetPrice,
        direction,
        assetLogo: assetObj.logo || "/img/market/coinlogo.png",
        chartImage: assetObj.chart || "/img/market/coinchart.png"
      },
      startDate: now,
      endDate,
      durationMinutes,
      status: "LIVE"
    });

    await market.save();
    console.log(`🔥 Market Created: ${question}`);

  } catch (err) {
    console.error("❌ Market generation failed:", err);
  }
}

module.exports = { generateRandomMarket };