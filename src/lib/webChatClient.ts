import { runTurnstile } from '@/lib/turnstile';
import { readLocalStorage, removeLocalStorage, writeLocalStorage } from '@/lib/safeStorage';

/**
 * Browser client for the CRM's website chat routes (`/api/web-chat/*` on the
 * CRM Convex site). The CRM picks the tenant from the Origin header, so the
 * body never names one. Every call is a JSON POST; errors carry the short code
 * the CRM returns (`closed`, `busy`, `check`, `token`, `contact`).
 */

export type ChatAuthor = 'visitor' | 'assistant' | 'staff' | 'system';

export type ChatMessage = {
  id: string;
  author: ChatAuthor;
  body: string;
  createdAt: number;
};

export type ChatConfig = {
  enabled: boolean;
  greeting: string;
  businessName: string;
};

export type ChatMessagesResult = {
  messages: ChatMessage[];
  typing: boolean;
  askContact: boolean;
};

export type ChatSmsConsent = { text: string; version: string };

export type ChatContact = {
  name: string;
  phone?: string;
  email?: string;
  smsConsent?: ChatSmsConsent;
};

export const CHAT_SESSION_STORAGE_KEY = 'shed210-chat-session';
export const CHAT_MESSAGE_MAX_LENGTH = 1000;
export const CHAT_PAGE_CONTEXT_MAX_LENGTH = 300;
const QUOTE_PARAMS_KEY = 'quote-params';
const REQUEST_TIMEOUT_MS = 12_000;

export class WebChatError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(`web chat ${code} (${status})`);
    this.name = 'WebChatError';
    this.status = status;
    this.code = code;
  }
}

/**
 * The CRM chat origin, or null when chat is not configured. Only an https
 * `*.convex.site` origin is accepted, matching the CSP entry next.config adds.
 */
export function getChatBaseUrl(
  value: string | undefined = process.env.NEXT_PUBLIC_CRM_CHAT_URL
): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (!url.hostname.endsWith('.convex.site')) return null;
    return url.origin;
  } catch {
    return null;
  }
}

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const base = getChatBaseUrl();
  if (!base) throw new WebChatError(0, 'unconfigured');

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      credentials: 'omit',
      signal: controller?.signal,
    });
  } catch {
    throw new WebChatError(0, 'network');
  } finally {
    if (timer) clearTimeout(timer);
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const code =
      data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : 'error';
    throw new WebChatError(response.status, code);
  }
  if (!data || typeof data !== 'object') throw new WebChatError(response.status, 'invalid');
  return data as T;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function fetchChatConfig(): Promise<ChatConfig> {
  const data = await postJson<Partial<ChatConfig>>('/api/web-chat/config', {});
  return {
    enabled: data.enabled === true,
    greeting: asString(data.greeting),
    businessName: asString(data.businessName) || 'Shed210',
  };
}

export async function startChat(input: {
  turnstileToken: string;
  pageUrl: string;
  pageTitle: string;
}): Promise<{ token: string; greeting: string }> {
  const data = await postJson<{ token?: unknown; greeting?: unknown }>('/api/web-chat/start', {
    turnstileToken: input.turnstileToken,
    website: '',
    pageUrl: input.pageUrl,
    pageTitle: input.pageTitle,
  });
  const token = asString(data.token);
  if (!token) throw new WebChatError(200, 'invalid');
  return { token, greeting: asString(data.greeting) };
}

export async function sendChatMessage(input: {
  token: string;
  body: string;
  pageUrl: string;
  pageTitle: string;
  pageContext?: string;
}): Promise<{ messageId: string }> {
  const data = await postJson<{ messageId?: unknown }>('/api/web-chat/send', {
    token: input.token,
    body: input.body.slice(0, CHAT_MESSAGE_MAX_LENGTH),
    pageUrl: input.pageUrl,
    pageTitle: input.pageTitle,
    ...(input.pageContext
      ? { pageContext: input.pageContext.slice(0, CHAT_PAGE_CONTEXT_MAX_LENGTH) }
      : {}),
  });
  return { messageId: asString(data.messageId) };
}

const AUTHORS: readonly ChatAuthor[] = ['visitor', 'assistant', 'staff', 'system'];

function toChatMessage(value: unknown): ChatMessage | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const id = asString(raw.id);
  const author = AUTHORS.find((candidate) => candidate === raw.author);
  const body = asString(raw.body);
  const createdAt = typeof raw.createdAt === 'number' ? raw.createdAt : NaN;
  if (!id || !author || !body || !Number.isFinite(createdAt)) return null;
  return { id, author, body, createdAt };
}

export async function fetchChatMessages(input: {
  token: string;
  after: number | null;
}): Promise<ChatMessagesResult> {
  const data = await postJson<{ messages?: unknown; typing?: unknown; askContact?: unknown }>(
    '/api/web-chat/messages',
    { token: input.token, after: input.after }
  );
  const messages = Array.isArray(data.messages)
    ? data.messages.map(toChatMessage).filter((message): message is ChatMessage => message !== null)
    : [];
  return { messages, typing: data.typing === true, askContact: data.askContact === true };
}

export async function shareChatContact(
  input: ChatContact & { token: string; pageUrl: string }
): Promise<void> {
  // pageUrl is recorded by the CRM as the page where SMS consent was given.
  await postJson('/api/web-chat/contact', {
    token: input.token,
    pageUrl: input.pageUrl,
    name: input.name,
    ...(input.phone ? { phone: input.phone } : {}),
    ...(input.email ? { email: input.email } : {}),
    ...(input.smsConsent ? { smsConsent: input.smsConsent } : {}),
  });
}

/* ---------- Stored session ---------- */

export type StoredChatSession = { token: string; contactShared: boolean };

export function readStoredChatSession(): StoredChatSession | null {
  const raw = readLocalStorage(CHAT_SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredChatSession>;
    if (typeof parsed.token === 'string' && parsed.token) {
      return { token: parsed.token, contactShared: parsed.contactShared === true };
    }
  } catch {
    /* Unreadable value: treat as no session. */
  }
  return null;
}

export function writeStoredChatSession(session: StoredChatSession): void {
  writeLocalStorage(CHAT_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredChatSession(): void {
  removeLocalStorage(CHAT_SESSION_STORAGE_KEY);
}

/* ---------- Page context ---------- */

/**
 * A short, PII-free description of where the visitor is: the path, the page
 * title, and the saved quote draft's structure type and size when present.
 */
export function buildPageContext(pathname: string, title: string): string {
  const parts = [`Page: ${pathname}`];
  if (title.trim()) parts.push(`Title: ${title.trim()}`);
  const draft = summarizeQuoteDraft();
  if (draft) parts.push(`Saved quote: ${draft}`);
  return parts.join(' | ').slice(0, CHAT_PAGE_CONTEXT_MAX_LENGTH);
}

function summarizeQuoteDraft(): string | null {
  const raw = readLocalStorage(QUOTE_PARAMS_KEY);
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw) as Record<string, unknown>;
    const type = typeof draft.structureType === 'string' ? draft.structureType : '';
    if (!/^[a-z_]{1,32}$/.test(type)) return null;
    const label = type.replace(/_/g, ' ');
    const length = toFeet(draft.length);
    const width = toFeet(draft.width);
    return length && width ? `${label} ${length}x${width} ft` : label;
  } catch {
    return null;
  }
}

function toFeet(value: unknown): number | null {
  const number = typeof value === 'string' ? Number(value) : value;
  return typeof number === 'number' && Number.isInteger(number) && number > 0 && number < 200
    ? number
    : null;
}

/* ---------- Cloudflare Turnstile ---------- */

// The check itself lives in turnstile.ts, shared with the quote form.
export { getTurnstileSiteKey, loadTurnstile } from '@/lib/turnstile';

/**
 * Runs the invisible check for a chat start in `container` and returns its
 * token. Without a site key it returns '' (the CRM then decides whether to
 * accept).
 */
export function getTurnstileToken(container: HTMLElement | null): Promise<string> {
  return runTurnstile(container, { action: 'web_chat_start', theme: 'dark' });
}
