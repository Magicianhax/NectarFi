'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PROTOCOL_LOGOS, CHAIN_LOGOS } from '@/lib/logos';
import { LoadingSplash } from '@/components/loading-splash';

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

export default function Home() {
  const { ready, login, authenticated } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (ready && authenticated) router.push('/dashboard');
  }, [ready, authenticated, router]);

  if (!ready) {
    return <LoadingSplash />;
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center overflow-y-auto overflow-x-hidden">
      {/* Radial glow behind the panel */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(240,185,11,0.08)_0%,transparent_70%)]" />
        <div className="absolute left-1/4 top-0 w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(240,185,11,0.03)_0%,transparent_70%)]" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-10 px-6 max-w-xl pt-24 pb-16">
        {/* Logo / Brand Mark */}
        <div className="animate-fade-up flex flex-col items-center gap-4">
          {/* Vault Icon */}
          <div className="relative">
            <div className="w-20 h-20  skeuo-panel flex items-center justify-center animate-float">
              <div className="w-12 h-12  bg-gradient-to-br from-gold-bright via-gold to-gold-dim flex items-center justify-center"
                   style={{ background: 'linear-gradient(135deg, #FFD54F 0%, #F0B90B 50%, #C49A09 100%)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0c0c0f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
            </div>
            {/* Pulse ring */}
            <div className="absolute inset-0  animate-pulse-gold opacity-50" />
          </div>

          <div className="skeuo-tag tracking-widest flex items-center gap-2">
            <img src={CHAIN_LOGOS.bsc} alt="BNB Chain" width={16} height={16} className="rounded-full" />
            BNB Chain
          </div>
        </div>

        {/* Title */}
        <div className="animate-fade-up-1 text-center space-y-3">
          <h1 className="text-5xl font-extrabold tracking-tight text-emboss">
            Nectar<span className="text-gold-glow">Fi</span>
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed max-w-sm mx-auto">
            AI-powered yield optimization across Venus, Aave, and Lista.
            Set your risk boundaries. Let the agent compound.
          </p>
        </div>

        {/* Connect Panel */}
        <div className="animate-fade-up-2 skeuo-panel p-6 w-full max-w-sm space-y-5">
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-4">Connect to Begin</p>
          </div>

          <button
            onClick={login}
            className="skeuo-button-gold w-full py-3  text-sm font-bold tracking-wide"
          >
            Connect Wallet
          </button>

          <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
            Supply-side lending only. No leverage. No impermanent loss.
          </p>
        </div>

        {/* Stats Strip */}
        <div className="animate-fade-up-3 grid grid-cols-3 gap-3 w-full max-w-sm">
          {[
            { value: '4', label: 'Protocols', icon: '{}' },
            { value: '8', label: 'Assets', icon: '$' },
            { value: '24/7', label: 'Monitoring', icon: '#' },
          ].map((stat) => (
            <div key={stat.label} className="skeuo-inset p-3 text-center">
              <div className="font-mono text-lg font-bold text-gold-glow">{stat.value}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Protocol Badges */}
        <div className="animate-fade-up-4 flex items-center gap-3">
          {[
            { name: 'Venus', id: 'venus' },
            { name: 'Aave', id: 'aave' },
            { name: 'Lista', id: 'lista' },
          ].map((p) => (
            <div key={p.id} className="skeuo-tag flex items-center gap-1.5">
              {PROTOCOL_LOGOS[p.id] ? (
                <img src={PROTOCOL_LOGOS[p.id]} alt={p.name} width={14} height={14} className="rounded-full" />
              ) : (
                <div className="led-green" />
              )}
              {p.name}
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="w-full max-w-sm space-y-4 mt-6">
          <div className="text-center">
            <h2 className="text-lg font-bold text-emboss">FAQ</h2>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-1">Common Questions</p>
          </div>
          <div className="space-y-2">
            {FAQ_ITEMS.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[11px] text-muted-foreground pb-4">
          Built with AI, verified on-chain.{' '}
          <a href="https://x.com/Magicianafk" target="_blank" rel="noopener noreferrer" className="text-gold-glow hover:underline">
            @Magicianafk
          </a>
        </div>
      </div>
    </main>
  );
}
