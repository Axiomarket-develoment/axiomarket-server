// services/balance/calcUserBalance.js

const { getPrice } = require("../price/priceOracle");

function round2(num) {
    return Math.floor(num * 100) / 100;
}

async function calcUserBalance(user, options = {}) {
    const price = await getPrice("avalanche-2");

    let avaxBalance = user.avaxBalance || 0;

    if (price && price > 0) {
        avaxBalance = round2(user.balance.testnet / price);
    }

    return {
        avaxBalance,
        usdBalance: round2(user.balance?.testnet || 0),
        lastBalanceUpdate: Date.now()
    };
}

module.exports = calcUserBalance;