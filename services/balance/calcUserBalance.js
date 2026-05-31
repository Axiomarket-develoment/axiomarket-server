const { getPrice } = require("../price/priceOracle");

function round2(num) {
    return Math.floor(num * 100) / 100;
}

async function calcUserBalance(user) {
    const price = await getPrice("avalanche-2");

    let avaxBalance = user.balances?.AVAX || 0;

    // optional USD view (derived, not stored truth)
    const usdBalance = price
        ? round2(avaxBalance * price)
        : 0;

    return {
        avaxBalance: round2(avaxBalance),
        usdBalance,
        lockedUsd: user.lockedUsd || 0,
        lastBalanceUpdate: Date.now()
    };
}

module.exports = calcUserBalance;