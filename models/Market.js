const mongoose = require("mongoose");

const MarketSchema = new mongoose.Schema({
  question:              { type: String, required: true },
  outcomes:              { type: [String], default: ["YES", "NO"] },
  startDate:             { type: Date, required: true },
  endDate:               { type: Date, required: true },
  durationMinutes:       { type: Number, required: true },
  resolutionSource:      { type: String }, // e.g. "CHAINLINK_AVAX_USD"
  status:                { type: String, enum: ["PENDING", "LIVE", "ENDED", "SETTLED"], default: "LIVE" },
  targetPrice:           { type: Number, required: true },
  asset:                 { type: String, default: "AVAX" },
  startPrice:            { type: Number, required: true },
  direction:             { type: String, enum: ["UP", "DOWN"], required: true },
  result:                { type: String, default: null }, // "YES" or "NO"
  liquidity:             {
    yes:                 { type: Number, default: 0 },
    no:                  { type: Number, default: 0 },
  },
  createdAt:             { type: Date, default: Date.now },
});

module.exports = mongoose.model("Market", MarketSchema);