'use client';

import { TOKEN_LOGOS, PROTOCOL_LOGOS } from '@/lib/logos';
import { Skeleton } from '@/components/ui/skeleton';

interface YieldOpp {
  protocol: string;
  asset: string;
  supplyApy: number;
  tvlUsd: number;
  score: number;
}

interface TrendData {
  protocol: string;
  asset: string;
  trend: string;
  volatility: number;
}

const PROTOCOL_COLORS: Record<string, string> = {
  venus: '#F0B90B',
  aave: '#B6509E',
  lista: '#00C087',
};

function TrendArrow({ trend }: { trend?: string }) {
  if (!trend) return <span className="text-muted-foreground/40">&mdash;</span>;
  switch (trend) {
    case 'rising':
      return (
        <span className="inline-flex items-center gap-1 text-[#00C087]">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
          <span className="text-[9px] font-semibold uppercase">Rising</span>
        </span>
      );
    case 'falling':
      return (
        <span className="inline-flex items-center gap-1 text-[#FF6B6B]">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <span className="text-[9px] font-semibold uppercase">Falling</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 text-muted-foreground/60">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span className="text-[9px] font-semibold uppercase">Stable</span>
        </span>
      );
  }
}

export function YieldsTable({ yields, trends, isLoading }: { yields: YieldOpp[]; trends?: TrendData[]; isLoading?: boolean }) {
  const sorted = [...yields].sort((a, b) => b.score - a.score);

  const trendMap = new Map<string, TrendData>();
  if (trends) {
    for (const t of trends) {
      trendMap.set(`${t.protocol}-${t.asset}`, t);
    }
  }

  return (
    <div className="skeuo-panel p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="led-green" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-emboss">Yield Opportunities</h3>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">{yields.length} pools</span>
      </div>

      <div className="skeuo-divider" />

      <div className="skeuo-inset p-1 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="text-left py-2 px-3 font-semibold uppercase tracking-wider text-[10px]">Asset</th>
              <th className="text-left py-2 px-2 font-semibold uppercase tracking-wider text-[10px]">Protocol</th>
              <th className="text-right py-2 px-2 font-semibold uppercase tracking-wider text-[10px]">APY</th>
              <th className="text-center py-2 px-2 font-semibold uppercase tracking-wider text-[10px] hidden sm:table-cell">Trend</th>
              <th className="text-right py-2 px-2 font-semibold uppercase tracking-wider text-[10px] hidden sm:table-cell">TVL</th>
              <th className="text-right py-2 px-3 font-semibold uppercase tracking-wider text-[10px]">Score</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((y, i) => {
              const color = PROTOCOL_COLORS[y.protocol] || '#888';
              const trendData = trendMap.get(`${y.protocol}-${y.asset}`);
              return (
                <tr
                  key={`${y.protocol}-${y.asset}`}
                  className={`transition-colors hover:bg-white/[0.02] ${i !== sorted.length - 1 ? 'border-b border-white/[0.03]' : ''}`}
                >
                  <td className="py-2.5 px-3">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      {TOKEN_LOGOS[y.asset] && (
                        <img src={TOKEN_LOGOS[y.asset]} alt={y.asset} width={16} height={16} className="rounded-full" />
                      )}
                      {y.asset}
                    </span>
                  </td>
                  <td className="py-2.5 px-2">
                    <span
                      className="skeuo-tag text-[9px] inline-flex items-center gap-1"
                      style={{ borderColor: `${color}33`, color }}
                    >
                      {PROTOCOL_LOGOS[y.protocol] && (
                        <img src={PROTOCOL_LOGOS[y.protocol]} alt={y.protocol} width={12} height={12} className="rounded-full" />
                      )}
                      {y.protocol}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <span className="font-mono font-bold text-green-glow">{y.supplyApy.toFixed(2)}%</span>
                  </td>
                  <td className="py-2.5 px-2 text-center hidden sm:table-cell">
                    <TrendArrow trend={trendData?.trend} />
                  </td>
                  <td className="py-2.5 px-2 text-right hidden sm:table-cell">
                    <span className="font-mono text-muted-foreground">${(y.tvlUsd / 1e6).toFixed(1)}M</span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-12 gauge-track h-[4px] hidden sm:block">
                        <div className="gauge-fill-gold h-full" style={{ width: `${Math.min(y.score, 100)}%` }} />
                      </div>
                      <span className="font-mono font-bold text-gold-glow w-6 text-right">{y.score.toFixed(0)}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {isLoading && yields.length === 0 && (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-white/[0.03]">
                  <td className="py-2.5 px-3"><Skeleton className="h-4 w-16" /></td>
                  <td className="py-2.5 px-2"><Skeleton className="h-5 w-14" /></td>
                  <td className="py-2.5 px-2 text-right"><Skeleton className="h-4 w-12 ml-auto" /></td>
                  <td className="py-2.5 px-2 text-center hidden sm:table-cell"><Skeleton className="h-4 w-12 mx-auto" /></td>
                  <td className="py-2.5 px-2 text-right hidden sm:table-cell"><Skeleton className="h-4 w-14 ml-auto" /></td>
                  <td className="py-2.5 px-3 text-right"><Skeleton className="h-4 w-8 ml-auto" /></td>
                </tr>
              ))
            )}
            {!isLoading && yields.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground text-xs">
                  <div className="flex flex-col items-center gap-2">
                    <div className="led-gold animate-pulse-gold" />
                    <span>Scanning yield opportunities...</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
