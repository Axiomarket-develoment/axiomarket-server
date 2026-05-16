const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../../models/User");
const setAuthCookie = require("../../utils/setAuthCookie");
const auth = require("../../middlewave/auth");

const Market = require("../../models/Market"); // ✅ ADD THIS
const { settleMarket } = require("../../services/market/settlement");

// ✅ ENDED MARKETS ENDPOINT
router.get("/ended", auth, async (req, res) => {
  try {

    console.log(req.user)
    // 🔒 check admin
    if (!req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Admins only"
      });
    }

    const markets = await Market.find({
      status: "ENDED"
    })
      .sort({ endDate: -1 })
      .lean();

    return res.json({
      success: true,
      markets
    });

  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch ended markets"
    });
  }
});


// MANUAL SETTLE + CLEANUP
// ===============================
router.post("/manual_settle", auth, async (req, res) => {
  try {
    const { marketId, outcome } = req.body;

    if (!marketId || !outcome) {
      return res.status(400).json({
        success: false,
        message: "marketId and outcome are required",
      });
    }

    // 🔒 admin check
    if (!req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Admins only",
      });
    }

    const market = await Market.findById(marketId);

    if (!market) {
      return res.status(404).json({
        success: false,
        message: "Market not found",
      });
    }

    // ===============================
    // STEP 1: SETTLE MARKET
    // ===============================
    await settleMarket(market, outcome.toUpperCase());

    // reload updated market
    const updatedMarket = await Market.findById(marketId);

    // ===============================
    // STEP 2: CHECK IF EMPTY MARKET
    // ===============================
    let shouldDelete = true;

    for (const sub of updatedMarket.subMarkets) {
      for (const o of sub.outcomes) {
        const hasActivity =
          (o.count && o.count > 0) ||
          (o.liquidity && o.liquidity > 0) ||
          (o.volume && o.volume > 0);

        if (hasActivity) {
          shouldDelete = false;
          break;
        }
      }
    }

    // ===============================
    // STEP 3: DELETE IF DEAD MARKET
    // ===============================
    if (shouldDelete) {
      await Market.deleteOne({ _id: marketId });

      return res.json({
        success: true,
        message: "Market settled and deleted (no activity found)",
        deleted: true,
      });
    }

    // ===============================
    // OTHERWISE KEEP MARKET
    // ===============================
    return res.json({
      success: true,
      message: "Market settled successfully",
      deleted: false,
    });

  } catch (error) {
    console.log("manual_settle error:", error);

    return res.status(500).json({
      success: false,
      message: "Settlement failed",
    });
  }
});


module.exports = router;