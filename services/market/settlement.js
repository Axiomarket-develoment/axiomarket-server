const Market = require("../../models/Market");
const Order = require("../../models/Order");
const Fill = require("../../models/Fill");
const User = require("../../models/User");
const { adminDb } = require("../../lib/firebaseAdmin");
const syncUserBalance = require("../../functions/syncUserBalance");

  

async function settleMarket(market, outcome) {
    console.log("++++++++++++++ Settling market:", market._id);

    // ✅ Validate
    if (!market || market.status !== "ENDED") {
        console.log("❌ Market is invalid or not ended.");
        return;
    }

    // ✅ Set result
    market.result = outcome.toUpperCase();

    console.log(`⚡ Starting settlement for: ${market.question}`);
    console.log(`🎯 Result: ${market.result}`);

    // ==========================
    // 1️⃣ Update outcomes
    // ==========================
    for (const subMarket of market.subMarkets) {
        subMarket.outcomes = subMarket.outcomes.map(o => ({
            ...o.toObject(),
            result: o.label.toUpperCase() === market.result
        }));

        subMarket.status = "SETTLED";
    }

    // ==========================
    // 2️⃣ Get all FILLS (REAL TRADES)
    // ==========================
    const fills = await Fill.find({
        marketId: market._id
    });

    console.log(`📊 Total fills: ${fills.length}`);

    // ==========================
    // 3️⃣ Process each trade
    // ==========================
    for (const fill of fills) {
        const buyOrder = await Order.findById(fill.buyOrderId);
        const sellOrder = await Order.findById(fill.sellOrderId);

        if (!buyOrder || !sellOrder) continue;

        const tradeAmount = fill.amount;

        const buyUser = await User.findById(buyOrder.userId);
        const sellUser = await User.findById(sellOrder.userId);


        if (!buyUser || !sellUser) continue;

        console.log("🔄 Processing trade:");
        console.log(`   Trade amount: ${tradeAmount}`);
        console.log(`   Buy user: ${buyUser._id}`);
        console.log(`   Sell user: ${sellUser._id}`);

        // ==========================
        // 🎯 WINNER LOGIC
        // ==========================
        if (market.result === "YES") {
            // Buyer wins
            const payout = tradeAmount * 2;

            console.log(`   ✅ BUYER WINS → payout: ${payout}`);

            buyUser.balance.testnet += payout;

        } else {
            // Seller wins
            const payout = tradeAmount * 2;

            console.log(`   ✅ SELLER WINS → payout: ${payout}`);

            sellUser.balance.testnet += payout;
        }

        console.log("Syncing buy user balance:", buyUser._id, buyUser.balance);
        console.log("Syncing sell user balance:", sellUser._id, sellUser.balance);

        console.log("BuyUser _id type:", typeof buyUser._id, buyUser._id);
        console.log("SellUser _id type:", typeof sellUser._id, sellUser._id);


        // ==========================
        // 🔓 UNLOCK FUNDS (BOTH SIDES)
        // ==========================
       

        // UNLOCK BOTH
        buyUser.balance.locked -= tradeAmount;
        sellUser.balance.locked -= tradeAmount;

        // SAFETY
        buyUser.balance.locked = Math.max(0, buyUser.balance.locked);
        sellUser.balance.locked = Math.max(0, sellUser.balance.locked);

        // SAVE
        await buyUser.save();
        await sellUser.save();

        // 🔥 SYNC BOTH USERS (VERY IMPORTANT)
        console.log("syncUserBalance type:", typeof syncUserBalance);
        await syncUserBalance(buyUser);
        await syncUserBalance(sellUser);
    }

    // ==========================
    // 4️⃣ Mark orders as settled
    // ==========================
    await Order.updateMany(
        { marketId: market._id },
        { status: "SETTLED" }
    );

    // ==========================
    // 5️⃣ Finalize market
    // ==========================
    market.status = "SETTLED";
    await market.save();

    console.log("✅ Market settled in DB");

    // ==========================
    // 6️⃣ Firestore Sync
    // ==========================
    await adminDb.collection("markets").doc(market._id.toString()).set({
        status: market.status,
        result: market.result,
        subMarkets: market.subMarkets.map(sub => ({
            id: sub._id.toString(),
            outcomes: sub.outcomes.map(o => ({
                label: o.label,
                result: o.result,
                odds: o.odds,
                liquidity: o.liquidity,
                volume: o.volume
            })),
            status: sub.status,
            totalVolume: sub.totalVolume,
            tradeCount: sub.tradeCount
        }))
    }, { merge: true });

    console.log(`⚡ Firestore synced`);
    console.log(`🎯 FULLY SETTLED: ${market.question}`);
}

module.exports = { settleMarket };