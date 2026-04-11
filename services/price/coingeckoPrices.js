const axios = require("axios");
const { TOKENS } = require("../../confiq/assets");




function normalizeToken(token) {
  const map = {
    avalanche: "avalanche-2",
    shib: "shiba-inu",
    doge: "dogecoin"
  };

  return map[token] || token;
}


// Fetch ONE token price
async function fetchCoinGeckoPrice(token) {
    try {
        const normalized = normalizeToken(token);

        if (!TOKENS.includes(normalized)) {
            throw new Error(`Token ${normalized} not supported in CoinGecko list`);
        }

        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${normalized}&vs_currencies=usd`;
        const response = await axios.get(url);

        const price = response.data[normalized]?.usd;

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