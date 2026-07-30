const { ethers } = require("ethers");

// ---------------- PROVIDERS ----------------
const providers = {
  AVAX: new ethers.JsonRpcProvider("https://api.avax.network/ext/bc/C/rpc"),
  ETH: new ethers.JsonRpcProvider("https://mainnet.infura.io/v3/yy"),
  BSC: new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org")
};

// ---------------- TOKENS ----------------
const TOKENS = {
  BSC: [
    {
      name: "USDT",
      address: "0x55d398326f99059fF775485246999027B3197955",
      decimals: 18
    }
  ]
};

// ---------------- NATIVE BALANCE ----------------
async function getNativeBalance(chain, address) {
  try {
    const provider = providers[chain];
    if (!provider) throw new Error("Unsupported chain");

    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance);
  } catch (err) {
    console.error(`${chain} native error:`, err.message);
    return null;
  }
}

// ---------------- TOKEN BALANCE (USDT, etc) ----------------
async function getTokenBalance(chain, tokenAddress, decimals, userAddress) {
  try {
    const provider = providers[chain];

    const abi = [
      "function balanceOf(address owner) view returns (uint256)"
    ];

    const contract = new ethers.Contract(tokenAddress, abi, provider);

    const balance = await contract.balanceOf(userAddress);

    return ethers.formatUnits(balance, decimals);
  } catch (err) {
    console.error(`${chain} token error:`, err.message);
    return null;
  }
}

// ---------------- COMBINED CHECK ----------------
async function getWalletBalance(chain, address) {
  const native = await getNativeBalance(chain, address);

  const result = {
    native
  };

  // add token balances if chain has tokens
  if (TOKENS[chain]) {
    for (const token of TOKENS[chain]) {
      const bal = await getTokenBalance(
        chain,
        token.address,
        token.decimals,
        address
      );

      result[token.name] = bal;
    }
  }

  return result;
}

// ---------------- EXAMPLE ----------------
(async () => {
  const address = "0xE817847889164cbcA2f405c7DEF49E0B973100E2";

  const data = await getWalletBalance("AVAX", address);

  console.log("BALANCE:", data);
})();