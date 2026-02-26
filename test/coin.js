const axios = require("axios");

async function getPrice(id) {
  const res = await axios.get(
    `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`
  );
  return res.data[id].usd;
}

(async () => {
  console.log("ETH:", await getPrice("ethereum"));
  console.log("BTC:", await getPrice("bitcoin"));
})();