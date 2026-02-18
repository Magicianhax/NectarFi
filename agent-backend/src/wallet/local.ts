import { createWalletClient, http } from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { CHAIN, BSC_RPC } from '../config.js';
import { publicClient } from '../data/onchain.js';
import type { SendTxFn } from '../protocols/types.js';

let account: PrivateKeyAccount | null = null;

function getAccount(): PrivateKeyAccount {
  if (!account) {
    const pk = process.env.AGENT_WALLET_PRIVATE_KEY;
    if (!pk) throw new Error('AGENT_WALLET_PRIVATE_KEY not set');
    const cleanPk = pk.startsWith('0x') ? pk : `0x${pk}`;
    account = privateKeyToAccount(cleanPk as `0x${string}`);
  }
  return account;
}

export function getAgentAddress(): `0x${string}` {
  return getAccount().address;
}

// SendTxFn compatible with protocol adapters — signs and sends using local PK
export const sendTxLocal: SendTxFn = async (tx) => {
  const acc = getAccount();
  const walletClient = createWalletClient({
    account: acc,
    chain: CHAIN,
    transport: http(BSC_RPC),
  });

  const hash = await walletClient.sendTransaction({
    to: tx.to,
    data: tx.data,
    value: tx.value,
  });

  // Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === 'reverted') throw new Error(`Transaction reverted: ${hash}`);
  console.log(`[TX] Confirmed: ${hash} (gas: ${receipt.gasUsed})`);
  return hash;
};
