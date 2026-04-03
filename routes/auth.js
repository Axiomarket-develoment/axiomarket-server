const express = require("express");
const router = express.Router();
const passport = require("../confiq/passport");
const bcrypt = require("bcryptjs");
const { OAuth2Client } = require("google-auth-library");

const User = require("../models/User");

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET;

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);


const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");

const client = jwksClient({
    jwksUri: "https://appleid.apple.com/auth/keys",
});

router.post("/google", async (req, res) => {
    const { token: accessToken } = req.body;

    try {
        const userInfoRes = await fetch(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            {
                headers: { Authorization: `Bearer ${accessToken}` },
            }
        );

        const payload = await userInfoRes.json();
        const { email, name, picture, sub: googleId } = payload;

        // 🔥 Normalize username (avoid duplicates)
        const username = name.replace(/\s+/g, "").toLowerCase();

        const googleData = {
            fullName: name,
            username,
            email,
            authProvider: "google",
            balance: { testnet: 100, locked: 0 },
            wallet: { address: "", privateKey: "" },
        };

        let user = await User.findOne({ email });

        // 🔥 Merge function (same logic as Twitter)
        const mergeUserData = (user, newData) => {
            let updated = false;

            for (const key in newData) {
                const newValue = newData[key];
                const oldValue = user[key];

                if (
                    typeof newValue === "object" &&
                    newValue !== null &&
                    !Array.isArray(newValue)
                ) {
                    if (!user[key]) user[key] = {};

                    for (const subKey in newValue) {
                        if (
                            oldValue?.[subKey] === undefined ||
                            oldValue?.[subKey] === null
                        ) {
                            user[key][subKey] = newValue[subKey];
                            updated = true;
                        }
                    }
                } else {
                    if (!oldValue && newValue !== undefined) {
                        user[key] = newValue;
                        updated = true;
                    }
                }
            }

            return updated;
        };

        // ==========================
        // CREATE OR UPDATE
        // ==========================
        if (user) {
            // Give bonus ONLY if never initialized
            if (!user.balance || user.balance.testnet === undefined) {
                user.balance = { testnet: 100, locked: 0 };
            }

            const updated = mergeUserData(user, googleData);
            if (updated) await user.save();
        } else {
            user = await User.create(googleData);
        }

        // ==========================
        // JWT
        // ==========================
        const jwtToken = jwt.sign(
            { id: user._id, email: user.email },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            success: true,
            token: jwtToken,
            user,
        });
    } catch (err) {
        console.error("Google auth error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.post("/signup", async (req, res) => {
    try {
        const { email, password, username } = req.body;

        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ message: "User exists" });

        const hashed = await bcrypt.hash(password, 10);

        const user = await User.create({
            email,
            password: hashed,
            username,
            balances: { testnet: 100 }
        });

        const token = jwt.sign({ id: user._id }, JWT_SECRET);

        res.json({ user, token });
    } catch (err) {
        res.status(500).json({ message: "Signup failed" });
    }
});


router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "User not found" });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(400).json({ message: "Invalid credentials" });

        const token = jwt.sign({ id: user._id }, JWT_SECRET);

        res.json({ user, token });
    } catch (err) {
        res.status(500).json({ message: "Login failed" });
    }
});



// ==========================
router.get("/twitter", (req, res, next) => {
    passport.authenticate("twitter")(req, res, next);
});

// ==========================
// Step 2: Twitter callback
// ==========================
router.get(
    "/twitter/callback",
    passport.authenticate("twitter"),
    async (req, res) => {
        try {
            const user = req.user;

            // Create JWT
            const token = jwt.sign({ id: user._id, admin: user.admin }, process.env.JWT_SECRET, {
                expiresIn: "7d",
            });

            // Serialize full user object for frontend
            const { admin, ...userWithoutAdmin } = user.toObject();

            const fullUser = {
                ...userWithoutAdmin,
                token,
            };

            const encodedUser = encodeURIComponent(
                Buffer.from(JSON.stringify(fullUser)).toString("base64")
            );

            const frontendUrl = process.env.USER_FRONTEND_URL || "http://localhost:5173";

            let redirectBase = frontendUrl;


            // Redirect to frontend with JWT + encoded user
            res.redirect(`${redirectBase}/market?token=${token}&user=${encodedUser}`);
        } catch (err) {
            console.error("Twitter callback error:", err);
            res.redirect(`${process.env.USER_FRONTEND_URL}`);
        }
    }
);


module.exports = router;