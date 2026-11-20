import {
  getGoogleReviews,
  getGoogleReviewsRetryAfterSeconds,
} from '@/lib/googleReviews.server'
import { checkGoogleReviewsRouteRateLimit } from '@/lib/googleReviewsRouteSecurity'

export const dynamic = 'force-dynamic'

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
} as const

export async function GET(request?: Request) {
  const rateLimit = checkGoogleReviewsRouteRateLimit(request, 'full')
  if (!rateLimit.allowed) {
    return new Response(null, {
      status: 429,
      headers: {
        ...NO_STORE_HEADERS,
        'Retry-After': String(rateLimit.retryAfterSeconds),
      },
    })
  }

  const googleReviews = await getGoogleReviews()

  if (!googleReviews) {
    return new Response(null, {
      status: 503,
      headers: {
        ...NO_STORE_HEADERS,
        'Retry-After': String(getGoogleReviewsRetryAfterSeconds() || 5),
      },
    })
  }

  return Response.json(googleReviews, {
    headers: NO_STORE_HEADERS,
  })
}
