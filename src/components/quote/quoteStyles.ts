import clsx from 'clsx';

/**
 * Shared class recipes for the quote tool's work-order aesthetic:
 * sharp drafting geometry, mono spec labels, hairline rules, and the
 * blaze accent reserved for committed selections and primary actions.
 */

export const specLabel = 'motif-spec block text-white/55';

export const specField =
  'mt-1.5 mb-0 w-full rounded-none border border-white/15 bg-black/30 p-2.5 text-sm text-[var(--foreground)] transition-colors placeholder:text-white/60 focus:border-[var(--accent)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)]';

export const specSelect = clsx(specField, 'appearance-none pr-9');

/** Small selectable chip (size presets, wall heights, radius shortcuts). */
export function specChip(selected: boolean, extra?: string) {
  return clsx(
    'motif-spec rounded-none border px-3 py-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]',
    selected
      ? 'border-[var(--accent)] bg-[var(--hi-accent-soft)] text-[var(--accent-light)]'
      : 'border-white/15 bg-black/25 text-white/70 hover:border-white/40 hover:text-white',
    extra
  );
}

/** Larger selectable tile (doors, roof profiles, window packages). */
export function specTile(selected: boolean, extra?: string) {
  return clsx(
    'rounded-none border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]',
    selected
      ? 'border-[var(--accent)] bg-[var(--hi-accent-soft)] text-[var(--accent-light)]'
      : 'border-white/15 bg-black/25 text-white/80 hover:border-white/40 hover:text-white',
    extra
  );
}

/*
 * Action recipes carry no padding: Tailwind resolves conflicting utilities
 * by stylesheet order, so call sites could not reliably override a baked-in
 * size. Compose with `actionSize` (or explicit px/py) at the call site.
 */
export const actionSize = 'px-5 py-2.5';

export const primaryAction =
  'brand-button inline-flex items-center justify-center gap-2 rounded-none bg-[var(--primary)] text-sm text-[var(--accent-contrast)] transition-colors hover:bg-[var(--primary-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50';

/** The money button — hero CTA gradient with the accent glow. */
export const heroAction =
  'brand-button hero-primary-cta inline-flex items-center justify-center gap-2 rounded-none text-sm text-[var(--accent-contrast)] transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50';

export const ghostAction =
  'brand-button inline-flex items-center justify-center gap-2 rounded-none border border-white/20 bg-white/[0.04] text-sm text-white/85 transition-colors hover:border-white/40 hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50';
