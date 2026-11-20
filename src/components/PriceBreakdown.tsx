"use client";
import { QuoteBreakdown } from "@/lib/pricing/calculateQuote";
import { ReceiptText, BadgeDollarSign } from "lucide-react";

function formatUSD(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

/*
 * Phones (< 48rem): the table reads as an iOS inset grouped list. Only padding,
 * type, colour and hairlines change; table/row/cell display is untouched so
 * VoiceOver keeps its row and column context. Hairlines are cell backgrounds
 * on every row after the first, inset 16px under the label like UIKit.
 */
const phoneRow = "phone:border-0";
const phoneHairline =
  "phone:[tr+tr>&]:[background:linear-gradient(var(--qm-sep),var(--qm-sep))_0_0/100%_0.5px_no-repeat]";
const phoneHairlineInset =
  "phone:[tr+tr>&]:[background:linear-gradient(var(--qm-sep),var(--qm-sep))_1rem_0/calc(100%_-_1rem)_0.5px_no-repeat]";
const phoneLabelCell = `phone:py-[15px] phone:pl-4 phone:pr-2 phone:qm-body ${phoneHairlineInset}`;
const phoneValueCell = `phone:whitespace-nowrap phone:py-[15px] phone:pl-2 phone:pr-4 phone:tabular-nums ${phoneHairline}`;
/* The total row: full-width hairline over a faint accent wash. */
const phoneTotalCell =
  "phone:py-[15px] phone:[background:linear-gradient(var(--qm-sep),var(--qm-sep))_0_0/100%_0.5px_no-repeat,rgb(var(--accent-glow-rgb)/0.07)]";

function LineItem({ label, amount }: { label: string; amount: number }) {
  return (
    <tr className={`border-b border-white/8 ${phoneRow}`}>
      <td className={`py-2.5 pr-3 text-white/75 ${phoneLabelCell} phone:text-[var(--qm-label)]`}>{label}</td>
      <td className={`py-2.5 pl-3 text-right font-mono text-xs tabular-nums text-white/90 sm:text-sm ${phoneValueCell} phone:qm-body phone:text-[var(--qm-label-2)]`}>
        {formatUSD(amount)}
      </td>
    </tr>
  );
}

function PendingLineItem({ label }: { label: string }) {
  return (
    <tr className={`border-b border-white/8 ${phoneRow}`}>
      <td className={`py-2.5 pr-3 text-white/75 ${phoneLabelCell} phone:text-[var(--qm-label)]`}>{label}</td>
      <td className={`motif-spec py-2.5 pl-3 text-right text-white/60 ${phoneValueCell} phone:qm-subhead phone:text-[var(--qm-label-2)]`}>
        Pending verification
      </td>
    </tr>
  );
}

/** A selection the online estimate leaves out and David prices himself. */
function UnpricedLineItem({ label, note }: { label: string; note: string }) {
  return (
    <tr className={`border-b border-white/8 ${phoneRow}`}>
      <td className={`py-2.5 pr-3 italic text-white/50 ${phoneLabelCell} phone:not-italic phone:text-[var(--qm-label)]`}>{label}</td>
      <td className={`motif-spec py-2.5 pl-3 text-right text-white/60 ${phoneValueCell} phone:qm-subhead phone:text-[var(--qm-label-2)]`}>
        {note}
      </td>
    </tr>
  );
}

export default function PriceBreakdown({
  breakdown,
  total,
  onAccept,
  wallHeight,
  deliveryPricingStatus,
  foundation,
}: {
  breakdown: QuoteBreakdown;
  total: number;
  onAccept?: () => void;
  wallHeight?: 6 | 7 | 8;
  deliveryPricingStatus?: 'pending_verification';
  /** The quoted foundation; an anchored slab is listed but never priced here. */
  foundation?: string;
}) {
  const wallHeightLabel =
    wallHeight === 8
      ? 'Wall height upgrade (8 ft)'
      : 'Wall height upgrade';

  return (
    <div className="mt-4 text-sm phone:mt-7 phone:animate-[qm-rise_0.5s_var(--qm-ease-spring)_0.22s_both]">
      <div className="flex items-center gap-2 text-white/70">
        <ReceiptText className="h-4 w-4 opacity-80 phone:hidden" aria-hidden />
        <p className="motif-spec phone:qm-section-header">Price Breakdown</p>
      </div>

      <div className="mt-3 border border-white/12 bg-black/20 px-4 py-1 phone:mt-0 phone:overflow-clip phone:rounded-[var(--qm-radius-group)] phone:border-0 phone:bg-[var(--qm-group)] phone:p-0 phone:shadow-[inset_0_0.5px_0_rgb(255_255_255/0.06)]">
        <table className="w-full border-collapse">
          <tbody>
            {breakdown.base > 0 && <LineItem label="Base" amount={breakdown.base} />}
            {breakdown.wallHeight > 0 && (
              <LineItem label={wallHeightLabel} amount={breakdown.wallHeight} />
            )}
            {breakdown.roof > 0 && <LineItem label="Roof" amount={breakdown.roof} />}
            {breakdown.siding > 0 && (
              <LineItem label="Siding" amount={breakdown.siding} />
            )}
            {breakdown.door > 0 && <LineItem label="Door" amount={breakdown.door} />}
            {breakdown.windows > 0 && (
              <LineItem label="Windows" amount={breakdown.windows} />
            )}
            {breakdown.addOns > 0 && (
              <LineItem label="Upgrades" amount={breakdown.addOns} />
            )}
            {breakdown.interiorUpgrades.map((name: string) => (
              <UnpricedLineItem key={name} label={name} note="Priced per job" />
            ))}
            {foundation === 'anchored_slab' && (
              <UnpricedLineItem label="Anchored slab" note="Priced after site review" />
            )}
            {deliveryPricingStatus === 'pending_verification' ? (
              <PendingLineItem label="Delivery & site costs" />
            ) : breakdown.delivery > 0 ? (
              <LineItem label="Distance surcharge" amount={breakdown.delivery} />
            ) : null}
            {breakdown.discount > 0 && (
              <tr className={`border-b border-white/8 ${phoneRow}`}>
                <td className={`py-2.5 pr-3 text-emerald-300 ${phoneLabelCell} phone:text-[var(--qm-success)]`}>Discount</td>
                <td className={`py-2.5 pl-3 text-right font-mono text-xs tabular-nums text-emerald-300 sm:text-sm ${phoneValueCell} phone:qm-body phone:text-[var(--qm-success)]`}>
                  -{formatUSD(breakdown.discount)}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td className={`brand-subheading py-3 pr-3 uppercase tracking-wide ${phoneTotalCell} phone:pl-4 phone:pr-2 phone:qm-headline phone:text-[var(--qm-label)]`}>
                {deliveryPricingStatus === 'pending_verification'
                  ? 'Build subtotal'
                  : 'Total'}
              </td>
              <td className={`brand-display py-3 pl-3 text-right text-lg tabular-nums text-[var(--accent-light)] ${phoneTotalCell} phone:whitespace-nowrap phone:pl-2 phone:pr-4 phone:qm-numeral phone:text-[1.25rem] phone:leading-[22px]`}>
                {formatUSD(total)}
              </td>
            </tr>
          </tfoot>
        </table>

        {onAccept && (
          <div className="pb-3 pt-1 text-center phone:p-3">
            <button
              type="button"
              onClick={onAccept}
              className="brand-button inline-flex items-center justify-center gap-2 rounded-none bg-[var(--primary)] px-4 py-2 text-sm text-[var(--accent-contrast)] transition-colors hover:bg-[var(--primary-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] phone:w-full phone:qm-capsule phone:qm-capsule-accent"
            >
              <BadgeDollarSign className="h-4 w-4" aria-hidden />
              Accept Quote &amp; Schedule Build Day
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
