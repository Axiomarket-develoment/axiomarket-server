const axios = require("axios");
const { TOKENS } = require("../../confiq/assets");
const Price = require("../../models/Price");

const priceCache = new Map();

const ASSETS = TOKENS;

// ⛔ CHANGE: 5 MINUTES ONLY
const INTERVAL = 5 * 60 * 1000;

const MAX_PRICE_AGE = 10 * 60 * 1000; // 10 min freshness

// ===============================
// HELPERS
// ===============================
function isFresh(timestamp) {
    return Date.now() - new Date(timestamp).getTime() < MAX_PRICE_AGE;
}

// ===============================
// LOAD MONGO CACHE
// ===============================
async function loadMongoPrices() {
    const prices = await Price.find({});

    console.log(`📦 Loaded ${prices.length} prices from Mongo`);

    for (const p of prices) {
        priceCache.set(p.asset, {
            price: p.price,
            timestamp: p.updatedAt
        });
    }
}

// ===============================
// SAVE TO MONGO
// ===============================
async function saveToMongo(asset, price) {
    await Price.updateOne(
        { asset },
        {
            $set: {
                price,
                updatedAt: Date.now()
            }
        },
        { upsert: true }
    );
}

// ===============================
// FETCH PRICES (ONLY SOURCE)
// ===============================
let requestCount = 0;

async function fetchPrices() {
    requestCount++;
    console.log(`📊 API CALL COUNT: ${requestCount}`);
        const ids = ASSETS.join(",");

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;

    console.log(`🌐 Fetching prices...`);

    try {
        const res = await axios.get(url, { timeout: 5000 });

        const data = res.data;

        for (const asset of ASSETS) {
            const price = data?.[asset]?.usd;

            if (typeof price === "number") {
                priceCache.set(asset, {
                    price,
                    timestamp: Date.now()
                });

                await saveToMongo(asset, price);

                console.log(`✅ ${asset} → $${price}`);
            }
        }

        console.log("🟢 Oracle update complete\n");

    } catch (err) {
        console.log("❌ Oracle fetch failed:", err.message);
    }
}

// ===============================
// START ORACLE
// ===============================
function getDelayToNext5Min() {
    const now = new Date();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    const next5 = Math.ceil(minutes / 5) * 5;

    const nextRun = new Date(now);
    nextRun.setMinutes(next5);
    nextRun.setSeconds(0);
    nextRun.setMilliseconds(0);

    return nextRun - now;
}

async function startOracle() {
    console.log("🚀 Oracle starting...");

    await loadMongoPrices();
    await fetchPrices(); // first snapshot

    const delay = getDelayToNext5Min();

    console.log(`⏳ First aligned fetch in ${delay / 1000}s`);

    setTimeout(() => {
        fetchPrices();

        // now lock into exact 5-min intervals
        setInterval(fetchPrices, 5 * 60 * 1000);

    }, delay);

    console.log("🟢 Oracle READY");
}

// ===============================
// GET PRICE (NO API CALLS HERE)
// ===============================
async function getPrice(asset) {
    const cache = priceCache.get(asset);

    if (cache && isFresh(cache.timestamp)) {
        return cache.price;
    }

    const mongo = await Price.findOne({ asset });

    if (mongo) {
        return mongo.price;
    }

    return null;
}

module.exports = {
    startOracle,
    getPrice
};