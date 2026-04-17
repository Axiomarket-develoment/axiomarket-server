const axios = require("axios");
const { TOKENS } = require("../../confiq/assets");

const priceCache = new Map();
const chartCache = new Map();

const ASSETS = TOKENS;

const INTERVAL = 15000; // 15 seconds

function buildSyntheticChart(asset, interval = 300000, limit = 200) {
    const prices = priceCache.get(asset);

    if (!prices) return [];

    const now = Date.now();

    const candles = [];

    let last = prices.price;

    for (let i = limit; i >= 0; i--) {
        const time = now - i * interval;

        // simulate small volatility around oracle price
        const variation = (Math.random() - 0.5) * 0.002; // 0.2%
        const price = last * (1 + variation);

        candles.push([time, Number(price.toFixed(6))]);

        last = price;
    }

    return candles;
}


function updateCache(data) {
    for (const asset of ASSETS) {
        const price = data?.[asset]?.usd;

        if (typeof price === "number") {
            priceCache.set(asset, {
                price,
                timestamp: Date.now()
            });
        } else {
            console.log(`⚠️ Missing price for ${asset}`);
        }
    }

    console.log("📦 Cache updated size:", priceCache.size);
}

async function fetchPrices() {
    const ids = ASSETS.join(",");

    try {
        // 🟢 PRIMARY: CoinGecko
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
        const res = await axios.get(url);

        updateCache(res.data);
        console.log("✅ CoinGecko updated");
        return;

    } catch (err) {
        console.log("⚠️ CoinGecko failed, trying CoinPaprika...");
    }

    try {
        // 🟡 FALLBACK 1: CoinPaprika
        const paprikaMap = {
            bitcoin: "btc-bitcoin",
            ethereum: "eth-ethereum",
            solana: "sol-solana",
            binancecoin: "bnb-binance-coin",
            "avalanche-2": "avax-avalanche",
            dogecoin: "doge-dogecoin",
        };

        const prices = {};

        for (const asset of ASSETS) {
            const id = paprikaMap[asset];
            if (!id) continue;

            const res = await axios.get(`https://api.coinpaprika.com/v1/tickers/${id}`);
            prices[asset] = { usd: res.data.quotes.USD.price };
        }

        updateCache(prices);
        console.log("✅ CoinPaprika updated");
        return;

    } catch (err) {
        console.log("⚠️ CoinPaprika failed, trying CryptoCompare...");
    }

    try {
        // 🔵 FALLBACK 2: CryptoCompare
        const symbolMap = {
            bitcoin: "BTC",
            ethereum: "ETH",
            solana: "SOL",
            binancecoin: "BNB",
            "avalanche-2": "AVAX",
            dogecoin: "DOGE",
            "shiba-inu": "SHIB"
        };

        const prices = {};

        for (const asset of ASSETS) {
            const symbol = symbolMap[asset];
            if (!symbol) continue;

            const res = await axios.get(
                `https://min-api.cryptocompare.com/data/price?fsym=${symbol}&tsyms=USD`
            );

            prices[asset] = { usd: res.data.USD };
        }

        updateCache(prices);
        console.log("✅ CryptoCompare updated");
        return;

    } catch (err) {
        console.log("❌ All providers failed:", err.message);
    }
}

async function startOracle() {
    console.log("🚀 Oracle started");

    try {
        await fetchPrices(); // IMPORTANT: wait for first success
    } catch (e) {
        console.log("Initial fetch failed, retrying...");
    }

    setInterval(fetchPrices, INTERVAL);
}

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
module.exports = {
    startOracle,
    getPrice
};