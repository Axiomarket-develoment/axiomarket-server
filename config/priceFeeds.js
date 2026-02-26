const PRICE_FEEDS = {
    bitcoin: { address: "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c", decimals: 8 },
    ethereum: { address: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", decimals: 8 },
    binancecoin: { address: "0x14e613AC84a31f6B01bcfc4b4f105C19C0800f0d", decimals: 8 },
    chainlink: { address: "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c", decimals: 8 },
    litecoin: { address: "0xDCB6D27a1f3FfFC38b1C30A3C45844d5bC62a81f", decimals: 8 },
    dogecoin: { address: "0x0dF2db3eE0A3Dadf887cE619BFa4d6913A78A8F5", decimals: 8 },
    matic: { address: "0xbb2b8038a1640196fbe3e38816f3e67cba72d940", decimals: 8 },
    cardano: { address: "0xAE48c91dF1fF0315b13e2eC6c2946C2eD905d82A", decimals: 8 },
    polkadot: { address: "0x91d5DEFAFfE2854C7D02F50c80FA1fdc8A721e52", decimals: 8 },
    ripple: { address: "0xC96c728B43D57352F1E5182A5fE7f8A63dB870E6", decimals: 8 }, // renamed to match TOKENS
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
  ripple:      "XRPUSDT",
  cardano:     "ADAUSDT",
  avalanche:   "AVAXUSDT",
  dogecoin:    "DOGEUSDT",
  chainlink:   "LINKUSDT",
  "matic-network": "MATICUSDT",
  arbitrum:    "ARBUSDT",
  optimism:    "OPUSDT",
  toncoin:     "TONUSDT",
  polkadot:    "DOTUSDT",
  litecoin:    "LTCUSDT",
  "shiba-inu": "SHIBUSDT",
  uniswap:     "UNIUSDT",
  aptos:       "APTUSDT",
  sui:         "SUIUSDT",
  pepe:        "PEPEUSDT"
};

module.exports = { PRICE_FEEDS , BINANCE_SYMBOLS };