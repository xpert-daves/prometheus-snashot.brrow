import type { ReactNode } from 'react';

export function QuoteSectionCard({
  title,
  code,
  eyebrow,
  children,
  className = '',
  titleClassName = '',
}: {
  title?: string;
  /** Mono sheet code shown opposite the title, e.g. "01 / 03". Decorative. */
  code?: string;
  /** Phone-only caption above the title, e.g. "Step 1 of 3". Decorative (aria-hidden). */
  eyebrow?: string;
  children: ReactNode;
  className?: string;
  /** Extra classes for the h2 (use `phone:` classes; desktop stays as is). */
  titleClassName?: string;
}) {
  return (
    <section className={`interior-card relative p-5 sm:p-6 phone:p-0 ${className}`}>
      {title ? (
        <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-white/10 pb-3 phone:mb-6 phone:flex-col phone:items-start phone:gap-0.5 phone:border-0 phone:px-1 phone:pb-0">
          {eyebrow ? (
            <span
              aria-hidden="true"
              className="hidden phone:block phone:qm-subhead phone:font-semibold phone:text-[var(--accent-light)]"
            >
              {eyebrow}
            </span>
          ) : null}
          <h2
            tabIndex={-1}
            className={`brand-subheading scroll-mt-24 text-base text-white focus:outline-none sm:scroll-mt-28 phone:qm-large-title phone:scroll-mt-[calc(env(safe-area-inset-top,0px)+5.5rem)] phone:[[data-step='0']_&]:text-[28px]! phone:[[data-step='0']_&]:leading-[34px]! ${titleClassName}`}
          >
            {title}
          </h2>
          {code ? (
            <span aria-hidden="true" className="motif-spec text-white/35 phone:hidden">
              {code}
            </span>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function QuoteFieldError({
  id,
  message,
}: {
  id: string;
  message?: string;
}) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      aria-live="polite"
      className="mt-1.5 text-xs text-red-400 phone:qm-footnote phone:px-4 phone:text-[var(--qm-danger)]"
    >
      {message}
    </p>
  );
}
