import type { CSSProperties, ReactNode } from 'react';
import clsx from 'clsx';
import { triggerHaptic } from '@/lib/haptics';

export type QuoteSegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  /** Extra classes for this option's button (desktop and phone). */
  className?: string;
};

/**
 * One-of-N choice. Desktop keeps the caller's chip/tile look untouched; phones
 * get an iOS segmented control with a sliding thumb (`qm-seg*` utilities).
 * Buttons are type="button" (they live inside the step form) and fire their
 * own selection haptic. (form_start comes from websiteMeasurement's delegated tap listener.)
 */
export function QuoteSegmentedChoice<T extends string>({
  options,
  value,
  onChange,
  itemClassName,
  className,
  groupLabel,
  groupLabelledBy,
  allowDeselect = false,
}: {
  options: readonly QuoteSegmentedOption<T>[];
  value: string;
  onChange: (value: T) => void;
  /** Desktop classes for an option button, e.g. `(selected) => specChip(selected)`. */
  itemClassName: (selected: boolean, option: QuoteSegmentedOption<T>) => string;
  /** Desktop classes for the wrapper, e.g. `mt-1.5 flex gap-2`. */
  className?: string;
  /** Accessible name for the group. Avoid words tests query by label. */
  groupLabel?: string;
  /** Id of a visible caption that names the group (preferred over groupLabel). */
  groupLabelledBy?: string;
  /** Tapping the selected option clears it (onChange receives '' as T). */
  allowDeselect?: boolean;
}) {
  const selectedIndex = options.findIndex((option) => option.value === value);
  const style = {
    '--qm-seg-count': options.length,
    '--qm-seg-index': Math.max(selectedIndex, 0),
  } as CSSProperties;

  return (
    <div
      role="group"
      aria-label={groupLabelledBy ? undefined : groupLabel}
      aria-labelledby={groupLabelledBy}
      style={style}
      className={clsx(className, 'phone:qm-seg')}
    >
      {selectedIndex >= 0 ? (
        <span aria-hidden="true" className="hidden phone:block phone:qm-seg-thumb" />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => {
              if (selected && !allowDeselect) return;
              triggerHaptic('selection');
              onChange((selected ? '' : option.value) as T);
            }}
            className={clsx(itemClassName(selected, option), option.className, 'phone:qm-seg-item')}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
