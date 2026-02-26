const { ethers } = require("ethers");

function generateAvalancheWallet() {
    const wallet = ethers.Wallet.createRandom();
    return wallet;
}

(async () => {
    const wallet = generateAvalancheWallet();
    console.log("🔥 Wallet generated:");
    console.log("Address:", wallet.address);
    console.log("Private Key:", wallet.privateKey);
    console.log("Mnemonic:", wallet.mnemonic.phrase);
})();

module.exports = { generateAvalancheWallet }