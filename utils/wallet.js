// server/utils/wallet.js
const { ethers } = require("ethers");

function generateAvalancheWallet() {
    const wallet = ethers.Wallet.createRandom();
    return {
        address: wallet.address,
        privateKey: wallet.privateKey
    };
}

module.exports = { generateAvalancheWallet };



(async () => {
    const wallet = await generateAvalancheWallet();
    console.log("🔥 Wallet generated:\n", wallet);
})();
