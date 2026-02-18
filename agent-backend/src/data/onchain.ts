import { createPublicClient, http, fallback, formatUnits, type PublicClient } from 'viem';
import { CHAIN, BSC_RPC, VENUS, AAVE, LISTA, ASSETS } from '../config.js';
import { vTokenAbi } from '../abis/vToken.js';
import { aavePoolAbi } from '../abis/aavePool.js';
import { moolahVaultAbi } from '../abis/listaMoolah.js';
import { erc20Abi } from '../abis/erc20.js';
import type { YieldOpportunity, TokenBalance } from './types.js';

// Fallback transport: tries each RPC in order for reliability
export const publicClient: PublicClient = createPublicClient({
  chain: CHAIN,
  transport: fallback([
    http(BSC_RPC),                                // env override if set
    http('https://rpc.ankr.com/bsc'),             // Ankr free tier
    http('https://bsc.publicnode.com'),            // PublicNode
    http('https://bsc-dataseed2.binance.org'),     // Binance backup
    http('https://bsc-dataseed3.binance.org'),     // Binance backup 2
  ]),
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
    functionName: 'exchangeRateStored',
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
  const apy = (Number(reserveData.currentLiquidityRate) / RAY) * 100;
  // Sanity cap — if onchain read returns >50%, the value is likely unreliable
  if (apy > 50) return 0;
  return apy;
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
      valueUsd: 0,
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

// Detect active on-chain positions (aTokens, vTokens, Lista vaults) for a wallet
export interface OnchainPosition {
  protocol: string;
  asset: string;
  balance: string;     // raw bigint as string
  formatted: number;   // human readable
  decimals: number;
  apy: number;
  valueUsd: number;
}

import { getCachedPrices } from './defillama.js';

export async function getOnchainPositions(walletAddress: `0x${string}`): Promise<OnchainPosition[]> {
  const positions: OnchainPosition[] = [];

  const DUST_THRESHOLD = 0.01; // Ignore dust/residual balances below $0.01

  // Check Aave aToken balances
  for (const [symbol, aTokenAddr] of Object.entries(AAVE.aTokens)) {
    try {
      const bal = await getAaveBalance(aTokenAddr, walletAddress);
      if (bal > 0n) {
        const asset = ASSETS[symbol as keyof typeof ASSETS];
        const formatted = parseFloat(formatUnits(bal, asset.decimals));
        if (formatted < DUST_THRESHOLD) continue;
        let apy = 0;
        try { apy = await getAaveSupplyApy(asset.address); } catch {}
        positions.push({
          protocol: 'aave',
          asset: symbol,
          balance: bal.toString(),
          formatted,
          decimals: asset.decimals,
          apy,
          valueUsd: formatted * (getCachedPrices()[symbol] || 0),
        });
      }
    } catch {}
  }

  // Check Venus vToken balances
  for (const [symbol, vTokenAddr] of Object.entries(VENUS.vTokens)) {
    try {
      const bal = await getVenusBalance(vTokenAddr, walletAddress);
      if (bal > 0n) {
        const asset = ASSETS[symbol as keyof typeof ASSETS];
        const formatted = parseFloat(formatUnits(bal, asset.decimals));
        if (formatted < DUST_THRESHOLD) continue;
        let apy = 0;
        try { apy = await getVenusSupplyApy(vTokenAddr); } catch {}
        positions.push({
          protocol: 'venus',
          asset: symbol,
          balance: bal.toString(),
          formatted,
          decimals: asset.decimals,
          apy,
          valueUsd: formatted * (getCachedPrices()[symbol] || 0),
        });
      }
    } catch {}
  }

  // Check Lista vault balances
  for (const [symbol, vaultAddr] of Object.entries(LISTA.vaults)) {
    try {
      const bal = await getListaBalance(vaultAddr, walletAddress);
      if (bal > 0n) {
        const decimals = 18;
        const formatted = parseFloat(formatUnits(bal, decimals));
        if (formatted < DUST_THRESHOLD) continue;
        positions.push({
          protocol: 'lista',
          asset: symbol,
          balance: bal.toString(),
          formatted,
          decimals,
          apy: 0,
          valueUsd: formatted * (getCachedPrices()[symbol] || 0),
        });
      }
    } catch {}
  }

  return positions;
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

  // Lista Moolah vault yields (APY enriched from DeFiLlama)
  for (const [symbol] of Object.entries(LISTA.vaults)) {
    const asset = ASSETS[symbol as keyof typeof ASSETS];
    if (!asset) continue;
    opportunities.push({
      protocol: 'lista',
      asset: symbol,
      assetAddress: asset.address,
      supplyApy: 0, // enriched from DeFiLlama
      apy7dAvg: null,
      tvlUsd: 0,
      utilization: null,
      score: 0,
    });
  }

  return opportunities;
}
