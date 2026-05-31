const { ethers } = require("ethers");

// ---------------- PROVIDERS ----------------
const providers = {
  AVAX: new ethers.JsonRpcProvider("https://api.avax.network/ext/bc/C/rpc"),
  ETH: new ethers.JsonRpcProvider("https://mainnet.infura.io/v3/yy"),
  BSC: new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org")
};

// ---------------- NATIVE BALANCE ----------------
async function getNativeBalance(chain, address) {
  try {
    const provider = providers[chain];

    if (!provider) throw new Error("Unsupported chain");

    const balance = await provider.getBalance(address);

    const formatted = ethers.formatEther(balance);

    console.log(`${chain} Wallet ${address} = ${formatted}`);

    return formatted;
  } catch (err) {
    console.error(`${chain} error:`, err.message);
    return null;
  }
}




// Example usage
getNativeBalance("AVAX", "0x240c36457D6b6B39b06A2A7d462804fA212Eb675");
// getNativeBalance("ETH", "0xd4707339275048e4Df1DDA0755C61eEC9a0FE4D5");