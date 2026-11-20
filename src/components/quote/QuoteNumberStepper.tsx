'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { triggerHaptic } from '@/lib/haptics';

const REPEAT_DELAY_MS = 420;
const REPEAT_INTERVAL_MS = 120;
const FAST_REPEAT_INTERVAL_MS = 60;
const FAST_AFTER_STEPS = 8;
const MAX_REPEAT_STEPS = 200;

function parseValue(value: string) {
  const parsed = Number(value);
  return value.trim() !== '' && Number.isFinite(parsed) ? parsed : null;
}

/** Next whole number in the step direction, clamped. 10.5 → 11 (+) or 10 (−). */
function nextValue(value: string, delta: 1 | -1, min: number, max: number) {
  const parsed = parseValue(value);
  if (parsed === null) return min;
  const base = delta === 1 ? Math.floor(parsed) : Math.ceil(parsed);
  return Math.min(max, Math.max(min, base + delta));
}

/**
 * Phone-only iOS stepper (− | +) for a numeric field; hidden on desktop.
 * Render it as a SIBLING of the field's <label>, never inside it, so the label
 * keeps pointing at the input. Typed values are never rewritten: only taps
 * clamp to [min, max]. Press and hold repeats. Buttons are type="button".
 *
 * Name the buttons with words tests never query by label, e.g. "Decrease length",
 * "Fewer windows" — never "(ft)" or the field's own label text.
 */
export function QuoteNumberStepper({
  value,
  min,
  max,
  onStep,
  decreaseLabel,
  increaseLabel,
  announce,
  className = '',
}: {
  value: string;
  min: number;
  max: number;
  onStep: (next: string) => void;
  decreaseLabel: string;
  increaseLabel: string;
  /** Polite announcement after a step, e.g. (v) => `Length ${v} feet`. No "sq ft" or error copy. */
  announce?: (next: string) => string;
  className?: string;
}) {
  const [announcement, setAnnouncement] = useState('');
  const valueRef = useRef(value);
  const timerRef = useRef<number | null>(null);
  const repeatsRef = useRef(0);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const stopRepeat = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => stopRepeat, [stopRepeat]);

  /** Applies one step; returns false when the value could not move. */
  const applyStep = useCallback(
    (delta: 1 | -1) => {
      const current = valueRef.current;
      const next = String(nextValue(current, delta, min, max));
      if (next === current.trim()) return false;
      valueRef.current = next;
      onStep(next);
      setAnnouncement(announce ? announce(next) : next);
      return true;
    },
    [announce, max, min, onStep]
  );

  const startRepeat = (delta: 1 | -1) => {
    stopRepeat();
    repeatsRef.current = 0;
    const tick = () => {
      repeatsRef.current += 1;
      if (!applyStep(delta) || repeatsRef.current >= MAX_REPEAT_STEPS) {
        stopRepeat();
        return;
      }
      timerRef.current = window.setTimeout(
        tick,
        repeatsRef.current > FAST_AFTER_STEPS ? FAST_REPEAT_INTERVAL_MS : REPEAT_INTERVAL_MS
      );
    };
    timerRef.current = window.setTimeout(tick, REPEAT_DELAY_MS);
  };

  const parsed = parseValue(value);
  const canDecrease = parsed === null || parsed > min;
  const canIncrease = parsed === null || parsed < max;

  // aria-disabled, not disabled: a keyboard-focused button that reaches its
  // limit must keep focus instead of dropping it to <body>.
  const renderButton = (delta: 1 | -1) => {
    const atLimit = delta === -1 ? !canDecrease : !canIncrease;
    return (
    <button
      type="button"
      aria-label={delta === -1 ? decreaseLabel : increaseLabel}
      aria-disabled={atLimit || undefined}
      onPointerDown={() => {
        if (!atLimit) startRepeat(delta);
      }}
      onPointerUp={stopRepeat}
      onPointerLeave={stopRepeat}
      onPointerCancel={stopRepeat}
      onClick={() => {
        stopRepeat();
        // A press-and-hold already stepped while held; its trailing click is not another step.
        const held = repeatsRef.current > 0;
        repeatsRef.current = 0;
        if (held || atLimit) return;
        if (applyStep(delta)) triggerHaptic('selection');
      }}
      className="flex h-11 w-12 items-center justify-center text-white transition-opacity [--qm-focus-offset:-2px] aria-disabled:opacity-30 phone:qm-no-select"
    >
      {delta === -1 ? (
        <Minus className="h-[18px] w-[18px]" strokeWidth={2.6} aria-hidden="true" />
      ) : (
        <Plus className="h-[18px] w-[18px]" strokeWidth={2.6} aria-hidden="true" />
      )}
    </button>
    );
  };

  return (
    <div className={`hidden shrink-0 phone:flex ${className}`}>
      <div className="flex items-center overflow-hidden rounded-full bg-[var(--qm-fill)]">
        {renderButton(-1)}
        <span aria-hidden="true" className="h-5 w-px bg-white/20" />
        {renderButton(1)}
      </div>
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
