import { bsc } from 'viem/chains';

export const CHAIN = bsc;

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;
export const BSC_RPC = process.env.BSC_RPC_URL
  || (ALCHEMY_KEY ? `https://bnb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}` : null)
  || 'https://bsc-dataseed1.binance.org';

// Supported assets
export const ASSETS = {
  USDT: { address: '0x55d398326f99059fF775485246999027B3197955' as const, decimals: 18, symbol: 'USDT' },
  USDC: { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d' as const, decimals: 18, symbol: 'USDC' },
  BTCB: { address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c' as const, decimals: 18, symbol: 'BTCB' },
  WETH: { address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8' as const, decimals: 18, symbol: 'WETH' },
  WBNB: { address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as const, decimals: 18, symbol: 'WBNB' },
  FDUSD: { address: '0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409' as const, decimals: 18, symbol: 'FDUSD' },
  USD1: { address: '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d' as const, decimals: 18, symbol: 'USD1' },
  slisBNB: { address: '0xB0b84D294e0C75A6abe60171b70edEb2EFd14A1B' as const, decimals: 18, symbol: 'slisBNB' },
} as const;

// Venus Protocol
export const VENUS = {
  comptroller: '0xfD36E2c2a6789Db23113685031d7F16329158384' as const,
  vTokens: {
    USDT: '0xfD5840Cd36d94D7229439859C0112a4185BC0255' as const,
    USDC: '0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8' as const,
    BTCB: '0x882C173bC7Ff3b7786CA16dfeD3DFFfb9Ee7847B' as const,
    WETH: '0xf508fCD89b8bd15579dc79A6827cB4686A3592c8' as const,
    WBNB: '0xA07c5b74C9B40447a954e1466938b865b6BBea36' as const,
  },
};

// Aave V3
export const AAVE = {
  pool: '0x6807dc923806fE8Fd134338EABCA509979a7e0cB' as const,
  aTokens: {
    USDT: '0xa9251ca9DE909CB71783723713B21E4233fbf1B1' as const,
    USDC: '0x00901a076785e0906d1028c7d6372d247bec7d61' as const,
    BTCB: '0x56a7ddc4e848EbF43845854205ad71D5D5F72d3D' as const,
    WETH: '0x2E94171493fAbE316b6205f1585779C887771E2F' as const,
    WBNB: '0x9B00a09492a626678E5A3009982191586C444Df9' as const,
  },
};

// Lista (Moolah)
export const LISTA = {
  core: '0x8F73b65B4caAf64FBA2aF91cC5D4a2A1318E5D8C' as const,
  vaults: {
    WBNB: '0x57134a64B7cD9F9eb72F8255A671F5Bf2fe3E2d0' as const,
    USD1: '0xfa27f172e0b6ebcEF9c51ABf817E2cb142FbE627' as const,
  },
  oracle: '0x21650E416dC6C89486B2E654c86cC2c36c597b58' as const,
  staking: {
    stakeManager: '0x1adB950d8bB3dA4bE104211D5AB038628e477fE6' as const,
    slisBNB: '0xB0b84D294e0C75A6abe60171b70edEb2EFd14A1B' as const,
  },
};

// PancakeSwap (swap only)
export const PANCAKESWAP = {
  smartRouter: '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4' as const,
  quoter: '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997' as const,
};

// Protocol trust scores (used in scoring)
export const PROTOCOL_TRUST: Record<string, number> = {
  venus: 95,
  aave: 98,
  lista: 80,
  // 'lista-staking': 82, // Disabled — long unstaking period
  pendle: 85,
};

// Default user settings
export const DEFAULT_SETTINGS = {
  riskLevel: 'medium' as const,
  minTvl: 10_000_000,
  apyThreshold: 2.0,
  maxPerProtocol: 50,
  rebalanceCooldownHours: 6,
  whitelistedProtocols: ['venus', 'aave', 'lista'],
  whitelistedAssets: ['USDT', 'USDC', 'BTCB', 'WETH', 'WBNB', 'USD1'],
};
