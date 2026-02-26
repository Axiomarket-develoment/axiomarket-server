const Web3 = require("web3").default;
const web3 = new Web3("https://api.avax.network/ext/bc/C/rpc");

// Chainlink price feed ABI
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

async function getPrice(address, decimals = 8) {
  // Convert to checksummed address
  const safeAddress = web3.utils.toChecksumAddress(address);

  const contract = new web3.eth.Contract(priceFeedAbi, safeAddress);

  try {
    const data = await contract.methods.latestRoundData().call();
    const price = Number(data.answer) / Math.pow(10, decimals);
    console.log(`💲Price from ${safeAddress}: $${price}`);
  } catch (err) {
    console.error("❌ Error getting price:", err.message);
  }
}

// Chainlink feeds on Avalanche mainnet
getPrice("0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB"); // ETH/USD
// getPrice("0x0A77230d17318075983913bC2145DB16C7366156"); // AVAX/USD
// getPrice("0x2779D32d516DB1A96a02D430C7B24ef0D4956B3"); // BTC/USD