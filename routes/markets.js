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

    console.log("📊 Incoming chart request:", { token, interval });

    const symbolMap = {
        bitcoin: "BTC",
        ethereum: "ETH",
        solana: "SOL",
        binancecoin: "BNB",
        "avalanche-2": "AVAX",
        dogecoin: "DOGE",
        "shiba-inu": "SHIB",
    };

    const symbol = symbolMap[token?.toLowerCase()];

    console.log("🔎 Resolved symbol:", symbol);

    if (!symbol) {
        console.warn("❌ Unsupported token:", token);
        return res.status(400).json({ error: "Unsupported token" });
    }

    const intervalMap = {
        "1m": { endpoint: "histominute", aggregate: 1, limit: 200 },
        "5m": { endpoint: "histominute", aggregate: 5, limit: 200 },
        "15m": { endpoint: "histominute", aggregate: 15, limit: 200 },
        "1h": { endpoint: "histohour", aggregate: 1, limit: 200 },
        "1d": { endpoint: "histoday", aggregate: 1, limit: 200 },
        "1w": { endpoint: "histoday", aggregate: 7, limit: 200 },
        "max": { endpoint: "histoday", aggregate: 30, limit: 200 },
    };

    const config = intervalMap[interval] || intervalMap["5m"];

    const url = `https://min-api.cryptocompare.com/data/v2/${config.endpoint}?fsym=${symbol}&tsym=USD&limit=${config.limit}&aggregate=${config.aggregate}`;

    console.log("🌐 Request URL:", url);

    try {
        const response = await axios.get(url);

        console.log("📦 FULL API RESPONSE:", JSON.stringify(response.data).slice(0, 500));

        // 🔴 Handle API-level error
        if (response.data.Response === "Error") {
            console.error("❌ CryptoCompare error:", response.data.Message);
            return res.json({
                source: "cryptocompare",
                interval,
                candles: [],
            });
        }

        const rawData = response.data?.Data?.Data;

        if (!Array.isArray(rawData)) {
            console.error("❌ Invalid data format:", response.data);
            return res.json({
                source: "cryptocompare",
                interval,
                candles: [],
            });
        }

        console.log("📊 Raw candles count:", rawData.length);

        // 🔥 Filter bad candles (zeros)
        const candles = rawData
            .filter(c => c && c.close && c.close !== 0)
            .map(c => ({
                time: c.time * 1000,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
            }));

        console.log("✅ Clean candles count:", candles.length);

        if (candles.length === 0) {
            console.warn("⚠️ No valid candles after filtering");
        }

        return res.json({
            source: "cryptocompare",
            interval,
            candles,
        });

    } catch (err) {
        console.error("❌ Chart error FULL:", {
            message: err.message,
            status: err.response?.status,
            data: err.response?.data,
        });

        return res.status(500).json({
            error: "Chart fetch failed",
            details: err.response?.data || err.message,
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