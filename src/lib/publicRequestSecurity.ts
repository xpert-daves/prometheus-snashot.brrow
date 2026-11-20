import 'server-only';

import { isIP } from 'node:net';

type HeaderReader = Pick<Headers, 'get'>;

export type ClientNetworkIdentity = {
  address: string;
  rateLimitKey: string;
};

export type FixedWindowRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

type FixedWindowBucket = {
  count: number;
  resetAt: number;
};

function firstForwardedValue(value: string | null) {
  return value?.split(',')[0]?.trim() || null;
}

function ipv4WordsToIpv6Words(value: string): number[] | null {
  const parts = value.split('.');
  if (parts.length !== 4) return null;

  const octets = parts.map(Number);
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return null;
  }

  return [(octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]];
}

function expandIpv6(value: string): number[] | null {
  if (value.includes('%')) return null;

  let normalized = value.toLowerCase();
  const lastColon = normalized.lastIndexOf(':');
  const ipv4Tail = normalized.slice(lastColon + 1);
  if (ipv4Tail.includes('.')) {
    const ipv4Words = ipv4WordsToIpv6Words(ipv4Tail);
    if (!ipv4Words) return null;
    normalized = `${normalized.slice(0, lastColon)}:${ipv4Words
      .map((word) => word.toString(16))
      .join(':')}`;
  }

  const halves = normalized.split('::');
  if (halves.length > 2) return null;

  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const omittedWordCount = 8 - left.length - right.length;
  if (
    omittedWordCount < 0 ||
    (halves.length === 1 && omittedWordCount !== 0) ||
    (halves.length === 2 && omittedWordCount < 1)
  ) {
    return null;
  }

  const words = [
    ...left,
    ...Array.from({ length: omittedWordCount }, () => '0'),
    ...right,
  ].map((word) => Number.parseInt(word, 16));

  return words.length === 8 && words.every((word) => Number.isInteger(word))
    ? words
    : null;
}

function normalizeIp(value: string): ClientNetworkIdentity | null {
  const version = isIP(value);
  if (version === 4) {
    const address = value.split('.').map(Number).join('.');
    return { address, rateLimitKey: address };
  }

  if (version !== 6) return null;

  const words = expandIpv6(value);
  if (!words) return null;
  const address = words.map((word) => word.toString(16).padStart(4, '0')).join(':');
  const subnet = words
    .slice(0, 4)
    .map((word) => word.toString(16).padStart(4, '0'))
    .join(':');

  return {
    address,
    rateLimitKey: `${subnet}::/64`,
  };
}

/**
 * Vercel documents `x-vercel-forwarded-for` as the platform-owned client IP
 * header. In production/Vercel mode, fail closed when it is absent rather than
 * trusting a client-supplied forwarding chain. Local development and tests may
 * fall back to ordinary forwarded headers.
 */
export function getClientNetworkIdentity(headers: HeaderReader): ClientNetworkIdentity {
  const vercelAddress = firstForwardedValue(
    headers.get('x-vercel-forwarded-for')
  );
  const fallbackAddress = firstForwardedValue(
    headers.get('x-forwarded-for') ?? headers.get('x-real-ip')
  );
  const requiresVercelOwnedHeader =
    process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  const rawAddress =
    vercelAddress ?? (requiresVercelOwnedHeader ? null : fallbackAddress);

  return (rawAddress && normalizeIp(rawAddress)) || {
    address: 'unknown',
    rateLimitKey: 'unknown',
  };
}

/** A fixed-window limiter with bounded memory and bounded per-request cleanup. */
export class BoundedFixedWindowRateLimiter {
  private readonly buckets = new Map<string, FixedWindowBucket>();

  constructor(
    private readonly maximumKeys = 2_048,
    private readonly cleanupBudget = 32
  ) {
    if (maximumKeys < 1 || cleanupBudget < 1) {
      throw new Error('Rate limiter bounds must be positive');
    }
  }

  check(args: {
    key: string;
    now: number;
    windowMs: number;
    maximumRequests: number;
  }): FixedWindowRateLimitResult {
    const { key, now, windowMs, maximumRequests } = args;
    const current = this.buckets.get(key);

    if (current && current.resetAt > now) {
      if (current.count >= maximumRequests) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)),
        };
      }

      current.count += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (current) this.buckets.delete(key);
    this.pruneExpired(now);
    this.evictOldestUntilBelowLimit();
    this.buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  get size() {
    return this.buckets.size;
  }

  clear() {
    this.buckets.clear();
  }

  private pruneExpired(now: number) {
    let inspected = 0;
    for (const [key, bucket] of this.buckets) {
      if (inspected >= this.cleanupBudget) break;
      if (bucket.resetAt <= now) this.buckets.delete(key);
      inspected += 1;
    }
  }

  private evictOldestUntilBelowLimit() {
    while (this.buckets.size >= this.maximumKeys) {
      const oldestKey = this.buckets.keys().next().value as string | undefined;
      if (oldestKey === undefined) break;
      this.buckets.delete(oldestKey);
    }
  }
}
