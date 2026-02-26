const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const Market = require("../models/Market");
const Trade = require("../models/Trade");

router.post("/trade", async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { marketId, walletAddress, side, amount } = req.body;

    // Basic validation
    if (!marketId || !walletAddress || !side || !amount) {
      return res.status(400).json({
        error: "marketId, walletAddress, side and amount are required",
      });
    }

    if (!["YES", "NO"].includes(side)) {
      return res.status(400).json({ error: "Invalid side" });
    }

    const numericAmount = Number(amount);
    if (numericAmount <= 0) {
      return res.status(400).json({ error: "Amount must be greater than 0" });
    }

    // Find market
    const market = await Market.findById(marketId).session(session);

    if (!market) {
      await session.abortTransaction();
      return res.status(404).json({ error: "Market not found" });
    }

    if (market.status !== "LIVE") {
      await session.abortTransaction();
      return res.status(400).json({ error: "Market is not live" });
    }

    // Create trade
    const trade = await Trade.create([{
      marketId,
      walletAddress,
      side,
      amount: numericAmount
    }], { session });

    // Update liquidity
    if (side === "YES") {
      market.liquidity.yes += numericAmount;
    } else {
      market.liquidity.no += numericAmount;
    }

    await market.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      message: "Trade placed successfully",
      trade: trade[0],
      updatedLiquidity: market.liquidity
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;