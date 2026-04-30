const Market = require("../../models/Market");
const Position = require("../../models/Position");
const User = require("../../models/User");

function round2(n) {
    return Math.floor(n * 100) / 100;
}


async function syncUserBalance(user, options = {}) {
    if (!user?._id) return;

    try {
        const computed = await calcUserBalance(user, options);

        const updatePayload = {
            ...computed,

            balance: {
                testnet: user.balance?.testnet || 0,
                locked: user.balance?.locked || 0,
            },
        };

        await User.updateOne(
            { _id: user._id },
            { $set: updatePayload }
        );

        return updatePayload;

    } catch (err) {
        console.log("❌ syncUserBalance error:", err.message);
    }
}


async function settleMarket(market, winningOutcomeLabel) {
    if (!market || market.status !== "ENDED") return;
    if (!winningOutcomeLabel) return;

    market.result = winningOutcomeLabel.toUpperCase();

    for (const sub of market.subMarkets) {

        let totalWinningPool = 0;
        let totalLosingPool = 0;

        sub.outcomes.forEach(o => {
            o.pool = round2(o.pool);

            if (o.label.toUpperCase() === market.result) {
                totalWinningPool += o.pool;
            } else {
                totalLosingPool += o.pool;
            }
        });

        sub.status = "SETTLED";

        const positions = await Position.find({
            marketId: market._id,
            subMarketId: sub._id
        });

        for (const position of positions) {
            const user = await User.findById(position.userId);
            if (!user) continue;

            const amount = round2(position.amount);
            const outcome = position.outcome.toUpperCase();

            // 🔓 ONLY raw balance mutation
            user.balance.locked = Math.max(
                0,
                round2(user.balance.locked - amount)
            );

            let payout = 0;

            if (outcome === market.result) {
                const share =
                    totalWinningPool > 0 ? amount / totalWinningPool : 0;

                payout = amount + share * totalLosingPool;
                payout = round2(payout);

                user.balance.testnet = round2(
                    user.balance.testnet + payout
                );
            }

            // ❌ NO MORE COMPLEX LOGIC HERE
            await user.save();

            // 🔥 SINGLE SOURCE OF TRUTH SYNC
            await syncUserBalance(user, {
                provider: "settlement"
            });
        }

        sub.outcomes = sub.outcomes.map(o => ({
            label: o.label,
            result: o.label.toUpperCase() === market.result,
            odds: o.odds,
            pool: o.pool,
            liquidity: o.liquidity,
            volume: o.volume,
            count: o.count
        }));
    }

    market.status = "SETTLED";
    await market.save();
}

module.exports = { settleMarket };