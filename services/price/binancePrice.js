const axios = require("axios");
const { BINANCE_SYMBOLS } = require("../../confiq/priceFeeds");

async function fetchBinancePrice(token) {
    try {
        const symbol = BINANCE_SYMBOLS[token];
        if (!symbol) throw new Error(`No Binance symbol for ${token}`);

        const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
        const response = await axios.get(url);
        return parseFloat(response.data.price);
    } catch (err) {
        console.warn(`⚠️ Binance price fetch failed for ${token}: ${err.message}`);
        return null;
    }
}


module.exports = { fetchBinancePrice };

// Test for binance data prrice below

// Example usage
// (async () => {
//     console.log("📡 Fetching ALL Binance prices...\n");

//     for (const token of Object.keys(BINANCE_SYMBOLS)) {
//         const price = await fetchBinancePrice(token);

//         if (price !== null) {
//             console.log(`💰 ${token} price (Binance): $${price}`);
//         } else {
//             console.log(`❌ Could not fetch price for ${token}`);
//         }
//     }

//     console.log("\n✅ Binance test complete.");
// })();