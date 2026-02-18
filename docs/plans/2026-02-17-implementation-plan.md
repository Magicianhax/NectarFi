# AI DeFi Strategy Agent — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a semi-autonomous AI DeFi agent that finds optimal lending yields across BSC protocols, deploys user funds via an embedded wallet, and patiently accumulates yield.

**Architecture:** Separate Next.js frontend (Vercel) + persistent Node.js backend (Railway/Render). Privy for wallet management. DeFiLlama + onchain reads for data. OpenAI GPT-5.2 for summaries.

**Tech Stack:** TypeScript, Next.js 14, Express, viem, Privy SDK, Supabase, OpenAI SDK, Tailwind + shadcn/ui, node-cron

---

## Task 1: Project Scaffolding

**Files:**
- Create: `agent-backend/package.json`
- Create: `agent-backend/tsconfig.json`
- Create: `agent-backend/src/index.ts`
- Create: `frontend/package.json` (via create-next-app)
- Create: `.gitignore`
- Create: `.env.example`

**Step 1: Initialize backend**

```bash
mkdir -p agent-backend && cd agent-backend
npm init -y
npm install express cors dotenv viem @privy-io/server-auth openai node-cron ws @supabase/supabase-js
npm install -D typescript @types/express @types/cors @types/node @types/ws tsx
```

**Step 2: Create tsconfig.json for backend**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create backend entry point**

```typescript
// agent-backend/src/index.ts
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.on('close', () => console.log('Client disconnected'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Agent backend running on port ${PORT}`);
});

export { wss };
```

Add to `agent-backend/package.json` scripts:
```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "type": "module"
}
```

**Step 4: Initialize frontend**

```bash
cd /path/to/project
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
cd frontend
npm install @privy-io/react-auth @privy-io/wagmi wagmi viem @tanstack/react-query recharts
npx shadcn@latest init -d
npx shadcn@latest add button card input label select tabs badge separator skeleton toast
```

**Step 5: Create .env.example**

```env
# Backend
PORT=3001
BSC_RPC_URL=https://bsc-dataseed1.binance.org
PRIVY_APP_ID=
PRIVY_APP_SECRET=
OPENAI_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_PRIVY_APP_ID=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

**Step 6: Create .gitignore**

```
node_modules/
dist/
.env
.next/
```

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold backend + frontend projects"
```

---

## Task 2: Config & Contract Constants

**Files:**
- Create: `agent-backend/src/config.ts`
- Create: `agent-backend/src/abis/vToken.ts`
- Create: `agent-backend/src/abis/aavePool.ts`
- Create: `agent-backend/src/abis/erc20.ts`
- Create: `agent-backend/src/abis/listaMoolah.ts`

**Step 1: Create chain config and contract addresses**

```typescript
// agent-backend/src/config.ts
import { bsc } from 'viem/chains';

export const CHAIN = bsc;
export const BSC_RPC = process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org';

// Supported assets
export const ASSETS = {
  USDT: { address: '0x55d398326f99059fF775485246999027B3197955' as const, decimals: 18, symbol: 'USDT' },
  USDC: { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d' as const, decimals: 18, symbol: 'USDC' },
  BTCB: { address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c' as const, decimals: 18, symbol: 'BTCB' },
  WETH: { address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8' as const, decimals: 18, symbol: 'WETH' },
  WBNB: { address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as const, decimals: 18, symbol: 'WBNB' },
  FDUSD: { address: '0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409' as const, decimals: 18, symbol: 'FDUSD' },
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
  whitelistedAssets: ['USDT', 'USDC', 'BTCB', 'WETH', 'WBNB'],
};
```

**Step 2: Create ABI files**

```typescript
// agent-backend/src/abis/erc20.ts
export const erc20Abi = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'bool' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ type: 'uint256' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view',
    inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'symbol', type: 'function', stateMutability: 'view',
    inputs: [], outputs: [{ type: 'string' }] },
] as const;
```

```typescript
// agent-backend/src/abis/vToken.ts
export const vTokenAbi = [
  { name: 'mint', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'mintAmount', type: 'uint256' }],
    outputs: [{ type: 'uint256' }] },
  { name: 'redeem', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'redeemTokens', type: 'uint256' }],
    outputs: [{ type: 'uint256' }] },
  { name: 'redeemUnderlying', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'redeemAmount', type: 'uint256' }],
    outputs: [{ type: 'uint256' }] },
  { name: 'balanceOfUnderlying', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }] },
  { name: 'supplyRatePerBlock', type: 'function', stateMutability: 'view',
    inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'exchangeRateCurrent', type: 'function', stateMutability: 'nonpayable',
    inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }] },
] as const;
```

```typescript
// agent-backend/src/abis/aavePool.ts
export const aavePoolAbi = [
  { name: 'supply', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'onBehalfOf', type: 'address' },
      { name: 'referralCode', type: 'uint16' },
    ],
    outputs: [] },
  { name: 'withdraw', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'to', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }] },
  { name: 'getReserveData', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'asset', type: 'address' }],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'configuration', type: 'uint256' },
        { name: 'liquidityIndex', type: 'uint128' },
        { name: 'currentVariableBorrowIndex', type: 'uint128' },
        { name: 'currentLiquidityRate', type: 'uint128' },
        { name: 'currentVariableBorrowRate', type: 'uint128' },
        { name: 'currentStableBorrowRate', type: 'uint128' },
        { name: 'lastUpdateTimestamp', type: 'uint40' },
        { name: 'id', type: 'uint16' },
        { name: 'aTokenAddress', type: 'address' },
        { name: 'stableDebtTokenAddress', type: 'address' },
        { name: 'variableDebtTokenAddress', type: 'address' },
        { name: 'interestRateStrategyAddress', type: 'address' },
        { name: 'accruedToTreasury', type: 'uint128' },
        { name: 'unbacked', type: 'uint128' },
        { name: 'isolationModeTotalDebt', type: 'uint128' },
      ],
    }] },
] as const;
```

```typescript
// agent-backend/src/abis/listaMoolah.ts
export const moolahVaultAbi = [
  { name: 'deposit', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'assets', type: 'uint256' }, { name: 'receiver', type: 'address' }],
    outputs: [{ type: 'uint256' }] },
  { name: 'withdraw', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'assets', type: 'uint256' }, { name: 'receiver', type: 'address' }, { name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }] },
  { name: 'totalAssets', type: 'function', stateMutability: 'view',
    inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'convertToAssets', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'shares', type: 'uint256' }],
    outputs: [{ type: 'uint256' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }] },
  { name: 'maxDeposit', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'receiver', type: 'address' }],
    outputs: [{ type: 'uint256' }] },
] as const;
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add config, contract addresses, and ABIs for Venus/Aave/Lista"
```

---

## Task 3: Data Fetching Layer

**Files:**
- Create: `agent-backend/src/data/defillama.ts`
- Create: `agent-backend/src/data/onchain.ts`
- Create: `agent-backend/src/data/types.ts`

**Step 1: Create shared types**

```typescript
// agent-backend/src/data/types.ts
export interface YieldOpportunity {
  protocol: 'venus' | 'aave' | 'lista';
  asset: string;
  assetAddress: string;
  supplyApy: number;
  apy7dAvg: number | null;  // from DeFiLlama
  tvlUsd: number;
  utilization: number | null;
  score: number;
}

export interface PortfolioPosition {
  protocol: 'venus' | 'aave' | 'lista';
  asset: string;
  assetAddress: string;
  depositedAmount: bigint;
  currentValue: bigint;
  earnedYield: bigint;
  currentApy: number;
  depositedAt: Date;
}

export interface TokenBalance {
  symbol: string;
  address: string;
  balance: bigint;
  decimals: number;
  valueUsd: number;
}
```

**Step 2: Create DeFiLlama data fetcher**

```typescript
// agent-backend/src/data/defillama.ts

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

// Fetch all BSC yield pools for our whitelisted protocols
export async function fetchBscYields(): Promise<DefiLlamaPool[]> {
  const res = await fetch(`${DEFILLAMA_BASE}/pools`);
  if (!res.ok) throw new Error(`DeFiLlama yields API error: ${res.status}`);
  const data = await res.json() as { data: DefiLlamaPool[] };

  return data.data.filter(
    (p) =>
      p.chain === 'BSC' &&
      ['venus', 'aave-v3', 'lista-lending', 'lista-dao'].includes(p.project.toLowerCase())
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
```

**Step 3: Create onchain data reader**

```typescript
// agent-backend/src/data/onchain.ts
import { createPublicClient, http, formatUnits } from 'viem';
import { CHAIN, BSC_RPC, VENUS, AAVE, LISTA, ASSETS } from '../config.js';
import { vTokenAbi } from '../abis/vToken.js';
import { aavePoolAbi } from '../abis/aavePool.js';
import { moolahVaultAbi } from '../abis/listaMoolah.js';
import { erc20Abi } from '../abis/erc20.js';
import type { YieldOpportunity, TokenBalance } from './types.js';

export const publicClient = createPublicClient({
  chain: CHAIN,
  transport: http(BSC_RPC),
});

// Venus: get supply APY for a vToken
export async function getVenusSupplyApy(vTokenAddress: `0x${string}`): Promise<number> {
  const supplyRatePerBlock = await publicClient.readContract({
    address: vTokenAddress,
    abi: vTokenAbi,
    functionName: 'supplyRatePerBlock',
  });
  const blocksPerDay = 28800; // BSC ~3s blocks
  const daysPerYear = 365;
  const ratePerBlock = Number(supplyRatePerBlock) / 1e18;
  return (Math.pow(ratePerBlock * blocksPerDay + 1, daysPerYear) - 1) * 100;
}

// Venus: get underlying balance for a user
export async function getVenusBalance(
  vTokenAddress: `0x${string}`,
  userAddress: `0x${string}`
): Promise<bigint> {
  // balanceOfUnderlying is not view, so we use balanceOf * exchangeRate
  const vBalance = await publicClient.readContract({
    address: vTokenAddress,
    abi: vTokenAbi,
    functionName: 'balanceOf',
    args: [userAddress],
  });
  if (vBalance === 0n) return 0n;
  const exchangeRate = await publicClient.readContract({
    address: vTokenAddress,
    abi: vTokenAbi,
    functionName: 'exchangeRateCurrent',
  });
  return (vBalance * exchangeRate) / BigInt(1e18);
}

// Aave: get supply APY for an asset
export async function getAaveSupplyApy(assetAddress: `0x${string}`): Promise<number> {
  const reserveData = await publicClient.readContract({
    address: AAVE.pool,
    abi: aavePoolAbi,
    functionName: 'getReserveData',
    args: [assetAddress],
  });
  const RAY = 1e27;
  return (Number(reserveData.currentLiquidityRate) / RAY) * 100;
}

// Aave: get aToken balance for a user
export async function getAaveBalance(
  aTokenAddress: `0x${string}`,
  userAddress: `0x${string}`
): Promise<bigint> {
  return publicClient.readContract({
    address: aTokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [userAddress],
  });
}

// Lista: get vault balance
export async function getListaBalance(
  vaultAddress: `0x${string}`,
  userAddress: `0x${string}`
): Promise<bigint> {
  const shares = await publicClient.readContract({
    address: vaultAddress,
    abi: moolahVaultAbi,
    functionName: 'balanceOf',
    args: [userAddress],
  });
  if (shares === 0n) return 0n;
  return publicClient.readContract({
    address: vaultAddress,
    abi: moolahVaultAbi,
    functionName: 'convertToAssets',
    args: [shares],
  });
}

// Get all ERC20 balances for agent wallet
export async function getWalletBalances(walletAddress: `0x${string}`): Promise<TokenBalance[]> {
  const balances: TokenBalance[] = [];
  for (const [symbol, asset] of Object.entries(ASSETS)) {
    const balance = await publicClient.readContract({
      address: asset.address,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [walletAddress],
    });
    balances.push({
      symbol,
      address: asset.address,
      balance,
      decimals: asset.decimals,
      valueUsd: 0, // filled in later by price fetch
    });
  }
  // Native BNB balance
  const nativeBal = await publicClient.getBalance({ address: walletAddress });
  balances.push({
    symbol: 'BNB',
    address: '0x0000000000000000000000000000000000000000',
    balance: nativeBal,
    decimals: 18,
    valueUsd: 0,
  });
  return balances;
}

// Fetch all yield opportunities from all protocols
export async function fetchAllYields(): Promise<YieldOpportunity[]> {
  const opportunities: YieldOpportunity[] = [];

  // Venus yields
  for (const [symbol, vAddress] of Object.entries(VENUS.vTokens)) {
    try {
      const apy = await getVenusSupplyApy(vAddress);
      opportunities.push({
        protocol: 'venus',
        asset: symbol,
        assetAddress: ASSETS[symbol as keyof typeof ASSETS].address,
        supplyApy: apy,
        apy7dAvg: null,
        tvlUsd: 0,
        utilization: null,
        score: 0,
      });
    } catch (e) {
      console.error(`Failed to fetch Venus ${symbol} APY:`, e);
    }
  }

  // Aave yields
  for (const [symbol, asset] of Object.entries(ASSETS)) {
    if (!AAVE.aTokens[symbol as keyof typeof AAVE.aTokens]) continue;
    try {
      const apy = await getAaveSupplyApy(asset.address);
      opportunities.push({
        protocol: 'aave',
        asset: symbol,
        assetAddress: asset.address,
        supplyApy: apy,
        apy7dAvg: null,
        tvlUsd: 0,
        utilization: null,
        score: 0,
      });
    } catch (e) {
      console.error(`Failed to fetch Aave ${symbol} APY:`, e);
    }
  }

  return opportunities;
}
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add DeFiLlama + onchain data fetching layer"
```

---

## Task 4: Protocol Adapters (Supply/Redeem)

**Files:**
- Create: `agent-backend/src/protocols/venus.ts`
- Create: `agent-backend/src/protocols/aave.ts`
- Create: `agent-backend/src/protocols/lista.ts`
- Create: `agent-backend/src/protocols/pancakeswap.ts`
- Create: `agent-backend/src/protocols/types.ts`

**Step 1: Create protocol interface**

```typescript
// agent-backend/src/protocols/types.ts
export interface ProtocolAdapter {
  name: string;
  supply(asset: string, amount: bigint, walletAddress: `0x${string}`, sendTx: SendTxFn): Promise<string>;
  withdraw(asset: string, amount: bigint, walletAddress: `0x${string}`, sendTx: SendTxFn): Promise<string>;
  getBalance(asset: string, walletAddress: `0x${string}`): Promise<bigint>;
  getApy(asset: string): Promise<number>;
}

// Function type for sending transactions via Privy
export type SendTxFn = (tx: {
  to: `0x${string}`;
  data: `0x${string}`;
  value?: bigint;
}) => Promise<string>; // returns tx hash
```

**Step 2: Venus adapter**

```typescript
// agent-backend/src/protocols/venus.ts
import { encodeFunctionData, parseUnits, maxUint256 } from 'viem';
import { VENUS, ASSETS } from '../config.js';
import { vTokenAbi } from '../abis/vToken.js';
import { erc20Abi } from '../abis/erc20.js';
import { getVenusSupplyApy, getVenusBalance, publicClient } from '../data/onchain.js';
import type { ProtocolAdapter, SendTxFn } from './types.js';

export const venusAdapter: ProtocolAdapter = {
  name: 'venus',

  async supply(asset, amount, walletAddress, sendTx) {
    const vToken = VENUS.vTokens[asset as keyof typeof VENUS.vTokens];
    const assetAddr = ASSETS[asset as keyof typeof ASSETS].address;
    if (!vToken) throw new Error(`Venus: unsupported asset ${asset}`);

    // Check and set allowance
    const allowance = await publicClient.readContract({
      address: assetAddr,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [walletAddress, vToken],
    });
    if (allowance < amount) {
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [vToken, maxUint256],
      });
      await sendTx({ to: assetAddr, data: approveData });
    }

    // Mint vTokens
    const mintData = encodeFunctionData({
      abi: vTokenAbi,
      functionName: 'mint',
      args: [amount],
    });
    return sendTx({ to: vToken, data: mintData });
  },

  async withdraw(asset, amount, walletAddress, sendTx) {
    const vToken = VENUS.vTokens[asset as keyof typeof VENUS.vTokens];
    if (!vToken) throw new Error(`Venus: unsupported asset ${asset}`);

    const redeemData = encodeFunctionData({
      abi: vTokenAbi,
      functionName: 'redeemUnderlying',
      args: [amount],
    });
    return sendTx({ to: vToken, data: redeemData });
  },

  async getBalance(asset, walletAddress) {
    const vToken = VENUS.vTokens[asset as keyof typeof VENUS.vTokens];
    if (!vToken) return 0n;
    return getVenusBalance(vToken, walletAddress);
  },

  async getApy(asset) {
    const vToken = VENUS.vTokens[asset as keyof typeof VENUS.vTokens];
    if (!vToken) return 0;
    return getVenusSupplyApy(vToken);
  },
};
```

**Step 3: Aave adapter**

```typescript
// agent-backend/src/protocols/aave.ts
import { encodeFunctionData, maxUint256 } from 'viem';
import { AAVE, ASSETS } from '../config.js';
import { aavePoolAbi } from '../abis/aavePool.js';
import { erc20Abi } from '../abis/erc20.js';
import { getAaveSupplyApy, getAaveBalance, publicClient } from '../data/onchain.js';
import type { ProtocolAdapter, SendTxFn } from './types.js';

export const aaveAdapter: ProtocolAdapter = {
  name: 'aave',

  async supply(asset, amount, walletAddress, sendTx) {
    const assetAddr = ASSETS[asset as keyof typeof ASSETS].address;

    // Approve pool
    const allowance = await publicClient.readContract({
      address: assetAddr,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [walletAddress, AAVE.pool],
    });
    if (allowance < amount) {
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [AAVE.pool, maxUint256],
      });
      await sendTx({ to: assetAddr, data: approveData });
    }

    // Supply
    const supplyData = encodeFunctionData({
      abi: aavePoolAbi,
      functionName: 'supply',
      args: [assetAddr, amount, walletAddress, 0],
    });
    return sendTx({ to: AAVE.pool, data: supplyData });
  },

  async withdraw(asset, amount, walletAddress, sendTx) {
    const assetAddr = ASSETS[asset as keyof typeof ASSETS].address;
    const withdrawData = encodeFunctionData({
      abi: aavePoolAbi,
      functionName: 'withdraw',
      args: [assetAddr, amount, walletAddress],
    });
    return sendTx({ to: AAVE.pool, data: withdrawData });
  },

  async getBalance(asset, walletAddress) {
    const aToken = AAVE.aTokens[asset as keyof typeof AAVE.aTokens];
    if (!aToken) return 0n;
    return getAaveBalance(aToken, walletAddress);
  },

  async getApy(asset) {
    const assetAddr = ASSETS[asset as keyof typeof ASSETS].address;
    return getAaveSupplyApy(assetAddr);
  },
};
```

**Step 4: Lista adapter**

```typescript
// agent-backend/src/protocols/lista.ts
import { encodeFunctionData, maxUint256 } from 'viem';
import { LISTA, ASSETS } from '../config.js';
import { moolahVaultAbi } from '../abis/listaMoolah.js';
import { erc20Abi } from '../abis/erc20.js';
import { getListaBalance, publicClient } from '../data/onchain.js';
import type { ProtocolAdapter, SendTxFn } from './types.js';

// Map assets to Lista vault addresses
const VAULT_MAP: Record<string, `0x${string}`> = {
  WBNB: LISTA.vaults.WBNB,
};

export const listaAdapter: ProtocolAdapter = {
  name: 'lista',

  async supply(asset, amount, walletAddress, sendTx) {
    const vault = VAULT_MAP[asset];
    if (!vault) throw new Error(`Lista: unsupported asset ${asset}`);
    const assetAddr = ASSETS[asset as keyof typeof ASSETS].address;

    // Approve vault
    const allowance = await publicClient.readContract({
      address: assetAddr,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [walletAddress, vault],
    });
    if (allowance < amount) {
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [vault, maxUint256],
      });
      await sendTx({ to: assetAddr, data: approveData });
    }

    // Deposit into vault (ERC4626)
    const depositData = encodeFunctionData({
      abi: moolahVaultAbi,
      functionName: 'deposit',
      args: [amount, walletAddress],
    });
    return sendTx({ to: vault, data: depositData });
  },

  async withdraw(asset, amount, walletAddress, sendTx) {
    const vault = VAULT_MAP[asset];
    if (!vault) throw new Error(`Lista: unsupported asset ${asset}`);

    const withdrawData = encodeFunctionData({
      abi: moolahVaultAbi,
      functionName: 'withdraw',
      args: [amount, walletAddress, walletAddress],
    });
    return sendTx({ to: vault, data: withdrawData });
  },

  async getBalance(asset, walletAddress) {
    const vault = VAULT_MAP[asset];
    if (!vault) return 0n;
    return getListaBalance(vault, walletAddress);
  },

  async getApy(_asset) {
    // Lista APY comes from DeFiLlama, not easily onchain
    // Return 0 here, will be enriched by DeFiLlama data
    return 0;
  },
};
```

**Step 5: PancakeSwap swap adapter (minimal)**

```typescript
// agent-backend/src/protocols/pancakeswap.ts
import { encodeFunctionData, parseAbi, maxUint256 } from 'viem';
import { PANCAKESWAP } from '../config.js';
import { erc20Abi } from '../abis/erc20.js';
import { publicClient } from '../data/onchain.js';
import type { SendTxFn } from './types.js';

// PancakeSwap V3 exact input single swap
const swapAbi = parseAbi([
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
]);

export async function swapTokens(
  tokenIn: `0x${string}`,
  tokenOut: `0x${string}`,
  amountIn: bigint,
  walletAddress: `0x${string}`,
  sendTx: SendTxFn,
  slippageBps: number = 100, // 1% default
): Promise<string> {
  // Approve router
  const allowance = await publicClient.readContract({
    address: tokenIn,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [walletAddress, PANCAKESWAP.smartRouter],
  });
  if (allowance < amountIn) {
    const approveData = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [PANCAKESWAP.smartRouter, maxUint256],
    });
    await sendTx({ to: tokenIn, data: approveData });
  }

  // Execute swap (fee 500 = 0.05% for stables, 2500 = 0.25% for majors)
  const fee = 2500; // default to 0.25%
  const swapData = encodeFunctionData({
    abi: swapAbi,
    functionName: 'exactInputSingle',
    args: [{
      tokenIn,
      tokenOut,
      fee,
      recipient: walletAddress,
      amountIn,
      amountOutMinimum: 0n, // TODO: get quote first for production
      sqrtPriceLimitX96: 0n,
    }],
  });

  return sendTx({ to: PANCAKESWAP.smartRouter, data: swapData });
}
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add protocol adapters for Venus, Aave, Lista, PancakeSwap"
```

---

## Task 5: Wallet Layer (Privy Server Wallets)

**Files:**
- Create: `agent-backend/src/wallet/privy.ts`

**Step 1: Create Privy server wallet integration**

```typescript
// agent-backend/src/wallet/privy.ts
import { PrivyClient } from '@privy-io/server-auth';

const privy = new PrivyClient(
  process.env.PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

// Create an embedded wallet for a new user's agent
export async function createAgentWallet(userId: string): Promise<string> {
  const wallet = await privy.walletApi.create({
    chainType: 'ethereum',
  });
  return wallet.address;
}

// Send a transaction from the agent wallet
export async function sendTransaction(
  walletId: string,
  tx: { to: `0x${string}`; data: `0x${string}`; value?: bigint }
): Promise<string> {
  const result = await privy.walletApi.ethereum.sendTransaction({
    walletId,
    caip2: 'eip155:56', // BSC mainnet
    transaction: {
      to: tx.to,
      data: tx.data,
      value: tx.value ? `0x${tx.value.toString(16)}` : undefined,
    },
  });
  return result.hash;
}

// Get wallet address by wallet ID
export async function getWalletAddress(walletId: string): Promise<string> {
  const wallet = await privy.walletApi.getWallet(walletId);
  return wallet.address;
}

// Create a sendTx function bound to a specific wallet
export function createSendTxFn(walletId: string) {
  return async (tx: { to: `0x${string}`; data: `0x${string}`; value?: bigint }) => {
    return sendTransaction(walletId, tx);
  };
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add Privy server wallet integration"
```

---

## Task 6: AI Summarizer (OpenAI GPT-5.2)

**Files:**
- Create: `agent-backend/src/ai/openai.ts`

**Step 1: Create OpenAI summarizer**

```typescript
// agent-backend/src/ai/openai.ts
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODEL = 'gpt-5.2';

// Summarize a rebalance decision
export async function summarizeRebalance(context: {
  action: string;
  asset: string;
  fromProtocol: string;
  toProtocol: string;
  amount: string;
  oldApy: number;
  newApy: number;
  reason: string;
}): Promise<string> {
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: `You are a DeFi strategy agent assistant. Explain portfolio actions in 2-3 clear sentences.
Be specific about numbers. Mention the reason for the move. Keep it conversational but informative.
Do not use emojis. Do not use markdown.`,
      },
      {
        role: 'user',
        content: `Explain this portfolio action:
Action: ${context.action}
Asset: ${context.asset}
From: ${context.fromProtocol} (${context.oldApy.toFixed(2)}% APY)
To: ${context.toProtocol} (${context.newApy.toFixed(2)}% APY)
Amount: ${context.amount}
Reason: ${context.reason}`,
      },
    ],
    max_tokens: 200,
  });

  return response.choices[0]?.message?.content || 'Action completed.';
}

// Generate daily portfolio summary
export async function generateDailySummary(context: {
  totalValue: string;
  dailyYield: string;
  totalEarned: string;
  positions: Array<{ asset: string; protocol: string; apy: number; value: string }>;
  recentActions: string[];
}): Promise<string> {
  const positionsSummary = context.positions
    .map((p) => `${p.asset} on ${p.protocol}: ${p.apy.toFixed(2)}% APY, value $${p.value}`)
    .join('\n');

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: `You are a DeFi portfolio manager. Write a brief daily summary (3-5 sentences).
Cover: overall performance, any notable APY changes, whether positions are optimal.
Be direct and data-driven. No emojis. No markdown.`,
      },
      {
        role: 'user',
        content: `Daily portfolio summary:
Total value: $${context.totalValue}
Daily yield: $${context.dailyYield}
Total earned: $${context.totalEarned}

Positions:
${positionsSummary}

Recent actions (last 24h):
${context.recentActions.length > 0 ? context.recentActions.join('\n') : 'No actions taken.'}`,
      },
    ],
    max_tokens: 300,
  });

  return response.choices[0]?.message?.content || 'Portfolio is being monitored.';
}

// Analyze whether a rebalance is warranted
export async function analyzeRebalanceDecision(context: {
  currentPositions: Array<{ asset: string; protocol: string; apy: number; value: string }>;
  opportunities: Array<{ asset: string; protocol: string; apy: number; tvl: number }>;
  triggers: string[];
}): Promise<string> {
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: `You are a conservative DeFi strategy analyst. Given current positions and opportunities,
provide a brief assessment (2-3 sentences) of whether any rebalancing is warranted.
Be conservative — only recommend moves with clear, sustained benefit. No emojis. No markdown.`,
      },
      {
        role: 'user',
        content: `Current positions:
${JSON.stringify(context.currentPositions, null, 2)}

Top opportunities:
${JSON.stringify(context.opportunities, null, 2)}

Active triggers:
${context.triggers.length > 0 ? context.triggers.join('\n') : 'None'}`,
      },
    ],
    max_tokens: 200,
  });

  return response.choices[0]?.message?.content || 'No analysis available.';
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add OpenAI GPT-5.2 summarizer for agent decisions"
```

---

## Task 7: Strategy Evaluator + Executor

**Files:**
- Create: `agent-backend/src/agent/evaluator.ts`
- Create: `agent-backend/src/agent/executor.ts`

**Step 1: Create the evaluator (scoring + rebalance decision)**

```typescript
// agent-backend/src/agent/evaluator.ts
import { PROTOCOL_TRUST, DEFAULT_SETTINGS } from '../config.js';
import type { YieldOpportunity, PortfolioPosition } from '../data/types.js';

export interface RebalanceAction {
  asset: string;
  fromProtocol: string;
  toProtocol: string;
  amount: bigint;
  reason: string;
  oldApy: number;
  newApy: number;
}

// Score a yield opportunity
export function scoreOpportunity(opp: YieldOpportunity, settings: typeof DEFAULT_SETTINGS): number {
  const apy = opp.apy7dAvg ?? opp.supplyApy;

  // APY component (35%) — normalize to 0-100 assuming max 20% APY
  const apyScore = Math.min(apy / 20, 1) * 100;

  // TVL safety (25%) — log scale, $1B+ = 100
  const tvlScore = Math.min(Math.log10(Math.max(opp.tvlUsd, 1)) / 9, 1) * 100;

  // Protocol trust (25%)
  const trustScore = PROTOCOL_TRUST[opp.protocol] || 50;

  // Utilization health (15%) — <80% is good
  const utilScore = opp.utilization !== null
    ? (opp.utilization < 80 ? 100 : Math.max(0, 100 - (opp.utilization - 80) * 5))
    : 70; // default if unknown

  return apyScore * 0.35 + tvlScore * 0.25 + trustScore * 0.25 + utilScore * 0.15;
}

// Determine if rebalancing is needed
export function evaluateRebalance(
  positions: PortfolioPosition[],
  opportunities: YieldOpportunity[],
  settings: typeof DEFAULT_SETTINGS,
  lastRebalanceTime: Date | null,
): RebalanceAction[] {
  const actions: RebalanceAction[] = [];

  // Check cooldown
  if (lastRebalanceTime) {
    const hoursSince = (Date.now() - lastRebalanceTime.getTime()) / (1000 * 60 * 60);
    if (hoursSince < settings.rebalanceCooldownHours) return [];
  }

  for (const pos of positions) {
    // Find best alternative for this asset
    const alternatives = opportunities
      .filter((o) =>
        o.asset === pos.asset &&
        o.protocol !== pos.protocol &&
        settings.whitelistedProtocols.includes(o.protocol) &&
        o.tvlUsd >= settings.minTvl
      )
      .sort((a, b) => b.supplyApy - a.supplyApy);

    if (alternatives.length === 0) continue;

    const best = alternatives[0];
    const apyImprovement = (best.apy7dAvg ?? best.supplyApy) - pos.currentApy;

    // Only rebalance if improvement exceeds threshold
    if (apyImprovement >= settings.apyThreshold) {
      actions.push({
        asset: pos.asset,
        fromProtocol: pos.protocol,
        toProtocol: best.protocol,
        amount: pos.depositedAmount,
        reason: `APY improvement of ${apyImprovement.toFixed(2)}% (${pos.currentApy.toFixed(2)}% → ${best.supplyApy.toFixed(2)}%)`,
        oldApy: pos.currentApy,
        newApy: best.supplyApy,
      });
    }
  }

  return actions;
}
```

**Step 2: Create the executor**

```typescript
// agent-backend/src/agent/executor.ts
import { formatUnits } from 'viem';
import { venusAdapter } from '../protocols/venus.js';
import { aaveAdapter } from '../protocols/aave.js';
import { listaAdapter } from '../protocols/lista.js';
import { summarizeRebalance } from '../ai/openai.js';
import type { ProtocolAdapter, SendTxFn } from '../protocols/types.js';
import type { RebalanceAction } from './evaluator.js';

const adapters: Record<string, ProtocolAdapter> = {
  venus: venusAdapter,
  aave: aaveAdapter,
  lista: listaAdapter,
};

export interface ExecutionResult {
  action: RebalanceAction;
  withdrawTxHash: string;
  supplyTxHash: string;
  aiSummary: string;
  success: boolean;
  error?: string;
}

export async function executeRebalance(
  action: RebalanceAction,
  walletAddress: `0x${string}`,
  sendTx: SendTxFn,
): Promise<ExecutionResult> {
  const fromAdapter = adapters[action.fromProtocol];
  const toAdapter = adapters[action.toProtocol];

  if (!fromAdapter || !toAdapter) {
    return {
      action,
      withdrawTxHash: '',
      supplyTxHash: '',
      aiSummary: '',
      success: false,
      error: `Unknown protocol: ${action.fromProtocol} or ${action.toProtocol}`,
    };
  }

  try {
    // Step 1: Withdraw from current protocol
    console.log(`Withdrawing ${action.asset} from ${action.fromProtocol}...`);
    const withdrawHash = await fromAdapter.withdraw(
      action.asset, action.amount, walletAddress, sendTx
    );

    // Step 2: Supply to new protocol
    console.log(`Supplying ${action.asset} to ${action.toProtocol}...`);
    const supplyHash = await toAdapter.supply(
      action.asset, action.amount, walletAddress, sendTx
    );

    // Step 3: AI summary
    const summary = await summarizeRebalance({
      action: 'rebalance',
      asset: action.asset,
      fromProtocol: action.fromProtocol,
      toProtocol: action.toProtocol,
      amount: formatUnits(action.amount, 18),
      oldApy: action.oldApy,
      newApy: action.newApy,
      reason: action.reason,
    });

    return {
      action,
      withdrawTxHash: withdrawHash,
      supplyTxHash: supplyHash,
      aiSummary: summary,
      success: true,
    };
  } catch (error) {
    return {
      action,
      withdrawTxHash: '',
      supplyTxHash: '',
      aiSummary: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Deploy idle funds to the best opportunity
export async function deployFunds(
  asset: string,
  amount: bigint,
  bestProtocol: string,
  walletAddress: `0x${string}`,
  sendTx: SendTxFn,
): Promise<{ txHash: string; summary: string }> {
  const adapter = adapters[bestProtocol];
  if (!adapter) throw new Error(`Unknown protocol: ${bestProtocol}`);

  const txHash = await adapter.supply(asset, amount, walletAddress, sendTx);

  const summary = await summarizeRebalance({
    action: 'initial_deposit',
    asset,
    fromProtocol: 'wallet',
    toProtocol: bestProtocol,
    amount: formatUnits(amount, 18),
    oldApy: 0,
    newApy: 0,
    reason: 'Deploying idle funds to best available yield',
  });

  return { txHash, summary };
}
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add strategy evaluator and rebalance executor"
```

---

## Task 8: Scheduler (Cron Jobs)

**Files:**
- Create: `agent-backend/src/agent/scheduler.ts`
- Modify: `agent-backend/src/index.ts` — wire up scheduler

**Step 1: Create scheduler**

```typescript
// agent-backend/src/agent/scheduler.ts
import cron from 'node-cron';
import { fetchBscYields, fetchTokenPrices } from '../data/defillama.js';
import { fetchAllYields } from '../data/onchain.js';
import { scoreOpportunity, evaluateRebalance } from './evaluator.js';
import { executeRebalance } from './executor.js';
import { generateDailySummary } from '../ai/openai.js';
import { DEFAULT_SETTINGS } from '../config.js';
import { wss } from '../index.js';

// In-memory state (will be backed by Supabase in Task 9)
let latestYields: any[] = [];
let lastRebalanceTime: Date | null = null;

function broadcast(event: string, data: any) {
  const message = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(message);
  });
}

// Every 15 min: fetch rates
export function startRateFetcher() {
  cron.schedule('*/15 * * * *', async () => {
    try {
      console.log('[CRON] Fetching rates...');

      // Fetch from both DeFiLlama and onchain
      const [llamaYields, onchainYields] = await Promise.all([
        fetchBscYields().catch(() => []),
        fetchAllYields().catch(() => []),
      ]);

      // Enrich onchain yields with DeFiLlama 7d average
      for (const opp of onchainYields) {
        const llamaMatch = llamaYields.find(
          (l) => l.project.toLowerCase().includes(opp.protocol) &&
                 l.symbol.toUpperCase().includes(opp.asset)
        );
        if (llamaMatch) {
          opp.apy7dAvg = llamaMatch.apyMean30d; // use 30d mean as proxy
          opp.tvlUsd = llamaMatch.tvlUsd;
        }
        opp.score = scoreOpportunity(opp, DEFAULT_SETTINGS);
      }

      latestYields = onchainYields;
      broadcast('yields_updated', { yields: onchainYields });
      console.log(`[CRON] Fetched ${onchainYields.length} yield opportunities`);
    } catch (error) {
      console.error('[CRON] Rate fetch error:', error);
    }
  });
}

// Every 6 hours: evaluate rebalance
export function startRebalanceEvaluator() {
  cron.schedule('0 */6 * * *', async () => {
    try {
      console.log('[CRON] Evaluating rebalance...');
      // TODO: fetch positions from Supabase, run evaluator, execute if needed
      broadcast('evaluation', { message: 'Rebalance evaluation complete. No action needed.' });
    } catch (error) {
      console.error('[CRON] Rebalance evaluation error:', error);
    }
  });
}

// Daily: generate summary
export function startDailySummary() {
  cron.schedule('0 0 * * *', async () => {
    try {
      console.log('[CRON] Generating daily summary...');
      // TODO: fetch portfolio data, generate summary via OpenAI
      broadcast('daily_summary', { summary: 'Daily summary generation pending...' });
    } catch (error) {
      console.error('[CRON] Daily summary error:', error);
    }
  });
}

export function startAllSchedulers() {
  startRateFetcher();
  startRebalanceEvaluator();
  startDailySummary();
  console.log('[SCHEDULER] All cron jobs started');
}

export function getLatestYields() {
  return latestYields;
}
```

**Step 2: Wire scheduler into index.ts — add after server.listen:**

```typescript
import { startAllSchedulers } from './agent/scheduler.js';

// After server.listen callback:
startAllSchedulers();
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add cron scheduler for rate fetching, rebalance evaluation, daily summary"
```

---

## Task 9: Database Layer (Supabase)

**Files:**
- Create: `agent-backend/src/db/supabase.ts`
- Create: `agent-backend/src/db/schema.sql`

**Step 1: Create Supabase schema**

```sql
-- agent-backend/src/db/schema.sql
-- Run this in Supabase SQL editor

create table users (
  id uuid primary key default gen_random_uuid(),
  eoa_address text unique not null,
  agent_wallet_id text unique,
  agent_wallet_address text unique,
  created_at timestamptz default now()
);

create table settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade unique,
  risk_level text default 'medium',
  min_tvl bigint default 10000000,
  apy_threshold numeric default 2.0,
  max_per_protocol numeric default 50,
  rebalance_cooldown_hours int default 6,
  whitelisted_protocols text[] default '{venus,aave,lista}',
  whitelisted_assets text[] default '{USDT,USDC,BTCB,WETH,WBNB}',
  updated_at timestamptz default now()
);

create table positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  protocol text not null,
  asset text not null,
  deposited_amount numeric not null,
  current_apy numeric default 0,
  earned_yield numeric default 0,
  deposited_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  type text not null, -- deposit, withdraw, supply, redeem, swap, harvest, rebalance
  from_protocol text,
  to_protocol text,
  asset text not null,
  amount numeric not null,
  tx_hash text,
  ai_summary text,
  created_at timestamptz default now()
);

create table yield_snapshots (
  id uuid primary key default gen_random_uuid(),
  protocol text not null,
  asset text not null,
  apy numeric not null,
  tvl numeric,
  recorded_at timestamptz default now()
);

create table portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  total_value numeric not null,
  daily_yield numeric,
  recorded_at timestamptz default now()
);

-- Indexes
create index idx_positions_user on positions(user_id);
create index idx_transactions_user on transactions(user_id);
create index idx_yield_snapshots_time on yield_snapshots(recorded_at);
create index idx_portfolio_snapshots_user_time on portfolio_snapshots(user_id, recorded_at);
```

**Step 2: Create Supabase client + DB helpers**

```typescript
// agent-backend/src/db/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

// User operations
export async function getOrCreateUser(eoaAddress: string) {
  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('eoa_address', eoaAddress.toLowerCase())
    .single();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from('users')
    .insert({ eoa_address: eoaAddress.toLowerCase() })
    .select()
    .single();

  if (error) throw error;
  return created;
}

export async function updateAgentWallet(userId: string, walletId: string, walletAddress: string) {
  await supabase
    .from('users')
    .update({ agent_wallet_id: walletId, agent_wallet_address: walletAddress })
    .eq('id', userId);
}

// Settings operations
export async function getUserSettings(userId: string) {
  const { data } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data;
}

export async function upsertSettings(userId: string, settings: Record<string, any>) {
  await supabase
    .from('settings')
    .upsert({ user_id: userId, ...settings, updated_at: new Date().toISOString() });
}

// Position operations
export async function getUserPositions(userId: string) {
  const { data } = await supabase
    .from('positions')
    .select('*')
    .eq('user_id', userId);
  return data || [];
}

export async function upsertPosition(userId: string, position: {
  protocol: string;
  asset: string;
  deposited_amount: number;
  current_apy: number;
}) {
  await supabase
    .from('positions')
    .upsert({
      user_id: userId,
      protocol: position.protocol,
      asset: position.asset,
      deposited_amount: position.deposited_amount,
      current_apy: position.current_apy,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,protocol,asset' });
}

// Transaction log
export async function logTransaction(userId: string, tx: {
  type: string;
  from_protocol?: string;
  to_protocol?: string;
  asset: string;
  amount: number;
  tx_hash?: string;
  ai_summary?: string;
}) {
  await supabase.from('transactions').insert({ user_id: userId, ...tx });
}

// Yield snapshots
export async function saveYieldSnapshot(yields: Array<{ protocol: string; asset: string; apy: number; tvl: number }>) {
  const rows = yields.map((y) => ({
    protocol: y.protocol,
    asset: y.asset,
    apy: y.apy,
    tvl: y.tvl,
  }));
  await supabase.from('yield_snapshots').insert(rows);
}

// Portfolio snapshots
export async function savePortfolioSnapshot(userId: string, totalValue: number, dailyYield: number) {
  await supabase.from('portfolio_snapshots').insert({
    user_id: userId,
    total_value: totalValue,
    daily_yield: dailyYield,
  });
}

// Get transaction history
export async function getTransactionHistory(userId: string, limit = 50) {
  const { data } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}

// Get portfolio history for charts
export async function getPortfolioHistory(userId: string, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('portfolio_snapshots')
    .select('*')
    .eq('user_id', userId)
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: true });
  return data || [];
}
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add Supabase schema and database helpers"
```

---

## Task 10: Backend API Routes

**Files:**
- Create: `agent-backend/src/api/routes.ts`
- Modify: `agent-backend/src/index.ts` — mount routes

**Step 1: Create all REST endpoints**

```typescript
// agent-backend/src/api/routes.ts
import { Router } from 'express';
import { getLatestYields } from '../agent/scheduler.js';
import { createAgentWallet, createSendTxFn } from '../wallet/privy.js';
import {
  getOrCreateUser, updateAgentWallet, getUserSettings,
  upsertSettings, getUserPositions, getTransactionHistory,
  getPortfolioHistory, logTransaction,
} from '../db/supabase.js';
import { getWalletBalances } from '../data/onchain.js';
import { evaluateRebalance } from '../agent/evaluator.js';
import { executeRebalance, deployFunds } from '../agent/executor.js';
import { DEFAULT_SETTINGS } from '../config.js';

export const router = Router();

// Get current yield opportunities
router.get('/yields', (req, res) => {
  res.json({ yields: getLatestYields() });
});

// Register/login user and get or create agent wallet
router.post('/auth', async (req, res) => {
  try {
    const { eoaAddress } = req.body;
    if (!eoaAddress) return res.status(400).json({ error: 'eoaAddress required' });

    const user = await getOrCreateUser(eoaAddress);

    // Create agent wallet if none exists
    if (!user.agent_wallet_address) {
      const walletAddress = await createAgentWallet(user.id);
      await updateAgentWallet(user.id, user.id, walletAddress);
      user.agent_wallet_address = walletAddress;
    }

    const settings = await getUserSettings(user.id);

    res.json({
      userId: user.id,
      agentWallet: user.agent_wallet_address,
      settings: settings || DEFAULT_SETTINGS,
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get portfolio
router.get('/portfolio/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const positions = await getUserPositions(userId);
    const history = await getPortfolioHistory(userId);
    res.json({ positions, history });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

// Get transaction history
router.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const transactions = await getTransactionHistory(userId);
    res.json({ transactions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Update settings
router.post('/settings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    await upsertSettings(userId, req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Manual rebalance trigger
router.post('/rebalance/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    // TODO: implement full rebalance flow
    res.json({ message: 'Rebalance evaluation started', actions: [] });
  } catch (error) {
    res.status(500).json({ error: 'Rebalance failed' });
  }
});

// Get agent wallet address for deposits
router.get('/deposit/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await getOrCreateUser(userId);
    res.json({ agentWallet: user.agent_wallet_address });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get deposit address' });
  }
});
```

**Step 2: Mount routes in index.ts**

Add to `agent-backend/src/index.ts`:
```typescript
import { router } from './api/routes.js';
app.use('/api', router);
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add backend REST API routes"
```

---

## Task 11: Frontend — Privy Setup + Layout

**Files:**
- Modify: `frontend/src/app/layout.tsx`
- Create: `frontend/src/app/providers.tsx`
- Create: `frontend/src/lib/api.ts`
- Modify: `frontend/src/app/page.tsx`

**Step 1: Create providers (Privy + React Query + Wagmi)**

```typescript
// frontend/src/app/providers.tsx
'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { bsc } from 'wagmi/chains';
import { useState } from 'react';

const wagmiConfig = createConfig({
  chains: [bsc],
  transports: { [bsc.id]: http() },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        appearance: { theme: 'dark' },
        supportedChains: [bsc],
        defaultChain: bsc,
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
```

**Step 2: Create API client**

```typescript
// frontend/src/lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchApi(path: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  getYields: () => fetchApi('/yields'),
  auth: (eoaAddress: string) => fetchApi('/auth', {
    method: 'POST',
    body: JSON.stringify({ eoaAddress }),
  }),
  getPortfolio: (userId: string) => fetchApi(`/portfolio/${userId}`),
  getHistory: (userId: string) => fetchApi(`/history/${userId}`),
  updateSettings: (userId: string, settings: any) => fetchApi(`/settings/${userId}`, {
    method: 'POST',
    body: JSON.stringify(settings),
  }),
  triggerRebalance: (userId: string) => fetchApi(`/rebalance/${userId}`, {
    method: 'POST',
  }),
};
```

**Step 3: Update layout.tsx to use providers**

```typescript
// frontend/src/app/layout.tsx
import './globals.css';
import { Providers } from './providers';

export const metadata = {
  title: 'DeFi Yield Agent',
  description: 'AI-powered DeFi yield optimization on BSC',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

**Step 4: Create landing page with wallet connect**

```typescript
// frontend/src/app/page.tsx
'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Home() {
  const { login, authenticated, user } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (authenticated) router.push('/dashboard');
  }, [authenticated, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
      <div className="text-center space-y-6">
        <h1 className="text-5xl font-bold">DeFi Yield Agent</h1>
        <p className="text-xl text-gray-400 max-w-md">
          AI-powered yield optimization across BSC lending protocols.
          Set your boundaries. Let the agent work.
        </p>
        <Button size="lg" onClick={login}>
          Connect Wallet
        </Button>
      </div>
    </main>
  );
}
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Privy auth, providers, API client, landing page"
```

---

## Task 12: Frontend — Dashboard Page

**Files:**
- Create: `frontend/src/app/dashboard/page.tsx`
- Create: `frontend/src/components/portfolio-card.tsx`
- Create: `frontend/src/components/yields-table.tsx`
- Create: `frontend/src/components/activity-log.tsx`
- Create: `frontend/src/hooks/use-agent.ts`

**Step 1: Create useAgent hook**

```typescript
// frontend/src/hooks/use-agent.ts
'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useEffect, useState, useRef } from 'react';

export function useAgent() {
  const { user, authenticated } = usePrivy();
  const [userId, setUserId] = useState<string | null>(null);
  const [agentWallet, setAgentWallet] = useState<string | null>(null);
  const [wsMessages, setWsMessages] = useState<any[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // Auth on connect
  useEffect(() => {
    if (!authenticated || !user?.wallet?.address) return;
    api.auth(user.wallet.address).then((data) => {
      setUserId(data.userId);
      setAgentWallet(data.agentWallet);
    });
  }, [authenticated, user]);

  // WebSocket connection
  useEffect(() => {
    const wsUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace('http', 'ws');
    const ws = new WebSocket(`${wsUrl}/ws`);
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      setWsMessages((prev) => [msg, ...prev].slice(0, 100));
    };
    wsRef.current = ws;
    return () => ws.close();
  }, []);

  const yields = useQuery({
    queryKey: ['yields'],
    queryFn: api.getYields,
    refetchInterval: 60_000,
  });

  const portfolio = useQuery({
    queryKey: ['portfolio', userId],
    queryFn: () => api.getPortfolio(userId!),
    enabled: !!userId,
    refetchInterval: 60_000,
  });

  const history = useQuery({
    queryKey: ['history', userId],
    queryFn: () => api.getHistory(userId!),
    enabled: !!userId,
  });

  const rebalance = useMutation({
    mutationFn: () => api.triggerRebalance(userId!),
  });

  return {
    userId,
    agentWallet,
    yields,
    portfolio,
    history,
    rebalance,
    wsMessages,
  };
}
```

**Step 2: Create portfolio card component**

```typescript
// frontend/src/components/portfolio-card.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  totalValue: number;
  dailyYield: number;
  totalEarned: number;
  agentWallet: string | null;
}

export function PortfolioCard({ totalValue, dailyYield, totalEarned, agentWallet }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-400">Portfolio Value</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">${totalValue.toLocaleString()}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-400">Daily Yield</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-green-500">+${dailyYield.toFixed(2)}/day</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-400">Total Earned</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-green-500">${totalEarned.toFixed(2)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-400">Agent Wallet</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-mono truncate">
            {agentWallet || 'Not created'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 3: Create yields table component**

```typescript
// frontend/src/components/yields-table.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface YieldOpp {
  protocol: string;
  asset: string;
  supplyApy: number;
  tvlUsd: number;
  score: number;
}

export function YieldsTable({ yields }: { yields: YieldOpp[] }) {
  const sorted = [...yields].sort((a, b) => b.score - a.score);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Yield Opportunities</CardTitle>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-800">
              <th className="text-left py-2">Asset</th>
              <th className="text-left py-2">Protocol</th>
              <th className="text-right py-2">Supply APY</th>
              <th className="text-right py-2">TVL</th>
              <th className="text-right py-2">Score</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((y, i) => (
              <tr key={i} className="border-b border-gray-800/50">
                <td className="py-2 font-medium">{y.asset}</td>
                <td className="py-2">
                  <Badge variant="outline">{y.protocol}</Badge>
                </td>
                <td className="py-2 text-right text-green-500">{y.supplyApy.toFixed(2)}%</td>
                <td className="py-2 text-right">${(y.tvlUsd / 1e6).toFixed(1)}M</td>
                <td className="py-2 text-right">{y.score.toFixed(0)}</td>
              </tr>
            ))}
            {yields.length === 0 && (
              <tr><td colSpan={5} className="py-4 text-center text-gray-500">Loading yields...</td></tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
```

**Step 4: Create activity log component**

```typescript
// frontend/src/components/activity-log.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Activity {
  event: string;
  data: any;
  timestamp: string;
}

export function ActivityLog({ activities }: { activities: Activity[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {activities.map((a, i) => (
            <div key={i} className="flex items-start gap-3 text-sm border-b border-gray-800/50 pb-2">
              <span className="text-gray-500 whitespace-nowrap">
                {new Date(a.timestamp).toLocaleTimeString()}
              </span>
              <div>
                <span className="font-medium">{a.event}</span>
                {a.data?.message && (
                  <p className="text-gray-400 mt-1">{a.data.message}</p>
                )}
                {a.data?.summary && (
                  <p className="text-gray-400 mt-1">{a.data.summary}</p>
                )}
              </div>
            </div>
          ))}
          {activities.length === 0 && (
            <p className="text-gray-500 text-center py-4">No activity yet. Agent is waiting for deposits.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 5: Create dashboard page**

```typescript
// frontend/src/app/dashboard/page.tsx
'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useAgent } from '@/hooks/use-agent';
import { PortfolioCard } from '@/components/portfolio-card';
import { YieldsTable } from '@/components/yields-table';
import { ActivityLog } from '@/components/activity-log';

export default function Dashboard() {
  const { authenticated, logout } = usePrivy();
  const router = useRouter();
  const { agentWallet, yields, portfolio, rebalance, wsMessages } = useAgent();

  useEffect(() => {
    if (!authenticated) router.push('/');
  }, [authenticated, router]);

  const positions = portfolio.data?.positions || [];
  const totalValue = positions.reduce((sum: number, p: any) => sum + Number(p.deposited_amount), 0);

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">DeFi Yield Agent</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => rebalance.mutate()}>
              Rebalance Now
            </Button>
            <Button variant="ghost" onClick={logout}>
              Disconnect
            </Button>
          </div>
        </div>

        {/* Portfolio overview */}
        <PortfolioCard
          totalValue={totalValue}
          dailyYield={0}
          totalEarned={0}
          agentWallet={agentWallet}
        />

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Current positions */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Current Positions</h2>
            {positions.length > 0 ? (
              positions.map((p: any, i: number) => (
                <div key={i} className="bg-gray-900 rounded-lg p-4">
                  <div className="flex justify-between">
                    <span className="font-medium">{p.asset} on {p.protocol}</span>
                    <span className="text-green-500">{Number(p.current_apy).toFixed(2)}% APY</span>
                  </div>
                  <p className="text-gray-400 text-sm mt-1">
                    ${Number(p.deposited_amount).toLocaleString()}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-gray-500">No positions. Fund your agent wallet to get started.</p>
            )}
          </div>

          {/* Yields */}
          <YieldsTable yields={yields.data?.yields || []} />
        </div>

        {/* Activity log */}
        <ActivityLog activities={wsMessages} />
      </div>
    </div>
  );
}
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add dashboard with portfolio, yields table, and activity log"
```

---

## Task 13: Frontend — Settings Page

**Files:**
- Create: `frontend/src/app/dashboard/settings/page.tsx`

**Step 1: Create settings page with all configurable boundaries**

This page allows users to configure: risk level, min TVL, APY threshold, max per protocol %, rebalance cooldown, whitelisted protocols, and whitelisted assets. Uses shadcn/ui form components. Saves via `api.updateSettings()`.

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add settings page for agent boundaries"
```

---

## Task 14: Integration Testing + Polish

**Step 1:** Test backend starts without errors: `cd agent-backend && npm run dev`

**Step 2:** Test frontend starts: `cd frontend && npm run dev`

**Step 3:** Verify DeFiLlama API returns BSC yields — hit `http://localhost:3001/api/yields`

**Step 4:** Verify onchain reads work — check Venus/Aave APY reads don't error

**Step 5:** Test Privy wallet connect flow in browser

**Step 6:** Commit any fixes

```bash
git add -A
git commit -m "fix: integration testing fixes"
```

---

## Task 15: Deploy

**Step 1:** Deploy frontend to Vercel

```bash
cd frontend
npx vercel --prod
```

Set env vars: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_PRIVY_APP_ID`

**Step 2:** Deploy backend to Railway

```bash
cd agent-backend
# Push to GitHub, connect Railway to repo
# Set env vars: BSC_RPC_URL, PRIVY_APP_ID, PRIVY_APP_SECRET, OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
```

**Step 3:** Verify end-to-end flow on deployed URLs

**Step 4:** Commit deployment config

```bash
git add -A
git commit -m "chore: deployment configuration"
```

---

## Task 16: Hackathon Submission

**Step 1:** Create public GitHub repo, push all code

**Step 2:** Record a 2-3 min demo video showing:
- Connect wallet
- See yield opportunities across Venus/Aave/Lista
- Fund agent wallet
- Agent deploys to best yield
- Settings configuration
- Agent activity log with AI summaries

**Step 3:** Submit on DoraHacks with:
- Repo URL
- Demo link (Vercel)
- Agent wallet address (onchain proof)
- Demo video
- Description highlighting: AI-powered, semi-autonomous, conservative strategy, multi-protocol

---

## Build Order Summary

| Task | Est. | Dependency |
|------|------|------------|
| 1. Scaffolding | 15 min | None |
| 2. Config + ABIs | 15 min | Task 1 |
| 3. Data fetching | 30 min | Task 2 |
| 4. Protocol adapters | 45 min | Task 3 |
| 5. Wallet layer | 20 min | Task 2 |
| 6. AI summarizer | 15 min | Task 2 |
| 7. Evaluator + executor | 30 min | Task 3, 4, 6 |
| 8. Scheduler | 20 min | Task 7 |
| 9. Database | 20 min | Task 2 |
| 10. API routes | 30 min | Task 5, 8, 9 |
| 11. Frontend setup | 20 min | Task 1 |
| 12. Dashboard | 45 min | Task 11 |
| 13. Settings page | 20 min | Task 12 |
| 14. Integration test | 30 min | All above |
| 15. Deploy | 20 min | Task 14 |
| 16. Submission | 30 min | Task 15 |
