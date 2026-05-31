const { ethers } = require("ethers");
const User = require("../../models/User");
const Transaction = require("../../models/Transaction");

const CONFIRMATIONS = 3;

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const ERC20_INTERFACE = new ethers.Interface([
  "event Transfer(address indexed from, address indexed to, uint256 value)"
]);

const tokenCache = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normalize(a) {
  return a?.toLowerCase();
}

/* ---------------- TOKEN META ---------------- */
async function getTokenMeta(provider, address) {
  const key = normalize(address);

  if (tokenCache.has(key)) return tokenCache.get(key);

  const contract = new ethers.Contract(address, [
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
  ], provider);

  let decimals = 18;
  let symbol = "UNKNOWN";

  try { decimals = await contract.decimals(); } catch { }
  try { symbol = await contract.symbol(); } catch { }

  const meta = { decimals, symbol };
  tokenCache.set(key, meta);

  return meta;
}

/* ---------------- SAFE ERC20 ---------------- */
async function processERC20({ chain, provider, log }) {
  try {
    let parsed;

    try {
      parsed = ERC20_INTERFACE.parseLog(log);
    } catch {
      return; // ignore bad logs
    }

    const to = normalize(parsed.args.to);

    const user = await User.findOne({
      "wallet.address": to
    });

    if (!user) return;

    const exists = await Transaction.findOne({
      reference: log.transactionHash
    });

    if (exists) return;

    const { decimals, symbol } =
      await getTokenMeta(provider, log.address);

    const rawAmount = Number(
      ethers.formatUnits(parsed.args.value, decimals)
    );

    const fee = rawAmount * 0.02;
    const net = rawAmount - fee;

    await Transaction.create({
      user: user._id,
      type: "deposit",
      method: "crypto",
      currency: symbol,
      amount: net,
      status: "success",
      reference: log.transactionHash,
      metadata: {
        chain,
        token: log.address,
        rawAmount
      }
    });

    user.balances[symbol] =
      (user.balances[symbol] || 0) + net;

    await user.save();

  } catch (err) {
    console.log(`[${chain}] ERC20 error`);
  }
}

/* ---------------- WATCHER ---------------- */
async function watchChain(chain, provider) {
  console.log(`🟢 Watching ${chain}`);

  let processing = false;
  provider.on("block", async (blockNumber) => {
    try {
      const block = await provider.getBlock(blockNumber, true);
      if (!block) return;

      await Promise.all(
        block.transactions.map(async (tx) => {
          const t = await provider.getTransaction(tx);
          if (!t) return;

          const to = t.to?.toLowerCase();

          const user = await User.findOne({
            "wallet.address": to
          });

          if (!user) return;

          const rawAmount = Number(ethers.formatEther(t.value));

          if (!rawAmount || rawAmount <= 0) return;

          const fee = rawAmount * 0.02;
          const net = rawAmount - fee;

          await Transaction.create({
            user: user._id,
            type: "deposit",
            method: "crypto",
            currency: "AVAX",
            amount: net,
            status: "success",
            reference: t.hash,
            metadata: {
              chain,
              from: t.from,
              to,
              rawAmount
            }
          });

          user.balances.AVAX =
            (user.balances.AVAX || 0) + net;

          await user.save();

          console.log(`💰 AVAX deposit | ${user.email} | ${net}`);
        })
      );

    } catch (err) {
      console.log(`[${chain}] watcher error:`, err);
    }
  });
}

/* ---------------- START ---------------- */
function startWatchers(providers) {
  if (!providers) throw new Error("Providers missing");

  for (const [chain, provider] of Object.entries(providers)) {
    if (!provider) continue;
    watchChain(chain, provider);
  }
}

module.exports = startWatchers;