const { adminDb } = require("../lib/firebaseAdmin");

const roundTo2 = (num) => Math.floor(num * 100) / 100;

const syncUserBalance = async (user) => {
    if (!user?._id) return;

    const docId = typeof user._id === "string" ? user._id : user._id.toString();

    const cleanedBalance = {
        testnet: roundTo2(user.balance?.testnet || 0),
        locked: roundTo2(user.balance?.locked || 0),
    };

    await adminDb.collection("users")
        .doc(docId)
        .set({
            balance: cleanedBalance,
            lastBalanceUpdate: Date.now()
        }, { merge: true });
};

module.exports = syncUserBalance;