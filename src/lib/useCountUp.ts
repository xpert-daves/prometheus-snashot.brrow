'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { compactMotionAllowed } from '@/lib/useCompactViewport';

/** Closed form of cubic-bezier(0.16, 1, 0.3, 1) ("ease-out expo"). */
function easeOutExpo(t: number) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export type CountUpOptions = {
  /** Fraction of the target the count starts from. */
  from?: number;
  /** Count duration in ms. */
  duration?: number;
  /** Time in ms the start value holds before counting. */
  delay?: number;
};

/**
 * One-shot count-up for a number revealed on the phone layout (88% -> 100%).
 *
 * Only animates when `compactMotionAllowed()` is true as the component mounts,
 * so desktop, reduced motion, SSR and tests always get `animating: false` and
 * render the final value as plain text from the first render.
 *
 * While `animating`, render an EMPTY aria-hidden element with `ref` (the hook
 * writes its text each frame without re-rendering) beside an sr-only final
 * value. When the count settles `animating` flips to false: render the plain
 * final value again, which unmounts the animated copy.
 *
 * `format` must be stable (a module-level function).
 */
export function useCountUp<T extends HTMLElement = HTMLSpanElement>(
  target: number,
  format: (value: number) => string,
  { from = 0.88, duration = 650, delay = 0 }: CountUpOptions = {}
) {
  const [animating, setAnimating] = useState(
    () => Number.isFinite(target) && target > 0 && compactMotionAllowed()
  );
  const ref = useRef<T>(null);

  // Layout effect: the start value is written before the first paint.
  useLayoutEffect(() => {
    if (!animating) return;
    const node = ref.current;
    if (!node) {
      setAnimating(false);
      return;
    }

    const start = target * from;
    node.textContent = format(start);

    let frame = 0;
    let startedAt: number | null = null;
    const tick = (now: number) => {
      startedAt ??= now;
      const progress =
        duration > 0 ? Math.min(1, Math.max(0, (now - startedAt - delay) / duration)) : 1;
      node.textContent = format(start + (target - start) * easeOutExpo(progress));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        // Terminal: hand the final value back to React as plain text.
        setAnimating(false);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animating, target, format, from, duration, delay]);

  return { animating, ref };
}
