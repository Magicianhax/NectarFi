import { encodeFunctionData, parseAbi, maxUint256 } from 'viem';
import { PANCAKESWAP } from '../config.js';
import { erc20Abi } from '../abis/erc20.js';
import { publicClient } from '../data/onchain.js';
import type { SendTxFn } from './types.js';

// PancakeSwap V3 exact input single swap
const swapAbi = parseAbi([
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
]);

// PancakeSwap V3 Quoter for finding the right fee tier
const quoterAbi = parseAbi([
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
]);
const QUOTER = '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997' as const;

// Fee tiers to try in order: 100 (stables), 500 (correlated), 2500 (standard), 10000 (exotic)
const FEE_TIERS = [100, 500, 2500, 10000] as const;

async function findBestFeeTier(
  tokenIn: `0x${string}`,
  tokenOut: `0x${string}`,
  amountIn: bigint,
): Promise<{ fee: number; amountOut: bigint }> {
  let bestFee = 2500;
  let bestOut = 0n;

  for (const fee of FEE_TIERS) {
    try {
      const result = await publicClient.simulateContract({
        address: QUOTER,
        abi: quoterAbi,
        functionName: 'quoteExactInputSingle',
        args: [{ tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0n }],
      });
      const amountOut = result.result[0];
      if (amountOut > bestOut) {
        bestOut = amountOut;
        bestFee = fee;
      }
    } catch {
      // No pool at this fee tier, skip
    }
  }

  if (bestOut === 0n) {
    throw new Error(`No liquidity found for this pair on PancakeSwap V3`);
  }

  console.log(`[SWAP] Best fee tier: ${bestFee} (${bestFee / 10000}%) → output: ${bestOut}`);
  return { fee: bestFee, amountOut: bestOut };
}

export async function swapTokens(
  tokenIn: `0x${string}`,
  tokenOut: `0x${string}`,
  amountIn: bigint,
  walletAddress: `0x${string}`,
  sendTx: SendTxFn,
  slippageBps: number = 100, // 1% default
): Promise<string> {
  // Approve router
  const allowance = await publicClient.readContract({
    address: tokenIn,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [walletAddress, PANCAKESWAP.smartRouter],
  });
  if (allowance < amountIn) {
    const approveData = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [PANCAKESWAP.smartRouter, maxUint256],
    });
    await sendTx({ to: tokenIn, data: approveData });
  }

  // Find the best fee tier via quoter
  const { fee, amountOut } = await findBestFeeTier(tokenIn, tokenOut, amountIn);

  // Slippage protection based on actual quoted output
  const amountOutMinimum = (amountOut * BigInt(10000 - slippageBps)) / 10000n;

  const swapData = encodeFunctionData({
    abi: swapAbi,
    functionName: 'exactInputSingle',
    args: [{
      tokenIn,
      tokenOut,
      fee,
      recipient: walletAddress,
      amountIn,
      amountOutMinimum,
      sqrtPriceLimitX96: 0n,
    }],
  });

  return sendTx({ to: PANCAKESWAP.smartRouter, data: swapData });
}
