// models/Price.js
const mongoose = require("mongoose");

const PriceSchema = new mongoose.Schema({
    asset: { type: String, unique: true },
    price: { type: Number, default: 0 },
    updatedAt: { type: Number, default: Date.now }
});

module.exports = mongoose.model("Price", PriceSchema);