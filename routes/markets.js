const express = require("express");
const router = express.Router();
const Market = require("../models/Market");
const fetch = require("node-fetch"); // make sure you have node-fetch installed
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Order = require("../models/Order");
const Position = require("../models/Position");
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
    const symbol = TOKEN_CHART_SYMBOLS[token.toLowerCase()];

    try {
        if (!symbol) {
            return res.status(400).json({ error: `No chart available for token: ${token}` });
        }

        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=5m&limit=2016`;
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0",
            },
        });

        if (!response.ok) {
            const text = await response.text();
            console.error("Binance API error:", response.status, text);
            return res.status(response.status).json({ error: "Failed to fetch from Binance" });
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            return res.status(500).json({ error: "Invalid data from Binance" });
        }

        const prices = data.map((kline) => [
            kline[0],
            parseFloat(kline[4]),
        ]);

        return res.json({ prices });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
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

        // 🔹 Round user balances
        user.balance.testnet = Number(user.balance.testnet.toFixed(2));
        user.balance.locked = Number(user.balance.locked.toFixed(2));

        await user.save();
        await market.save();

        // 🔹 Sync updated market to Firestore
        const marketDoc = adminDb.collection("markets").doc(market._id.toString());
        await marketDoc.update({
            subMarkets: market.subMarkets.map(sub => ({
                id: sub._id.toString(),
                question: sub.question || null,
                outcomes: sub.outcomes.map(o => ({
                    label: o.label || null,
                    pool: o.pool || 0,
                    count: o.count || 0,
                    odds: o.odds || 2.0,
                    result: o.result ?? null,
                    volume: o.volume || 0,
                    liquidity: o.liquidity || 0
                })),
                tradeCount: sub.tradeCount || 0,
                totalVolume: sub.totalVolume || 0,
                status: sub.status || "LIVE",
                targetPrice: sub.targetPrice ?? null
            })),
            totalVolume: market.totalVolume || 0,
            tradeCount: market.tradeCount || 0,
            status: market.status || "LIVE"
        });

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