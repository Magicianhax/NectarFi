import { encodeFunctionData, maxUint256 } from 'viem';
import { LISTA, ASSETS } from '../config.js';
import { moolahVaultAbi } from '../abis/listaMoolah.js';
import { erc20Abi } from '../abis/erc20.js';
import { getListaBalance, publicClient } from '../data/onchain.js';
import type { ProtocolAdapter, SendTxFn } from './types.js';

// Map assets to Lista vault addresses
const VAULT_MAP: Record<string, `0x${string}`> = {
  WBNB: LISTA.vaults.WBNB,
  USD1: LISTA.vaults.USD1,
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
    return 0;
  },
};
