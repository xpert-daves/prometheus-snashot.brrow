import 'server-only';

import { createHmac } from 'node:crypto';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';

export type QuoteRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

type CheckSharedQuoteRateLimitArgs = {
  tenantSlug: string;
  clientIp: string;
  now: number;
  windowMs: number;
  maxRequests: number;
};

/**
 * ConvexHttpClient has no timeout of its own. Aborting a rate-limit check only
 * spends one limiter slot, so it is safe to bound; quote creates are not.
 */
export const QUOTE_RATE_LIMIT_TIMEOUT_MS = 5_000;

function getConvexQuoteWriteKey(): string {
  const key = process.env.CONVEX_QUOTE_WRITE_KEY?.trim();
  if (!key) {
    throw new Error('CONVEX_QUOTE_WRITE_KEY is not configured');
  }
  return key;
}

function getConvexUrl(): string {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!url) {
    throw new Error('NEXT_PUBLIC_CONVEX_URL is not configured');
  }
  return url;
}

export function hashQuoteRateLimitKey(args: {
  tenantSlug: string;
  clientIp: string;
  writeKey: string;
}) {
  return createHmac('sha256', args.writeKey)
    .update(args.tenantSlug)
    .update('\0')
    .update(args.clientIp)
    .digest('hex');
}

export function createQuoteRateLimitFetch(
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
  timeoutMs = QUOTE_RATE_LIMIT_TIMEOUT_MS
): typeof globalThis.fetch {
  return async (input, init) => {
    const controller = new AbortController();
    const upstreamSignal = init?.signal;
    const abortFromUpstream = () => controller.abort(upstreamSignal?.reason);
    if (upstreamSignal?.aborted) {
      abortFromUpstream();
    } else {
      upstreamSignal?.addEventListener('abort', abortFromUpstream, {
        once: true,
      });
    }

    const timeout = setTimeout(() => {
      controller.abort(
        new Error(`Quote rate limit check timed out after ${timeoutMs}ms`)
      );
    }, timeoutMs);

    try {
      return await fetchImpl(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
      upstreamSignal?.removeEventListener('abort', abortFromUpstream);
    }
  };
}

export async function checkSharedQuoteRateLimit({
  tenantSlug,
  clientIp,
  now,
  windowMs,
  maxRequests,
}: CheckSharedQuoteRateLimitArgs): Promise<QuoteRateLimitResult> {
  const writeKey = getConvexQuoteWriteKey();
  const convex = new ConvexHttpClient(getConvexUrl(), {
    fetch: createQuoteRateLimitFetch(),
  });
  return await convex.mutation(api.quoteRequests.checkQuoteRateLimit, {
    writeKey,
    tenantSlug,
    keyHash: hashQuoteRateLimitKey({ tenantSlug, clientIp, writeKey }),
    now,
    windowMs,
    maxRequests,
  });
}
