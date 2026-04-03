const axios = require("axios");
const { TOKENS } = require("../../confiq/coinGeckoTokens");

// Fetch ONE token price
async function fetchCoinGeckoPrice(token) {
    try {
        if (!TOKENS.includes(token)) {
            throw new Error(`Token ${token} not supported in CoinGecko list`);
        }

        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${token}&vs_currencies=usd`;
        const response = await axios.get(url);

        const price = response.data[token]?.usd;

        if (!price) throw new Error("Price not found in response");

        return price;
    } catch (err) {
        console.warn(`⚠️ CoinGecko fetch failed for ${token}: ${err.message}`);
        return null;
    }
}

module.exports = { fetchCoinGeckoPrice };

// 👇 Only runs when executed directly
// if (require.main === module) {
//   (async () => {
//     const prices = await getCoinGeckoPrices();
//     console.log("🔥 Live Prices:\n", prices);
//   })();
// }