'use client';

import { useEffect, type CSSProperties } from 'react';

/*
 * One-shot confetti burst for a committed Ready to schedule request (phones only).
 * Pure CSS (`qm-confetti` keyframes read --qm-x/--qm-y/--qm-r); decorative,
 * aria-hidden and click-through. The caller mounts it only when
 * `compactMotionAllowed()` and unmounts it through `onDone`.
 *
 * Particles are generated once at module load from a deterministic sequence,
 * so renders stay pure and every burst looks the same.
 */
const COLORS = [
  'var(--accent)',
  'var(--accent-light)',
  '#ffd60a',
  '#ffffff',
  '#ff9f0a',
] as const;

const COUNT = 26;
/** The burst is anchored on the middle of a 52px capsule. */
const ORIGIN_SPREAD = 112;

type Particle = {
  originX: number;
  x: number;
  y: number;
  rotate: number;
  delay: number;
  duration: number;
  width: number;
  height: number;
  radius: number;
  color: string;
};

const PARTICLES: readonly Particle[] = Array.from({ length: COUNT }, (_, i) => {
  const across = (i / (COUNT - 1)) * 2 - 1; // -1 (left edge) .. 1 (right edge)
  const jitter = ((i * 0.618034) % 1) - 0.5; // golden-ratio scatter, -0.5 .. 0.5
  const angle = ((-90 + across * 62 + jitter * 22) * Math.PI) / 180; // upward fan
  const distance = 88 + ((i * 37) % 70);
  const dot = i % 3 === 0;
  return {
    originX: Math.round(across * ORIGIN_SPREAD),
    x: Math.round(Math.cos(angle) * distance * 1.25),
    y: Math.round(Math.sin(angle) * distance),
    rotate: (i % 2 ? 1 : -1) * (220 + ((i * 53) % 320)),
    delay: (i * 7) % 90,
    duration: 820 + ((i * 41) % 380),
    width: dot ? 7 : 5,
    height: dot ? 7 : 11,
    radius: dot ? 9999 : 1.5,
    color: COLORS[i % COLORS.length],
  };
});

const LIFETIME_MS = Math.max(...PARTICLES.map((p) => p.delay + p.duration)) + 80;

export function QuoteCelebration({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, LIFETIME_MS);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-[26px] z-10 hidden size-0 phone:block"
    >
      {PARTICLES.map((particle, index) => (
        <span
          key={index}
          className="absolute block animate-[qm-confetti_1s_cubic-bezier(0.12,0.8,0.32,1)_both] will-change-transform"
          style={
            {
              left: particle.originX - particle.width / 2,
              top: -particle.height / 2,
              width: particle.width,
              height: particle.height,
              borderRadius: particle.radius,
              backgroundColor: particle.color,
              animationDuration: `${particle.duration}ms`,
              animationDelay: `${particle.delay}ms`,
              '--qm-x': `${particle.x}px`,
              '--qm-y': `${particle.y}px`,
              '--qm-r': `${particle.rotate}deg`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}
