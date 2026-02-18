# NectarFi — AI-Powered DeFi Yield Optimizer on BNB Chain

> Autonomous AI agent that manages your DeFi portfolio across Venus, Aave V3, and Lista (Moolah) on BSC. Deposit once, earn optimized yield — the agent handles the rest.

**Hackathon:** [Good Vibes Only: OpenClaw Edition](https://dorahacks.io/hackathon/goodvibes/detail) | **Track:** DeFi + Agent | **Built by:** [@Magicianafk](https://x.com/Magicianafk)

**Live Demo:** [nectarfi.vercel.app](https://nectarfi.vercel.app)

---

## What is NectarFi?

NectarFi is an AI DeFi yield optimization agent that autonomously manages user funds across the top lending protocols on BNB Chain. Users deposit tokens into their personal agent wallet, configure risk preferences, and the AI continuously monitors yields, executes rebalances, and swaps between assets to maximize returns — all verified on-chain.

### The Problem

DeFi users leave yield on the table because:
- Monitoring APY rates across protocols is tedious
- Rebalancing requires manual transactions and gas
- Swapping between assets to chase better yields requires constant attention
- Risk management across multiple protocols is complex

### The Solution

NectarFi automates the entire yield optimization workflow:
1. **Deposit** tokens to your personal agent wallet (Privy embedded wallet)
2. **Configure** risk level, whitelisted protocols/assets, APY thresholds
3. **AI analyzes** yields every 30 minutes using GPT-5.2
4. **Agent executes** supply, withdraw, rebalance, and swap operations autonomously
5. **Track everything** via real-time dashboard with live activity feed

---

## On-Chain Proof

**Agent Wallet (Test):** [`0x0B0C986ad1271b32AE11625141076CF71D9Ce8E9`](https://bscscan.com/address/0x0B0C986ad1271b32AE11625141076CF71D9Ce8E9)

Verified transactions executed autonomously by the AI agent on BSC mainnet:

| Action | Protocol | Asset | Amount | TX Hash |
|--------|----------|-------|--------|---------|
| Supply | Aave V3 | USDC | ~40.49 USDC | [`0xe290dd...`](https://bscscan.com/tx/0xe290dd15a2ffb16ac0a7b88b021c4e329fff35c80d1de0a68d25f6fbe5c1d762) |
| Deposit | Lista Moolah | WBNB | ~0.030 WBNB | [`0x880def...`](https://bscscan.com/tx/0x880def56d967647d8603c04373855761be01acdd52803fbe56b5e33cd9ae65c0) |

### How It Works End-to-End

1. The AI agent fetches live APY rates from Venus, Aave V3, and Lista via on-chain reads + DeFiLlama enrichment
2. GPT-5.2 analyzes the user's idle wallet balances, current positions, and all yield opportunities
3. It returns structured JSON actions (e.g. "supply 40.49 USDC to Aave at 1.82% APY")
4. The backend executor approves tokens and executes the supply/deposit transactions via Privy server wallet
5. All decisions and transactions are logged to the activity feed in real-time

**Example AI reasoning (from real rebalance):**
> "USDT earns the most on Aave at 1.97% (higher than Venus 0.23%). For BNB, Lista offers the best WBNB yield at 0.81%. Supply 100% of idle USDT to Aave. Supply idle BNB as WBNB to Lista, leaving 0.005 BNB for gas."

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Frontend (Next.js 16)              │
│  Dashboard · Settings · Activity · History · Charts  │
│  Privy Auth · Deposit/Withdraw/Swap UI               │
└─────────────────────────┬────────────────────────────┘
                          │ REST API + WebSocket
┌─────────────────────────▼────────────────────────────┐
│                 Backend (Express + TypeScript)        │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  AI Engine   │  │  Scheduler   │  │  Executor  │  │
│  │  (GPT-5.2)   │  │  (Cron Jobs) │  │  (On-chain)│  │
│  └──────┬──────┘  └──────┬───────┘  └─────┬──────┘  │
│         │                │                 │         │
│  ┌──────▼────────────────▼─────────────────▼──────┐  │
│  │           Protocol Adapters                     │  │
│  │   Venus · Aave V3 · Lista · PancakeSwap V3    │  │
│  └────────────────────┬───────────────────────────┘  │
│                       │                              │
│  ┌────────────────────▼───────────────────────────┐  │
│  │  Privy Server Wallet · Supabase DB · DeFiLlama │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
                          │
                    BNB Chain (BSC)
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Recharts |
| **Backend** | Node.js, Express, TypeScript, node-cron |
| **AI** | OpenAI GPT-5.2 (structured output for investment decisions) |
| **Wallet** | Privy server-side embedded wallets (per-user, non-custodial) |
| **Auth** | Privy (wallet connect) |
| **Database** | Supabase (PostgreSQL) |
| **On-Chain** | viem, BNB Chain (BSC mainnet) |
| **Protocols** | Venus, Aave V3, Lista Moolah, PancakeSwap V3 |
| **Data** | DeFiLlama API (live prices, yield enrichment, TVL) |

---

## Features

### AI Agent
- **GPT-5.2 Investment Decisions** — Analyzes wallet balances, positions, and yield opportunities using a 3-step framework (Opportunities → Execution → Review); returns structured JSON actions
- **Multi-Protocol Yield Optimization** — Deploys across Venus, Aave V3, and Lista Moolah lending pools
- **APY Trend Analysis** — Tracks 7-day APY trends (rising/falling/stable) and volatility to avoid chasing spikes
- **6-Factor Scoring** — Ranks opportunities by APY, TVL safety, protocol trust, trend stability, diversification, and gas efficiency
- **Automated Rebalancing** — Moves funds between protocols when APY differential exceeds threshold
- **Cross-Asset Swaps** — Swaps stablecoins via PancakeSwap V3 when better yields exist on different tokens
- **Risk-Aware Diversification** — Splits across protocols, respects max allocation limits
- **Conservative Gas Management** — Maintains BNB reserves for transaction fees, skips dust deployments (<$1)

### Dashboard
- **Real-Time Portfolio** — Live balances, on-chain positions, P&L tracking with token logos
- **Activity Feed** — WebSocket-powered live event stream (AI decisions, executions, errors)
- **Analytics Charts** — Portfolio value over time, APY trends, allocation pie chart (Recharts)
- **Yield Table** — All opportunities ranked by composite score with DeFiLlama enrichment
- **Token Swap** — PancakeSwap V3 integration with live prices and percentage presets
- **Transaction History** — Filterable, paginated, with CSV export and BscScan links

### Settings
- **Risk Level** — Low (stables only), Medium (+ majors), High (all assets)
- **Min TVL Filter** — Only deploy to protocols above threshold
- **APY Threshold** — Minimum improvement required for rebalancing
- **Max Per Protocol** — Cap exposure to any single protocol
- **Rebalance Cooldown** — Minimum time between rebalances
- **Whitelisted Protocols & Assets** — Full control over where funds go

### Security
- **Per-User Embedded Wallets** — Privy server wallets, keys never exposed
- **Wallet Export** — Users can export private keys (HPKE-encrypted)
- **Wind Down** — One-click withdraw all positions back to wallet
- **Transfer to EOA** — Move funds from agent wallet to personal wallet
- **No Token Launches** — Pure utility, no fundraising or token

---

## Supported Protocols

| Protocol | Type | Assets | APY Source |
|----------|------|--------|------------|
| **Venus** | Lending | USDT, USDC, BTCB, WETH, WBNB, FDUSD | On-chain (`supplyRatePerBlock`) |
| **Aave V3** | Lending | USDT, USDC, BTCB, WETH, WBNB, FDUSD | On-chain (`getReserveData`) |
| **Lista Moolah** | Lending (Morpho fork) | WBNB, USD1 | DeFiLlama enrichment |
| **PancakeSwap V3** | DEX | All supported pairs (incl. native BNB) | Swap router |

---

## Getting Started

### Prerequisites

- Node.js 22+
- npm 11+
- Supabase project (free tier works)
- Privy app ID + API keys
- OpenAI API key (GPT-5.2 access)
- Alchemy API key (optional, for reliable BSC RPC)

### 1. Clone

```bash
git clone https://github.com/Magicianhax/NectarFi.git
cd NectarFi
```

### 2. Backend Setup

```bash
cd agent-backend
npm install
cp .env.example .env
# Fill in: SUPABASE_URL, SUPABASE_KEY, PRIVY_APP_ID, PRIVY_APP_SECRET,
#          OPENAI_API_KEY, ALCHEMY_API_KEY (optional)
```

Run the Supabase schema:
```sql
-- Execute agent-backend/src/db/schema.sql in your Supabase SQL editor
```

Start the backend:
```bash
npm run dev
```

### 3. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env.local
# Fill in: NEXT_PUBLIC_API_URL=http://localhost:3001
#          NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
```

Start the frontend:
```bash
npm run dev
```

### 4. Use

1. Open `http://localhost:3000`
2. Connect wallet via Privy
3. Deposit tokens to your agent wallet
4. Configure settings (risk level, protocols, assets)
5. Click "Rebalance Now" or let the AI agent operate autonomously every 30 minutes
6. Monitor via dashboard, activity feed, and analytics

---

## Project Structure

```
NectarFi/
├── agent-backend/
│   └── src/
│       ├── abis/           # Contract ABIs (Venus, Aave, Lista, ERC20)
│       ├── agent/          # Scheduler (crons), Executor (on-chain ops), Evaluator
│       ├── ai/             # OpenAI GPT-5.2 integration
│       ├── api/            # Express REST + WebSocket routes
│       ├── data/           # On-chain reads, DeFiLlama price/yield feeds
│       ├── db/             # Supabase schema + helpers
│       ├── protocols/      # Venus, Aave, Lista, PancakeSwap adapters
│       ├── wallet/         # Privy wallet management
│       └── config.ts       # Chain config, contract addresses, assets
├── frontend/
│   └── src/
│       ├── app/            # Next.js pages (dashboard, settings, history, activity)
│       ├── components/     # UI components (swap, analytics, activity log, yields table)
│       ├── hooks/          # useAgent hook (queries, mutations, WebSocket)
│       └── lib/            # API client, token/protocol logos
└── docs/                   # Design docs, implementation plans
```

---

## How AI is Used

NectarFi uses **OpenAI GPT-5.2** as the investment decision engine:

1. **Investment Decisions** — Given wallet balances, current positions, APY trends, and yield opportunities, GPT-5.2 returns structured JSON with optimal actions (supply, withdraw, rebalance, swap_and_supply, hold). It evaluates risk level, diversification, gas costs, trend direction, and protocol safety.

2. **3-Step Analysis Framework:**
   - **Step 1 (Opportunities):** Identify the best APY for each idle asset, considering trend direction and TVL safety
   - **Step 2 (Execution):** Create specific supply/rebalance/swap actions, respecting gas reserves and dust thresholds
   - **Step 3 (Review):** Verify no idle funds remain, all actions are valid, no protocol limits exceeded

3. **Daily Summaries** — Generates natural language portfolio performance reports.

4. **Action Explanations** — Provides human-readable reasoning for every portfolio action taken.

The AI operates within strict guardrails: whitelisted protocols only, configurable risk levels, APY thresholds, max allocations, and cooldown periods. All decisions are logged and visible in the activity feed.

### AI Build Log

This project was built with extensive AI assistance using **Claude Code (Opus 4.6)**:
- Architecture design and protocol adapter implementation
- Full backend implementation (23 source files)
- Frontend dashboard with skeuomorphic dark theme (13 source files + 10 UI components)
- Real-time WebSocket activity feed
- On-chain testing and debugging on BSC mainnet
- End-to-end AI rebalance flow verified with real funds

---

## Screenshots

*Screenshots available in the demo — connect wallet and explore the dashboard, settings, activity log, yield table, swap modal, and analytics charts.*

---

## License

MIT

---

Built with AI, verified on-chain. **[@Magicianafk](https://x.com/Magicianafk)**
