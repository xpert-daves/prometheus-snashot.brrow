import { act, renderHook, waitFor } from '@testing-library/react';
import { useQuoteSubmission } from '../useQuoteSubmission';
import { initialQuoteFormParams } from '../quoteForm';
import { QUOTE_SUBMISSION_FALLBACK_ERROR } from '../quoteSubmission';

const mockBreakdown = {
  base: 100,
  wallHeight: 0,
  roof: 0,
  siding: 0,
  door: 0,
  windows: 0,
  addOns: 0,
  delivery: 0,
  discount: 0,
  interiorUpgrades: [],
};
const mockEstimate = {
  kind: 'build_subtotal' as const,
  delivery: {
    status: 'pending_verification' as const,
    includedInTotal: false as const,
  },
};

function buildOptions() {
  return {
    params: {
      ...initialQuoteFormParams,
      structureType: 'storage_shed' as const,
      name: 'Test User',
      email: 'info@shed210.com',
      phone: '(210) 555-0000',
      smsConsentOptIn: true,
    },
    deliveryZip: '78205',
    sessionId: 'session-123',
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('useQuoteSubmission', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('stores successful quote results', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'quote-123',
        total: 100,
        breakdown: mockBreakdown,
        estimate: mockEstimate,
      }),
    }) as jest.Mock;

    const { result } = renderHook(() => useQuoteSubmission());

    await act(async () => {
      await result.current.submit(buildOptions());
    });

    expect(result.current.submission).toEqual({
      status: 'success',
      quote: {
        id: 'quote-123',
        total: 100,
        breakdown: mockBreakdown,
        estimate: mockEstimate,
      },
    });
  });

  it('stores API errors as customer-facing copy', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid input' }),
    }) as jest.Mock;

    const { result } = renderHook(() => useQuoteSubmission());

    await act(async () => {
      await result.current.submit(buildOptions());
    });

    expect(result.current.submission).toEqual({
      status: 'error',
      error: QUOTE_SUBMISSION_FALLBACK_ERROR,
    });
  });

  it('keeps the field the server rejected', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid payload', issues: [{ path: ['email'] }] }),
    }) as jest.Mock;

    const { result } = renderHook(() => useQuoteSubmission());

    await act(async () => {
      await result.current.submit(buildOptions());
    });

    expect(result.current.submission).toEqual({
      status: 'error',
      error: 'Check your email address',
      field: 'email',
    });
  });

  describe('with the bot check on', () => {
    const originalSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    const quoteResponse = {
      ok: true,
      json: async () => ({
        id: 'quote-checked',
        total: 100,
        breakdown: mockBreakdown,
        estimate: mockEstimate,
      }),
    };
    let rendered: Array<{ container: HTMLElement; options: Record<string, unknown> }>;

    beforeEach(() => {
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'test-site-key';
      rendered = [];
      window.turnstile = {
        render: (container, options) => {
          rendered.push({ container, options });
          return 'widget-1';
        },
        remove: jest.fn(),
      };
    });

    afterEach(() => {
      if (originalSiteKey === undefined) delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
      else process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = originalSiteKey;
      delete window.turnstile;
      jest.useRealTimers();
    });

    it('sends the token with the quote and leaves nothing on the page', async () => {
      global.fetch = jest.fn().mockResolvedValue(quoteResponse) as jest.Mock;
      const { result } = renderHook(() => useQuoteSubmission());

      let pending: Promise<unknown> = Promise.resolve();
      await act(async () => {
        pending = result.current.submit(buildOptions());
      });
      expect(result.current.submission).toEqual({ status: 'submitting' });
      expect(global.fetch).not.toHaveBeenCalled();
      expect(rendered).toHaveLength(1);
      expect(rendered[0].options).toMatchObject({
        sitekey: 'test-site-key',
        action: 'quote_submit',
        appearance: 'interaction-only',
      });
      // The widget's holder sits on <body>, where no transformed parent traps it.
      expect(rendered[0].container.parentElement).toBe(document.body);

      await act(async () => {
        (rendered[0].options.callback as (token: string) => void)('token-from-cloudflare');
        await pending;
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string);
      expect(body.turnstileToken).toBe('token-from-cloudflare');
      expect(document.querySelector('[data-turnstile-holder]')).toBeNull();
      expect(result.current.submission.status).toBe('success');
    });

    it('still submits, without a token, when the check errors or never answers', async () => {
      jest.useFakeTimers();
      global.fetch = jest.fn().mockResolvedValue(quoteResponse) as jest.Mock;
      const { result } = renderHook(() => useQuoteSubmission());

      let pending: Promise<unknown> = Promise.resolve();
      await act(async () => {
        pending = result.current.submit(buildOptions());
      });
      expect(global.fetch).not.toHaveBeenCalled();

      await act(async () => {
        jest.advanceTimersByTime(8_000);
        await pending;
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string);
      expect(body).not.toHaveProperty('turnstileToken');
      expect(result.current.submission.status).toBe('success');
    });

    it('sends nothing for a submit that was reset while the check ran', async () => {
      global.fetch = jest.fn().mockResolvedValue(quoteResponse) as jest.Mock;
      const { result } = renderHook(() => useQuoteSubmission());

      let pending: Promise<unknown> = Promise.resolve();
      await act(async () => {
        pending = result.current.submit(buildOptions());
      });
      await act(async () => {
        result.current.resetSubmission();
        (rendered[0].options.callback as (token: string) => void)('late-token');
        await pending;
      });

      expect(global.fetch).not.toHaveBeenCalled();
      expect(result.current.submission).toEqual({ status: 'idle' });
    });
  });

  it('keeps the newest successful response when requests overlap', async () => {
    const first = createDeferred<{
      ok: boolean;
      json: () => Promise<{
        id: string;
        total: number;
        breakdown: typeof mockBreakdown;
        estimate: typeof mockEstimate;
      }>;
    }>();
    const second = createDeferred<{
      ok: boolean;
      json: () => Promise<{
        id: string;
        total: number;
        breakdown: typeof mockBreakdown;
        estimate: typeof mockEstimate;
      }>;
    }>();

    global.fetch = jest
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise) as jest.Mock;

    const { result } = renderHook(() => useQuoteSubmission());

    await act(async () => {
      void result.current.submit(buildOptions());
      void result.current.submit(buildOptions());
    });

    await act(async () => {
      second.resolve({
        ok: true,
        json: async () => ({
          id: 'quote-new',
          total: 200,
          breakdown: mockBreakdown,
          estimate: mockEstimate,
        }),
      });
    });

    await waitFor(() =>
      expect(result.current.submission).toEqual({
        status: 'success',
        quote: {
          id: 'quote-new',
          total: 200,
          breakdown: mockBreakdown,
          estimate: mockEstimate,
        },
      })
    );

    await act(async () => {
      first.resolve({
        ok: true,
        json: async () => ({
          id: 'quote-old',
          total: 100,
          breakdown: mockBreakdown,
          estimate: mockEstimate,
        }),
      });
    });

    expect(result.current.submission).toEqual({
      status: 'success',
      quote: {
        id: 'quote-new',
        total: 200,
        breakdown: mockBreakdown,
        estimate: mockEstimate,
      },
    });
  });
});
