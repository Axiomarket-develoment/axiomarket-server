const { ethers } = require("ethers");

const User = require("../models/User");
const AdminWallet = require("../models/AdminWallet");
const { decrypt } = require("../utils/encryption");
const providers = require("../services/blockchain/providers");

// =========================
let isSweeping = false;

const chainLocks = {
  AVAX: false,
  ETH: false,
  BSC: false,
};
const TOKENS = {
  BSC: [
    {
      symbol: "USDT",
      address: "0x55d398326f99059fF775485246999027B3197955",
      decimals: 18
    }
  ],

  AVAX: [
    {
      symbol: "USDT",
      address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
      decimals: 6
    }
  ]
};

// =========================
// CONFIG
// =========================

const FEE_SPLIT = {
  liquidity: 0.98,
  gas: 0.02,
};

const GAS_RESERVE = {
  AVAX: 0.02,
  ETH: 0.003,
  BSC: 0.003,
};

// =========================
async function getAdminWallet(type) {
  return await AdminWallet.findOne({ type });
}

function roundBalance(value, decimals = 6) {
  return Number(parseFloat(value).toFixed(decimals));
}


// =========================
async function getDecryptedWallet(encrypted, provider) {
  try {
    if (!encrypted) throw new Error("Missing privateKey field");

    if (typeof encrypted === "string") {
      encrypted = JSON.parse(encrypted);
    }

    const pk = decrypt(
      encrypted.encryptedData,
      encrypted.iv,
      encrypted.authTag
    );

    return new ethers.Wallet(pk, provider);
  } catch (err) {
    console.log("❌ Wallet decrypt failed:", err.message);
    throw err;
  }
}

async function updateAdminWalletBalances(chain, liquidityAmount, gasAmount) {
  await AdminWallet.updateOne(
    { type: "liquidity" },
    {
      $inc: {
        [`balances.${chain}`]: roundBalance(liquidityAmount),
      },
    }
  );

  await AdminWallet.updateOne(
    { type: "gas" },
    {
      $inc: {
        [`balances.${chain}`]: roundBalance(gasAmount),
      },
    }
  );
}
// =========================
// FIXED ADMIN BALANCE UPDATE (IMPORTANT)
// =========================
async function refreshAdminBalances(chain, provider) {
  const admins = await AdminWallet.find({});

  for (const admin of admins) {
    const balWei = await provider.getBalance(admin.address);
    const bal = roundBalance(ethers.formatEther(balWei));

    if (!admin.balances) admin.balances = {};

    admin.balances[chain] = bal;

    await admin.save();
  }
}

// =========================
// FIXED USER LEDGER
// =========================
async function updateUserLedger(user, chain, sweptAmount, newOnChainBalance) {
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        [`onChainBalances.${chain}`]: roundBalance(newOnChainBalance),
        [`lastSwept.${chain}`]: roundBalance(newOnChainBalance),
      },
      $inc: {
        [`balances.${chain}`]: roundBalance(sweptAmount),
        totalSwept: roundBalance(sweptAmount),
      },
    }
  );
}
// =========================
// CORE SWEEP (FIXED LOGIC)
// =========================
async function sweepUserFunds(user, chain, provider) {
  if (chainLocks[chain]) return;
  chainLocks[chain] = true;

  try {
    const address = user.wallet.address;

    // STEP 1: GET REAL BALANCE
    const balanceWei = await provider.getBalance(address);
    const balance = roundBalance(ethers.formatEther(balanceWei));

    const gasReserve = GAS_RESERVE[chain] ?? 0;

    console.log(
      `🔎 ${user.email} | ${chain} | balance=${balance} | gasReserve=${gasReserve}`
    );

    // STEP 2: SAFETY CHECK
    if (balance <= gasReserve) {
      console.log(`⚠️ Not enough balance to sweep`);
      return;
    }

    const sweepable = balance - gasReserve;

    // STEP 3: GET SIGNER
    const signer = await getDecryptedWallet(user.wallet.privateKey, provider);

    // STEP 4: SPLIT FUNDS
    const liquidityAmount = roundBalance(sweepable * 0.98);
    const gasAmount = roundBalance(sweepable * 0.02);

    const liquidityWallet = await getAdminWallet("liquidity");
    const gasWallet = await getAdminWallet("gas");

    console.log(`🚀 Sweeping ${sweepable} ${chain}`);

    // STEP 5: SEND LIQUIDITY
    const tx1 = await signer.sendTransaction({
      to: liquidityWallet.address,
      value: ethers.parseEther(liquidityAmount.toString()),
    });
    await tx1.wait();

    // STEP 6: SEND GAS
    const tx2 = await signer.sendTransaction({
      to: gasWallet.address,
      value: ethers.parseEther(gasAmount.toString()),
    });
    await tx2.wait();

    // STEP 7: UPDATE USER LEDGER
    await updateUserLedger(user, chain, sweepable, balance);

    // STEP 8: UPDATE ADMIN DB (CRITICAL FIX)
    await updateAdminWalletBalances(chain, liquidityAmount, gasAmount);

    console.log(`✅ Sweep complete ${user.email}`);
  } catch (err) {
    console.log(`❌ sweep error ${user.email}:`, err.message);
  } finally {
    chainLocks[chain] = false;
  }
}

async function sweepUserTokens(user, chain, provider) {
  const tokens = TOKENS[chain];
  if (!tokens || tokens.length === 0) return;

  for (const tokenInfo of tokens) {
    const abi = [
      "function balanceOf(address) view returns (uint256)",
      "function transfer(address to, uint amount) returns (bool)"
    ];

    const token = new ethers.Contract(tokenInfo.address, abi, provider);

    const balance = await token.balanceOf(user.wallet.address);

    if (!balance || balance === 0n) continue;

    const signer = await getDecryptedWallet(user.wallet.privateKey, provider);
    const tokenWithSigner = token.connect(signer);

    const liquidityWallet = await getAdminWallet("liquidity");

    const tx = await tokenWithSigner.transfer(
      liquidityWallet.address,
      balance
    );

    await tx.wait();

    // 🔥 UPDATE USER DB (IMPORTANT)
    await User.updateOne(
      { _id: user._id },
      {
        $inc: {
          "balances.USDT": Number(ethers.formatUnits(balance, tokenInfo.decimals))
        },
        $set: {
          "onChainBalances.USDT": 0,
          "lastSwept.USDT": Date.now()
        }
      }
    );

    console.log(`💰 Swept ${tokenInfo.symbol} for ${user.email}`);
  }
}
// =========================
// ERC20 SUPPORT (USDT FIXED)
// =========================async function sweepERC20(user, chain, provider, tokenAddress) {

async function sweepERC20(user, chain, provider, tokenAddress) {
  const abi = [
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address to, uint amount) returns (bool)",
  ];

  const token = new ethers.Contract(tokenAddress, abi, provider);

  const balance = await token.balanceOf(user.wallet.address);

  if (!balance || balance === 0n) return;

  const signer = await getDecryptedWallet(user.wallet.privateKey, provider);
  const tokenWithSigner = token.connect(signer);

  const liquidityWallet = await getAdminWallet("liquidity");

  const tx = await tokenWithSigner.transfer(
    liquidityWallet.address,
    balance
  );

  await tx.wait();

  console.log(`💰 ERC20 swept for ${user.email}`);
}

// =========================
// MAIN ENGINE (FIXED)
// =========================
async function sweepDeposits() {
  if (isSweeping) return;

  isSweeping = true;

  try {
    const users = await User.find({});

    for (const user of users) {
      if (!user.wallet?.address) continue;

      await sweepUserFunds(user, "AVAX", providers.AVAX);
      await sweepUserTokens(user, "AVAX", providers.AVAX);
      await sweepUserFunds(user, "ETH", providers.ETH);
      await sweepUserFunds(user, "BSC", providers.BSC);
      await sweepUserTokens(user, "BSC", providers.BSC);

      await new Promise((r) => setTimeout(r, 200));
    }

    console.log("✅ Sweep cycle complete");
  } catch (err) {
    console.log("❌ GLOBAL ERROR:", err.message);
  } finally {
    isSweeping = false;
  }
}

module.exports = {
  sweepDeposits,
};