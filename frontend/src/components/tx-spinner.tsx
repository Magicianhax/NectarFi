'use client';

import { useEffect, useState } from 'react';

const STEPS = [
  'Sending transaction...',
  'Confirming on-chain...',
  'Almost there...',
];

export function TxSpinner({ text, className }: { text?: string; className?: string }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (text) return; // custom text overrides auto-steps
    const t1 = setTimeout(() => setStep(1), 4000);
    const t2 = setTimeout(() => setStep(2), 15000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [text]);

  return (
    <span className={`inline-flex items-center gap-2 ${className || ''}`}>
      <svg className="animate-spin shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
      </svg>
      <span className="animate-pulse">{text || STEPS[step]}</span>
    </span>
  );
}
