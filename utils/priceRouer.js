
const { fetchBinancePrice } = require("../services/price/binancePrice");
const { fetchCoinGeckoPrice } = require("../services/price/coingeckoPrices");
const { PRICE_FEEDS } = require("./priceFeeds");

async function getUnifiedPrice(asset, fetchCurrentPriceFn) {
    console.log(`🔄 Getting price for ${asset}...`);

    // 1️⃣ Try Binance
    try {
        const price = await fetchBinancePrice(asset);
        if (price) {
            console.log(`✅ Price from Binance: ${price}`);
            return { price, source: "BINANCE" };
        }
    } catch (err) {
        console.warn("⚠️ Binance failed, falling back...");
    }

    // 2️⃣ Try CoinGecko
    try {
        const price = await fetchCoinGeckoPrice(asset);
        if (price) {
            // console.log(`✅ Price from CoinGecko: ${price}`);
            return { price, source: "COINGECKO" };
        }
    } catch (err) {
        console.warn("⚠️ CoinGecko failed...");
    }

    // 3️⃣ Try Chainlink (if feed exists)
    if (PRICE_FEEDS[asset]) {
        try {
            const price = await fetchCurrentPriceFn(asset);
            if (price) {
                // console.log(`✅ Price from Chainlink: ${price}`);
                return { price, source: "CHAINLINK" };
            }
        } catch (err) {
            console.warn("⚠️ Chainlink failed, falling back...");
        }
    }

    throw new Error(`❌ Could not fetch price for ${asset}`);
}

module.exports = { getUnifiedPrice };