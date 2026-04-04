const express = require("express");
const router = express.Router();
const Market = require("../models/Market");
const fetch = require("node-fetch"); // make sure you have node-fetch installed
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Order = require("../models/Order");
const Position = require("../models/Position");
const { adminDb } = require("../lib/firebaseAdmin");



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
    try {
        const { token } = req.params;
        const COIN_SYMBOLS = {
            bitcoin: "BTCUSDT",
            ethereum: "ETHUSDT",
            polkadot: "DOTUSDT",
            avalanche: "AVAXUSDT",
            dogecoin: "DOGEUSDT",
        };

        const symbol = COIN_SYMBOLS[token.toLowerCase()];
        if (!symbol) return res.status(400).json({ error: "Unsupported token" });

        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=1440`;
        const response = await fetch(url);

        if (!response.ok) {
            const text = await response.text();
            console.error("Binance API error:", response.status, text);
            return res.status(response.status).json({ error: "Failed to fetch from Binance" });
        }

        const data = await response.json();
        const prices = data.map((kline) => [kline[0], parseFloat(kline[4])]); // timestamp + close price
        res.json({ prices });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});


router.post("/user_enter_market", async (req, res) => {
  try {
    const { token, marketId, subMarketId, outcome, amount } = req.body;

    if (!token || !marketId || !subMarketId || !outcome || !amount) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const user = await User.findById(userId);
    const market = await Market.findById(marketId);

    if (!user || !market) {
      return res.status(404).json({ error: "User or Market not found" });
    }

    if (user.balance.testnet < amount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    const subMarket = market.subMarkets.id(subMarketId);

    if (!subMarket) {
      return res.status(404).json({ error: "SubMarket not found" });
    }

    const outcomeIndex = subMarket.outcomes.findIndex(
      (o) => o.label === outcome
    );

    if (outcomeIndex === -1) {
      return res.status(400).json({ error: "Invalid outcome" });
    }

    const selectedOutcome = subMarket.outcomes[outcomeIndex];

    // 🔥 Use CURRENT odds to determine price
    const price = 1 / selectedOutcome.odds;

    // 🔒 Lock funds
    user.balance.testnet -= amount;
    user.balance.locked += amount;

    // 📦 Create order
    const order = await Order.create({
      userId,
      marketId,
      subMarketId,
      walletAddress: user.wallet.address || "test-wallet",
      outcome: outcome.toUpperCase(),
      side: "BUY",
      price,
      amount,
      remainingAmount: amount,
      type: "LIMIT",
      status: "OPEN",
    });

    // =========================
    // 🔥 MARKET UPDATE LOGIC
    // =========================

    // 1. Update liquidity
    selectedOutcome.liquidity += amount;

    // 2. Update stats
    selectedOutcome.volume += amount;
    selectedOutcome.count += 1;

    subMarket.totalVolume += amount;
    subMarket.tradeCount += 1;

    market.totalVolume += amount;
    market.tradeCount += 1;

    // 3. Recalculate odds (CORRECT WAY)
    const VIRTUAL_LIQUIDITY = 100;

    const totalLiquidity =
      subMarket.outcomes.reduce((sum, o) => sum + o.liquidity, 0) +
      VIRTUAL_LIQUIDITY * subMarket.outcomes.length;

    subMarket.outcomes.forEach((o) => {
      const adjustedLiquidity = o.liquidity + VIRTUAL_LIQUIDITY;

      const probability = adjustedLiquidity / totalLiquidity;

      let odds = 1 / probability;

      // clamp
      const MIN_ODDS = 1.01;
      const MAX_ODDS = 10;

      odds = Math.min(Math.max(odds, MIN_ODDS), MAX_ODDS);

      o.odds = parseFloat(odds.toFixed(2));
    });

    await market.save();
    await user.save();

    // =========================
    // 🔥 FIRESTORE SYNC
    // =========================

    await adminDb.collection("markets").doc(market._id.toString()).set(
      {
        totalVolume: market.totalVolume,
        tradeCount: market.tradeCount,
        subMarkets: market.subMarkets.map((sub) => ({
          id: sub._id.toString(),
          question: sub.question,
          outcomes: sub.outcomes.map((o) => ({
            _id: o._id.toString(),
            label: o.label,
            liquidity: o.liquidity,
            volume: o.volume,
            count: o.count,
            odds: o.odds,
            result: o.result,
          })),
          totalVolume: sub.totalVolume,
          tradeCount: sub.tradeCount,
          status: sub.status,
        })),
        status: market.status,
        startDate: market.startDate.getTime(),
        endDate: market.endDate.getTime(),
        durationMinutes: market.durationMinutes,
        metadata: market.metadata?.toObject
          ? market.metadata.toObject()
          : market.metadata,
        question: market.question,
        marketType: market.marketType,
      },
      { merge: true }
    );

    // =========================
    // 🔥 MATCH ENGINE
    // =========================

    await matchOrders(marketId, subMarketId, outcome);

    // =========================
    // 🔥 RESPONSE
    // =========================

    const sanitizeUser = (userDoc) => {
      const u = userDoc.toObject ? userDoc.toObject() : { ...userDoc };
      delete u.password;
      delete u.__v;
      return u;
    };

    res.json({
      success: true,
      message: "Order placed",
      order,
      user: sanitizeUser(user),
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const matchOrders = async (marketId, subMarketId, outcome) => {
    const opposite = outcome === "YES" ? "NO" : "YES";

    // Buyers (highest price first)
    const buyOrders = await Order.find({
        marketId,
        subMarketId,
        outcome,
        side: "BUY",
        status: "OPEN"
    }).sort({ price: -1 });

    // Sellers (lowest price first)
    const sellOrders = await Order.find({
        marketId,
        subMarketId,
        outcome: opposite,
        side: "BUY", // opposite side is still "BUY"
        status: "OPEN"
    }).sort({ price: 1 });

    for (let buy of buyOrders) {
        for (let sell of sellOrders) {
            const tradeAmount = Math.min(buy.remainingAmount, sell.remainingAmount);

            // Skip if no possible match
            if (tradeAmount <= 0) continue;

            // Check if prices match (simple example, adjust logic as needed)
            if (buy.price >= sell.price) {

                // Update positions
                await Position.create({
                    userId: buy.userId,
                    marketId,
                    subMarketId,
                    outcome: outcome,
                    shares: tradeAmount / buy.price,
                });

                await Position.create({
                    userId: sell.userId,
                    marketId,
                    subMarketId,
                    outcome: opposite,
                    shares: tradeAmount / sell.price,
                });

                // Create fill
                await Fill.create({
                    buyOrderId: buy._id,
                    sellOrderId: sell._id,
                    price: buy.price,
                    amount: tradeAmount,
                    marketId,
                    subMarketId,
                });

                // Update market stats
                const market = await Market.findById(marketId);
                const subMarket = market.subMarkets.id(subMarketId);

                subMarket.totalVolume += tradeAmount;
                subMarket.tradeCount += 1;

                market.totalVolume += tradeAmount;
                market.tradeCount += 1;

                await market.save();

                // Update orders
                buy.remainingAmount -= tradeAmount;
                sell.remainingAmount -= tradeAmount;

                buy.status = buy.remainingAmount === 0 ? "FILLED" : "PARTIAL";
                sell.status = sell.remainingAmount === 0 ? "FILLED" : "PARTIAL";

                await buy.save();
                await sell.save();

                // Update Firestore
                await adminDb.collection("markets").doc(marketId.toString()).update({
                    totalVolume: market.totalVolume,
                    tradeCount: market.tradeCount,
                    subMarkets: market.subMarkets.map((sub) => ({
                        id: sub._id.toString(),
                        question: sub.question,
                        outcomes: sub.outcomes,
                        tradeCount: sub.tradeCount,
                        totalVolume: sub.totalVolume,
                        status: sub.status,
                    })),
                });
            }
        }
    }
};

module.exports = router;