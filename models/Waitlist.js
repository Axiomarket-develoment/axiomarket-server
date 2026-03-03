const mongoose = require("mongoose")

const WaitlistSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
  },
  { timestamps: true }
)

module.exports = mongoose.models.Waitlist ||
  mongoose.model("Waitlist", WaitlistSchema)