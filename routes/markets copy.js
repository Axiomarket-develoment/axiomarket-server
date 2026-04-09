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

        console.log("userID", userId);
        console.log("BODY:", req.body);
        console.log("TOKEN:", token);

        const user = await User.findById(userId);
        const market = await Market.findById(marketId);
        const subMarket = market.subMarkets.id(subMarketId);

        console.log("user:", user?._id);
        console.log("market:", market?._id);
        console.log("subMarketId:", subMarketId);
        console.log("subMarkets:", market?.subMarkets.map(s => s._id.toString()));

        if (!user || !market || !subMarket) {
            return res.status(404).json({ error: "Invalid data" });
        }

        console.log("marketId from request:", marketId);
        console.log("market found:", market);

        if (user.balance.testnet < amount) {
            return res.status(400).json({ error: "Insufficient balance" });
        }

        const selectedOutcome = subMarket.outcomes.find(o => o.label === outcome);
        if (!selectedOutcome) {
            return res.status(400).json({ error: "Invalid outcome" });
        }

        const price = 1 / selectedOutcome.odds;

        // 🔒 Lock funds
        user.balance.testnet -= amount;
        user.balance.locked += amount;

        // ✅ Normalize
        let normalizedOutcome = "YES";
        let side = "BUY";

        if (outcome.toUpperCase() === "NO") {
            normalizedOutcome = "YES";
            side = "SELL";
        }

        const order = await Order.create({
            userId,
            marketId,
            subMarketId,
            outcome: normalizedOutcome,
            side,
            price,
            amount,
            remainingAmount: amount,
            filledAmount: 0,
            status: "OPEN",
        });

        await user.save();
        await syncUserBalance(user)

        // 🔥 Save order to Firestore (LIVE tracking)
        await adminDb.collection("orders").doc(order._id.toString()).set({
            userId,
            marketId,
            subMarketId,
            side,
            price,
            amount,
            remainingAmount: amount,
            filledAmount: 0,
            status: "OPEN",
            createdAt: Date.now()
        });

        // 🔥 MATCH
        await matchOrders(marketId, subMarketId);

        res.json({ success: true, order, user });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

const matchOrders = async (marketId, subMarketId) => {
    // Fetch market and subMarket
    const market = await Market.findById(marketId);
    const subMarket = market.subMarkets.id(subMarketId);

    // Fetch open buy and sell orders
    const buyOrders = await Order.find({
        marketId,
        subMarketId,
        outcome: "YES",
        side: "BUY",
        status: { $in: ["OPEN", "PARTIAL"] },
    }).sort({ price: -1, createdAt: 1 });

    const sellOrders = await Order.find({
        marketId,
        subMarketId,
        outcome: "YES",
        side: "SELL",
        status: { $in: ["OPEN", "PARTIAL"] },
    }).sort({ price: 1, createdAt: 1 });


    const yesOutcome = subMarket.outcomes.find(
        o => o.label.toUpperCase() === "YES"
    );

    const noOutcome = subMarket.outcomes.find(
        o => o.label.toUpperCase() === "NO"
    );

    // initialize if first time
    if (!yesOutcome.odds) yesOutcome.odds = 2.0;
    if (!noOutcome.odds) noOutcome.odds = 2.0;


    // Match orders
    for (let buy of buyOrders) {
        if (buy.remainingAmount <= 0) continue;

        for (let sell of sellOrders) {
            if (sell.remainingAmount <= 0) continue;
            if (buy.price < sell.price) continue;

            // Determine matched amount
            const tradeAmount = Math.min(buy.remainingAmount, sell.remainingAmount);
            const shares = tradeAmount;

            // Create positions
            await Position.create({
                userId: buy.userId,
                marketId,
                subMarketId,
                outcome: "YES",
                shares,
            });

            await Position.create({
                userId: sell.userId,
                marketId,
                subMarketId,
                outcome: "NO",
                shares,
            });

            // Create fill record
            await Fill.create({
                buyOrderId: buy._id,
                sellOrderId: sell._id,
                price: buy.price,
                amount: tradeAmount,
                marketId,
                subMarketId,
            });

            // Update order amounts
            buy.remainingAmount -= tradeAmount;
            sell.remainingAmount -= tradeAmount;

            buy.filledAmount += tradeAmount;
            sell.filledAmount += tradeAmount;

            buy.status = buy.remainingAmount === 0 ? "FILLED" : "PARTIAL";
            sell.status = sell.remainingAmount === 0 ? "FILLED" : "PARTIAL";


            // console.log("Matching buy", buy._id, "price", buy.price, "remaining", buy.remainingAmount);
            // console.log("Against sell", sell._id, "price", sell.price, "remaining", sell.remainingAmount);


            await buy.save();
            await sell.save();

            const buyUser = await User.findById(buy.userId);
            const sellUser = await User.findById(sell.userId);

            if (buyUser) await syncUserBalance(buyUser);
            if (sellUser) await syncUserBalance(sellUser);

            console.log("TradeAmount:", tradeAmount);

            // Firestore live update
            await adminDb.collection("orders").doc(buy._id.toString()).set({
                remainingAmount: buy.remainingAmount,
                filledAmount: buy.filledAmount,
                status: buy.status,
            }, { merge: true });
            await adminDb.collection("orders").doc(sell._id.toString()).update({
                remainingAmount: sell.remainingAmount,
                filledAmount: sell.filledAmount,
                status: sell.status,
            }, { merge: true });

            // Update volumes
            // After each matched trade
            subMarket.totalVolume += tradeAmount;
            subMarket.tradeCount += 1;

            market.totalVolume += tradeAmount;
            market.tradeCount += 1;

            // If subMarket is a Mongoose subdocument, mark it modified
            market.markModified('subMarkets');

            // Update outcome volume/count
            yesOutcome.volume += tradeAmount;
            yesOutcome.count += 1;
            noOutcome.volume += tradeAmount;
            noOutcome.count += 1;

            // Save Mongoose market
            await market.save();

            // Update Firestore
            await adminDb.collection("markets").doc(marketId.toString()).update({
                totalVolume: market.totalVolume,
                tradeCount: market.tradeCount,
                subMarkets: market.subMarkets.map((sub) => ({
                    id: sub._id.toString(),
                    question: sub.question,
                    lastPrice: sub.lastPrice,
                    outcomes: sub.outcomes.map(o => ({
                        label: o.label,
                        odds: o.odds,
                        liquidity: o.liquidity,
                        volume: o.volume,
                        count: o.count
                    })),
                    tradeCount: sub.tradeCount,
                    totalVolume: sub.totalVolume,
                    status: sub.status,
                }))
            });

            // Break if buy is fully filled
            if (buy.remainingAmount === 0) break;
        }
    }


    // ✅ STEP-BASED ODDS SYSTEM
    const round2 = (num) => Math.round(num * 100) / 100;


    const STEP = 0.1;
    const MIN_ODDS = 1.0;
    const MAX_ODDS = 3.0;



    // determine what user did
    // we use LAST order to adjust odds
    const lastOrder = await Order.findOne({ marketId, subMarketId })
        .sort({ createdAt: -1 });

    if (lastOrder) {
        if (lastOrder.side === "BUY") {
            yesOutcome.odds = round2(Math.max(MIN_ODDS, yesOutcome.odds - STEP));
            noOutcome.odds = round2(Math.min(MAX_ODDS, noOutcome.odds + STEP));
        } else {
            yesOutcome.odds = round2(Math.min(MAX_ODDS, yesOutcome.odds + STEP));
            noOutcome.odds = round2(Math.max(MIN_ODDS, noOutcome.odds - STEP));
        }
    }

    // For lastPrice, show probability or decimal price
    subMarket.lastPrice = round2(1 / yesOutcome.odds);
    await market.save();

    // Firestore sync
    await adminDb.collection("markets").doc(marketId.toString()).update({
        totalVolume: market.totalVolume,
        tradeCount: market.tradeCount,
        subMarkets: market.subMarkets.map((sub) => ({
            id: sub._id.toString(),
            question: sub.question,
            lastPrice: sub.lastPrice,
            outcomes: sub.outcomes.map(o => ({
                label: o.label,
                odds: o.odds,
                liquidity: o.liquidity,
                volume: o.volume,
                count: o.count
            })),
            tradeCount: sub.tradeCount,
            totalVolume: sub.totalVolume,
            status: sub.status,
        }))
    });
};

module.exports = router;