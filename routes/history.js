const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const Market = require("../models/Market");
const jwt = require("jsonwebtoken");

// GET /user/get_history
router.get("/get_history", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1]; // Bearer TOKEN
        if (!token) return res.status(401).json({ error: "Unauthorized" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        // Fetch all orders for the user
        const orders = await Order.find({ userId })
            .populate("marketId", "question marketType metadata result status")
            .sort({ createdAt: -1 });

        // Compute total staked & potential win
        const totalStaked = orders.reduce((sum, o) => sum + o.amount, 0);
        const totalPotentialWin = orders.reduce((sum, o) => sum + o.amount * 2, 0); // 2x assumption

        // Transform orders into frontend-friendly history
        const history = orders.map(o => {
            const market = o.marketId;

            const outcomePicked = o.outcome;
            const priceBought = o.price;
            const amountStaked = o.amount;
            const potentialWin = amountStaked * 2;

            let userOutcome = "PENDING"; // default
            let marketResult = null;
            let marketStatus = "LIVE";
            let image = null;
            let marketQuestion = "Unknown Market";

            if (market) {
                marketResult = market.result || null;
                marketStatus = market.status || "LIVE";
                image = market.metadata?.assetLogo || null;
                marketQuestion = market.question || "Unknown Market";

                if (market.result) {
                    userOutcome = market.result === outcomePicked ? "WIN" : "LOSE";
                }
            }

            return {
                marketQuestion,
                outcomePicked,
                priceBought,
                amountStaked,
                potentialWin,
                marketResult,
                userOutcome,
                marketStatus,
                image,
                date: o.createdAt
            };
        });

        res.json({
            totalStaked,
            totalPotentialWin,
            history
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;