const mongoose = require("mongoose");


const messageSchema = new mongoose.Schema({
  conversation_id:            {
                                  type: mongoose.Schema.Types.ObjectId,
                                  ref: "Conversation",
                                  required: true
                              },

  sender:                     {
                                  type: mongoose.Schema.Types.ObjectId,
                                  required: true,
                                  refPath: "sender_model"
                              },


  message:                    {   type: String, trim: true },

  msg_type:                   {
                                  type: String,
                                  enum: ["text", "file"],
                                  default: "text"
                              },

  file_url:                   String,

}, { timestamps: true });

module.exports = mongoose.model("Message", messageSchema);
