const mongoose = require("mongoose")

const TransactionSchema = new mongoose.Schema({
    user:               { 
                            type: mongoose.Schema.Types.ObjectId,
                            ref: "User",
                            required: true
                        },
    type:               {
                            type: String,
                            enum: ["deposit", "withdrawal", "transfer"],
                            required: true,
                        },

    method:             {
                            type: String,
                            enum: ["paystack", "crypto", "internal"],
                            required: true,
                        },

    currency:           {
                            type: String, // NGN, USDT, AVAX etc
                            required: true,
                        },

    amount:             {
                            type: Number,
                            required: true,
                        },

    fee:                {
                            amount: { type: Number, default: 0 },
                            claimed: { type: Boolean, default: false },
                        },

    swept:              { type: Boolean, default: false },
    sweepTxs:           { feeTx: String, liquidityTx: String }, // store sweep transaction hashes here

    status:             {
                            type: String,
                            enum: ["pending", "success", "failed"],
                            default: "pending",
                        },

    reference:          {
                            type: String,
                            unique: true,
                        },

    metadata:           {
                            type: Object,
                            default: {},
                        },
},
        { timestamps: true }
)

module.exports = mongoose.model("Transaction", TransactionSchema);