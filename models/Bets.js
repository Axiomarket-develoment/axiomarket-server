const mongoose = require("mongoose");

const betSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  marketId: mongoose.Schema.Types.ObjectId,
  optionIndex: Number,
  amount: Number
});

module.exports = mongoose.model("Bet", betSchema);