// server/models/User.js
const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  username:             { type: String, required: true, unique: true },
  email:                { type: String, required: true, unique: true },
  password:             { type: String },
  wallet:                {
                           address: { type: String },
                           privateKey: { type: String } // store securely (consider encryption!)
                         },
  
  // viirtual balnce
  balance:              { 
                          testnet: { type: Number, default: 0 },
                          locked:  { type: Number, default: 0 }
                        },
  savedMarket:          {type: mongoose.Schema.Types.ObjectId, ref: "Market" },
  authProvider:         { type: String, enum: ["google", "email", "apple", "twitter"], default: "email" },
  twitterId:            { type: String ,unique: true, sparse: true}, 
  fullName:             { type: String }, 

} , {timestamps: true});

module.exports = mongoose.model("User", UserSchema);