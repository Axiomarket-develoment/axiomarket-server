const express = require("express");
const router = express.Router();
const Market = require("../models/Market");
const fetch = require("node-fetch"); // make sure you have node-fetch installed
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Order = require("../models/Order");
const Position = require("../models/Position");
const axios = require("axios")
// const { adminDb } = require("../lib/firebaseAdmin");
const Fill = require("../models/Fill");
const { TOKEN_CHART_SYMBOLS } = require("../confiq/assets");
const syncUserBalance = require("../functions/syncUserBalance");
const Ambassador = require("../models/Ambassador");
const Stats = require("../models/Stats");
const { getPrice } = require("../services/price/priceOracle");
const Conversation = require("../models/conversation");





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

// Get all active markets (exclude settled)
router.get("/markets", async (req, res) => {
    try {
        const markets = await Market.find({
            status: { $ne: "SETTLED" },
        }).sort({ createdAt: -1 });

        res.json(markets);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch markets" });
    }
});


router.post("/user_enter_market", async (req, res) => {
    try {
        const { token, marketId, subMarketId, outcome, amount } = req.body;

        if (!token || !marketId || !subMarketId || !outcome || !amount) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id || decoded.userId || decoded._id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Invalid authentication token"
            });
        }

        const [user, market] = await Promise.all([
            User.findById(userId).select("balance email avaxBalance"),
            Market.findById(marketId)
        ]);

        if (!user || !market) {
            return res.status(404).json({
                success: false,
                message: "User or market not found"
            });
        }

        const WHITELISTED_EMAILS = [
            "admin@example.com",
            "derik0x0x@gmail.com",
            "danieldaudu65@gmail.com"
        ];

        const isAmbassador = await Ambassador.findOne({
            $or: [{ user: userId }, { email: user.email }]
        });

        const isWhitelisted = WHITELISTED_EMAILS.includes(
            user.email.toLowerCase()
        );

        if (!isAmbassador && !isWhitelisted) {
            return res.status(403).json({
                success: false,
                message: "Access denied: ambassadors only"
            });
        }

        const avaxPrice = await getPrice("avalanche-2");

        if (!avaxPrice) {
            return res.status(500).json({
                message: "Price service failed"
            });
        }

        const avaxAmount = Number(amount);
        const usdAmount = avaxAmount * avaxPrice;

        const fee = usdAmount * 0.05;
        const netUsd = usdAmount - fee;

        const roundTo2 = (num) => Math.floor(num * 100) / 100;

        if (netUsd <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid trade amount"
            });
        }

        if (user.balance.testnet < usdAmount) {
            return res.status(400).json({
                success: false,
                message: "Insufficient balance"
            });
        }

        const subMarket = market.subMarkets.id(subMarketId);

        if (!subMarket) {
            return res.status(404).json({
                success: false,
                message: "Sub-market not found"
            });
        }

        // ======================
        // BALANCE UPDATE (FIXED)
        // ======================
        user.balance.testnet -= usdAmount;
        user.balance.locked += netUsd;

        user.avaxBalance = roundTo2(user.avaxBalance - avaxAmount);

        // stats
        let stats = await Stats.findOne();
        if (!stats) stats = await Stats.create({});
        stats.totalFees += fee;
        await stats.save();

        // outcome logic
        const selectedOutcome = subMarket.outcomes.find(
            o => o.label.toLowerCase() === outcome.toLowerCase()
        );

        if (!selectedOutcome) {
            return res.status(400).json({
                success: false,
                message: "Invalid outcome selected"
            });
        }

        selectedOutcome.pool += netUsd;
        selectedOutcome.count += 1;
        selectedOutcome.volume += netUsd;
        selectedOutcome.liquidity += netUsd;

        const totalPool = subMarket.outcomes.reduce((a, o) => a + o.pool, 0);
        const MIN_PERCENT = 20;

        let raw = subMarket.outcomes.map(o =>
            totalPool === 0 ? 50 : (o.pool / totalPool) * 100
        );

        let adjusted = raw.map(p => Math.max(p, MIN_PERCENT));
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

        const finalSum = adjusted.reduce((a, b) => a + b, 0);
        adjusted = adjusted.map(p => (p / finalSum) * 100);

        subMarket.outcomes.forEach((o, i) => {
            o.percentage = Number(adjusted[i].toFixed(2));
        });

        subMarket.tradeCount += 1;
        subMarket.totalVolume += netUsd;

        market.tradeCount += 1;
        market.totalVolume += netUsd;

        const position = await Position.create({
            userId,
            marketId,
            subMarketId,
            outcome,
            amount: Number(netUsd.toFixed(2)), // ✅ USD AFTER FEE
            fee: Number(fee.toFixed(2)),       // ✅ optional but smart
            grossAmount: Number(usdAmount.toFixed(2)) // ✅ optional (before fee)
        });

        await market.save();

        await User.updateOne(
            { _id: user._id },
            {
                $set: {
                    "balance.testnet": roundTo2(user.balance.testnet),
                    "balance.locked": roundTo2(user.balance.locked),
                    avaxBalance: roundTo2(user.avaxBalance),
                    lastBalanceUpdate: Date.now()
                }
            }
        );

        const safeUser = await User.findById(userId).select("-password");

        return res.json({
            success: true,
            message: "Trade placed successfully",
            data: {
                positionId: position._id,
                amount: avaxAmount,
                fee: Number(fee.toFixed(2)),
                netAmount: Number(netUsd.toFixed(2)),
                balance: safeUser.balance,
                user: safeUser
            }
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: err.message || "Something went wrong"
        });
    }
});

router.post("/save_market", async (req, res) => {
    try {
        const { token, marketId, action } = req.body;

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id || decoded.userId || decoded._id;

        if (!userId) {
            return res.status(401).json({ error: "Invalid token payload" });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        // ✅ ensure array exists
        if (!user.savedMarkets) user.savedMarkets = [];

        if (action === "save") {
            if (!user.savedMarkets.includes(marketId)) {
                user.savedMarkets.push(marketId);
            }
        }
        else if (action === "unsave") {
            user.savedMarkets = user.savedMarkets.filter(
                (id) => id.toString() !== marketId
            );
        }

        await user.save();

        res.json({
            success: true,
            action,
            savedMarkets: user.savedMarkets
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.post("/saved_market", async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "userId is required",
            });
        }

        const user = await User.findById(userId).populate("savedMarkets");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        return res.json({
            success: true,
            savedMarkets: user.savedMarkets || [],
        });

    } catch (err) {
        console.error("saved_market error:", err);
        res.status(500).json({
            success: false,
            message: err.message,
        });
    }
});



// 🧠 Endpoint
router.post("/create-sport-market", async (req, res) => {
    try {
        const { clubA, clubB, league, startTime, endTime } = req.body;

        // ✅ clubA and clubB are OBJECTS now
        // { name: "Manchester United", logo: "https://..." }

        if (!clubA?.name || !clubB?.name) {
            return res.status(400).json({
                error: "Invalid club data"
            });
        }

        const market = await Market.create({
            question: `${clubA.name} vs ${clubB.name} - Who will win?`,
            marketType: "SPORT",

            event: {
                name: `${clubA.name} vs ${clubB.name}`,
                participants: [clubA.name, clubB.name],
                participantImages: [clubA.logo, clubB.logo],
                league,
                startTime: new Date(startTime)
            },

            subMarkets: [
                {
                    question: "Match Result",
                    marketType: "SPORT",
                    outcomes: [
                        { label: "HOME", name: clubA.name, odds: 2.5, pool: 0, percentage: 40 },
                        { label: "DRAW", name: "Draw", odds: 3.2, pool: 0, percentage: 20 },
                        { label: "AWAY", name: clubB.name, odds: 2.8, pool: 0, percentage: 40 }
                    ],
                    status: "LIVE"
                }
            ],

            startDate: new Date(startTime),
            endDate: new Date(endTime),
            durationMinutes: Math.floor(
                (new Date(endTime) - new Date(startTime)) / 60000
            ),

            category: "Sports",
            status: "LIVE"
        });


        // ✅ 2. CREATE CONVERSATION (NO messages, YOUR STRUCTURE)
        const conversation = await Conversation.create({
            market: market._id,
            participants: [], // leave empty or add creator later
            conv_type: "group",
            latest_msg: null
        });

        // ✅ 3. LINK BACK TO MARKET
        market.conversationId = conversation._id;
        await market.save();

        res.json({ success: true, market });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});


router.post("/create-x-market", async (req, res) => {
    try {
        const {
            username,
            metric,        // e.g. "tweet_count"
            threshold,     // e.g. 4
            durationMinutes
        } = req.body;

        if (!username || !metric || !threshold || !durationMinutes) {
            return res.status(400).json({
                success: false,
                message: "username, metric, threshold, durationMinutes are required"
            });
        }

        // ⏱ Time setup
        const startDate = new Date();
        const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

        // 🧠 Build question dynamically
        let question = "";

        if (metric === "tweet_count") {
            question = `Will @${username} make more than ${threshold} tweets in ${durationMinutes} minutes?`;
        } else {
            question = `Will @${username} exceed ${threshold} ${metric} in ${durationMinutes} minutes?`;
        }

        // 🧱 Create market
        const market = await Market.create({
            question,
            marketType: "X",

            metadata: {
                username,
                metric,
                threshold
            },

            subMarkets: [
                {
                    question: "Prediction",
                    marketType: "X",
                    outcomes: [
                        { label: "Yes", odds: 2.0, pool: 0, percentage: 50 },
                        { label: "No", odds: 2.0, pool: 0, percentage: 50 }
                    ],
                    status: "LIVE"
                }
            ],

            startDate,
            endDate,
            durationMinutes,

            category: "X",
            status: "LIVE"
        });

        // 💬 Create conversation (same pattern as others)
        const conversation = await Conversation.create({
            market: market._id,
            participants: [],
            conv_type: "group",
            latest_msg: null
        });

        // 🔗 Link back
        market.conversationId = conversation._id;
        await market.save();

        return res.json({
            success: true,
            market
        });

    } catch (err) {
        console.error("❌ create-x-market error:", err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});


module.exports = router;