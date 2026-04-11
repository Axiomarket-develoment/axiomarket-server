
const mongoose = require("mongoose");

const PositionSchema = new mongoose.Schema({
  userId:               { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  marketId:             { type: mongoose.Schema.Types.ObjectId, ref: "Market", required: true },
  subMarketId:          { type: mongoose.Schema.Types.ObjectId ,required: true },

  outcome:              { type: String, required: true },

  // shares:               { type: Number, required: true },
  amount:               { type: Number, required: true }
}, 
      { timestamps: true }
);

module.exports = mongoose.model("Position", PositionSchema);