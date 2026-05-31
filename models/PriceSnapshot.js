const mongoose = require("mongoose")

const PriceSnapshotSchema = new mongoose.Schema({
    asset: String,
    price: Number,
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("PriceSnapshot", PriceSnapshotSchema);