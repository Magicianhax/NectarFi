// Fetch all BSC yield pools for our whitelisted protocols
export async function fetchBscYields(): Promise<DefiLlamaPool[]> {
  const res = await fetch(`${DEFILLAMA_BASE}/pools`);
  if (!res.ok) throw new Error(`DeFiLlama yields API error: ${res.status}`);
  const data = await res.json() as { data: DefiLlamaPool[] };

  return data.data.filter(
    (p) =>
      p.chain === 'BSC' &&
      ['venus-core-pool', 'aave-v3', 'lista-lending', 'lista-cdp'].includes(p.project.toLowerCase())
  );
}

// Fetch token prices on BSC
export async function fetchTokenPrices(addresses: string[]): Promise<Record<string, TokenPrice>> {
  const coins = addresses.map((a) => `bsc:${a}`).join(',');
  const res = await fetch(`${PRICE_BASE}/prices/current/${coins}`);
  if (!res.ok) throw new Error(`DeFiLlama prices API error: ${res.status}`);
  const data = await res.json() as { coins: Record<string, TokenPrice> };
  return data.coins;
}

interface DefiLlamaPool {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  apyBase: number | null;
  apyReward: number | null;
  apyMean30d: number;
  underlyingTokens: string[] | null;
}

interface TokenPrice {
  price: number;
  symbol: string;
  timestamp: number;
  confidence: number;
}

const DEFILLAMA_BASE = 'https://yields.llama.fi';
const PRICE_BASE = 'https://coins.llama.fi';

// Cached live prices — refreshed every 5 min
import { ASSETS } from '../config.js';

let cachedPrices: Record<string, number> = {};
let pricesReady = false;

export function getCachedPrices(): Record<string, number> {
  return { ...cachedPrices };
}

export function arePricesReady(): boolean {
  return pricesReady;
}

export async function refreshPrices(): Promise<void> {
  const addresses = Object.values(ASSETS).map(a => a.address);
  const raw = await fetchTokenPrices(addresses);
  for (const [symbol, asset] of Object.entries(ASSETS)) {
    const key = `bsc:${asset.address}`;
    if (raw[key]?.price) {
      cachedPrices[symbol] = raw[key].price;
    }
  }
  if (cachedPrices.WBNB) cachedPrices.BNB = cachedPrices.WBNB;
  pricesReady = Object.keys(cachedPrices).length > 0;
  console.log('[PRICES] Updated:', Object.entries(cachedPrices).map(([k, v]) => `${k}=$${v.toFixed(2)}`).join(', '));
}
