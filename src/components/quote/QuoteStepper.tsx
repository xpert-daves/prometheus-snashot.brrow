import { Check } from 'lucide-react';

function StepMarker({
  state,
  index,
}: {
  state: 'complete' | 'current' | 'upcoming';
  index: number;
}) {
  const base =
    'motif-spec flex h-9 w-9 items-center justify-center rounded-none transition-colors';
  const classes =
    state === 'complete'
      ? 'border border-[var(--accent)] bg-[var(--primary)] text-[var(--accent-contrast)]'
      : state === 'current'
      ? 'border-2 border-[var(--accent)] bg-[var(--hi-accent-soft)] text-[var(--accent-light)]'
      : 'border border-white/15 bg-black/25 text-white/60';

  return (
    <span className={`${base} ${classes}`}>
      {state === 'complete' ? (
        <Check className="h-4 w-4" aria-hidden="true" />
      ) : (
        String(index + 1).padStart(2, '0')
      )}
    </span>
  );
}

export function QuoteStepper({
  steps,
  currentStep,
  canNavigateToStep,
  onStepSelect,
}: {
  steps: readonly string[];
  currentStep: number;
  canNavigateToStep: (index: number) => boolean;
  onStepSelect: (index: number) => void;
}) {
  // Phones show progress in the nav bar instead; the stepper stays in the DOM.
  return (
    <div className="mx-auto flex w-full max-w-xl items-start justify-center phone:hidden">
      {steps.map((label, index) => {
        const state =
          currentStep > index
            ? ('complete' as const)
            : currentStep === index
            ? ('current' as const)
            : ('upcoming' as const);

        return (
          <div key={label} className="flex flex-1 items-start last:flex-none">
            <button
              type="button"
              aria-label={`Go to step ${index + 1}: ${label}`}
              aria-current={state === 'current' ? 'step' : undefined}
              onClick={() => onStepSelect(index)}
              disabled={!canNavigateToStep(index)}
              className="group flex flex-col items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:cursor-not-allowed"
            >
              <StepMarker state={state} index={index} />
              <span
                className={`motif-spec max-w-24 text-center leading-tight sm:max-w-none ${
                  state === 'upcoming' ? 'text-white/60' : 'text-white/75'
                }`}
              >
                {label}
              </span>
            </button>
            {index < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className="relative mx-2 mt-[1.125rem] h-px flex-1 min-w-6 bg-white/15 sm:mx-3"
              >
                <span
                  className={`absolute inset-0 origin-left bg-[var(--accent)] transition-transform duration-500 ${
                    currentStep > index ? 'scale-x-100' : 'scale-x-0'
                  }`}
                />
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
