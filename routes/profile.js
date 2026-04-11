const express = require("express");
const router = express.Router();
const { getPrice } = require("../services/price/priceOracle");
const User = require("../models/User");

router.get("/user_balance", async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: "Missing token" });
    }

    const user = await User.findById(token);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const avaxPrice = getPrice("avalanche-2");

    const avaxBalance = user.balance.testnet / avaxPrice;

    return res.json({
      usd: user.balance.testnet,
      avax: avaxBalance,
      price: avaxPrice
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;