const AdminWallet = require("../../models/AdminWallet");
const { encrypt } = require("../../utils/encryption");
const { generateWallet } = require("./generateWallet");


async function initializeAdminWallets() {
  try {
    const existing = await AdminWallet.find();

    if (existing.length > 0) {
      console.log("✅ Admin wallets already initialized");
      return;
    }

    console.log("\n🚀 Creating admin treasury wallets...\n");

    const walletTypes = [
      "liquidity",
      "fee",
      "operations",
      "founder",
      "reserve",
      "gas"
    ];

    const backup = {};

    for (const type of walletTypes) {
      const wallet = generateWallet();

      backup[type] = {
        address: wallet.address,
        privateKey: wallet.privateKey,
        mnemonic: wallet.mnemonic,
      };

      console.log(`
==================================================
🔐 ${type.toUpperCase()} WALLET GENERATED
==================================================

📍 Address:
${wallet.address}

🔑 Private Key:
${wallet.privateKey}

🧠 Mnemonic:
${wallet.mnemonic}

==================================================
`);

      await AdminWallet.create({
        type,
        address: wallet.address,

        encryptedPrivateKey: encrypt(wallet.privateKey),

        encryptedMnemonic: encrypt(wallet.mnemonic),
      });

      console.log(`✅ ${type} wallet saved\n`);
    }

    console.log("\n🔥 SAVE THESE WALLETS SECURELY 🔥\n");

    console.log(JSON.stringify(backup, null, 2));

    console.log("\n✅ Treasury wallets initialized");
  } catch (err) {
    console.error(
      "❌ Wallet initialization failed:",
      err.message
    );
  }
}

module.exports = initializeAdminWallets;