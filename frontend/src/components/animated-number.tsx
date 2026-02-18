'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  format?: 'currency' | 'token' | 'percent';
  decimals?: number;
  duration?: number;
  className?: string;
  prefix?: string;
}

export function AnimatedNumber({
  value,
  format = 'currency',
  decimals = 2,
  duration = 800,
  className,
  prefix = '',
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const prevValue = useRef(value);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const from = prevValue.current;
    const to = value;
    if (from === to) return;

    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * eased;
      setDisplay(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        prevValue.current = to;
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  let formatted: string;
  if (format === 'currency') {
    formatted = `${prefix}$${display.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  } else if (format === 'percent') {
    formatted = `${display.toFixed(decimals)}%`;
  } else {
    formatted = display < 0.0001 && display > 0
      ? '<0.0001'
      : `${prefix}${display.toFixed(decimals)}`;
  }

  return <span className={className}>{formatted}</span>;
}
