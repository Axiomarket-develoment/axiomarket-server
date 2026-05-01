const Market = require("../../models/Market");
const Position = require("../../models/Position");
const User = require("../../models/User");
const calcUserBalance = require("../balance/calcUserBalance");
const { getIO } = require("../../websocket");

function round2(n) {
    return Math.floor(n * 100) / 100;
}


async function syncUserBalance(user, options = {}) {
    if (!user?._id) return;

    try {
        const computed = await calcUserBalance(user, options);

        const updatePayload = {
            avaxBalance: computed.avaxBalance,
            lastBalanceUpdate: computed.lastBalanceUpdate,
        };

        await User.updateOne(
            { _id: user._id },
            { $set: updatePayload }
        );

        console.log(`🔄 Synced balance → User: ${user._id}`);

        return computed;

    } catch (err) {
        console.log("❌ syncUserBalance error:", err.message);
    }
}

async function settleMarket(market, winningOutcomeLabel) {
    if (!market || !["ENDED", "SETTLING"].includes(market.status)) {
        console.log("⏭ Market not ready for settlement");
        return;
    }

    const updatedUsers = new Set();
    if (!winningOutcomeLabel) {
        console.log("❌ No winning outcome provided");
        return;
    }

    market.result = winningOutcomeLabel.toUpperCase();

    console.log(`\n🚀 START SETTLEMENT`);
    console.log(`Market ID: ${market._id}`);
    console.log(`Question: ${market.question}`);
    console.log(`🏁 Winning Outcome: ${market.result}`);
    console.log(`==============================\n`);

    for (const sub of market.subMarkets) {

        console.log(`--- SUB MARKET ---`);
        console.log(`SubMarket ID: ${sub._id}`);

        let totalWinningPool = 0;
        let totalLosingPool = 0;

        sub.outcomes.forEach(o => {
            o.pool = round2(o.pool);

            console.log(`Outcome: ${o.label} | Pool: ${o.pool}`);

            if (o.label.toUpperCase() === market.result) {
                totalWinningPool += o.pool;
            } else {
                totalLosingPool += o.pool;
            }
        });

        console.log(`💰 Total Winning Pool: ${totalWinningPool}`);
        console.log(`💸 Total Losing Pool: ${totalLosingPool}`);

        sub.status = "SETTLED";

        const positions = await Position.find({
            marketId: market._id,
            subMarketId: sub._id
        });

        console.log(`👥 Positions Found: ${positions.length}`);

        for (const position of positions) {
            const user = await User.findById(position.userId);
            if (!user) {
                console.log(`⚠️ User not found for position ${position._id}`);
                continue;
            }

            updatedUsers.add(user._id.toString());

            const amount = round2(position.amount);
            const outcome = position.outcome.toUpperCase();

            console.log(`\n➡️ Processing Position`);
            console.log(`User: ${user._id}`);
            console.log(`Bet: ${amount} on ${outcome}`);




            // 🔓 Unlock funds
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

                console.log(`✅ WINNER`);
                console.log(`Share: ${share}`);
                console.log(`Payout: ${payout}`);

                user.balance.testnet = round2(
                    user.balance.testnet + payout
                );
            } else {
                console.log(`❌ LOSER`);
            }

            await user.save();

            console.log(`💼 Updated Balance → Testnet: ${user.balance.testnet}, Locked: ${user.balance.locked}`);


        }


        // after ALL positions processed

        const io = getIO();

        for (const userId of updatedUsers) {
            const freshUser = await User.findById(userId);

            const updated = await syncUserBalance(freshUser, {
                provider: "settlement"
            });

            io.to(userId.toString()).emit("balance-update", {
                testnet: updated.balance?.testnet ?? freshUser.balance.testnet,
                locked: updated.balance?.locked ?? freshUser.balance.locked,
                avaxBalance: updated.avaxBalance ?? freshUser.avaxBalance
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

        console.log(`✅ Submarket settled\n`);
    }

    market.status = "SETTLED";
    await market.save();

    console.log(`🎯 MARKET FULLY SETTLED`);
    console.log(`====================================\n`);
}

module.exports = { settleMarket };