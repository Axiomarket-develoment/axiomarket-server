const mongoose = require("mongoose");

const TradeSchema = new mongoose.Schema({
  marketId:                 { type: mongoose.Schema.Types.ObjectId, 
                                ref: "Market", 
                                required: true 
                            },
  walletAddress:            { type: String,    
                                required:true, 
                                lowercase:  true,
                                trim: true 
                            },
  side:                     { type: String, 
                                enum: ["YES", "NO"], 
                                required: true 
                            },
  amount:                   { type: Number, required: true, min: 0 },
  status:                   { type: String, 
                                enum: ["OPEN", "CLAIMED"], 
                                default: "OPEN" 
                            }
}, { timestamps: true });

TradeSchema.index({ marketId: 1 });
TradeSchema.index({ walletAddress: 1 });

module.exports = mongoose.model("Trade", TradeSchema);