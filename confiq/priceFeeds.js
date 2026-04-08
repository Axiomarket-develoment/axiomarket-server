const PRICE_FEEDS = {
    bitcoin: { address: "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c", decimals: 8 },
    ethereum: { address: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", decimals: 8 },
    binancecoin: { address: "0x14e613AC84a31f6B01bcfc4b4f105C19C0800f0d", decimals: 8 },
    dogecoin: { address: "0x0dF2db3eE0A3Dadf887cE619BFa4d6913A78A8F5", decimals: 8 },
    avalanche: { address: "0x0A77230d17318075983913bC2145DB16C7366156", decimals: 8 },

    // Fallbacks
    solana: null,
    arbitrum: null,
    optimism: null,
    toncoin: null,
    "shiba-inu": null,
    uniswap: null,
    aptos: null,
    sui: null,
    pepe: null
};


const BINANCE_SYMBOLS = {
  bitcoin:     "BTCUSDT",
  ethereum:    "ETHUSDT",
  solana:      "SOLUSDT",
  binancecoin: "BNBUSDT",
  avalanche:   "AVAXUSDT",
  dogecoin:    "DOGEUSDT",
  sui:         "SUIUSDT",
};



// btc,eth,bnb,sol,sui, pie,bgbacs,avx,pump.fun,

module.exports = { PRICE_FEEDS , BINANCE_SYMBOLS };