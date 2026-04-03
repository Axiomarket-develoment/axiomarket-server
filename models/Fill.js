const mongoose = require("mongoose");

const FillSchema = new mongoose.Schema({
  buyOrderId:          { type: mongoose.Schema.Types.ObjectId,
                         ref: "Order",
                         required: true
   },
  sellOrderId:          { type: mongoose.Schema.Types.ObjectId,
                           ref: "Order",
                           required: true
                         },

  price:                { type: Number },
  amount:               { type: Number },

  marketId:             { type: mongoose.Schema.Types.ObjectId,
                            ref: "Market",
                            required: true
   },
  subMarketId:          { type: mongoose.Schema.Types.ObjectId,
                            
                          },

  createdAt:            { type: Date, default: Date.now }
});

module.exports = mongoose.model("Fill", FillSchema);