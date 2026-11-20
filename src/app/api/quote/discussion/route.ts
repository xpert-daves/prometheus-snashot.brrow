import { NextRequest, NextResponse } from 'next/server';
import { ConvexError } from 'convex/values';
import { quoteDiscussionsEnabled, saveQuoteDiscussion } from '@/lib/quoteDiscussion.server';
import { checkSharedQuoteRateLimit } from '@/lib/quoteRateLimit';
import { BoundedFixedWindowRateLimiter, getClientNetworkIdentity } from '@/lib/publicRequestSecurity';
import { readJsonRequestBody, QuoteRequestBodyTooLargeError } from '@/lib/quoteRoute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const limiter = new BoundedFixedWindowRateLimiter();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function reply(body: Record<string, unknown>, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

export async function POST(request: NextRequest) {
  const tenantSlug = process.env.QUOTE_TENANT_SLUG?.trim() || 'shed210';
  if (!quoteDiscussionsEnabled() || tenantSlug !== 'shed210') {
    return reply({ error: 'Discussion requests are temporarily unavailable. Please call or text us.' }, 503);
  }
  const origin = request.headers.get('origin');
  try {
    if (request.headers.get('sec-fetch-site') === 'cross-site' ||
        (origin && new URL(origin).origin !== new URL(request.url).origin)) {
      return reply({ error: 'This request is not allowed.' }, 403);
    }
  } catch { return reply({ error: 'This request is not allowed.' }, 403); }

  try {
    const key = `quote-discussion:${getClientNetworkIdentity(request.headers).rateLimitKey}`;
    const now = Date.now();
    const local = limiter.check({ key, now, windowMs: 60_000, maximumRequests: 10 });
    const limit = local.allowed
      ? await checkSharedQuoteRateLimit({ tenantSlug, clientIp: key, now, windowMs: 60_000, maxRequests: 10 })
      : local;
    if (!limit.allowed) return reply({ error: 'Please wait a moment and try again.' }, 429, { 'Retry-After': String(limit.retryAfterSeconds) });
    const body = await readJsonRequestBody(request, 2_048);
    if (!body || Object.keys(body).some(key => key !== 'quoteId' && key !== 'actionToken') ||
        typeof body.quoteId !== 'string' || !uuid.test(body.quoteId) ||
        typeof body.actionToken !== 'string' || !/^[a-f0-9]{64}$/.test(body.actionToken)) {
      return reply({ error: 'Please use the discussion button on your saved estimate.' }, 400);
    }
    const result = await saveQuoteDiscussion({ tenantSlug, quoteId: body.quoteId, actionToken: body.actionToken });
    return reply(result);
  } catch (error) {
    if (error instanceof QuoteRequestBodyTooLargeError) return reply({ error: 'Request is too large.' }, 413);
    if (error instanceof SyntaxError) return reply({ error: 'Invalid request.' }, 400);
    if (error instanceof ConvexError && error.data === 'DISCUSSION_EXPIRED') {
      return reply({ error: 'This estimate session has expired. Please calculate a fresh estimate or call us.' }, 410);
    }
    if (error instanceof ConvexError && error.data === 'DISCUSSION_UNAUTHORIZED') {
      return reply({ error: 'Please use the discussion button on your saved estimate.' }, 403);
    }
    // Do not log request bodies, capabilities, or storage error payloads.
    return reply({ error: 'We could not save your request. Please try again or call us.' }, 503);
  }
}
