const { ethers } = require("ethers");

const AVAX_RPC = "https://api.avax.network/ext/bc/C/rpc"; // Avalanche C-Chain RPC
const provider = new ethers.JsonRpcProvider(AVAX_RPC);

async function getBalance(address) {
  try {
    const balance = await provider.getBalance(address); // returns balance in wei
    const balanceInAVAX = ethers.formatEther(balance);  // convert to AVAX
    console.log(`Wallet ${address} has ${balanceInAVAX} AVAX`);
    return balanceInAVAX;
  } catch (err) {
    console.error("❌ Failed to fetch balance:", err.message);
    throw err;
  }
}




// Example usage
getBalance("0x0715ad5d3f230BdB565ed02a1F5A179476035c05");