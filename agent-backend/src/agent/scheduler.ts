import cron from 'node-cron';
import { formatUnits, parseUnits, encodeFunctionData } from 'viem';
import { fetchBscYields } from '../data/defillama.js';
import { fetchAllYields, getWalletBalances, getOnchainPositions } from '../data/onchain.js';
import { scoreOpportunity, evaluateRebalance } from './evaluator.js';
import { executeRebalance, deployFunds, getProtocolAdapter } from './executor.js';
import { makeInvestmentDecision, generateDailySummary } from '../ai/openai.js';
import { createSendTxFn } from '../wallet/privy.js';
import { getUserPositions, upsertPosition, logTransaction, saveActivity, getRecentActivity, getUserSettings, saveYieldSnapshot, savePortfolioSnapshot, supabase, getApyTrends, getRecentDecisions, getPositionAges, getUserWallet } from '../db/supabase.js';
import type { ApyTrendData } from './evaluator.js';
import { getCachedPrices, refreshPrices } from '../data/defillama.js';
import { swapTokens } from '../protocols/pancakeswap.js';
import { DEFAULT_SETTINGS, ASSETS } from '../config.js';
import type { YieldOpportunity } from '../data/types.js';

// In-memory state (backed by Supabase for persistence)
let latestYields: YieldOpportunity[] = [];
let lastRebalanceTime: Date | null = null;

// Agent running state — controls whether crons execute and enables immediate action on start
let agentRunning = false;

export function isAgentRunning(): boolean {
  return agentRunning;
}

export function setAgentRunning(running: boolean): void {
  agentRunning = running;
}

// Start agent: flip flag + immediately run a rebalance cycle
export async function startAgentAndRun(userId?: string): Promise<void> {
  agentRunning = true;
  broadcast('agent_started', {
    title: 'AI Agent activated',
    description: 'Agent is now monitoring yields and will deploy your funds optimally',
  });

  // Refresh yields + prices, then immediately run AI rebalance
  try {
    await refreshPrices();
    await fetchRates();
    console.log('[AGENT] Running initial AI rebalance...');
    const result = await runAiRebalance(userId);
    console.log('[AGENT] Initial rebalance complete:', result.reasoning);
  } catch (error) {
    console.error('[AGENT] Initial rebalance error:', error);
    broadcast('agent_error', {
      title: 'Agent error',
      description: `Initial analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}. Will retry on next cycle.`,
    });
  }
}

export function stopAgent(): void {
  agentRunning = false;
  broadcast('agent_stopped', {
    title: 'AI Agent deactivated',
    description: 'Agent has been stopped. Positions remain active and earning yield.',
  });
}

// Activity log — persists across frontend refreshes (lives as long as backend runs)
const MAX_ACTIVITY = 200;
const activityLog: Array<{ event: string; data: any; timestamp: string }> = [];

export function getActivityLog() {
  return activityLog;
}

// Broadcast function - will be set from index.ts
let broadcastFn: ((event: string, data: any) => void) | null = null;

export function setBroadcast(fn: (event: string, data: any) => void) {
  broadcastFn = fn;
}

export function broadcast(event: string, data: any) {
  const entry = { event, data, timestamp: new Date().toISOString() };
  activityLog.unshift(entry);
  if (activityLog.length > MAX_ACTIVITY) activityLog.length = MAX_ACTIVITY;
  if (broadcastFn) broadcastFn(event, data);
  // Persist to Supabase (fire-and-forget)
  saveActivity(event, data).catch(() => {});
}

// Load persisted activity from Supabase into memory on startup
export async function loadActivityFromDb() {
  try {
    const rows = await getRecentActivity(MAX_ACTIVITY);
    if (rows.length > 0 && activityLog.length <= 1) {
      // Only backfill if we haven't accumulated much yet
      activityLog.push(...rows);
      // Deduplicate by timestamp
      const seen = new Set<string>();
      const deduped = activityLog.filter((e) => {
        const key = `${e.event}:${e.timestamp}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      activityLog.length = 0;
      activityLog.push(...deduped.slice(0, MAX_ACTIVITY));
      console.log(`[ACTIVITY] Loaded ${rows.length} events from database`);
    }
  } catch (err) {
    console.error('[ACTIVITY] Failed to load from DB:', err);
  }
}

// Core rate fetch logic (reusable)
async function fetchRates() {
  console.log('[FETCH] Fetching rates...');

  // Fetch from both DeFiLlama and onchain
  const [llamaYields, onchainYields] = await Promise.all([
    fetchBscYields().catch(() => []),
    fetchAllYields().catch(() => []),
  ]);

  // Enrich onchain yields with DeFiLlama data
  for (const opp of onchainYields) {
    const protocolMap: Record<string, string[]> = {
      venus: ['venus-core-pool'],
      aave: ['aave-v3'],
      lista: ['lista-lending', 'lista-cdp'],
    };
    const llamaProjects = protocolMap[opp.protocol] || [opp.protocol];
    // Map our asset names to DeFiLlama symbol patterns
    const assetAliases: Record<string, string[]> = {
      WETH: ['ETH', 'WETH'],
      WBNB: ['WBNB', 'BNB'],
      BTCB: ['BTCB', 'BTC'],
      USD1: ['USD1'],
    };
    const assetNames = assetAliases[opp.asset] || [opp.asset];
    const llamaMatch = llamaYields.find(
      (l) => llamaProjects.includes(l.project.toLowerCase()) &&
             assetNames.some(name => l.symbol.toUpperCase() === name.toUpperCase())
    );
    if (llamaMatch) {
      opp.apy7dAvg = llamaMatch.apyMean30d;
      opp.tvlUsd = llamaMatch.tvlUsd;
      // If onchain APY was capped to 0 (unreliable), use DeFiLlama's
      if (opp.supplyApy === 0 && llamaMatch.apy > 0) {
        opp.supplyApy = llamaMatch.apyBase ?? llamaMatch.apy;
      }
    }
    opp.score = scoreOpportunity(opp, DEFAULT_SETTINGS); // initial score, may be re-scored below
  }

  // Enrich scores with APY trend data
  try {
    const trends = await getApyTrends(24);
    const trendMap = new Map(trends.map(t => [`${t.protocol}:${t.asset}`, t]));
    for (const opp of onchainYields) {
      const trend = trendMap.get(`${opp.protocol}:${opp.asset}`);
      if (trend) {
        const trendData: ApyTrendData = { trend: trend.trend, volatility: trend.volatility };
        opp.score = scoreOpportunity(opp, DEFAULT_SETTINGS, trendData);
      }
    }
    console.log(`[FETCH] Enriched scores with ${trends.length} trend data points`);
  } catch (err) {
    console.error('[FETCH] Failed to load APY trends (scoring without trends):', err);
  }

  latestYields = onchainYields;
  broadcast('yields_updated', {
    count: onchainYields.length,
    title: 'Yield rates refreshed',
    description: `Scanned ${onchainYields.length} opportunities across Venus, Aave, and Lista`,
  });
  console.log(`[FETCH] Fetched ${onchainYields.length} yield opportunities`);

  // Persist yield snapshots (fire-and-forget)
  saveYieldSnapshot(
    onchainYields.map(y => ({ protocol: y.protocol, asset: y.asset, apy: y.supplyApy, tvl: y.tvlUsd }))
  ).catch(err => console.error('[FETCH] Failed to save yield snapshot:', err));
}

// Analyze wallet and deploy idle funds using AI
export async function runAiRebalance(userId?: string, dryRun = false): Promise<{
  actions: Array<{ type: string; asset: string; protocol: string; txHash?: string; summary?: string; error?: string; amountPercent?: number; reason?: string }>;
  reasoning: string;
}> {
  if (!userId) throw new Error('userId is required for rebalance');

  // Look up user's Privy agent wallet from DB
  const userWallet = await getUserWallet(userId);
  if (!userWallet) throw new Error('No agent wallet found for user');

  const agentAddr = userWallet.walletAddress as `0x${string}`;
  const sendTx = createSendTxFn(userWallet.walletId, userWallet.ownerAuthKey);
  console.log(`[REBALANCE] Starting AI-driven rebalance for ${agentAddr}`);

  // Load user settings from DB (fall back to defaults)
  let userSettings = DEFAULT_SETTINGS;
  if (userId) {
    try {
      const saved = await getUserSettings(userId);
      if (saved) {
        userSettings = {
          riskLevel: (saved.risk_level || DEFAULT_SETTINGS.riskLevel) as typeof DEFAULT_SETTINGS.riskLevel,
          minTvl: Number(saved.min_tvl) || DEFAULT_SETTINGS.minTvl,
          apyThreshold: Number(saved.apy_threshold) || DEFAULT_SETTINGS.apyThreshold,
          maxPerProtocol: Number(saved.max_per_protocol) || DEFAULT_SETTINGS.maxPerProtocol,
          rebalanceCooldownHours: Number(saved.rebalance_cooldown_hours) || DEFAULT_SETTINGS.rebalanceCooldownHours,
          whitelistedProtocols: saved.whitelisted_protocols || DEFAULT_SETTINGS.whitelistedProtocols,
          whitelistedAssets: saved.whitelisted_assets || DEFAULT_SETTINGS.whitelistedAssets,
        };
        console.log('[REBALANCE] Using user settings:', userSettings);
      }
    } catch {
      console.log('[REBALANCE] Failed to load user settings, using defaults');
    }
  }

  broadcast('rebalance_started', {
    address: agentAddr,
    title: 'Rebalance analysis started',
    description: `AI analyzing portfolio (risk: ${userSettings.riskLevel}, protocols: ${userSettings.whitelistedProtocols.join(', ')})`,
  });

  // 1. Get wallet balances
  const rawBalances = await getWalletBalances(agentAddr);
  const walletBalances = rawBalances
    .filter(b => b.balance > 0n)
    .map(b => ({
      symbol: b.symbol,
      amount: formatUnits(b.balance, b.decimals),
      valueUsd: 0, // We'll estimate below
    }));

  // Live prices from DeFiLlama (refreshed every 5 min)
  const PRICES = getCachedPrices();
  for (const b of walletBalances) {
    b.valueUsd = parseFloat(b.amount) * (PRICES[b.symbol] || 0);
  }

  // Filter out dust balances (< $1 USD) — not worth deploying, wastes gas
  // Keep BNB regardless (needed for gas reserve calculations)
  const significantBalances = walletBalances.filter(b => b.symbol === 'BNB' || b.valueUsd >= 1.0);
  console.log('[REBALANCE] Wallet balances (filtered dust < $1):', significantBalances);

  // 2. Get current positions from on-chain (ground truth, not stale DB)
  const onchainPos = await getOnchainPositions(agentAddr);
  const currentPositions = onchainPos.map(p => ({
    asset: p.asset,
    protocol: p.protocol,
    apy: p.apy,
    value: String(p.valueUsd),
  }));

  // Reconcile: clean stale DB positions not found on-chain
  if (userId) {
    const dbPositions = await getUserPositions(userId);
    for (const dbp of dbPositions as Array<{ protocol: string; asset: string }>) {
      const onchain = onchainPos.find(p => p.protocol === dbp.protocol && p.asset === dbp.asset);
      if (!onchain) {
        await supabase.from('positions').delete().eq('user_id', userId).eq('protocol', dbp.protocol).eq('asset', dbp.asset);
        console.log(`[RECONCILE] Removed stale DB position: ${dbp.asset} on ${dbp.protocol}`);
      }
    }
  }

  // 3. Get yield opportunities — filtered by user's whitelisted protocols/assets
  const opportunities = latestYields
    .filter(y => y.supplyApy > 0)
    .filter(y => userSettings.whitelistedProtocols.includes(y.protocol))
    .filter(y => userSettings.whitelistedAssets.includes(y.asset))
    .filter(y => y.tvlUsd >= userSettings.minTvl)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15)
    .map(y => ({
      asset: y.asset,
      protocol: y.protocol,
      apy: y.supplyApy,
      tvl: y.tvlUsd,
      score: y.score,
    }));

  console.log('[REBALANCE] Top opportunities:', opportunities.slice(0, 5));

  // 4. Fetch enriched context in parallel (trends, recent decisions, position ages)
  let apyTrends: Array<{ protocol: string; asset: string; currentApy: number; avgApy24h: number; trend: string; volatility: number }> = [];
  let recentActions: string[] = [];
  let estimatedGasCostUsd = 0.30; // default fallback
  let totalPortfolioValue = 0;

  try {
    const [trends, decisions, ages] = await Promise.all([
      getApyTrends(24),
      userId ? getRecentDecisions(userId, 8) : Promise.resolve([]),
      userId ? getPositionAges(userId) : Promise.resolve({} as Record<string, { enteredAt: string; hoursHeld: number }>),
    ]);

    // Build trend summary (filter to whitelisted)
    apyTrends = trends
      .filter(t => userSettings.whitelistedProtocols.includes(t.protocol) && userSettings.whitelistedAssets.includes(t.asset))
      .map(t => ({ protocol: t.protocol, asset: t.asset, currentApy: t.currentApy, avgApy24h: t.avgApy24h, trend: t.trend, volatility: t.volatility }));

    // Attach hoursHeld to current positions
    for (const pos of currentPositions) {
      const ageKey = `${pos.protocol}:${pos.asset}`;
      if (ages[ageKey]) {
        (pos as any).hoursHeld = ages[ageKey].hoursHeld;
      }
    }

    // Format recent actions as readable strings
    recentActions = decisions.map(d => {
      const ago = Math.round((Date.now() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60));
      return `${ago}h ago: ${d.type} ${d.amount.toFixed(2)} ${d.asset} on ${d.protocol}${d.summary ? ` — ${d.summary}` : ''}`;
    });

    // Estimate gas cost from BNB price
    const bnbPrice = PRICES['WBNB'] || PRICES['BNB'] || 600;
    estimatedGasCostUsd = Math.round(0.0005 * bnbPrice * 100) / 100;

    // Calculate total portfolio value (positions + idle balances)
    const positionValue = currentPositions.reduce((s, p) => s + parseFloat(p.value), 0);
    const idleValue = walletBalances.reduce((s, b) => s + b.valueUsd, 0);
    totalPortfolioValue = positionValue + idleValue;

    console.log(`[REBALANCE] Enriched context: ${apyTrends.length} trends, ${recentActions.length} recent actions, gas ~$${estimatedGasCostUsd}, portfolio $${totalPortfolioValue.toFixed(2)}`);
  } catch (err) {
    console.error('[REBALANCE] Failed to load enriched context (proceeding with basic):', err);
  }

  // 5. Ask AI for decision (with enriched context)
  const decision = await makeInvestmentDecision({
    walletBalances: significantBalances,
    currentPositions,
    opportunities,
    riskLevel: userSettings.riskLevel,
    apyTrends,
    recentActions,
    estimatedGasCostUsd,
    totalPortfolioValue,
  });

  console.log('[REBALANCE] AI decision:', decision.reasoning);
  broadcast('ai_decision', {
    reasoning: decision.reasoning,
    actions: decision.actions,
    title: 'AI investment decision',
    description: decision.reasoning,
  });

  // 5. Dry run: return AI decision without executing
  if (dryRun) {
    return {
      actions: decision.actions.map((a: { type: string; asset: string; protocol: string; reason: string; amountPercent?: number }) => ({
        type: a.type, asset: a.asset, protocol: a.protocol,
        summary: a.reason, amountPercent: a.amountPercent,
      })),
      reasoning: decision.reasoning,
    };
  }

  // 6. Execute each action
  const results: Array<{ type: string; asset: string; protocol: string; txHash?: string; summary?: string; error?: string }> = [];

  for (const action of decision.actions) {
    if (action.type === 'hold') {
      results.push({ type: 'hold', asset: '', protocol: '', summary: action.reason });
      continue;
    }

    if (action.type === 'supply') {
      try {
        // Re-read live balance (prior actions may have spent tokens)
        const freshBalances = await getWalletBalances(agentAddr);
        let balance = freshBalances.find(b => b.symbol === action.asset);

        // Auto-wrap: if supplying WBNB, wrap any available native BNB (minus gas reserve)
        if (action.asset === 'WBNB') {
          const nativeBnb = freshBalances.find(b => b.symbol === 'BNB');
          const gasReserve = BigInt(5e15); // 0.005 BNB for gas
          if (nativeBnb && nativeBnb.balance > gasReserve) {
            const wrapAmount = nativeBnb.balance - gasReserve;
            console.log(`[REBALANCE] Auto-wrapping ${formatUnits(wrapAmount, 18)} BNB → WBNB (keeping ${formatUnits(gasReserve, 18)} BNB for gas)`);
            const wbnbAbi = [{ name: 'deposit', type: 'function', inputs: [], outputs: [], stateMutability: 'payable' }] as const;
            const wrapData = encodeFunctionData({ abi: wbnbAbi, functionName: 'deposit' });
            await sendTx({ to: ASSETS.WBNB.address, data: wrapData, value: wrapAmount });
            broadcast('auto_wrap', {
              title: 'BNB wrapped to WBNB',
              description: `Auto-wrapped ${parseFloat(formatUnits(wrapAmount, 18)).toFixed(4)} BNB → WBNB for deployment`,
            });
            // Re-read balances after wrapping
            const postWrapBalances = await getWalletBalances(agentAddr);
            balance = postWrapBalances.find(b => b.symbol === 'WBNB');
          }
        }

        if (!balance || balance.balance === 0n) {
          results.push({ type: 'supply', asset: action.asset, protocol: action.protocol, error: `No ${action.asset} balance` });
          continue;
        }

        // Calculate amount based on percentage of CURRENT balance
        const amount = (balance.balance * BigInt(Math.round(Number(action.amountPercent) || 0))) / 100n;
        if (amount === 0n) {
          results.push({ type: 'supply', asset: action.asset, protocol: action.protocol, error: 'Amount too small' });
          continue;
        }

        const formattedAmt = formatUnits(amount, balance.decimals);

        // Skip dust deployments — not worth the gas
        const supplyValueUsd = parseFloat(formattedAmt) * (PRICES[action.asset] || 0);
        if (supplyValueUsd < 1.0) {
          console.log(`[REBALANCE] Skipping dust supply: ${formattedAmt} ${action.asset} ($${supplyValueUsd.toFixed(4)}) — below $1 minimum`);
          results.push({ type: 'supply', asset: action.asset, protocol: action.protocol, summary: `Skipped dust amount ($${supplyValueUsd.toFixed(2)})` });
          continue;
        }

        const matchingOppPre = latestYields.find(y => y.asset === action.asset && y.protocol === action.protocol);
        const apyStr = matchingOppPre ? `${matchingOppPre.supplyApy.toFixed(2)}%` : '';
        console.log(`[REBALANCE] Supplying ${formattedAmt} ${action.asset} to ${action.protocol}`);
        broadcast('executing_action', {
          type: 'supply', asset: action.asset, protocol: action.protocol, amount: formattedAmt,
          title: `Deploying ${action.asset} to ${action.protocol}`,
          description: `Supplying ${parseFloat(formattedAmt).toFixed(2)} ${action.asset} to ${action.protocol} lending pool${apyStr ? ` at ${apyStr} APY` : ''}`,
        });

        const result = await deployFunds(action.asset, amount, action.protocol, agentAddr, sendTx);

        results.push({
          type: 'supply',
          asset: action.asset,
          protocol: action.protocol,
          txHash: result.txHash,
          summary: result.summary,
        });

        // Update DB
        if (userId) {
          const usdValue = parseFloat(formatUnits(amount, balance.decimals)) * (PRICES[action.asset] || 0);
          const matchingOpp = latestYields.find(y => y.asset === action.asset && y.protocol === action.protocol);
          await upsertPosition(userId, {
            protocol: action.protocol,
            asset: action.asset,
            deposited_amount: usdValue,
            current_apy: matchingOpp?.supplyApy || 0,
          });
          await logTransaction(userId, {
            type: 'supply',
            to_protocol: action.protocol,
            asset: action.asset,
            amount: usdValue,
            tx_hash: result.txHash,
            ai_summary: result.summary,
          });
        }

        broadcast('action_completed', {
          type: 'supply',
          asset: action.asset,
          protocol: action.protocol,
          txHash: result.txHash,
          summary: result.summary,
          title: 'Position activated',
          description: `${parseFloat(formatUnits(amount, balance.decimals)).toFixed(2)} ${action.asset} deployed to ${action.protocol} lending${apyStr ? ` at ${apyStr} yield` : ''}`,
        });

        console.log(`[REBALANCE] Supply success: ${result.txHash}`);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[REBALANCE] Supply failed:`, errMsg);
        results.push({ type: 'supply', asset: action.asset, protocol: action.protocol, error: errMsg });
        broadcast('action_failed', {
          type: 'supply', asset: action.asset, protocol: action.protocol, error: errMsg,
          title: 'Supply failed',
          description: `Failed to supply ${action.asset} to ${action.protocol}: ${errMsg}`,
        });
      }
    }

    if (action.type === 'rebalance' && action.fromProtocol) {
      try {
        // Get position balance from source protocol (NOT idle wallet balance)
        const positions = await getOnchainPositions(agentAddr);
        const position = positions.find(p => p.protocol === action.fromProtocol && p.asset === action.asset);
        if (!position || position.formatted < 0.01) {
          results.push({ type: 'rebalance', asset: action.asset, protocol: action.protocol, error: `No ${action.asset} position in ${action.fromProtocol}` });
          continue;
        }
        const decimals = position.decimals;
        const positionBalance = BigInt(position.balance);
        const amount = (positionBalance * BigInt(Math.round(Number(action.amountPercent) || 0))) / 100n;

        console.log(`[REBALANCE] Moving ${formatUnits(amount, decimals)} ${action.asset} from ${action.fromProtocol} to ${action.protocol} (position: ${position.formatted.toFixed(4)})`);

        const fromOpp = latestYields.find(y => y.asset === action.asset && y.protocol === action.fromProtocol);
        const toOpp = latestYields.find(y => y.asset === action.asset && y.protocol === action.protocol);

        const execResult = await executeRebalance(
          {
            asset: action.asset,
            fromProtocol: action.fromProtocol,
            toProtocol: action.protocol,
            amount,
            reason: action.reason,
            oldApy: fromOpp?.supplyApy || 0,
            newApy: toOpp?.supplyApy || 0,
          },
          agentAddr,
          sendTx,
        );

        if (execResult.success) {
          results.push({
            type: 'rebalance',
            asset: action.asset,
            protocol: action.protocol,
            txHash: execResult.supplyTxHash,
            summary: execResult.aiSummary,
          });
          broadcast('action_completed', {
            type: 'rebalance', ...execResult,
            title: 'Position reallocated to higher-yield market',
            description: `${action.asset} reallocated from ${action.fromProtocol} to ${action.protocol}${toOpp ? ` at ${toOpp.supplyApy.toFixed(2)}% yield` : ''}`,
          });

          // Log rebalance transactions to DB
          if (userId) {
            const usdValue = parseFloat(formatUnits(amount, decimals)) * (PRICES[action.asset] || 0);
            logTransaction(userId, {
              type: 'rebalance_withdraw', from_protocol: action.fromProtocol, asset: action.asset,
              amount: usdValue, tx_hash: execResult.withdrawTxHash, ai_summary: execResult.aiSummary,
            }).catch(() => {});
            logTransaction(userId, {
              type: 'rebalance_supply', to_protocol: action.protocol, asset: action.asset,
              amount: usdValue, tx_hash: execResult.supplyTxHash, ai_summary: execResult.aiSummary,
            }).catch(() => {});
            upsertPosition(userId, {
              protocol: action.protocol, asset: action.asset,
              deposited_amount: usdValue, current_apy: toOpp?.supplyApy || 0,
            }).catch(() => {});
          }
        } else {
          results.push({ type: 'rebalance', asset: action.asset, protocol: action.protocol, error: execResult.error });
          broadcast('action_failed', {
            type: 'rebalance', error: execResult.error,
            title: 'Rebalance failed',
            description: `Failed to move ${action.asset}: ${execResult.error}`,
          });
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        results.push({ type: 'rebalance', asset: action.asset, protocol: action.protocol, error: errMsg });
      }
    }

    if (action.type === 'swap_and_supply' && action.fromAsset) {
      try {
        const fromAssetConfig = ASSETS[action.fromAsset as keyof typeof ASSETS];
        const toAssetConfig = ASSETS[action.asset as keyof typeof ASSETS];
        if (!fromAssetConfig || !toAssetConfig) {
          results.push({ type: 'swap_and_supply', asset: action.asset, protocol: action.protocol, error: `Unknown asset: ${action.fromAsset} or ${action.asset}` });
          continue;
        }

        // Re-read live balance of source token (prior actions may have spent it)
        const freshBal = await getWalletBalances(agentAddr);
        const balance = freshBal.find(b => b.symbol === action.fromAsset);
        if (!balance || balance.balance === 0n) {
          results.push({ type: 'swap_and_supply', asset: action.asset, protocol: action.protocol, error: `No ${action.fromAsset} balance` });
          continue;
        }

        const swapAmount = (balance.balance * BigInt(Math.round(Number(action.amountPercent) || 0))) / 100n;
        if (swapAmount === 0n) {
          results.push({ type: 'swap_and_supply', asset: action.asset, protocol: action.protocol, error: 'Amount too small' });
          continue;
        }

        const swapFormatted = formatUnits(swapAmount, balance.decimals);
        console.log(`[REBALANCE] Swapping ${swapFormatted} ${action.fromAsset} to ${action.asset} then supplying to ${action.protocol}`);
        broadcast('executing_action', {
          type: 'swap_and_supply', fromAsset: action.fromAsset, asset: action.asset, protocol: action.protocol, amount: swapFormatted,
          title: `Swapping ${action.fromAsset} to ${action.asset}`,
          description: `Swapping ${parseFloat(swapFormatted).toFixed(2)} ${action.fromAsset} to ${action.asset} via PancakeSwap, then depositing to ${action.protocol}`,
        });

        // Track pre-swap balance of target token so we only supply the swap output
        const preSwapTarget = freshBal.find(b => b.symbol === action.asset);
        const preSwapAmount = preSwapTarget?.balance || 0n;

        // Step 1: Swap via PancakeSwap
        const swapTxHash = await swapTokens(
          fromAssetConfig.address,
          toAssetConfig.address,
          swapAmount,
          agentAddr,
          sendTx,
          100, // 1% slippage
        );
        console.log(`[REBALANCE] Swap success: ${swapTxHash}`);

        // Step 2: Read new balance of target token and supply ONLY the swap output
        const newBalances = await getWalletBalances(agentAddr);
        const targetBalance = newBalances.find(b => b.symbol === action.asset);
        if (!targetBalance || targetBalance.balance === 0n) {
          results.push({ type: 'swap_and_supply', asset: action.asset, protocol: action.protocol, error: 'Swap succeeded but no target balance found', summary: `Swap tx: ${swapTxHash}` });
          continue;
        }

        // Only supply the amount received from the swap, not any pre-existing balance
        const swapOutput = targetBalance.balance - preSwapAmount;
        const supplyAmount = swapOutput > 0n ? swapOutput : targetBalance.balance;
        const supplyFormatted = formatUnits(supplyAmount, targetBalance.decimals);
        console.log(`[REBALANCE] Supplying ${supplyFormatted} ${action.asset} to ${action.protocol}`);

        const supplyResult = await deployFunds(action.asset, supplyAmount, action.protocol, agentAddr, sendTx);

        results.push({
          type: 'swap_and_supply',
          asset: action.asset,
          protocol: action.protocol,
          txHash: supplyResult.txHash,
          summary: `Swapped ${parseFloat(swapFormatted).toFixed(2)} ${action.fromAsset} → ${parseFloat(supplyFormatted).toFixed(2)} ${action.asset}, then supplied to ${action.protocol}`,
        });

        const matchingOpp = latestYields.find(y => y.asset === action.asset && y.protocol === action.protocol);
        broadcast('action_completed', {
          type: 'swap_and_supply', fromAsset: action.fromAsset, asset: action.asset, protocol: action.protocol,
          swapTxHash, supplyTxHash: supplyResult.txHash,
          title: `Swapped & deployed ${action.asset}`,
          description: `Swapped ${parseFloat(swapFormatted).toFixed(2)} ${action.fromAsset} → ${action.asset}, supplied to ${action.protocol}${matchingOpp ? ` at ${matchingOpp.supplyApy.toFixed(2)}% APY` : ''}`,
        });

        if (userId) {
          const usdValue = parseFloat(supplyFormatted) * (PRICES[action.asset] || 0);
          logTransaction(userId, {
            type: 'swap', asset: `${action.fromAsset}→${action.asset}`,
            amount: usdValue, tx_hash: swapTxHash, ai_summary: `Swapped for higher yield on ${action.protocol}`,
          }).catch(() => {});
          logTransaction(userId, {
            type: 'supply', to_protocol: action.protocol, asset: action.asset,
            amount: usdValue, tx_hash: supplyResult.txHash, ai_summary: supplyResult.summary,
          }).catch(() => {});
          upsertPosition(userId, {
            protocol: action.protocol, asset: action.asset,
            deposited_amount: usdValue, current_apy: matchingOpp?.supplyApy || 0,
          }).catch(() => {});
        }

        console.log(`[REBALANCE] Swap+Supply success: swap=${swapTxHash}, supply=${supplyResult.txHash}`);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[REBALANCE] Swap+Supply failed:`, errMsg);
        results.push({ type: 'swap_and_supply', asset: action.asset, protocol: action.protocol, error: errMsg });
        broadcast('action_failed', {
          type: 'swap_and_supply', fromAsset: action.fromAsset, asset: action.asset, protocol: action.protocol, error: errMsg,
          title: 'Swap & supply failed',
          description: `Failed to swap ${action.fromAsset} → ${action.asset} for ${action.protocol}: ${errMsg}`,
        });
      }
    }
  }

  lastRebalanceTime = new Date();
  const successCount = results.filter(r => r.txHash).length;
  broadcast('rebalance_completed', {
    results, reasoning: decision.reasoning,
    title: 'Rebalance complete',
    description: successCount > 0
      ? `Executed ${successCount} action${successCount > 1 ? 's' : ''} to optimize yield`
      : decision.reasoning,
  });
  console.log('[REBALANCE] Complete:', results);

  // Save portfolio snapshot after rebalance so charts update immediately
  if (userId && successCount > 0) {
    try {
      await takePortfolioSnapshot(userId, agentAddr);
    } catch (err) {
      console.error('[REBALANCE] Snapshot after rebalance failed:', err);
    }
  }

  return { actions: results, reasoning: decision.reasoning };
}

// Every 15 min: fetch rates
export function startRateFetcher() {
  cron.schedule('*/15 * * * *', async () => {
    try {
      await fetchRates();
    } catch (error) {
      console.error('[CRON] Rate fetch error:', error);
    }
  });
}

// Every hour: save portfolio snapshots for all users (populates portfolio chart)
export function startPortfolioSnapshotter() {
  cron.schedule('0 * * * *', async () => {
    try {
      const { data: users } = await supabase
        .from('users')
        .select('id, agent_wallet_address')
        .not('agent_wallet_address', 'is', null);
      if (!users?.length) return;
      for (const u of users) {
        try {
          await takePortfolioSnapshot(u.id, u.agent_wallet_address);
        } catch (err) {
          console.error(`[CRON] Hourly snapshot failed for ${u.id}:`, err);
        }
      }
    } catch (error) {
      console.error('[CRON] Portfolio snapshotter error:', error);
    }
  });
}

// Every 30 min (when agent is running): evaluate rebalance for all users with agent wallets
export function startRebalanceEvaluator() {
  cron.schedule('*/30 * * * *', async () => {
    if (!agentRunning) return;
    try {
      console.log('[CRON] Agent is running — evaluating AI rebalance for all users...');
      const { data: users } = await supabase
        .from('users')
        .select('id')
        .not('agent_wallet_id', 'is', null);
      if (!users?.length) return;
      for (const u of users) {
        try {
          const result = await runAiRebalance(u.id);
          console.log(`[CRON] Rebalance for ${u.id}:`, result.reasoning);
        } catch (err) {
          console.error(`[CRON] Rebalance failed for ${u.id}:`, err);
        }
      }
    } catch (error) {
      console.error('[CRON] Rebalance evaluation error:', error);
    }
  });
}

// Take a portfolio snapshot from on-chain data (used after rebalance + in crons)
async function takePortfolioSnapshot(userId: string, walletAddress: string) {
  const positions = await getOnchainPositions(walletAddress as `0x${string}`);
  const balances = await getWalletBalances(walletAddress as `0x${string}`);
  const prices = getCachedPrices();

  // Position value
  const positionValue = positions.reduce((s, p) => s + p.valueUsd, 0);
  // Idle balance value (use formatUnits for precision with large BigInt)
  const idleValue = balances.reduce((s, b) => {
    const price = prices[b.symbol] || 0;
    const formatted = parseFloat(formatUnits(b.balance, b.decimals));
    return s + formatted * price;
  }, 0);
  const totalValue = positionValue + idleValue;

  // Estimate daily yield from position APYs
  // Use on-chain position APY, fall back to latestYields if APY is 0
  const dailyYield = positions.reduce((s, p) => {
    let apy = p.apy;
    if (apy === 0) {
      const matchYield = latestYields.find(y => y.protocol === p.protocol && y.asset === p.asset);
      if (matchYield) apy = matchYield.supplyApy;
    }
    return s + (p.valueUsd * apy / 100 / 365);
  }, 0);

  await savePortfolioSnapshot(userId, totalValue, dailyYield);
  console.log(`[SNAPSHOT] User ${userId}: $${totalValue.toFixed(2)} total, $${dailyYield.toFixed(4)}/day yield`);
}

// Daily: generate summary + portfolio snapshots
export function startDailySummary() {
  cron.schedule('0 0 * * *', async () => {
    try {
      console.log('[CRON] Generating daily summary & portfolio snapshots...');

      // Query all users who have an agent wallet
      const { data: users } = await supabase
        .from('users')
        .select('id, agent_wallet_address')
        .not('agent_wallet_address', 'is', null);

      if (!users?.length) {
        console.log('[CRON] No users with agent wallets, skipping snapshots');
        return;
      }

      let totalUsers = 0;
      for (const u of users) {
        try {
          await takePortfolioSnapshot(u.id, u.agent_wallet_address);
          totalUsers++;
        } catch (err) {
          console.error(`[CRON] Snapshot failed for user ${u.id}:`, err);
        }
      }

      broadcast('daily_summary', {
        title: 'Daily performance summary',
        description: `Portfolio snapshots saved for ${totalUsers} active user${totalUsers !== 1 ? 's' : ''}`,
      });
      console.log(`[CRON] Saved portfolio snapshots for ${totalUsers} users`);
    } catch (error) {
      console.error('[CRON] Daily summary error:', error);
    }
  });
}

export async function startAllSchedulers() {
  // Load persisted activity before anything else
  await loadActivityFromDb();

  startRateFetcher();
  startRebalanceEvaluator();
  startPortfolioSnapshotter();
  startDailySummary();
  console.log('[SCHEDULER] All cron jobs started');

  // Every 5 min: refresh live prices
  cron.schedule('*/5 * * * *', async () => {
    try { await refreshPrices(); } catch (e) { console.error('[CRON] Price refresh error:', e); }
  });

  // Initial fetches on startup
  refreshPrices().catch(e => console.error('[SCHEDULER] Initial price fetch error:', e));
  fetchRates().catch((err) => console.error('[SCHEDULER] Initial fetch error:', err));

  // Take initial portfolio snapshot for all users (so chart has data immediately)
  setTimeout(async () => {
    try {
      const { data: users } = await supabase
        .from('users')
        .select('id, agent_wallet_address')
        .not('agent_wallet_address', 'is', null);
      if (users?.length) {
        for (const u of users) {
          try { await takePortfolioSnapshot(u.id, u.agent_wallet_address); } catch {}
        }
        console.log(`[SCHEDULER] Initial portfolio snapshots saved for ${users.length} users`);
      }
    } catch {}
  }, 15_000); // Wait 15s for prices to load
}

export function getLatestYields() {
  return latestYields;
}
