export interface YieldOpportunity {
  protocol: 'venus' | 'aave' | 'lista';
  asset: string;
  assetAddress: string;
  supplyApy: number;
  apy7dAvg: number | null;
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
