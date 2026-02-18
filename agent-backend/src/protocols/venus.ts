import { encodeFunctionData, maxUint256 } from 'viem';
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

  async withdraw(asset, amount, _walletAddress, sendTx) {
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
