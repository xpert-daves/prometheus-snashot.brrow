import 'server-only';

import {
  BoundedFixedWindowRateLimiter,
  getClientNetworkIdentity,
  type FixedWindowRateLimitResult,
} from '@/lib/publicRequestSecurity';

const GOOGLE_REVIEWS_RATE_LIMIT_WINDOW_MS = 60_000;
const GOOGLE_REVIEWS_RATE_LIMITS = {
  full: 12,
  summary: 30,
} as const;

const limiter = new BoundedFixedWindowRateLimiter(2_048, 32);

export function checkGoogleReviewsRouteRateLimit(
  request: Request | undefined,
  scope: keyof typeof GOOGLE_REVIEWS_RATE_LIMITS
): FixedWindowRateLimitResult {
  if (process.env.NODE_ENV === 'test') {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const identity = request
    ? getClientNetworkIdentity(request.headers).rateLimitKey
    : 'unknown';

  return limiter.check({
    key: `${scope}:${identity}`,
    now: Date.now(),
    windowMs: GOOGLE_REVIEWS_RATE_LIMIT_WINDOW_MS,
    maximumRequests: GOOGLE_REVIEWS_RATE_LIMITS[scope],
  });
}

export function resetGoogleReviewsRouteRateLimitForTests() {
  limiter.clear();
}
