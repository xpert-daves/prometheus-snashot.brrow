import { writeLocalStorage } from "@/lib/safeStorage";

export const WEBSITE_MEASUREMENT_PATHS = ["/", "/quote", "/buildings", "/gallery", "/service-area", "/news", "/contact"] as const;
export const WEBSITE_MEASUREMENT_GROUPS = ["home", "quote", "buildings", "projects", "areas", "guides", "contact", "phone", "text", "email"] as const;
export const WEBSITE_PATHS = WEBSITE_MEASUREMENT_PATHS;
export const WEBSITE_GROUPS = WEBSITE_MEASUREMENT_GROUPS;
export const WEBSITE_MEASUREMENT_OPT_OUT_KEY = "shed210-measurement-disabled";
const PREFERENCE_EVENT = "shed210-measurement-preference";
const SESSION_KEY = "shed210-measurement-session-v1";
const QUEUE_KEY = "shed210-measurement-queue-v1";
const ATTRIBUTION_KEY = "shed210-measurement-attribution-v1";
const QUOTE_STARTED_KEY = "shed210-measurement-quote-started-v1";
const ATTRIBUTION_TTL = 30 * 86_400_000;
const ID = /^[A-Za-z0-9_-]{8,96}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

export type WebsiteEventName = "page_view" | "action_click" | "form_start" | "form_error";
export type WebsiteMeasurementGroup = (typeof WEBSITE_MEASUREMENT_GROUPS)[number];
export type WebsiteFailureCode = "validation" | "network" | "unavailable" | "rejected";
/**
 * Which kind of field stopped a submit the form blocked itself. A fixed word,
 * never what the visitor typed; "selection" covers building, size and options.
 */
export const WEBSITE_FAILURE_FIELDS = ["name", "email", "phone", "address", "consent", "selection"] as const;
export type WebsiteFailureField = (typeof WEBSITE_FAILURE_FIELDS)[number];
export type WebsiteTouch = {
  landingPath: string;
  referrer: "direct" | "google" | "bing" | "social" | "chatgpt" | "perplexity" | "claude" | "gemini" | "copilot" | "other";
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
};
export type WebsiteAttribution = { firstTouch: WebsiteTouch; lastTouch: WebsiteTouch };
export type QuoteMeasurement = { sessionId: string; attribution?: WebsiteAttribution };
export type WebsiteMeasurementContext = { sessionId: string; offer: WebsiteMeasurementGroup; attribution?: WebsiteAttribution };
export type WebsiteEventDetails = { offer?: WebsiteMeasurementGroup; cta?: string; failureCode?: WebsiteFailureCode; failureField?: WebsiteFailureField };
export type WebsiteMeasurementEvent = WebsiteMeasurementContext & WebsiteEventDetails & {
  eventId: string;
  name: WebsiteEventName;
  path: string;
};

const object = (value: unknown): Record<string, unknown> | undefined => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const token = (value: unknown) => typeof value === "string" && TOKEN.test(value) && !/\d{7,}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|^(?:sk_|pk_|rk_|ghp_|github_pat_|access_token|refresh_token|bearer_)/i.test(value) ? value.toLowerCase() : undefined;

/** Dynamic slugs are deliberately reduced to static categories before recording. */
export function websiteMeasurementPath(pathname: string): string | undefined {
  if ((WEBSITE_MEASUREMENT_PATHS as readonly string[]).includes(pathname)) return pathname;
  if (pathname.startsWith("/projects/")) return "/gallery";
  return ["/buildings", "/service-area", "/news"].find(path => pathname.startsWith(`${path}/`));
}

export function websiteMeasurementGroup(path: string): WebsiteMeasurementGroup {
  if (path === "/") return "home";
  if (path === "/gallery") return "projects";
  if (path === "/service-area") return "areas";
  if (path === "/news") return "guides";
  if (path === "/buildings") return "buildings";
  if (path === "/contact") return "contact";
  return "quote";
}

const REFERRERS = ["direct", "google", "bing", "social", "chatgpt", "perplexity", "claude", "gemini", "copilot", "other"];
const AI_HOSTS: Record<string, WebsiteTouch["referrer"]> = {
  "chatgpt.com": "chatgpt", "chat.openai.com": "chatgpt", "perplexity.ai": "perplexity",
  "claude.ai": "claude", "gemini.google.com": "gemini", "copilot.microsoft.com": "copilot",
};
const aiSource = (host: string) => Object.hasOwn(AI_HOSTS, host) ? AI_HOSTS[host] : undefined;
const sourceToken = (value: unknown) => typeof value === "string" ? aiSource(value.toLowerCase().replace(/^www\./, "")) ?? token(value) : undefined;

export function normalizeQuoteMeasurement(value: unknown): QuoteMeasurement | undefined {
  const input = object(value);
  if (!input || typeof input.sessionId !== "string" || !UUID.test(input.sessionId)) return undefined;
  return { sessionId: input.sessionId, attribution: normalizeWebsiteAttribution(input.attribution) };
}

function normalizeTouch(value: unknown): WebsiteTouch | undefined {
  const input = object(value);
  if (!input || typeof input.landingPath !== "string" || !(WEBSITE_MEASUREMENT_PATHS as readonly string[]).includes(input.landingPath) || typeof input.referrer !== "string" || !REFERRERS.includes(input.referrer)) return undefined;
  return { landingPath: input.landingPath, referrer: input.referrer as WebsiteTouch["referrer"], utmSource: sourceToken(input.utmSource), utmMedium: token(input.utmMedium), utmCampaign: token(input.utmCampaign) };
}

export function normalizeWebsiteAttribution(value: unknown): WebsiteAttribution | undefined {
  const input = object(value), firstTouch = normalizeTouch(input?.firstTouch), lastTouch = normalizeTouch(input?.lastTouch);
  return firstTouch && lastTouch ? { firstTouch, lastTouch } : undefined;
}

export function normalizeWebsiteEvent(value: unknown): WebsiteMeasurementEvent | undefined {
  const input = object(value);
  if (!input || typeof input.eventId !== "string" || !ID.test(input.eventId) || /^(accepted-|goal-)/.test(input.eventId) || typeof input.sessionId !== "string" || !ID.test(input.sessionId) || !["page_view", "action_click", "form_start", "form_error"].includes(String(input.name)) || typeof input.path !== "string" || !(WEBSITE_MEASUREMENT_PATHS as readonly string[]).includes(input.path)) return undefined;
  const offer = input.offer ?? websiteMeasurementGroup(input.path);
  if (!(WEBSITE_MEASUREMENT_GROUPS as readonly unknown[]).includes(offer)) return undefined;
  const failureCode = ["validation", "network", "unavailable", "rejected"].includes(String(input.failureCode)) ? input.failureCode as WebsiteFailureCode : undefined;
  const failureField = input.name === "form_error" && failureCode === "validation" && (WEBSITE_FAILURE_FIELDS as readonly unknown[]).includes(input.failureField) ? input.failureField as WebsiteFailureField : undefined;
  return {
    eventId: input.eventId, sessionId: input.sessionId, name: input.name as WebsiteEventName,
    path: input.path, offer: offer as WebsiteMeasurementGroup, cta: token(input.cta),
    failureCode, ...(failureField ? { failureField } : {}),
    attribution: normalizeWebsiteAttribution(input.attribution),
  };
}

export function websiteMeasurementPermitted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(WEBSITE_MEASUREMENT_OPT_OUT_KEY) !== "true" && navigator.doNotTrack !== "1" && !(navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;
  } catch { return false; }
}

/** Returns false when the browser refused to save the choice; listeners still recheck permission. */
export function setWebsiteMeasurementDisabled(disabled: boolean): boolean {
  if (typeof window === "undefined") return false;
  const saved = writeLocalStorage(WEBSITE_MEASUREMENT_OPT_OUT_KEY, String(disabled));
  window.dispatchEvent(new Event(PREFERENCE_EVENT));
  return saved;
}

let activeTracker: ReturnType<typeof createWebsiteMeasurementTracker> | undefined;
const reportedQuoteReceipts = new Set<string>();
const reportedQuoteSteps = new Set<string>();

/** Clarity smart events, production hosts only; returns whether the event was sent. */
function sendClarityEvent(name: string): boolean {
  if (!websiteMeasurementPermitted() ||
      !["www.shed210.com", "shed210.com"].includes(window.location.hostname)) return false;
  const clarity = (window as Window & { clarity?: (command: string, event: string) => void }).clarity;
  if (typeof clarity !== "function") return false;
  try {
    clarity("event", name);
    return true;
  } catch { return false; /* Analytics must never interrupt the quote flow. */ }
}

/** A server-saved request, never a Continue click, qualified lead, or sale. */
export function trackSavedQuoteInClarity(quoteId: string): void {
  if (reportedQuoteReceipts.has(quoteId)) return;
  if (sendClarityEvent("quote_request_saved")) reportedQuoteReceipts.add(quoteId);
}

/** Indexed by quote step; together with quote_request_saved they form the Clarity funnel. */
export const QUOTE_STEP_CLARITY_EVENTS = ["quote_step_1_size", "quote_step_2_materials", "quote_step_3_contact"] as const;

/**
 * The first time this page load reaches a quote step. Clarity's own "Submit
 * form" counts every Continue tap, so it cannot show where people drop off.
 */
export function trackQuoteStepInClarity(step: number): void {
  const name = QUOTE_STEP_CLARITY_EVENTS[step];
  if (!name || reportedQuoteSteps.has(name)) return;
  if (sendClarityEvent(name)) reportedQuoteSteps.add(name);
}

/** Values are restricted to categories; callers must never pass form answers. */
export function trackWebsiteEvent(name: WebsiteEventName, details?: WebsiteEventDetails): void {
  activeTracker?.track(name, details);
}

export function getWebsiteMeasurementContext(): WebsiteMeasurementContext | undefined {
  return activeTracker?.context();
}

function entryTouch(): WebsiteTouch | undefined {
  try {
    const url = new URL(window.location.href), landingPath = websiteMeasurementPath(url.pathname);
    if (!landingPath) return undefined;
    let referrer: WebsiteTouch["referrer"] = "direct";
    if (document.referrer) {
      const host = new URL(document.referrer).hostname.toLowerCase().replace(/^www\./, "");
      if (host !== url.hostname.toLowerCase().replace(/^www\./, "")) {
        referrer = aiSource(host) ?? (/(^|\.)google\.[a-z.]+$/.test(host) ? "google" : /(^|\.)bing\.com$/.test(host) ? "bing" : /(^|\.)(facebook|instagram|linkedin|tiktok|twitter|x)\.com$/.test(host) ? "social" : "other");
      }
    }
    return { landingPath, referrer, utmSource: sourceToken(url.searchParams.get("utm_source")), utmMedium: token(url.searchParams.get("utm_medium")), utmCampaign: token(url.searchParams.get("utm_campaign")) };
  } catch { return undefined; }
}

export function createWebsiteMeasurementTracker() {
  let sessionId: string | undefined;
  let attribution: WebsiteAttribution | undefined;
  let queue: WebsiteMeasurementEvent[] = [];
  let initialized = false, connected = false, sending = false, quoteStarted = false;
  let lastPage: string | undefined;
  let nextRetryAt = 0, retryDelay = 15_000;
  let request: AbortController | undefined;

  function clear() {
    sessionId = undefined; attribution = undefined; queue = []; initialized = false; quoteStarted = false; lastPage = undefined;
    request?.abort();
    try {
      localStorage.removeItem(ATTRIBUTION_KEY);
      for (const key of [SESSION_KEY, QUEUE_KEY, QUOTE_STARTED_KEY]) sessionStorage.removeItem(key);
    } catch { /* Privacy restrictions must not affect quotes or navigation. */ }
  }

  function ready() {
    if (!websiteMeasurementPermitted()) { clear(); return false; }
    if (initialized) return true;
    try {
      const savedSession = sessionStorage.getItem(SESSION_KEY);
      sessionId = savedSession && ID.test(savedSession) ? savedSession : crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, sessionId);
      quoteStarted = sessionStorage.getItem(QUOTE_STARTED_KEY) === sessionId;
      const pending: unknown = JSON.parse(sessionStorage.getItem(QUEUE_KEY) || "[]");
      if (Array.isArray(pending)) queue = pending.map(normalizeWebsiteEvent).filter((event): event is WebsiteMeasurementEvent => !!event && event.sessionId === sessionId).slice(-50);
      const saved = object(JSON.parse(localStorage.getItem(ATTRIBUTION_KEY) || "null"));
      const validExpiry = typeof saved?.expiresAt === "number" && saved.expiresAt > Date.now() && saved.expiresAt <= Date.now() + ATTRIBUTION_TTL;
      attribution = validExpiry ? normalizeWebsiteAttribution(saved?.value) : undefined;
      const touch = entryTouch();
      if (touch) {
        attribution = attribution ? { firstTouch: attribution.firstTouch, lastTouch: touch.utmSource || touch.utmCampaign || touch.referrer !== "direct" ? touch : attribution.lastTouch } : { firstTouch: touch, lastTouch: touch };
        localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify({ value: attribution, expiresAt: validExpiry ? saved!.expiresAt : Date.now() + ATTRIBUTION_TTL }));
      }
      initialized = true;
      return true;
    } catch { clear(); return false; }
  }

  function persistQueue() {
    try { sessionStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); } catch { /* Optional measurement. */ }
  }

  async function flush() {
    if (!ready() || !connected || sending || !queue.length || Date.now() < nextRetryAt) return;
    sending = true;
    const batch = queue.slice(0, 10), controller = new AbortController();
    request = controller;
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const retry = () => { nextRetryAt = Date.now() + retryDelay; retryDelay = Math.min(retryDelay * 2, 300_000); };
    try {
      const response = await fetch("/api/website-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ events: batch }), keepalive: true, signal: controller.signal });
      if (!websiteMeasurementPermitted()) { clear(); return; }
      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
        const ids = new Set(batch.map(event => event.eventId));
        queue = queue.filter(event => !ids.has(event.eventId));
        persistQueue(); nextRetryAt = 0; retryDelay = 15_000;
      } else retry();
    } catch { retry(); }
    finally { clearTimeout(timeout); if (request === controller) request = undefined; sending = false; }
  }

  function context(): WebsiteMeasurementContext | undefined {
    if (!connected || !ready() || !sessionId) return undefined;
    const path = websiteMeasurementPath(window.location.pathname);
    return path ? { sessionId, offer: websiteMeasurementGroup(path), attribution } : undefined;
  }

  function track(name: WebsiteEventName, details?: WebsiteEventDetails) {
    const current = context(), path = websiteMeasurementPath(window.location.pathname);
    if (!current || !path) return;
    if (name === "form_start" && path === "/quote") {
      if (quoteStarted) return;
      quoteStarted = true;
      try { sessionStorage.setItem(QUOTE_STARTED_KEY, current.sessionId); } catch { /* Optional measurement. */ }
    }
    const event = normalizeWebsiteEvent({ ...current, ...details, eventId: crypto.randomUUID(), name, path });
    if (!event) return;
    queue = [...queue, event].slice(-50); persistQueue(); void flush();
  }

  function pageView(pathname: string) {
    if (!connected || !ready() || !websiteMeasurementPath(pathname) || lastPage === pathname) return;
    lastPage = pathname;
    track("page_view");
  }

  function click(event: MouseEvent) {
    // Next Link prevents the native navigation before this delegated listener runs.
    if (event.button !== undefined && event.button !== 0) return;
    const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
    if (!anchor) return;
    try {
      const url = new URL(anchor.href, window.location.href);
      const channel = { "tel:": "phone", "sms:": "text", "mailto:": "email" }[url.protocol] as "phone" | "text" | "email" | undefined;
      if (channel) track("action_click", { offer: channel, cta: `${channel}-link` });
      else if (url.origin === window.location.origin && (url.pathname === "/quote" || url.pathname === "/contact")) track("action_click", { offer: url.pathname === "/quote" ? "quote" : "contact", cta: url.pathname === "/quote" ? "quote-link" : "contact-link" });
    } catch { /* An invalid link is not a measurement event. */ }
  }

  function quoteInput(event: Event) {
    const target = event.target;
    if (window.location.pathname !== "/quote" || !(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) || !target.closest("#quote-active-step-form") || target.disabled || (target instanceof HTMLInputElement && ["hidden", "submit", "button"].includes(target.type))) return;
    track("form_start");
  }

  // The phone quote layout (< 48rem) picks the building, size and options with
  // buttons, which fire no input/change events; count the first one as a start.
  // Desktop keeps the input/change rule above so its funnel stays comparable.
  function quoteTap(event: MouseEvent) {
    const target = event.target instanceof Element ? event.target.closest("button") : null;
    if (window.location.pathname !== "/quote" || !target || target.disabled || target.getAttribute("aria-disabled") === "true" || !target.closest("#quote-active-step-form") || typeof window.matchMedia !== "function" || !window.matchMedia("(width < 48rem)").matches) return;
    track("form_start");
  }

  function connect() {
    connected = true;
    activeTracker = tracker;
    const preference = () => { if (!websiteMeasurementPermitted()) clear(); };
    const online = () => { nextRetryAt = 0; void flush(); };
    const visibility = () => { if (document.visibilityState === "hidden") void flush(); };
    window.addEventListener("storage", preference);
    window.addEventListener(PREFERENCE_EVENT, preference);
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("click", click);
    document.addEventListener("click", quoteTap);
    document.addEventListener("input", quoteInput);
    document.addEventListener("change", quoteInput);
    const timer = window.setInterval(() => void flush(), 15_000);
    void flush();
    return () => {
      connected = false;
      if (activeTracker === tracker) activeTracker = undefined;
      window.removeEventListener("storage", preference);
      window.removeEventListener(PREFERENCE_EVENT, preference);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("click", click);
      document.removeEventListener("click", quoteTap);
      document.removeEventListener("input", quoteInput);
      document.removeEventListener("change", quoteInput);
      window.clearInterval(timer);
    };
  }

  const tracker = { connect, pageView, track, context };
  return tracker;
}
