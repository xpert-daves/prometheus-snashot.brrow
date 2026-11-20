import { NextRequest, NextResponse } from 'next/server';
import { forwardReviewFeedback } from '@/lib/reviewFeedback.server';
import {
  REVIEW_COMMENT_MAX_LENGTH,
  REVIEW_LINK_CODE_PATTERN,
  REVIEW_LINK_DEVICES,
  type ReviewFeedbackEvent,
  type ReviewLinkDevice,
} from '@/lib/reviewPage';
import { checkSharedQuoteRateLimit } from '@/lib/quoteRateLimit';
import { BoundedFixedWindowRateLimiter, getClientNetworkIdentity } from '@/lib/publicRequestSecurity';
import { readJsonRequestBody, QuoteRequestBodyTooLargeError } from '@/lib/quoteRoute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const limiter = new BoundedFixedWindowRateLimiter();
const EVENTS = new Set(['opened', 'rated', 'commented', 'google_opened']);
const FIELDS = new Set(['code', 'event', 'rating', 'comment', 'device']);

function reply(body: Record<string, unknown>, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

export async function POST(request: NextRequest) {
  const tenantSlug = process.env.QUOTE_TENANT_SLUG?.trim() || 'shed210';
  if (tenantSlug !== 'shed210') return reply({ error: 'Reviews are unavailable right now.' }, 503);
  const origin = request.headers.get('origin');
  try {
    if (request.headers.get('sec-fetch-site') === 'cross-site' ||
        (origin && new URL(origin).origin !== new URL(request.url).origin)) {
      return reply({ error: 'This request is not allowed.' }, 403);
    }
  } catch { return reply({ error: 'This request is not allowed.' }, 403); }

  try {
    const key = `review-feedback:${getClientNetworkIdentity(request.headers).rateLimitKey}`;
    const now = Date.now();
    const local = limiter.check({ key, now, windowMs: 60_000, maximumRequests: 20 });
    const limit = local.allowed
      ? await checkSharedQuoteRateLimit({ tenantSlug, clientIp: key, now, windowMs: 60_000, maxRequests: 20 })
      : local;
    if (!limit.allowed) return reply({ error: 'Please wait a moment and try again.' }, 429, { 'Retry-After': String(limit.retryAfterSeconds) });
    const body = await readJsonRequestBody(request, 4_096);
    const comment = typeof body?.comment === 'string' ? body.comment.trim() : null;
    const isOpen = body?.event === 'opened';
    // An open has no stars or comment yet; only an open says which device.
    const ratingValid = isOpen
      ? body?.rating === undefined || body?.rating === null
      : typeof body?.rating === 'number' && Number.isInteger(body.rating) && body.rating >= 1 && body.rating <= 5;
    const deviceValid = body?.device === undefined ||
      (isOpen && REVIEW_LINK_DEVICES.includes(body.device as ReviewLinkDevice));
    if (!body || Object.keys(body).some(field => !FIELDS.has(field)) ||
        typeof body.code !== 'string' || !REVIEW_LINK_CODE_PATTERN.test(body.code) ||
        typeof body.event !== 'string' || !EVENTS.has(body.event) ||
        !ratingValid || !deviceValid ||
        (body.comment !== undefined && body.comment !== null && typeof body.comment !== 'string') ||
        (isOpen && comment) ||
        (comment !== null && comment.length > REVIEW_COMMENT_MAX_LENGTH) ||
        (body.event === 'commented' && !comment)) {
      return reply({ error: 'Please check your review and try again.' }, 400);
    }
    const result = await forwardReviewFeedback({
      linkCode: body.code,
      event: body.event as ReviewFeedbackEvent,
      rating: isOpen ? null : (body.rating as number),
      comment: body.event === 'commented' ? comment : null,
      ...(isOpen && body.device ? { device: body.device as ReviewLinkDevice } : {}),
    });
    if (result === 'recorded') return reply({ ok: true });
    if (result === 'not_found') return reply({ error: 'This review link is no longer active.' }, 404);
    return reply({ error: 'We could not save that. Please try again or call us.' }, 503);
  } catch (error) {
    if (error instanceof QuoteRequestBodyTooLargeError) return reply({ error: 'Request is too large.' }, 413);
    if (error instanceof SyntaxError) return reply({ error: 'Invalid request.' }, 400);
    // Do not log comments or review codes.
    return reply({ error: 'We could not save that. Please try again or call us.' }, 503);
  }
}
