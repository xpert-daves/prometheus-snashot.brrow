'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { motionAllowed } from '@/lib/useCompactViewport';

export type QuoteActionSheetAction = {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
};

const CLOSE_MS = 240;

/**
 * Phone-only iOS action sheet: a floating glass group of actions plus a
 * separate Cancel capsule. Mount it only while open (one dialog at a time);
 * it plays its own exit animation before calling the chosen handler.
 * Backdrop tap and Escape cancel; Tab stays inside the sheet.
 */
export function QuoteActionSheet({
  container,
  title,
  message,
  actions,
  cancelLabel = 'Cancel',
  onCancel,
}: {
  /** Overlay host inside the quote app (outside the transformed step form). */
  container: HTMLElement | null;
  title: string;
  message?: string;
  actions: readonly QuoteActionSheetAction[];
  cancelLabel?: string;
  onCancel: () => void;
}) {
  const titleId = useId();
  const messageId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const settledRef = useRef(false);
  const closeTimerRef = useRef<number | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus({ preventScroll: true });

    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  const settle = (then: () => void) => {
    if (settledRef.current) return;
    settledRef.current = true;
    if (!motionAllowed()) {
      then();
      return;
    }
    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      then();
    }, CLOSE_MS);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      settle(onCancel);
      return;
    }
    if (event.key !== 'Tab') return;

    const buttons = Array.from(
      panelRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? []
    );
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (!first || !last) return;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === panelRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const sheet = (
    <div
      className="fixed inset-0 z-[70] flex touch-none flex-col justify-end"
      onKeyDown={handleKeyDown}
    >
      <div
        aria-hidden="true"
        onClick={() => settle(onCancel)}
        className={`absolute inset-0 bg-black/45 ${
          closing
            ? 'animate-[qm-fade_0.24s_ease-in_reverse_both]'
            : 'animate-[qm-fade_0.3s_ease-out_both]'
        }`}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? messageId : undefined}
        tabIndex={-1}
        className={`relative mx-2 mb-[max(8px,env(safe-area-inset-bottom,0px))] flex flex-col gap-2 outline-none ${
          closing
            ? 'animate-[qm-sheet-up_0.24s_cubic-bezier(0.4,0,1,1)_reverse_both]'
            : 'phone:qm-animate-sheet'
        }`}
      >
        <div className="overflow-hidden rounded-[28px] phone:qm-glass">
          <div className="px-6 pb-3.5 pt-4 text-center">
            <p
              id={titleId}
              className="m-0 text-[var(--qm-label-2)] phone:qm-footnote phone:font-semibold!"
            >
              {title}
            </p>
            {message ? (
              <p
                id={messageId}
                className="m-0 mt-1 text-[var(--qm-label-2)] phone:qm-footnote"
              >
                {message}
              </p>
            ) : null}
          </div>
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => settle(action.onSelect)}
              className={`justify-center shadow-[inset_0_0.5px_0_var(--qm-sep)] phone:qm-row phone:min-h-[57px]! phone:text-[19px]! ${
                action.destructive
                  ? 'phone:text-[var(--qm-danger)]!'
                  : 'phone:text-[var(--accent-light)]!'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => settle(onCancel)}
          className="w-full phone:qm-capsule phone:qm-capsule-glass phone:min-h-[57px]! phone:text-[19px]!"
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );

  return container ? createPortal(sheet, container) : sheet;
}
