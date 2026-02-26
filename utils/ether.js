const { ethers } = require("ethers");

const provider = new ethers.JsonRpcProvider("https://api.avax.network/ext/bc/C/rpc");

async function getBlockNumber() {
  const blockNumber = await provider.getBlockNumber();
  console.log("Current Avalanche block:", blockNumber);
}

getBlockNumber();