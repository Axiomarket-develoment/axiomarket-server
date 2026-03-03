const express = require("express");
const Router = express.Router();
const Waitlist = require("../models/Waitlist");

// Simple email regex validation
const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

Router.post("/waitlist_register", async (req, res) => {
  try {
    const { email } = req.body;

    // 1️⃣ Check if email exists
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // 2️⃣ Validate email format
    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    // 3️⃣ Check duplicate
    const existing = await Waitlist.findOne({ email });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Email already on waitlist",
      });
    }

    // 4️⃣ Save to DB
    const newUser = await Waitlist.create({ email });

    return res.status(201).json({
      success: true,
      message: "Successfully joined waitlist",
      data: newUser,
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