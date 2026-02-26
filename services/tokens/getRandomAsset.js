// utils/randomAsset.js
const { SUPPORTED_ASSETS } = require("../config/assets");

function getRandomOtherAsset(mainAsset) {
  // Filter out the main asset
  const otherAssets = SUPPORTED_ASSETS.filter(a => a !== mainAsset);

  // Pick a random one
  const randomIndex = Math.floor(Math.random() * otherAssets.length);
  return otherAssets[randomIndex];
}

module.exports = { getRandomOtherAsset };