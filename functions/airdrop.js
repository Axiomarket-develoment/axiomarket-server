const User = require("../models/User");
const { getPrice } = require("../services/price/priceOracle");

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
            // 💰 set USD balance
            user.balance.testnet = usdAmount;

            // 🔄 convert to AVAX
            user.avaxBalance = Number((usdAmount / price).toFixed(4));

            user.usdBalance = usdAmount;
            user.lastBalanceUpdate = Date.now();

            await user.save();

            console.log(
                `💸 Airdropped $200 to ${user.email} | AVAX: ${user.avaxBalance}`
            );
        }

        console.log(`✅ Airdrop complete for ${users.length} users`);

    } catch (err) {
        console.error("❌ Airdrop failed:", err.message);
    }
}

module.exports = { airdropUsers };

 