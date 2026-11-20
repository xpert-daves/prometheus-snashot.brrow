import {
  QUOTE_RATE_LIMIT_TIMEOUT_MS,
  createQuoteRateLimitFetch,
} from '../quoteRateLimit';

function stalledFetchMock() {
  return jest.fn(
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(init.signal?.reason),
          { once: true }
        );
      })
  );
}

describe('quote rate-limit fetch', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('aborts a stalled rate-limit check after the configured timeout', async () => {
    jest.useFakeTimers();
    const stalledFetch = stalledFetchMock();
    const timedFetch = createQuoteRateLimitFetch(stalledFetch, 25);
    const request = timedFetch('https://example.test/api/mutation', { method: 'POST' });
    const rejection = expect(request).rejects.toThrow(
      'Quote rate limit check timed out after 25ms'
    );

    await jest.advanceTimersByTimeAsync(25);
    await rejection;
    expect(stalledFetch).toHaveBeenCalledWith(
      'https://example.test/api/mutation',
      expect.objectContaining({
        method: 'POST',
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('waits the default timeout before aborting', async () => {
    jest.useFakeTimers();
    const stalledFetch = stalledFetchMock();
    const request = createQuoteRateLimitFetch(stalledFetch)('https://example.test');
    let settled = false;
    request.catch(() => undefined).finally(() => {
      settled = true;
    });

    await jest.advanceTimersByTimeAsync(QUOTE_RATE_LIMIT_TIMEOUT_MS - 1);
    expect(settled).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await expect(request).rejects.toThrow(
      `Quote rate limit check timed out after ${QUOTE_RATE_LIMIT_TIMEOUT_MS}ms`
    );
  });

  it('passes a caller abort through and clears the timer on success', async () => {
    jest.useFakeTimers();
    const okFetch = jest.fn(async () => ({ ok: true }) as Response);
    const response = await createQuoteRateLimitFetch(okFetch, 25)('https://example.test');
    expect(response.ok).toBe(true);
    expect(jest.getTimerCount()).toBe(0);

    const controller = new AbortController();
    const stalledFetch = stalledFetchMock();
    const request = createQuoteRateLimitFetch(stalledFetch, 25)('https://example.test', {
      signal: controller.signal,
    });
    controller.abort(new Error('caller gave up'));
    await expect(request).rejects.toThrow('caller gave up');
  });
});
