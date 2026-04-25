const axios = require("axios");
const { TOKENS } = require("../../confiq/assets");

const priceCache = new Map();
const chartCache = new Map();

const ASSETS = TOKENS;

const INTERVAL = 30000; // 15 seconds

// ===============================
// CHART BUILDER
// ===============================
function buildSyntheticChart(asset, interval = 300000, limit = 120) {
    const key = `${asset}-${interval}`;

    const cached = chartCache.get(key);

    if (cached && Date.now() - cached.timestamp < interval) {
        return cached.data;
    }

    const priceData = priceCache.get(asset);
    if (!priceData) return [];

    const now = Date.now();
    const candles = [];

    let lastClose = priceData.price;

    for (let i = limit; i >= 0; i--) {
        const time = now - i * interval;

        const open = lastClose;

        const change = (Math.random() - 0.5) * 0.002;
        const close = open * (1 + change);

        const high = Math.max(open, close);
        const low = Math.min(open, close);

        candles.push({
            time,
            open,
            high,
            low,
            close
        });

        lastClose = close;
    }

    const result = {
        data: candles,
        timestamp: Date.now()
    };

    chartCache.set(key, result);

    return candles;
}

// ===============================
// SAFE CACHE UPDATE (FIXED)
// ===============================
function updateCache(data) {
    let updated = 0;

    for (const asset of ASSETS) {
        const price = data?.[asset]?.usd;

        if (typeof price === "number" && !isNaN(price)) {
            priceCache.set(asset, {
                price,
                timestamp: Date.now()
            });
            updated++;
        } else {
            console.log(`⚠️ Missing price for ${asset}`);
        }
    }

    // 🔥 IMPORTANT FIX: prevent silent overwrite of good cache
    if (updated === 0) {
        console.log("⚠️ No valid prices received — keeping old cache");
        return;
    }

    console.log("📦 Cache updated size:", priceCache.size);
}

// ===============================
// FETCH PRICES
// ===============================
async function fetchPrices() {
    const ids = ASSETS.join(",");

    // =======================
    // 🟢 COINGECKO PRIMARY
    // =======================
    try {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
        const res = await axios.get(url);

        if (!res?.data || Object.keys(res.data).length === 0) {
            console.log("⚠️ CoinGecko returned empty response — skipping");
            return;
        }

        updateCache(res.data);
        console.log("✅ CoinGecko updated");
        return;

    } catch (err) {
        console.log("⚠️ CoinGecko failed, trying CoinPaprika...");
    }

    // =======================
    // 🟡 COINPAPRIKA FALLBACK
    // =======================
    try {
        const paprikaMap = {
            bitcoin: "btc-bitcoin",
            // ethereum: "eth-ethereum",
            // solana: "sol-solana",
            // binancecoin: "bnb-binance-coin",
            "avalanche-2": "avax-avalanche",
            // dogecoin: "doge-dogecoin",
        };

        const prices = {};

        for (const asset of ASSETS) {
            const id = paprikaMap[asset];
            if (!id) continue;

            const res = await axios.get(`https://api.coinpaprika.com/v1/tickers/${id}`);

            prices[asset] = {
                usd: res?.data?.quotes?.USD?.price
            };
        }

        updateCache(prices);
        console.log("✅ CoinPaprika updated");
        return;

    } catch (err) {
        console.log("⚠️ CoinPaprika failed, trying CryptoCompare...");
    }

    // =======================
    // 🔵 CRYPTOCOMPARE FALLBACK
    // =======================
    try {
        const symbolMap = {
            bitcoin: "BTC",
       
            "avalanche-2": "AVAX",
        
        };

        const prices = {};

        for (const asset of ASSETS) {
            const symbol = symbolMap[asset];
            if (!symbol) continue;

            const res = await axios.get(
                `https://min-api.cryptocompare.com/data/price?fsym=${symbol}&tsyms=USD`
            );

            prices[asset] = {
                usd: res?.data?.USD
            };
        }

        updateCache(prices);
        console.log("✅ CryptoCompare updated");
        return;

    } catch (err) {
        console.log("❌ All providers failed:", err.message);
    }
}

// ===============================
// ORACLE START
// ===============================
async function startOracle() {
    console.log("🚀 Oracle started");

    try {
        await fetchPrices();
    } catch (e) {
        console.log("Initial fetch failed, retrying...");
    }

    setInterval(fetchPrices, INTERVAL);
}

// ===============================
// GET PRICE (SAFE)
// ===============================
function getPrice(asset) {
    const data = priceCache.get(asset);

    if (!data || typeof data.price !== "number") {
        console.log(`❌ Cache miss: ${asset}`);
        return null;
    }

    const age = Date.now() - data.timestamp;

    if (age > 120000) {
        console.log(`⚠️ Stale price: ${asset}`);
    }

    return data.price;
}

// ===============================
module.exports = {
    startOracle,
    getPrice,
    buildSyntheticChart
};