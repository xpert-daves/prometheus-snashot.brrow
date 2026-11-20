'use client';

import { useId, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import {
  EXTERIOR_UPGRADE_OPTIONS,
  getRampAddOnForDoor,
  hasRampAddOn,
  INTERIOR_UPGRADE_OPTIONS,
  isRampAddOn,
} from '@/lib/quoteFlow';
import type { QuoteFormParams } from '@/lib/quoteForm';
import { triggerHaptic } from '@/lib/haptics';
import { compactMotionAllowed } from '@/lib/useCompactViewport';

type QuoteAddOnsVariant = 'public' | 'admin';
type AddOnSection = 'exterior' | 'interior';

/*
 * The public variant also carries the phone (iOS) skin through `phone:`
 * classes: groups become inset cards, toggles become disclosure rows and the
 * aria-hidden check box becomes a switch. Desktop classes are unchanged, and
 * the admin variant renders exactly as before (its extra keys are empty).
 */
const variantClasses = {
  public: {
    wrapper: 'space-y-3 text-sm phone:flex phone:flex-col',
    intro: 'flex items-start justify-between gap-3 phone:contents',
    introText: 'phone:contents',
    heading: 'brand-subheading phone:qm-section-header',
    introCopy: 'mt-1 text-xs text-white/60 phone:order-last phone:qm-section-footer',
    optional: 'motif-spec shrink-0 text-white/60 phone:hidden',
    section:
      'border border-white/15 bg-black/25 transition-colors phone:overflow-clip phone:rounded-[var(--qm-radius-group)] phone:border-0 phone:bg-[var(--qm-group)]',
    sectionOpen: 'border-white/30 bg-black/35',
    toggle:
      'flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary)] phone:qm-row phone:focus-visible:outline-offset-[-3px]!',
    toggleCopy: 'min-w-0 flex-1',
    sectionTitle:
      'brand-button block text-xs text-white/85 phone:qm-body phone:text-[var(--qm-label)]',
    helper:
      'motif-spec mt-0.5 block truncate text-white/60 phone:qm-subhead phone:whitespace-normal phone:text-[var(--qm-label-2)]',
    controls: 'flex shrink-0 items-center gap-2',
    countIdle: 'motif-spec text-white/60 phone:qm-body phone:text-[var(--qm-label-2)]',
    countSelected:
      'motif-spec border border-[var(--accent)] bg-[var(--hi-accent-soft)] px-2 py-1 text-[var(--accent-light)] phone:rounded-full phone:border-0 phone:bg-[rgb(var(--accent-glow-rgb)/0.16)] phone:px-2.5 phone:py-0.5 phone:qm-subhead phone:font-semibold! phone:text-[var(--accent-light)] phone:animate-[qm-pop_0.42s_var(--qm-ease-bounce)_both]',
    chevron:
      'h-4 w-4 text-white/45 transition-transform phone:text-[var(--qm-label-3)] phone:duration-300 phone:ease-[var(--qm-ease-spring)]',
    /** Appended to `rotate-180` when open: iOS disclosure chevron points down. */
    chevronOpen: ' phone:rotate-0',
    /** Closed: chevron points right. */
    chevronClosed: 'phone:-rotate-90',
    panel:
      'border-t border-white/10 p-3 phone:border-t-0 phone:p-0 phone:animate-[qm-fade_0.32s_ease-out_both]',
    grid: 'grid gap-2 sm:grid-cols-2 phone:grid-cols-1 phone:gap-0',
    option:
      'flex min-h-[60px] items-center gap-3 rounded-none border p-3 transition-colors focus-within:ring-2 focus-within:ring-[var(--primary)] phone:qm-row phone:relative phone:focus-within:ring-0 phone:has-[:focus-visible]:bg-[var(--qm-group-pressed)] phone:has-[:focus-visible]:outline-2 phone:has-[:focus-visible]:outline-solid phone:has-[:focus-visible]:outline-[var(--accent-light)] phone:has-[:focus-visible]:-outline-offset-2 phone:before:absolute phone:before:left-4 phone:before:right-0 phone:before:top-0 phone:before:h-px phone:before:origin-top phone:before:scale-y-50 phone:before:bg-[var(--qm-sep)]',
    optionIdle: 'border-white/15 bg-black/25 hover:border-white/40',
    optionSelected: 'border-[var(--accent)] bg-[var(--hi-accent-soft)]',
    checkbox: 'sr-only',
    title:
      'brand-button block min-w-0 truncate text-xs phone:qm-body phone:text-[var(--qm-label)]',
    description:
      'mt-0.5 block text-xs text-white/60 phone:qm-subhead phone:text-[var(--qm-label-2)]',
    check:
      'flex h-6 w-6 shrink-0 items-center justify-center rounded-none border border-white/15 text-[var(--accent-light)] phone:qm-switch',
    checkIcon: 'h-4 w-4 phone:hidden',
    error:
      'mt-1 text-xs text-red-400 phone:-mt-1 phone:px-4 phone:qm-footnote phone:text-[var(--qm-danger)]',
  },
  admin: {
    wrapper: 'space-y-3 text-sm',
    intro: 'flex items-start justify-between gap-3',
    introText: '',
    heading: 'text-sm font-black text-stone-950',
    introCopy: 'mt-1 text-xs font-semibold text-stone-500',
    optional: 'shrink-0 text-xs font-semibold text-stone-500',
    section: 'overflow-hidden rounded-md border border-stone-200 bg-stone-50 transition-colors',
    sectionOpen: 'border-amber-300 bg-white',
    toggle:
      'flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400/40',
    toggleCopy: 'min-w-0 flex-1',
    sectionTitle: 'block text-sm font-black text-stone-900',
    helper: 'mt-0.5 block truncate text-xs font-semibold text-stone-500',
    controls: 'flex shrink-0 items-center gap-2',
    countIdle: 'text-xs font-semibold text-stone-500',
    countSelected:
      'rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800',
    chevron: 'h-4 w-4 text-stone-500 transition-transform',
    chevronOpen: '',
    chevronClosed: '',
    panel: 'border-t border-stone-200 p-3',
    grid: 'grid gap-2 sm:grid-cols-2',
    option:
      'flex min-h-[60px] items-center gap-3 rounded-md border p-3 transition-colors focus-within:ring-2 focus-within:ring-amber-400/30',
    optionIdle: 'border-stone-200 bg-stone-50 hover:border-amber-400 hover:bg-white',
    optionSelected: 'border-amber-500 bg-amber-50 outline outline-1 outline-amber-500',
    checkbox: 'sr-only',
    title: 'block min-w-0 truncate text-sm font-bold text-stone-800',
    description: 'mt-0.5 block text-xs font-semibold text-stone-500',
    check:
      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber-200 text-amber-700',
    checkIcon: 'h-4 w-4',
    error: 'mt-1 mb-0 text-xs font-semibold text-red-700',
  },
} as const;

/** Disclosure height animation on phones (public variant, motion allowed only). */
const SECTION_RESIZE_MS = 440;
const SECTION_RESIZE_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';

function getRampDescription(door: QuoteFormParams['door']) {
  if (door === 'single_shed') return 'Single shed door';
  if (door === 'double_shed') return 'Double shed door';
  return '';
}

export function QuoteAddOnsSelector({
  addOns,
  door,
  error,
  errorId,
  variant = 'public',
  onToggleAddOn,
}: {
  addOns: readonly string[];
  door: QuoteFormParams['door'];
  error?: string;
  errorId?: string;
  variant?: QuoteAddOnsVariant;
  onToggleAddOn: (option: string, checked: boolean) => void;
}) {
  const classes = variantClasses[variant];
  const isPublic = variant === 'public';
  const selectorId = useId();
  const [openSection, setOpenSection] = useState<AddOnSection | null>(null);
  const exteriorSectionRef = useRef<HTMLElement>(null);
  const interiorSectionRef = useRef<HTMLElement>(null);
  /** Card heights captured right before a disclosure change (phones only). */
  const pendingHeightsRef = useRef<Array<[HTMLElement, number]> | null>(null);
  const rampOption = getRampAddOnForDoor(door);
  const exteriorOptions = EXTERIOR_UPGRADE_OPTIONS.filter((option) => !isRampAddOn(option));
  const exteriorSelectedCount =
    exteriorOptions.filter((option) => addOns.includes(option)).length +
    (rampOption && hasRampAddOn(addOns) ? 1 : 0);
  const interiorSelectedCount = INTERIOR_UPGRADE_OPTIONS.filter((option) =>
    addOns.includes(option)
  ).length;
  const activeSection = openSection;
  const exteriorOpen = activeSection === 'exterior';
  const interiorOpen = activeSection === 'interior';
  const exteriorPanelId = `${selectorId}-exterior-upgrades`;
  const interiorPanelId = `${selectorId}-interior-upgrades`;

  // Phones: glide each card from its old height to its new one (iOS-style
  // disclosure) instead of snapping. Runs once per toggle; no loops.
  useLayoutEffect(() => {
    const pending = pendingHeightsRef.current;
    pendingHeightsRef.current = null;
    if (!pending) return;
    for (const [section, from] of pending) {
      const to = section.getBoundingClientRect().height;
      if (Math.abs(to - from) < 1 || typeof section.animate !== 'function') continue;
      section.animate([{ height: `${from}px` }, { height: `${to}px` }], {
        duration: SECTION_RESIZE_MS,
        easing: SECTION_RESIZE_EASING,
      });
    }
  }, [openSection]);

  function toggleSection(section: AddOnSection) {
    if (isPublic && compactMotionAllowed()) {
      pendingHeightsRef.current = [exteriorSectionRef.current, interiorSectionRef.current]
        .filter((element): element is HTMLElement => element !== null)
        .map((element) => [element, element.getBoundingClientRect().height]);
    }
    setOpenSection((current) => (current === section ? null : section));
  }

  function renderOption({
    option,
    title = option,
    description,
    selected = addOns.includes(option),
  }: {
    option: string;
    title?: string;
    description?: string;
    selected?: boolean;
  }) {
    return (
      <label
        key={option}
        className={`${classes.option} ${
          selected ? classes.optionSelected : classes.optionIdle
        }`}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => {
            if (isPublic) triggerHaptic('selection');
            onToggleAddOn(option, event.target.checked);
          }}
          className={classes.checkbox}
        />
        <span className="min-w-0 flex-1">
          <span className={classes.title}>{title}</span>
          {description ? <span className={classes.description}>{description}</span> : null}
        </span>
        <span
          className={classes.check}
          aria-hidden="true"
          data-on={isPublic ? String(selected) : undefined}
        >
          {selected ? <Check className={classes.checkIcon} /> : null}
        </span>
      </label>
    );
  }

  return (
    <div className={classes.wrapper}>
      <div className={classes.intro}>
        <div className={classes.introText || undefined}>
          <p className={classes.heading}>Optional Add-ons</p>
          <p className={classes.introCopy}>Open a group only if you want to customize.</p>
        </div>
        <span className={classes.optional}>Optional</span>
      </div>

      <section
        ref={exteriorSectionRef}
        className={`${classes.section} ${exteriorOpen ? classes.sectionOpen : ''}`}
      >
        <button
          type="button"
          aria-expanded={exteriorOpen}
          aria-controls={exteriorPanelId}
          aria-describedby={error ? errorId : undefined}
          onClick={() => toggleSection('exterior')}
          className={classes.toggle}
        >
          <span className={classes.toggleCopy}>
            <span className={classes.sectionTitle}>Exterior upgrades</span>
            <span className={classes.helper}>Ramp, anchoring &amp; finishing</span>
          </span>
          <span className={classes.controls}>
            <span
              className={
                exteriorSelectedCount > 0 ? classes.countSelected : classes.countIdle
              }
            >
              {exteriorSelectedCount > 0
                ? `${exteriorSelectedCount} selected`
                : `${exteriorOptions.length + (rampOption ? 1 : 0)} options`}
            </span>
            <ChevronDown
              aria-hidden="true"
              className={`${classes.chevron} ${
                exteriorOpen ? `rotate-180${classes.chevronOpen}` : classes.chevronClosed
              }`}
            />
          </span>
        </button>

        {exteriorOpen ? (
          <div id={exteriorPanelId} className={classes.panel}>
            <div className={classes.grid}>
              {rampOption
                ? renderOption({
                    option: rampOption,
                    title: 'Ramp',
                    description: getRampDescription(door),
                    selected: hasRampAddOn(addOns),
                  })
                : null}
              {exteriorOptions.map((option) => renderOption({ option }))}
            </div>
          </div>
        ) : null}
      </section>

      {error ? (
        <p
          id={errorId}
          role="alert"
          aria-live="polite"
          tabIndex={-1}
          className={classes.error}
        >
          {error}
        </p>
      ) : null}

      <section
        ref={interiorSectionRef}
        className={`${classes.section} ${interiorOpen ? classes.sectionOpen : ''}`}
      >
        <button
          type="button"
          aria-expanded={interiorOpen}
          aria-controls={interiorPanelId}
          onClick={() => toggleSection('interior')}
          className={classes.toggle}
        >
          <span className={classes.toggleCopy}>
            <span className={classes.sectionTitle}>Interior upgrades</span>
            <span className={classes.helper}>Workbench, loft &amp; utilities · priced per job</span>
          </span>
          <span className={classes.controls}>
            <span
              className={
                interiorSelectedCount > 0 ? classes.countSelected : classes.countIdle
              }
            >
              {interiorSelectedCount > 0
                ? `${interiorSelectedCount} selected`
                : `${INTERIOR_UPGRADE_OPTIONS.length} options`}
            </span>
            <ChevronDown
              aria-hidden="true"
              className={`${classes.chevron} ${
                interiorOpen ? `rotate-180${classes.chevronOpen}` : classes.chevronClosed
              }`}
            />
          </span>
        </button>

        {interiorOpen ? (
          <div id={interiorPanelId} className={classes.panel}>
            <div className={classes.grid}>
              {INTERIOR_UPGRADE_OPTIONS.map((option) => renderOption({ option }))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
