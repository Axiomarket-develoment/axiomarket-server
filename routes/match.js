const express = require("express");
const router = express.Router();

const Match = require("../models/Match");

router.post("/create_matches", async (req, res) => {
    try {

        const matches = req.body;

        if (!Array.isArray(matches)) {
            return res.status(400).json({
                success: false,
                message: "Body must be an array of matches"
            });
        }

        // 1. Remove duplicates INSIDE request (by slug)
        const uniqueMap = new Map();

        for (const match of matches) {
            uniqueMap.set(match.slug, match);
        }

        const uniqueMatches = Array.from(uniqueMap.values());

        const slugs = uniqueMatches.map(m => m.slug);

        // 2. Check DB for existing slugs
        const existingMatches = await Match.find(
            { slug: { $in: slugs } },
            { slug: 1 }
        );

        const existingSlugs = new Set(
            existingMatches.map(m => m.slug)
        );

        // 3. Filter only new matches
        const newMatches = uniqueMatches.filter(
            m => !existingSlugs.has(m.slug)
        );

        if (newMatches.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No new matches to insert",
                count: 0
            });
        }

        // 4. Insert only new ones
        const createdMatches = await Match.insertMany(newMatches);

        return res.status(201).json({
            success: true,
            inserted: createdMatches.length,
            skipped: uniqueMatches.length - newMatches.length,
            data: createdMatches
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

router.get("/get_matches", async (req, res) => {
    try {
        const matches = await Match.find().sort({ startTime: 1 });

        return res.status(200).json({
            success: true,
            count: matches.length,
            data: matches,
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

router.get("/get_teams", async (req, res) => {
    try {
        const matches = await Match.find();

        const teamMap = new Map();

        for (const match of matches) {
            const home = match.homeTeam;
            const away = match.awayTeam;

            if (home?.name) {
                teamMap.set(home.name, home);
            }

            if (away?.name) {
                teamMap.set(away.name, away);
            }
        }

        const teams = Array.from(teamMap.values());

        return res.status(200).json({
            success: true,
            count: teams.length,
            data: teams
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

module.exports = router;