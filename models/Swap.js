const mongoose = require("mongoose")
const { recompileSchema } = require("./Market")

const SwapSchema = new mongoose.Schema({
    user:               { 
                            type: mongoose.Schema.Types.ObjectId,
                            ref: "User",
                            required: true
                        },
    fromToken:          { type: String, required: true }, // e.g., AVAX
    toToken:            { type: String, required: true }, // e.g., USDT
    amount:             { type: Number, required: true },
    fee:                { type: Number, default: 0 },
    receivedAmount:     { type: Number }, // amount user received after swap
    usdValue:           { type: Number }, // USD value of the swap (for tracking)
    status:             {
                            type: String,
                            enum: ["pending", "completed", "failed"],
                            default: "pending",
                        },
    },
    { timestamps: true }
)

module.exports = mongoose.model("Swap", SwapSchema)