import { History } from 'lucide-react';
import PriceBreakdown from '@/components/PriceBreakdown';
import DimensionDivider from '@/components/motif/DimensionDivider';
import { QuoteSectionCard } from '@/components/quote/QuoteSectionCard';
import { EMAIL, PHONE_DISPLAY, PHONE_NUMBER } from '@/lib/contact';
import type { QuoteApiResponse } from '@/lib/quoteSubmission';
import { useCountUp } from '@/lib/useCountUp';

function formatUSD(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

export type QuotePreviousEstimate = {
  total: number;
  /** Short config label, e.g. "10 × 12 ft · Gable". */
  summary: string;
};

/** Phones: accent check that draws itself in, with one soft ring pulsing out. */
function ResultCheck() {
  return (
    <span
      aria-hidden="true"
      className="relative hidden size-[3.25rem] place-items-center rounded-full [background:var(--qm-accent-fill)] shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_10px_28px_-8px_rgb(var(--accent-glow-rgb)/0.75)] phone:-order-2 phone:grid phone:animate-[qm-pop_0.5s_var(--qm-ease-bounce)_both]"
    >
      <span className="absolute inset-0 rounded-full border-2 border-[var(--accent-light)] animate-[qm-ring-out_0.75s_var(--qm-ease-out)_0.28s_both]" />
      <svg viewBox="0 0 24 24" fill="none" className="size-7">
        <path
          d="M5.5 12.5l4.25 4.25L18.5 8"
          pathLength={1}
          stroke="var(--qm-accent-ink)"
          strokeWidth={2.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="1"
          className="animate-[qm-check-draw_0.42s_var(--qm-ease-out)_0.24s_both]"
        />
      </svg>
    </span>
  );
}

/** Phones: the option the customer left via "Compare another option", with the signed difference. */
function PreviousEstimateRow({
  previous,
  total,
}: {
  previous: QuotePreviousEstimate;
  total: number;
}) {
  const delta = Math.round(total) - Math.round(previous.total);
  const deltaLabel =
    delta === 0 ? 'Same price' : `${delta > 0 ? '+' : '−'}${formatUSD(Math.abs(delta))}`;
  const deltaDescription =
    delta === 0
      ? null
      : `This option is ${formatUSD(Math.abs(delta))} ${delta > 0 ? 'more' : 'less'}.`;

  return (
    <div className="hidden phone:order-2 phone:-mx-5 phone:-mb-6 phone:mt-6 phone:flex phone:items-center phone:gap-3 phone:self-stretch phone:px-4 phone:py-3 phone:text-left phone:shadow-[inset_0_0.5px_0_var(--qm-sep)] phone:animate-[qm-fade_0.4s_ease_0.36s_both]">
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--qm-fill-2)] text-[var(--qm-label-2)]"
      >
        <History className="size-[1.125rem]" />
      </span>
      <p className="min-w-0 flex-1">
        <span className="block text-[var(--qm-label)] phone:qm-subhead phone:font-semibold!">
          Previous option
        </span>
        <span className="block text-[var(--qm-label-2)] phone:qm-footnote">
          {formatUSD(previous.total)} · {previous.summary}
        </span>
      </p>
      <span
        aria-hidden={deltaDescription ? 'true' : undefined}
        className={`shrink-0 rounded-full px-2.5 py-1 tabular-nums phone:qm-footnote phone:font-semibold! ${
          delta < 0
            ? 'bg-[color-mix(in_srgb,var(--qm-success)_16%,transparent)] text-[var(--qm-success)]'
            : 'bg-[var(--qm-fill)] text-[var(--qm-label)]'
        }`}
      >
        {deltaLabel}
      </span>
      {deltaDescription ? <span className="sr-only">{deltaDescription}</span> : null}
    </div>
  );
}

export function QuoteResultPanel({
  quote,
  wallHeight,
  attemptedDiscountCode,
  previousEstimate,
  foundation,
}: {
  quote: QuoteApiResponse;
  wallHeight: 6 | 7 | 8;
  attemptedDiscountCode?: string;
  /** The estimate the customer left via "Compare another option" (phones show a comparison row). */
  previousEstimate?: QuotePreviousEstimate | null;
  /** The quoted foundation. An anchored slab is left out of the subtotal. */
  foundation?: string;
}) {
  const total = formatUSD(quote.total);
  // Phones with motion allowed count 88% -> 100%; everywhere else (desktop,
  // reduced motion, tests) the final value renders as plain text immediately.
  const { animating: priceCounting, ref: priceCountRef } = useCountUp<HTMLSpanElement>(
    quote.total,
    formatUSD,
    { delay: 160 }
  );
  // PriceBreakdown hides a $0 discount, so a code that missed would otherwise vanish.
  const missedDiscountCode =
    attemptedDiscountCode?.trim() && quote.breakdown.discount === 0
      ? attemptedDiscountCode.trim()
      : null;

  return (
    <QuoteSectionCard title="Your Quote" code="EST · DWG 210-Q" className="mt-4 phone:mt-2">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 phone:flex-col phone:flex-nowrap phone:items-stretch phone:gap-0">
        {/*
          Phones: an inset hero card. Visual order (flex `order`): check, "ready"
          line, price, label, previous-option row. The decorative phone-only nodes
          come last in the DOM so the desktop nodes keep their positions.
        */}
        <div className="phone:flex phone:flex-col phone:items-center phone:overflow-clip phone:rounded-[var(--qm-radius-group)] phone:px-5 phone:pb-6 phone:pt-7 phone:text-center phone:shadow-[inset_0_0.5px_0_rgb(255_255_255/0.08)] phone:[background:radial-gradient(120%_85%_at_50%_0%,rgb(var(--accent-glow-rgb)/0.17),transparent_66%),var(--qm-group)]">
          <p className="motif-spec text-white/50 phone:order-1 phone:mt-1 phone:qm-subhead phone:text-[var(--qm-label-2)] phone:animate-[qm-rise_0.45s_var(--qm-ease-spring)_0.22s_both]">
            Estimated build subtotal
          </p>
          <p className="brand-display hero-accent-text mt-1 text-4xl text-[var(--accent-light)] sm:text-5xl phone:mt-1.5 phone:qm-numeral phone:text-[3.25rem] phone:leading-[3.5rem] phone:text-[var(--qm-label)] phone:animate-[qm-rise_0.45s_var(--qm-ease-spring)_0.16s_both]">
            {priceCounting ? (
              <>
                <span className="sr-only">{total}</span>
                {/* The invisible final value holds the width; the count is right-aligned on it, so nothing shifts when it settles. */}
                <span aria-hidden="true" className="relative inline-block whitespace-nowrap">
                  <span className="invisible">{total}</span>
                  <span ref={priceCountRef} className="absolute inset-y-0 right-0" />
                </span>
              </>
            ) : (
              total
            )}
          </p>
          {previousEstimate ? (
            <PreviousEstimateRow previous={previousEstimate} total={quote.total} />
          ) : null}
          <ResultCheck />
          <p
            aria-hidden="true"
            className="hidden phone:-order-1 phone:mt-3.5 phone:block phone:qm-headline phone:text-[var(--qm-label)] phone:animate-[qm-rise_0.45s_var(--qm-ease-spring)_0.12s_both]"
          >
            Your estimate is ready
          </p>
        </div>
        <p className="max-w-xs text-sm leading-6 text-white/55 phone:max-w-none phone:qm-section-footer phone:animate-[qm-fade_0.4s_ease_0.3s_both]">
          {/* The same for every estimate, first or compared: each one reaches David. */}
          David has a copy of this estimate. Delivery, travel, and site costs are
          pending location verification and are not included. We will confirm them
          before a final quote.
        </p>
      </div>
      <DimensionDivider className="mt-5 phone:hidden" tone="quiet" label="Itemized below" />
      <PriceBreakdown
        breakdown={quote.breakdown}
        total={quote.total}
        wallHeight={wallHeight}
        deliveryPricingStatus={
          quote.estimate?.delivery.status ?? 'pending_verification'
        }
        foundation={foundation}
      />
      {foundation === 'anchored_slab' ? (
        <p className="mt-3 text-sm leading-6 text-white/65 phone:mt-2 phone:qm-section-footer">
          Your anchored slab isn&apos;t in this subtotal. Text photos of the spot to{' '}
          <a href={`sms:${PHONE_NUMBER}`} className="underline underline-offset-2">
            {PHONE_DISPLAY}
          </a>{' '}
          or email them to{' '}
          <a href={`mailto:${EMAIL}`} className="underline underline-offset-2">
            {EMAIL}
          </a>
          . Depending on what they show, David will most likely need to see the site in
          person to price the slab.
        </p>
      ) : null}
      {missedDiscountCode ? (
        <p className="mt-3 text-sm leading-6 text-white/65 phone:mt-2 phone:qm-section-footer">
          Code {missedDiscountCode} wasn&apos;t applied to this estimate. Mention it
          when we follow up.
        </p>
      ) : null}
    </QuoteSectionCard>
  );
}
