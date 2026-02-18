import { encodeFunctionData } from 'viem';
import { LISTA, ASSETS } from '../config.js';
import { listaStakeManagerAbi } from '../abis/listaStakeManager.js';
import { erc20Abi } from '../abis/erc20.js';
import { publicClient } from '../data/onchain.js';
import type { ProtocolAdapter } from './types.js';

const STAKE_MANAGER = LISTA.staking.stakeManager;
const SLISBNB = LISTA.staking.slisBNB;

export const listaStakingAdapter: ProtocolAdapter = {
  name: 'lista-staking',

  async supply(_asset, amount, _walletAddress, sendTx) {
    // Stake native BNB into slisBNB via StakeManager.deposit()
    const depositData = encodeFunctionData({
      abi: listaStakeManagerAbi,
      functionName: 'deposit',
    });
    return sendTx({ to: STAKE_MANAGER, data: depositData, value: amount });
  },

  async withdraw(_asset, amount, _walletAddress, sendTx) {
    // Initiate unstake — note: 7-15 day delay, not instant
    const withdrawData = encodeFunctionData({
      abi: listaStakeManagerAbi,
      functionName: 'requestWithdraw',
      args: [amount],
    });
    return sendTx({ to: STAKE_MANAGER, data: withdrawData });
  },

  async getBalance(_asset, walletAddress) {
    // Read slisBNB token balance
    const slisBnbBalance = await publicClient.readContract({
      address: SLISBNB,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [walletAddress],
    });
    if (slisBnbBalance === 0n) return 0n;

    // Convert slisBNB to BNB equivalent
    return publicClient.readContract({
      address: STAKE_MANAGER,
      abi: listaStakeManagerAbi,
      functionName: 'convertSnBnbToBnb',
      args: [slisBnbBalance],
    });
  },

  async getApy() {
    // APY comes from DeFiLlama enrichment
    return 0;
  },
};
