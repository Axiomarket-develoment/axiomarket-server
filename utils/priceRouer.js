
const { fetchBinancePrice } = require("../services/price/binancePrice");
const { fetchCoinGeckoPrice } = require("../services/price/coingeckoPrices");
const { PRICE_FEEDS } = require("./oracle");

async function getUnifiedPrice(asset) {
    console.log(`🔄 Getting price for ${asset}...`);



    // 2️⃣ Try Binance
    try {
        const price = await fetchBinancePrice(asset);
        if (price) {
            console.log("✅ Price from Binance");
            return { price, source: "BINANCE" };
        }
    } catch (err) {
        console.warn("⚠️ Binance failed, falling back...");
    }

    // 3️⃣ Try CoinGecko
    try {
        const price = await fetchCoinGeckoPrice(asset);
        if (price) {
            console.log("✅ Price from CoinGecko");
            return { price, source: "COINGECKO" };
        }
    } catch (err) {
        console.warn("⚠️ CoinGecko failed...");
    }

    // 1️⃣ Try Chainlink (if feed exists)
    if (PRICE_FEEDS[asset]) {
        try {
            const price = await fetchCurrentPrice(asset);
            if (price) {
                console.log("✅ Price from Chainlink");
                return { price, source: "CHAINLINK" };
            }
        } catch (err) {
            console.warn("⚠️ Chainlink failed, falling back...");
        }
    }

    throw new Error(`❌ Could not fetch price for ${asset}`);
}

module.exports = { getUnifiedPrice };