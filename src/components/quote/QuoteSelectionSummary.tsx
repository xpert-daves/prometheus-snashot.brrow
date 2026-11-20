import type { CSSProperties } from 'react';
import { brandColors, roofLabels, type QuoteFormParams } from '@/lib/quoteForm';
import { getStructureLabel } from '@/lib/quoteFlow';
import type { QuoteApiResponse } from '@/lib/quoteSubmission';

function formatUSD(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

/*
 * Phones: the <dl> becomes ONE caption line under the preview
 * ("Storage Shed / Garage · 8 × 10 ft · Gable · Forest"). Terms go sr-only,
 * values sit inline separated by drawn (text-free) dots, and only the
 * building name truncates so the details the user is changing stay visible.
 */
const phoneRow =
  "phone:flex-none phone:items-center phone:gap-0 phone:p-0 phone:not-first:before:mx-[7px] phone:not-first:before:size-[3px] phone:not-first:before:shrink-0 phone:not-first:before:rounded-full phone:not-first:before:bg-(--qm-label-3) phone:not-first:before:content-['']";
const phoneValue = 'phone:qm-subhead phone:min-w-0 phone:text-left';

function SpecRow({
  label,
  value,
  mask = false,
  className = '',
  valueClassName = 'phone:text-(--qm-label-2)',
  valueStyle,
}: {
  label: string;
  value: string;
  mask?: boolean;
  /** Extra (phone:) classes for the row. */
  className?: string;
  /** Phone tone of the value (defaults to the secondary label colour). */
  valueClassName?: string;
  valueStyle?: CSSProperties;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1.5 ${phoneRow} ${className}`}>
      <dt className="motif-spec shrink-0 text-white/60 phone:sr-only">{label}</dt>
      <dd
        className={`min-w-0 truncate text-right font-mono text-xs tabular-nums text-white/85 sm:text-sm ${phoneValue} ${valueClassName}`}
        style={valueStyle}
        data-clarity-mask={mask ? 'true' : undefined}
      >
        {value}
      </dd>
    </div>
  );
}

export function QuoteSelectionSummary({
  draft,
  deliveryZip,
  quote,
  showWallHeight,
}: {
  draft: QuoteFormParams;
  deliveryZip: string;
  quote: QuoteApiResponse | null;
  showWallHeight: boolean;
}) {
  const namedColor = brandColors.find((color) => color.hex === draft.color);

  return (
    <div className="space-y-3 text-xs sm:text-sm phone:space-y-0">
      <div className="flex items-center justify-between gap-2 phone:hidden">
        <span className="motif-spec text-white/75">Your selection</span>
        <span aria-hidden="true" className="h-px flex-1 bg-white/10" />
      </div>
      <dl className="divide-y divide-white/8 phone:flex phone:min-w-0 phone:items-center phone:divide-y-0 phone:overflow-hidden phone:whitespace-nowrap">
        <SpecRow
          label="Type"
          value={getStructureLabel(draft.structureType)}
          className="phone:min-w-0 phone:flex-initial"
          valueClassName="phone:truncate phone:font-medium! phone:text-(--qm-label)"
        />
        <SpecRow label="Size" value={`${draft.width} × ${draft.length} ft`} />
        <SpecRow
          label="Roof"
          value={roofLabels[draft.roofStyle as keyof typeof roofLabels] || '—'}
        />
        {showWallHeight ? (
          // The 3D preview and the wall height control already show it; keeps the line short.
          <SpecRow label="Wall height" value={`${draft.wallHeight} ft`} className="phone:hidden" />
        ) : null}
        <SpecRow
          label="Color"
          value={namedColor?.name || draft.color}
          // Phones: only a picked (named) colour, led by a small swatch; never a raw hex.
          className={namedColor ? '' : 'phone:hidden'}
          valueClassName="phone:text-(--qm-label-2) phone:before:mr-1.5 phone:before:inline-block phone:before:size-2.5 phone:before:rounded-full phone:before:bg-(--qm-swatch) phone:before:align-[-0.5px] phone:before:shadow-[inset_0_0_0_0.5px_rgb(255_255_255/0.35)] phone:before:content-['']"
          valueStyle={namedColor ? ({ '--qm-swatch': namedColor.hex } as CSSProperties) : undefined}
        />
        {/* Echoes the typed, autofilled or prefilled address; masked in Clarity in every masking mode. */}
        <SpecRow
          label="Build location"
          value={draft.deliveryAddress || deliveryZip || 'ZIP TBD'}
          mask
          className="phone:hidden"
        />
      </dl>
      {quote ? (
        <div className="motif-corners border border-[var(--accent-dark)] bg-[var(--hi-accent-soft)] p-3 text-center phone:hidden">
          <p className="motif-spec text-white/55">Estimated build subtotal</p>
          <p className="brand-display mt-0.5 text-2xl text-[var(--accent-light)]">
            {formatUSD(quote.total)}
          </p>
          <p className="mt-1 text-[11px] leading-4 text-white/55">
            {draft.foundation === 'anchored_slab'
              ? 'Delivery, site & slab costs confirmed separately'
              : 'Delivery & site costs pending verification'}
          </p>
        </div>
      ) : null}
    </div>
  );
}
