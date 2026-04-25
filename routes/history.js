const express = require("express");
const router = express.Router();
const Position = require("../models/Position");
const Market = require("../models/Market");
const jwt = require("jsonwebtoken");

router.get("/get_history", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];

        if (!token) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id || decoded.userId || decoded._id;

        if (!userId) {
            return res.status(401).json({ error: "Invalid token payload" });
        }
        const positions = await Position.find({ userId })
            .populate("marketId")
            .sort({ createdAt: -1 });

        let totalStaked = 0;
        let totalPotentialWin = 0;

        const history = positions.map((p) => {
            const market = p.marketId;

            let userOutcome = "PENDING";
            let marketResult = null;
            let marketStatus = "LIVE";
            let marketQuestion = "Unknown Market";
            let image = null;
            let potentialWin = 0;

            if (market) {
                marketQuestion = market.question || "Unknown Market";
                marketStatus = market.status || "LIVE";
                marketResult = market.result ?? null;
                image = market.metadata?.assetLogo || null;

                // ✅ FIND SUBMARKET
                const subMarket = market.subMarkets.id(p.subMarketId);

                if (subMarket) {
                    const outcomes = subMarket.outcomes;

                    const selected = outcomes.find(
                        (o) =>
                            o.label.toLowerCase() ===
                            p.outcome.toLowerCase()
                    );

                    const totalPool = outcomes.reduce(
                        (sum, o) => sum + (o.pool || 0),
                        0
                    );

                    if (selected && selected.pool > 0) {
                        const userShare = p.amount / selected.pool;
                        potentialWin = userShare * totalPool;
                    }
                }

                // ✅ RESOLVE RESULT
                if (market.status === "SETTLED" && market.result) {
                    userOutcome =
                        market.result.toLowerCase() ===
                            p.outcome.toLowerCase()
                            ? "WIN"
                            : "LOSE";
                }
            }

            totalStaked += p.amount || 0;
            totalPotentialWin += potentialWin;

            return {
                id: p._id,
                marketId: market?._id,

                marketQuestion,
                outcomePicked: p.outcome || "Unknown",
                amountStaked: p.amount || 0,
                potentialWin: Number(potentialWin.toFixed(2)),

                marketResult,
                marketStatus,
                userOutcome,
                image,

                date: p.createdAt || new Date(p._id.getTimestamp()),
            };
        });

        return res.json({
            success: true,
            totalStaked: Number(totalStaked.toFixed(2)),
            totalPotentialWin: Number(totalPotentialWin.toFixed(2)),
            history,
        });
    } catch (err) {
        console.error("get_history error:", err);
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;