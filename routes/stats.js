const express = require("express");
const Router = express.Router();
const Stats = require("../models/Stats");

// GET current ambassador slots
Router.get("/ambassador_stats", async (req, res) => {
  try {
    let stats = await Stats.findOne();

    // if not created yet, initialize it once
    if (!stats) {
      stats = await Stats.create({ ambassadorSlots: 150 });
    }

    return res.status(200).json({
      success: true,
      ambassadorSlots: stats.ambassadorSlots,
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