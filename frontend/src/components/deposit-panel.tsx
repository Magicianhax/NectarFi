'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { encodeFunctionData, parseEther, parseUnits, formatUnits } from 'viem';
import { api } from '@/lib/api';
import { TOKEN_LOGOS } from '@/lib/logos';
import { TxSpinner } from '@/components/tx-spinner';

const TOKENS = [
  { symbol: 'BNB', name: 'BNB', decimals: 18, address: null },
  { symbol: 'USDT', name: 'Tether USD', decimals: 18, address: '0x55d398326f99059fF775485246999027B3197955' as `0x${string}` },
  { symbol: 'USDC', name: 'USD Coin', decimals: 18, address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d' as `0x${string}` },
] as const;

const ERC20_TRANSFER_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

interface TokenBalance {
  symbol: string;
  balance: string; // bigint serialized as string from backend
  decimals: number;
}

interface DepositPanelProps {
  agentWallet: string | null;
  userId?: string | null;
  onTxSuccess?: (txHash: string, asset: string) => void;
}

export function DepositPanel({ agentWallet, userId, onTxSuccess }: DepositPanelProps) {
  const { ready } = usePrivy();
  const { wallets } = useWallets();
  const [selectedToken, setSelectedToken] = useState(0);
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [userBalances, setUserBalances] = useState<Record<string, string>>({});
  const [loadingBal, setLoadingBal] = useState(false);

  const token = TOKENS[selectedToken];
  const wallet = wallets?.[0];

  // Fetch user wallet balances
  const fetchBalances = useCallback(async () => {
    if (!wallet?.address) return;
    setLoadingBal(true);
    try {
      const data = await api.getBalances(wallet.address);
      const map: Record<string, string> = {};
      for (const b of data.balances) {
        const formatted = formatUnits(BigInt(b.balance), b.decimals);
        map[b.symbol] = formatted;
      }
      setUserBalances(map);
    } catch {
      // Silently fail — balances are informational
    } finally {
      setLoadingBal(false);
    }
  }, [wallet?.address]);

  useEffect(() => {
    fetchBalances();
    const interval = setInterval(fetchBalances, 30_000);
    return () => clearInterval(interval);
  }, [fetchBalances]);

  // Refetch after successful deposit
  useEffect(() => {
    if (txHash) {
      const timer = setTimeout(fetchBalances, 5000);
      return () => clearTimeout(timer);
    }
  }, [txHash, fetchBalances]);

  const copyAddress = () => {
    if (!agentWallet) return;
    navigator.clipboard.writeText(agentWallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMax = () => {
    const bal = userBalances[token.symbol];
    if (!bal) return;
    // For BNB, leave a small amount for gas
    if (token.symbol === 'BNB') {
      const max = Math.max(0, parseFloat(bal) - 0.005);
      setAmount(max > 0 ? max.toString() : '0');
    } else {
      setAmount(bal);
    }
  };

  const handleDeposit = async () => {
    if (!wallet || !agentWallet || !amount || sending) return;
    setSending(true);
    setError(null);
    setTxHash(null);

    try {
      const provider = await wallet.getEthereumProvider();

      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x38' }],
        });
      } catch {
        // Might already be on BSC
      }

      let hash: string;

      if (token.address === null) {
        hash = await provider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: wallet.address,
            to: agentWallet,
            value: `0x${parseEther(amount).toString(16)}`,
          }],
        }) as string;
      } else {
        const data = encodeFunctionData({
          abi: ERC20_TRANSFER_ABI,
          functionName: 'transfer',
          args: [agentWallet as `0x${string}`, parseUnits(amount, token.decimals)],
        });
        hash = await provider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: wallet.address,
            to: token.address,
            data,
          }],
        }) as string;
      }

      setTxHash(hash);
      setSending(false);
      setConfirming(true);

      // Wait for on-chain confirmation
      const poll = async (): Promise<boolean> => {
        for (let i = 0; i < 60; i++) {
          await new Promise(r => setTimeout(r, 2000));
          try {
            const receipt = await provider.request({
              method: 'eth_getTransactionReceipt',
              params: [hash],
            });
            if (receipt) {
              const status = (receipt as { status: string }).status;
              return status === '0x1';
            }
          } catch { /* retry */ }
        }
        return false;
      };

      const success = await poll();
      setConfirming(false);

      if (success) {
        setAmount('');
        api.logDeposit(token.symbol, amount, hash).catch(() => {});
        onTxSuccess?.(hash, token.symbol);
      } else {
        setError('Transaction failed or timed out');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setSending(false);
      setConfirming(false);
    }
  };

  if (!agentWallet) return null;

  const shortAddr = `${agentWallet.slice(0, 8)}...${agentWallet.slice(-6)}`;
  const currentBalance = userBalances[token.symbol];
  const hasBalance = currentBalance && parseFloat(currentBalance) > 0;

  return (
    <div className="skeuo-panel p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="led-gold" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-emboss">Deposit</h3>
        </div>
        <span className="skeuo-tag text-[10px]">BSC</span>
      </div>

      <div className="skeuo-divider" />

      {/* Your Wallet Balances */}
      {wallet?.address && (
        <div className="space-y-2">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Your Wallet</label>
          <div className="skeuo-inset p-3 space-y-1.5">
            {loadingBal && Object.keys(userBalances).length === 0 ? (
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-pulse" />
                <span className="text-[10px] text-muted-foreground">Loading balances...</span>
              </div>
            ) : (
              TOKENS.map((t) => {
                const bal = userBalances[t.symbol];
                const num = bal ? parseFloat(bal) : 0;
                return (
                  <div key={t.symbol} className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1.5">
                      {TOKEN_LOGOS[t.symbol] && <img src={TOKEN_LOGOS[t.symbol]} alt={t.symbol} width={14} height={14} className="rounded-full" />}
                      {t.symbol}
                    </span>
                    <span className={`text-[11px] font-mono font-semibold ${num > 0 ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                      {num > 0 ? (num < 0.0001 ? '<0.0001' : num.toFixed(num < 1 ? 6 : 2)) : '0.00'}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Agent Wallet Address */}
      <div className="space-y-2">
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Agent Wallet</label>
        <button
          onClick={copyAddress}
          className="w-full skeuo-inset px-3 py-2.5 flex items-center justify-between gap-2 group cursor-pointer"
        >
          <span className="font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors truncate">
            {shortAddr}
          </span>
          <span className="text-[10px] shrink-0 font-semibold uppercase tracking-wider text-gold-glow">
            {copied ? 'Copied!' : 'Copy'}
          </span>
        </button>
      </div>

      {/* Token Selector */}
      <div className="space-y-2">
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Token</label>
        <div className="grid grid-cols-3 gap-2">
          {TOKENS.map((t, i) => {
            const bal = userBalances[t.symbol];
            const num = bal ? parseFloat(bal) : 0;
            return (
              <button
                key={t.symbol}
                onClick={() => setSelectedToken(i)}
                className={`py-2  text-xs font-bold transition-all relative ${
                  selectedToken === i
                    ? 'skeuo-button-gold'
                    : 'skeuo-button-dark'
                }`}
              >
                <span className="flex items-center justify-center gap-1.5">
                  {TOKEN_LOGOS[t.symbol] && <img src={TOKEN_LOGOS[t.symbol]} alt={t.symbol} width={16} height={16} className="rounded-full" />}
                  {t.symbol}
                </span>
                {num > 0 && (
                  <span className={`block text-[9px] font-normal mt-0.5 ${selectedToken === i ? 'opacity-70' : 'text-muted-foreground'}`}>
                    {num < 0.01 ? '<0.01' : num.toFixed(num < 1 ? 4 : 2)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Amount Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Amount</label>
          {hasBalance && (
            <button
              onClick={handleMax}
              className="text-[10px] font-semibold text-gold-glow uppercase tracking-wider hover:brightness-125 transition-all"
            >
              Max
            </button>
          )}
        </div>
        <input
          type="number"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="skeuo-input w-full px-3 py-2.5 text-sm font-mono placeholder:text-muted-foreground/50"
        />
        {/* Quick amounts */}
        <div className="flex gap-1.5">
          {(token.address === null ? ['0.01', '0.05', '0.1', '0.5'] : ['10', '50', '100', '500']).map((v) => (
            <button
              key={v}
              onClick={() => setAmount(v)}
              className="flex-1 py-1  text-[10px] font-semibold skeuo-button-dark"
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Send Button */}
      <button
        onClick={handleDeposit}
        disabled={!amount || !wallet || !ready || sending || confirming}
        className="skeuo-button-gold w-full py-3 text-sm font-bold tracking-wide disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {sending ? (
          <TxSpinner text="Sending..." />
        ) : confirming ? (
          <TxSpinner text="Confirming on-chain..." />
        ) : `Deposit ${token.symbol}`}
      </button>

      {/* Status Messages */}
      {txHash && (
        <div className="skeuo-inset p-3 flex items-center gap-2">
          <div className={confirming ? 'led-gold animate-pulse-gold' : 'led-green'} />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: confirming ? '#F0B90B' : '#00C087' }}>
              {confirming ? 'Waiting for confirmation...' : 'Transaction Confirmed'}
            </p>
            <a
              href={`https://bscscan.com/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors truncate block"
            >
              {txHash.slice(0, 20)}...
            </a>
          </div>
        </div>
      )}

      {error && (
        <div className="skeuo-inset p-3 flex items-center gap-2">
          <div className="led-red" />
          <p className="text-[11px] truncate" style={{ color: '#FF8A9E' }}>{error}</p>
        </div>
      )}
    </div>
  );
}
