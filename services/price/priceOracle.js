const axios = require("axios");
const { TOKENS } = require("../../confiq/assets");
const Price = require("../../models/Price");
const PriceSnapshot = require("../../models/PriceSnapshot");

const priceCache = new Map();
const lastSnapshotTime = {};

const ASSETS = TOKENS;

// ===============================
// CONFIG
// ===============================
const MAX_PRICE_AGE = 10 * 60 * 1000; // 10 min freshness
const SNAPSHOT_INTERVAL = 30 * 60 * 1000; // 30 min

// ===============================
// HELPERS
// ===============================
function isFresh(timestamp) {
    return Date.now() - new Date(timestamp).getTime() < MAX_PRICE_AGE;
}

// ===============================
// SNAPSHOT LOGIC
// ===============================
function shouldSnapshot(asset) {
    const now = Date.now();

    if (!lastSnapshotTime[asset]) {
        lastSnapshotTime[asset] = 0;
    }

    return now - lastSnapshotTime[asset] >= SNAPSHOT_INTERVAL;
}

async function saveSnapshot(asset, price) {
    await PriceSnapshot.create({
        asset,
        price,
        timestamp: Date.now()
    });

    lastSnapshotTime[asset] = Date.now();
}

// ===============================
// SAVE LATEST PRICE
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
// COINGECKO
// ===============================
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

        if (typeof price !== "number") {
            throw new Error(`${asset} price missing`);
        }

        priceCache.set(asset, {
            price,
            timestamp: Date.now()
        });

        await saveToMongo(asset, price);

        if (shouldSnapshot(asset)) {
            await saveSnapshot(asset, price);
        }

        console.log(`🟢 ${asset} → $${price}`);
    }

    console.log("🟢 CoinGecko success\n");
    return true;
}

// ===============================
// BINANCE
// ===============================
async function fetchFromBinance() {
    console.log("🟡 Using Binance fallback...");

    const symbolMap = {
        bitcoin: "BTCUSDT",
        ethereum: "ETHUSDT",
        binancecoin: "BNBUSDT",
        solana: "SOLUSDT",
        "avalanche-2": "AVAXUSDT",
        "shiba-inu": "SHIBUSDT",
        dogecoin: "DOGEUSDT",
        pepe: "PEPEUSDT"

    };

    for (const asset of ASSETS) {
        const symbol = symbolMap[asset];
        if (!symbol) continue;

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

            if (shouldSnapshot(asset)) {
                await saveSnapshot(asset, price);
            }

            console.log(`🟡 ${asset} → $${price}`);
        }
    }

    console.log("🟢 Binance success\n");
}

// ===============================
// CRYPTOCOMPARE
// ===============================
async function fetchFromCryptoCompare() {
    console.log("🔴 Using CryptoCompare fallback...");

    const symbolMap = {
        bitcoin: "BTC",
        ethereum: "ETH",
        binancecoin: "BNB",
        solana: "SOL",
        "avalanche-2": "AVAX",
        "shiba-inu": "SHIB",
        dogecoin: "DOGE",
        pepe: "PEPE",
        tether: "USDT"
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

            if (shouldSnapshot(asset)) {
                await saveSnapshot(asset, price);
            }

            console.log(`🔴 ${asset} → $${price}`);
        }
    }

    console.log("🟢 CryptoCompare success\n");
}


async function fetchFXRates() {
    try {
        const res = await axios.get(
            "https://open.er-api.com/v6/latest/USD",
            { timeout: 5000 }
        );

        const ngnRate = res.data?.rates?.NGN;

        if (!ngnRate) throw new Error("NGN rate missing from FX API");

        priceCache.set("usd_ngn", {
            price: ngnRate,
            timestamp: Date.now()
        });

        await saveToMongo("usd_ngn", ngnRate);

        console.log(`🟢 USD → NGN = ${ngnRate}`);

        return ngnRate;
    } catch (err) {
        console.log("⚠️ FX fetch failed:", err.message);

        // fallback (VERY IMPORTANT for production stability)
        const fallback = 1500;

        priceCache.set("usd_ngn", {
            price: fallback,
            timestamp: Date.now()
        });

        await saveToMongo("usd_ngn", fallback);

        console.log(`🟡 USING FALLBACK USD → NGN = ${fallback}`);

        return fallback;
    }
}

// ===============================
// COINCAP
// ===============================
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

            if (shouldSnapshot(asset)) {
                await saveSnapshot(asset, price);
            }

            console.log(`🔴 ${asset} → $${price}`);
        }
    }

    console.log("🟢 CoinCap success\n");
}

// ===============================
// LOAD CACHE
// ===============================
async function loadMongoPrices() {
    const prices = await Price.find({});

    console.log(`📦 Loaded ${prices.length} prices`);

    for (const p of prices) {
        priceCache.set(p.asset, {
            price: p.price,
            timestamp: p.updatedAt
        });
    }
}

// ===============================
// FETCH ORACLE
// ===============================
let requestCount = 0;

async function fetchPrices() {
    requestCount++;
    console.log(`📊 API CALL COUNT: ${requestCount}`);

    await fetchFXRates(); // 👈 ADD THIS FIRST

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
                    console.log("❌ ALL ORACLES FAILED");
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
    await fetchPrices();

    const delay = getDelayToNext5Min();

    console.log(`⏳ First aligned fetch in ${delay / 1000}s`);

    setTimeout(() => {
        fetchPrices();

        setInterval(fetchPrices, 5 * 60 * 1000);
    }, delay);

    console.log("🟢 Oracle READY");
}

// ===============================
// GET PRICE
// ===============================
async function getPrice(asset) {
    const cache = priceCache.get(asset);

    if (cache && isFresh(cache.timestamp)) {
        return cache.price;
    }

    const mongo = await Price.findOne({ asset });

    if (mongo) return mongo.price;

    return null;
}

// ===============================
// 24H CHANGE FUNCTION
// ===============================
async function getPriceChange(asset, currentPrice, minutesAgo) {
    const past = await PriceSnapshot.findOne({
        asset,
        timestamp: {
            $lte: Date.now() - minutesAgo * 60 * 1000
        }
    }).sort({ timestamp: -1 });

    if (!past) return 0;

    return Number(
        (((currentPrice - past.price) / past.price) * 100).toFixed(2)
    );
}

module.exports = {
    startOracle,
    getPrice,
    getPriceChange
};