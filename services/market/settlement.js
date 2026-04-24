const Market = require("../../models/Market");
const Order = require("../../models/Order");
const Fill = require("../../models/Fill");
const User = require("../../models/User");
const { adminDb } = require("../../lib/firebaseAdmin");
const syncUserBalance = require("../../functions/syncUserBalance");
const Position = require("../../models/Position");

const Market = require("../../models/Market");
const Order = require("../../models/Order");
const Fill = require("../../models/Fill");
const User = require("../../models/User");
const { adminDb } = require("../../lib/firebaseAdmin");
const syncUserBalance = require("../../functions/syncUserBalance");
const Position = require("../../models/Position");

async function settleMarket(market, winningOutcomeLabel) {
    console.log("\n==============================");
    console.log("🚀 START SETTLEMENT");
    console.log("Market ID:", market._id);
    console.log("Question:", market.question);
    console.log("==============================\n");

    if (!market || market.status !== "ENDED") {
        console.log("❌ Market not eligible for settlement");
        return;
    }

    if (!winningOutcomeLabel) {
        console.log("❌ No outcome provided");
        return;
    }

    market.result = winningOutcomeLabel.toUpperCase();
    console.log("🏁 Winning Outcome:", market.result);

    for (const sub of market.subMarkets) {
        console.log("\n--- SUB MARKET ---");
        console.log("SubMarket ID:", sub._id);

        let totalWinningPool = 0;
        let totalLosingPool = 0;

        // 1️⃣ Pools breakdown
        sub.outcomes.forEach(o => {
            o.pool = Number(o.pool.toFixed(2));

            console.log(`Outcome: ${o.label} | Pool: ${o.pool}`);

            if (o.label.toUpperCase() === market.result) {
                totalWinningPool += o.pool;
            } else {
                totalLosingPool += o.pool;
            }
        });

        console.log("🟢 Total Winning Pool:", totalWinningPool);
        console.log("🔴 Total Losing Pool:", totalLosingPool);

        sub.status = "SETTLED";

        // 2️⃣ Fetch fills
        const positions = await Position.find({
            marketId: market._id,
            subMarketId: sub._id
        });

        console.log("👥 Total Participants:", positions.length);

        if (!positions.length) {
            console.log("⚠ No participants — skipping payouts but marking settled");
            continue;
        }

        for (const position of positions) {
            const user = await User.findById(position.userId);
            if (!user) continue;

            const userOutcome = position.outcome.toUpperCase();
            const userAmount = Number(position.amount.toFixed(2));

            console.log("\n👤 USER:", user._id);
            console.log("Bet:", userAmount, "| Outcome:", userOutcome);

            // 🔓 Unlock funds
            user.balance.locked -= userAmount;
            user.balance.locked = Math.max(0, user.balance.locked);

            let payout = 0;

            if (userOutcome === market.result) {
                const share = totalWinningPool > 0 ? userAmount / totalWinningPool : 0;

                payout = userAmount + share * totalLosingPool;
                payout = Number(payout.toFixed(2));

                user.balance.testnet += payout;

                console.log("✅ WINNER → payout:", payout);
            } else {
                console.log("❌ LOSER");
            }

            user.balance.testnet = Number(user.balance.testnet.toFixed(2));

            await user.save();
            await syncUserBalance(user);

            console.log("🔄 Synced to Firebase");
        }

        // 4️⃣ Mark results
        sub.outcomes = sub.outcomes.map(o => ({
            ...o.toObject(),
            result: o.label.toUpperCase() === market.result
        }));

        console.log("✅ SubMarket settled");
    }

    // 5️⃣ Finalize market
    market.status = "SETTLED";
    await market.save();

    console.log("\n📦 Market status updated to SETTLED");

    // 6️⃣ Firestore sync
    await adminDb.collection("markets").doc(market._id.toString()).set({
        status: market.status,
        result: market.result,
        subMarkets: market.subMarkets.map(sub => ({
            id: sub._id.toString(),
            outcomes: sub.outcomes.map(o => ({
                label: o.label,
                result: o.result,
                odds: o.odds,
                liquidity: o.liquidity,
                volume: o.volume,
                pool: Number(o.pool.toFixed(2)),
                count: o.count
            })),
            status: sub.status,
            totalVolume: Number(sub.totalVolume.toFixed(2)),
            tradeCount: sub.tradeCount
        }))
    }, { merge: true });

    console.log("☁️ Firestore updated");

    console.log("\n==============================");
    console.log("🎉 SETTLEMENT COMPLETE");
    console.log("==============================\n");
}

module.exports = { settleMarket };

module.exports = { settleMarket };