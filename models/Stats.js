const mongoose = require("mongoose");

const StatsSchema = new mongoose.Schema({
  ambassadorSlots: {
    type: Number,
    default: 150,
  },
}, { timestamps: true });

module.exports = mongoose.model("Stats", StatsSchema);