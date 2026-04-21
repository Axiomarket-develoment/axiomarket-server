const express = require("express");
const router = express.Router();
const Market = require("../models/Market");
const fetch = require("node-fetch"); // make sure you have node-fetch installed
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Order = require("../models/Order");
const Position = require("../models/Position");
const axios = require("axios")
const { adminDb } = require("../lib/firebaseAdmin");
const Fill = require("../models/Fill");
const { TOKEN_CHART_SYMBOLS } = require("../confiq/assets");
const syncUserBalance = require("../functions/syncUserBalance");


async function fetchBinance(symbol, interval) {
    try {
        const map = {
            "1m": "1m",
            "5m": "5m",
            "15m": "15m",
            "1h": "1h",
            "1d": "1d",
        };

        const binanceInterval = map[interval] || "5m";

        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=${binanceInterval}&limit=200`;

        console.log("🌐 Binance URL:", url);

        const res = await axios.get(url);

        return res.data.map(c => ({
            time: c[0],
            open: parseFloat(c[1]),
            high: parseFloat(c[2]),
            low: parseFloat(c[3]),
            close: parseFloat(c[4]),
        }));

    } catch (e) {
        console.log("❌ Binance ERROR:", e.message);
        return null;
    }
}



async function fetchCryptoCompare(symbol, interval, limit, aggregate) {
    try {

        console.log("📌 CryptoCompare params:", {
            symbol,
            interval,
            limit,
            aggregate
        });

        if (!limit || !aggregate) {
            console.log("❌ INVALID PARAMS → skipping CryptoCompare");
            return null;
        }

        const url = `https://min-api.cryptocompare.com/data/v2/histominute?fsym=${symbol}&tsym=USD&limit=${limit}&aggregate=${aggregate}`;

        console.log("🌐 CryptoCompare URL:", url);

        const res = await axios.get(url);

        if (res.data.Response !== "Success") {
            console.log("❌ CryptoCompare FAILED:", res.data.Message);
            return null;
        }

        return res.data.Data.Data.map(c => ({
            time: c.time * 1000,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close
        }));

    } catch (e) {
        console.log("❌ CryptoCompare ERROR:", e.message);
        return null;
    }
}

async function fetchCoinAPI(symbol) {
    try {
        const url = `https://rest.coinapi.io/v1/ohlcv/${symbol}/USD/latest?period_id=5MIN&limit=100`;

        console.log("🌐 CoinAPI URL:", url);

        const res = await axios.get(url, {
            headers: {
                "X-CoinAPI-Key": process.env.COINAPI_KEY
            }
        });

        console.log("📦 CoinAPI SUCCESS");

        return res.data.map(c => ({
            time: new Date(c.time_period_start).getTime(),
            open: c.price_open,
            high: c.price_high,
            low: c.price_low,
            close: c.price_close
        }));

    } catch (e) {
        console.log("❌ CoinAPI ERROR:", e.response?.data || e.message);
        return null;
    }
}


async function fetchTwelveData(symbol) {
    try {
        const url = `https://api.twelvedata.com/time_series?symbol=${symbol}/USD&interval=5min&outputsize=100&apikey=${process.env.TWELVEDATA_KEY}`;

        const res = await axios.get(url);

        if (!res.data.values) return null;

        return res.data.values.reverse().map(c => ({
            time: new Date(c.datetime).getTime(),
            open: parseFloat(c.open),
            high: parseFloat(c.high),
            low: parseFloat(c.low),
            close: parseFloat(c.close)
        }));

    } catch (e) {
        return null;
    }
}

async function getCandles(symbol, interval) {
    console.log("📊 getCandles called:", { symbol, interval });

    let result = null;
    let source = "none";

    // 1. BINANCE (PRIMARY)
    result = await fetchBinance(symbol, interval);
    console.log("🟡 Binance result:", result ? "SUCCESS" : "FAIL");

    if (result) source = "binance";

    // 2. CryptoCompare
    if (!result) {
        const configMap = {
            "1m": { limit: 200, aggregate: 1 },
            "5m": { limit: 200, aggregate: 5 },
            "15m": { limit: 200, aggregate: 15 },
            "1h": { limit: 200, aggregate: 60 },
        };

        const config = configMap[interval] || configMap["5m"];

        console.log("⚙️ CryptoCompare config:", config);

        result = await fetchCryptoCompare(
            symbol,
            interval,
            config.limit,
            config.aggregate
        );

        console.log("🟡 CryptoCompare result:", result ? "SUCCESS" : "FAIL");

        if (result) source = "cryptocompare";
    }

    // 3. CoinAPI
    if (!result) {
        result = await fetchCoinAPI(symbol);
        console.log("🟡 CoinAPI result:", result ? "SUCCESS" : "FAIL");

        if (result) source = "coinapi";
    }

    // 4. TwelveData
    if (!result) {
        result = await fetchTwelveData(symbol);
        console.log("🟡 TwelveData result:", result ? "SUCCESS" : "FAIL");

        if (result) source = "twelvedata";
    }

    console.log("📊 FINAL SOURCE:", source);
    console.log("📊 FINAL CANDLES:", result?.length || 0);

    return {
        candles: result || [],
        source
    };
}


// Create market manually (for now)
router.post("/create", async (req, res) => {
    try {
        const { question, durationMinutes, resolutionSource } = req.body;

        const duration = Number(durationMinutes);

        if (!question || !duration || duration <= 0) {
            return res.status(400).json({
                error: "Valid question and durationMinutes are required",
            });
        }

        const startDate = new Date();
        const endDate = new Date(startDate.getTime() + duration * 60000);

        const market = new Market({
            question,
            outcomes: ["YES", "NO"],
            startDate,
            endDate,
            durationMinutes,
            resolutionSource: resolutionSource || "CHAINLINK_AVAX_USD",
            status: "LIVE",
            result: null,
            liquidity: { yes: 0, no: 0 },
        });

        await market.save();

        res.status(201).json(market);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Get all markets
router.get("/markets", async (req, res) => {
    const markets = await Market.find().sort({ createdAt: -1 });
    res.json(markets);
});

// Existing routes...

/**
 * GET /market/chart/:token
 * Fetches 1-day minute interval price chart for a token from CoinGecko
 * Example: /market/chart/polkadot
 */
router.get("/chart/:token", async (req, res) => {
    const { token } = req.params;
    const { interval = "5m" } = req.query;

    console.log("🚀 CHART REQUEST:", { token, interval });

    const symbolMap = {
        bitcoin: "BTC",
        ethereum: "ETH",
        solana: "SOL",
        binancecoin: "BNB",
        dogecoin: "DOGE",
    };

    const symbol = symbolMap[token?.toLowerCase()];

    if (!symbol) {
        console.log("❌ INVALID TOKEN:", token);
        return res.status(400).json({ error: "Unsupported token" });
    }

    try {
        const { candles, source } = await getCandles(symbol, interval);

        console.log("📦 RESPONSE SUMMARY:");
        console.log("source:", source);
        console.log("candles:", candles.length);

        return res.json({
            source,
            interval,
            candles
        });

    } catch (err) {
        console.log("❌ ROUTE ERROR:", err.message);

        return res.json({
            source: "error",
            candles: []
        });
    }
});


router.post("/user_enter_market", async (req, res) => {
    try {
        const { token, marketId, subMarketId, outcome, amount } = req.body;

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;


        const user = await User.findById(userId).select("-password");
        const market = await Market.findById(marketId);
        const subMarket = market?.subMarkets.id(subMarketId);

        // console.log("UserId" , userId)
        // console.log("UserId" , subMarket)
        // console.log("UserId" , market)
        if (!user || !market || !subMarket) {
            return res.status(404).json({ error: "Invalid data" });
        }

        if (user.balance.testnet < amount) {
            return res.status(400).json({ error: true, msg: "Insufficient balance" });
        }

        // 🔒 Lock funds
        user.balance.testnet -= amount;
        user.balance.locked += amount;

        // ✅ Update selected outcome
        const selectedOutcome = subMarket.outcomes.find(
            o => o.label.toLowerCase() === outcome.toLowerCase()
        );
        if (!selectedOutcome) return res.status(400).json({ error: "Invalid outcome" });

        selectedOutcome.pool += amount;
        selectedOutcome.count += 1;
        selectedOutcome.volume += amount;      // ✅ ADD THIS
        selectedOutcome.liquidity += amount;

        const totalPool = subMarket.outcomes.reduce((a, o) => a + o.pool, 0);

        const MIN_PERCENT = 20;

        // 1. raw percentages
        let raw = subMarket.outcomes.map(o =>
            totalPool === 0 ? 50 : (o.pool / totalPool) * 100
        );

        // 2. apply minimum floor
        let adjusted = raw.map(p => Math.max(p, MIN_PERCENT));

        // 3. fix overflow if sum > 100
        let sum = adjusted.reduce((a, b) => a + b, 0);

        if (sum > 100) {
            const excess = sum - 100;

            // only reduce those above MIN_PERCENT
            const flexibleIndexes = adjusted
                .map((p, i) => (p > MIN_PERCENT ? i : -1))
                .filter(i => i !== -1);

            let flexibleSum = flexibleIndexes.reduce((a, i) => a + adjusted[i], 0);

            for (let i of flexibleIndexes) {
                const share = adjusted[i] / flexibleSum;
                adjusted[i] -= share * excess;
            }
        }

        // 4. fix floating errors → normalize again
        const finalSum = adjusted.reduce((a, b) => a + b, 0);
        adjusted = adjusted.map(p => (p / finalSum) * 100);

        // 5. assign
        subMarket.outcomes.forEach((o, i) => {
            o.percentage = Number(adjusted[i].toFixed(2));
        });

        // ✅ Save position
        const position = await Position.create({
            userId,
            marketId,
            subMarketId,
            outcome,
            amount
        });

        // Update subMarket stats
        subMarket.tradeCount += 1;
        subMarket.totalVolume += amount;

        market.tradeCount = (market.tradeCount || 0) + 1;   // ✅ ADD
        market.totalVolume = (market.totalVolume || 0) + amount; // ✅ ADD

        // 🔹 Round user balances
        user.balance.testnet = Number(user.balance.testnet.toFixed(2));
        user.balance.locked = Number(user.balance.locked.toFixed(2));

        await user.save();
        await market.save();

        // 🔹 Sync updated market to Firestore
        const marketDoc = adminDb.collection("markets").doc(market._id.toString());
        await marketDoc.set({
            subMarkets: market.subMarkets.map(sub => ({
                id: sub._id.toString(),
                question: sub.question || null,
                outcomes: sub.outcomes.map(o => ({
                    label: o.label,
                    pool: Number(o.pool || 0),
                    count: Number(o.count || 0),
                    odds: Number(o.odds || 2),
                    volume: Number(o.volume || 0),
                    liquidity: Number(o.liquidity || 0),
                    result: o.result ?? null,
                    percentage: Number(o.percentage || 50)
                })),
                tradeCount: sub.tradeCount || 0,
                totalVolume: sub.totalVolume || 0,
                status: sub.status || "LIVE",
            })),
            totalVolume: market.totalVolume || 0,
            tradeCount: market.tradeCount || 0,
            status: market.status || "LIVE"
        }, { merge: true });

        // 🔹 **Sync user balance to Firestore**
        await syncUserBalance(user);

        // 🔹 Return full user data without password
        res.json({
            success: true,
            message: "User entered market successfully",
            user, // full user object, no password
            market: {
                id: market._id,
                subMarketId: subMarket._id,
                outcomes: subMarket.outcomes.reduce((acc, o) => {
                    acc[o.label] = { pool: o.pool, count: o.count };
                    return acc;
                }, {}),
                totalPool: subMarket.outcomes.reduce((a, o) => a + o.pool, 0),
                totalCount: subMarket.outcomes.reduce((a, o) => a + o.count, 0)
            },
            positionId: position._id,
            amount: Number(amount.toFixed(2))
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.post("/save_market", async (req, res) => {
    try {
        const { token, marketId, action } = req.body; // action = "save" | "unsave"
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        // MongoDB
        user.savedMarket = action === "save" ? marketId : null;
        await user.save();

        // Firestore
        const userDoc = adminDb.collection("users").doc(user._id.toString());
        const userSnap = await userDoc.get();
        if (userSnap.exists) {
            let savedMarkets = userSnap.data().savedMarkets || [];
            if (action === "save" && !savedMarkets.includes(marketId)) {
                savedMarkets.push(marketId);
            } else if (action === "unsave") {
                savedMarkets = savedMarkets.filter(id => id !== marketId);
            }
            await userDoc.update({ savedMarkets });
        }

        res.json({ success: true, action, savedMarket: user.savedMarket });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});


module.exports = router;