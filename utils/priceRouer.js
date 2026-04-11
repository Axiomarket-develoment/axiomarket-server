const { fetchCoinGeckoPrice } = require("../services/price/coingeckoPrices");

// simple cache to prevent 429
const priceCache = {};
const CACHE_DURATION = 30 * 1000; // 30 seconds

async function getUnifiedPrice(asset) {
    console.log(`🔄 Getting price for ${asset}...`);

    const now = Date.now();

    // 1️⃣ Return cached price if fresh
    if (
        priceCache[asset] &&
        now - priceCache[asset].timestamp < CACHE_DURATION
    ) {
        return {
            price: priceCache[asset].price,
            source: "CACHE",
        };
    }

    try {
        // 2️⃣ Fetch from CoinGecko
        const price = await fetchCoinGeckoPrice(asset);

        if (!price) {
            throw new Error("Invalid price response");
        }

        // 3️⃣ Save to cache
        priceCache[asset] = {
            price,
            timestamp: now,
        };

        console.log(`✅ Price from CoinGecko: ${price}`);

        return {
            price,
            source: "COINGECKO",
        };

    } catch (err) {
        console.warn(`⚠️ CoinGecko failed for ${asset}:`, err.message);

        // 4️⃣ fallback to cached price if exists
        if (priceCache[asset]) {
            console.warn("⚠️ Using stale cached price");
            return {
                price: priceCache[asset].price,
                source: "STALE_CACHE",
            };
        }

        throw new Error(`❌ Could not fetch price for ${asset}`);
    }
}

module.exports = { getUnifiedPrice };