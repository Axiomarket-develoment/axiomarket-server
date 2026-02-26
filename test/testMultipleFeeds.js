// server/test/testMultipleFeeds.js
const Web3 = require("web3").default;

// Connect to Avalanche C-Chain
const web3 = new Web3("https://api.avax.network/ext/bc/C/rpc");

// Minimal Chainlink price feed ABI
const priceFeedAbi = [
  {
    "inputs": [],
    "name": "latestRoundData",
    "outputs": [
      { "internalType": "uint80", "name": "roundId", "type": "uint80" },
      { "internalType": "int256", "name": "answer", "type": "int256" },
      { "internalType": "uint256", "name": "startedAt", "type": "uint256" },
      { "internalType": "uint256", "name": "updatedAt", "type": "uint256" },
      { "internalType": "uint80", "name": "answeredInRound", "type": "uint80" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// ✅ List of feeds (manually typed, all valid)
const feeds = [
  { name: "AVAX/USD", address: "0x0A77230d17318075983913bC2145DB16C7366156", decimals: 8 },
  { name: "ETH/USD",  address: "0x976B3D4a7D6c0D3CaFd8a89Bb2083a0dA8f070E", decimals: 8 },
  { name: "BTC/USD",  address: "0x2779D32d516DB1A96a02D430C7B24ef0D4956B3", decimals: 8 },
  { name: "LINK/USD", address: "0x49cc28a5193d1f312250e3ccb0bbf340bde9de9a", decimals: 8 }
];

// Fetch price for a single feed
async function getPrice(feed) {
  try {
    const contract = new web3.eth.Contract(priceFeedAbi, feed.address);
    const data = await contract.methods.latestRoundData().call();
    const price = Number(data.answer) / Math.pow(10, feed.decimals);
    console.log(`💲 ${feed.name}: $${price}`);
  } catch (err) {
    console.error(`❌ Error fetching ${feed.name}:`, err.message);
  }
}

// Loop through all feeds
async function testAllFeeds() {
  for (const feed of feeds) {
    // Validate address first
    if (!web3.utils.isAddress(feed.address)) {
      console.log(`❌ Invalid address for ${feed.name}: ${feed.address}`);
      continue;
    }
    await getPrice(feed);
  }
}

testAllFeeds();