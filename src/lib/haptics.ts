import { mq } from '@/lib/useCompactViewport';

/**
 * Lightweight haptic feedback for the phone quote flow.
 *
 * - Android/Chrome: Vibration API patterns.
 * - iOS 18+ Safari: toggling a native `<input type="checkbox" switch>` plays the
 *   system selection tick, so a throwaway switch is clicked through its label.
 *   WebKit only plays it inside a user gesture, so call this synchronously from
 *   a tap handler (never from effects or after a fetch). iOS has one tick, so
 *   every kind feels the same there.
 *
 * The throwaway element is appended to <body>, outside the quote form, so the
 * form_start listener never counts it. Everything is a no-op without a coarse
 * pointer, so desktop and tests stay silent.
 */
export type HapticKind = 'selection' | 'impact' | 'success' | 'error';

const vibrationPatterns: Record<HapticKind, number | number[]> = {
  selection: 12,
  impact: 18,
  success: [14, 70, 24],
  error: [22, 50, 22, 50, 22],
};

function playIosSwitchTick() {
  const previousFocus = document.activeElement;
  const label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.cssText =
    'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.tabIndex = -1;
  input.setAttribute('switch', '');
  label.appendChild(input);
  document.body.appendChild(label);
  label.click();
  label.remove();
  if (
    previousFocus instanceof HTMLElement &&
    previousFocus !== document.activeElement &&
    previousFocus.isConnected
  ) {
    previousFocus.focus({ preventScroll: true });
  }
}

export function triggerHaptic(
  kind: HapticKind = 'selection',
  options: { androidOnly?: boolean } = {}
) {
  if (!mq('(pointer: coarse)')) return;

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(vibrationPatterns[kind]);
      return;
    }

    // Native `switch` inputs already tick on iOS; avoid a double tap.
    if (options.androidOnly) return;
    playIosSwitchTick();
  } catch {
    // Haptics are decorative; never let them interrupt the flow.
  }
}
