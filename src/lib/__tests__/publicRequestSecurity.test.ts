import {
  BoundedFixedWindowRateLimiter,
  getClientNetworkIdentity,
} from '@/lib/publicRequestSecurity';

function headers(values: Record<string, string>) {
  return {
    get(name: string) {
      return values[name.toLowerCase()] ?? null;
    },
  } as Pick<Headers, 'get'>;
}

describe('public request security', () => {
  const originalVercel = process.env.VERCEL;

  afterEach(() => {
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
  });

  it('prefers Vercel-owned client IP metadata', () => {
    process.env.VERCEL = '1';

    expect(
      getClientNetworkIdentity(
        headers({
          'x-vercel-forwarded-for': '203.0.113.7',
          'x-forwarded-for': '198.51.100.4',
        })
      )
    ).toEqual({ address: '203.0.113.7', rateLimitKey: '203.0.113.7' });
  });

  it('does not trust a bare forwarded header in Vercel mode', () => {
    process.env.VERCEL = '1';

    expect(
      getClientNetworkIdentity(
        headers({ 'x-forwarded-for': '198.51.100.4' })
      )
    ).toEqual({ address: 'unknown', rateLimitKey: 'unknown' });
  });

  it('normalizes IPv6 clients to a canonical /64 rate-limit identity', () => {
    delete process.env.VERCEL;

    const first = getClientNetworkIdentity(
      headers({ 'x-forwarded-for': '2001:db8:abcd:12::1' })
    );
    const second = getClientNetworkIdentity(
      headers({ 'x-forwarded-for': '2001:0db8:abcd:0012:ffff::9' })
    );
    const otherSubnet = getClientNetworkIdentity(
      headers({ 'x-forwarded-for': '2001:db8:abcd:13::1' })
    );

    expect(first.rateLimitKey).toBe('2001:0db8:abcd:0012::/64');
    expect(second.rateLimitKey).toBe(first.rateLimitKey);
    expect(otherSubnet.rateLimitKey).not.toBe(first.rateLimitKey);
  });

  it('uses a fail-safe shared identity for malformed IP metadata', () => {
    delete process.env.VERCEL;
    expect(
      getClientNetworkIdentity(headers({ 'x-forwarded-for': 'not-an-ip' }))
    ).toEqual({ address: 'unknown', rateLimitKey: 'unknown' });
  });

  it('enforces fixed windows and returns a bounded retry time', () => {
    const limiter = new BoundedFixedWindowRateLimiter(4, 2);

    expect(
      limiter.check({ key: 'a', now: 1_000, windowMs: 10_000, maximumRequests: 2 })
    ).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(
      limiter.check({ key: 'a', now: 2_000, windowMs: 10_000, maximumRequests: 2 })
    ).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(
      limiter.check({ key: 'a', now: 2_001, windowMs: 10_000, maximumRequests: 2 })
    ).toEqual({ allowed: false, retryAfterSeconds: 9 });
    expect(
      limiter.check({ key: 'a', now: 11_000, windowMs: 10_000, maximumRequests: 2 })
    ).toEqual({ allowed: true, retryAfterSeconds: 0 });
  });

  it('keeps memory bounded under unique-key floods', () => {
    const limiter = new BoundedFixedWindowRateLimiter(3, 1);

    for (let index = 0; index < 20; index += 1) {
      limiter.check({
        key: `client-${index}`,
        now: index,
        windowMs: 60_000,
        maximumRequests: 1,
      });
    }

    expect(limiter.size).toBe(3);
  });
});
