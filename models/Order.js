const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
  userId:                  { type: mongoose.Schema.Types.ObjectId, 
                                ref: "User", 
                                required: true 
                            },
  marketId:                { type: mongoose.Schema.Types.ObjectId,
                                ref: "Market", 
                                required: true 
                            },
  subMarketId:              { type: mongoose.Schema.Types.ObjectId, 
                                required: true 
                            },
  walletAddress:            { type: String,    
                                lowercase:  true,
                                trim: true 
                            },
  outcome:                  { type: String, 
                                enum: ["YES", "NO"], 
                                required: true 
                            }, 
  filledAmount:              {type: Number, default: 0 , min: 0},
  side:                     { type: String, 
                                enum: ["BUY", "SELL"], 
                                required: true 
                            },
  price:                    { type: Number, min: 0 },
  amount:                   { type: Number, required: true, min: 0 },
  remainingAmount:          { type: Number, required: true, min: 0 },

  type:                     { type: String, 
                                enum: ["LIMIT", "MARKET"], 
                                required: true,
                                default: "LIMIT"
                            }, 
  
  status:                   { type: String, 
                                enum: ["OPEN", "PARTIAL", "CANCELED", "FILLED"], 
                                default: "OPEN" 
                            }
}, { timestamps: true });

OrderSchema.index({ marketId: 1 });
OrderSchema.index({ walletAddress: 1 });

module.exports = mongoose.model("Order", OrderSchema);