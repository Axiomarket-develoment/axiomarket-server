const Web3 = require("web3").default;

const web3 = new Web3("https://api.avax.network/ext/bc/C/rpc");

const TOKENS = [
  { symbol: "USDT.e", name: "Tether USD", feed: "0x0A77230d17318075983913bC2145DB16C7366156" },
  { symbol: "USDC.e", name: "USD Coin", feed: "0xA7D7079b0FEAD91F3e65f86E8915Cb59c1a4C664" },
  { symbol: "WBTC.e", name: "Wrapped BTC", feed: "0x2779D32d516DB1A96a02D430C7B24ef0D4956B3" },
  { symbol: "WETH.e", name: "Wrapped Ether", feed: "0x976B3D4a7D6c0D3CaFd8a89Bb2083a0dA8f070E" }
];

const PRICE_FEED_ABI = [
  {
    inputs: [],
    name: "latestRoundData",
    outputs: [
      { type: "uint80", name: "roundId" },
      { type: "int256", name: "answer" },
      { type: "uint256", name: "startedAt" },
      { type: "uint256", name: "updatedAt" },
      { type: "uint80", name: "answeredInRound" }
    ],
    stateMutability: "view",
    type: "function"
  }
];

async function getPrice(feedAddress) {
  try {
    const contract = new web3.eth.Contract(PRICE_FEED_ABI, feedAddress);
    const data = await contract.methods.latestRoundData().call();

    const price = Number(data.answer) / 1e8; // Chainlink feeds use 8 decimals
    return price;
  } catch (err) {
    console.error("❌ Feed error:", feedAddress, err.message);
    return null;
  }
}

(async () => {
  for (const token of TOKENS) {
    const price = await getPrice(token.feed);
    console.log(
      `${token.symbol} → ${token.name}, price: $${price ?? "N/A"}`
    );
  }
})();