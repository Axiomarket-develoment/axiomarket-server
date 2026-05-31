const Market = require("../../models/Market");
const Position = require("../../models/Position");
const User = require("../../models/User");
const calcUserBalance = require("../balance/calcUserBalance");
const { getIO } = require("../../websocket");
const { getPrice } = require("../price/priceOracle");

function round2(num) {
    return Math.floor(num * 100) / 100;
}

// ====================================
// SYNC USER UI BALANCE
// ====================================


// ====================================
// MARKET SETTLEMENT
// ====================================
async function settleMarket(market, winningOutcomeLabel) {

    if (!market) return;

    if (!["ENDED", "SETTLING"].includes(market.status)) {
        console.log("⏭ Market not ready for settlement");
        return;
    }

    if (!winningOutcomeLabel) {
        console.log("❌ Missing winning outcome");
        return;
    }

    market.result = winningOutcomeLabel.toUpperCase();

    console.log("\n==================================");
    console.log("🚀 STARTING MARKET SETTLEMENT");
    console.log(`Market: ${market._id}`);
    console.log(`Winner: ${market.result}`);
    console.log("==================================\n");

    const updatedUsers = new Set();

    for (const subMarket of market.subMarkets) {

        console.log(`\n📊 Submarket ${subMarket._id}`);

        let winningPool = 0;
        let losingPool = 0;

        for (const outcome of subMarket.outcomes) {

            outcome.pool = round2(outcome.pool);

            if (
                outcome.label.toUpperCase() === market.result
            ) {
                winningPool += outcome.pool;
            } else {
                losingPool += outcome.pool;
            }
        }

        winningPool = round2(winningPool);
        losingPool = round2(losingPool);

        console.log(`Winning Pool: ${winningPool}`);
        console.log(`Losing Pool: ${losingPool}`);

        const positions = await Position.find({
            marketId: market._id,
            subMarketId: subMarket._id
        });

        console.log(`Positions Found: ${positions.length}`);

        for (const position of positions) {

            const user = await User.findById(position.userId);

            if (!user) continue;

            updatedUsers.add(user._id.toString());

            const stake = round2(position.amount);

            const userOutcome =
                position.outcome.toUpperCase();

            console.log(
                `User ${user._id} | Stake ${stake}`
            );

            // ====================================
            // UNLOCK FUNDS
            // ====================================

            user.lockedUsd = round2(
                Math.max(
                    0,
                    (user.lockedUsd || 0) - stake
                )
            );

            let payout = 0;

            // ====================================
            // WINNER
            // ====================================

            if (userOutcome === market.result) {

                const share =
                    winningPool > 0
                        ? stake / winningPool
                        : 0;

                const payoutUsd = round2(stake + (share * losingPool));

                const avaxPrice = await getPrice("avalanche-2");

                const avaxPayout = avaxPrice
                    ? payoutUsd / avaxPrice
                    : 0;

                // 1. give real asset (AVAX)
                user.balances.AVAX = round2(
                    (user.balances.AVAX || 0) + avaxPayout
                );

                // 2. update PnL tracking
                user.usdBalance = round2(
                    (user.usdBalance || 0) + (payoutUsd - stake)
                );

                console.log(`✅ WINNER | payout ${payoutUsd}`);
            } else {

                user.usdBalance = round2(
                    (user.usdBalance || 0) - stake
                );

                console.log(`❌ LOSER | lost ${stake}`);
            }

            await user.save();
        }

        subMarket.status = "SETTLED";

        subMarket.outcomes = subMarket.outcomes.map(
            outcome => ({
                label: outcome.label,
                result:
                    outcome.label.toUpperCase() ===
                    market.result,
                odds: outcome.odds,
                pool: outcome.pool,
                liquidity: outcome.liquidity,
                volume: outcome.volume,
                count: outcome.count
            })
        );
    }

    // ====================================
    // RECALCULATE USER UI BALANCES
    // ====================================

    const io = getIO();

    for (const userId of updatedUsers) {

        const freshUser = await User.findById(userId);

        if (!freshUser) continue;

        io.to(userId.toString()).emit(
            "balance-update",
            {
                balances: freshUser.balances,
                usdBalance: freshUser.usdBalance,
                lockedUsd: freshUser.lockedUsd
            }
        );

        console.log(
            `🔄 Updated user ${userId}`
        );
    }

    market.status = "SETTLED";

    await market.save();

    console.log("\n==================================");
    console.log("🎯 MARKET SETTLED SUCCESSFULLY");
    console.log("==================================\n");
}

module.exports = {
    settleMarket
};