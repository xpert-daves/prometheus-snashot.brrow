'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  CarFront,
  Check,
  ChevronsUpDown,
  Droplets,
  Fence,
  Sprout,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import { BUILDING_CATALOG, type PublicBuildingType } from '@/lib/buildingCatalog';
import { triggerHaptic } from '@/lib/haptics';
import type { QuoteFormParams } from '@/lib/quoteForm';
import { compactMotionAllowed } from '@/lib/useCompactViewport';

type BuildingEntry = (typeof BUILDING_CATALOG)[number];

/** Beat between the checkmark landing on a row and the list folding away. */
const COLLAPSE_DELAY_MS = 260;

/** iOS Settings-style tinted icon tiles, one hue per building type. */
const BUILDING_ICONS: Record<PublicBuildingType, { Icon: LucideIcon; tile: string }> = {
  storage_shed: {
    Icon: Warehouse,
    tile: 'bg-[rgb(var(--accent-glow-rgb)/0.2)] text-[var(--accent-light)]',
  },
  greenhouse: { Icon: Sprout, tile: 'bg-[rgb(48_209_88/0.17)] text-[#63e183]' },
  well_pump: { Icon: Droplets, tile: 'bg-[rgb(100_210_255/0.17)] text-[#82dbff]' },
  open_loafing: { Icon: Fence, tile: 'bg-[rgb(191_156_112/0.22)] text-[#e3c296]' },
  carport: { Icon: CarFront, tile: 'bg-[rgb(125_122_255/0.2)] text-[#b0aeff]' },
};

/** Height fold shared by the value row and the option list (grid 0fr <-> 1fr). */
const FOLD =
  'grid transition-[grid-template-rows,opacity] duration-[420ms] ease-[var(--qm-ease-spring)]';
const FOLD_OPEN = 'grid-rows-[1fr] opacity-100';
const FOLD_CLOSED = 'grid-rows-[0fr] opacity-0';

/** 64px list row; the focus ring is drawn inside because the fold clips overflow. */
const ROW = 'relative phone:qm-row phone:min-h-16! focus-visible:-outline-offset-2!';

function detailText(entry: BuildingEntry) {
  return entry.bestFor.slice(0, 2).join(' · ');
}

function BuildingIcon({ value }: { value: PublicBuildingType }) {
  const { Icon, tile } = BUILDING_ICONS[value];
  return (
    <span
      aria-hidden="true"
      className={clsx(
        'flex size-10 shrink-0 items-center justify-center rounded-[11px]',
        tile
      )}
    >
      <Icon className="size-[22px]" strokeWidth={1.9} />
    </span>
  );
}

function BuildingDetail({ id, entry }: { id: string; entry: BuildingEntry }) {
  return (
    <span
      id={id}
      aria-hidden="true"
      className="mt-px block truncate text-[var(--qm-label-2)] phone:qm-subhead"
    >
      {detailText(entry)}
    </span>
  );
}

/**
 * Phone-only building type picker (hidden on desktop, where the native
 * structure-type select stays). An inset grouped list of building rows with a
 * trailing checkmark; after a pick it folds into a single value row that
 * re-opens the list. Render it as a SIBLING of the structure-type <label>.
 *
 * The first `button` in DOM order is always a sensible focus target (first
 * option while nothing is picked, otherwise the value row), which the shell's
 * guide selector relies on.
 */
export function QuoteBuildingPicker({
  value,
  onChange,
}: {
  value: QuoteFormParams['structureType'];
  onChange: (structureType: PublicBuildingType) => void;
}) {
  const baseId = useId();
  const listId = `${baseId}list`;
  const selected = BUILDING_CATALOG.find((entry) => entry.value === value);
  const [open, setOpen] = useState(false);
  const expanded = !selected || open;

  const collapseTimerRef = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const valueRowRef = useRef<HTMLButtonElement>(null);
  const selectedOptionRef = useRef<HTMLButtonElement>(null);
  const pendingFocusRef = useRef<'value' | 'option' | null>(null);

  const cancelCollapse = useCallback(() => {
    if (collapseTimerRef.current !== null) {
      window.clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
  }, []);

  useEffect(() => cancelCollapse, [cancelCollapse]);

  // Keep keyboard / switch-control focus on the visible half of the picker.
  useEffect(() => {
    const target = pendingFocusRef.current;
    if (!target) return;
    pendingFocusRef.current = null;
    (target === 'value' ? valueRowRef : selectedOptionRef).current?.focus({
      preventScroll: true,
    });
  }, [expanded]);

  const focusIsWithin = (element: HTMLElement | null) =>
    Boolean(element && element.contains(document.activeElement));

  const collapse = () => {
    cancelCollapse();
    if (focusIsWithin(listRef.current)) pendingFocusRef.current = 'value';
    setOpen(false);
  };

  const expand = () => {
    cancelCollapse();
    if (focusIsWithin(valueRowRef.current)) pendingFocusRef.current = 'option';
    setOpen(true);
  };

  const pick = (next: PublicBuildingType) => {
    if (next === selected?.value) {
      collapse();
      return;
    }

    triggerHaptic('selection');
    onChange(next);

    if (compactMotionAllowed()) {
      // Let the checkmark land before the list folds into the value row.
      cancelCollapse();
      setOpen(true);
      collapseTimerRef.current = window.setTimeout(collapse, COLLAPSE_DELAY_MS);
    } else {
      collapse();
    }
  };

  return (
    <div
      data-quote-building-picker=""
      role="group"
      aria-label="Building type"
      className="hidden phone:block"
    >
      <p aria-hidden="true" className="phone:qm-section-header">
        Building type
      </p>
      <div className="overflow-clip rounded-[var(--qm-radius-group)] bg-[var(--qm-group)] shadow-[inset_0_0.5px_0_rgb(255_255_255/0.06)]">
        {selected ? (
          <div inert={expanded} className={clsx(FOLD, expanded ? FOLD_CLOSED : FOLD_OPEN)}>
            <div className="min-h-0 overflow-hidden">
              <button
                ref={valueRowRef}
                type="button"
                aria-expanded={expanded}
                aria-controls={listId}
                aria-describedby={`${baseId}value`}
                onClick={expand}
                className={ROW}
              >
                <BuildingIcon value={selected.value} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold">
                    <span className="sr-only">Building: </span>
                    {selected.quoteLabel}
                  </span>
                  <BuildingDetail id={`${baseId}value`} entry={selected} />
                </span>
                <ChevronsUpDown
                  aria-hidden="true"
                  className="size-[18px] shrink-0 text-[var(--qm-label-2)]"
                  strokeWidth={2.2}
                />
              </button>
            </div>
          </div>
        ) : null}

        <div
          id={listId}
          ref={listRef}
          inert={!expanded}
          className={clsx(FOLD, expanded ? FOLD_OPEN : FOLD_CLOSED)}
        >
          <div className="min-h-0 overflow-hidden">
            {BUILDING_CATALOG.map((entry, index) => {
              const isSelected = entry.value === selected?.value;
              const detailId = `${baseId}${entry.value}`;
              return (
                <button
                  key={entry.value}
                  ref={isSelected ? selectedOptionRef : undefined}
                  type="button"
                  aria-pressed={isSelected}
                  aria-describedby={detailId}
                  onClick={() => pick(entry.value)}
                  className={ROW}
                >
                  {index > 0 ? (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute top-0 right-0 left-[68px] h-px origin-top scale-y-50 bg-[var(--qm-sep)]"
                    />
                  ) : null}
                  <BuildingIcon value={entry.value} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold">{entry.quoteLabel}</span>
                    <BuildingDetail id={detailId} entry={entry} />
                  </span>
                  <span
                    aria-hidden="true"
                    className="flex size-6 shrink-0 items-center justify-center"
                  >
                    {isSelected ? (
                      <span className="flex phone:qm-animate-pop">
                        <Check className="size-5 text-[var(--accent)]" strokeWidth={3} />
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
