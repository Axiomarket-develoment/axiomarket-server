const mongoose = require('mongoose');

const AdminWalletSchema = new mongoose.Schema({
    type:                 {
                             type: String,
                             enum: ['liquidity', 'fee', 'operations', 'founder', 'reserve','gas'],
                             required: true,
                             unique: true
                          },
    address:              { type: String, required: true, unique: true },
    encryptedPrivateKey:  {     encryptedData: String,
                                iv: String,
                                authTag: String, 
                          },
    encryptedMnemonic:    {     encryptedData: String,
                                iv: String,
                                authTag: String, 
                          },
    balances:             {
                            AVAX:  { type: Number, default: 0 },
                            ETH:   { type: Number, default: 0 },
                            BNB:   { type: Number, default: 0 },
                            USDT:  { type: Number, default: 0 },
                         },
}, { timestamps: true });
    
module.exports = mongoose.model('AdminWallet', AdminWalletSchema);