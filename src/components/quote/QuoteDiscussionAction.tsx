import { useCallback, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { useQuoteDiscussion } from '@/lib/useQuoteDiscussion';
import { triggerHaptic } from '@/lib/haptics';
import { compactMotionAllowed } from '@/lib/useCompactViewport';
import { actionSize, primaryAction } from '@/components/quote/quoteStyles';
import { QuoteCelebration } from '@/components/quote/QuoteCelebration';

/* Phones: the saved request settles into a success-tinted capsule. */
const phoneSavedCapsule =
  'phone:bg-[color-mix(in_srgb,var(--qm-success)_17%,transparent)] phone:text-[var(--qm-success)] phone:shadow-[inset_0_0_0_0.5px_color-mix(in_srgb,var(--qm-success)_42%,transparent)] phone:animate-[qm-select_0.42s_var(--qm-ease-bounce)]';

export function QuoteDiscussionAction({ quoteId, actionToken }: {
  quoteId: string;
  actionToken: string;
}) {
  const { state, requestDiscussion } = useQuoteDiscussion(quoteId, actionToken);
  const saved = state.status === 'saved';
  const sending = state.status === 'sending';
  const expired = state.status === 'error' && state.expired;
  // Decided at tap time: only phones with motion allowed get the burst.
  const [celebrate, setCelebrate] = useState(false);
  const endCelebration = useCallback(() => setCelebrate(false), []);

  return (
    <div className="min-w-0 flex-1 phone:relative">
      <button
        type="button"
        onClick={() => {
          // Haptics only play inside the tap gesture, so this cannot wait for the save.
          triggerHaptic('success');
          setCelebrate(compactMotionAllowed());
          void requestDiscussion();
        }}
        disabled={sending || saved || expired}
        className={`${primaryAction} ${actionSize} min-h-11 w-full disabled:cursor-default disabled:opacity-70 phone:qm-capsule phone:px-4! phone:text-center ${
          saved ? phoneSavedCapsule : 'phone:qm-capsule-accent'
        } ${sending || saved ? 'phone:opacity-100!' : ''}`}
      >
        {saved ? (
          <Check
            className="h-4 w-4 shrink-0 phone:size-5 phone:animate-[qm-pop_0.42s_var(--qm-ease-bounce)_0.06s_both]"
            aria-hidden="true"
          />
        ) : null}
        {sending ? (
          <span
            aria-hidden="true"
            className="hidden size-[1.125rem] shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent phone:inline-block"
          />
        ) : null}
        <span>{saved ? 'David knows you’re ready' : sending ? 'Letting David know…' : 'Ready to schedule this build'}</span>
        {!saved && !sending ? <ArrowRight className="h-4 w-4 shrink-0 phone:hidden" aria-hidden="true" /> : null}
      </button>
      {saved ? (
        <p
          className="mt-3 text-sm text-white/70 phone:mt-1.5 phone:px-3 phone:pb-1 phone:text-center phone:qm-footnote phone:text-[var(--qm-label-2)] phone:animate-[qm-fade_0.35s_ease_0.12s_both]"
          role="status"
        >
          David now knows you want to schedule this build and will contact you as soon as
          possible to finalize the details.
        </p>
      ) : null}
      {state.status === 'error' ? (
        <p
          className="mt-3 text-sm text-amber-100 phone:mt-1.5 phone:px-3 phone:pb-1 phone:text-center phone:qm-footnote phone:text-[var(--qm-warning)] phone:animate-[qm-fade_0.3s_ease_both]"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}
      {saved && celebrate ? <QuoteCelebration onDone={endCelebration} /> : null}
    </div>
  );
}
