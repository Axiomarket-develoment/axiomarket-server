const { adminDb } = require("../lib/firebaseAdmin");
const User = require("../models/User");

const roundTo2 = (num) => Math.floor(num * 100) / 100;

// const syncUserBalance = async (user) => {
//     if (!user?._id) return;

//     const docId = typeof user._id === "string" ? user._id : user._id.toString();

//     const cleanedBalance = {
//         testnet: roundTo2(user.balance?.testnet || 0),
//         locked: roundTo2(user.balance?.locked || 0),
//     };

//     await adminDb.collection("users")
//         .doc(docId)
//         .set({
//             balance: cleanedBalance,
//             lastBalanceUpdate: Date.now()
//         }, { merge: true });
// };


const syncUserBalance = async (user) => {
    if (!user?._id) return;

    const cleanedBalance = {
        testnet: Math.floor((user.balance?.testnet || 0) * 100) / 100,
        locked: Math.floor((user.balance?.locked || 0) * 100) / 100,
    };

    await User.updateOne(
        { _id: user._id },
        {
            $set: {
                balance: cleanedBalance,
                lastBalanceUpdate: Date.now()
            }
        }
    );
};


module.exports = syncUserBalance;