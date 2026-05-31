const { ethers } = require("ethers");

const providers = {
   AVAX: new ethers.JsonRpcProvider("https://api.avax.network/ext/bc/C/rpc"),
   BSC: new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org"),
   ETH: new ethers.JsonRpcProvider("https://mainnet.infura.io/v3/42a02ce24a864db582d2e998461b8ae9"),
};

module.exports = providers;