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
const auth = require("../middlewave/auth");
const sanitizeUser = require("../utils/sanitizeUser");


function validateMarketEntryImpact({
    subMarket,
    outcomeLabel,
    incomingAmount,
    maxImbalancePercent = 70, // you control this (VERY IMPORTANT)
}) {
    const outcomes = subMarket.outcomes;


    const totalPoolBefore = outcomes.reduce((a, o) => a + (o.pool || 0), 0);

    // ✅ FIX 1: allow first trade
    if (totalPoolBefore === 0) {
        return {
            allowed: true,
            debug: {
                reason: "first trade allowed"
            }
        };
    }

    const selected = outcomes.find(
        o => o.label.toLowerCase() === outcomeLabel.toLowerCase()
    );

    if (!selected) {
        return {
            allowed: false,
            reason: "Invalid outcome"
        };
    }

    // -------------------------------
    // 1. SIMULATE NEW POOLS
    // -------------------------------
    const simulatedOutcomes = outcomes.map(o => {
        const added = o.label === selected.label ? incomingAmount : 0;

        return {
            label: o.label,
            pool: o.pool + added
        };
    });

    const totalPool = simulatedOutcomes.reduce((a, o) => a + o.pool, 0);

    if (totalPool === 0) {
        return { allowed: true };
    }

    // -------------------------------
    // 2. CALCULATE NEW DISTRIBUTION
    // -------------------------------
    const distribution = simulatedOutcomes.map(o => ({
        label: o.label,
        percent: (o.pool / totalPool) * 100
    }));

    // -------------------------------
    // 3. CHECK IMBALANCE RULE
    // -------------------------------
    const maxSide = Math.max(...distribution.map(d => d.percent));
    const minSide = Math.min(...distribution.map(d => d.percent));

    const imbalance = maxSide - minSide;

    // -------------------------------
    // 4. HARD BLOCK RULE
    // -------------------------------
    if (imbalance > maxImbalancePercent) {
        return {
            allowed: false,
            reason: "Market imbalance too high",
            debug: {
                imbalance,
                distribution
            }
        };
    }

    return {
        allowed: true,
        debug: {
            imbalance,
            distribution
        }
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

router.get("/market/:id", async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Market ID is required",
            });
        }

        const market = await Market.findById(id);

        if (!market) {
            return res.status(404).json({
                success: false,
                message: "Market not found",
            });
        }

        return res.status(200).json({
            success: true,
            data: market,
        });

    } catch (error) {
        console.error("GET /market/:id error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while fetching market",
        });
    }
});

router.post("/user_enter_market", auth, async (req, res) => {
    try {
        const { marketId, subMarketId, outcome, amount } = req.body;

        if (!marketId || !subMarketId || !outcome || !amount) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        const userId = req.user.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Invalid authentication token"
            });
        }

        const [user, market] = await Promise.all([
            User.findById(userId).select("balances usdBalance lockedUsd email"),
            Market.findById(marketId)
        ]);

        if (!user || !market) {
            return res.status(404).json({
                success: false,
                message: "User or market not found"
            });
        }

        // ======================
        // WHITELIST CHECK
        // ======================
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

        // if (!isAmbassador && !isWhitelisted) {
        //     return res.status(403).json({
        //         success: false,
        //         message: "Access denied: ambassadors only"
        //     });
        // }

        // ======================
        // PRICE
        // ======================
        const avaxPrice = await getPrice("avalanche-2");

        if (!avaxPrice) {
            return res.status(500).json({
                message: "Price service failed"
            });
        }

        const roundTo2 = (n) => Math.floor(n * 100) / 100;

        const avaxAmount = Number(amount);
        const usdAmount = avaxAmount * avaxPrice;

        const fee = usdAmount * 0.05;
        const netUsd = usdAmount - fee;

        if (netUsd <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid trade amount"
            });
        }

        // ======================
        // BALANCE CHECK (ONLY AVAX MATTERS)
        // ======================
        const userAvaxBalance = user.balances?.AVAX ?? 0;

        if (userAvaxBalance < avaxAmount) {
            return res.status(400).json({
                success: false,
                message: "Insufficient AVAX balance"
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
        // VALIDATION
        // ======================
        const validation = validateMarketEntryImpact({
            subMarket,
            outcomeLabel: outcome,
            incomingAmount: netUsd,
            maxImbalancePercent: 60
        });

        if (!validation.allowed) {
            return res.status(400).json({
                success: false,
                message: "Trade rejected to maintain market balance",
                reason: validation.reason,
                debug: validation.debug
            });
        }

        // ======================
        // UPDATE USER (CLEAN LEDGER ONLY)
        // ======================

        const newAvaxBalance = roundTo2(user.balances.AVAX - avaxAmount);

        await User.updateOne(
            { _id: userId },
            {
                $set: {
                    "balances.AVAX": newAvaxBalance,
                    lastBalanceUpdate: Date.now()
                },
                $inc: {
                    lockedUsd: netUsd
                }
            }
        );

        // ======================
        // STATS
        // ======================
        let stats = await Stats.findOne();
        if (!stats) stats = await Stats.create({});

        stats.totalFees += fee;
        await stats.save();

        // ======================
        // OUTCOME UPDATE
        // ======================
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

        await market.save();

        // ======================
        // POSITION
        // ======================
        const position = await Position.create({
            userId,
            marketId,
            subMarketId,
            outcome,
            amount: Number(netUsd.toFixed(2)),
            fee: Number(fee.toFixed(2)),
            grossAmount: Number(usdAmount.toFixed(2))
        });

        // ======================
        // RESPONSE
        // ======================
        const updatedUser = await User.findById(userId).select("balances usdBalance lockedUsd email");

        return res.json({
            success: true,
            message: "Trade placed successfully",
            data: {
                positionId: position._id,
                amount: avaxAmount,
                fee: Number(fee.toFixed(2)),
                netAmount: Number(netUsd.toFixed(2)),
                balance: updatedUser.balances,
                user: sanitizeUser(updatedUser)
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

router.post("/save_market", auth, async (req, res) => {
    try {
        const { marketId, action } = req.body;

        const userId = req.user.id

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

router.post("/saved_market", auth, async (req, res) => {
    try {
        const userId = req.user.id;

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

// -----------------------------
// MARKET TYPE MAP
// -----------------------------
const MARKET_TYPE_MAP = {
    Crypto: "CRYPTO",
    "Meme Coins": "MEME",
    Football: "SPORT",
    X: "X"
};

// -----------------------------------
// CREATE USER MARKET
// -----------------------------------
router.post("/user_market_creaiton", auth, async (req, res) => {
    try {
        const userId = req.user?.id; // ✅ AUTH USER

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const {
            token,
            category,
            values,
            startDate,
            endDate,
            outcomes,
            durationMinutes,
            question,
            marketType,
            marketMode
        } = req.body;

        // -----------------------------------
        // VALIDATION
        // -----------------------------------

        if (!question) {
            return res.status(400).json({
                success: false,
                message: "Question is required"
            });
        }

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: "Start date and end date required"
            });
        }

        if (!outcomes || outcomes.length < 2) {
            return res.status(400).json({
                success: false,
                message: "At least 2 outcomes required"
            });
        }

        // -----------------------------------
        // AMBASSADOR CHECK (LOOP VERSION)
        // -----------------------------------

        const ambassadors = await Ambassador.find({});
        const isAmbassador = ambassadors.some(
            (a) => a.user?.toString() === userId.toString()
        );
        // ✅ EMAIL WHITELIST
        const allowedEmails = ["derik0x0x@gmail.com", "ositanwaubani@gmail.com"];


        const isWhitelistedEmail = allowedEmails.includes(user?.email);

        if (!isAmbassador && !isWhitelistedEmail) {
            return res.status(403).json({
                success: false,
                message: "Only ambassadors can create markets"
            });
        }

        const outcomeCount = outcomes.length;
        const basePercentage = Math.round(100 / outcomeCount);

        const finalMarketType =
            MARKET_TYPE_MAP[category] || marketType || "CRYPTO";

        // -----------------------------------
        // MARKET PAYLOAD
        // -----------------------------------

        const marketPayload = {
            createdBy: userId, // ✅ IMPORTANT
            question,
            marketType: finalMarketType,
            startDate,
            marketMode,
            endDate,
            durationMinutes,
            category,
            totalVolume: 0,
            tradeCount: 0,
            featured: false,
            processing: false,
            status: "LIVE",

            subMarkets: [
                {
                    question,
                    marketType: finalMarketType,
                    totalVolume: 0,
                    tradeCount: 0,
                    status: "LIVE",
                    outcomes: outcomes.map((o) => ({
                        label: o.label,
                        result: null,
                        odds: o.odds || 2.0,
                        liquidity: o.liquidity || 0,
                        volume: o.volume || 0,
                        count: o.count || 0,
                        pool: o.pool || 0,
                        percentage: basePercentage
                    }))
                }
            ]
        };

        // -----------------------------------
        // CATEGORY LOGIC (UNCHANGED)
        // -----------------------------------

        if (category === "Crypto" || category === "Meme Coins") {
            marketPayload.metadata = {
                asset: values.assetSymbol,
                assetSymbol: values.assetSymbol,
                targetPrice: Number(values.target),
                direction: question.toLowerCase().includes("above")
                    ? "ABOVE"
                    : "BELOW",
                startPrice: Number(values.startPrice || 0),
                assetLogo: values.assetLogo || "",
                chartImage: values.chartImage || ""
            };
        }

        if (category === "X") {
            const username = values.name?.replace("@", "");
            const profileImage = `https://unavatar.io/twitter/${username}`;

            marketPayload.metadata = {
                asset: values.name,
                username,
                profileImage
            };
        }

        if (category === "Football") {
            marketPayload.event = {
                name: values.matchName || "",
                participants: values.participants || [],
                participantImages: values.participantImages || values.playerImage || [],
                league: values.league || "",
                startTime: startDate
            };

            marketPayload.matchStartTime = startDate;
        }

        // -----------------------------------
        // CREATE MARKET
        // -----------------------------------

        const market = await Market.create(marketPayload);

        // -----------------------------------
        // CREATE CONVERSATION (AUTO LINKED)
        // -----------------------------------

        const conversation = await Conversation.create({
            marketId: market._id,
            participants: [userId],
            messages: []
        });

        market.conversationId = conversation._id;
        await market.save();

        // -----------------------------------
        // RESPONSE
        // -----------------------------------

        return res.status(201).json({
            success: true,
            message: "Market created successfully",
            market,
            conversation
        });

    } catch (error) {
        console.log(error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
});


router.post("/system_market_creation", async (req, res) => {
    try {
        const {
            category,
            values,
            startDate,
            endDate,
            outcomes,
            durationMinutes,
            question,
            marketType,
            marketMode
        } = req.body;

        // -----------------------------------
        // VALIDATION
        // -----------------------------------

        if (!question) {
            return res.status(400).json({
                success: false,
                message: "Question is required"
            });
        }

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: "Start date and end date required"
            });
        }

        if (!outcomes || outcomes.length < 2) {
            return res.status(400).json({
                success: false,
                message: "At least 2 outcomes required"
            });
        }

        const outcomeCount = outcomes.length;
        const basePercentage = Math.round(100 / outcomeCount);

        const finalMarketType =
            MARKET_TYPE_MAP[category] || marketType || "CRYPTO";

        // -----------------------------------
        // MARKET PAYLOAD
        // -----------------------------------

        const marketPayload = {
            createdBy: null,
            question,
            marketType: finalMarketType,
            startDate,
            endDate,
            marketMode,
            durationMinutes,
            category,
            totalVolume: 0,
            tradeCount: 0,
            featured: false,
            processing: false,
            status: "LIVE",

            subMarkets: [
                {
                    question,
                    marketType: finalMarketType,
                    totalVolume: 0,
                    tradeCount: 0,
                    status: "LIVE",
                    outcomes: outcomes.map((o) => ({
                        label: o.label,
                        result: null,
                        odds: o.odds || 2.0,
                        liquidity: o.liquidity || 0,
                        volume: o.volume || 0,
                        count: o.count || 0,
                        pool: o.pool || 0,
                        percentage: basePercentage
                    }))
                }
            ]
        };

        // -----------------------------------
        // CATEGORY LOGIC
        // -----------------------------------

        if (category === "Crypto" || category === "Meme Coins") {
            marketPayload.metadata = {
                asset: values.assetSymbol,
                assetSymbol: values.assetSymbol,
                targetPrice: Number(values.target),
                direction: question.toLowerCase().includes("above")
                    ? "ABOVE"
                    : "BELOW",
                startPrice: Number(values.startPrice || 0),
                assetLogo: values.assetLogo || "",
                chartImage: values.chartImage || ""
            };
        }

        if (category === "X") {
            const username = values.name?.replace("@", "");
            marketPayload.metadata = {
                asset: values.name,
                username,
                profileImage: `https://unavatar.io/twitter/${username}`
            };
        }

        if (category === "Football") {
            marketPayload.event = {
                name: values.matchName || "",
                participants: values.participants || [],
                participantImages: values.participantImages || values.playerImage || [],
                league: values.league || "",
                startTime: startDate
            };

            marketPayload.matchStartTime = startDate;
        }

        if (category === "Politics") {
            marketPayload.metadata = {
                electionName: values.electionName || "",
                country: values.country || "Nigeria",
            };

            marketPayload.event = {
                name: values.electionName || "",
                participants: values.participants || [],
                participantImages: values.participantImages || [],
                league: values.country || "Politics",
                startTime: startDate
            };
        }

        // -----------------------------------
        // CREATE MARKET
        // -----------------------------------

        const market = await Market.create(marketPayload);

        const conversation = await Conversation.create({
            marketId: market._id,
            participants: [],
            messages: []
        });

        market.conversationId = conversation._id;
        await market.save();

        // -----------------------------------
        // RESPONSE
        // -----------------------------------

        return res.status(201).json({
            success: true,
            message: "Market created successfully (system)",
            market,
            conversation
        });

    } catch (error) {
        console.log(error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
});

module.exports = router;