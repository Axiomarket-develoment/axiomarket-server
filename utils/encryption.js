const crypto = require("crypto");

const ALGO = "aes-256-gcm";
const SECRET = process.env.WALLET_SECRET || "super-secret-key-change-me";

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(SECRET, "salt", 32);

  const cipher = crypto.createCipheriv(ALGO, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return {
    encryptedData: encrypted,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

function decrypt(encryptedData, iv, authTag) {
  const key = crypto.scryptSync(SECRET, "salt", 32);

  const decipher = crypto.createDecipheriv(
    ALGO,
    key,
    Buffer.from(iv, "hex")
  );

  decipher.setAuthTag(Buffer.from(authTag, "hex"));

  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

// Debug helper
function debugDecryptWallet(wallet) {
  try {
    const privateKey = decrypt(
      wallet.encryptedPrivateKey.encryptedData,
      wallet.encryptedPrivateKey.iv,
      wallet.encryptedPrivateKey.authTag
    );

    const mnemonic = decrypt(
      wallet.encryptedMnemonic.encryptedData,
      wallet.encryptedMnemonic.iv,
      wallet.encryptedMnemonic.authTag
    );

    console.log("Private Key:", privateKey);
    console.log("Mnemonic:", mnemonic);

    return {
      privateKey,
      mnemonic,
    };
  } catch (err) {
    console.error("Failed to decrypt wallet:", err.message);
  }
}

module.exports = {
  encrypt,
  decrypt,
  debugDecryptWallet,
};