const User = require("../../models/User");
const { ethers } = require("ethers");

const providers = {
    AVAX: new ethers.JsonRpcProvider("https://api.avax.network/ext/bc/C/rpc"),
    ETH: new ethers.JsonRpcProvider("https://mainnet.infura.io/v3/42a02ce24a864db582d2e998461b8ae9"),
    BSC: new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org")
};

async function getBalance(chain, address) {
    const provider = providers[chain];
    if (!provider) return 0;

    const bal = await provider.getBalance(address);
    return parseFloat(ethers.formatEther(bal));
}

async function syncUsers() {
    console.log("🔄 Reconciling user wallets...");

    const users = await User.find({});

    for (const user of users) {
        try {
            const address = user.wallet?.address;
            if (!address) continue;

            for (const chain of ["AVAX", "ETH", "BSC"]) {

                const chainBalance = await getBalance(chain, address);

                const lastKnown = user.onChainBalances?.[chain] ?? 0;

                const delta = chainBalance - lastKnown;

                // ONLY IF THERE IS CHANGE
                if (delta !== 0) {

                    console.log(`📊 ${user.email} ${chain} change: ${delta}`);

                    // update ledger ONLY if positive incoming funds
                    if (delta > 0) {
                        await User.updateOne(
                            { _id: user._id },
                            {
                                $inc: {
                                    [`balances.${chain}`]: delta
                                }
                            }
                        );
                    }

                    // always update on-chain snapshot
                    await User.updateOne(
                        { _id: user._id },
                        {
                            $set: {
                                [`onChainBalances.${chain}`]: chainBalance
                            }
                        }
                    );
                }
            }

            await new Promise(r => setTimeout(r, 300));

        } catch (err) {
            console.error("❌ Sync error:", err.message);
        }
    }
}

function startBalanceUpdater() {
    console.log("🟢 Reconciliation engine started");

    syncUsers();
    setInterval(syncUsers, 10 * 60 * 1000);
}

module.exports = startBalanceUpdater;