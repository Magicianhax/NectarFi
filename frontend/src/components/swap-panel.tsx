'use client';

import { useState, useRef, useEffect } from 'react';
import { TOKEN_LOGOS } from '@/lib/logos';
import { TxSpinner } from '@/components/tx-spinner';

const SWAPPABLE = ['BNB', 'USDT', 'USDC', 'WBNB', 'BTCB', 'WETH', 'FDUSD', 'USD1', 'slisBNB'] as const;

interface TokenBalance {
  symbol: string;
  formatted: number;
}

interface SwapPanelProps {
  prices: Record<string, number>;
  balances: TokenBalance[];
  onSwap: (tokenIn: string, tokenOut: string, amount: string) => void;
  isPending: boolean;
  onClose: () => void;
}

function TokenSelector({
  tokens,
  selected,
  onSelect,
  label,
}: {
  tokens: readonly string[];
  selected: string;
  onSelect: (t: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="skeuo-button-dark px-3 py-2 flex items-center gap-2 min-w-[110px]"
      >
        {TOKEN_LOGOS[selected] && (
          <img src={TOKEN_LOGOS[selected]} alt={selected} width={20} height={20} className="rounded-full" />
        )}
        <span className="font-bold text-sm">{selected}</span>
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="3" strokeLinecap="round" className={`ml-auto transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-[180px] skeuo-panel p-1.5 space-y-0.5 animate-fade-up"
             style={{ borderRadius: 0 }}>
          <div className="px-2 py-1">
            <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">{label}</span>
          </div>
          {tokens.map((t) => (
            <button
              key={t}
              onClick={() => { onSelect(t); setOpen(false); }}
              className={`w-full px-2.5 py-2 flex items-center gap-2.5 transition-all ${
                selected === t
                  ? 'skeuo-inset'
                  : 'hover:bg-white/[0.03]'
              }`}
            >
              {TOKEN_LOGOS[t] && (
                <img src={TOKEN_LOGOS[t]} alt={t} width={20} height={20} className="rounded-full" />
              )}
              <span className={`text-xs font-bold ${selected === t ? 'text-gold-glow' : ''}`}>{t}</span>
              {selected === t && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F0B90B" strokeWidth="3" strokeLinecap="round" className="ml-auto">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const PERCENT_PRESETS = [25, 50, 75, 100] as const;

export function SwapPanel({ prices, balances, onSwap, isPending, onClose }: SwapPanelProps) {
  const [tokenIn, setTokenIn] = useState<string>('USDT');
  const [tokenOut, setTokenOut] = useState<string>('USDC');
  const [amount, setAmount] = useState('');

  const amountNum = parseFloat(amount) || 0;
  const priceIn = prices[tokenIn] || 0;
  const priceOut = prices[tokenOut] || 0;
  const estimatedOut = priceOut > 0 ? (amountNum * priceIn) / priceOut : 0;
  const usdValue = amountNum * priceIn;
  const rate = priceOut > 0 ? priceIn / priceOut : 0;

  // Balance for selected input token
  const balanceIn = balances.find(b => b.symbol === tokenIn)?.formatted || 0;
  const balanceOut = balances.find(b => b.symbol === tokenOut)?.formatted || 0;

  const setPercent = (pct: number) => {
    if (balanceIn <= 0) return;
    const val = (balanceIn * pct) / 100;
    // Use full precision for 100%, otherwise trim trailing zeros
    setAmount(pct === 100 ? String(val) : parseFloat(val.toFixed(8)).toString());
  };

  // Prevent selecting same token
  const availableIn = SWAPPABLE.filter(t => t !== tokenOut);
  const availableOut = SWAPPABLE.filter(t => t !== tokenIn);

  const handleSwapDirection = () => {
    const oldIn = tokenIn;
    const oldOut = tokenOut;
    setTokenIn(oldOut);
    setTokenOut(oldIn);
    setAmount('');
  };

  const handleSelectIn = (t: string) => {
    if (t === tokenOut) setTokenOut(tokenIn);
    setTokenIn(t);
  };

  const handleSelectOut = (t: string) => {
    if (t === tokenIn) setTokenIn(tokenOut);
    setTokenOut(t);
  };

  return (
    <div className="skeuo-panel p-5 space-y-4 animate-fade-up">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 flex items-center justify-center"
               style={{
                 background: 'linear-gradient(135deg, #1a3a2a 0%, #0e2a1a 100%)',
                 border: '1px solid rgba(0,192,135,0.25)',
                 boxShadow: 'inset 0 1px 0 rgba(0,192,135,0.1), 0 0 12px rgba(0,192,135,0.1)',
               }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00C087" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="7 3 7 21" />
              <polyline points="3 17 7 21 11 17" />
              <polyline points="17 21 17 3" />
              <polyline points="13 7 17 3 21 7" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-emboss">Swap Tokens</h3>
            <p className="text-[9px] text-muted-foreground">via PancakeSwap V3</p>
          </div>
        </div>
        <button onClick={onClose} className="skeuo-button-dark w-7 h-7 flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="skeuo-divider" />

      {/* ── FROM Section ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">You Pay</label>
          <button
            onClick={() => setPercent(100)}
            className="text-[10px] font-mono text-muted-foreground hover:text-gold-glow transition-colors cursor-pointer"
          >
            Balance: <span className="font-bold">{balanceIn > 0 ? (balanceIn < 0.0001 ? '<0.0001' : balanceIn < 1 ? balanceIn.toFixed(6) : balanceIn.toFixed(4)) : '0'}</span> {tokenIn}
          </button>
        </div>
        <div className="skeuo-inset p-3.5">
          <div className="flex items-center gap-3">
            <TokenSelector
              tokens={availableIn}
              selected={tokenIn}
              onSelect={handleSelectIn}
              label="Select token"
            />
            <div className="flex-1 text-right">
              <input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="any"
                min="0"
                className="w-full bg-transparent border-none text-right text-lg font-mono font-bold text-foreground placeholder:text-muted-foreground/30 focus:outline-none"
                style={{ appearance: 'textfield' }}
              />
              {usdValue > 0 && (
                <span className="text-[10px] font-mono text-muted-foreground">
                  ~${usdValue < 0.01 ? usdValue.toFixed(4) : usdValue.toFixed(2)}
                </span>
              )}
            </div>
          </div>
          {/* Percentage buttons */}
          {balanceIn > 0 && (
            <div className="flex gap-1.5 mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              {PERCENT_PRESETS.map((pct) => (
                <button
                  key={pct}
                  onClick={() => setPercent(pct)}
                  className={`flex-1 py-1.5 text-[10px] font-bold tracking-wide transition-all ${
                    amountNum > 0 && Math.abs(amountNum - (balanceIn * pct / 100)) < 0.000001
                      ? 'skeuo-button-gold'
                      : 'skeuo-button-dark'
                  }`}
                >
                  {pct === 100 ? 'MAX' : `${pct}%`}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Swap Direction Button ── */}
      <div className="flex justify-center -my-1 relative z-10">
        <button
          onClick={handleSwapDirection}
          className="w-9 h-9 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
          style={{
            background: 'linear-gradient(180deg, #2c2c33 0%, #1e1e24 100%)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '50%',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F0B90B" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <polyline points="19 12 12 19 5 12" />
          </svg>
        </button>
      </div>

      {/* ── TO Section ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">You Receive</label>
          <span className="text-[10px] font-mono text-muted-foreground">
            Balance: <span className="font-bold">{balanceOut > 0 ? (balanceOut < 0.0001 ? '<0.0001' : balanceOut < 1 ? balanceOut.toFixed(6) : balanceOut.toFixed(4)) : '0'}</span> {tokenOut}
          </span>
        </div>
        <div className="skeuo-inset p-3.5">
          <div className="flex items-center gap-3">
            <TokenSelector
              tokens={availableOut}
              selected={tokenOut}
              onSelect={handleSelectOut}
              label="Select token"
            />
            <div className="flex-1 text-right">
              <div className={`text-lg font-mono font-bold ${estimatedOut > 0 ? 'text-green-glow' : 'text-muted-foreground/30'}`}>
                {estimatedOut > 0
                  ? estimatedOut < 0.0001 ? '<0.0001' : estimatedOut < 1 ? estimatedOut.toFixed(6) : estimatedOut.toFixed(4)
                  : '0.00'}
              </div>
              {estimatedOut > 0 && priceOut > 0 && (
                <span className="text-[10px] font-mono text-muted-foreground">
                  ~${(estimatedOut * priceOut) < 0.01 ? (estimatedOut * priceOut).toFixed(4) : (estimatedOut * priceOut).toFixed(2)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Rate & Info ── */}
      {rate > 0 && (
        <div className="skeuo-inset px-3.5 py-2.5 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground font-semibold">Rate</span>
            <span className="text-[10px] font-mono text-foreground">
              1 {tokenIn} = {rate < 0.001 ? rate.toFixed(8) : rate < 1 ? rate.toFixed(6) : rate.toFixed(4)} {tokenOut}
            </span>
          </div>
          <div className="skeuo-divider" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground font-semibold">Slippage</span>
            <span className="text-[10px] font-mono text-foreground">1%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground font-semibold">Router</span>
            <div className="flex items-center gap-1">
              <img src="https://icons.llamao.fi/icons/protocols/pancakeswap?w=48&h=48" alt="PCS" width={12} height={12} className="rounded-full" />
              <span className="text-[10px] font-mono text-foreground">PancakeSwap V3</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Swap Button ── */}
      <button
        onClick={() => onSwap(tokenIn, tokenOut, amount)}
        disabled={isPending || amountNum <= 0}
        className="skeuo-button-gold w-full py-3.5 text-sm font-bold tracking-wide disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isPending ? (
          <>
            <TxSpinner />
            <span>Swapping...</span>
          </>
        ) : amountNum > 0 ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="7 3 7 21" />
              <polyline points="3 17 7 21 11 17" />
              <polyline points="17 21 17 3" />
              <polyline points="13 7 17 3 21 7" />
            </svg>
            Swap {amount} {tokenIn}
          </>
        ) : 'Enter Amount'}
      </button>
    </div>
  );
}
