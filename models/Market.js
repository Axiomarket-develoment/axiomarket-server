const mongoose = require("mongoose");


const SubMarketSchema = new mongoose.Schema({
  question:              { type: String, required: true },
  outcomes:               [
                            {
                                label:     {type: String , required: true},
                                result:    { type: Boolean, default: null},
                                odds:      { type: Number, default: 2.0},
                                liquidity: {type: Number , default: 0},
                                volume: {type: Number , default: 0},
                                count: {type: Number , default: 0},
                                pool: { type: Number, default: 0 },
                                percentage: { type: Number, default: 50 }
                            }
                         ],
  marketType:            { type: String, enum: ["CRYPTO","MEME COINS", "SOCIAL","X", "SPORT"] },
  tradeCount:            { type: Number, default: 0 },

  lastPrice:             {type: Number , default: 2.0},

  resolution:            { 
                            source: String ,
                            method: {
                              type: String, enum: ["ORACLE", "API", "MANUAL"]
                            },
                            value: String
                         }, 
  totalVolume:           { type: Number, default: 0 },
  status:                { type: String, enum: ["PENDING", "LIVE", "ENDED", "SETTLED"], default: "LIVE" },

});

const MarketSchema = new mongoose.Schema({

  createdBy:             {type: mongoose.Schema.Types.ObjectId, ref: "User", required: false},
  question:              { type: String, required: true },
  marketType:            { type: String, enum: ["CRYPTO","MEME COINS", "SOCIAL", "SPORT","X"] },
  conversationId:        {type:mongoose.Schema.Types.ObjectId , ref: "Conversation" },
  subMarkets:            [SubMarketSchema],
  // sport data
  event:                 { name: String, participants: [String],  participantImages: [String],  league: String ,startTime: Date }, 
  matchStartTime:        { type: Date }, 
  startDate:             { type: Date, required: true },
  endDate:               { type: Date, required: true },
  durationMinutes:       { type: Number, required: true },

  // Crypto Data
  totalVolume:           { type: Number, default: 0 },
  tradeCount:            { type: Number, default: 0 },        // optional total trades

                       
  featured:              { type: Boolean, default: false },
  category:              { type: String },  // trending , Crypto , Sports 

  metadata:              {
                          asset: String,
                          username: String,
                          profileImage: String,
                          assetLogo: String,   // ✅ ADD THIS
                          chartImage: String,
                          startPrice: Number,
                          targetPrice: Number,
                          assetSymbol: String,
                          direction: String
                         },


  marketMode:            {
                            type: String,
                            // enum: [
                            //     "FOOTBALL_PLAYER",
                            //     "FOOTBALL_TEAM",
                            //     "FOOTBALL_MATCH",
                            //     "FOOTBALL_OUTCOME",
                            //     "SPECIAL_OUTCOME_CUP_WINNER"
                            //   ]
                         },
  result:                { type: String,  default: null },
  createdAt:             { type: Date, default: Date.now },

  processing:            {type: Boolean, default: false},
  status:                { type: String, enum: ["PENDING", "LIVE","LOCKED", "ENDED","SETTLING", "SETTLED"], default: "LIVE" },
});


MarketSchema.index({ status: 1, endDate: 1 });
MarketSchema.index({ status: 1, result: 1 });
MarketSchema.index({ endDate: 1, status: 1, processing: 1 });


module.exports = mongoose.model("Market", MarketSchema);