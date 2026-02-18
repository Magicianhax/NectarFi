# AI DeFi Strategy Agent — Session Context

## Hackathon
- **Name:** Good Vibes Only: OpenClaw Edition (BNB Chain)
- **Deadline:** Feb 19, 2026 at 3:00 PM UTC
- **Prize:** $100K across 10 winners
- **Submission:** DoraHacks — needs public repo, demo link, agent wallet address (onchain proof)
- **Scoring:** 40% community vote + 60% judges

## Key Design Decisions (from conversation)

1. **Architecture:** Separate frontend (Next.js on Vercel) + backend (Node.js on Railway/Render) — NOT monolith
2. **Agent wallet:** Privy server-side embedded wallet — created per user, server signs txs. NOT a smart contract vault.
3. **Execution model:** Semi-autonomous. User sets boundaries, agent operates within them. NOT fully autonomous.
4. **Strategy:** Conservative yield accumulation — park and hold. Only rebalance when >2% APY improvement sustained 24h+. NOT aggressive rotation.
5. **Protocols:** Lending/borrowing ONLY on Venus, Aave V3, Lista (Moolah). PancakeSwap for swaps only. NO LP/yield farming.
6. **Assets:** Stablecoins (USDT, USDC, FDUSD) + majors (WBTC/BTCB, WETH, WBNB) only.
7. **AI model:** OpenAI GPT-5.2 (`gpt-5.2`) — for summarizing decisions, daily reports, rebalance explanations. Rule-based logic for actual decisions.
8. **Tx tagging:** Every agent tx includes "DeFiAgent:<action>:<details>" in calldata for onchain identification.
9. **Monitoring cadence:** Fetch rates every 15min, evaluate rebalance every 6h, daily AI summary.

## Build Progress

### Done (Tasks 1-13):
- Task 1: Scaffolding — backend + frontend + .gitignore + .env.example
- Task 2: Config + ABIs (config.ts, erc20, vToken, aavePool, listaMoolah)
- Task 3: Data layer (types.ts, defillama.ts, onchain.ts)
- Task 4: Protocol adapters (venus, aave, lista, pancakeswap + types)
- Task 5: Privy wallet integration (wallet/privy.ts)
- Task 6: OpenAI summarizer (ai/openai.ts) — using gpt-4o
- Task 7: Strategy evaluator + executor (agent/evaluator.ts, agent/executor.ts)
- Task 8: Scheduler with cron jobs (agent/scheduler.ts), wired into index.ts
- Task 9: Supabase schema + helpers (db/schema.sql, db/supabase.ts)
- Task 10: API routes (api/routes.ts), mounted in index.ts
- Task 11: Frontend providers, API client, layout, landing page
- Task 12: Dashboard with portfolio card, yields table, activity log
- Task 13: Settings page with all configurable boundaries
- Backend compiles clean (tsc --noEmit)
- Frontend builds clean (next build)
- shadcn/ui components installed (button, card, badge, input, label, select, tabs, separator, skeleton, slider)

### Remaining tasks:
- Task 14: Integration testing + polish
- Task 15: Deploy (Vercel frontend + Railway backend)
- Task 16: Hackathon submission

## Files to reference
- `docs/plans/2026-02-16-ai-defi-agent-design.md` — full design document
- `docs/plans/2026-02-17-implementation-plan.md` — complete implementation plan with ALL code

## Git config
- Name: Magicianhax
- Email: businessabs007@gmail.com

## Notes
- Use Linux filesystem (`/home/musha/bsc hackathon/`) NOT `/mnt/c/` — npm is much faster
- WSL2 on Windows
- User prefers concise communication, no hand-holding
