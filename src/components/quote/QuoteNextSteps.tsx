import { RotateCcw } from 'lucide-react';
import { PHONE_DISPLAY, PHONE_NUMBER } from '@/lib/contact';
import { actionSize, ghostAction } from '@/components/quote/quoteStyles';
import { QuoteDiscussionAction } from '@/components/quote/QuoteDiscussionAction';
import type { QuoteApiResponse } from '@/lib/quoteSubmission';

/*
 * Phones: the actions become a sticky glass bar in the spot the Continue bar
 * just left (it slides up as that bar unmounts). It sticks to the bottom while
 * the result scrolls and settles in place after the price breakdown.
 */
export function QuoteNextSteps({
  quote,
  onCompareAnotherOption,
}: {
  quote: QuoteApiResponse;
  onCompareAnotherOption: () => void;
}) {
  return (
    <section
      aria-label="Quote actions"
      className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-start phone:sticky phone:bottom-[max(12px,env(safe-area-inset-bottom))] phone:z-30 phone:-mx-1 phone:mt-6 phone:gap-1 phone:rounded-[30px] phone:p-1.5 phone:qm-glass phone:animate-[qm-sheet-up_0.55s_var(--qm-ease-spring)_0.12s_both]"
    >
      {quote.discussionToken ? (
        <QuoteDiscussionAction
          key={quote.id}
          quoteId={quote.id}
          actionToken={quote.discussionToken}
        />
      ) : (
        <p className="text-sm leading-6 text-white/70 phone:px-3 phone:pb-1 phone:pt-2 phone:text-center phone:qm-footnote phone:text-[var(--qm-label-2)]">
          Ready to schedule? Call or text David at{' '}
          <a href={`tel:${PHONE_NUMBER}`} className="underline underline-offset-2">
            {PHONE_DISPLAY}
          </a>
          .
        </p>
      )}
      <button
        type="button"
        onClick={onCompareAnotherOption}
        className={`${ghostAction} ${actionSize} min-h-11 w-full shrink-0 xl:w-auto phone:qm-capsule phone:min-h-11! phone:font-medium! phone:bg-[var(--qm-fill-2)] phone:text-[var(--qm-label)]`}
      >
        <RotateCcw
          className="h-4 w-4 shrink-0 phone:size-[1.125rem] phone:text-[var(--accent-light)]"
          aria-hidden="true"
        />
        Compare another option
      </button>
    </section>
  );
}
