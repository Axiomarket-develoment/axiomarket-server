function sanitizeUser(user) {
  if (!user) return null; // IMPORTANT FIX

  const safe =
    typeof user.toObject === "function"
      ? user.toObject()
      : JSON.parse(JSON.stringify(user)); // safest fallback

  // auth + security
  delete safe.password;

  // mongoose internals
  delete safe.__v;
  delete safe.createdAt;
  delete safe.updatedAt;

  // wallet security
  if (safe.wallet?.privateKey) {
    delete safe.wallet.privateKey;
  }

  // internal tracking
  delete safe.lastSwept;
  delete safe.lastBalanceUpdate;
  delete safe.lastLogin;
  delete safe.authProvider;

  // heavy/unused fields
  delete safe.onChainBalances;

  return safe;
}

module.exports = sanitizeUser;