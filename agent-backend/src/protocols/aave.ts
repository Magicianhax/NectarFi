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

  async withdraw(asset, _amount, walletAddress, sendTx) {
    const assetAddr = ASSETS[asset as keyof typeof ASSETS].address;
    const withdrawData = encodeFunctionData({
      abi: aavePoolAbi,
      functionName: 'withdraw',
      args: [assetAddr, _amount, walletAddress],
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
