'use client';

import { useEffect, useState } from 'react';

const HINTS = [
  'Initializing yield engine...',
  'Connecting to BNB Chain...',
  'Loading protocol data...',
  'Preparing your dashboard...',
];

export function LoadingSplash() {
  const [hint, setHint] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setHint((h) => (h + 1) % HINTS.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0c0c0f]">
      {/* Background radial glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(240,185,11,0.06)_0%,transparent_70%)]" />
        <div className="absolute right-1/4 top-1/4 w-[300px] h-[300px] rounded-full bg-[radial-gradient(circle,rgba(240,185,11,0.03)_0%,transparent_70%)] animate-breathe" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Animated logo assembly */}
        <div className="relative w-24 h-24 flex items-center justify-center">
          {/* Outer spinning ring */}
          <div className="absolute inset-0 rounded-full animate-spin-slow">
            <svg viewBox="0 0 96 96" className="w-full h-full">
              <circle
                cx="48" cy="48" r="44"
                fill="none"
                stroke="url(#goldGrad)"
                strokeWidth="1.5"
                strokeDasharray="8 16"
                strokeLinecap="round"
                opacity="0.5"
              />
              <defs>
                <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFD54F" />
                  <stop offset="50%" stopColor="#F0B90B" />
                  <stop offset="100%" stopColor="#C49A09" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Inner spinning ring (reverse) */}
          <div className="absolute inset-3 rounded-full animate-spin-reverse">
            <svg viewBox="0 0 72 72" className="w-full h-full">
              <circle
                cx="36" cy="36" r="32"
                fill="none"
                stroke="rgba(240,185,11,0.2)"
                strokeWidth="1"
                strokeDasharray="6 12"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Center icon */}
          <div className="relative w-14 h-14 bg-gradient-to-br from-[#FFD54F] via-[#F0B90B] to-[#C49A09] rounded-lg flex items-center justify-center shadow-[0_0_30px_rgba(240,185,11,0.3)] animate-float">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0c0c0f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>

          {/* Orbiting dots */}
          <div className="absolute inset-0 animate-spin-slow" style={{ animationDuration: '4s' }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#F0B90B] shadow-[0_0_6px_rgba(240,185,11,0.6)]" />
          </div>
          <div className="absolute inset-0 animate-spin-slow" style={{ animationDuration: '5s', animationDelay: '-2s' }}>
            <div className="absolute bottom-1 right-1 w-1 h-1 rounded-full bg-[#FFD54F] shadow-[0_0_4px_rgba(255,213,79,0.5)]" />
          </div>
        </div>

        {/* Brand name */}
        <div className="animate-fade-up text-center space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-emboss">
            Nectar<span className="text-gold-glow">Fi</span>
          </h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-semibold">
            AI Yield Agent
          </p>
        </div>

        {/* Progress bar */}
        <div className="animate-fade-up-1 w-48">
          <div className="h-[3px] rounded-full bg-white/5 overflow-hidden">
            <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-transparent via-[#F0B90B] to-transparent animate-bar-shimmer" />
          </div>
        </div>

        {/* Rotating hint text */}
        <p
          key={hint}
          className="animate-fade-up text-[11px] text-muted-foreground/70 font-medium tracking-wide"
        >
          {HINTS[hint]}
        </p>
      </div>
    </div>
  );
}
