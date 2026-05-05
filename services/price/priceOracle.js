const axios = require("axios");
const { TOKENS } = require("../../confiq/assets");
const Price = require("../../models/Price");

const priceCache = new Map();

const ASSETS = TOKENS;
const INTERVAL = 30000;
const MAX_PRICE_AGE = 60_000;

let oracleReady = false;

// ===============================
// HELPERS
// ===============================
function isFresh(timestamp) {
    return Date.now() - new Date(timestamp).getTime() < MAX_PRICE_AGE;
}

// ===============================
// INIT MONGO CACHE ON START
// ===============================
async function loadMongoPrices() {
    const prices = await Price.find({});

    console.log(`📦 Loading ${prices.length} prices from Mongo...`);

    for (const p of prices) {
        priceCache.set(p.asset, {
            price: p.price,
            timestamp: p.updatedAt
        });

        const age = Date.now() - new Date(p.updatedAt).getTime();

        console.log(
            `🟡 Mongo preload: ${p.asset} → $${p.price} (age: ${age}ms)`
        );
    }

    console.log("📦 Mongo prices loaded into cache\n");
}

// ===============================
// SAVE TO MONGO
// ===============================
async function saveToMongo(asset, price) {
    try {
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

        console.log(`💾 Saved to Mongo: ${asset} → $${price}`);
    } catch (err) {
        console.log(`⚠️ Mongo save failed for ${asset}:`, err.message);
    }
}

// ===============================
// UPDATE CACHE
// ===============================
function updateCache(data) {
    let updated = 0;

    console.log("🧠 Processing oracle response...");

    for (const asset of ASSETS) {
        const raw = data?.[asset];

        const price =
            raw?.usd ??
            raw?.USD ??
            raw;

        if (typeof price === "number" && !isNaN(price)) {
            priceCache.set(asset, {
                price,
                timestamp: Date.now()
            });

            console.log(`✅ Cache update: ${asset} → $${price}`);

            const existing = priceCache.get(asset);

            if (!existing || existing.price !== price) {
                saveToMongo(asset, price);
            }
            updated++;
        } else {
            console.log(`⚠️ Missing/invalid price: ${asset}`, raw);
        }
    }

    console.log(`📊 Updated ${updated}/${ASSETS.length} assets`);

    if (updated > 0) {
        oracleReady = true;
        console.log("🟢 Oracle is READY\n");
    } else {
        console.log("⚠️ No valid prices received\n");
    }
}

// ===============================
// FETCH PRICES
// ===============================
async function fetchPrices() {
    const coinGeckoMap = {
        bitcoin: "bitcoin",
        ethereum: "ethereum",
        binancecoin: "binancecoin",
        solana: "solana",
        "avalanche-2": "avalanche-2"
    };


    const ids = Object.values(coinGeckoMap).join(",");

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;

    console.log(`🌐 Fetching prices: ${ids}`);

    try {
        const res = await axios.get(url, { timeout: 5000 });

        if (!res?.data) {
            console.log("⚠️ Empty response from API\n");
            return;
        }

        console.log("📡 API Response:", JSON.stringify(res.data));

        updateCache(res.data);

        console.log("✅ CoinGecko fetch success\n");

    } catch (err) {
        console.log("❌ Oracle error:", err.message, "\n");
    }
}

// ===============================
// START ORACLE
// ===============================
async function startOracle() {
    console.log("🚀 Oracle starting...\n");

    await loadMongoPrices();

    try {
        await fetchPrices();
    } catch { }

    setInterval(fetchPrices, INTERVAL);
}

// ===============================
// GET PRICE
// ===============================
async function getPrice(asset) {
    console.log(`🔍 Getting price for: ${asset}`);

    const cache = priceCache.get(asset);

    // CACHE CHECK
    if (cache?.price) {
        const age = Date.now() - cache.timestamp;

        console.log(`🧪 Cache hit: ${asset} → $${cache.price} (age: ${age}ms)`);

        if (isFresh(cache.timestamp)) {
            console.log(`✅ Using fresh cache: ${asset}\n`);
            return cache.price;
        } else {
            console.log(`⚠️ Cache stale: ${asset} (age: ${age}ms)`);
        }
    } else {
        console.log(`❌ No cache entry: ${asset}`);
    }

    // MONGO CHECK
    const mongo = await Price.findOne({ asset });

    if (mongo?.price) {
        const age = Date.now() - new Date(mongo.updatedAt).getTime();

        console.log(`🟡 Mongo hit: ${asset} → $${mongo.price} (age: ${age}ms)`);

        if (isFresh(mongo.updatedAt)) {
            console.log(`✅ Using fresh mongo: ${asset}\n`);
            return mongo.price;
        } else {
            console.log(`⚠️ Mongo stale: ${asset} (age: ${age}ms)`);
        }
    } else {
        console.log(`❌ No mongo entry: ${asset}`);
    }

    console.log(`⛔ FINAL BLOCK: No valid price for ${asset}\n`);
    return null;
}

// ===============================
module.exports = {
    startOracle,
    getPrice
};