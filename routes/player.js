const express = require("express");
const router = express.Router();

const Player = require("../models/Player");

// ================= CREATE PLAYERS =================
router.post("/create_players", async (req, res) => {
    try {

        const players = req.body;

        if (!Array.isArray(players)) {
            return res.status(400).json({
                success: false,
                message: "Body must be an array of players"
            });
        }

        // REMOVE DUPLICATES INSIDE REQUEST
        const uniqueMap = new Map();

        for (const player of players) {
            uniqueMap.set(player.playerId, player);
        }

        const uniquePlayers = Array.from(uniqueMap.values());

        const playerIds = uniquePlayers.map(p => p.playerId);

        // CHECK EXISTING PLAYERS
        const existingPlayers = await Player.find(
            { playerId: { $in: playerIds } },
            { playerId: 1 }
        );

        const existingIds = new Set(
            existingPlayers.map(p => p.playerId)
        );

        const slugify = (name) =>
            name
                .toLowerCase()
                .trim()
                .replace(/ /g, "-")
                .replace(/[^\w-]+/g, "");

        // FILTER NEW PLAYERS
        const newPlayers = uniquePlayers
            .filter(p => !existingIds.has(p.playerId))
            .map(p => ({
                ...p,
                slug: slugify(p.name)
            }));

        if (newPlayers.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No new players to insert",
                count: 0
            });
        }

        // INSERT
        const createdPlayers = await Player.insertMany(newPlayers);

        return res.status(201).json({
            success: true,
            inserted: createdPlayers.length,
            skipped: uniquePlayers.length - newPlayers.length,
            data: createdPlayers
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


// ================= GET PLAYERS =================
router.get("/get_players", async (req, res) => {
    try {

        const players = await Player.find().sort({ name: 1 });

        return res.status(200).json({
            success: true,
            count: players.length,
            data: players
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


// ================= SEARCH PLAYERS =================
router.get("/search_players", async (req, res) => {
    try {

        const q = req.query.q || "";

        const players = await Player.find({
            name: { $regex: q, $options: "i" }
        }).limit(20);

        return res.status(200).json({
            success: true,
            count: players.length,
            data: players
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;