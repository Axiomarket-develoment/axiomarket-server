// server/services/wallet/getWalletInfo.js
const { HDNodeWallet, Mnemonic } = require("ethers");

/**
 * Generate wallet info from a mnemonic phrase
 * @param {string} mnemonicPhrase - The 12/24 word secret phrase
 * @param {string} derivationPath - Optional derivation path (default: "m/44'/60'/0'/0/0")
 * @returns {object} walletInfo
 */
function getWalletInfo(mnemonicPhrase, derivationPath = "m/44'/60'/0'/0/0") {
  // Create Mnemonic object
  const mnemonic = Mnemonic.fromPhrase(mnemonicPhrase);

  // Create HD wallet
  const wallet = HDNodeWallet.fromMnemonic(mnemonic, derivationPath);

  // Arrange wallet info in an object
  const walletInfo = {
    address: wallet.address,
    privateKey: wallet.privateKey,
    publicKey: wallet.publicKey,
    path: wallet.path,
    mnemonic: mnemonicPhrase,
    fingerprint: wallet.fingerprint,
    parentFingerprint: wallet.parentFingerprint,
    chainCode: wallet.chainCode,
    depth: wallet.depth,
  };

  console.log(walletInfo);
  return walletInfo;
}

module.exports = { getWalletInfo };

const mnemonic = "sunny element palace network broken myth stumble robust spoil suffer elite dismiss";
getWalletInfo(mnemonic)