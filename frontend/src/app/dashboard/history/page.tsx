'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { TOKEN_LOGOS, PROTOCOL_LOGOS } from '@/lib/logos';
import { Skeleton } from '@/components/ui/skeleton';
import { LoadingSplash } from '@/components/loading-splash';

const TX_TYPES = ['', 'supply', 'withdraw', 'swap', 'deposit', 'transfer_to_eoa'] as const;
const TX_TYPE_COLORS: Record<string, string> = {
  supply: '#00C087',
  withdraw: '#FF6B6B',
  swap: '#F0B90B',
  deposit: '#3B82F6',
  transfer_to_eoa: '#A78BFA',
  hold: '#7a7975',
};
const PAGE_SIZE = 20;

export default function HistoryPage() {
  const { ready, authenticated, user } = usePrivy();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [assetFilter, setAssetFilter] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (ready && !authenticated) router.push('/');
  }, [ready, authenticated, router]);

  useEffect(() => {
    if (user?.wallet?.address) {
      api.auth(user.wallet.address).then((d) => setUserId(d.userId));
    }
  }, [user]);

  const history = useQuery({
    queryKey: ['txHistory', userId, typeFilter, assetFilter, page],
    queryFn: () => api.getHistory(userId!, {
      type: typeFilter || undefined,
      asset: assetFilter || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    enabled: !!userId,
  });

  const transactions = (history.data as { transactions?: Array<Record<string, unknown>>; total?: number })?.transactions || [];
  const total = (history.data as { total?: number })?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (!ready) {
    return <LoadingSplash />;
  }

  const handleExportCsv = () => {
    if (!transactions.length) return;
    const headers = ['Date', 'Type', 'Asset', 'Amount', 'Protocol', 'Tx Hash'];
    const rows = transactions.map((tx) => [
      new Date(tx.created_at as string).toISOString(),
      tx.type,
      tx.asset,
      tx.amount,
      tx.to_protocol || tx.from_protocol || '',
      tx.tx_hash || '',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nectarfi-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-4">

        {/* Header */}
        <div className="skeuo-panel px-5 py-3 flex items-center justify-between animate-fade-up">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <button className="skeuo-button-dark px-3 py-1.5 text-xs flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Back
              </button>
            </Link>
            <div>
              <h1 className="text-sm font-bold uppercase tracking-wider text-emboss">Transaction History</h1>
              <span className="text-[10px] text-muted-foreground font-mono">{total} transactions</span>
            </div>
          </div>
          <button
            onClick={handleExportCsv}
            disabled={transactions.length === 0}
            className="skeuo-button-gold px-3 py-1.5 text-xs flex items-center gap-1.5 disabled:opacity-40"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 3v12M8 11l4 4 4-4" />
              <path d="M20 21H4" />
            </svg>
            Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="skeuo-panel px-5 py-3 flex items-center gap-3 flex-wrap animate-fade-up">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Filters</span>
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}
            className="skeuo-input px-3 py-1.5 text-xs font-mono bg-transparent"
          >
            <option value="">All Types</option>
            {TX_TYPES.filter(t => t).map(t => (
              <option key={t} value={t}>{t.replace('_', ' ')}</option>
            ))}
          </select>
          <input
            type="text"
            value={assetFilter}
            onChange={(e) => { setAssetFilter(e.target.value); setPage(0); }}
            placeholder="Filter by asset..."
            className="skeuo-input px-3 py-1.5 text-xs font-mono placeholder:text-muted-foreground/50"
          />
        </div>

        {/* Table */}
        <div className="skeuo-panel p-5 animate-fade-up-1">
          <div className="skeuo-inset p-1 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left py-2 px-3 font-semibold uppercase tracking-wider text-[10px]">Date</th>
                  <th className="text-left py-2 px-2 font-semibold uppercase tracking-wider text-[10px]">Type</th>
                  <th className="text-left py-2 px-2 font-semibold uppercase tracking-wider text-[10px]">Asset</th>
                  <th className="text-right py-2 px-2 font-semibold uppercase tracking-wider text-[10px]">Amount</th>
                  <th className="text-left py-2 px-2 font-semibold uppercase tracking-wider text-[10px] hidden sm:table-cell">Protocol</th>
                  <th className="text-right py-2 px-3 font-semibold uppercase tracking-wider text-[10px]">Tx Hash</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, i) => {
                  const type = String(tx.type || '');
                  const asset = String(tx.asset || '');
                  const protocol = String(tx.to_protocol || tx.from_protocol || '');
                  const color = TX_TYPE_COLORS[type] || '#7a7975';
                  const logo = TOKEN_LOGOS[asset.split('->')[0]];
                  const protocolLogo = PROTOCOL_LOGOS[protocol];
                  return (
                    <tr key={i} className={`transition-colors hover:bg-white/[0.02] ${i < transactions.length - 1 ? 'border-b border-white/[0.03]' : ''}`}>
                      <td className="py-2.5 px-3 font-mono text-muted-foreground">
                        {new Date(tx.created_at as string).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                        <span className="text-muted-foreground/60 ml-1.5">
                          {new Date(tx.created_at as string).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="py-2.5 px-2">
                        <span
                          className="skeuo-tag text-[9px] uppercase"
                          style={{ borderColor: `${color}33`, color }}
                        >
                          {type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 px-2">
                        <span className="flex items-center gap-1.5 font-semibold">
                          {logo && <img src={logo} alt={asset} width={14} height={14} className="rounded-full" />}
                          {asset}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-bold">
                        {tx.amount ? Number(tx.amount).toFixed(4) : '-'}
                      </td>
                      <td className="py-2.5 px-2 hidden sm:table-cell">
                        {protocol && (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            {protocolLogo && <img src={protocolLogo} alt={protocol} width={12} height={12} className="rounded-full" />}
                            {protocol}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {tx.tx_hash ? (
                          <a
                            href={`https://bscscan.com/tx/${tx.tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-gold-glow hover:underline"
                          >
                            {String(tx.tx_hash).slice(0, 8)}...
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* Skeleton rows */}
                {history.isLoading && transactions.length === 0 && (
                  [...Array(5)].map((_, i) => (
                    <tr key={`skel-${i}`} className="border-b border-white/[0.03]">
                      <td className="py-2.5 px-3"><Skeleton className="h-4 w-24" /></td>
                      <td className="py-2.5 px-2"><Skeleton className="h-5 w-16" /></td>
                      <td className="py-2.5 px-2"><Skeleton className="h-4 w-14" /></td>
                      <td className="py-2.5 px-2 text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                      <td className="py-2.5 px-2 hidden sm:table-cell"><Skeleton className="h-4 w-14" /></td>
                      <td className="py-2.5 px-3 text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
                    </tr>
                  ))
                )}

                {/* Empty state */}
                {!history.isLoading && transactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground text-xs">
                      <div className="flex flex-col items-center gap-2">
                        <div className="led-gold animate-pulse-gold" />
                        <span>No transactions found</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="skeuo-button-dark px-3 py-1.5 text-xs disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-[10px] text-muted-foreground font-mono">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="skeuo-button-dark px-3 py-1.5 text-xs disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
