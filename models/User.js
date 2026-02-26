// server/models/User.js
const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  username:             { type: String, required: true, unique: true },
  email:                { type: String, required: true, unique: true },
  custodianWallet:      {
                           address: { type: String },
                           privateKey: { type: String } // ⚠️ store securely (consider encryption!)
                         },
  createdAt:            { type: Date, default: Date.now }
} , {timestamps});

module.exports = mongoose.model("User", UserSchema);