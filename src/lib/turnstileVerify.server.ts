import 'server-only';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_VERIFY_TIMEOUT_MS = 4_000;
const TURNSTILE_TOKEN_MAX_LENGTH = 2_048;

/**
 * - `passed`: Cloudflare vouches for this request.
 * - `failed`: no token, or Cloudflare refused it (a script, a replayed token,
 *   a token made for another action).
 * - `unavailable`: Cloudflare could not be asked. Not the visitor's fault.
 * - `unconfigured`: TURNSTILE_SECRET_KEY is not set, so nothing is checked.
 */
export type TurnstileVerdict = 'passed' | 'failed' | 'unavailable' | 'unconfigured';

export function isTurnstileVerificationConfigured() {
  return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim());
}

/**
 * Asks Cloudflare whether `token` came from a real visit to this site for
 * `action`. A token works once, so a copied one fails. Never throws.
 */
export async function verifyTurnstileToken(args: {
  token: string | undefined;
  action: string;
  /** The visitor's address, when known. Cloudflare uses it as a signal. */
  remoteIp?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<TurnstileVerdict> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return 'unconfigured';
  const token = args.token?.trim();
  if (!token || token.length > TURNSTILE_TOKEN_MAX_LENGTH) return 'failed';

  const form = new URLSearchParams({ secret, response: token });
  if (args.remoteIp) form.set('remoteip', args.remoteIp);

  let result: unknown;
  try {
    const response = await (args.fetchImpl ?? fetch)(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body: form,
      cache: 'no-store',
      signal: AbortSignal.timeout(TURNSTILE_VERIFY_TIMEOUT_MS),
    });
    if (!response.ok) return 'unavailable';
    result = await response.json();
  } catch {
    return 'unavailable';
  }

  if (!result || typeof result !== 'object') return 'unavailable';
  const outcome = result as { success?: unknown; action?: unknown };
  if (outcome.success !== true) return 'failed';
  // A token solved for the chat can't be spent on a quote. Only a named,
  // different action fails: Cloudflare's test keys answer with no action at
  // all, and a real customer must never be counted as unchecked because a
  // field was left out.
  const action = typeof outcome.action === 'string' ? outcome.action : '';
  return action && action !== args.action ? 'failed' : 'passed';
}
