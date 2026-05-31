// server/models/User.js
const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  username:             { type: String, required: true, unique: true },
  email:                { type: String, required: true, unique: true },
  password:             { type: String },
  wallet:                {
                           address: { type: String },
                           privateKey: { 
                                           encryptedData: String,
                                           iv: String,
                                           authTag: String
                                        } // store securely (consider encryption!)
                         },
  
  // viirtual balnce
  balance:              { 
                          testnet: { type: Number, default: 0 },
                          locked:  { type: Number, default: 0 }
                        },
                
  savedMarkets:         { 
                          type: [String],
                          default: []
                        },

  referredBy:           {type: mongoose.Schema.Types.ObjectId, ref: "User" },
  isAmbassador:         {type: Boolean, default: false},
  isKol:                {type: Boolean, default: false},

  isAdmin:              {type: Boolean},

  usdBalance:           { type: Number, default: 0 },
  lockedUsd:            { type: Number, default: 0 },
  lastBalanceUpdate:    { type: Number },
  lastLogin:            { type: Number },

  balances:             {
                            AVAX:  { type: Number, default: 0 },
                            ETH:   { type: Number, default: 0 },
                            BNB:   { type: Number, default: 0 },
                            USDT:  { type: Number, default: 0 },
                         },
  onChainBalances:             {
                            AVAX:  { type: Number, default: 0 },
                            ETH:   { type: Number, default: 0 },
                            BNB:   { type: Number, default: 0 },
                            USDT:  { type: Number, default: 0 },
                         },
  lastSwept:             {
                            AVAX:  { type: Number, default: 0 },
                            ETH:   { type: Number, default: 0 },
                            BNB:   { type: Number, default: 0 },
                            USDT:  { type: Number, default: 0 },
                         },

  fiat:                    {
                            NGN: { type: Number, default: 0 }
                         },



  referralCode:         {type: String, unique: true, sparse: true},
  totalReferrals:       {type: Number, default: 0},
  totalEarnings:        {type: Number, default: 0},


  authProvider:         { type: String, enum: ["google", "email", "apple", "twitter"], default: "email" },
  twitterId:            { type: String ,unique: true, sparse: true}, 
  fullName:             { type: String }, 

} , {timestamps: true});

module.exports = mongoose.model("User", UserSchema);