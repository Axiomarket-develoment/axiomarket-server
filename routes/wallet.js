const express = require("express");
const Router = express.Router();

const User = require("../models/User");
const auth = require("../middlewave/auth");
const { encrypt, decrypt } = require("../utils/encryption");
const { generateWallet } = require("../services/wallet/generateWallet");

const { ethers } = require("ethers");
const axios = require("axios");
const Transaction = require("../models/Transaction");
const AdminWallet = require("../models/AdminWallet");
const { randomUUID } = require("crypto");

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET;

// ---------------- PROVIDERS ----------------

const providers = {
    AVAX: new ethers.JsonRpcProvider(
        "https://api.avax.network/ext/bc/C/rpc"
    ),

    BSC: new ethers.JsonRpcProvider(
        "https://bsc-dataseed.binance.org"
    ),

    ETH: new ethers.JsonRpcProvider(
        "https://mainnet.infura.io/v3/42a02ce24a864db582d2e998461b8ae9"
    ),

    POLYGON: new ethers.JsonRpcProvider(
        "https://polygon-mainnet.infura.io/v3/42a02ce24a864db582d2e998461b8ae9"
    )
};

// ---------------- CREATE WALLET ----------------

Router.post("/create_wallet", auth, async (req, res) => {
    try {
        const userId = req.user?.id;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        if (user.wallet?.address) {
            return res.status(400).json({
                success: false,
                message: "Wallet already exists",
            });
        }

        const wallet = generateWallet();

        const encrypted = encrypt(wallet.privateKey);

        user.wallet = {
            address: wallet.address.toLowerCase(),
            privateKey: {
                encryptedData: encrypted.encryptedData,
                iv: encrypted.iv,
                authTag: encrypted.authTag
            }
        };

        await user.save();

        const safeUser = user.toObject();

        delete safeUser.wallet.privateKey;

        return res.json({
            success: true,
            user: safeUser,
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
});

// ---------------- RESOLVE ADDRESS ----------------

Router.post("/resolve_address", async (req, res) => {
    try {
        const { address } = req.body;

        // format validation
        if (!ethers.isAddress(address)) {
            return res.json({
                success: false,
                valid: false,
                message: "Invalid address",
            });
        }

        const chains = [];

        // check all chains
        for (const [name, provider] of Object.entries(providers)) {
            try {
                const balance = await provider.getBalance(address);

                const txCount =
                    await provider.getTransactionCount(address);

                const active =
                    balance > 0n || txCount > 0;

                chains.push({
                    chain: name,
                    active,
                    balance: ethers.formatEther(balance),
                    txCount,
                });

            } catch (err) {
                console.log(`${name} failed`);
            }
        }

        return res.json({
            success: true,
            valid: true,
            chains,
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
});


// ---------------- GET BANKS ----------------

let cachedBanks = null;
let lastFetched = null;

Router.get("/banks", async (req, res) => {
    try {
        // cache for 24 hours
        const now = Date.now();

        if (cachedBanks && lastFetched && now - lastFetched < 24 * 60 * 60 * 1000) {
            return res.json({
                success: true,
                data: cachedBanks,
                source: "cache"
            });
        }

        const response = await axios.get(
            "https://api.paystack.co/bank?country=nigeria",
            {
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET}`
                }
            }
        );

        cachedBanks = response.data.data;
        lastFetched = now;

        return res.json({
            success: true,
            data: cachedBanks,
            source: "api"
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch banks"
        });
    }
});

// ---------------- RESOLVE NGN ACCOUNT ----------------

Router.post("/verify-paystack", auth, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { reference } = req.body;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // 1. CHECK IF TRANSACTION ALREADY EXISTS
        const existingTx = await Transaction.findOne({ reference });

        if (existingTx && existingTx.status === "success") {
            return res.status(409).json({
                success: false,
                message: "Transaction already processed",
            });
        }

        // 2. VERIFY PAYSTACK
        const response = await axios.get(
            `https://api.paystack.co/transaction/verify/${reference}`,
            {
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET}`,
                },
            }
        );

        const data = response.data?.data;

        if (!data || data.status !== "success") {
            return res.status(400).json({
                success: false,
                message: "Payment not successful",
            });
        }

        const amount = data.amount / 100;

        // 3. CREATE TRANSACTION (SOURCE OF TRUTH)
        const tx = await Transaction.create({
            user: user._id,
            type: "deposit",
            method: "paystack",
            currency: "NGN",
            amount,
            status: "success",
            reference,
            metadata: {
                gateway: "paystack",
                raw: data,
            },
        });

        // 4. UPDATE WALLET
        user.fiat.NGN = (user.fiat?.NGN || 0) + amount;

        await user.save();

        return res.json({
            success: true,
            message: "Wallet funded successfully",
            data: {
                transaction: tx,
                balance: user.fiat.NGN
            }
        });

    } catch (err) {
        console.error(err?.response?.data || err.message);

        return res.status(500).json({
            success: false,
            message: "Verification failed",
        });
    }
});

//----------------- Withdraw  Crypto ----------------
//----------------- Withdraw Crypto ----------------
Router.post("/withdraw_crypto", auth, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { amount, toAddress, chain = "AVAX" } = req.body;

        // =========================
        // VALIDATION
        // =========================
        if (!amount || !toAddress) {
            return res.status(400).json({
                success: false,
                message: "Amount and address required"
            });
        }

        if (!ethers.isAddress(toAddress)) {
            return res.status(400).json({
                success: false,
                message: "Invalid recipient address"
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const withdrawAmount = Number(amount);

        if (withdrawAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid amount"
            });
        }

        // =========================
        // FEE CALCULATION (2%)
        // =========================
        const feePercent = 2;
        const fee = (withdrawAmount * feePercent) / 100;
        const netAmount = withdrawAmount - fee;

        if (netAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Amount too small after fee"
            });
        }

        // =========================
        // CHECK USER BALANCE
        // =========================
        const userBalance = user.balances?.[chain] || 0;

        if (userBalance < withdrawAmount) {
            return res.status(400).json({
                success: false,
                message: "Insufficient balance"
            });
        }

        // =========================
        // GET ADMIN WALLETS
        // =========================
        const liquidityWallet = await AdminWallet.findOne({ type: "liquidity" });
        const feeWallet = await AdminWallet.findOne({ type: "fee" });
        const gasWallet = await AdminWallet.findOne({ type: "gas" });

        if (!liquidityWallet || !feeWallet || !gasWallet) {
            return res.status(500).json({
                success: false,
                message: "Admin wallets missing"
            });
        }

        // =========================
        // DECRYPT LIQUIDITY KEY
        // =========================
        const privateKey = decrypt(
            liquidityWallet.encryptedPrivateKey.encryptedData,
            liquidityWallet.encryptedPrivateKey.iv,
            liquidityWallet.encryptedPrivateKey.authTag
        );

        const wallet = new ethers.Wallet(privateKey, providers.AVAX);

        // =========================
        // SEND USER FUNDS
        // =========================
        const userTx = await wallet.sendTransaction({
            to: toAddress,
            value: ethers.parseEther(netAmount.toString())
        });

        console.log("🚀 User TX:", userTx.hash);

        // =========================
        // SEND FEE TO FEE WALLET
        // =========================
        const feeTx = await wallet.sendTransaction({
            to: feeWallet.address,
            value: ethers.parseEther(fee.toString())
        });

        console.log("💰 Fee TX:", feeTx.hash);

        // =========================
        // UPDATE USER BALANCE
        // =========================
        user.balances[chain] = Number(
            (userBalance - withdrawAmount).toFixed(6)
        );

        await user.save();

        // =========================
        // UPDATE ADMIN WALLET BALANCES (DB ONLY ACCOUNTING)
        // =========================

        // liquidity decreases full amount
        liquidityWallet.balances[chain] = Number(
            (liquidityWallet.balances?.[chain] || 0) - withdrawAmount
        );

        // fee wallet increases fee
        feeWallet.balances[chain] = Number(
            (feeWallet.balances?.[chain] || 0) + fee
        );

        // gas wallet tracking (optional platform revenue tracking)
        gasWallet.balances[chain] = Number(
            (gasWallet.balances?.[chain] || 0) + fee
        );

        await liquidityWallet.save();
        await feeWallet.save();
        await gasWallet.save();

        // =========================
        // TRANSACTION RECORD
        // =========================
        const record = await Transaction.create({
            user: user._id,
            type: "withdrawal",
            method: "crypto",
            currency: chain,
            amount: withdrawAmount,
            fee,
            netAmount,
            status: "success",
            txHash: userTx.hash,
            reference: randomUUID(),
            metadata: {
                to: toAddress,
                feeTxHash: feeTx.hash
            }
        });

        return res.json({
            success: true,
            message: "Withdrawal successful",
            data: {
                txHash: userTx.hash,
                feeTxHash: feeTx.hash,
                fee,
                netAmount,
                transaction: record
            }
        });

    } catch (err) {
        console.error("withdraw error:", err);

        return res.status(500).json({
            success: false,
            message: "Withdrawal failed"
        });
    }
});


module.exports = Router;