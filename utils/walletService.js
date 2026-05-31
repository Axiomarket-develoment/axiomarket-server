const AdminWallet = require("../models/AdminWallet");
const { decrypt } = require("./encryption");

/**
 * Get full wallet document (safe fields only)
 */
async function getWalletByType(type) {
    if (!type) throw new Error("Wallet type is required");

    const wallet = await AdminWallet.findOne({ type });

    if (!wallet) {
        throw new Error(`Wallet not found for type: ${type}`);
    }

    return wallet;
}

/**
 * Get decrypted private key
 */
async function getWalletPrivateKey(type) {
    const wallet = await getWalletByType(type);

    const { encryptedPrivateKey } = wallet;

    if (!encryptedPrivateKey?.encryptedData) {
        throw new Error("Missing encrypted private key");
    }

    const privateKey = decrypt(
        encryptedPrivateKey.encryptedData,
        encryptedPrivateKey.iv,
        encryptedPrivateKey.authTag
    );

    return {
        privateKey,
        address: wallet.address,
        type: wallet.type
    };
}

/**
 * Get decrypted mnemonic / seed phrase
 */
async function getWalletMnemonic(type) {
    const wallet = await getWalletByType(type);

    const { encryptedMnemonic } = wallet;

    if (!encryptedMnemonic?.encryptedData) {
        throw new Error("Missing encrypted mnemonic");
    }

    const mnemonic = decrypt(
        encryptedMnemonic.encryptedData,
        encryptedMnemonic.iv,
        encryptedMnemonic.authTag
    );

    return {
        mnemonic,
        address: wallet.address,
        type: wallet.type
    };
}

/**
 * Get wallet balances
 */
async function getWalletBalances(type) {
    const wallet = await getWalletByType(type);

    return wallet.balances || {};
}

/**
 * FULL helper (everything decrypted)
 */
async function getFullWallet(type) {
    const wallet = await getWalletByType(type);

    const privateKey = wallet.encryptedPrivateKey
        ? decrypt(
            wallet.encryptedPrivateKey.encryptedData,
            wallet.encryptedPrivateKey.iv,
            wallet.encryptedPrivateKey.authTag
        )
        : null;

    const mnemonic = wallet.encryptedMnemonic
        ? decrypt(
            wallet.encryptedMnemonic.encryptedData,
            wallet.encryptedMnemonic.iv,
            wallet.encryptedMnemonic.authTag
        )
        : null;

    return {
        type: wallet.type,
        address: wallet.address,
        privateKey,
        mnemonic,
        balances: wallet.balances
    };
}

module.exports = {
    getWalletByType,
    getWalletPrivateKey,
    getWalletMnemonic,
    getWalletBalances,
    getFullWallet
};