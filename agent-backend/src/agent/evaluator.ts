import { PROTOCOL_TRUST, DEFAULT_SETTINGS } from '../config.js';
import type { YieldOpportunity, PortfolioPosition } from '../data/types.js';

// Trend data passed to scoring (from getApyTrends)
export interface ApyTrendData {
  trend: 'rising' | 'falling' | 'stable';
  volatility: number; // coefficient of variation %
}

export interface RebalanceAction {
  asset: string;
  fromProtocol: string;
  toProtocol: string;
  amount: bigint;
  reason: string;
  oldApy: number;
  newApy: number;
}

// Score a yield opportunity (6-factor model with optional trend data)
export function scoreOpportunity(
  opp: YieldOpportunity,
  settings: typeof DEFAULT_SETTINGS,
  trendData?: ApyTrendData,
): number {
  const apy = opp.apy7dAvg ?? opp.supplyApy;

  // APY component (30%) - normalize to 0-100 assuming max 20% APY
  const apyScore = Math.min(apy / 20, 1) * 100;

  // TVL safety (20%) - log scale, $1B+ = 100
  const tvlScore = Math.min(Math.log10(Math.max(opp.tvlUsd, 1)) / 9, 1) * 100;

  // Protocol trust (20%)
  const trustScore = PROTOCOL_TRUST[opp.protocol] || 50;

  // Utilization health (10%) - <80% is good
  const utilScore = opp.utilization !== null
    ? (opp.utilization < 80 ? 100 : Math.max(0, 100 - (opp.utilization - 80) * 5))
    : 70; // default if unknown

  // APY stability (10%) - penalizes volatile/promotional APYs
  const stabilityScore = trendData
    ? Math.max(0, 100 - trendData.volatility * 2)
    : 70; // default if no trend data

  // Trend (10%) - rising is good, falling is bad
  const trendScoreMap = { rising: 85, stable: 60, falling: 20 };
  const trendScore = trendData ? trendScoreMap[trendData.trend] : 60;

  return (
    apyScore * 0.30 +
    tvlScore * 0.20 +
    trustScore * 0.20 +
    utilScore * 0.10 +
    stabilityScore * 0.10 +
    trendScore * 0.10
  );
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
        reason: `APY improvement of ${apyImprovement.toFixed(2)}% (${pos.currentApy.toFixed(2)}% -> ${best.supplyApy.toFixed(2)}%)`,
        oldApy: pos.currentApy,
        newApy: best.supplyApy,
      });
    }
  }

  return actions;
}
