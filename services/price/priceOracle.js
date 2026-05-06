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

async function fetchFromCoinGecko() {
    console.log("🟢 Using CoinGecko...");

    const ids = ASSETS.join(",");

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;

    const res = await axios.get(url, { timeout: 5000 });

    if (!res?.data) {
        throw new Error("Invalid CoinGecko response");
    }

    const data = res.data;

    for (const asset of ASSETS) {
        const price = data?.[asset]?.usd;

        // ❌ IMPORTANT: force fallback if any asset missing
        if (typeof price !== "number") {
            throw new Error(`${asset} price missing from CoinGecko`);
        }

        priceCache.set(asset, {
            price,
            timestamp: Date.now()
        });

        await saveToMongo(asset, price);

        console.log(`🟢 ${asset} → $${price}`);
    }

    console.log("🟢 CoinGecko success\n");

    return true; // ✅ REQUIRED for fallback chain
}

async function fetchFromBinance() {
    console.log("🟡 Using Binance fallback...");

    for (const asset of ASSETS) {
        const symbolMap = {
            bitcoin: "BTCUSDT",
            ethereum: "ETHUSDT",
            binancecoin: "BNBUSDT",
            solana: "SOLUSDT",
            "avalanche-2": "AVAXUSDT"
        };

        const symbol = symbolMap[asset];

        const res = await axios.get(
            `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`
        );

        const price = Number(res.data.price);

        if (price) {
            priceCache.set(asset, {
                price,
                timestamp: Date.now()
            });

            await saveToMongo(asset, price);

            console.log(`🟡 ${asset} → $${price}`);
        }
    }

    console.log("🟢 Binance fallback success\n");
}


async function fetchFromCryptoCompare() {
    console.log("🔴 Using CryptoCompare fallback...");

    const symbolMap = {
        bitcoin: "BTC",
        ethereum: "ETH",
        binancecoin: "BNB",
        solana: "SOL",
        "avalanche-2": "AVAX"
    };

    const symbols = Object.values(symbolMap).join(",");

    const url = `https://min-api.cryptocompare.com/data/pricemulti?fsyms=${symbols}&tsyms=USD`;

    const res = await axios.get(url);

    const data = res.data;

    for (const asset of ASSETS) {
        const symbol = symbolMap[asset];

        const price = data?.[symbol]?.USD;

        if (price) {
            priceCache.set(asset, {
                price,
                timestamp: Date.now()
            });

            await saveToMongo(asset, price);

            console.log(`🔴 ${asset} → $${price}`);
        }
    }

    console.log("🟢 CryptoCompare success\n");
}

async function fetchFromCoinCap() {
    console.log("🔴 Using CoinCap fallback...");

    const res = await axios.get("https://api.coincap.io/v2/assets");

    const data = res.data.data;

    for (const asset of ASSETS) {
        const found = data.find(a => a.id === asset);

        if (found) {
            const price = Number(found.priceUsd);

            priceCache.set(asset, {
                price,
                timestamp: Date.now()
            });

            await saveToMongo(asset, price);

            console.log(`🔴 ${asset} → $${price}`);
        }
    }

    console.log("🟢 CoinCap fallback success\n");
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

    try {
        return await fetchFromCoinGecko();
    } catch (err) {
        console.log("⚠️ CoinGecko failed:", err.message);

        try {
            return await fetchFromBinance();
        } catch (err2) {
            console.log("⚠️ Binance failed:", err2.message);

            try {
                return await fetchFromCryptoCompare();
            } catch (err3) {
                console.log("⚠️ CryptoCompare failed:", err3.message);

                try {
                    return await fetchFromCoinCap();
                } catch (err4) {
                    console.log("❌ ALL 4 ORACLES FAILED");
                }
            }
        }
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