const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../../models/User");
const setAuthCookie = require("../../utils/setAuthCookie");
const auth = require("../../middlewave/auth");

router.post("/signup", async (req, res) => {
    try {
        const { email, password, username } = req.body;

        // 1. check if exists
        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(400).json({ message: "User already exists" });
        }

        // 2. hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // 3. create admin user
        const user = await User.create({
            email,
            password: hashedPassword,
            username,
            isAdmin: true, // 🔥 IMPORTANT
        });

        // 4. create token
        const token = jwt.sign(
            {
                id: user._id,
                isAdmin: true,
            },
            process.env.JWT_SECRET,
            { expiresIn: "30d" }
        );

        // 5. set cookie
        setAuthCookie(res, token);

        return res.json({
            success: true,
            user: {
                _id: user._id,
                email: user.email,
                username: user.username,
                isAdmin: true,
            },
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server error" });
    }
});



router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. find user
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        // 2. check password
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        // 3. MUST BE ADMIN
        if (!user.isAdmin) {
            return res.status(403).json({ message: "Not an admin" });
        }

        // 4. create token
        const token = jwt.sign(
            {
                id: user._id,
                isAdmin: true,
            },
            process.env.JWT_SECRET,
            { expiresIn: "30d" }
        );

        // 5. set cookie
        setAuthCookie(res, token);

        return res.json({
            success: true,
            user: {
                _id: user._id,
                email: user.email,
                username: user.username,
                isAdmin: true,
            },
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server error" });
    }
});

router.get("/check_me", auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("isAdmin");

        return res.json({
            success: true,
            isAdmin: true
        });

    } catch (error) {
        console.log(error);

        return res.status(500).json({
            success: false,
            isAdmin: true,
            message: "Server error"
        });
    }
});

router.put("/toggle_admin", async (req, res) => {
    try {
        const { id } = req.body;

        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // toggle admin
        user.isAdmin = !user.isAdmin;

        await user.save();

        return res.json({
            success: true,
            message: `User admin set to ${user.isAdmin}`,
            isAdmin: user.isAdmin
        });

    } catch (error) {
        console.log(error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

module.exports = router;