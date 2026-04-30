// services/balance/calcUserBalance.js

const { getPrice } = require("../price/priceOracle");

function round2(num) {
    return Math.floor(num * 100) / 100;
}

async function calcUserBalance(user, options = {}) {
    const price = await getPrice("avalanche-2");

    let avaxBalance = user.avaxBalance || 0;

    // if price exists → recalc
    if (price && price > 0) {
        avaxBalance = round2(user.balance.testnet / price);
    }

    return {
        avaxBalance: round2(avaxBalance),
        usdBalance: round2(user.balance?.testnet || 0),
        lastBalanceUpdate: Date.now(),
        authProvider: options.provider || user.authProvider,
        lastLogin: Date.now()
    };
}

module.exports = calcUserBalance;