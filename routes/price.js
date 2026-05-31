const express = require("express");
const Router = express.Router();

const { getPrice, getPriceChange } = require("../services/price/priceOracle");
const { TOKENS } = require("../confiq/assets");
const auth = require("../middlewave/auth");
const User = require("../models/User");
const sanitizeUser = require("../utils/sanitizeUser");

// map DB asset → frontend symbol
const ASSET_MAP = {
    bitcoin: "BTC",
    ethereum: "ETH",
    binancecoin: "BNB",
    solana: "SOL",
    "avalanche-2": "AVAX",
    "shiba-inu": "SHIB",
    dogecoin: "DOGE",
    pepe: "PEPE"
};

const TOKEN_TO_ASSET = {
    AVAX: "avalanche-2",
    ETH: "ethereum",
    BNB: "binancecoin",
    USDT: "tether"
};

const PRICE_ASSET_MAP = {
    AVAX: "avalanche-2",
    ETH: "ethereum",
    BNB: "binancecoin",
    USDT: null,
    NGN: "usd_ngn"
};

async function convertToUsd(token, amount) {

    if (token === "USDT") {
        return amount;
    }

    if (token === "NGN") {
        const rate = await getPrice("usd_ngn");

        return amount / rate;
    }

    const assetId = PRICE_ASSET_MAP[token];

    const price = await getPrice(assetId);

    return amount * price;
}


async function convertFromUsd(token, usdAmount) {

    if (token === "USDT") {
        return usdAmount;
    }

    if (token === "NGN") {
        const rate = await getPrice("usd_ngn");

        return usdAmount * rate;
    }

    const assetId = PRICE_ASSET_MAP[token];

    const price = await getPrice(assetId);

    return usdAmount / price;
}


Router.get("/prices", async (req, res) => {
    try {
        const result = {};

        for (const asset of TOKENS) {
            const price = await getPrice(asset);
            if (!price) continue;

            const change30m = await getPriceChange(
                asset,
                price,
                30
            );

            const change24h = await getPriceChange(
                asset,
                price,
                24 * 60
            ); const symbol = ASSET_MAP[asset];

            result[symbol] = {
                price,
                change30m,
                change24h
            };
        }

        // 👇 ADD THIS PART
        const usdNgn = await getPrice("usd_ngn");

        return res.json({
            success: true,
            data: result,
            fx: {
                usd_ngn: usdNgn
            }
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch prices"
        });
    }
});

Router.post("/swap_token", auth, async (req, res) => {
    try {

        const {
            fromToken,
            toToken,
            amount
        } = req.body;

        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (
            !fromToken ||
            !toToken ||
            !amount
        ) {
            return res.status(400).json({
                success: false,
                message: "Missing fields"
            });
        }

        if (fromToken === toToken) {
            return res.status(400).json({
                success: false,
                message: "Cannot swap same token"
            });
        }

        const swapAmount = Number(amount);

        if (swapAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid amount"
            });
        }

        let currentBalance = 0;

        if (fromToken === "NGN") {
            currentBalance = user.fiat?.NGN || 0;
        } else {
            currentBalance =
                user.balances?.[fromToken] || 0;
        }

        if (currentBalance < swapAmount) {
            return res.status(400).json({
                success: false,
                message: "Insufficient balance"
            });
        }

        // 2% fee
        const fee = swapAmount * 0.02;

        const amountAfterFee =
            swapAmount - fee;

        // Convert to USD
        const usdValue =
            await convertToUsd(
                fromToken,
                amountAfterFee
            );

        // Convert USD -> destination
        const receiveAmount =
            await convertFromUsd(
                toToken,
                usdValue
            );

        // ====================
        // DEBIT
        // ====================

        if (fromToken === "NGN") {
            user.fiat.NGN -= swapAmount;
        } else {
            user.balances[fromToken] -= swapAmount;
        }

        // ====================
        // CREDIT
        // ====================

        if (toToken === "NGN") {
            user.fiat.NGN += receiveAmount;
        } else {
            user.balances[toToken] += receiveAmount;
        }
        function normalizeBalances(user) {
            const STABLES = new Set(["USDT", "USDC", "DAI"]);

            // crypto balances
            for (const key of Object.keys(user.balances || {})) {
                const val = user.balances[key];

                if (typeof val !== "number") continue;

                // ✅ USDT / stablecoins → 2 decimals
                if (STABLES.has(key)) {
                    user.balances[key] = Number(val.toFixed(2));
                }
                // ✅ other crypto → 5 decimals
                else {
                    user.balances[key] = Number(val.toFixed(5));
                }
            }

            // fiat (NGN)
            if (user.fiat?.NGN !== undefined) {
                user.fiat.NGN = Number(user.fiat.NGN.toFixed(2));
            }

            return user;
        }
        normalizeBalances(user);

        await user.save();

        const updatedUser = await User.findById(req.user.id); 0.

        return res.json({
            success: true,
            message: "Swap successful",

            data: {
                receiveAmount,
                fee,
                user: sanitizeUser(updatedUser)
            }
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            success: false,
            message: "Swap failed"
        });
    }
});

module.exports = Router;

