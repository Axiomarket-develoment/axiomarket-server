const { fetchCurrentPrice } = require("../utils/oracle");

async function test() {
  try {
    const ethPrice = await fetchCurrentPrice("ETH");
    console.log("✅ ETH/USD on Avalanche:", ethPrice);

    const avaxPrice = await fetchCurrentPrice("AVAX");
    console.log("✅ AVAX/USD on Avalanche:", avaxPrice);

    const btcPrice = await fetchCurrentPrice("BTC");
    console.log("✅ BTC/USD on Avalanche:", btcPrice);

  } catch (err) {
    console.error("❌ Test failed:", err.message);
  }
}

test();