const express = require("express");
const Router = express.Router();
const Ambassador = require("../models/Ambassador");
const Stats = require("../models/Stats");

const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};


Router.get("/ambassador_stats", async (req, res) => {
    try {
        let stats = await Stats.findOne();

        if (!stats) {
            stats = await Stats.create({ ambassadorSlots: 150 });
        }

        const percent = stats.ambassadorSlots <= 50 ? 5 : 10;

        return res.status(200).json({
            success: true,
            ambassadorSlots: stats.ambassadorSlots,
            percent
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});

Router.post("/ambassador_register", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required" });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ success: false, message: "Invalid email format" });
        }

        const existing = await Ambassador.findOne({ email });

        if (existing) {
            return res.status(409).json({ success: false, message: "Already registered" });
        }

        const stats = await Stats.findOne();

        if (!stats || stats.ambassadorSlots <= 0) {
            return res.status(403).json({
                success: false,
                message: "Ambassador slots full",
            });
        }

        // 🔥 derive percent dynamically
        const percent = stats.ambassadorSlots <= 50 ? 5 : 10;

        // decrement slot AFTER validation
        stats.ambassadorSlots -= 1;
        await stats.save();

        // save ambassador with percent
        const ambassador = await Ambassador.create({
            email,
            marketPercent: percent
        });

        return res.status(201).json({
            success: true,
            message: "Registered successfully",
            data: ambassador,
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
});

module.exports = Router;