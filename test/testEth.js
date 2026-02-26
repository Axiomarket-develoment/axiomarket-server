const { ethers } = require("ethers");

const provider = new ethers.JsonRpcProvider("https://api.avax.network/ext/bc/C/rpc");

// Minimal Chainlink ABI
const priceFeedAbi = [
  "function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"
];

async function getPrice(address) {
  // Create an Interface instance
  const iface = new ethers.Interface(priceFeedAbi);

  // Encode the function call
  const data = iface.encodeFunctionData("latestRoundData");

  // Call the contract directly
  const result = await provider.call({
    to: address,
    data: data
  });

  // Decode the returned data
  const decoded = iface.decodeFunctionResult("latestRoundData", result);

  console.log("Raw decoded result:", decoded);
  const price = Number(decoded[1].toString()) / 1e8; // decimals = 8
  console.log(`💲 Price from ${address}: $${price}`);
}

getPrice("0x976B3D4a7D6c0D3CaFd8a89Bb2083a0dA8f070E"); // ETH/USD on Avalanche