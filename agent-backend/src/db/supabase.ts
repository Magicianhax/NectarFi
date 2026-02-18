import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

// User operations
export async function getOrCreateUser(eoaAddress: string) {
  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('eoa_address', eoaAddress.toLowerCase())
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from('users')
    .insert({ eoa_address: eoaAddress.toLowerCase() })
    .select()
    .single();

  // Handle race condition — another request created user between SELECT and INSERT
  if (error?.code === '23505') {
    const { data: retried } = await supabase
      .from('users')
      .select('*')
      .eq('eoa_address', eoaAddress.toLowerCase())
      .single();
    if (retried) return retried;
  }

  if (error) throw error;
  return created;
}

export async function updateAgentWallet(userId: string, walletId: string, walletAddress: string) {
  await supabase
    .from('users')
    .update({ agent_wallet_id: walletId, agent_wallet_address: walletAddress })
    .eq('id', userId);
}

// Settings operations
export async function getUserSettings(userId: string) {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[DB] getUserSettings error:', error);
  }
  return data;
}

export async function upsertSettings(userId: string, settings: Record<string, any>) {
  const { error } = await supabase
    .from('settings')
    .upsert(
      { user_id: userId, ...settings, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  if (error) {
    console.error('[DB] upsertSettings error:', error);
    throw error;
  }
}

// Position operations
export async function getUserPositions(userId: string) {
  const { data } = await supabase
    .from('positions')
    .select('*')
    .eq('user_id', userId);
  return data || [];
}

export async function upsertPosition(userId: string, position: {
  protocol: string;
  asset: string;
  deposited_amount: number;
  current_apy: number;
}) {
  await supabase
    .from('positions')
    .upsert({
      user_id: userId,
      protocol: position.protocol,
      asset: position.asset,
      deposited_amount: position.deposited_amount,
      current_apy: position.current_apy,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,protocol,asset' });
}

// Transaction log
export async function logTransaction(userId: string, tx: {
  type: string;
  from_protocol?: string;
  to_protocol?: string;
  asset: string;
  amount: number;
  tx_hash?: string;
  ai_summary?: string;
}) {
  await supabase.from('transactions').insert({ user_id: userId, ...tx });
}

// Activity log
export async function saveActivity(event: string, data: any) {
  await supabase.from('activity_log').insert({ event, data });
}

export async function getRecentActivity(limit = 200) {
  const { data } = await supabase
    .from('activity_log')
    .select('event, data, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data || []).map((row) => ({
    event: row.event,
    data: row.data,
    timestamp: row.created_at,
  }));
}

// Yield snapshots
export async function saveYieldSnapshot(yields: Array<{ protocol: string; asset: string; apy: number; tvl: number }>) {
  const rows = yields.map((y) => ({
    protocol: y.protocol,
    asset: y.asset,
    apy: y.apy,
    tvl: y.tvl,
  }));
  await supabase.from('yield_snapshots').insert(rows);
}

// Portfolio snapshots
export async function savePortfolioSnapshot(userId: string, totalValue: number, dailyYield: number) {
  await supabase.from('portfolio_snapshots').insert({
    user_id: userId,
    total_value: totalValue,
    daily_yield: dailyYield,
  });
}

// Get transaction history with optional filters
export async function getTransactionHistory(userId: string, opts?: {
  type?: string;
  asset?: string;
  limit?: number;
  offset?: number;
}) {
  const limit = opts?.limit || 50;
  const offset = opts?.offset || 0;
  let query = supabase
    .from('transactions')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (opts?.type) query = query.eq('type', opts.type);
  if (opts?.asset) query = query.ilike('asset', `%${opts.asset}%`);
  const { data, count } = await query;
  return { transactions: data || [], total: count || 0 };
}

// Get yield history for charts
export async function getYieldHistory(protocol?: string, asset?: string, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  let query = supabase
    .from('yield_snapshots')
    .select('*')
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: true });
  if (protocol) query = query.eq('protocol', protocol);
  if (asset) query = query.eq('asset', asset);
  const { data } = await query;
  return data || [];
}

// APY trend data for AI context
export interface ApyTrendRow {
  protocol: string;
  asset: string;
  currentApy: number;
  avgApy24h: number;
  minApy24h: number;
  maxApy24h: number;
  trend: 'rising' | 'falling' | 'stable';
  volatility: number; // coefficient of variation (stddev/mean as %)
}

export async function getApyTrends(hours = 24): Promise<ApyTrendRow[]> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('yield_snapshots')
    .select('protocol, asset, apy, recorded_at')
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: true });

  if (!data || data.length === 0) return [];

  // Group by protocol+asset
  const groups: Record<string, Array<{ apy: number; recorded_at: string }>> = {};
  for (const row of data) {
    const key = `${row.protocol}:${row.asset}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push({ apy: row.apy, recorded_at: row.recorded_at });
  }

  const results: ApyTrendRow[] = [];
  for (const [key, snapshots] of Object.entries(groups)) {
    if (snapshots.length < 2) continue;
    const [protocol, asset] = key.split(':');
    const apys = snapshots.map(s => s.apy);
    const currentApy = apys[apys.length - 1];
    const avgApy24h = apys.reduce((s, v) => s + v, 0) / apys.length;
    const minApy24h = Math.min(...apys);
    const maxApy24h = Math.max(...apys);

    // Trend: compare first-third avg vs last-third avg
    const third = Math.max(1, Math.floor(apys.length / 3));
    const firstThirdAvg = apys.slice(0, third).reduce((s, v) => s + v, 0) / third;
    const lastThirdAvg = apys.slice(-third).reduce((s, v) => s + v, 0) / third;
    const delta = lastThirdAvg - firstThirdAvg;
    const trend: ApyTrendRow['trend'] = delta > 0.3 ? 'rising' : delta < -0.3 ? 'falling' : 'stable';

    // Volatility: stddev as % of mean
    const variance = apys.reduce((s, v) => s + (v - avgApy24h) ** 2, 0) / apys.length;
    const stddev = Math.sqrt(variance);
    const volatility = avgApy24h > 0 ? (stddev / avgApy24h) * 100 : 0;

    results.push({ protocol, asset, currentApy, avgApy24h, minApy24h, maxApy24h, trend, volatility });
  }
  return results;
}

// Recent AI decisions for context (prevents flip-flopping)
export async function getRecentDecisions(userId: string, limit = 8): Promise<Array<{
  type: string;
  asset: string;
  protocol: string;
  amount: number;
  summary: string;
  createdAt: string;
}>> {
  const { data } = await supabase
    .from('transactions')
    .select('type, asset, to_protocol, from_protocol, amount, ai_summary, created_at')
    .eq('user_id', userId)
    .in('type', ['supply', 'rebalance_supply', 'swap'])
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data || []).map(row => ({
    type: row.type,
    asset: row.asset,
    protocol: row.to_protocol || row.from_protocol || '',
    amount: row.amount,
    summary: row.ai_summary || '',
    createdAt: row.created_at,
  }));
}

// Position ages — how long each position has been held
export async function getPositionAges(userId: string): Promise<Record<string, { enteredAt: string; hoursHeld: number }>> {
  // For each protocol:asset combo, find the most recent supply entry
  const { data } = await supabase
    .from('transactions')
    .select('to_protocol, asset, created_at')
    .eq('user_id', userId)
    .in('type', ['supply', 'rebalance_supply'])
    .order('created_at', { ascending: false });

  const ages: Record<string, { enteredAt: string; hoursHeld: number }> = {};
  if (!data) return ages;

  for (const row of data) {
    const key = `${row.to_protocol}:${row.asset}`;
    if (!ages[key]) {
      const hoursHeld = (Date.now() - new Date(row.created_at).getTime()) / (1000 * 60 * 60);
      ages[key] = { enteredAt: row.created_at, hoursHeld: Math.round(hoursHeld * 10) / 10 };
    }
  }
  return ages;
}

// Get portfolio history for charts
export async function getPortfolioHistory(userId: string, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('portfolio_snapshots')
    .select('*')
    .eq('user_id', userId)
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: true });
  return data || [];
}
