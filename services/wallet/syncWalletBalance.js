const User = require("../../models/User");
const calcUserBalance = require("../balance/calcUserBalance");

async function syncWalletBalances() {
    try {
        console.log("🔄 Wallet sync started...");

        const users = await User.find({});

        for (const user of users) {
            const updated = await calcUserBalance(user);

            await User.updateOne(
                { _id: user._id },
                { $set: updated }
            );
        }

        console.log(`✅ Wallet sync complete: ${users.length} users`);

    } catch (err) {
        console.error("❌ Wallet sync failed:", err.message);
    }
}

module.exports = { syncWalletBalances };