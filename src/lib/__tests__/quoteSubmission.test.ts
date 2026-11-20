import { initialQuoteFormParams } from '../quoteForm';
import {
  buildQuoteSubmissionPayload,
  QUOTE_NETWORK_ERROR,
  QUOTE_SUBMISSION_FALLBACK_ERROR,
  submitQuoteRequest,
} from '../quoteSubmission';
import type { QuoteVisualPlacement } from '../quoteVisualPlacement';

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

function buildParams() {
  return {
    ...initialQuoteFormParams,
    structureType: 'storage_shed' as const,
    length: '10',
    width: '12',
    roofStyle: 'barn',
    wallHeight: '8',
    roofMaterial: '26ga metal',
    frameGauge: '12-ga',
    windowPackage: '24x36',
    windowCount: '2',
    ventilation: true,
    color: '#000000',
    addOns: ['Workbench'],
    foundation: 'anchored_slab',
    deliveryAddress: '123 Test St, San Antonio, TX 78205',
    door: 'garage_roll_up',
    deliveryRadius: '15',
    discountCode: 'SAVE10',
    name: 'Test User',
    email: 'info@shed210.com',
    phone: '(210) 772-3028',
    smsConsentOptIn: true,
  };
}

describe('quoteSubmission', () => {
  it('builds the quote request payload from form params', () => {
    expect(
      buildQuoteSubmissionPayload({
        params: buildParams(),
        deliveryZip: '78205',
        sessionId: 'session-123',
      })
    ).toEqual({
      structureType: 'storage_shed',
      length: 10,
      width: 12,
      roofStyle: 'barn',
      wallHeight: '8',
      roofMaterial: '26ga metal',
      frameGauge: '12-ga',
      windowPackage: '24x36',
      windowCount: 2,
      ventilation: true,
      color: '#000000',
      addOns: ['Workbench'],
      foundation: 'anchored_slab',
      deliveryAddress: '123 Test St, San Antonio, TX 78205',
      deliveryZip: '78205',
      door: 'garage_roll_up',
      discountCode: 'SAVE10',
      website: '',
      name: 'Test User',
      email: 'info@shed210.com',
      phone: '+12107723028',
      smsConsentOptIn: true,
      smsConsentTextVersion: 'shed210_quote_sms_consent_v4_2026_09_28',
      smsMarketingConsentOptIn: false,
      session_id: 'session-123',
    });
  });

  it('never sends browser-derived mileage as a pricing input', () => {
    const payload = buildQuoteSubmissionPayload({
      params: { ...buildParams(), deliveryRadius: '250' },
      deliveryZip: '78701',
      sessionId: 'session-123',
    });

    expect(payload).not.toHaveProperty('deliveryRadius');
  });

  it('includes visual placement metadata when provided', () => {
    const visualPlacement: QuoteVisualPlacement = {
      version: 1,
      defaultsVersion: 'quote-visual-defaults-v2',
      customized: true,
      doors: [
        {
          id: 'door-default-garage_roll_up',
          side: 'front',
          width: 8,
          height: 6.75,
          offset: 1,
          placement: 'custom',
        },
      ],
      windows: [],
    };

    expect(
      buildQuoteSubmissionPayload({
        params: buildParams(),
        deliveryZip: '78205',
        sessionId: 'session-123',
        visualPlacement,
      })
    ).toEqual(expect.objectContaining({ visualPlacement }));
  });

  it('submits the request and returns the created quote', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'quote-123',
        total: 100,
        breakdown: mockBreakdown,
        estimate: mockEstimate,
      }),
    });

    const result = await submitQuoteRequest(
      {
        params: buildParams(),
        deliveryZip: '78205',
        sessionId: 'session-123',
      },
      fetchMock as unknown as typeof fetch
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/quote',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
    expect(
      JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    ).toMatchObject({
      structureType: 'storage_shed',
      phone: '+12107723028',
      smsConsentOptIn: true,
      session_id: 'session-123',
    });
    expect(result).toEqual({
      kind: 'success',
      quote: {
        id: 'quote-123',
        total: 100,
        breakdown: mockBreakdown,
        estimate: mockEstimate,
      },
    });
  });

  it('fails safe when a rolling deployment omits estimate metadata', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 123,
        total: 100,
        breakdown: mockBreakdown,
      }),
    });

    await expect(
      submitQuoteRequest(
        {
          params: buildParams(),
          deliveryZip: '78205',
          sessionId: 'session-123',
        },
        fetchMock as unknown as typeof fetch
      )
    ).resolves.toEqual({
      kind: 'success',
      quote: {
        id: '123',
        total: 100,
        breakdown: mockBreakdown,
        estimate: mockEstimate,
      },
    });
  });

  it.each(['private-action-token', undefined, '', 123])('preserves only a usable optional discussion token (%s)', async (discussionToken) => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'quote-123', total: 100, breakdown: mockBreakdown, discussionToken }),
    });
    const result = await submitQuoteRequest({ params: buildParams(), deliveryZip: '78205', sessionId: 'session-123' }, fetchMock);
    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.quote.discussionToken).toBe(discussionToken === 'private-action-token' ? discussionToken : undefined);
    }
  });

  it('rejects a legacy response that includes an unverified delivery charge', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'quote-123',
        total: 125,
        breakdown: { ...mockBreakdown, delivery: 25 },
      }),
    });

    await expect(
      submitQuoteRequest(
        {
          params: buildParams(),
          deliveryZip: '78205',
          sessionId: 'session-123',
        },
        fetchMock as unknown as typeof fetch
      )
    ).resolves.toEqual({
      kind: 'response_error',
      status: 200,
      error: QUOTE_SUBMISSION_FALLBACK_ERROR,
    });
  });

  it('rejects response metadata that claims delivery is included', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'quote-123',
        total: 100,
        breakdown: mockBreakdown,
        estimate: {
          kind: 'build_subtotal',
          delivery: {
            status: 'pending_verification',
            includedInTotal: true,
          },
        },
      }),
    });

    await expect(
      submitQuoteRequest(
        {
          params: buildParams(),
          deliveryZip: '78205',
          sessionId: 'session-123',
        },
        fetchMock as unknown as typeof fetch
      )
    ).resolves.toEqual({
      kind: 'response_error',
      status: 200,
      error: QUOTE_SUBMISSION_FALLBACK_ERROR,
    });
  });

  it('rejects malformed successful responses instead of crashing the result UI', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'quote-123', total: '100', breakdown: {} }),
    });

    await expect(
      submitQuoteRequest(
        {
          params: buildParams(),
          deliveryZip: '78205',
          sessionId: 'session-123',
        },
        fetchMock as unknown as typeof fetch
      )
    ).resolves.toEqual({
      kind: 'response_error',
      status: 200,
      error: QUOTE_SUBMISSION_FALLBACK_ERROR,
    });
  });

  async function submitWithResponse(status: number, json: () => Promise<unknown>) {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status, json });
    return submitQuoteRequest(
      {
        params: buildParams(),
        deliveryZip: '78205',
        sessionId: 'session-123',
      },
      fetchMock as unknown as typeof fetch
    );
  }

  it('marks the email field when the server rejects the email', async () => {
    await expect(
      submitWithResponse(400, async () => ({
        error: 'Invalid payload',
        issues: [{ code: 'invalid_format', path: ['email'], message: 'Invalid email address' }],
      }))
    ).resolves.toEqual({
      kind: 'response_error',
      status: 400,
      field: 'email',
      error: 'Check your email address',
    });
  });

  it.each([
    [400, { error: 'Invalid payload', issues: [{ path: ['discountCode'] }] }],
    [400, { error: 'Invalid phone number' }],
    [403, { error: 'Forbidden origin' }],
    [500, { error: 'Server error' }],
    [500, { error: 'Unable to save quote request' }],
    [503, {}],
  ])('replaces a raw %i response with the call or text fallback', async (status, body) => {
    await expect(submitWithResponse(status, async () => body)).resolves.toEqual({
      kind: 'response_error',
      status,
      error: QUOTE_SUBMISSION_FALLBACK_ERROR,
    });
  });

  it('falls back when a platform error page is not JSON', async () => {
    await expect(
      submitWithResponse(504, async () => {
        throw new SyntaxError('Unexpected token < in JSON at position 0');
      })
    ).resolves.toEqual({
      kind: 'response_error',
      status: 504,
      error: QUOTE_SUBMISSION_FALLBACK_ERROR,
    });
    expect(QUOTE_SUBMISSION_FALLBACK_ERROR).toBe(
      "We couldn't send your request. Please check your details, or call or text us."
    );
  });

  it.each([
    [429, 'Too many requests. Please try again shortly.'],
    [
      503,
      'We could not verify the latest pricing. Please try again shortly or contact us directly.',
    ],
  ])('passes the %i server message through', async (status, error) => {
    await expect(submitWithResponse(status, async () => ({ error }))).resolves.toEqual({
      kind: 'response_error',
      status,
      error,
    });
  });

  it('includes the fetch failure reason in local network errors', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(
      submitQuoteRequest(
        {
          params: buildParams(),
          deliveryZip: '78205',
          sessionId: 'session-123',
        },
        fetchMock as unknown as typeof fetch
      )
    ).resolves.toEqual({
      kind: 'network_error',
      error: 'Network error: Failed to fetch',
    });
  });

  it('gives customers a plain sentence for network errors in production', async () => {
    const env = process.env as Record<string, string | undefined>;
    const previousNodeEnv = env.NODE_ENV;
    env.NODE_ENV = 'production';
    try {
      const fetchMock = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
      await expect(
        submitQuoteRequest(
          { params: buildParams(), deliveryZip: '78205', sessionId: 'session-123' },
          fetchMock as unknown as typeof fetch
        )
      ).resolves.toEqual({ kind: 'network_error', error: QUOTE_NETWORK_ERROR });
    } finally {
      env.NODE_ENV = previousNodeEnv;
    }
  });

  it('returns an aborted result when the request is cancelled', async () => {
    const fetchMock = jest.fn().mockRejectedValue(
      new DOMException('aborted', 'AbortError')
    );

    await expect(
      submitQuoteRequest(
        {
          params: buildParams(),
          deliveryZip: '78205',
          sessionId: 'session-123',
        },
        fetchMock as unknown as typeof fetch
      )
    ).resolves.toEqual({ kind: 'aborted' });
  });
});
