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

export function getProtocolAdapter(protocol: string): ProtocolAdapter | undefined {
  return adapters[protocol];
}

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

  let withdrawHash = '';
  try {
    // Step 1: Withdraw from current protocol
    console.log(`Withdrawing ${action.asset} from ${action.fromProtocol}...`);
    withdrawHash = await fromAdapter.withdraw(
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
      withdrawTxHash: withdrawHash, // preserve if withdraw succeeded but supply failed
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
