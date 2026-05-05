const axios = require("axios");
const { TOKENS } = require("../../confiq/assets");
const Price = require("../../models/Price");

const priceCache = new Map();
const chartCache = new Map();

const ASSETS = TOKENS;
const INTERVAL = 30000;

// ===============================
// INIT MONGO CACHE ON START
// ===============================
async function loadMongoPrices() {
    const prices = await Price.find({});

    for (const p of prices) {
        priceCache.set(p.asset, {
            price: p.price,
            timestamp: p.updatedAt
        });
    }

    console.log("📦 Mongo prices loaded into cache");
}

// ===============================
// SAVE TO MONGO (SAFE WRITE)
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
    } catch (err) {
        console.log("⚠️ Mongo price save failed:", asset);
    }
}

// ===============================
// UPDATE CACHE (ORACLE → MONGO SYNC)
// ===============================
function updateCache(data) {
    let updated = 0;

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

            // 🔥 also persist to mongo
            saveToMongo(asset, price);

            updated++;
        }
    }

    if (updated === 0) {
        console.log("⚠️ No valid prices — keeping cache + mongo fallback");
        return;
    }

    console.log("📦 Oracle cache updated");
}

// ===============================
// FETCH PRICES (ORACLE)
// ===============================
async function fetchPrices() {
    const coinGeckoMap = {
        bitcoin: "bitcoin",
        // ethereum: "ethereum",
        // binancecoin: "binancecoin",
        // solana: "solana",
        "avalanche-2": "avalanche-2"
    };

    const ids = Object.values(coinGeckoMap).join(",");

    try {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
        const res = await axios.get(url);

        if (!res?.data) return;

        updateCache(res.data);
        console.log("✅ CoinGecko updated");
        return;

    } catch (err) {
        console.log("⚠️ Oracle failed → using old cache + mongo fallback");
    }
}

// ===============================
// START ORACLE
// ===============================
async function startOracle() {
    console.log("🚀 Oracle starting...");

    await loadMongoPrices(); // 👈 important

    try {
        await fetchPrices();
    } catch {}

    setInterval(fetchPrices, INTERVAL);
}

// ===============================
// GET PRICE (HYBRID LOGIC)
// ===============================
async function getPrice(asset) {
    const cache = priceCache.get(asset);

    // 1️⃣ FAST PATH (oracle memory)
    if (cache?.price && !isNaN(cache.price)) {
        return cache.price;
    }

    // 2️⃣ MONGO FALLBACK
    const mongo = await Price.findOne({ asset });

    if (mongo?.price) {
        console.log(`🟡 Mongo fallback used: ${asset}`);
        return mongo.price;
    }

    // 3️⃣ LAST RESORT
    console.log(`❌ No price found anywhere: ${asset}`);
    return null;
}

// ===============================
// SYNTHETIC CHART (UNCHANGED)
// ===============================
function buildSyntheticChart(asset, interval = 300000, limit = 120) {
    const key = `${asset}-${interval}`;

    const cached = chartCache.get(key);
    if (cached && Date.now() - cached.timestamp < interval) {
        return cached.data;
    }

    const priceData = priceCache.get(asset);
    if (!priceData) return [];

    let lastClose = priceData.price;
    const now = Date.now();
    const candles = [];

    for (let i = limit; i >= 0; i--) {
        const open = lastClose;

        const change = (Math.random() - 0.5) * 0.002;
        const close = open * (1 + change);

        candles.push({
            time: now - i * interval,
            open,
            high: Math.max(open, close),
            low: Math.min(open, close),
            close
        });

        lastClose = close;
    }

    chartCache.set(key, {
        data: candles,
        timestamp: Date.now()
    });

    return candles;
}

// ===============================
module.exports = {
    startOracle,
    getPrice,
    buildSyntheticChart
};