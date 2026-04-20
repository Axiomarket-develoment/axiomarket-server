const express = require("express");
const Router = express.Router();
const Ambassador = require("../models/Ambassador");
const Stats = require("../models/Stats");

const levenshtein = require("fast-levenshtein");

// --------------------
// Helpers
// --------------------

const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const normalizeEmail = (email) => {
    return email.toLowerCase().replace(/\./g, "");
};

// optimized similarity check (same domain only)
const isSimilarEmail = async (email) => {
    const domain = email.split("@")[1];

    const candidates = await Ambassador.find(
        { email: { $regex: `@${domain}$`, $options: "i" } },
        "email"
    );

    const normalizedNew = normalizeEmail(email);

    for (let user of candidates) {
        const normalizedExisting = normalizeEmail(user.email);

        const distance = levenshtein.get(normalizedNew, normalizedExisting);

        if (distance <= 2) {
            return true;
        }
    }

    return false;
};

// --------------------
// Routes
// --------------------

Router.get("/ambassador_stats", async (req, res) => {
    try {
        let stats = await Stats.findOne();

        if (!stats) {
            stats = await Stats.create({ ambassadorSlots: 150 });
        }

        const percent = stats.ambassadorSlots <= 100 ? 5 : 10;

        return res.status(200).json({
            success: true,
            ambassadorSlots: stats.ambassadorSlots,
            percent
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

Router.post("/ambassador_register", async (req, res) => {
    try {
        const { email } = req.body;

        // --------------------
        // Basic validation
        // --------------------
        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email format"
            });
        }

        // --------------------
        // Exact match FIRST
        // --------------------
        const existing = await Ambassador.findOne({ email });

        if (existing) {
            return res.status(409).json({
                success: false,
                message: "Already registered"
            });
        }

        // --------------------
        // Similarity check
        // --------------------
        const similar = await isSimilarEmail(email);

        if (similar) {
            return res.status(409).json({
                success: false,
                message: "This email looks too similar to an existing user"
            });
        }

        // --------------------
        // Atomic slot decrement
        // --------------------
        const stats = await Stats.findOneAndUpdate(
            { ambassadorSlots: { $gt: 0 } },
            { $inc: { ambassadorSlots: -1 } },
            { new: true }
        );

        if (!stats) {
            return res.status(403).json({
                success: false,
                message: "Ambassador slots full"
            });
        }

        // --------------------
        // Dynamic percent
        // --------------------
        const percent = stats.ambassadorSlots <= 100 ? 5 : 10;

        // --------------------
        // Save ambassador
        // --------------------
        const ambassador = await Ambassador.create({
            email,
            marketPercent: percent
        });

        return res.status(201).json({
            success: true,
            message: "Registered successfully",
            data: ambassador
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

module.exports = Router;