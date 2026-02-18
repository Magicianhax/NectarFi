'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { PROTOCOL_LOGOS, CHAIN_LOGOS } from '@/lib/logos';
import { LoadingSplash } from '@/components/loading-splash';

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
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden">
      {/* Radial glow behind the panel */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(240,185,11,0.08)_0%,transparent_70%)]" />
        <div className="absolute left-1/4 top-0 w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(240,185,11,0.03)_0%,transparent_70%)]" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-10 px-6 max-w-xl">
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
      </div>
    </main>
  );
}
