
const mongoose = require("mongoose");

const kolSchema = new mongoose.Schema({
  user:                {type: mongoose.Schema.Types.ObjectId, ref: "User"},

  email:               {type:String },

  marketPercent:       {type:Number, default: 45},
  referralPercent:     {type:Number, default: 5},

  totalReferals:       {type:Number, default: 0},
  totalEarninsgs:      {type:Number, default: 0},

  isEmailSent:         { type: Boolean, default: false }


}, { timestamps: true });

module.exports = mongoose.model("Kol", kolSchema);
