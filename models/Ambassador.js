const mongoose = require("mongoose");

const ambassadorSchema = new mongoose.Schema({
  user:                {type: mongoose.Schema.Types.ObjectId, ref: "User"},

  email:               {type:String },

  marketPercent:       {type:Number, default: 10},
  referralPercent:     {type:Number, default: 10},

  totalReferals:       {type:Number, default: 0},
  totalEarninsgs:      {type:Number, default: 0}


}, { timestamps: true });

module.exports = mongoose.model("Ambassador", ambassadorSchema);
