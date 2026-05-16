const express = require("express");
const router = express.Router();

const bcrypt = require("bcryptjs");
const fetch = require("node-fetch");
const jwt = require("jsonwebtoken");

const User = require("../models/User");

const calcUserBalance = require("../services/balance/calcUserBalance");

const JWT_SECRET = process.env.JWT_SECRET;

const setAuthCookie = require("../utils/setAuthCookie");

// ==========================
// 🔥 SYNC USER BALANCE
// ==========================
async function syncUserBalance(user, options = {}) {
    if (!user?._id) return;

    const updated = await calcUserBalance(user, options);

    await User.updateOne(
        { _id: user._id },
        { $set: updated }
    );

    return updated;
}

// ==========================
// 🔥 GOOGLE AUTH
// ==========================
router.post("/google", async (req, res) => {
    try {
        const { token: accessToken } = req.body;

        const userInfoRes = await fetch(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }
        );

        const payload = await userInfoRes.json();

        const { email, name } = payload;

        if (!email) {
            return res.status(400).json({
                error: "No email from Google"
            });
        }

        const username =
            name?.replace(/\s+/g, "").toLowerCase() ||
            email.split("@")[0];

        let user = await User.findOne({ email });

        // ✅ Create user if not exists
        if (!user) {
            user = await User.create({
                email,
                fullName: name,
                username,
                authProvider: "google",
                balance: {
                    testnet: 100,
                    locked: 0
                },
                wallet: {
                    address: "",
                    privateKey: ""
                }
            });
        }

        // 🔥 Sync balance
        await syncUserBalance(user, {
            provider: "google"
        });

        const freshUser = await User.findById(user._id);

        // 🔥 Generate JWT
        const token = jwt.sign(
            {
                id: user._id.toString(),
                email: user.email,
                isAdmin: user.isAdmin || false

            },
            JWT_SECRET,
            {
                expiresIn: "30d"
            }
        );

        console.log(token)
        // 🔥 Set HttpOnly cookie
        setAuthCookie(res, token);

        res.json({
            success: true,
            user: freshUser
        });

    } catch (err) {
        console.error("Google auth error:", err);

        res.status(500).json({
            error: "Internal server error"
        });
    }
});

// ==========================
// 🔥 EMAIL SIGNUP
// ==========================
router.post("/signup", async (req, res) => {
    try {
        const { email, password, username } = req.body;

        let user = await User.findOne({ email });

        if (user) {
            return res.status(400).json({
                message: "Email already exists. Please login."
            });
        }

        const hashed = await bcrypt.hash(password, 10);

        user = await User.create({
            email,
            password: hashed,
            username,
            authProvider: "email",
            balance: {
                testnet: 100,
                locked: 0
            }
        });

        await syncUserBalance(user, {
            provider: "email"
        });

        const token = jwt.sign(
            {
                id: user._id.toString(),
                email: user.email,
                isAdmin: user.isAdmin || false

            },
            JWT_SECRET,
            {
                expiresIn: "30d"
            }
        );

        // 🔥 Set HttpOnly cookie
        setAuthCookie(res, token);

        res.json({
            success: true,
            user
        });

    } catch (err) {
        console.error("Signup error:", err);

        res.status(500).json({
            message: "Signup failed"
        });
    }
});

// ==========================
// 🔥 EMAIL LOGIN
// ==========================
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        // 🔍 Find user
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({
                message: "User not found"
            });
        }

        // ⚠️ Social login account
        if (!user.password) {
            return res.status(400).json({
                message: "This account was created with Google. Please use Google login."
            });
        }

        // 🔐 Compare password
        const match = await bcrypt.compare(
            password,
            user.password
        );

        if (!match) {
            return res.status(400).json({
                message: "Invalid credentials"
            });
        }

        // 🔥 Sync balance
        await syncUserBalance(user, {
            provider: "email"
        });

        // 🔥 Generate JWT
        const token = jwt.sign(
            {
                id: user._id.toString(),
                email: user.email,
                isAdmin: user.isAdmin || false

            },
            JWT_SECRET,
            {
                expiresIn: "30d"
            }
        );

        // 🔥 Set HttpOnly cookie
        setAuthCookie(res, token);

        res.json({
            success: true,
            user,
            debug: {
                telegramConnected: user.telegram?.connected,
                walletConnected: user.wallet?.connected,
                nftPaid: user.nft?.paid
            }
        });

    } catch (err) {
        console.error("Login error:", err);

        res.status(500).json({
            message: "Login failed"
        });
    }
});

// ==========================
// 🔥 GET CURRENT USER
// ==========================
router.get("/me", async (req, res) => {
    try {
        const token = req.cookies.token;

        if (!token) {
            return res.status(401).json({
                message: "Unauthorized"
            });
        }

        const decoded = jwt.verify(
            token,
            JWT_SECRET
        );

        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        res.json({
            success: true,
            user
        });

    } catch (err) {
        res.status(401).json({
            message: "Invalid token"
        });
    }
});

// ==========================
// 🔥 LOGOUT
// ==========================
router.post("/logout", (req, res) => {
    res.clearCookie("token");

    res.json({
        success: true,
        message: "Logged out successfully"
    });
});

module.exports = router;