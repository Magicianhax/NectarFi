'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAgent } from '@/hooks/use-agent';
import { YieldsTable } from '@/components/yields-table';
import { ActivityLog } from '@/components/activity-log';
import { DepositPanel } from '@/components/deposit-panel';
import { SwapPanel } from '@/components/swap-panel';
import { AnalyticsPanel } from '@/components/analytics-panel';
import { api } from '@/lib/api';
import { TOKEN_LOGOS, PROTOCOL_LOGOS } from '@/lib/logos';
import { toast } from 'sonner';
import { AnimatedNumber } from '@/components/animated-number';
import { Skeleton } from '@/components/ui/skeleton';
import { TxSpinner } from '@/components/tx-spinner';
import { LoadingSplash } from '@/components/loading-splash';

export default function Dashboard() {
  const { ready, authenticated, logout, user } = usePrivy();
  const router = useRouter();
  const {
    userId, agentWallet, yields, trends, portfolio, rebalance, wsMessages,
    agentBalances, onchainPositions, agentStatus, startAgent, stopAgent, withdraw, windDown, transferToEoa,
    prices, swap, rebalancePreview, refreshBalances,
  } = useAgent();
  const PRICES = prices.data || {};
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdrawToEoa, setShowWithdrawToEoa] = useState(false);
  const [withdrawSelected, setWithdrawSelected] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [walletInfo, setWalletInfo] = useState<{ walletAddress: string; privateKey: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [txPopup, setTxPopup] = useState<{ type: string; txHash: string; asset?: string; protocol?: string } | null>(null);
  const [showSwap, setShowSwap] = useState(false);
  const [previewData, setPreviewData] = useState<{ reasoning: string; actions: Array<Record<string, unknown>> } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [windDownResults, setWindDownResults] = useState<Array<{ protocol: string; asset: string; txHash: string; amount: string }> | null>(null);

  const handleExportWallet = async () => {
    if (!userId || exporting) return;
    setExporting(true);
    try {
      const info = await api.exportWallet(userId);
      setWalletInfo(info);
      setShowExport(true);
    } catch (e) {
      console.error('Export failed:', e);
      toast.error('Failed to export wallet');
    } finally {
      setExporting(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  useEffect(() => {
    if (ready && !authenticated) router.push('/');
  }, [ready, authenticated, router]);

  const positions = onchainPositions.data || [];
  const totalPositionValue = positions.reduce((sum, p) => sum + p.valueUsd, 0);
  const balances = agentBalances.data || [];
  const totalBalanceUsd = balances.reduce((sum, b) => {
    const price = PRICES[b.symbol] || 0;
    return sum + b.formatted * price;
  }, 0);
  const totalValue = totalPositionValue + totalBalanceUsd;
  const dailyYield = positions.reduce((sum, p) => sum + (p.valueUsd * p.apy / 100 / 365), 0);
  const avgApy = totalPositionValue > 0 ? (dailyYield * 365 / totalPositionValue) * 100 : 0;
  const totalDeposited = (portfolio.data?.positions || []).reduce((sum: number, p: { deposited_amount?: number }) => sum + (p.deposited_amount || 0), 0);
  const totalEarned = totalDeposited > 0 ? Math.max(0, totalPositionValue - totalDeposited) : 0;

  const isAgentRunning = agentStatus.data ?? false;
  const nonZeroBalances = balances.filter((b) => {
    const price = PRICES[b.symbol] || 0;
    return b.formatted > 0 && b.formatted * price >= 0.001;
  });

  const eoaShort = user?.wallet?.address
    ? `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}`
    : '';

  if (!ready) {
    return <LoadingSplash />;
  }

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">

        {/* ── Top Bar ── */}
        <header className="skeuo-panel animate-fade-up">
          {/* Row 1: Brand + Account */}
          <div className="px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 flex items-center justify-center animate-pulse-gold"
                   style={{ background: 'linear-gradient(135deg, #FFD54F 0%, #F0B90B 50%, #C49A09 100%)', boxShadow: '0 0 16px rgba(240,185,11,0.3)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0c0c0f" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <div>
                <h1 className="text-base font-bold text-emboss tracking-tight">
                  Nectar<span className="text-gold-glow">Fi</span>
                </h1>
                <p className="text-[10px] text-muted-foreground">AI Yield Optimizer on BNB Chain</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportWallet}
                disabled={exporting}
                className="skeuo-button-dark px-2.5 py-1.5 text-xs flex items-center gap-1.5 disabled:opacity-40"
                title="Export wallet key"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              </button>
              <button
                onClick={logout}
                className="skeuo-button-dark px-3 py-1.5 text-xs text-muted-foreground flex items-center gap-1.5"
              >
                <div className="led-green" style={{ width: 5, height: 5 }} />
                <span className="font-mono text-[10px]">{eoaShort}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="skeuo-divider" />

          {/* Row 2: Actions + Nav */}
          <div className="px-5 py-2.5 flex items-center justify-between gap-2 overflow-x-auto">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowDeposit(true)}
                className="skeuo-button-gold px-3 py-1.5 text-xs flex items-center gap-1.5 whitespace-nowrap"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Deposit
              </button>
              <button
                onClick={() => setShowSwap(true)}
                className="skeuo-button-dark px-3 py-1.5 text-xs flex items-center gap-1.5 whitespace-nowrap"
                style={{ borderColor: 'rgba(240,185,11,0.2)', color: '#F0B90B' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="7 3 7 21" />
                  <polyline points="3 17 7 21 11 17" />
                  <polyline points="17 21 17 3" />
                  <polyline points="13 7 17 3 21 7" />
                </svg>
                Swap
              </button>
              <button
                onClick={() => setShowWithdrawToEoa(true)}
                className="skeuo-button-dark px-3 py-1.5 text-xs flex items-center gap-1.5 whitespace-nowrap"
                style={{ borderColor: 'rgba(240,185,11,0.2)', color: '#F0B90B' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Withdraw
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <Link href="/dashboard/activity">
                <button className="skeuo-button-dark px-2.5 py-1.5 text-xs flex items-center gap-1.5 whitespace-nowrap">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                  Activity
                </button>
              </Link>
              <Link href="/dashboard/history">
                <button className="skeuo-button-dark px-2.5 py-1.5 text-xs flex items-center gap-1.5 whitespace-nowrap">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  History
                </button>
              </Link>
              <Link href="/dashboard/settings">
                <button className="skeuo-button-dark px-2.5 py-1.5 text-xs flex items-center gap-1.5 whitespace-nowrap">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                  </svg>
                  Settings
                </button>
              </Link>
            </div>
          </div>
        </header>

        {/* ── Agent Controls ── */}
        <div className="skeuo-panel px-5 py-3 animate-fade-up flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={isAgentRunning ? 'led-green' : 'led-red'} style={{ width: 10, height: 10 }} />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-emboss">
                AI Agent {isAgentRunning ? 'Running' : 'Stopped'}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {isAgentRunning
                  ? 'Monitoring yields and auto-rebalancing'
                  : 'Start the agent to begin yield optimization'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAgentRunning ? (
              <button
                onClick={() => stopAgent.mutate()}
                disabled={stopAgent.isPending}
                className="skeuo-action-btn px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2"
                style={{
                  background: 'linear-gradient(180deg, #3a1c1c 0%, #1a0a0a 100%)',
                  border: '1px solid rgba(255,68,68,0.3)',
                  color: '#ff6b6b',
                  boxShadow: '0 2px 8px rgba(255,68,68,0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
                {stopAgent.isPending ? 'Stopping...' : 'Stop Agent'}
              </button>
            ) : (
              <button
                onClick={() => startAgent.mutate()}
                disabled={startAgent.isPending}
                className="skeuo-action-btn px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2"
                style={{
                  background: 'linear-gradient(180deg, #1c3a1c 0%, #0a1a0a 100%)',
                  border: '1px solid rgba(0,192,135,0.3)',
                  color: '#00C087',
                  boxShadow: '0 2px 8px rgba(0,192,135,0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
                {startAgent.isPending ? 'Starting...' : 'Start Agent'}
              </button>
            )}
            <button
              onClick={async () => {
                setPreviewLoading(true);
                setPreviewData(null);
                try {
                  const data = await api.rebalancePreview(userId!);
                  setPreviewData(data as { reasoning: string; actions: Array<Record<string, unknown>> });
                } catch { setPreviewData(null); toast.error('Preview failed'); }
                setPreviewLoading(false);
              }}
              disabled={previewLoading || !userId}
              className="skeuo-button-dark px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 disabled:opacity-40"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              {previewLoading ? <TxSpinner text="Simulating..." /> : 'Preview'}
            </button>
            <button
              onClick={() => rebalance.mutate()}
              disabled={rebalance.isPending}
              className="skeuo-button-gold px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 disabled:opacity-40"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
              {rebalance.isPending ? <TxSpinner text="Analyzing & executing..." /> : 'Rebalance Now'}
            </button>
          </div>
        </div>

        {/* ── Rebalance Result Banner ── */}
        {rebalance.data && (
          <div className="skeuo-panel p-4 animate-fade-up" style={{ borderColor: 'rgba(0,192,135,0.2)' }}>
            <div className="flex items-start gap-3">
              <div className="led-green mt-1" />
              <div className="space-y-1 flex-1">
                <div className="text-xs font-bold uppercase tracking-wider" style={{ color: '#00C087' }}>
                  AI Decision
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {(rebalance.data as Record<string, unknown>).reasoning as string}
                </p>
                {((rebalance.data as Record<string, unknown>).actions as Array<Record<string, unknown>>)?.map((a, i) => (
                  a.txHash ? (
                    <div key={i} className="skeuo-inset px-3 py-2 mt-2 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {String(a.type).toUpperCase()} {String(a.asset)} &rarr; {String(a.protocol)}
                      </span>
                      <a
                        href={`https://bscscan.com/tx/${a.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-mono text-gold-glow hover:underline"
                      >
                        {String(a.txHash).slice(0, 10)}...
                      </a>
                    </div>
                  ) : a.summary ? (
                    <div key={i} className="text-[10px] text-muted-foreground mt-1">
                      {String(a.summary)}
                    </div>
                  ) : null
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Preview Panel ── */}
        {previewData && (
          <div className="skeuo-panel p-5 animate-fade-up space-y-4" style={{ borderColor: 'rgba(245,158,11,0.15)' }}>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.1)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gold-glow">AI Preview</h3>
                  <p className="text-[10px] text-muted-foreground">Dry run &mdash; no transactions executed</p>
                </div>
              </div>
              <button
                onClick={() => setPreviewData(null)}
                className="skeuo-button-dark w-7 h-7 flex items-center justify-center"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="skeuo-divider" />

            {/* AI Reasoning — parsed into steps */}
            <div className="skeuo-inset p-4 space-y-3">
              <div className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" />
                </svg>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#8B5CF6' }}>AI Reasoning</span>
              </div>
              {(() => {
                const text = previewData.reasoning || '';
                const stepRegex = /STEP\s*(\d+)\s*[\u2014—-]*\s*\(?([^):]+)\)?:\s*/gi;
                const parts: { step: number; label: string; body: string }[] = [];
                let m;
                const matches: { index: number; step: number; label: string; len: number }[] = [];
                while ((m = stepRegex.exec(text)) !== null) {
                  matches.push({ index: m.index, step: parseInt(m[1]), label: m[2], len: m[0].length });
                }
                if (matches.length === 0) {
                  return <p className="text-[11px] text-muted-foreground leading-relaxed">{text}</p>;
                }
                for (let i = 0; i < matches.length; i++) {
                  const start = matches[i].index + matches[i].len;
                  const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
                  parts.push({ step: matches[i].step, label: matches[i].label, body: text.slice(start, end).trim() });
                }
                const preamble = text.slice(0, matches[0].index).trim();
                const stepColors: Record<string, string> = {
                  opportunities: '#F59E0B', execution: '#10B981', review: '#3B82F6',
                  risk: '#F59E0B', trend: '#3B82F6', construction: '#8B5CF6',
                  special: '#F43F5E',
                };
                return (
                  <div className="space-y-2.5">
                    {preamble && <p className="text-[11px] text-muted-foreground leading-relaxed">{preamble}</p>}
                    {parts.map((p) => {
                      const color = stepColors[p.label.toLowerCase().split(',')[0].trim()] || '#71717a';
                      return (
                        <div key={p.step} className="flex gap-2.5">
                          <div className="flex flex-col items-center pt-0.5">
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                              style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
                            >
                              {p.step}
                            </div>
                            {p.step < parts.length && <div className="w-px flex-1 mt-1" style={{ background: `${color}20` }} />}
                          </div>
                          <div className="pb-1 min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>{p.label}</span>
                            <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{p.body}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Proposed Actions */}
            {previewData.actions?.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">
                  Proposed Actions ({previewData.actions.length})
                </span>
                {previewData.actions.map((a, i) => {
                  const actionType = String(a.type || '').toLowerCase();
                  const asset = String(a.asset || '');
                  const protocol = String(a.protocol || '');
                  const reason = String(a.reason || a.summary || '');
                  const isSupply = actionType === 'supply';
                  const isWithdraw = actionType === 'withdraw';
                  const actionColor = isSupply ? '#10B981' : isWithdraw ? '#F43F5E' : '#F59E0B';

                  return (
                    <div key={i} className="skeuo-inset p-3 space-y-2">
                      {/* Action header row */}
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: `${actionColor}15` }}>
                          {isSupply ? (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={actionColor} strokeWidth="2.5" strokeLinecap="round">
                              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
                            </svg>
                          ) : isWithdraw ? (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={actionColor} strokeWidth="2.5" strokeLinecap="round">
                              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                          ) : (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={actionColor} strokeWidth="2.5" strokeLinecap="round">
                              <circle cx="12" cy="12" r="10" /><line x1="8" y1="12" x2="16" y2="12" />
                            </svg>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: actionColor }}>
                            {actionType}
                          </span>
                          {a.amountPercent ? (
                            <span className="text-[10px] font-mono font-bold text-foreground">{String(a.amountPercent)}%</span>
                          ) : null}
                          {asset && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground">
                              {TOKEN_LOGOS[asset] && <img src={TOKEN_LOGOS[asset]} alt={asset} width={14} height={14} className="rounded-full" />}
                              {asset}
                            </span>
                          )}
                          {protocol && (
                            <>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground">
                                <polyline points="9 18 15 12 9 6" />
                              </svg>
                              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground capitalize">
                                {PROTOCOL_LOGOS[protocol] && <img src={PROTOCOL_LOGOS[protocol]} alt={protocol} width={12} height={12} className="rounded-full" />}
                                {protocol}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {/* Action reason — full text, wrapped */}
                      {reason && (
                        <p className="text-[10px] text-muted-foreground leading-relaxed pl-10">{reason}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Execute button */}
            <button
              onClick={() => { setPreviewData(null); rebalance.mutate(); }}
              disabled={rebalance.isPending}
              className="skeuo-button-gold w-full py-3 text-xs font-bold uppercase tracking-wider disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polygon points="5,3 19,12 5,21" />
              </svg>
              Execute This Plan
            </button>
          </div>
        )}

        {/* ── Combined Portfolio Panel ── */}
        <div className="skeuo-panel p-5 space-y-5 animate-fade-up-1">

          {/* Stats Row */}
          {(onchainPositions.isLoading && !onchainPositions.data) ? (
            <div className="grid grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeuo-inset p-4 space-y-3">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
              ))}
            </div>
          ) : (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Portfolio Value', value: totalValue, decimals: 2, color: 'text-emboss', bar: 'gold', barPct: Math.min((totalValue / 10000) * 100, 100), sub: `${positions.length} position${positions.length !== 1 ? 's' : ''}` },
              { label: 'Daily Yield', value: dailyYield, decimals: 4, prefix: '+', color: 'text-green-glow', bar: 'green', barPct: Math.min(avgApy * 10, 100), sub: `${avgApy.toFixed(2)}% APY avg` },
              { label: 'Total Earned', value: totalEarned, decimals: 4, prefix: '+', color: 'text-green-glow', bar: 'green', barPct: Math.min(totalEarned > 0 ? (totalEarned / Math.max(totalDeposited, 1)) * 100 : 0, 100), sub: totalDeposited > 0 ? `on $${totalDeposited.toFixed(2)} deposited` : 'no deposits yet' },
            ].map((s) => (
              <div key={s.label} className="skeuo-inset p-4 flex flex-col justify-between" style={{ minHeight: 100 }}>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{s.label}</span>
                <AnimatedNumber value={s.value} format="currency" decimals={s.decimals} prefix={s.prefix || ''} className={`font-mono text-xl font-bold ${s.color} block`} />
                <div className="space-y-1.5">
                  <div className="gauge-track">
                    <div className={s.bar === 'gold' ? 'gauge-fill-gold' : 'gauge-fill-green'} style={{ width: `${s.barPct}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{s.sub}</span>
                </div>
              </div>
            ))}
          </div>
          )}

          {/* Agent Wallet Balances */}
          {agentWallet && agentBalances.isLoading && !agentBalances.data && (
            <>
              <div className="skeuo-divider" />
              <div className="space-y-3">
                <Skeleton className="h-4 w-32" />
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="skeuo-inset p-3 flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-2.5 w-24" />
                    </div>
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            </>
          )}
          {agentWallet && balances.length > 0 && (
            <>
              <div className="skeuo-divider" />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="led-gold" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emboss">Wallet Balances</h3>
                  </div>
                  <span className="font-mono text-xs text-gold-glow font-bold">
                    ${totalBalanceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Tokens with balance — prominent rows */}
                {nonZeroBalances.length > 0 ? (
                  <div className="space-y-2">
                    {nonZeroBalances.map((b) => {
                      const price = PRICES[b.symbol] || 0;
                      const usdVal = b.formatted * price;
                      const logo = TOKEN_LOGOS[b.symbol];
                      const pct = totalBalanceUsd > 0 ? (usdVal / totalBalanceUsd) * 100 : 0;
                      return (
                        <div key={b.symbol} className="skeuo-inset p-3 flex items-center gap-3">
                          <div className="relative shrink-0">
                            {logo && <img src={logo} alt={b.symbol} width={32} height={32} className="rounded-full" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-foreground">{b.symbol}</span>
                              <span className="font-mono text-sm font-bold text-foreground">
                                {b.formatted < 0.001 ? '<0.001' : b.formatted < 1 ? b.formatted.toFixed(4) : b.formatted.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <div className="gauge-track flex-1 mr-3 h-[3px]">
                                <div className="gauge-fill-gold h-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                              </div>
                              <span className="text-[10px] font-mono text-gold-glow shrink-0">
                                ${usdVal < 1 ? usdVal.toFixed(4) : usdVal.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="skeuo-inset p-6 text-center space-y-2">
                    <p className="text-xs text-muted-foreground">No funds in agent wallet yet.</p>
                    <p className="text-[10px] text-muted-foreground">Deposit tokens to get started.</p>
                  </div>
                )}

                {/* Zero-balance tokens — compact inline badges */}
                {balances.filter(b => b.formatted === 0).length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Empty:</span>
                    {balances.filter(b => b.formatted === 0).map((b) => {
                      const logo = TOKEN_LOGOS[b.symbol];
                      return (
                        <span key={b.symbol} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/40">
                          {logo && <img src={logo} alt={b.symbol} width={12} height={12} className="rounded-full opacity-40" />}
                          {b.symbol}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Active Positions */}
          <div className="skeuo-divider" />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={positions.length > 0 ? 'led-green' : 'led-gold'} />
                <h3 className="text-xs font-bold uppercase tracking-wider text-emboss">Active Positions</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground font-mono">
                  {positions.length} position{positions.length !== 1 ? 's' : ''} &middot;
                  ${totalPositionValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {positions.length > 0 && (
                  <button
                    onClick={() => windDown.mutate(undefined, {
                      onSuccess: (data: { results: Array<{ protocol: string; asset: string; txHash: string; amount: string }> }) => {
                        toast.success(`Wound down ${data.results.length} position${data.results.length !== 1 ? 's' : ''}`);
                        if (data.results.length > 0) setWindDownResults(data.results);
                      },
                      onError: (err: Error) => { toast.error(`Wind down failed: ${err.message}`); },
                    })}
                    disabled={windDown.isPending || withdraw.isPending}
                    className="skeuo-action-btn px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider disabled:opacity-40 flex items-center gap-1.5"
                    style={{
                      background: 'linear-gradient(180deg, #3a1c1c 0%, #1a0a0a 100%)',
                      border: '1px solid rgba(255,68,68,0.3)',
                      color: '#ff6b6b',
                      boxShadow: '0 2px 8px rgba(255,68,68,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
                    }}
                  >
                    {windDown.isPending ? (
                      <TxSpinner className="text-[10px]" />
                    ) : (
                      <>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                        Wind Down All
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {positions.length > 0 ? (
              <div className="space-y-2">
                {positions.map((p, i) => (
                  <div key={i} className="skeuo-inset p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {TOKEN_LOGOS[p.asset] ? (
                        <img src={TOKEN_LOGOS[p.asset]} alt={p.asset} width={24} height={24} className="rounded-full shrink-0" />
                      ) : (
                        <div className="led-green" />
                      )}
                      <div>
                        <div className="text-xs font-semibold">{p.asset}</div>
                        <div className="text-[10px] text-muted-foreground capitalize flex items-center gap-1">
                          {PROTOCOL_LOGOS[p.protocol] && (
                            <img src={PROTOCOL_LOGOS[p.protocol]} alt={p.protocol} width={12} height={12} className="rounded-full" />
                          )}
                          {p.protocol}
                        </div>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-mono font-bold">{p.formatted.toFixed(4)}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        ${p.valueUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-green-glow">{p.apy.toFixed(2)}% APY</div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        +${(p.valueUsd * p.apy / 100 / 365).toFixed(4)}/day
                      </div>
                    </div>
                    <button
                      onClick={() => withdraw.mutate({ protocol: p.protocol, asset: p.asset }, {
                        onSuccess: (data: Record<string, string>) => { toast.success(`Withdrew ${p.asset} from ${p.protocol}`); setTxPopup({ type: 'Withdraw', txHash: data.txHash, asset: p.asset, protocol: p.protocol }); },
                        onError: (err: Error) => { toast.error(`Withdraw failed: ${err.message}`); setTxPopup({ type: 'Withdraw Failed', txHash: '', asset: p.asset, protocol: err.message }); },
                      })}
                      disabled={withdraw.isPending}
                      className="skeuo-action-btn px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider disabled:opacity-40"
                      style={{
                        background: 'linear-gradient(180deg, #3a1c1c 0%, #1a0a0a 100%)',
                        border: '1px solid rgba(255,68,68,0.3)',
                        color: '#ff6b6b',
                        boxShadow: '0 2px 8px rgba(255,68,68,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
                      }}
                    >
                      {withdraw.isPending ? (
                        <TxSpinner className="text-[10px]" />
                      ) : 'Withdraw'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="skeuo-inset p-6 text-center space-y-2">
                <p className="text-xs text-muted-foreground">No active positions detected on-chain.</p>
                <p className="text-[10px] text-muted-foreground">
                  Deposit funds and click &quot;Rebalance Now&quot; to let the AI deploy your funds.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Analytics Panel ── */}
        <div className="animate-fade-up-1">
          <AnalyticsPanel
            userId={userId}
            positions={positions.map(p => ({ protocol: p.protocol, asset: p.asset, valueUsd: p.valueUsd }))}
            idleBalances={balances.map(b => ({ symbol: b.symbol, formatted: b.formatted, usdValue: b.formatted * (PRICES[b.symbol] || 0) }))}
            currentTotalValue={totalValue}
            currentDailyYield={dailyYield}
          />
        </div>

        {/* ── Agent Activity (full width, bigger) ── */}
        <div className="animate-fade-up-2">
          <ActivityLog activities={wsMessages} />
        </div>

        {/* ── Yield Opportunities (full width) ── */}
        <div className="animate-fade-up-3">
          <YieldsTable yields={yields.data?.yields || []} trends={trends.data?.trends || []} isLoading={yields.isLoading} />
        </div>

        {/* ── Footer ── */}
        <footer className="animate-fade-up-4 py-6">
          <div className="skeuo-divider mb-4" />
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 flex items-center justify-center"
                   style={{ background: 'linear-gradient(135deg, #FFD54F 0%, #F0B90B 100%)' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0c0c0f" strokeWidth="3" strokeLinecap="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                </svg>
              </div>
              <span className="text-[10px] text-muted-foreground">
                Nectar<span className="text-gold-glow font-bold">Fi</span> — AI-Powered DeFi Yield Optimizer
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-muted-foreground">Built by</span>
              <a
                href="https://x.com/Magicianafk"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] font-bold text-gold-glow hover:underline transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                @Magicianafk
              </a>
            </div>
          </div>
        </footer>
      </div>

      {/* ── Rebalance Loading Overlay with Live Feed ── */}
      {rebalance.isPending && (() => {
        const REBALANCE_EVENTS = ['rebalance_started', 'ai_decision', 'executing_action', 'auto_wrap', 'action_completed', 'action_failed', 'rebalance_completed'];
        const liveEvents = wsMessages.filter(m => REBALANCE_EVENTS.includes(m.event)).slice(0, 8);
        const eventSvgs: Record<string, { color: string; path: string }> = {
          rebalance_started: { color: '#F59E0B', path: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9v.01' },
          ai_decision: { color: '#8B5CF6', path: 'M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z' },
          executing_action: { color: '#3B82F6', path: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z' },
          auto_wrap: { color: '#F59E0B', path: 'M23 4l-6 6M17 4h6v6M1 20l6-6M7 20H1v-6' },
          action_completed: { color: '#10B981', path: 'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3' },
          action_failed: { color: '#F43F5E', path: 'M12 2a10 10 0 100 20 10 10 0 000-20zM15 9l-6 6M9 9l6 6' },
          rebalance_completed: { color: '#10B981', path: 'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3' },
        };
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40">
            <div className="skeuo-panel p-6 flex flex-col gap-4 max-w-md w-full mx-4">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-full border-2 border-gold-glow/30 flex items-center justify-center">
                    <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="#F0B90B" strokeWidth="2" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gold-glow">AI Rebalancing</h3>
                  <p className="text-[10px] text-muted-foreground">Executing strategy in real-time</p>
                </div>
              </div>

              <div className="skeuo-divider" />

              {/* Live event feed */}
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {liveEvents.length === 0 && (
                  <div className="flex items-center gap-2.5 px-2 py-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-[11px] text-muted-foreground animate-pulse">Analyzing portfolio...</span>
                  </div>
                )}
                {liveEvents.map((ev, i) => {
                  const info = eventSvgs[ev.event] || { color: '#71717a', path: 'M12 12h.01' };
                  const title = String((ev.data as Record<string, unknown>)?.title || ev.event);
                  const desc = String((ev.data as Record<string, unknown>)?.description || '');
                  const isLatest = i === 0;
                  return (
                    <div
                      key={`${ev.event}-${ev.timestamp}`}
                      className={`flex items-start gap-2.5 px-2.5 py-2 rounded-lg transition-all ${isLatest ? 'skeuo-inset' : 'opacity-40'}`}
                    >
                      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${info.color}15` }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={info.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d={info.path} />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[11px] font-semibold" style={{ color: info.color }}>{title}</p>
                          {isLatest && <div className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ background: info.color }} />}
                        </div>
                        {desc && <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2 mt-0.5">{desc}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Wind Down Loading Overlay with Live Feed ── */}
      {windDown.isPending && (() => {
        const WD_EVENTS = ['wind_down_started', 'position_withdrawn', 'wind_down_complete'];
        const liveWd = wsMessages.filter(m => WD_EVENTS.includes(m.event)).slice(0, 10);
        const wdSvgs: Record<string, { color: string; path: string }> = {
          wind_down_started: { color: '#F59E0B', path: 'M18 6L6 18M6 6l12 12' },
          position_withdrawn: { color: '#10B981', path: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3' },
          wind_down_complete: { color: '#10B981', path: 'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3' },
        };
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40">
            <div className="skeuo-panel p-6 flex flex-col gap-4 max-w-md w-full mx-4">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-full border-2 flex items-center justify-center" style={{ borderColor: 'rgba(255,107,107,0.3)' }}>
                    <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="#ff6b6b" strokeWidth="2" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#ff6b6b' }}>Winding Down</h3>
                  <p className="text-[10px] text-muted-foreground">Withdrawing positions to agent wallet</p>
                </div>
              </div>

              <div className="skeuo-divider" />

              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {liveWd.length === 0 && (
                  <div className="flex items-center gap-2.5 px-2 py-1">
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#ff6b6b' }} />
                    <span className="text-[11px] text-muted-foreground animate-pulse">Starting withdrawal...</span>
                  </div>
                )}
                {liveWd.map((ev, i) => {
                  const info = wdSvgs[ev.event] || { color: '#71717a', path: 'M12 12h.01' };
                  const title = String((ev.data as Record<string, unknown>)?.title || ev.event);
                  const desc = String((ev.data as Record<string, unknown>)?.description || '');
                  const isLatest = i === 0;
                  return (
                    <div
                      key={`${ev.event}-${ev.timestamp}`}
                      className={`flex items-start gap-2.5 px-2.5 py-2 rounded-lg transition-all ${isLatest ? 'skeuo-inset' : 'opacity-40'}`}
                    >
                      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${info.color}15` }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={info.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d={info.path} />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[11px] font-semibold" style={{ color: info.color }}>{title}</p>
                          {isLatest && <div className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ background: info.color }} />}
                        </div>
                        {desc && <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2 mt-0.5">{desc}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Deposit Modal ── */}
      {showDeposit && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowDeposit(false)}
        >
          <div
            className="max-w-sm w-full relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowDeposit(false)}
              className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center skeuo-button-dark text-muted-foreground hover:text-foreground z-10"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <DepositPanel
              agentWallet={agentWallet}
              userId={userId}
              onTxSuccess={(txHash, asset) => {
                setShowDeposit(false);
                toast.success(`${asset} deposit confirmed`);
                setTxPopup({ type: 'Deposit', txHash, asset });
                refreshBalances();
              }}
            />
          </div>
        </div>
      )}

      {/* ── Withdraw to EOA Modal ── */}
      {showWithdrawToEoa && (() => {
        const selectedBalance = nonZeroBalances.find(b => b.symbol === withdrawSelected);
        const selectedPrice = selectedBalance ? (PRICES[selectedBalance.symbol] || 0) : 0;
        const amountNum = parseFloat(withdrawAmount) || 0;
        const amountUsd = amountNum * selectedPrice;
        const isOverMax = selectedBalance ? amountNum > selectedBalance.formatted : false;
        const closeWithdraw = () => { setShowWithdrawToEoa(false); setWithdrawSelected(null); setWithdrawAmount(''); };
        const handleWithdrawMax = () => {
          if (!selectedBalance) return;
          setWithdrawAmount(String(selectedBalance.formatted));
        };
        const hasWdBalance = selectedBalance && selectedBalance.formatted > 0;

        return (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={closeWithdraw}
          >
            <div className="max-w-sm w-full relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={closeWithdraw}
                className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center skeuo-button-dark text-muted-foreground hover:text-foreground z-10"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>

              <div className="skeuo-panel p-5 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="led-gold" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-emboss">Withdraw</h3>
                  </div>
                  <span className="skeuo-tag text-[10px]">BSC</span>
                </div>

                <div className="skeuo-divider" />

                {/* Agent Wallet Balances */}
                <div className="space-y-2">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Agent Wallet</label>
                  <div className="skeuo-inset p-3 space-y-1.5">
                    {nonZeroBalances.length > 0 ? nonZeroBalances.map((b) => {
                      const price = PRICES[b.symbol] || 0;
                      const usdVal = b.formatted * price;
                      const logo = TOKEN_LOGOS[b.symbol];
                      return (
                        <div key={b.symbol} className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1.5">
                            {logo && <img src={logo} alt={b.symbol} width={14} height={14} className="rounded-full" />}
                            {b.symbol}
                          </span>
                          <span className="text-[11px] font-mono font-semibold text-foreground">
                            {b.formatted < 0.0001 ? '<0.0001' : b.formatted < 1 ? b.formatted.toFixed(4) : b.formatted.toFixed(2)}
                            {usdVal > 0.01 && <span className="text-muted-foreground ml-2">(${usdVal < 1 ? usdVal.toFixed(4) : usdVal.toFixed(2)})</span>}
                          </span>
                        </div>
                      );
                    }) : (
                      <div className="flex items-center gap-2">
                        <div className="led-red" style={{ width: 5, height: 5 }} />
                        <span className="text-[10px] text-muted-foreground">No funds in agent wallet</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Destination */}
                <div className="space-y-2">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">To Wallet</label>
                  <div className="skeuo-inset px-3 py-2.5 flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-muted-foreground truncate">
                      {eoaShort || 'Not connected'}
                    </span>
                    <span className="text-[10px] shrink-0 font-semibold uppercase tracking-wider text-gold-glow">EOA</span>
                  </div>
                </div>

                {/* Token Selector */}
                <div className="space-y-2">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Token</label>
                  <div className={`grid gap-2 ${nonZeroBalances.length > 3 ? 'grid-cols-4' : nonZeroBalances.length === 3 ? 'grid-cols-3' : nonZeroBalances.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {nonZeroBalances.length > 0 ? nonZeroBalances.map((b) => {
                      const isActive = withdrawSelected === b.symbol;
                      const logo = TOKEN_LOGOS[b.symbol];
                      return (
                        <button
                          key={b.symbol}
                          onClick={() => { setWithdrawSelected(b.symbol); setWithdrawAmount(''); }}
                          className={`py-2 text-xs font-bold transition-all ${isActive ? 'skeuo-button-gold' : 'skeuo-button-dark'}`}
                        >
                          <span className="flex items-center justify-center gap-1.5">
                            {logo && <img src={logo} alt={b.symbol} width={16} height={16} className="rounded-full" />}
                            {b.symbol}
                          </span>
                          <span className={`block text-[9px] font-normal mt-0.5 ${isActive ? 'opacity-70' : 'text-muted-foreground'}`}>
                            {b.formatted < 0.01 ? '<0.01' : b.formatted < 1 ? b.formatted.toFixed(4) : b.formatted.toFixed(2)}
                          </span>
                        </button>
                      );
                    }) : (
                      <div className="col-span-3 py-2 text-center">
                        <span className="text-[10px] text-muted-foreground">No tokens to withdraw</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Amount Input */}
                {withdrawSelected && selectedBalance && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Amount</label>
                      {hasWdBalance && (
                        <button
                          onClick={handleWithdrawMax}
                          className="text-[10px] font-semibold text-gold-glow uppercase tracking-wider hover:brightness-125 transition-all"
                        >
                          Max
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      step="any"
                      min="0"
                      className="skeuo-input w-full px-3 py-2.5 text-sm font-mono placeholder:text-muted-foreground/50"
                    />
                    {/* Quick amounts */}
                    <div className="flex gap-1.5">
                      {['25', '50', '75', '100'].map((pct) => (
                        <button
                          key={pct}
                          onClick={() => setWithdrawAmount(String(selectedBalance.formatted * parseInt(pct) / 100))}
                          className="flex-1 py-1 text-[10px] font-semibold skeuo-button-dark"
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                    {/* USD conversion / error */}
                    {amountNum > 0 && (
                      <div className="px-1">
                        {isOverMax ? (
                          <span className="text-[10px] font-mono" style={{ color: '#FF8A9E' }}>Exceeds available balance</span>
                        ) : selectedPrice > 0 ? (
                          <span className="text-[10px] font-mono text-muted-foreground">
                            ~${amountUsd < 1 ? amountUsd.toFixed(4) : amountUsd.toFixed(2)} USD
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}

                {/* Send Button */}
                <button
                  onClick={() => {
                    if (!user?.wallet?.address || !withdrawSelected) return;
                    const amt = withdrawAmount && parseFloat(withdrawAmount) > 0 ? withdrawAmount : undefined;
                    transferToEoa.mutate(
                      { symbol: withdrawSelected, toAddress: user.wallet.address, amount: amt },
                      {
                        onSuccess: (data: Record<string, string>) => {
                          closeWithdraw();
                          toast.success(`${withdrawSelected} withdrawn to wallet`);
                          setTxPopup({ type: 'Transfer to EOA', txHash: data.txHash, asset: withdrawSelected });
                        },
                        onError: (err: Error) => {
                          closeWithdraw();
                          toast.error(`Transfer failed: ${err.message}`);
                          setTxPopup({ type: 'Transfer Failed', txHash: '', asset: withdrawSelected, protocol: err.message });
                        },
                      }
                    );
                  }}
                  disabled={!withdrawSelected || transferToEoa.isPending || isOverMax}
                  className="skeuo-button-gold w-full py-3 text-sm font-bold tracking-wide disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {transferToEoa.isPending ? (
                    <TxSpinner />
                  ) : withdrawSelected ? (
                    withdrawAmount && amountNum > 0
                      ? `Withdraw ${amountNum < 1 ? amountNum.toFixed(4) : amountNum.toFixed(2)} ${withdrawSelected}`
                      : `Withdraw All ${withdrawSelected}`
                  ) : 'Select Token'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Transaction Result Popup ── */}
      {txPopup && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setTxPopup(null)}
        >
          <div
            className="skeuo-panel p-6 max-w-sm w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className={txPopup.txHash ? 'led-green' : 'led-red'} />
              <h3 className="text-sm font-bold uppercase tracking-wider text-emboss">
                {txPopup.type} {txPopup.txHash ? 'Successful' : 'Error'}
              </h3>
            </div>

            <div className="skeuo-divider" />

            {txPopup.asset && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Asset</span>
                <span className="text-xs font-bold">{txPopup.asset}{txPopup.protocol ? ` on ${txPopup.protocol}` : ''}</span>
              </div>
            )}

            {txPopup.txHash ? (
              <div className="space-y-2">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Transaction Hash</span>
                <div className="skeuo-inset px-3 py-3">
                  <a
                    href={`https://bscscan.com/tx/${txPopup.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-gold-glow hover:underline break-all"
                  >
                    {txPopup.txHash}
                  </a>
                </div>
                <a
                  href={`https://bscscan.com/tx/${txPopup.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="skeuo-button-gold w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  View on BscScan
                </a>
              </div>
            ) : (
              <div className="skeuo-inset p-3 flex items-center gap-2">
                <div className="led-red" />
                <p className="text-xs" style={{ color: '#FF8A9E' }}>{txPopup.protocol || 'Transaction failed'}</p>
              </div>
            )}

            <button
              onClick={() => setTxPopup(null)}
              className="skeuo-button-dark w-full py-2.5 text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Wind Down Results Popup ── */}
      {windDownResults && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setWindDownResults(null)}
        >
          <div
            className="skeuo-panel p-6 max-w-sm w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="led-green" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-emboss">
                Wind Down Complete
              </h3>
            </div>

            <div className="skeuo-divider" />

            <p className="text-xs text-muted-foreground">
              {windDownResults.length} position{windDownResults.length !== 1 ? 's' : ''} withdrawn successfully
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {windDownResults.map((r, i) => (
                <div key={i} className="skeuo-inset px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      {TOKEN_LOGOS[r.asset] && (
                        <img src={TOKEN_LOGOS[r.asset]} alt={r.asset} width={14} height={14} className="rounded-full" />
                      )}
                      {r.amount} {r.asset}
                    </span>
                    <span className="text-[10px] text-muted-foreground capitalize flex items-center gap-1">
                      {PROTOCOL_LOGOS[r.protocol] && (
                        <img src={PROTOCOL_LOGOS[r.protocol]} alt={r.protocol} width={12} height={12} className="rounded-full" />
                      )}
                      {r.protocol}
                    </span>
                  </div>
                  <a
                    href={`https://bscscan.com/tx/${r.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[10px] text-gold-glow hover:underline flex items-center gap-1"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    {r.txHash.slice(0, 16)}...{r.txHash.slice(-8)}
                  </a>
                </div>
              ))}
            </div>

            <button
              onClick={() => setWindDownResults(null)}
              className="skeuo-button-dark w-full py-2.5 text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Swap Modal ── */}
      {showSwap && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowSwap(false)}
        >
          <div className="max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <SwapPanel
              prices={PRICES}
              balances={balances.map(b => ({ symbol: b.symbol, formatted: b.formatted }))}
              isPending={swap.isPending}
              onSwap={(tokenIn, tokenOut, amount) => {
                swap.mutate({ tokenIn, tokenOut, amount }, {
                  onSuccess: (data: Record<string, string>) => {
                    setShowSwap(false);
                    toast.success(`Swapped ${amount} ${tokenIn} for ${tokenOut}`);
                    setTxPopup({ type: 'Swap', txHash: data.txHash, asset: `${tokenIn} → ${tokenOut}` });
                  },
                  onError: (err: Error) => {
                    toast.error(`Swap failed: ${err.message}`);
                  },
                });
              }}
              onClose={() => setShowSwap(false)}
            />
          </div>
        </div>
      )}

      {/* ── Export Wallet Modal ── */}
      {showExport && walletInfo && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => { setShowExport(false); setWalletInfo(null); }}
        >
          <div
            className="skeuo-panel p-6 max-w-md w-full space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <div className="led-red" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-emboss">Export Wallet</h3>
            </div>

            <div className="skeuo-divider" />

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Address</label>
                <div className="skeuo-inset px-3 py-2.5 flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-muted-foreground truncate">{walletInfo.walletAddress}</span>
                  <button
                    onClick={() => handleCopy(walletInfo.walletAddress, 'addr')}
                    className="text-[10px] font-semibold text-gold-glow uppercase tracking-wider shrink-0"
                  >
                    {copied === 'addr' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Private Key</label>
                <div className="skeuo-inset px-3 py-2.5"
                     style={{ borderColor: 'rgba(255,68,102,0.2)', boxShadow: 'inset 0 2px 8px rgba(255,68,102,0.05), inset 0 2px 8px rgba(0,0,0,0.6)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs break-all" style={{ color: '#FF8A9E' }}>
                      {walletInfo.privateKey}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleCopy(walletInfo.privateKey, 'pk')}
                  className="w-full skeuo-button-dark py-2 text-xs font-semibold flex items-center justify-center gap-1.5"
                  style={{ borderColor: 'rgba(255,68,102,0.15)' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                  {copied === 'pk' ? 'Copied to Clipboard!' : 'Copy Private Key'}
                </button>
              </div>

              <div className="skeuo-inset p-3 flex items-start gap-2">
                <div className="led-red mt-0.5" />
                <p className="text-[10px] leading-relaxed" style={{ color: '#FF8A9E' }}>
                  Never share your private key. Anyone with this key has full control of this wallet and all its funds.
                </p>
              </div>
            </div>

            <button
              onClick={() => { setShowExport(false); setWalletInfo(null); }}
              className="skeuo-button-dark w-full py-2.5 text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
