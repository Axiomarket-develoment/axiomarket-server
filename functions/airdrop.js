const User = require("../models/User");
const { getPrice } = require("../services/price/priceOracle");
const { getIO } = require("../websocket");

async function airdropUsers() {
    try {
        console.log("🚀 Starting $200 airdrop...");

        const price = await getPrice("avalanche-2");

        if (!price || price <= 0) {
            console.log("❌ No AVAX price available. Abort airdrop.");
            return;
        }

        const users = await User.find({});

        const usdAmount = 200;

        for (const user of users) {
            const usdAmount = 200;

            const currentTestnet = user.balance?.testnet || 0;
            const currentAvax = user.avaxBalance || 0;
            const currentUsd = user.usdBalance || 0;

            // ✅ round helper
            const round2 = (num) => Number(num.toFixed(2));
            const round4 = (num) => Number(num.toFixed(4));

            // 💰 ADD + round
            user.balance.testnet = round2(currentTestnet + usdAmount);

            const avaxToAdd = round4(usdAmount / price);
            user.avaxBalance = round4(currentAvax + avaxToAdd);

            user.usdBalance = round2(currentUsd + usdAmount);

            user.lastBalanceUpdate = Date.now();

            await user.save();

            const io = getIO();

            io.to(user._id.toString()).emit("balance-update", {
                testnet: user.balance.testnet,
                locked: user.balance.locked ?? 0,
                avaxBalance: user.avaxBalance
            });

            console.log(`💸 Airdropped to ${user.email}`);
        }

        console.log(`✅ Airdrop complete for ${users.length} users`);

    } catch (err) {
        console.error("❌ Airdrop failed:", err.message);
    }
}

module.exports = { airdropUsers };

