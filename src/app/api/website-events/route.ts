import { NextRequest, NextResponse } from 'next/server';
import { normalizeWebsiteEvent } from '@/lib/websiteMeasurement';
import {
  isJsonRequestContentType,
  QuoteRequestBodyTooLargeError,
  readJsonRequestBody,
} from '@/lib/quoteRoute';
import { BoundedFixedWindowRateLimiter, getClientNetworkIdentity } from '@/lib/publicRequestSecurity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const limiter = new BoundedFixedWindowRateLimiter();
const DEFAULT_ENDPOINT = 'https://youthful-horse-290.convex.site/api/intake/marketing-event';

function endpoint() {
  const value = process.env.FRONTIER_PIXEL_CRM_WEBSITE_EVENTS_URL?.trim() || DEFAULT_ENDPOINT;
  // Deployment settings may select an isolated Convex preview, never an arbitrary host.
  if (!/^https:\/\/[a-z0-9-]+\.convex\.site\/api\/intake\/marketing-event$/.test(value)) return null;
  return value;
}

function environment() {
  return process.env.VERCEL_ENV === 'production' ? 'production'
    : process.env.VERCEL_ENV === 'preview' ? 'preview' : 'development';
}

export async function POST(request: NextRequest) {
  const reply = (body: object, status: number, headers?: Record<string, string>) =>
    NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site' || !origin || origin !== new URL(request.url).origin) {
    return reply({ error: 'Same-origin request required' }, 403);
  }
  if (request.headers.get('dnt') === '1' || request.headers.get('sec-gpc') === '1') {
    return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!isJsonRequestContentType(request.headers.get('content-type'))) {
    return reply({ error: 'JSON required' }, 415);
  }
  const limit = limiter.check({ key: getClientNetworkIdentity(request.headers).rateLimitKey, now: Date.now(), windowMs: 60_000, maximumRequests: 120 });
  if (!limit.allowed) return reply({ error: 'Try again later' }, 429, { 'Retry-After': String(limit.retryAfterSeconds) });

  let body: Record<string, unknown> | null;
  try { body = await readJsonRequestBody(request, 8_192); }
  catch (error) { return reply({ error: error instanceof QuoteRequestBodyTooLargeError ? 'Body too large' : 'Invalid JSON' }, error instanceof QuoteRequestBodyTooLargeError ? 413 : 400); }
  if (!Array.isArray(body?.events) || !body.events.length || body.events.length > 10) {
    return reply({ error: 'Choose 1 to 10 events' }, 400);
  }
  const events = body.events.map(normalizeWebsiteEvent);
  if (events.some(event => !event)) return reply({ error: 'Invalid website event' }, 400);
  const key = process.env.FRONTIER_PIXEL_CRM_WEBSITE_EVENTS_KEY?.trim();
  const url = endpoint();
  if (!key || !url) return reply({ error: 'Measurement unavailable' }, 503);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ tenantSlug: 'shed210', siteOrigin: 'https://www.shed210.com', environment: environment(), events }),
      cache: 'no-store', signal: AbortSignal.timeout(5_000), redirect: 'error',
    });
    if (!response.ok) return reply({ error: 'Measurement unavailable' }, 503);
    const result = await response.json();
    if (result.ok !== true || !Number.isInteger(result.recorded) || !Number.isInteger(result.deduped) || result.recorded < 0 || result.deduped < 0 || result.recorded + result.deduped !== events.length) {
      return reply({ error: 'Measurement unavailable' }, 503);
    }
    return reply({ ok: true, recorded: result.recorded, deduped: result.deduped }, 200);
  } catch {
    return reply({ error: 'Measurement unavailable' }, 503);
  }
}
