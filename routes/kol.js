const express = require("express");
const Router = express.Router();

const Kol = require("../models/Kol");
const Stats = require("../models/Stats");
const User = require("../models/User");

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

const isSimilarEmail = async (email) => {
  const domain = email.split("@")[1];

  const candidates = await Kol.find(
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
// GET KOL STATS
// --------------------

Router.get("/kol_stats", async (req, res) => {
  try {
    let stats = await Stats.findOne();

    if (!stats) {
      stats = await Stats.create({ kolsSlots: 5 });
    }

    return res.status(200).json({
      success: true,
      slots: stats.kolsSlots,
      marketPercent: 45,
      referralPercent: 5
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});



// --------------------
// REGISTER KOL
// --------------------

Router.post("/kol_register", async (req, res) => {
  try {
    const { email } = req.body;

    // --------------------
    // Validation
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
    // Exact match
    // --------------------

    const existing = await Kol.findOne({ email });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Already registered as KOL"
      });
    }

    // --------------------
    // Similar email check
    // --------------------

    const similar = await isSimilarEmail(email);

    if (similar) {
      return res.status(409).json({
        success: false,
        message: "Email too similar to existing KOL"
      });
    }

    // --------------------
    // Slot control
    // --------------------

    const stats = await Stats.findOneAndUpdate(
      { kolsSlots: { $gt: 0 } },
      { $inc: { kolsSlots: -1 } },
      { new: true }
    );

    if (!stats) {
      return res.status(403).json({
        success: false,
        message: "KOL slots full"
      });
    }

    // --------------------
    // Create KOL (NO USER YET)
    // --------------------

    const kol = await Kol.create({
      email,
      marketPercent: 45,
      referralPercent: 5,
      user: null // 👈 important (since not linked yet)
    });

    return res.status(201).json({
      success: true,
      message: "KOL registered successfully",
      data: kol
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});



// --------------------
// GET ALL KOLS
// --------------------

Router.get("/kols", async (req, res) => {
  try {
    const kols = await Kol.find()
      .populate("user", "username email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: kols.length,
      data: kols
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