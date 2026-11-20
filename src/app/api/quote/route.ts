import { after, NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { PHONE_DISPLAY } from '@/lib/contact';
import { calculateQuote } from '@/lib/pricing/calculateQuote';
import { saveQuote, type QuoteSmsConsent } from '@/lib/quotePersistence';
import {
  buildQuoteResponse,
  isJsonRequestContentType,
  mapParsedQuoteToParams,
  normalizeQuotePhone,
  QuoteRequestBodyTooLargeError,
  readJsonRequestBody,
  validateQuoteRequest,
} from '@/lib/quoteRoute';
import {
  SMS_MARKETING_CONSENT_TEXT,
  SMS_MARKETING_CONSENT_TEXT_VERSION,
  SMS_CONSENT_TEXT,
  SMS_CONSENT_TEXT_VERSION,
  SMS_UNIFIED_CONSENT_TEXT,
  SMS_UNIFIED_CONSENT_TEXT_VERSION,
  SMS_QUOTE_CONSENT_TEXT_BY_VERSION,
} from '@/lib/smsConsent';
import { buildQuoteVisualPlacement } from '@/lib/quoteVisualPlacement';
import {
  buildQuotePricingConfigMetadata,
  getConfiguredQuotePricingProvider,
  readActiveQuotePricingSettingsForServer,
} from '@/lib/quotePricingSettings';
import {
  checkSharedQuoteRateLimit,
  type QuoteRateLimitResult,
} from '@/lib/quoteRateLimit';
import {
  BoundedFixedWindowRateLimiter,
  getClientNetworkIdentity,
} from '@/lib/publicRequestSecurity';
import { QUOTE_TURNSTILE_ACTION } from '@/lib/turnstile';
import { verifyTurnstileToken } from '@/lib/turnstileVerify.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_SIZE_BYTES = 32_768;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const SESSION_RATE_LIMIT_WINDOW_MS = 15 * 60_000;
const SESSION_RATE_LIMIT_MAX_REQUESTS = 8;
// One network address may send this many well-formed quotes in a UTC day. The
// most one browser session had sent by October 2026 was 10, comparing options.
// Without this
// a single script could use up the 100 quotes a day the whole site is allowed
// (convex/quoteSubmissionQuota.ts) and every customer after it was refused.
const VISITOR_DAY_LIMIT_WINDOW_MS = 24 * 60 * 60_000;
const VISITOR_DAY_LIMIT_MAX_REQUESTS = 12;
// A quote that didn't pass the bot check (TURNSTILE_SECRET_KEY set, and the
// token missing, refused, or Cloudflare unreachable) is still taken, so a
// customer whose browser blocks the check isn't turned away. But unchecked
// quotes share a small day's allowance: 5 from one address and 20 for the
// whole site. A script that can't pass the check can then send the owner 20
// alerts a day at most, and can't reach the site's 100-a-day quota that would
// close the form to checked customers.
const UNCHECKED_ADDRESS_DAY_MAX_REQUESTS = 5;
const UNCHECKED_SITE_DAY_MAX_REQUESTS = 20;
const RATE_LIMIT_RETRY_AFTER_SECONDS = Math.ceil(RATE_LIMIT_WINDOW_MS / 1000);
const localRateLimiter = new BoundedFixedWindowRateLimiter();
const QUOTE_UNAVAILABLE_RETRY_AFTER_SECONDS = 60;
const QUOTE_PRICING_UNAVAILABLE_MESSAGE =
  `We could not verify the latest pricing. Please try again shortly or call or text us at ${PHONE_DISPLAY}.`;
const QUOTE_SAVE_UNAVAILABLE_MESSAGE =
  `We couldn't save your quote right now. Please try again in a minute, or call or text us at ${PHONE_DISPLAY}.`;
const QUOTE_VISITOR_DAY_LIMIT_MESSAGE =
  `That's the most online quotes we can take from one connection in a day. Call or text us at ${PHONE_DISPLAY} and we'll price the rest with you.`;
const QUOTE_SITE_LIMIT_MESSAGE =
  `We can't take online quotes right now. Call or text us at ${PHONE_DISPLAY} and we'll get you a price.`;
// The rate-limit preflights and the quote save both run on the Shed Convex deployment.
const SHED_CONVEX_PROVIDER = 'shed_convex';

const SENTRY_FLUSH_TIMEOUT_MS = 2_000;
// "Quote rate limit check timed out after 5000ms", "Quote pricing read timed out after …".
const QUOTE_TIMEOUT_ERROR_PATTERN = /^Quote .+ timed out after \d+ms$/;
// "NEXT_PUBLIC_CONVEX_URL is not configured", "QUOTE_PRICING_SOURCE must be …".
const QUOTE_CONFIG_ERROR_PATTERN =
  /^[A-Z][A-Z0-9_]+(?: or [A-Z][A-Z0-9_]+)? (?:is not configured|is required|must (?:be|exactly target))\b/;

type QuoteIntakeFailureStage = 'preflight' | 'pricing' | 'insert' | 'unexpected';
type QuoteIntakeFailureReason =
  | 'timeout'
  | 'network'
  | 'config'
  | 'unauthorized'
  | 'server_error'
  | 'other';

/**
 * Buckets a failure by its known message shapes so the alert tells an outage
 * from a misconfiguration. Only the bucket name reaches Sentry.
 */
function quoteIntakeFailureReason(error: unknown): QuoteIntakeFailureReason {
  if (!(error instanceof Error)) return 'other';
  const { message } = error;
  if (message.includes('Unauthorized quote')) return 'unauthorized';
  // ConvexHttpClient's "[Request ID: …] Server Error"; production redacts the rest.
  if (message.includes('Server Error')) return 'server_error';
  if (QUOTE_TIMEOUT_ERROR_PATTERN.test(message)) return 'timeout';
  if (error.name === 'TypeError' && message === 'fetch failed') return 'network';
  if (QUOTE_CONFIG_ERROR_PATTERN.test(message)) return 'config';
  return 'other';
}

function reportQuoteIntakeFailure(
  stage: QuoteIntakeFailureStage,
  error: unknown,
  { provider }: { provider?: string } = {}
) {
  // Convex argument-validation errors can echo call arguments (write or read
  // keys, contact details), so Sentry gets a fixed message and the error class
  // only. The full error stays in the server log written beside each call.
  const reported = new Error(`Quote intake ${stage} failed`);
  reported.name = 'QuoteIntakeFailure';
  Sentry.captureException(reported, {
    level: 'error',
    fingerprint: ['quote_intake', stage],
    tags: {
      area: 'quote_intake',
      stage,
      reason: quoteIntakeFailureReason(error),
      error_type: error instanceof Error ? error.name : typeof error,
      ...(provider ? { provider } : {}),
    },
  });
  // Turbopack builds skip Sentry's route-handler wrapper and these failures
  // never reach onRequestError, so nothing else flushes before Vercel suspends
  // the function. after() runs under waitUntil once the response is sent.
  after(() => Sentry.flush(SENTRY_FLUSH_TIMEOUT_MS));
}

type QuoteIntakeLimit =
  | 'visitor_day'
  | 'site_quota'
  | 'unchecked_address_day'
  | 'unchecked_site_day';

/**
 * A limit that turned a well-formed quote away. One address reaching its day
 * limit, or the site-wide quota filling, means a script is at the form or the
 * limits are too low for real demand; either way customers are being refused
 * and nobody would know. Only the limit's name reaches Sentry.
 */
function reportQuoteIntakeLimit(limit: QuoteIntakeLimit) {
  const reported = new Error(`Quote intake limit reached: ${limit}`);
  reported.name = 'QuoteIntakeLimitReached';
  Sentry.captureException(reported, {
    level: 'warning',
    fingerprint: ['quote_intake', 'limit', limit],
    tags: { area: 'quote_intake', stage: 'limit', limit },
  });
  after(() => Sentry.flush(SENTRY_FLUSH_TIMEOUT_MS));
}

function getQuotePricingProviderTag(): string {
  // Name the selected provider even when its own keys or URL are missing.
  const source = process.env.QUOTE_PRICING_SOURCE?.trim();
  if (source === 'shed_convex' || source === 'frontier_pixel_crm') return source;
  try {
    return getConfiguredQuotePricingProvider().provider;
  } catch {
    return 'misconfigured';
  }
}

function quoteIntakeUnavailable(message: string) {
  return NextResponse.json(
    { error: message },
    {
      status: 503,
      headers: {
        'Retry-After': String(QUOTE_UNAVAILABLE_RETRY_AFTER_SECONDS),
      },
    }
  );
}

function getQuoteTenantSlug(): string {
  return process.env.QUOTE_TENANT_SLUG?.trim() || 'shed210';
}

function parseHostHeader(value: string | null): string | null {
  if (!value) return null;
  const host = value.split(',')[0]?.trim().toLowerCase();
  return host || null;
}

function isSameOriginRequest(request: NextRequest): boolean {
  const fetchSite = request.headers.get('sec-fetch-site')?.trim().toLowerCase();
  if (fetchSite === 'cross-site') return false;

  const host =
    parseHostHeader(request.headers.get('x-forwarded-host')) ??
    parseHostHeader(request.headers.get('host'));
  if (!host) return true;

  const origin = request.headers.get('origin');
  if (!origin) return true;

  try {
    return new URL(origin).host.toLowerCase() === host;
  } catch {
    return false;
  }
}

const MAX_CONSENT_IP_ADDRESS_LENGTH = 64;
const MAX_CONSENT_USER_AGENT_LENGTH = 1_024;

function truncateConsentMetadata(value: string, maximumLength: number) {
  return value.slice(0, maximumLength);
}

function getClientIp(request: NextRequest): string {
  return truncateConsentMetadata(
    getClientNetworkIdentity(request.headers).address,
    MAX_CONSENT_IP_ADDRESS_LENGTH
  );
}

function buildQuotePageUrl(request: NextRequest): string | null {
  const requestUrl = typeof request.url === 'string' ? request.url : null;
  if (!requestUrl) return '/quote';

  try {
    return new URL('/quote', requestUrl).toString();
  } catch {
    return '/quote';
  }
}

function getClientUserAgent(request: NextRequest): string | null {
  const userAgent = request.headers.get('user-agent')?.trim();
  return userAgent
    ? truncateConsentMetadata(userAgent, MAX_CONSENT_USER_AGENT_LENGTH)
    : null;
}

function buildSmsConsentRecord(
  request: NextRequest,
  optedIn: boolean,
  consentText = SMS_CONSENT_TEXT,
  consentTextVersion = SMS_CONSENT_TEXT_VERSION,
  recordedAt = Date.now()
): QuoteSmsConsent {
  return {
    status: optedIn ? 'opted_in' : 'not_opted_in',
    source: 'website_quote_form',
    consentText: optedIn ? consentText : null,
    consentTextVersion: optedIn ? consentTextVersion : null,
    pageUrl: optedIn ? buildQuotePageUrl(request) : null,
    ipAddress: optedIn ? getClientIp(request) : null,
    userAgent: optedIn ? getClientUserAgent(request) : null,
    recordedAt,
  };
}

function checkLocalRateLimit(key: string, now: number): QuoteRateLimitResult {
  if (process.env.NODE_ENV === 'test') return { allowed: true, retryAfterSeconds: 0 };
  return localRateLimiter.check({
    key,
    now,
    windowMs: RATE_LIMIT_WINDOW_MS,
    maximumRequests: RATE_LIMIT_MAX_REQUESTS,
  });
}

async function checkQuoteRateLimit(
  request: NextRequest,
  tenantSlug: string
): Promise<QuoteRateLimitResult> {
  const clientIp = getClientNetworkIdentity(request.headers).rateLimitKey;
  const now = Date.now();

  const localResult = checkLocalRateLimit(clientIp, now);
  if (!localResult.allowed) return localResult;

  return await checkSharedQuoteRateLimit({
    tenantSlug,
    clientIp,
    now,
    windowMs: RATE_LIMIT_WINDOW_MS,
    maxRequests: RATE_LIMIT_MAX_REQUESTS,
  });
}

async function checkQuoteVisitorDayLimit(
  request: NextRequest,
  tenantSlug: string
): Promise<QuoteRateLimitResult> {
  return await checkSharedQuoteRateLimit({
    tenantSlug,
    clientIp: `day:${getClientNetworkIdentity(request.headers).rateLimitKey}`,
    now: Date.now(),
    windowMs: VISITOR_DAY_LIMIT_WINDOW_MS,
    maxRequests: VISITOR_DAY_LIMIT_MAX_REQUESTS,
  });
}

/**
 * Counts one unchecked quote against its address's and the site's day. The
 * address is counted first, so one address at its limit doesn't also use up
 * the site's allowance.
 */
async function checkUncheckedQuoteDayLimits(
  request: NextRequest,
  tenantSlug: string
): Promise<QuoteRateLimitResult & { limit?: QuoteIntakeLimit }> {
  const now = Date.now();
  const address = await checkSharedQuoteRateLimit({
    tenantSlug,
    clientIp: `unchecked-day:${getClientNetworkIdentity(request.headers).rateLimitKey}`,
    now,
    windowMs: VISITOR_DAY_LIMIT_WINDOW_MS,
    maxRequests: UNCHECKED_ADDRESS_DAY_MAX_REQUESTS,
  });
  if (!address.allowed) return { ...address, limit: 'unchecked_address_day' };

  const site = await checkSharedQuoteRateLimit({
    tenantSlug,
    clientIp: 'unchecked-site-day',
    now,
    windowMs: VISITOR_DAY_LIMIT_WINDOW_MS,
    maxRequests: UNCHECKED_SITE_DAY_MAX_REQUESTS,
  });
  return site.allowed ? site : { ...site, limit: 'unchecked_site_day' };
}

async function checkQuoteSessionRateLimit(args: {
  tenantSlug: string;
  sessionId?: string;
}): Promise<QuoteRateLimitResult> {
  if (!args.sessionId) return { allowed: true, retryAfterSeconds: 0 };

  return await checkSharedQuoteRateLimit({
    tenantSlug: args.tenantSlug,
    clientIp: `session:${args.sessionId}`,
    now: Date.now(),
    windowMs: SESSION_RATE_LIMIT_WINDOW_MS,
    maxRequests: SESSION_RATE_LIMIT_MAX_REQUESTS,
  });
}

function tooManyQuoteRequests(
  retryAfterSeconds: number,
  message = 'Too many requests. Please try again shortly.'
) {
  return NextResponse.json(
    { error: message },
    {
      status: 429,
      headers: {
        'Retry-After': String(
          retryAfterSeconds || RATE_LIMIT_RETRY_AFTER_SECONDS
        ),
      },
    }
  );
}

/** The save's quota refusal: how long it lasts, and whether it is everyone's. */
function quoteQuotaBlock(
  error: unknown
): { retryAfterSeconds: number; siteWide: boolean } | null {
  if (!error || typeof error !== 'object' || !('data' in error)) return null;
  const data = error.data;
  if (!data || typeof data !== 'object') return null;
  if (!('code' in data) || data.code !== 'QUOTE_RATE_LIMITED') return null;
  if (!('retryAfterSeconds' in data)) return null;

  const retryAfterSeconds = data.retryAfterSeconds;
  if (
    typeof retryAfterSeconds !== 'number' ||
    !Number.isFinite(retryAfterSeconds) ||
    retryAfterSeconds <= 0
  ) {
    return null;
  }

  return {
    retryAfterSeconds: Math.min(86_400, Math.ceil(retryAfterSeconds)),
    siteWide: 'siteWide' in data && data.siteWide === true,
  };
}

export async function POST(request: NextRequest) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
    }

    if (!isJsonRequestContentType(request.headers.get('content-type'))) {
      return NextResponse.json(
        { error: 'Unsupported content type' },
        { status: 415 }
      );
    }

    const tenantSlug = getQuoteTenantSlug();
    let rateLimit: QuoteRateLimitResult;
    try {
      rateLimit = await checkQuoteRateLimit(request, tenantSlug);
    } catch (error) {
      // Fail closed: the save needs the same deployment, so letting the
      // request through would only lose the lead one step later.
      console.error('quote rate limit preflight failed', error);
      reportQuoteIntakeFailure('preflight', error, { provider: SHED_CONVEX_PROVIDER });
      return quoteIntakeUnavailable(QUOTE_SAVE_UNAVAILABLE_MESSAGE);
    }
    if (!rateLimit.allowed) {
      return tooManyQuoteRequests(rateLimit.retryAfterSeconds);
    }

    let raw: Record<string, unknown> | null;
    try {
      raw = await readJsonRequestBody(request, MAX_BODY_SIZE_BYTES);
    } catch (error) {
      if (error instanceof QuoteRequestBodyTooLargeError) {
        return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
      }
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (raw === null) {
      return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 });
    }

    const parsed = validateQuoteRequest(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    if (parsed.data.website) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const quoteParams = mapParsedQuoteToParams(parsed.data);
    const visualPlacement = buildQuoteVisualPlacement(
      quoteParams,
      parsed.data.visualPlacement ?? undefined
    );

    if (!parsed.data.phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    let phoneE164: string | null = null;
    try {
      phoneE164 = normalizeQuotePhone(parsed.data.phone);
    } catch {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }
    if (!phoneE164) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }

    let identityRateLimit: QuoteRateLimitResult;
    try {
      identityRateLimit = await checkQuoteSessionRateLimit({
        tenantSlug,
        sessionId: parsed.data.session_id,
      });
    } catch (error) {
      console.error('quote session rate limit preflight failed', error);
      reportQuoteIntakeFailure('preflight', error, { provider: SHED_CONVEX_PROVIDER });
      return quoteIntakeUnavailable(QUOTE_SAVE_UNAVAILABLE_MESSAGE);
    }
    if (!identityRateLimit.allowed) {
      return tooManyQuoteRequests(identityRateLimit.retryAfterSeconds);
    }

    // Counted here, after validation, so only quotes that would be saved use
    // up an address's day.
    let visitorDayLimit: QuoteRateLimitResult;
    try {
      visitorDayLimit = await checkQuoteVisitorDayLimit(request, tenantSlug);
    } catch (error) {
      console.error('quote visitor day limit preflight failed', error);
      reportQuoteIntakeFailure('preflight', error, { provider: SHED_CONVEX_PROVIDER });
      return quoteIntakeUnavailable(QUOTE_SAVE_UNAVAILABLE_MESSAGE);
    }
    if (!visitorDayLimit.allowed) {
      reportQuoteIntakeLimit('visitor_day');
      return tooManyQuoteRequests(
        visitorDayLimit.retryAfterSeconds,
        QUOTE_VISITOR_DAY_LIMIT_MESSAGE
      );
    }

    const botCheck = await verifyTurnstileToken({
      token: parsed.data.turnstileToken,
      action: QUOTE_TURNSTILE_ACTION,
      remoteIp: getClientNetworkIdentity(request.headers).address,
    });
    if (botCheck === 'failed' || botCheck === 'unavailable') {
      let uncheckedLimit: Awaited<ReturnType<typeof checkUncheckedQuoteDayLimits>>;
      try {
        uncheckedLimit = await checkUncheckedQuoteDayLimits(request, tenantSlug);
      } catch (error) {
        console.error('quote unchecked day limit preflight failed', error);
        reportQuoteIntakeFailure('preflight', error, { provider: SHED_CONVEX_PROVIDER });
        return quoteIntakeUnavailable(QUOTE_SAVE_UNAVAILABLE_MESSAGE);
      }
      if (!uncheckedLimit.allowed) {
        reportQuoteIntakeLimit(uncheckedLimit.limit ?? 'unchecked_site_day');
        return tooManyQuoteRequests(
          uncheckedLimit.retryAfterSeconds,
          uncheckedLimit.limit === 'unchecked_address_day'
            ? QUOTE_VISITOR_DAY_LIMIT_MESSAGE
            : QUOTE_SITE_LIMIT_MESSAGE
        );
      }
    }

    let pricingSettings: Awaited<
      ReturnType<typeof readActiveQuotePricingSettingsForServer>
    >;
    try {
      pricingSettings = await readActiveQuotePricingSettingsForServer(tenantSlug);
    } catch (error) {
      console.error('quote pricing settings read failed', error);
      reportQuoteIntakeFailure('pricing', error, {
        provider: getQuotePricingProviderTag(),
      });
      return quoteIntakeUnavailable(QUOTE_PRICING_UNAVAILABLE_MESSAGE);
    }

    const { total, breakdown } = calculateQuote(quoteParams, pricingSettings.config);

    const usesUnifiedSmsConsent =
      parsed.data.smsUnifiedConsentOptIn !== undefined;
    const smsConsentOptIn = usesUnifiedSmsConsent
      ? parsed.data.smsUnifiedConsentOptIn === true
      : parsed.data.smsConsentOptIn;
    const smsMarketingConsentOptIn = usesUnifiedSmsConsent
      ? parsed.data.smsUnifiedConsentOptIn === true
      : parsed.data.smsMarketingConsentOptIn;
    const contactConsentText = usesUnifiedSmsConsent
      ? SMS_UNIFIED_CONSENT_TEXT
      : parsed.data.smsConsentTextVersion
        ? SMS_QUOTE_CONSENT_TEXT_BY_VERSION[parsed.data.smsConsentTextVersion]
        : SMS_CONSENT_TEXT;
    const contactConsentTextVersion = usesUnifiedSmsConsent
      ? SMS_UNIFIED_CONSENT_TEXT_VERSION
      : parsed.data.smsConsentTextVersion ?? SMS_CONSENT_TEXT_VERSION;
    const marketingConsentText = usesUnifiedSmsConsent
      ? SMS_UNIFIED_CONSENT_TEXT
      : SMS_MARKETING_CONSENT_TEXT;
    const marketingConsentTextVersion = usesUnifiedSmsConsent
      ? SMS_UNIFIED_CONSENT_TEXT_VERSION
      : SMS_MARKETING_CONSENT_TEXT_VERSION;
    const smsConsentRecordedAt = Date.now();

    let savedQuote: Awaited<ReturnType<typeof saveQuote>>;
    try {
      savedQuote = await saveQuote({
        ...quoteParams,
        name: parsed.data.name,
        email: parsed.data.email,
        phone: phoneE164 ?? undefined,
        smsConsent: buildSmsConsentRecord(
          request,
          smsConsentOptIn,
          contactConsentText,
          contactConsentTextVersion,
          smsConsentRecordedAt
        ),
        smsMarketingConsent: buildSmsConsentRecord(
          request,
          smsMarketingConsentOptIn,
          marketingConsentText,
          marketingConsentTextVersion,
          smsConsentRecordedAt
        ),
        visualPlacement,
        sessionId: parsed.data.session_id,
        measurement: request.headers.get('dnt') === '1' || request.headers.get('sec-gpc') === '1'
          ? undefined : parsed.data.measurement,
        total,
        breakdown,
        deliveryPricingStatus: 'pending_verification',
        pricingConfig: buildQuotePricingConfigMetadata(pricingSettings),
        tenantSlug,
      });
    } catch (error) {
      const quotaBlock = quoteQuotaBlock(error);
      if (quotaBlock?.siteWide) {
        reportQuoteIntakeLimit('site_quota');
        return tooManyQuoteRequests(
          quotaBlock.retryAfterSeconds,
          QUOTE_SITE_LIMIT_MESSAGE
        );
      }
      if (quotaBlock) {
        return tooManyQuoteRequests(quotaBlock.retryAfterSeconds);
      }
      console.error('quote insert failed', error);
      reportQuoteIntakeFailure('insert', error, { provider: SHED_CONVEX_PROVIDER });
      return quoteIntakeUnavailable(QUOTE_SAVE_UNAVAILABLE_MESSAGE);
    }

    return NextResponse.json(
      buildQuoteResponse({
        id: savedQuote.id,
        discussionToken: savedQuote.discussionToken,
        total,
        breakdown,
      }),
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    console.error('quote route error', error);
    reportQuoteIntakeFailure('unexpected', error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'production' ? 'Server error' : message },
      { status: 500 }
    );
  }
}
