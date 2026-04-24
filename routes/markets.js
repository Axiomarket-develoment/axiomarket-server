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

        // ⚡ MINIMAL READS ONLY
        const [user, market] = await Promise.all([
            User.findById(userId).select("balance"),
            Market.findById(marketId)
        ]);

        if (!user || !market) {
            return res.status(404).json({ error: "Invalid data" });
        }

        const subMarket = market.subMarkets.id(subMarketId);

        if (!subMarket) {
            return res.status(404).json({ error: "SubMarket not found" });
        }

        if (user.balance.testnet < amount) {
            return res.status(400).json({ error: "Insufficient balance" });
        }

        // 🔒 LOCK FUNDS
        user.balance.testnet -= amount;
        user.balance.locked += amount;

        // 🎯 SELECT OUTCOME
        const selectedOutcome = subMarket.outcomes.find(
            o => o.label.toLowerCase() === outcome.toLowerCase()
        );

        if (!selectedOutcome) {
            return res.status(400).json({ error: "Invalid outcome" });
        }

        // 📊 UPDATE OUTCOME DATA (UNCHANGED LOGIC)
        selectedOutcome.pool += amount;
        selectedOutcome.count += 1;
        selectedOutcome.volume += amount;
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

            const flexibleIndexes = adjusted
                .map((p, i) => (p > MIN_PERCENT ? i : -1))
                .filter(i => i !== -1);

            let flexibleSum = flexibleIndexes.reduce((a, i) => a + adjusted[i], 0);

            for (let i of flexibleIndexes) {
                const share = adjusted[i] / flexibleSum;
                adjusted[i] -= share * excess;
            }
        }

        // 4. normalize again
        const finalSum = adjusted.reduce((a, b) => a + b, 0);
        adjusted = adjusted.map(p => (p / finalSum) * 100);

        // 5. assign percentages
        subMarket.outcomes.forEach((o, i) => {
            o.percentage = Number(adjusted[i].toFixed(2));
        });



        // 📌 UPDATE STATS
        subMarket.tradeCount += 1;
        subMarket.totalVolume += amount;

        market.tradeCount = (market.tradeCount || 0) + 1;
        market.totalVolume = (market.totalVolume || 0) + amount;

        // 💾 POSITION
        const position = await Position.create({
            userId,
            marketId,
            subMarketId,
            outcome,
            amount
        });

        // 💾 SAVE MONGO (ONLY 2 WRITES)
        await Promise.all([
            user.save(),
            market.save()
        ]);

        // ⚡ FIRESTORE OPTIMIZED UPDATE (NO FULL MARKET REWRITE)

        const index = market.subMarkets.findIndex(
            sm => sm.id === subMarketId
        );

        const updatePath = `subMarkets.${index}`;

        const marketRef = adminDb.collection("markets").doc(marketId);
        const subRefPath = `subMarkets.${subMarketId}`;

        await marketRef.set({
            totalVolume: market.totalVolume,
            tradeCount: market.tradeCount,

            // only update THIS subMarket snapshot
            [subRefPath]: {
                id: subMarketId,
                question: subMarket.question,

                tradeCount: subMarket.tradeCount,
                totalVolume: subMarket.totalVolume,

                outcomes: subMarket.outcomes.map(o => ({
                    label: o.label,
                    pool: o.pool,
                    count: o.count,
                    volume: o.volume,
                    liquidity: o.liquidity,
                    percentage: o.percentage
                }))
            }
        }, { merge: true });

        // 👤 USER SYNC (unchanged)
        await syncUserBalance(user);

        return res.json({
            success: true,
            message: "User entered market successfully",
            positionId: position._id,
            amount: Number(amount.toFixed(2)),
            balance: {
                testnet: user.balance.testnet,
                locked: user.balance.locked
            }
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