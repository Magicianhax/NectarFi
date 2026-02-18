'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  AreaChart, Area, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

const COLORS = ['#F0B90B', '#00C087', '#B6509E', '#3B82F6', '#FF6B6B', '#A78BFA'];

interface AnalyticsPanelProps {
  userId: string | null;
  positions: Array<{ protocol: string; asset: string; valueUsd: number }>;
  idleBalances: Array<{ symbol: string; formatted: number; usdValue: number }>;
  currentTotalValue?: number;
  currentDailyYield?: number;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="skeuo-panel px-3 py-2 text-[10px] space-y-1" style={{ minWidth: 120 }}>
      <div className="text-muted-foreground font-mono">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-mono font-bold" style={{ color: p.color }}>
            {typeof p.value === 'number' ? (p.name.includes('APY') ? `${p.value.toFixed(2)}%` : `$${p.value.toFixed(2)}`) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// Smart date formatting: use time for same-day data, date for multi-day
function formatChartDate(isoString: string, allDates: string[]): string {
  const d = new Date(isoString);
  // Check if all snapshots are from the same calendar day
  const daySet = new Set(allDates.map(ds => new Date(ds).toLocaleDateString()));
  if (daySet.size <= 1) {
    // Same day: show time
    return d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  if (daySet.size <= 3) {
    // 2-3 days: show date + time
    return d.toLocaleDateString('en', { month: 'short', day: 'numeric' }) + ' ' +
           d.toLocaleTimeString('en', { hour: 'numeric', hour12: true });
  }
  // Multi-day: just date
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

// Deduplicate snapshots: keep only 1 per hour (the latest in each hour)
function deduplicateByHour(snapshots: Array<{ recorded_at: string; total_value: number; daily_yield: number }>) {
  const byHour = new Map<string, typeof snapshots[0]>();
  for (const s of snapshots) {
    const d = new Date(s.recorded_at);
    const hourKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
    // Keep the latest snapshot per hour
    const existing = byHour.get(hourKey);
    if (!existing || new Date(s.recorded_at) > new Date(existing.recorded_at)) {
      byHour.set(hourKey, s);
    }
  }
  return Array.from(byHour.values()).sort((a, b) =>
    new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );
}

export function AnalyticsPanel({ userId, positions, idleBalances, currentTotalValue = 0, currentDailyYield = 0 }: AnalyticsPanelProps) {
  const [tab, setTab] = useState<'portfolio' | 'apy' | 'allocation'>('portfolio');

  const portfolioHistory = useQuery({
    queryKey: ['portfolioHistory', userId],
    queryFn: () => api.getPortfolioHistory(userId!, 30),
    enabled: !!userId && tab === 'portfolio',
  });

  const yieldHistory = useQuery({
    queryKey: ['yieldHistory'],
    queryFn: () => api.getYieldHistory(undefined, undefined, 14),
    enabled: tab === 'apy',
  });

  // Build allocation data from positions + idle balances
  const allocationData = [
    ...positions.map(p => ({
      name: `${p.asset} (${p.protocol})`,
      value: p.valueUsd,
    })),
    ...idleBalances
      .filter(b => b.usdValue > 0.01)
      .map(b => ({
        name: `${b.symbol} (idle)`,
        value: b.usdValue,
      })),
  ];
  const totalAlloc = allocationData.reduce((s, d) => s + d.value, 0);

  // Format portfolio chart data — deduplicate + smart date labels + append live value
  const rawSnapshots = (portfolioHistory.data as { snapshots?: Array<{ recorded_at: string; total_value: number; daily_yield: number }> })?.snapshots || [];
  const dedupedSnapshots = deduplicateByHour(rawSnapshots);
  const allDates = dedupedSnapshots.map(s => s.recorded_at);
  const portfolioData = dedupedSnapshots.map(s => ({
    date: formatChartDate(s.recorded_at, allDates),
    value: Math.round(s.total_value * 100) / 100,
    yield: Math.round(s.daily_yield * 10000) / 10000,
  }));

  // Append current live value as "Now" data point (if we have real data)
  if (currentTotalValue > 0) {
    const lastSnapshotValue = portfolioData.length > 0 ? portfolioData[portfolioData.length - 1].value : 0;
    // Only append if meaningfully different from last snapshot or if there are existing points
    if (portfolioData.length === 0 || Math.abs(currentTotalValue - lastSnapshotValue) > 0.01) {
      portfolioData.push({
        date: 'Now',
        value: Math.round(currentTotalValue * 100) / 100,
        yield: Math.round(currentDailyYield * 10000) / 10000,
      });
    }
  }

  // Format APY chart data: group by date, multi-line per protocol/asset
  const yieldSnapshots = (yieldHistory.data as { snapshots?: Array<{ recorded_at: string; protocol: string; asset: string; apy: number }> })?.snapshots || [];
  const yieldKeys = new Set<string>();
  const yieldByDate: Record<string, Record<string, number>> = {};
  for (const s of yieldSnapshots) {
    const date = new Date(s.recorded_at).toLocaleDateString('en', { month: 'short', day: 'numeric' });
    const key = `${s.protocol}/${s.asset}`;
    yieldKeys.add(key);
    if (!yieldByDate[date]) yieldByDate[date] = {};
    yieldByDate[date][key] = s.apy;
  }
  const apyData = Object.entries(yieldByDate).map(([date, vals]) => ({ date, ...vals }));
  const yieldKeyArr = Array.from(yieldKeys);

  const tabs = [
    { key: 'portfolio' as const, label: 'Portfolio' },
    { key: 'apy' as const, label: 'APY Trends' },
    { key: 'allocation' as const, label: 'Allocation' },
  ];

  return (
    <div className="skeuo-panel p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="led-gold" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-emboss">Analytics</h3>
        </div>
        <div className="flex gap-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
                tab === t.key ? 'skeuo-button-gold' : 'skeuo-button-dark text-muted-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="skeuo-divider" />

      <div className="skeuo-inset p-4" style={{ minHeight: 260 }}>
        {/* Portfolio Value Chart */}
        {tab === 'portfolio' && (
          portfolioData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={portfolioData}>
                <defs>
                  <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F0B90B" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#F0B90B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: '#7a7975', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: '#7a7975', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `$${v}`}
                  domain={[0, 'auto']}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="value" name="Value" stroke="#F0B90B" fill="url(#goldGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[240px] gap-3">
              {portfolioHistory.isLoading ? (
                <>
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-3 w-40" />
                </>
              ) : (
                <>
                  <div className="led-gold animate-pulse-gold" />
                  <span className="text-xs text-muted-foreground">Portfolio data will appear after snapshots are recorded</span>
                </>
              )}
            </div>
          )
        )}

        {/* APY Trends Chart */}
        {tab === 'apy' && (
          apyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={apyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: '#7a7975', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#7a7975', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <Tooltip content={<CustomTooltip />} />
                {yieldKeyArr.map((key, i) => (
                  <Line key={key} type="monotone" dataKey={key} name={`${key} APY`} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[240px] gap-3">
              {yieldHistory.isLoading ? (
                <>
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-3 w-40" />
                </>
              ) : (
                <>
                  <div className="led-gold animate-pulse-gold" />
                  <span className="text-xs text-muted-foreground">APY data will appear after yield snapshots are recorded</span>
                </>
              )}
            </div>
          )
        )}

        {/* Allocation Pie Chart */}
        {tab === 'allocation' && (
          allocationData.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={240}>
                <PieChart>
                  <Pie
                    data={allocationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {allocationData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {allocationData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-muted-foreground">{d.name}</span>
                    </div>
                    <div className="font-mono font-bold text-foreground">
                      ${d.value.toFixed(2)} <span className="text-muted-foreground font-normal">({totalAlloc > 0 ? ((d.value / totalAlloc) * 100).toFixed(1) : 0}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[240px] gap-3">
              <div className="led-gold animate-pulse-gold" />
              <span className="text-xs text-muted-foreground">No positions or balances to display</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
