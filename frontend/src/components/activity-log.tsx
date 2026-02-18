'use client';

import { useState } from 'react';
import { TOKEN_LOGOS, PROTOCOL_LOGOS } from '@/lib/logos';

interface Activity {
  event: string;
  data: {
    message?: string;
    summary?: string;
    title?: string;
    description?: string;
    asset?: string;
    protocol?: string;
    amount?: string;
    txHash?: string;
    reasoning?: string;
    count?: number;
  };
  timestamp: string;
}

const EVENT_CONFIG: Record<string, { color: string; bg: string; category: string }> = {
  action_completed:   { color: '#00C087', bg: 'rgba(0,192,135,0.12)', category: 'execution' },
  position_withdrawn: { color: '#FF6B6B', bg: 'rgba(255,107,107,0.12)', category: 'execution' },
  transfer_to_eoa:    { color: '#F0B90B', bg: 'rgba(240,185,11,0.12)', category: 'execution' },
  rebalance_started:  { color: '#F0B90B', bg: 'rgba(240,185,11,0.12)', category: 'analysis' },
  rebalance_completed:{ color: '#00C087', bg: 'rgba(0,192,135,0.12)', category: 'analysis' },
  ai_decision:        { color: '#B6509E', bg: 'rgba(182,80,158,0.12)', category: 'analysis' },
  executing_action:   { color: '#F0B90B', bg: 'rgba(240,185,11,0.12)', category: 'execution' },
  action_failed:      { color: '#FF4466', bg: 'rgba(255,68,102,0.12)', category: 'error' },
  yields_updated:     { color: '#00C087', bg: 'rgba(0,192,135,0.12)', category: 'system' },
  agent_started:      { color: '#00C087', bg: 'rgba(0,192,135,0.12)', category: 'system' },
  agent_stopped:      { color: '#FF6B6B', bg: 'rgba(255,107,107,0.12)', category: 'system' },
  daily_summary:      { color: '#F0B90B', bg: 'rgba(240,185,11,0.12)', category: 'system' },
};

function EventIcon({ event, color }: { event: string; color: string }) {
  const p = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (event) {
    case 'action_completed': // checkmark
      return <svg {...p}><polyline points="20 6 9 17 4 12" /></svg>;
    case 'position_withdrawn': // arrow out of box
      return <svg {...p}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>;
    case 'transfer_to_eoa': // wallet send
      return <svg {...p}><path d="M21 12V7H5a2 2 0 010-4h14v4" /><path d="M3 5v14a2 2 0 002 2h16v-5" /><path d="M18 12a2 2 0 100 4h4v-4h-4z" /></svg>;
    case 'rebalance_started': // refresh arrows
      return <svg {...p}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" /></svg>;
    case 'rebalance_completed': // check-circle
      return <svg {...p}><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>;
    case 'ai_decision': // sparkle/brain
      return <svg {...p}><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" /></svg>;
    case 'executing_action': // loader/gear
      return <svg {...p}><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" /></svg>;
    case 'action_failed': // x-circle
      return <svg {...p}><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>;
    case 'yields_updated': // trending up
      return <svg {...p}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>;
    case 'agent_started': // play
      return <svg {...p} fill={color} stroke="none"><polygon points="6,3 20,12 6,21" /></svg>;
    case 'agent_stopped': // stop square
      return <svg {...p} fill={color} stroke="none"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>;
    case 'daily_summary': // bar chart
      return <svg {...p}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>;
    default:
      return <svg {...p}><circle cx="12" cy="12" r="4" /></svg>;
  }
}

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDateTime(timestamp: string): string {
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function getTitle(a: Activity): string {
  if (a.data?.title) return a.data.title;
  // Fallback titles based on event type
  const fallbacks: Record<string, string> = {
    action_completed: 'Position activated',
    position_withdrawn: 'Position deactivated',
    transfer_to_eoa: 'Funds withdrawn to wallet',
    rebalance_started: 'Rebalance analysis started',
    rebalance_completed: 'Rebalance complete',
    ai_decision: 'AI investment decision',
    executing_action: 'Executing transaction',
    action_failed: 'Action failed',
    yields_updated: 'Yield rates refreshed',
    agent_started: 'AI Agent activated',
    agent_stopped: 'AI Agent deactivated',
    daily_summary: 'Daily summary',
  };
  return fallbacks[a.event] || a.event.replace(/_/g, ' ');
}

function getDescription(a: Activity): string {
  if (a.data?.description) return a.data.description;
  if (a.data?.summary) return a.data.summary;
  if (a.data?.reasoning) return a.data.reasoning;
  if (a.data?.message) return a.data.message;
  return '';
}

function ExpandableDescription({ desc, isError, isAiDecision }: { desc: string; isError: boolean; isAiDecision: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = isAiDecision && desc.length > 120;
  const displayText = needsTruncation && !expanded ? desc.slice(0, 120) + '...' : desc;

  return (
    <div>
      {expanded && isAiDecision ? (
        <div
          className="text-[11px] leading-relaxed p-2 rounded"
          style={{ background: 'rgba(182,80,158,0.06)', border: '1px solid rgba(182,80,158,0.1)' }}
        >
          {desc}
        </div>
      ) : (
        <p className={`text-[11px] leading-relaxed ${isError ? 'text-[#FF8A9E]/80' : 'text-muted-foreground'}`}>
          {displayText}
        </p>
      )}
      {needsTruncation && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] font-semibold mt-0.5"
          style={{ color: '#B6509E' }}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

export function ActivityLog({ activities }: { activities: Activity[] }) {
  return (
    <div className="skeuo-panel p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="led-gold" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-emboss">Agent Activity</h3>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">{activities.length} events</span>
      </div>

      <div className="skeuo-divider" />

      <div className="skeuo-inset p-3 max-h-[32rem] overflow-y-auto space-y-0">
        {activities.map((a, i) => {
          const config = EVENT_CONFIG[a.event] || { color: '#888', bg: 'rgba(136,136,136,0.12)', category: 'system' };
          const title = getTitle(a);
          const desc = getDescription(a);
          const isExecution = config.category === 'execution';
          const isError = config.category === 'error';
          const isAiDecision = a.event === 'ai_decision';

          return (
            <div
              key={i}
              className="flex gap-3 py-3 px-2 hover:bg-white/[0.02] transition-colors border-b border-white/[0.03] last:border-b-0"
            >
              {/* Timeline icon */}
              <div className="flex flex-col items-center">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: config.bg, boxShadow: `0 0 8px ${config.bg}` }}
                >
                  <EventIcon event={a.event} color={config.color} />
                </div>
                {i < activities.length - 1 && (
                  <div className="w-px flex-1 mt-1 bg-white/[0.06]" />
                )}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <h4 className={`text-xs font-semibold leading-tight ${isError ? 'text-[#FF8A9E]' : 'text-foreground'}`}>
                      {title}
                    </h4>
                    {isAiDecision && (
                      <span
                        className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(182,80,158,0.15)', color: '#B6509E' }}
                      >
                        AI
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-[9px] font-mono text-muted-foreground">
                      {formatRelativeTime(a.timestamp)}
                    </span>
                    <span className="text-[8px] font-mono text-muted-foreground/60">
                      {formatDateTime(a.timestamp)}
                    </span>
                  </div>
                </div>

                {desc && (
                  <ExpandableDescription desc={desc} isError={isError} isAiDecision={isAiDecision} />
                )}

                {/* Transaction hash link */}
                {a.data?.txHash && (
                  <a
                    href={`https://bscscan.com/tx/${a.data.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] font-mono text-gold-glow hover:underline"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    {a.data.txHash.slice(0, 10)}...{a.data.txHash.slice(-6)}
                  </a>
                )}

                {/* Amount + asset tag for execution events */}
                {isExecution && a.data?.amount && a.data?.asset && (
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="skeuo-tag px-2 py-0.5 text-[9px] font-mono font-bold inline-flex items-center gap-1">
                      {TOKEN_LOGOS[a.data.asset] && (
                        <img src={TOKEN_LOGOS[a.data.asset]} alt={a.data.asset} width={11} height={11} className="rounded-full" />
                      )}
                      {a.data.amount} {a.data.asset}
                    </span>
                    {a.data.protocol && (
                      <span className="text-[9px] text-muted-foreground capitalize inline-flex items-center gap-1">
                        {PROTOCOL_LOGOS[a.data.protocol] && (
                          <img src={PROTOCOL_LOGOS[a.data.protocol]} alt={a.data.protocol} width={11} height={11} className="rounded-full" />
                        )}
                        {a.data.protocol}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {activities.length === 0 && (
          <div className="py-8 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 animate-pulse" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 animate-pulse" style={{ animationDelay: '300ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 animate-pulse" style={{ animationDelay: '600ms' }} />
              </div>
              <p className="text-xs text-muted-foreground">Agent standing by. Deposit funds to activate.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
