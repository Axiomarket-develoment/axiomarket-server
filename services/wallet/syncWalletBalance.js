// const { adminDb } = require("../../lib/firebaseAdmin");
const User = require("../../models/User");
const { getPrice } = require("../price/priceOracle");

// async function syncWalletBalances() {
//     try {
//         console.log("🔄 Wallet sync started...");

//         const avaxPrice = getPrice("avalanche-2");

//         if (!avaxPrice) {
//             console.log("⚠️ No AVAX price available");
//             return;
//         }

//         const users = await User.find({});
//         const batch = adminDb.batch();

//         for (const user of users) {
//             const avaxBalance =
//                 avaxPrice > 0
//                     ? Number((user.balance.testnet / avaxPrice).toFixed(2))
//                     : 0;
//             const ref = adminDb.collection("users").doc(user._id.toString());

//             batch.set(ref, {
//                 avaxBalance: Number(avaxBalance.toFixed(4)),
//                 usdBalance: Number((user.balance.testnet || 0).toFixed(2)),
//                 lastBalanceUpdate: Date.now(),
//             }, { merge: true });
//         }

//         await batch.commit();

//         console.log(`✅ Wallet sync complete: ${users.length} users`);
//     } catch (err) {
//         console.error("❌ Wallet sync failed:", err.message);
//     }
// }
// const User = require("../../models/User");
// const { getPrice } = require("../price/priceOracle");

async function syncWalletBalances() {
    try {
        console.log("🔄 Wallet sync started...");

        const avaxPrice = getPrice("avalanche-2");

        if (!avaxPrice) {
            console.log("⚠️ No AVAX price available");
            return;
        }

        const users = await User.find({});

        for (const user of users) {
            const avaxBalance =
                avaxPrice > 0
                    ? Number((user.balance.testnet / avaxPrice).toFixed(2))
                    : 0;

            user.avaxBalance = Number(avaxBalance.toFixed(4));
            // console.log(`Updating balance for user ${user.username}: ${user.avaxBalance} AVAX`);
            user.usdBalance = Number((user.balance.testnet || 0).toFixed(2));
            user.lastBalanceUpdate = Date.now();

            await user.save();
        }

        console.log(`✅ Wallet sync complete: ${users.length} users`);
    } catch (err) {
        console.error("❌ Wallet sync failed:", err.message);
    }
}

module.exports = { syncWalletBalances };

module.exports = { syncWalletBalances };