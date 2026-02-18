-- Run this in Supabase SQL editor

create table users (
  id uuid primary key default gen_random_uuid(),
  eoa_address text unique not null,
  agent_wallet_id text unique,
  agent_wallet_address text unique,
  owner_auth_key text,
  created_at timestamptz default now()
);

create table settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade unique,
  risk_level text default 'medium',
  min_tvl bigint default 10000000,
  apy_threshold numeric default 2.0,
  max_per_protocol numeric default 50,
  rebalance_cooldown_hours int default 6,
  whitelisted_protocols text[] default '{venus,aave,lista}',
  whitelisted_assets text[] default '{USDT,USDC,BTCB,WETH,WBNB}',
  updated_at timestamptz default now()
);

create table positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  protocol text not null,
  asset text not null,
  deposited_amount numeric not null,
  current_apy numeric default 0,
  earned_yield numeric default 0,
  deposited_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, protocol, asset)
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  type text not null,
  from_protocol text,
  to_protocol text,
  asset text not null,
  amount numeric not null,
  tx_hash text,
  ai_summary text,
  created_at timestamptz default now()
);

create table yield_snapshots (
  id uuid primary key default gen_random_uuid(),
  protocol text not null,
  asset text not null,
  apy numeric not null,
  tvl numeric,
  recorded_at timestamptz default now()
);

create table portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  total_value numeric not null,
  daily_yield numeric,
  recorded_at timestamptz default now()
);

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  data jsonb default '{}',
  created_at timestamptz default now()
);

-- Indexes
create index idx_positions_user on positions(user_id);
create index idx_transactions_user on transactions(user_id);
create index idx_yield_snapshots_time on yield_snapshots(recorded_at);
create index idx_portfolio_snapshots_user_time on portfolio_snapshots(user_id, recorded_at);
create index idx_activity_log_time on activity_log(created_at desc);
