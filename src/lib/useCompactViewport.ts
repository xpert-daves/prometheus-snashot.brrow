import { useSyncExternalStore } from 'react';

/** Matches the `phone:` Tailwind variant: the phone layout of the quote app. */
export const COMPACT_VIEWPORT_QUERY = '(width < 48rem)';

/** Guarded matchMedia: false on the server and wherever matchMedia is missing (jsdom). */
export function mq(query: string): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(query)?.matches === true
  );
}

/**
 * Behaviour-only check for the phone layout (focus targets, motion choices).
 * Layout itself is CSS-driven so server and client markup always match.
 */
export function isCompactViewport(): boolean {
  return mq(COMPACT_VIEWPORT_QUERY);
}

/**
 * True only when motion is positively allowed. Uses the `no-preference` query so
 * environments that answer every query with `false` (tests, SSR) skip animation.
 */
export function motionAllowed(): boolean {
  return mq('(prefers-reduced-motion: no-preference)');
}

/** Phone layout with motion allowed: gate JS-driven animation on this. */
export function compactMotionAllowed(): boolean {
  return isCompactViewport() && motionAllowed();
}

export function prefersReducedMotion(): boolean {
  return mq('(prefers-reduced-motion: reduce)');
}

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const query = window.matchMedia(COMPACT_VIEWPORT_QUERY);
  if (!query || typeof query.addEventListener !== 'function') return () => {};
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

export function useCompactViewport(): boolean {
  return useSyncExternalStore(subscribe, isCompactViewport, () => false);
}
