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
                                required:true, 
                                lowercase:  true,
                                trim: true 
                            },
  outcome:                  { type: String, 
                                enum: ["YES", "NO"], 
                                required: true 
                            }, 
  side:                     { type: String, 
                                enum: ["BUY", "SELL"], 
                                required: true 
                            },
  price:                    { type: Number, required: true, min: 0, max: 1 },
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