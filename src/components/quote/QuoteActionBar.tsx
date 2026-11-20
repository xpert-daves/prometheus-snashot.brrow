import { useState, type MouseEvent } from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft } from 'lucide-react';
import { ghostAction, heroAction } from '@/components/quote/quoteStyles';
import type { QuoteFlowStep } from '@/lib/quoteFlow';
import { compactMotionAllowed } from '@/lib/useCompactViewport';

const actionLabels = [
  { visible: 'Continue to Materials', accessible: 'Next: Materials & Options' },
  {
    visible: 'Continue to Contact',
    accessible: 'Next: Build Location & Contact',
  },
] as const;

/*
 * Phones: a floating glass capsule bar. The glass lives on an inner layer, not
 * on the <aside>: a backdrop-filter or transform on an ancestor would re-anchor
 * the `position: fixed` Back button, which phones lift into the nav bar's
 * leading slot. For the same reason the keyboard hide moves `bottom`, not
 * `transform`, and only toggles `visibility` (Back opts back in).
 */
export function QuoteActionBar({
  currentStep,
  currentStepLabel,
  formId,
  hint,
  loading,
  canContinue,
  onBack,
  hintVisible = false,
  keyboardOpen = false,
  ready = false,
  onPrimaryClick,
}: {
  currentStep: QuoteFlowStep;
  currentStepLabel: string;
  formId: string;
  hint: string;
  loading: boolean;
  canContinue: boolean;
  onBack: () => void;
  /** Phones: float the hint as a pill above the bar (after a blocked tap). */
  hintVisible?: boolean;
  /** Phones: a text field has focus, so the keyboard covers the bar. */
  keyboardOpen?: boolean;
  /** Saved progress is restored; state changes from here on are the customer's. */
  ready?: boolean;
  onPrimaryClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const stepAction =
    currentStep < 2 ? actionLabels[currentStep as 0 | 1] : null;
  const actionLabel =
    currentStep === 2
      ? loading
        ? 'Calculating…'
        : 'Get Quote'
      : stepAction!.visible;
  const accessibleActionLabel =
    currentStep === 2 ? actionLabel : stepAction!.accessible;
  const actionBlocked = !canContinue || loading;

  // Phones: a one-shot sheen across the capsule when it becomes available.
  const [shimmer, setShimmer] = useState({ canContinue, run: 0, done: 0 });
  if (shimmer.canContinue !== canContinue) {
    setShimmer({
      canContinue,
      run: canContinue && ready && compactMotionAllowed() ? shimmer.run + 1 : shimmer.run,
      done: shimmer.done,
    });
  }
  const shimmering = shimmer.run !== shimmer.done;

  return (
    <aside
      aria-label="Quote navigation"
      data-qm-vt-name="qm-bar"
      data-qm-keyboard={keyboardOpen ? 'true' : undefined}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/15 bg-[var(--hi-bg-1)]/95 shadow-[0_-18px_40px_rgba(0,0,0,0.35)] backdrop-blur supports-[backdrop-filter]:bg-[var(--hi-bg-1)]/85 phone:inset-x-3 phone:bottom-[max(12px,env(safe-area-inset-bottom,0px))] phone:mx-auto phone:max-w-[34rem] phone:rounded-[30px] phone:border-0 phone:bg-transparent phone:shadow-none phone:backdrop-filter-none phone:transition-[bottom,visibility] phone:duration-300 phone:ease-[var(--qm-ease-spring)] phone:data-[qm-keyboard=true]:invisible phone:data-[qm-keyboard=true]:bottom-[calc(-1*var(--qm-bar-h)-4rem)]"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none hidden phone:absolute phone:inset-0 phone:block phone:rounded-[30px] phone:qm-glass"
      />
      <div
        aria-label="Quote progress"
        aria-valuemax={3}
        aria-valuemin={1}
        aria-valuenow={currentStep + 1}
        aria-valuetext={`Step ${currentStep + 1} of 3: ${currentStepLabel}`}
        className="h-0.5 w-full bg-white/10 phone:sr-only"
        role="progressbar"
      >
        <div
          className="h-full bg-[var(--accent)] transition-[width] duration-500"
          style={{ width: `${((currentStep + 1) / 3) * 100}%` }}
        />
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2 sm:px-6 md:flex-row md:items-center md:justify-between md:gap-5 md:pt-3 phone:relative phone:p-2">
        <div
          className="min-w-0 phone:pointer-events-none phone:absolute phone:inset-x-0 phone:bottom-[calc(100%+10px)] phone:flex phone:justify-center phone:px-2 phone:[[data-qm-keyboard=true]_&]:visible phone:[[data-qm-keyboard=true]_&]:fixed phone:[[data-qm-keyboard=true]_&]:inset-x-3 phone:[[data-qm-keyboard=true]_&]:top-[calc(var(--qm-nav-h)+10px)] phone:[[data-qm-keyboard=true]_&]:bottom-auto"
          aria-live="polite"
        >
          <p className="motif-spec text-[var(--accent-light)] phone:sr-only">
            Step {currentStep + 1} of 3 <span aria-hidden="true">·</span>{' '}
            {currentStepLabel}
          </p>
          <p
            id="quote-action-hint"
            data-qm-pill={hintVisible ? 'show' : undefined}
            className={`mt-0.5 text-xs leading-5 md:text-sm ${
              actionBlocked ? 'text-amber-100' : 'text-white/55'
            } phone:m-0 phone:max-w-full phone:translate-y-2 phone:scale-95 phone:rounded-full phone:bg-[rgb(44_37_8/0.94)] phone:px-4 phone:py-2 phone:text-center phone:qm-footnote phone:font-semibold! phone:text-[var(--qm-warning)] phone:opacity-0 phone:shadow-[0_12px_30px_-12px_rgb(0_0_0/0.85),inset_0_0_0_0.5px_rgb(255_214_10/0.35)] phone:transition-[opacity,translate,scale] phone:duration-300 phone:ease-[var(--qm-ease-spring)] phone:data-[qm-pill=show]:translate-y-0 phone:data-[qm-pill=show]:scale-100 phone:data-[qm-pill=show]:opacity-100`}
          >
            {hint}
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onBack}
            data-qm-vt-name="qm-back"
            className={`${ghostAction} min-h-11 flex-1 px-4 py-2.5 md:flex-none phone:fixed phone:left-4 phone:top-[calc(env(safe-area-inset-top,0px)+8px)] phone:z-10 phone:min-h-0 phone:flex-none phone:qm-circle phone:qm-glass ${
              currentStep === 0 ? 'phone:invisible' : 'phone:visible'
            }`}
            disabled={currentStep === 0 || loading}
          >
            <ArrowLeft className="h-4 w-4 phone:hidden" aria-hidden="true" />
            <ChevronLeft
              className="hidden h-[26px] w-[26px] phone:block"
              strokeWidth={2.4}
              aria-hidden="true"
            />
            <span className="contents phone:block phone:sr-only">Back</span>
          </button>
          <button
            type="submit"
            form={formId}
            aria-label={accessibleActionLabel}
            aria-describedby="quote-action-hint"
            disabled={loading}
            onClick={onPrimaryClick}
            data-qm-blocked={actionBlocked && !loading ? 'true' : undefined}
            className={`${heroAction} min-h-11 flex-[2] px-5 py-2.5 md:min-w-56 md:flex-none phone:relative phone:w-full phone:overflow-hidden phone:qm-capsule phone:qm-capsule-accent phone:data-[qm-blocked=true]:[background:rgb(118_118_128/0.32)]! phone:data-[qm-blocked=true]:text-[rgb(235_235_245/0.72)]! phone:data-[qm-blocked=true]:shadow-none!`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                />
                {actionLabel}
              </span>
            ) : (
              <>
                {currentStep < 2 ? (
                  <>
                    <span className="contents phone:hidden">{actionLabel}</span>
                    <span className="hidden phone:inline">Next</span>
                  </>
                ) : (
                  actionLabel
                )}
                {currentStep < 2 ? (
                  <ArrowRight className="h-4 w-4 phone:hidden" aria-hidden="true" />
                ) : null}
              </>
            )}
            {shimmering ? (
              <span
                key={shimmer.run}
                aria-hidden="true"
                onAnimationEnd={() =>
                  setShimmer((current) => ({ ...current, done: current.run }))
                }
                className="pointer-events-none absolute inset-y-0 left-0 hidden w-1/2 bg-[linear-gradient(100deg,transparent_20%,rgb(255_255_255/0.5)_50%,transparent_80%)] phone:block phone:animate-[qm-shimmer_0.95s_cubic-bezier(0.16,1,0.3,1)_both]"
              />
            ) : null}
          </button>
        </div>
      </div>
    </aside>
  );
}
