# AI DeFi Strategy Agent — Design Document

**Date:** 2026-02-16
**Hackathon:** Good Vibes Only: OpenClaw Edition (BNB Chain)
**Deadline:** 2026-02-19 15:00 UTC
**Prize Pool:** $100,000

---

## Overview

A semi-autonomous AI-powered DeFi agent that finds the best lending/borrowing yields across top BSC protocols, deploys user funds via an embedded agent wallet, and patiently accumulates yield. The agent monitors rates, rebalances only when there's a significant sustained reason, and uses OpenAI GPT-5.2 to explain every decision in plain language.

**Track:** AI Agents + DeFi Tools

---

## Architecture

### Approach: Separate Frontend + Backend

- **Frontend:** Next.js dashboard on Vercel — wallet connect, portfolio view, settings, activity log
- **Backend:** Persistent Node.js service on Railway/Render — agent logic, cron jobs, execution
- **Communication:** REST API + WebSocket for real-time updates

```
USER (Browser)
  └── Next.js Frontend (Vercel)
        │ REST API + WebSocket
        ▼
      Agent Backend (Node.js — Railway/Render)
        ├── Strategy Engine (rule-based scoring)
        ├── Execution Engine (viem → BSC)
        ├── Data Fetcher (DeFiLlama + onchain)
        ├── AI Summarizer (OpenAI GPT-5.2)
        └── Privy Server Wallet (agent wallet)
              │
              ├── Venus Protocol (supply/redeem)
              ├── Aave V3 (supply/withdraw)
              ├── Lista / Moolah (vault deposit/withdraw)
              ├── Pendle (buy/redeem PT for fixed yield)
              └── PancakeSwap (swaps only)
```

---

## Supported Protocols

| Protocol | Type | Key Contract (BSC) | Use |
|----------|------|-------------------|-----|
| Venus | Lending | Comptroller + vTokens | Supply stables/majors for APY |
| Aave V3 | Lending | Pool: `0x6807dc923806fE8Fd134338EABCA509979a7e0cB` | Supply stables/majors for APY |
| Lista (Moolah) | Lending/Vaults | Core: `0x8F73b65B4caAf64FBA2aF91cC5D4a2A1318E5D8C` | WBNB, USD1 vaults |
| Pendle | Fixed Yield | Pendle Router on BSC | Buy PT tokens for fixed yield |
| PancakeSwap | Swap only | Smart Router: `0x13f4EA83D0bd40E75C8222255bc855a974568Dd4` | Token conversions |

### Lista Lending Contracts (BSC)

- Moolah Core: `0x8F73b65B4caAf64FBA2aF91cC5D4a2A1318E5D8C`
- InterestRateModel: `0xFe7dAe87Ebb11a7BEB9F534BB23267992d9cDe7c`
- VaultAllocator: `0x9ECF66f016FCaA853FdA24d223bdb4276E5b524a`
- MoolahVault(WBNB): `0x57134a64B7cD9F9eb72F8255A671F5Bf2fe3E2d0`
- MoolahVault(USD1): `0xfa27f172e0b6ebcEF9c51ABf817E2cb142FbE627`
- OracleAdaptor: `0x21650E416dC6C89486B2E654c86cC2c36c597b58`

---

## Supported Assets

- **Stablecoins:** USDT, USDC, FDUSD, lisUSD
- **Majors:** WBTC/BTCB, WETH, WBNB

---

## Wallet Architecture

### Privy Server Wallets

- User connects EOA via Privy React SDK
- On first login, a Privy embedded wallet is created for the agent
- Agent wallet is server-controlled via Privy authorization keys
- User funds agent wallet with simple BEP-20 transfers
- User can withdraw anytime (emergency exit)

### Fund Flow

| Action | Flow | Signer |
|--------|------|--------|
| Deposit | User EOA → Agent Wallet | User (frontend) |
| Withdraw | Agent Wallet → User EOA | Server (user-triggered) |
| Supply | Agent Wallet → Protocol | Server (agent-initiated) |
| Redeem | Protocol → Agent Wallet | Server (agent-initiated) |
| Swap | Agent Wallet → PancakeSwap → Agent Wallet | Server (agent-initiated) |
| Harvest | Protocol rewards → Agent Wallet | Server (agent-initiated) |
| Emergency exit | All protocols → Agent Wallet → User EOA | Server (user-triggered) |

### Transaction Tagging

Every agent tx includes a tag in calldata for onchain identification:
```
"DeFiAgent:<action>:<asset>:<from>→<to>:<amount>"
```

---

## Strategy Engine — Conservative Yield Accumulation

### Philosophy

Park and accumulate. Find the best risk-adjusted yield, deposit, and stay. Only move when there's a significant sustained reason.

### Rebalance Triggers (Only These)

| Trigger | Condition |
|---------|-----------|
| Major APY divergence | Current APY drops >2% below best alternative, sustained 24+ hours |
| Protocol risk event | TVL drops >20% in 24h, exploit news, utilization >95% |
| User manual request | User clicks "rebalance now" or changes boundaries |
| New deposit | User funds agent wallet with new capital |
| Reward harvesting | Claimable rewards exceed gas cost threshold |

### What Does NOT Trigger Rebalance

- Small APY differences (<2%)
- Temporary APY spikes (<24h)
- Minor TVL fluctuations

### Scoring Formula

```
Score = APY_7d_avg (35%)        — 7-day average, not spot
      + TVL_safety (25%)        — higher TVL = safer
      + Protocol_trust (25%)    — Venus/Aave > Lista > newer
      + Utilization_health (15%) — <80% utilization preferred
```

### Monitoring Cadence

| Action | Frequency |
|--------|-----------|
| Fetch rates | Every 15 min |
| Portfolio snapshot | Every 1 hour |
| Rebalance evaluation | Every 6 hours |
| Daily summary | Every 24 hours |
| Reward check | Every 12 hours |

### User-Configurable Boundaries

| Parameter | Default |
|-----------|---------|
| Risk level | Medium (low=stables only, med=+majors, high=all) |
| Min TVL | $10M |
| APY improvement threshold | 2% |
| Max per protocol | 50% |
| Rebalance cooldown | 6 hours |
| Whitelisted protocols | All 4 |
| Whitelisted assets | All |

---

## Data Sources

| Source | Endpoint | Data | Refresh |
|--------|----------|------|---------|
| DeFiLlama Yields | `GET /yields/pools` | BSC pools — APY, TVL, rewards | 15 min |
| DeFiLlama Prices | `GET /coins/prices/current/{coins}` | Token prices (`bsc:0x...`) | 15 min |
| BSC RPC (viem) | `publicClient.readContract()` | Balances, positions, allowances | On-demand |
| Protocol contracts | Direct reads | Supply rates, borrow rates | 15 min |

---

## Backend Structure

```
agent-backend/
├── src/
│   ├── index.ts                 # Entry — Express + cron setup
│   ├── config.ts                # Chain config, addresses, defaults
│   ├── api/
│   │   ├── routes.ts            # REST endpoints
│   │   └── websocket.ts         # Real-time push to frontend
│   ├── agent/
│   │   ├── scheduler.ts         # Cron jobs
│   │   ├── evaluator.ts         # Scoring + rebalance decision
│   │   └── executor.ts          # Execute transactions
│   ├── protocols/
│   │   ├── venus.ts             # supply/redeem/getAPY/getBalance
│   │   ├── aave.ts              # supply/withdraw/getAPY/getBalance
│   │   ├── lista.ts             # deposit/withdraw/getAPY/getBalance
│   │   ├── pendle.ts            # buyPT/redeemPT/getFixedYield
│   │   └── pancakeswap.ts       # swap only
│   ├── data/
│   │   ├── defillama.ts         # Yields, prices API
│   │   └── onchain.ts           # BSC RPC reads
│   ├── wallet/
│   │   └── privy.ts             # Server wallet management
│   ├── ai/
│   │   └── openai.ts            # GPT-5.2 summarizer
│   └── db/
│       └── supabase.ts          # Persistence
├── package.json
├── tsconfig.json
└── .env
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/yields` | Current yield opportunities |
| GET | `/api/portfolio` | Agent positions + balances |
| GET | `/api/history` | Tx history with AI summaries |
| POST | `/api/settings` | Update user boundaries |
| POST | `/api/deposit` | Get agent wallet address |
| POST | `/api/withdraw` | Trigger withdrawal to EOA |
| POST | `/api/rebalance` | Manual rebalance trigger |
| WS | `/ws` | Real-time agent activity |

---

## Frontend Structure

```
app/
├── page.tsx                    # Landing — connect wallet
├── dashboard/
│   ├── page.tsx                # Portfolio + yields + activity
│   ├── yields/page.tsx         # Yield opportunities table
│   ├── history/page.tsx        # Tx log with AI summaries
│   └── settings/page.tsx       # Agent boundary config
```

### Tech: Next.js 14 + Tailwind + shadcn/ui + Privy React SDK + wagmi/viem + Recharts + TanStack Query

---

## Database (Supabase)

### Tables

- **users** — EOA address, agent wallet address
- **settings** — risk level, thresholds, whitelists
- **positions** — current protocol positions, amounts, APY, earned yield
- **transactions** — tx log with type, protocols, amounts, tx hash, AI summary
- **yield_snapshots** — periodic APY/TVL records per protocol/asset
- **portfolio_snapshots** — total value + daily yield over time (for charts)

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js 14 + Tailwind + shadcn/ui |
| Backend | Node.js + Express + TypeScript |
| Database | Supabase (Postgres) |
| Wallet (user) | Privy React SDK |
| Wallet (agent) | Privy Server Wallets |
| Chain | viem (BSC mainnet, chain ID 56) |
| Swaps | PancakeSwap Smart Router SDK |
| AI | OpenAI GPT-5.2 (`gpt-5.2`) |
| Data | DeFiLlama API (free) |
| Scheduling | node-cron |
| Real-time | WebSocket (ws) |
| Deploy frontend | Vercel |
| Deploy backend | Railway or Render |

---

## Example Agent Lifecycle

```
Day 0:  User deposits 10,000 USDT + 1 WBTC + 5 BNB
        Agent scores all protocols, deploys optimally.

Day 1-13: Monitor. APYs fluctuate ±0.5%. No action.
          Daily summaries via GPT-5.2.

Day 14: Venus USDT APY drops to 2.1% (sustained 24h+).
        Lista at 5.8% sustained. Agent moves USDT.
        GPT-5.2 explains why.

Day 20: Harvests XVS rewards ($150), swaps to USDT, re-deposits.

Day 30: Portfolio has compounded yield across 3 protocols.
```
