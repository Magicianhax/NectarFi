import { Router } from 'express';
import { getAddress, encodeFunctionData, parseUnits, formatUnits } from 'viem';
import { getLatestYields, runAiRebalance, getActivityLog, broadcast, startAgentAndRun, stopAgent as stopAgentScheduler, isAgentRunning } from '../agent/scheduler.js';
import { createAgentWallet, createSendTxFn, exportWalletPrivateKey, verifyPrivyAuth } from '../wallet/privy.js';
import {
  getOrCreateUser, updateAgentWallet, getUserSettings,
  upsertSettings, getUserPositions, getTransactionHistory,
  getPortfolioHistory, getYieldHistory, logTransaction,
  getApyTrends, supabase, getUserWallet,
} from '../db/supabase.js';
import { getWalletBalances, getOnchainPositions, publicClient } from '../data/onchain.js';
import { aaveAdapter } from '../protocols/aave.js';
import { venusAdapter } from '../protocols/venus.js';
import { listaAdapter } from '../protocols/lista.js';
import { swapTokens } from '../protocols/pancakeswap.js';
import { getCachedPrices } from '../data/defillama.js';
import { DEFAULT_SETTINGS, ASSETS } from '../config.js';
import { erc20Abi } from '../abis/erc20.js';

export const router = Router();

// Auth middleware: verifies Privy access token and resolves to our DB userId
import type { Request, Response, NextFunction } from 'express';

interface AuthenticatedRequest extends Request {
  verifiedUserId?: string;
  verifiedWalletAddress?: string;
}

async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  try {
    const token = authHeader.substring(7);
    const { dbUserId, walletAddress } = await verifyPrivyAuth(token);

    // Attach verified identity to request
    req.verifiedUserId = dbUserId;
    req.verifiedWalletAddress = walletAddress;

    // If route has :userId param, verify it matches the authenticated user
    const paramUserId = req.params.userId;
    if (paramUserId && paramUserId !== dbUserId) {
      return res.status(403).json({ error: 'Forbidden: user mismatch' });
    }

    next();
  } catch (error) {
    console.error('Auth verification failed:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Get live token prices
router.get('/prices', (_req, res) => {
  res.json({ prices: getCachedPrices() });
});

// Get current yield opportunities
router.get('/yields', (_req, res) => {
  res.json({ yields: getLatestYields() });
});

// Get APY trend data (rising/falling/stable per pool)
router.get('/trends', async (_req, res) => {
  try {
    const trends = await getApyTrends();
    res.json({ trends });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

// Register/login user and get or create agent wallet
router.post('/auth', async (req: AuthenticatedRequest, res) => {
  try {
    // Verify Privy token to get wallet address (don't trust body)
    const authHeader = req.headers.authorization;
    let eoaAddress: string;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { walletAddress } = await verifyPrivyAuth(token).catch(() => ({ dbUserId: '', walletAddress: '' }));
      eoaAddress = walletAddress || req.body.eoaAddress;
    } else {
      eoaAddress = req.body.eoaAddress;
    }

    if (!eoaAddress) return res.status(400).json({ error: 'eoaAddress required' });

    const user = await getOrCreateUser(eoaAddress);

    // Create agent wallet if none exists
    if (!user.agent_wallet_address) {
      const { address, walletId, ownerPrivateKey } = await createAgentWallet(user.id);
      await updateAgentWallet(user.id, walletId, address);
      // Store owner auth key for PK export
      await supabase.from('users').update({ owner_auth_key: ownerPrivateKey }).eq('id', user.id);
      user.agent_wallet_address = address;
    }

    const settings = await getUserSettings(user.id);

    res.json({
      userId: user.id,
      agentWallet: user.agent_wallet_address,
      settings: settings || DEFAULT_SETTINGS,
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get portfolio
router.get('/portfolio/:userId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.verifiedUserId!;
    const positions = await getUserPositions(userId);
    const history = await getPortfolioHistory(userId);

    // Calculate total deposited by summing deposits and subtracting withdrawals
    const { data: deposits } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('type', 'deposit');

    const { data: withdrawals } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('type', 'transfer_to_eoa'); // withdrawals to user wallet

    const totalIn = (deposits || []).reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const totalOut = (withdrawals || []).reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const totalDeposited = Math.max(0, totalIn - totalOut);

    res.json({ positions, history, totalDeposited });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

// Get transaction history with optional filters
router.get('/history/:userId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.verifiedUserId!;
    const type = req.query.type as string | undefined;
    const asset = req.query.asset as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    const { transactions, total } = await getTransactionHistory(userId, { type, asset, limit, offset });
    res.json({ transactions, total });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Get settings
router.get('/settings/:userId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.verifiedUserId!;
    const settings = await getUserSettings(userId);
    res.json(settings || DEFAULT_SETTINGS);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update settings
router.post('/settings/:userId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.verifiedUserId!;
    await upsertSettings(userId, req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Manual rebalance trigger — runs full AI-driven rebalance
router.post('/rebalance/:userId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.verifiedUserId!;
    console.log(`[API] Rebalance triggered for user ${userId}`);
    const result = await runAiRebalance(userId);
    res.json({
      message: 'Rebalance complete',
      reasoning: result.reasoning,
      actions: result.actions,
    });
  } catch (error) {
    console.error('Rebalance error:', error);
    res.status(500).json({ error: 'Rebalance failed' });
  }
});

// Get agent wallet address for deposits
router.get('/deposit/:userId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.verifiedUserId!;
    const user = await getOrCreateUser(userId);
    res.json({ agentWallet: user.agent_wallet_address });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get deposit address' });
  }
});

// Export agent wallet info + private key
router.post('/export-wallet/:userId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.verifiedUserId!;
    const { data: user } = await supabase
      .from('users')
      .select('agent_wallet_id, agent_wallet_address, owner_auth_key')
      .eq('id', userId)
      .single();
    if (!user?.agent_wallet_id) {
      return res.status(404).json({ error: 'No agent wallet found' });
    }
    if (!user.owner_auth_key) {
      return res.status(400).json({ error: 'Wallet was created before export support. Please create a new wallet.' });
    }

    const privateKey = await exportWalletPrivateKey(user.agent_wallet_id, user.owner_auth_key);

    res.json({
      walletAddress: user.agent_wallet_address,
      privateKey,
    });
  } catch (error) {
    console.error('Export wallet error:', error);
    res.status(500).json({ error: 'Failed to export wallet' });
  }
});

// Get token balances for any address (user wallet or agent wallet)
router.get('/balances/:address', async (req, res) => {
  try {
    const address = req.params.address as string;
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }
    // getAddress checksums it for viem
    const checksummed = getAddress(address);
    const balances = await getWalletBalances(checksummed);
    // Serialize BigInt to string for JSON
    const serialized = balances.map((b) => ({
      ...b,
      balance: b.balance.toString(),
    }));
    res.json({ balances: serialized });
  } catch (error) {
    console.error('Balance fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch balances' });
  }
});

// Get agent wallet info (without PK)
router.get('/wallet-info/:userId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.verifiedUserId!;
    const { data: user } = await supabase
      .from('users')
      .select('agent_wallet_id, agent_wallet_address')
      .eq('id', userId)
      .single();
    if (!user?.agent_wallet_address) {
      return res.status(404).json({ error: 'No agent wallet found' });
    }
    res.json({
      walletId: user.agent_wallet_id,
      walletAddress: user.agent_wallet_address,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get wallet info' });
  }
});

// Get on-chain positions for the agent wallet (reads aToken/vToken balances directly)
router.get('/positions/:address', async (req, res) => {
  try {
    const address = req.params.address as string;
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }
    const checksummed = getAddress(address);
    const positions = await getOnchainPositions(checksummed);
    // Enrich positions with yields data (fallback for protocols that return 0% APY like Lista)
    const yields = getLatestYields();
    for (const pos of positions) {
      if (pos.apy === 0 && yields.length > 0) {
        const match = yields.find(y => y.protocol === pos.protocol && y.asset === pos.asset);
        if (match && match.supplyApy > 0) {
          pos.apy = match.supplyApy;
        }
      }
    }
    res.json({ positions });
  } catch (error) {
    console.error('Positions fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

// Agent start/stop control
router.post('/agent/start', requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.verifiedUserId;
  console.log('[AGENT] Agent start requested');
  res.json({ running: true });
  startAgentAndRun(userId || undefined).catch(err =>
    console.error('[AGENT] Background start error:', err)
  );
});

router.post('/agent/stop', requireAuth, async (_req, res) => {
  stopAgentScheduler();
  console.log('[AGENT] Agent stopped');
  res.json({ running: false });
});

router.get('/agent/status', (_req, res) => {
  res.json({ running: isAgentRunning() });
});

// Transfer tokens from agent wallet back to user's EOA
// Accepts optional `amount` (human-readable string, e.g. "5.0"). If omitted, sends full balance.
router.post('/transfer-to-eoa', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { symbol, toAddress, amount: requestedAmount } = req.body;
    const userId = req.verifiedUserId!;
    if (!symbol || !toAddress) return res.status(400).json({ error: 'symbol and toAddress required' });
    if (!/^0x[a-fA-F0-9]{40}$/.test(toAddress)) return res.status(400).json({ error: 'Invalid address' });

    // Verify toAddress matches the authenticated user's EOA (prevent sending to arbitrary addresses)
    if (toAddress.toLowerCase() !== req.verifiedWalletAddress) {
      return res.status(403).json({ error: 'Can only transfer to your own wallet' });
    }

    // Look up user's Privy agent wallet
    const userWallet = await getUserWallet(userId);
    if (!userWallet) return res.status(404).json({ error: 'No agent wallet found' });
    const agentAddr = userWallet.walletAddress as `0x${string}`;
    const sendTx = createSendTxFn(userWallet.walletId, userWallet.ownerAuthKey);
    const recipient = getAddress(toAddress);

    if (symbol === 'BNB') {
      const balance = await publicClient.getBalance({ address: agentAddr });
      const gasBuffer = BigInt(5e15); // 0.005 BNB for gas
      if (balance <= gasBuffer) return res.status(400).json({ error: 'Insufficient BNB (need gas buffer)' });
      const maxAmount = balance - gasBuffer;
      let sendAmount = maxAmount;
      if (requestedAmount) {
        sendAmount = parseUnits(String(requestedAmount), 18);
        if (sendAmount > maxAmount) return res.status(400).json({ error: 'Amount exceeds available balance (after gas buffer)' });
        if (sendAmount === 0n) return res.status(400).json({ error: 'Amount must be greater than 0' });
      }

      console.log(`[TRANSFER] Sending ${sendAmount} BNB to ${recipient}`);
      const txHash = await sendTx({ to: recipient, data: '0x' as `0x${string}`, value: sendAmount });
      console.log(`[TRANSFER] Success: ${txHash}`);
      const bnbFormatted = (Number(sendAmount) / 1e18).toFixed(4);
      broadcast('transfer_to_eoa', {
        title: 'Funds withdrawn to wallet',
        description: `${bnbFormatted} BNB returned to user wallet`,
        symbol: 'BNB', amount: bnbFormatted, txHash,
      });
      if (userId) {
        logTransaction(userId, { type: 'transfer_to_eoa', asset: 'BNB', amount: parseFloat(bnbFormatted), tx_hash: txHash }).catch(() => {});
      }
      return res.json({ txHash, symbol, amount: sendAmount.toString() });
    }

    const asset = ASSETS[symbol as keyof typeof ASSETS];
    if (!asset) return res.status(400).json({ error: `Unknown token: ${symbol}` });

    const balance = await publicClient.readContract({
      address: asset.address,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [agentAddr],
    });
    if (balance === 0n) return res.status(400).json({ error: `No ${symbol} balance` });

    let sendAmount = balance;
    if (requestedAmount) {
      sendAmount = parseUnits(String(requestedAmount), asset.decimals);
      if (sendAmount > balance) return res.status(400).json({ error: 'Amount exceeds available balance' });
      if (sendAmount === 0n) return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [recipient, sendAmount],
    });

    console.log(`[TRANSFER] Sending ${sendAmount} ${symbol} to ${recipient}`);
    const txHash = await sendTx({ to: asset.address, data });
    console.log(`[TRANSFER] Success: ${txHash}`);
    const tokenFormatted = (Number(sendAmount) / 10 ** asset.decimals).toFixed(2);
    broadcast('transfer_to_eoa', {
      title: 'Funds withdrawn to wallet',
      description: `${tokenFormatted} ${symbol} returned to user wallet`,
      symbol, amount: tokenFormatted, txHash,
    });
    if (userId) {
      logTransaction(userId, { type: 'transfer_to_eoa', asset: symbol, amount: parseFloat(tokenFormatted), tx_hash: txHash }).catch(() => {});
    }
    res.json({ txHash, symbol, amount: sendAmount.toString() });
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Transfer failed' });
  }
});

// Withdraw from a protocol position
router.post('/withdraw', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { protocol, asset } = req.body;
    const userId = req.verifiedUserId!;
    if (!protocol || !asset) return res.status(400).json({ error: 'protocol and asset required' });

    const adapters: Record<string, typeof aaveAdapter> = { aave: aaveAdapter, venus: venusAdapter, lista: listaAdapter };
    const adapter = adapters[protocol];
    if (!adapter) return res.status(400).json({ error: `Unknown protocol: ${protocol}` });

    // Look up user's Privy agent wallet
    const userWallet = await getUserWallet(userId);
    if (!userWallet) return res.status(404).json({ error: 'No agent wallet found' });
    const agentAddr = userWallet.walletAddress as `0x${string}`;
    const sendTx = createSendTxFn(userWallet.walletId, userWallet.ownerAuthKey);

    // Get full balance for this position
    const balance = await adapter.getBalance(asset, agentAddr);
    if (balance === 0n) return res.status(400).json({ error: 'No balance to withdraw' });

    console.log(`[WITHDRAW] Withdrawing ${asset} from ${protocol} (balance: ${balance})`);
    const txHash = await adapter.withdraw(asset, balance, agentAddr, sendTx);
    console.log(`[WITHDRAW] Success: ${txHash}`);
    const withdrawFormatted = (Number(balance) / 1e18).toFixed(2);
    broadcast('position_withdrawn', {
      title: 'Position deactivated',
      description: `All funds withdrawn from ${protocol}, ${withdrawFormatted} ${asset} returned to agent wallet`,
      protocol, asset, amount: withdrawFormatted, txHash,
    });
    if (userId) {
      logTransaction(userId, { type: 'withdraw', from_protocol: protocol, asset, amount: parseFloat(withdrawFormatted), tx_hash: txHash }).catch(() => {});
    }
    res.json({ txHash, protocol, asset });
  } catch (error) {
    console.error('Withdraw error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Withdraw failed' });
  }
});

// Wind down: withdraw ALL positions back to agent wallet
router.post('/wind-down', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.verifiedUserId!;

    // Look up user's Privy agent wallet
    const userWallet = await getUserWallet(userId);
    if (!userWallet) return res.status(404).json({ error: 'No agent wallet found' });
    const agentAddr = userWallet.walletAddress as `0x${string}`;
    const sendTx = createSendTxFn(userWallet.walletId, userWallet.ownerAuthKey);

    const positions = await getOnchainPositions(agentAddr);

    if (positions.length === 0) {
      return res.status(400).json({ error: 'No active positions to wind down' });
    }

    broadcast('wind_down_started', {
      title: 'Wind down initiated',
      description: `Withdrawing ${positions.length} position${positions.length !== 1 ? 's' : ''} back to agent wallet`,
      count: positions.length,
    });

    const adapters: Record<string, typeof aaveAdapter> = { aave: aaveAdapter, venus: venusAdapter, lista: listaAdapter };
    const results: Array<{ protocol: string; asset: string; txHash: string; amount: string }> = [];

    for (const pos of positions) {
      const adapter = adapters[pos.protocol];
      if (!adapter) continue;

      try {
        const balance = await adapter.getBalance(pos.asset, agentAddr);
        if (balance === 0n) continue;

        console.log(`[WIND-DOWN] Withdrawing ${pos.asset} from ${pos.protocol} (balance: ${balance})`);
        const txHash = await adapter.withdraw(pos.asset, balance, agentAddr, sendTx);
        const formatted = (Number(balance) / 1e18).toFixed(2);
        console.log(`[WIND-DOWN] Success: ${txHash}`);

        broadcast('position_withdrawn', {
          title: 'Position wound down',
          description: `${formatted} ${pos.asset} withdrawn from ${pos.protocol}`,
          protocol: pos.protocol, asset: pos.asset, amount: formatted, txHash,
        });
        if (userId) {
          logTransaction(userId, { type: 'withdraw', from_protocol: pos.protocol, asset: pos.asset, amount: parseFloat(formatted), tx_hash: txHash }).catch(() => {});
        }
        results.push({ protocol: pos.protocol, asset: pos.asset, txHash, amount: formatted });
      } catch (err) {
        console.error(`[WIND-DOWN] Failed to withdraw ${pos.asset} from ${pos.protocol}:`, err);
      }
    }

    broadcast('wind_down_complete', {
      title: 'All positions wound down',
      description: `${results.length} position${results.length !== 1 ? 's' : ''} withdrawn to agent wallet`,
      count: results.length,
    });

    res.json({ results });
  } catch (error) {
    console.error('Wind-down error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Wind down failed' });
  }
});

// Swap tokens via PancakeSwap (supports native BNB via auto wrap/unwrap)
router.post('/swap', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { tokenIn, tokenOut, amount } = req.body;
    const userId = req.verifiedUserId!;
    if (!tokenIn || !tokenOut || !amount) return res.status(400).json({ error: 'tokenIn, tokenOut, amount required' });
    if (tokenIn === tokenOut) return res.status(400).json({ error: 'Cannot swap same token' });
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return res.status(400).json({ error: 'Amount must be a positive number' });

    // Look up user's Privy agent wallet
    const userWallet = await getUserWallet(userId);
    if (!userWallet) return res.status(404).json({ error: 'No agent wallet found' });
    const agentAddr = userWallet.walletAddress as `0x${string}`;
    const sendTx = createSendTxFn(userWallet.walletId, userWallet.ownerAuthKey);

    const amountIn = parseUnits(String(amount), 18);
    const wbnbAddress = ASSETS.WBNB.address;
    const wbnbAbi = [
      { name: 'deposit', type: 'function', inputs: [], outputs: [], stateMutability: 'payable' },
      { name: 'withdraw', type: 'function', inputs: [{ name: 'wad', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
    ] as const;

    let txHash: string;

    // BNB → WBNB (just wrap, no PancakeSwap needed)
    if (tokenIn === 'BNB' && tokenOut === 'WBNB') {
      console.log(`[SWAP] Wrapping ${amount} BNB -> WBNB`);
      const data = encodeFunctionData({ abi: wbnbAbi, functionName: 'deposit' });
      txHash = await sendTx({ to: wbnbAddress, data, value: amountIn });

    // WBNB → BNB (just unwrap)
    } else if (tokenIn === 'WBNB' && tokenOut === 'BNB') {
      // Check actual WBNB balance and clamp amount to avoid revert
      const wbnbBal = await publicClient.readContract({
        address: wbnbAddress, abi: erc20Abi, functionName: 'balanceOf', args: [agentAddr],
      });
      if (wbnbBal === 0n) return res.status(400).json({ error: 'No WBNB balance to unwrap' });
      const unwrapAmt = amountIn > wbnbBal ? wbnbBal : amountIn;
      console.log(`[SWAP] Unwrapping ${formatUnits(unwrapAmt, 18)} WBNB -> BNB (requested: ${amount}, available: ${formatUnits(wbnbBal, 18)})`);
      const data = encodeFunctionData({ abi: wbnbAbi, functionName: 'withdraw', args: [unwrapAmt] });
      txHash = await sendTx({ to: wbnbAddress, data });

    // BNB → token (wrap BNB to WBNB first, then swap WBNB → token)
    } else if (tokenIn === 'BNB') {
      const assetOut = ASSETS[tokenOut as keyof typeof ASSETS];
      if (!assetOut) return res.status(400).json({ error: `Unknown token: ${tokenOut}` });
      console.log(`[SWAP] Wrapping ${amount} BNB -> WBNB first`);
      const wrapData = encodeFunctionData({ abi: wbnbAbi, functionName: 'deposit' });
      await sendTx({ to: wbnbAddress, data: wrapData, value: amountIn });
      console.log(`[SWAP] Now swapping WBNB -> ${tokenOut}`);
      txHash = await swapTokens(wbnbAddress, assetOut.address, amountIn, agentAddr, sendTx, 100);

    // token → BNB (swap token → WBNB, then unwrap)
    } else if (tokenOut === 'BNB') {
      const assetIn = ASSETS[tokenIn as keyof typeof ASSETS];
      if (!assetIn) return res.status(400).json({ error: `Unknown token: ${tokenIn}` });
      console.log(`[SWAP] Swapping ${amount} ${tokenIn} -> WBNB first`);
      txHash = await swapTokens(assetIn.address, wbnbAddress, amountIn, agentAddr, sendTx, 100);
      // Read WBNB balance and unwrap
      const wbnbBal = await publicClient.readContract({
        address: wbnbAddress, abi: erc20Abi, functionName: 'balanceOf', args: [agentAddr],
      });
      if (wbnbBal > 0n) {
        console.log(`[SWAP] Unwrapping ${wbnbBal} WBNB -> BNB`);
        const unwrapData = encodeFunctionData({ abi: wbnbAbi, functionName: 'withdraw', args: [wbnbBal] });
        await sendTx({ to: wbnbAddress, data: unwrapData });
      }

    // ERC20 → ERC20 (normal swap)
    } else {
      const assetIn = ASSETS[tokenIn as keyof typeof ASSETS];
      const assetOut = ASSETS[tokenOut as keyof typeof ASSETS];
      if (!assetIn || !assetOut) return res.status(400).json({ error: `Unknown token: ${!assetIn ? tokenIn : tokenOut}` });
      console.log(`[SWAP] ${amount} ${tokenIn} -> ${tokenOut}`);
      txHash = await swapTokens(assetIn.address, assetOut.address, parseUnits(String(amount), assetIn.decimals), agentAddr, sendTx, 100);
    }

    console.log(`[SWAP] Success: ${txHash}`);
    broadcast('swap_completed', {
      title: 'Swap executed',
      description: `Swapped ${amount} ${tokenIn} for ${tokenOut} via PancakeSwap`,
      tokenIn, tokenOut, amount, txHash,
    });

    if (userId) {
      logTransaction(userId, { type: 'swap', asset: `${tokenIn}->${tokenOut}`, amount: parseFloat(amount), tx_hash: txHash }).catch(() => {});
    }

    res.json({ txHash, tokenIn, tokenOut, amount });
  } catch (error) {
    console.error('Swap error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Swap failed' });
  }
});

// Rebalance preview (dry run — AI decision without execution)
router.post('/rebalance-preview/:userId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.verifiedUserId!;
    console.log(`[API] Rebalance preview for user ${userId}`);
    const result = await runAiRebalance(userId, true);
    res.json(result);
  } catch (error) {
    console.error('Rebalance preview error:', error);
    res.status(500).json({ error: 'Preview failed' });
  }
});

// Log a deposit (called by frontend after user sends tokens to agent wallet)
router.post('/log-deposit', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.verifiedUserId!;
    const { asset, amount, txHash } = req.body;
    if (!asset || !amount) return res.status(400).json({ error: 'asset, amount required' });

    // We expect the frontend to send the amount in TOKEN units (e.g. 1.0 BNB), but we store USD value in DB for consistency.
    // However, the current implementation blindly stores 'amount'.
    // If the frontend sends token amount, and we store it as 'amount', then subsequent calculations that sum 'amount'
    // will be mixing token units with USD if other tx types store USD.
    // Let's check `logTransaction`: it stores `amount` in `numeric`.

    // To fix "Total Earned" calculation issues, we must ensure we store the USD value of the deposit.
    const prices = getCachedPrices();
    const price = prices[asset] || 0;
    const usdValue = parseFloat(amount) * price;

    await logTransaction(userId, {
      type: 'deposit',
      to_protocol: 'agent_wallet',
      asset,
      amount: usdValue > 0 ? usdValue : parseFloat(amount), // Fallback to raw amount if price missing (better than 0)
      tx_hash: txHash || null,
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to log deposit' });
  }
});

// Get activity log (persists across page refreshes)
router.get('/activity', (_req, res) => {
  res.json({ activities: getActivityLog() });
});

// Yield history (for charts)
router.get('/yield-history', async (req, res) => {
  try {
    const protocol = req.query.protocol as string | undefined;
    const asset = req.query.asset as string | undefined;
    const days = req.query.days ? parseInt(req.query.days as string) : 30;
    const snapshots = await getYieldHistory(protocol, asset, days);
    res.json({ snapshots });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch yield history' });
  }
});

// Portfolio history (for charts)
router.get('/portfolio-history/:userId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.verifiedUserId!;
    const days = req.query.days ? parseInt(req.query.days as string) : 30;
    const snapshots = await getPortfolioHistory(userId, days);
    res.json({ snapshots });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch portfolio history' });
  }
});
