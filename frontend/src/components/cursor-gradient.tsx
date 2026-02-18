'use client';

import { useEffect, useRef } from 'react';

interface Orb {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  size: number;
  color: string;
  offsetX: number;
  offsetY: number;
}

export function CursorGradient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const orbsRef = useRef<Orb[]>([]);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    orbsRef.current = [
      { x: 0.3, y: 0.3, targetX: 0.5, targetY: 0.5, speed: 0.015, size: 0.45, color: 'rgba(245, 158, 11, 0.07)', offsetX: -0.08, offsetY: -0.06 },
      { x: 0.7, y: 0.6, targetX: 0.5, targetY: 0.5, speed: 0.008, size: 0.55, color: 'rgba(59, 130, 246, 0.05)', offsetX: 0.12, offsetY: 0.08 },
      { x: 0.5, y: 0.2, targetX: 0.5, targetY: 0.5, speed: 0.012, size: 0.4, color: 'rgba(139, 92, 246, 0.06)', offsetX: -0.05, offsetY: -0.12 },
      { x: 0.6, y: 0.8, targetX: 0.5, targetY: 0.5, speed: 0.006, size: 0.35, color: 'rgba(16, 185, 129, 0.04)', offsetX: 0.1, offsetY: 0.1 },
    ];

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    function onMouseMove(e: MouseEvent) {
      mouseRef.current.x = e.clientX / window.innerWidth;
      mouseRef.current.y = e.clientY / window.innerHeight;
    }

    function animate() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const { x: mx, y: my } = mouseRef.current;

      for (const orb of orbsRef.current) {
        orb.targetX = mx + orb.offsetX;
        orb.targetY = my + orb.offsetY;
        orb.x += (orb.targetX - orb.x) * orb.speed;
        orb.y += (orb.targetY - orb.y) * orb.speed;

        const cx = orb.x * canvas.width;
        const cy = orb.y * canvas.height;
        const r = orb.size * Math.max(canvas.width, canvas.height);

        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        gradient.addColorStop(0, orb.color);
        gradient.addColorStop(0.5, orb.color.replace(/[\d.]+\)$/, '0.02)'));
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      rafRef.current = requestAnimationFrame(animate);
    }

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouseMove);
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
    />
  );
}
