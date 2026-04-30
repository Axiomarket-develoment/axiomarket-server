const express = require("express");
const router = express.Router();
const passport = require("../confiq/passport");
const bcrypt = require("bcryptjs");
const fetch = require("node-fetch");

const User = require("../models/User");
// const { adminDb } = require("../lib/firebaseAdmin");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;
const { getPrice } = require("../services/price/priceOracle");
const calcUserBalance = require("../services/balance/calcUserBalance");



async function syncUserBalance(user, options = {}) {
    if (!user?._id) return;

    const updated = await calcUserBalance(user, options);

    await User.updateOne(
        { _id: user._id },
        { $set: updated }
    );

    return updated;
}

router.post("/google", async (req, res) => {
    try {
        const { token: accessToken } = req.body;

        const userInfoRes = await fetch(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        const payload = await userInfoRes.json();
        const { email, name } = payload;

        if (!email) {
            return res.status(400).json({ error: "No email from Google" });
        }

        const username = name?.replace(/\s+/g, "").toLowerCase() || email.split("@")[0];

        let user = await User.findOne({ email });

        // ✅ If NOT exist → create
        if (!user) {
            user = await User.create({
                email,
                fullName: name,
                username,
                authProvider: "google",
                balance: { testnet: 100, locked: 0 },
                wallet: { address: "", privateKey: "" },
            });
        }

        // 🔥 Always sync to Firestore
        await syncUserBalance(user, "");

        // JWT
        const token = jwt.sign(
            {
                id: user._id.toString(),
                email: user.email
            },
            JWT_SECRET,
            { expiresIn: "30d" }
        );

        res.json({ success: true, token, user });

    } catch (err) {
        console.error("Google auth error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});


router.post("/check-token", async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                valid: false,
                message: "No token provided"
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        return res.json({
            valid: true,
            expired: false,
            userId: decoded.id,
            email: decoded.email || null
        });

    } catch (err) {
        if (err.name === "TokenExpiredError") {
            return res.status(401).json({
                valid: false,
                expired: true,
                message: "Token expired"
            });
        }

        return res.status(401).json({
            valid: false,
            expired: false,
            message: "Invalid token"
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
            return res.status(400).json({ message: "Email already exists. Please login." });
        }

        const hashed = await bcrypt.hash(password, 10);

        user = await User.create({
            email,
            password: hashed,
            username,
            authProvider: "email",
            balance: { testnet: 100, locked: 0 }
        });

        await syncUserBalance(user, { provider: "email" });

        const token = jwt.sign(
            {
                id: user._id.toString(),
                email: user.email
            },
            JWT_SECRET,
            { expiresIn: "30d" }
        );
        res.json({ user, token });

    } catch (err) {
        res.status(500).json({ message: "Signup failed" });
    }
});

// ==========================
// 🔥 EMAIL LOGIN
// ==========================
router.post("/login", async (req, res) => {
    console.log("📥 LOGIN REQUEST RECEIVED");

    try {
        const { email, password } = req.body;
        console.log("📧 Email:", email);
        console.log("🔑 Password provided:", !!password);

        // 1️⃣ Find user
        const user = await User.findOne({ email });
        console.log("🔍 User lookup result:", user ? "FOUND" : "NOT FOUND");

        if (!user) {
            console.log("❌ User not found");
            return res.status(400).json({ message: "User not found" });
        }

        // 2️⃣ Check auth provider
        console.log("🧠 Auth provider:", user.auhtProvider);
        if (!user.password) {
            console.log("⚠️ No password set (social login user)");
            return res.status(400).json({
                message: "This account was created with Google/Twitter. Please use that method."
            });
        }

        // 3️⃣ Compare password
        const match = await bcrypt.compare(password, user.password);
        console.log("🔐 Password match:", match);

        if (!match) {
            console.log("❌ Invalid password");
            return res.status(400).json({ message: "Invalid credentials" });
        }

        // 4️⃣ Telegram status
        console.log("📲 Telegram connected:", user.telegram?.connected);
        console.log("🎟️ Telegram token:", user.telegramToken);

        // 5️⃣ Wallet status
        console.log("💰 Wallet connected:", user.wallet?.connected);

        // 6️⃣ NFT status
        console.log("🖼️ NFT paid:", user.nft?.paid);

        // 7️⃣ Sync Firestore
        console.log("🔥 Syncing to Firestore...");
        await syncUserBalance(user, { provider: "email" });
        console.log("✅ Firestore sync complete");

        // 8️⃣ Generate token
        const token = jwt.sign(
            {
                id: user._id.toString(),
                email: user.email
            },
            JWT_SECRET,
            { expiresIn: "30d" }
        );

        console.log("🎫 JWT generated");

        // 9️⃣ Final response
        console.log("✅ LOGIN SUCCESS");

        res.json({
            user,
            token,
            debug: {
                telegramConnected: user.telegram?.connected,
                walletConnected: user.wallet?.connected,
                nftPaid: user.nft?.paid
            }
        });

    } catch (err) {
        console.error("💥 LOGIN ERROR:", err);
        res.status(500).json({ message: "Login failed" });
    }
});
// ==========================
// 🔥 TWITTER AUTH
// ==========================
router.get("/twitter", passport.authenticate("twitter"));

router.get(
    "/twitter/callback",
    passport.authenticate("twitter"),
    async (req, res) => {
        try {
            let user = req.user;

            // 🔥 CRITICAL: Merge by email if exists
            if (user.email) {
                const existing = await User.findOne({ email: user.email });

                if (existing) {
                    user = existing; // use existing account
                }
            }

            await syncUserBalance(user, { provider: "twitter" });

            const token = jwt.sign(
                { id: user._id },
                JWT_SECRET,
                { expiresIn: "7d" }
            );

            const encodedUser = encodeURIComponent(
                Buffer.from(JSON.stringify({ ...user.toObject(), token })).toString("base64")
            );

            const frontendUrl = process.env.USER_FRONTEND_URL || "http://localhost:5173";

            res.redirect(`${frontendUrl}/market?token=${token}&user=${encodedUser}`);

        } catch (err) {
            console.error("Twitter callback error:", err);
            res.redirect(process.env.USER_FRONTEND_URL);
        }
    }
);

module.exports = router;