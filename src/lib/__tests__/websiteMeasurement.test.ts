import {
  createWebsiteMeasurementTracker,
  getWebsiteMeasurementContext,
  normalizeWebsiteEvent,
  normalizeQuoteMeasurement,
  setWebsiteMeasurementDisabled,
  trackWebsiteEvent,
  WEBSITE_MEASUREMENT_OPT_OUT_KEY,
  websiteMeasurementPath,
  websiteMeasurementPermitted,
} from "../websiteMeasurement";

const event = { eventId: "event-abcdefgh", sessionId: "session-abcdefgh", name: "page_view", path: "/gallery", offer: "projects" };
const originalFetch = global.fetch;
const drain = async () => { await Promise.resolve(); await Promise.resolve(); };
let disconnect: (() => void) | undefined;

beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear(); sessionStorage.clear();
  window.history.replaceState({}, "", "/quote");
  Object.defineProperty(navigator, "doNotTrack", { configurable: true, value: undefined });
  Object.defineProperty(navigator, "globalPrivacyControl", { configurable: true, value: undefined });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
});

afterEach(() => {
  disconnect?.(); disconnect = undefined;
  global.fetch = originalFetch;
  jest.useRealTimers(); jest.restoreAllMocks();
});

it("reduces private dynamic paths to public categories and strips query/contact fields", () => {
  expect(websiteMeasurementPath("/projects/austin/jane-doe-12345678")).toBe("/gallery");
  expect(websiteMeasurementPath("/buildings/customer-model")).toBe("/buildings");
  expect(websiteMeasurementPath("/news/something-private")).toBe("/news");
  expect(websiteMeasurementPath("/account/private")).toBeUndefined();
  const safe = normalizeWebsiteEvent({ ...event, email: "private@example.com", href: "https://example.com/?token=secret", cta: "mailto:private@example.com", attribution: { firstTouch: { landingPath: "/gallery", referrer: "google", utmCampaign: "private@example.com", utmSource: "12105551234" }, lastTouch: { landingPath: "/gallery", referrer: "direct" } } });
  expect(safe).toMatchObject(event);
  expect(JSON.stringify(safe)).not.toMatch(/private|secret|email|href|mailto|12105551234/);
  expect(normalizeWebsiteEvent({ ...event, path: "/projects/austin/person" })).toBeUndefined();
  expect(normalizeWebsiteEvent({ ...event, name: "goal_completed" })).toBeUndefined();
  expect(normalizeWebsiteEvent({ ...event, eventId: "goal-forged-event" })).toBeUndefined();
  expect(normalizeWebsiteEvent({ ...event, eventId: "accepted-forged-event" })).toBeUndefined();
});

it("keeps the field that blocked a submit only as a fixed word on form validation failures", () => {
  const failure = { ...event, name: "form_error", path: "/quote", offer: "quote", failureCode: "validation", failureField: "consent" };
  expect(normalizeWebsiteEvent(failure)).toMatchObject({ failureCode: "validation", failureField: "consent" });
  expect(normalizeWebsiteEvent({ ...failure, failureCode: "network" })).not.toHaveProperty("failureField");
  expect(normalizeWebsiteEvent({ ...failure, name: "form_start" })).not.toHaveProperty("failureField");
  const typed = normalizeWebsiteEvent({ ...failure, failureField: "jane@customer.test" });
  expect(typed).toMatchObject({ failureCode: "validation" });
  expect(JSON.stringify(typed)).not.toContain("jane");
});

it("honors browser privacy signals and fails closed when storage is unavailable", () => {
  expect(websiteMeasurementPermitted()).toBe(true);
  Object.defineProperty(navigator, "doNotTrack", { configurable: true, value: "1" });
  expect(websiteMeasurementPermitted()).toBe(false);
  Object.defineProperty(navigator, "doNotTrack", { configurable: true, value: undefined });
  Object.defineProperty(navigator, "globalPrivacyControl", { configurable: true, value: true });
  expect(websiteMeasurementPermitted()).toBe(false);
  Object.defineProperty(navigator, "globalPrivacyControl", { configurable: true, value: false });
  jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Blocked"); });
  expect(websiteMeasurementPermitted()).toBe(false);
});

it("still announces an opt-out change when the browser refuses to save it", () => {
  const announced = jest.fn();
  window.addEventListener("shed210-measurement-preference", announced);
  try {
    expect(setWebsiteMeasurementDisabled(true)).toBe(true);
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    expect(setWebsiteMeasurementDisabled(false)).toBe(false);
    jest.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    expect(setWebsiteMeasurementDisabled(false)).toBe(false);
    expect(announced).toHaveBeenCalledTimes(3);
  } finally { window.removeEventListener("shed210-measurement-preference", announced); }
});

it.each([
  ["https://chatgpt.com/", "chatgpt"], ["https://www.perplexity.ai/", "perplexity"],
  ["https://claude.ai/", "claude"], ["https://gemini.google.com/", "gemini"],
  ["https://copilot.microsoft.com/", "copilot"],
])("preserves named AI referral %s with no prompt, path, or query", (referrer, source) => {
  jest.spyOn(document, "referrer", "get").mockReturnValue(`${referrer}private-prompt?query=secret`);
  const tracker = createWebsiteMeasurementTracker(); disconnect = tracker.connect();
  expect(getWebsiteMeasurementContext()?.attribution?.firstTouch.referrer).toBe(source);
  expect(JSON.stringify(getWebsiteMeasurementContext())).not.toMatch(/private-prompt|secret/);
});

it("normalizes ChatGPT domain UTM and strips non-allowlisted quote measurement fields", () => {
  window.history.replaceState({}, "", "/quote?utm_source=chatgpt.com");
  const tracker = createWebsiteMeasurementTracker(); disconnect = tracker.connect();
  const context = getWebsiteMeasurementContext();
  expect(context?.attribution?.firstTouch.utmSource).toBe("chatgpt");
  expect(normalizeQuoteMeasurement({ ...context, email: "private@example.com" })).toEqual({ sessionId: context?.sessionId, attribution: context?.attribution });
  expect(normalizeQuoteMeasurement({ sessionId: "private@example.com" })).toBeUndefined();
  expect(normalizeQuoteMeasurement({ sessionId: "2105550199" })).toBeUndefined();
});

it('removes credential-shaped and numeric UTM values from attribution', () => {
  window.history.replaceState({}, '', '/quote?utm_source=sk_live_testsecret&utm_medium=2105550199&utm_campaign=github_pat_private');
  const tracker = createWebsiteMeasurementTracker(); disconnect = tracker.connect();
  const touch = getWebsiteMeasurementContext()?.attribution?.firstTouch;
  expect(touch?.utmSource).toBeUndefined(); expect(touch?.utmMedium).toBeUndefined(); expect(touch?.utmCampaign).toBeUndefined();
});

it.each(['__proto__', 'constructor', 'toString'])("does not treat inherited %s properties as AI providers", source => {
  window.history.replaceState({}, '', `/quote?utm_source=${source}`);
  const tracker = createWebsiteMeasurementTracker(); disconnect = tracker.connect();
  const value = getWebsiteMeasurementContext()?.attribution?.firstTouch.utmSource;
  expect(value === undefined || typeof value === 'string').toBe(true);
  expect(() => JSON.stringify(getWebsiteMeasurementContext())).not.toThrow();
});

it("retries the same event ID and sends at most ten of fifty queued events", async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 503 });
  const tracker = createWebsiteMeasurementTracker(); disconnect = tracker.connect();
  tracker.pageView("/quote"); await drain();
  const first = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).events[0];
  for (let i = 0; i < 20; i++) trackWebsiteEvent("form_error", { failureCode: "network" });
  jest.advanceTimersByTime(15_000); await drain();
  const replay = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body).events;
  expect(replay).toHaveLength(10);
  expect(replay[0].eventId).toBe(first.eventId);
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 503 });
  for (let i = 0; i < 100; i++) trackWebsiteEvent("form_error", { failureCode: "network" });
  await drain();
  expect(JSON.parse(sessionStorage.getItem("shed210-measurement-queue-v1")!)).toHaveLength(50);
});

it("disabling in this tab clears queued data and removes optional quote context", async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 503 });
  const tracker = createWebsiteMeasurementTracker(); disconnect = tracker.connect();
  tracker.pageView("/quote"); await drain();
  expect(getWebsiteMeasurementContext()?.offer).toBe("quote");
  setWebsiteMeasurementDisabled(true);
  expect(getWebsiteMeasurementContext()).toBeUndefined();
  expect(sessionStorage.getItem("shed210-measurement-queue-v1")).toBeNull();
  expect(localStorage.getItem("shed210-measurement-attribution-v1")).toBeNull();
  trackWebsiteEvent("form_error", { failureCode: "validation" });
  jest.advanceTimersByTime(60_000); await drain();
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

it("rechecks another tab's opt-out before sending or returning quote context", async () => {
  const tracker = createWebsiteMeasurementTracker(); disconnect = tracker.connect();
  tracker.pageView("/quote"); await drain();
  localStorage.setItem(WEBSITE_MEASUREMENT_OPT_OUT_KEY, "true");
  // Even before a storage event arrives, every read and send checks permission.
  trackWebsiteEvent("form_error", { failureCode: "validation" });
  expect(getWebsiteMeasurementContext()).toBeUndefined();
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

it("sanitizes entry attribution and keeps the initial acquisition source across direct return", async () => {
  window.history.replaceState({}, "", "/news/customer-story?utm_source=google&utm_campaign=summer&utm_term=private@example.com");
  let tracker = createWebsiteMeasurementTracker(); disconnect = tracker.connect();
  tracker.pageView(window.location.pathname); await drain();
  expect(getWebsiteMeasurementContext()?.attribution?.firstTouch).toMatchObject({ landingPath: "/news", utmSource: "google", utmCampaign: "summer" });
  expect(JSON.stringify((global.fetch as jest.Mock).mock.calls)).not.toContain("customer-story");
  expect(JSON.stringify((global.fetch as jest.Mock).mock.calls)).not.toContain("private@example.com");
  disconnect();
  window.history.replaceState({}, "", "/quote");
  tracker = createWebsiteMeasurementTracker(); disconnect = tracker.connect();
  expect(getWebsiteMeasurementContext()?.attribution?.lastTouch.utmCampaign).toBe("summer");
});
