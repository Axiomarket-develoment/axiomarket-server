const mongoose = require("mongoose");


const SubMarketSchema = new mongoose.Schema({
  question:              { type: String, required: true },
  outcomes:               [
                            {
                                label:     {type: String , required: true},
                                result:    { type: Boolean, default: null}
                            }
                         ],
  marketType:            { type: String, enum: ["CRYPTO", "SOCIAL", "SPORT"], required: true },
  tradeCount:            { type: Number, default: 0 },
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
  question:              { type: String, required: true },
  marketType:            { type: String, enum: ["CRYPTO", "SOCIAL", "SPORT"], required: true },
  subMarkets:            [SubMarketSchema],
  // sport data
  event:                 { name: String, participants: [String],  participantImages: [String],  league: String ,startTime: Date }, 

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
                          assetLogo: String,   // ✅ ADD THIS
                          chartImage: String,
                          startPrice: Number,
                          targetPrice: Number,
                          direction: String
                         },
  createdAt:             { type: Date, default: Date.now },
});

module.exports = mongoose.model("Market", MarketSchema);