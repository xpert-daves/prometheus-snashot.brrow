/* Cloudflare Turnstile in the browser: the invisible check behind a chat
 * start and a quote submit. The server side is turnstileVerify.server.ts
 * (quotes) and the CRM (chat). */

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TURNSTILE_TIMEOUT_MS = 20_000;
let turnstileScript: Promise<TurnstileApi | null> | null = null;

/** The action a quote submit is checked under, on both sides. */
export const QUOTE_TURNSTILE_ACTION = 'quote_submit';
/**
 * How long a quote submit waits for the check. Past it the quote goes
 * unchecked, which the server still accepts within tighter limits.
 */
export const QUOTE_TURNSTILE_TIMEOUT_MS = 8_000;

export type TurnstileRunOptions = {
  /** Named in Cloudflare's report and checked by the server. */
  action: string;
  theme?: 'dark' | 'light' | 'auto';
  /** After this long the run gives up and resolves ''. */
  timeoutMs?: number;
};

export function getTurnstileSiteKey(): string {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';
}

/** Loads the Turnstile script once. Resolves null when no site key is set. */
export function loadTurnstile(): Promise<TurnstileApi | null> {
  if (!getTurnstileSiteKey() || typeof document === 'undefined') return Promise.resolve(null);
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstileScript) return turnstileScript;

  turnstileScript = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.turnstile ?? null);
    script.onerror = () => {
      turnstileScript = null;
      resolve(null);
    };
    document.head.appendChild(script);
  });
  return turnstileScript;
}

/**
 * Runs an invisible Turnstile challenge in `container` and returns its token.
 * Without a site key, or when the script can't load or the check fails or
 * times out, it returns '' and the server decides what an unchecked request
 * may do. The widget only shows itself if Cloudflare needs the visitor to
 * interact.
 */
export async function runTurnstile(
  container: HTMLElement | null,
  { action, theme = 'auto', timeoutMs = TURNSTILE_TIMEOUT_MS }: TurnstileRunOptions
): Promise<string> {
  if (!getTurnstileSiteKey()) return '';
  // The script load shares the time limit: a blocked or slow script must not
  // hold up whatever is waiting on the token.
  const turnstile = await Promise.race([
    loadTurnstile(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
  if (!turnstile || !container) return '';

  return new Promise((resolve) => {
    let widgetId: string | null = null;
    let settled = false;
    const finish = (token: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (widgetId) {
        try {
          turnstile.remove(widgetId);
        } catch {
          /* Already gone. */
        }
      }
      resolve(token);
    };
    const timer = setTimeout(() => finish(''), timeoutMs);
    try {
      widgetId = turnstile.render(container, {
        sitekey: getTurnstileSiteKey(),
        appearance: 'interaction-only',
        theme,
        action,
        callback: (token: string) => finish(token),
        'error-callback': () => finish(''),
        'expired-callback': () => finish(''),
      });
    } catch {
      finish('');
    }
  });
}

/**
 * runTurnstile for a caller with no place of its own to put the widget, such
 * as a form submit. The widget gets a holder fixed to the bottom of the
 * window, on <body> so no transformed ancestor can trap it, and the holder is
 * removed when the run ends. It stays empty unless Cloudflare asks the
 * visitor to interact.
 */
export async function runTurnstileOverPage(options: TurnstileRunOptions): Promise<string> {
  if (!getTurnstileSiteKey() || typeof document === 'undefined') return '';
  const holder = document.createElement('div');
  holder.setAttribute('data-turnstile-holder', options.action);
  holder.style.cssText =
    'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483000;';
  document.body.appendChild(holder);
  try {
    return await runTurnstile(holder, options);
  } finally {
    holder.remove();
  }
}
