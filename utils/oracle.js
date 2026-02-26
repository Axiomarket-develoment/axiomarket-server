// server/utils/oracle.js
const { ethers } = require("ethers");
const { PRICE_FEEDS } = require("../config/priceFeeds");
const { getUnifiedPrice } = require("./priceRouer");

// Avalanche RPC
const AVAX_RPC = process.env.AVAX_RPC || "https://api.avax.network/ext/bc/C/rpc";
console.log("🌐 Using AVAX RPC:", AVAX_RPC);

const provider = new ethers.JsonRpcProvider(AVAX_RPC);
// Chainlink Price Feed ABI
const priceFeedAbi = [
    "function latestRoundData() view returns (uint80 roundId,int256 answer,uint256 startedAt,uint256 updatedAt,uint80 answeredInRound)"
];

function getChainlinkFeed(address) {
    return new ethers.Contract(address, priceFeedAbi, provider);
}

// Supported feeds (addresses must exist on Avalanche mainnet)


// Fetch current price from Chainlink
async function fetchCurrentPrice(asset) {
    console.log(`📡 Fetching current price for ${asset}...`);

    const feedConfig = PRICE_FEEDS[asset];
    if (!feedConfig) throw new Error(`No price feed for ${asset}`);


    try {

        const feed = getChainlinkFeed(feedConfig.address);

        // Ensure ethers knows this is an address, not ENS
        // Directly use the address string — no getAddress
        const data = await feed.latestRoundData();
        const price = Number(data[1].toString()) / (10 ** feedConfig.decimals);

        console.log(`💲 Current ${asset} price: $${price}`);
        return price;
    } catch (err) {
        console.error(`❌ Failed to fetch price for ${asset}:`, err.message);
        throw err;
    }
}

// Fetch outcome (YES/NO) for a market
async function fetchOutcomeFromOracle(market) {

    console.log(market)
    if (!market.asset || !market.targetPrice || !market.direction) {
        throw new Error("❌ Market missing required fields (asset, targetPrice, direction)");
    }

    const { price } = await getUnifiedPrice(market.asset);

    console.log(`🎯 Market target price: $${market.targetPrice}, direction: ${market.direction}`);

    if (market.direction === "UP") {
        return price >= market.targetPrice ? "YES" : "NO";
    } else {
        return price <= market.targetPrice ? "YES" : "NO";
    }
}

module.exports = { fetchCurrentPrice, fetchOutcomeFromOracle, PRICE_FEEDS };