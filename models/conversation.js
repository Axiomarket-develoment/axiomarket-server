const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema({
  market:                 {type: mongoose.Schema.Types.ObjectId, ref: "Market"},
  participants:           [{ type: mongoose.Schema.Types.ObjectId, ref: "User"}],

  conv_type:              { type: String, default: "group" },

  latest_msg:             {
                             text: String,
                             sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                             timestamp: Number
                          },

}, { timestamps: true });

module.exports = mongoose.model("Conversation", conversationSchema);
