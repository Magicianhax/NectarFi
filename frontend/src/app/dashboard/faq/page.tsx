'use client';

import Link from 'next/link';
import { useState } from 'react';

const FAQ_ITEMS = [
  {
    q: 'What is NectarFi?',
    a: 'NectarFi is an autonomous AI agent that optimizes your DeFi yield across Venus, Aave V3, and Lista on BNB Chain. You deposit tokens, configure your risk preferences, and the AI handles rebalancing, swaps, and compounding — 24/7.',
  },
  {
    q: 'How does the AI decide where to deploy funds?',
    a: 'GPT-5.2 analyzes every opportunity using a 6-factor scoring model: APY rate, TVL safety, protocol trust, trend stability, diversification benefit, and gas efficiency. It follows a 3-step framework — identify opportunities, plan execution, then review all actions before submitting on-chain.',
  },
  {
    q: 'Is this custodial? Who controls my funds?',
    a: 'Non-custodial. Each user gets a dedicated Privy server-side embedded wallet. Private keys are never exposed to the frontend. You can export your private key or withdraw all positions at any time via "Wind Down".',
  },
  {
    q: 'What protocols are supported?',
    a: 'Venus (lending), Aave V3 (lending), Lista Moolah (Morpho-fork lending), and PancakeSwap V3 (swaps). The agent only deploys to supply-side lending — no leverage, no impermanent loss.',
  },
  {
    q: 'What tokens can I deposit?',
    a: 'USDT, USDC, FDUSD, USD1 (stablecoins), BTCB, WETH, WBNB, and native BNB. The agent auto-wraps BNB to WBNB when needed and can swap between assets to chase higher yields.',
  },
  {
    q: 'How often does the agent rebalance?',
    a: 'By default every 30 minutes the agent checks yields. It only rebalances when the APY improvement exceeds your configured threshold (default 2%) and the cooldown period has passed (default 6 hours). You can also trigger manual rebalances anytime.',
  },
  {
    q: 'What are the risks?',
    a: 'Smart contract risk from the underlying protocols (Venus, Aave, Lista), potential for slippage on swaps, and gas costs on BNB Chain. NectarFi mitigates these with configurable risk levels, TVL minimums, whitelisted protocols, and max-per-protocol limits. There is no leverage or IL exposure.',
  },
  {
    q: 'Is there a token or fee?',
    a: 'No. NectarFi is a pure utility tool built for the BNB Chain hackathon. No token, no fees, no fundraising.',
  },
  {
    q: 'How do I withdraw my funds?',
    a: 'Three options: (1) "Withdraw" individual positions from a protocol back to your agent wallet, (2) "Wind Down" to withdraw all positions at once, or (3) "Transfer to EOA" to send tokens from your agent wallet to your personal wallet.',
  },
  {
    q: 'Can I export my wallet private key?',
    a: 'Yes. Click the lock icon in the header to export your agent wallet private key. It is encrypted using HPKE (P-256 ECDH) and decrypted locally in your browser — the raw key never touches our servers.',
  },
  {
    q: 'What happens if I disconnect?',
    a: 'Your agent wallet and positions persist on-chain. When you reconnect with the same wallet, everything is restored. The AI agent continues monitoring and can rebalance autonomously even while you are offline.',
  },
  {
    q: 'How is the AI used in this project?',
    a: 'OpenAI GPT-5.2 powers the investment decision engine. Given your wallet balances, current positions, APY trends, and all yield opportunities, it returns structured JSON actions (supply, withdraw, rebalance, swap). The entire project was also built with Claude Code (Opus 4.6) — the 24 build sessions are included in the repository.',
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      onClick={() => setOpen(!open)}
      className="w-full text-left skeuo-inset p-4 transition-all duration-200"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-foreground">{q}</span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
      {open && (
        <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
          {a}
        </p>
      )}
    </button>
  );
}

export default function FaqPage() {
  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="skeuo-panel px-5 py-4 flex items-center justify-between animate-fade-up">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center"
                 style={{ background: 'linear-gradient(135deg, #FFD54F 0%, #F0B90B 50%, #C49A09 100%)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0c0c0f" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-emboss tracking-tight">Frequently Asked Questions</h1>
              <p className="text-[10px] text-muted-foreground">Everything you need to know about NectarFi</p>
            </div>
          </div>
          <Link href="/dashboard">
            <button className="skeuo-button-dark px-3 py-1.5 text-xs flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Dashboard
            </button>
          </Link>
        </div>

        {/* FAQ Items */}
        <div className="space-y-2 animate-fade-up-1">
          {FAQ_ITEMS.map((item) => (
            <FaqItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>
      </div>
    </div>
  );
}
