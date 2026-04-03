// server/utils/userWithdraw.js
const { ethers } = require("ethers");

/**
 * Send AVAX from a user's wallet to a recipient wallet
 * @param {string} userPrivateKey - User's private key (sender)
 * @param {string} toAddress - Recipient wallet
 * @param {number|string} amount - Amount in AVAX
 * @returns {Promise<string>} Transaction hash
 */
async function userWithdraw(userPrivateKey, toAddress, amount) {
  try {
    // --- 1️⃣ Create wallet and connect to provider ---
    const userWallet = new ethers.Wallet(userPrivateKey);
    const AVAX_RPC = "https://api.avax.network/ext/bc/C/rpc";
    const provider = new ethers.JsonRpcProvider(AVAX_RPC);
    const signer = userWallet.connect(provider);

    // --- 2️⃣ Convert amount to wei ---
    const amountWei = ethers.parseEther(amount.toString());

    // --- 3️⃣ Send transaction ---
    const tx = await signer.sendTransaction({
      to: toAddress,
      value: amountWei,
      gasLimit: 21000,
    });

    console.log(`🚀 Transaction sent. Hash: ${tx.hash}`);
    await tx.wait();
    console.log(`✅ Withdrawal confirmed to ${toAddress}: ${amount} AVAX`);

    return {
      txHash: tx.hash,
      explorerUrl: `https://snowtrace.io/tx/${tx.hash}`
    }
  } catch (err) {
    console.error("❌ Withdrawal failed:", err.message);
    throw err;
  }
}

//  Use AES-256 encryption
// --- Example usage ---
(async () => {
  const userPrivateKey = "0xa822ec08d6c67c6f7985e0af6d515d77c0f712d831eda659744712b1eea1893b"; // passed dynamically
  const recipient = "0xd4707339275048e4Df1DDA0755C61eEC9a0FE4D5";
  const amount = 0.01;

  await userWithdraw(userPrivateKey, recipient, amount);
})();

module.exports = { userWithdraw };