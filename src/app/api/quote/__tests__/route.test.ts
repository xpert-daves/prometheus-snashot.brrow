import { type NextRequest } from 'next/server'

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
  interiorUpgrades: []
}
const mockEstimate = {
  kind: 'build_subtotal',
  delivery: {
    status: 'pending_verification',
    includedInTotal: false,
  },
}
const mockQuery = jest.fn()
const mockMutation = jest.fn()
const mockConvexHttpClient = jest.fn(() => ({
  query: mockQuery,
  mutation: mockMutation,
}))

jest.mock('convex/browser', () => ({
  ConvexHttpClient: mockConvexHttpClient,
}))

const mockCaptureException = jest.fn()
const mockSentryFlush = jest.fn().mockResolvedValue(true)
jest.mock('@sentry/nextjs', () => ({
  captureException: mockCaptureException,
  flush: mockSentryFlush,
}))

// Runs the post-response task at once so tests can see what it schedules.
const mockAfter = jest.fn((task: () => unknown) => {
  void task()
})
jest.mock('next/server', () => ({
  after: mockAfter,
  NextRequest: class {},
  NextResponse: {
    json: (body: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
      body,
      status: init?.status ?? 200,
      headers: init?.headers ?? {},
    }),
  },
}))

// The bot check's answer. Each test says what Cloudflare would say.
const mockVerifyTurnstileToken = jest.fn()
jest.mock('../../../../lib/turnstileVerify.server', () => ({
  verifyTurnstileToken: (...args: unknown[]) => mockVerifyTurnstileToken(...args),
}))

import { PHONE_DISPLAY } from '../../../../lib/contact'
import { DEFAULT_QUOTE_PRICING_CONFIG } from '../../../../lib/pricing/pricingData'
import { QUOTE_VISUAL_DEFAULTS_VERSION } from '../../../../lib/quoteVisualPlacement'
import {
  SMS_UNIFIED_CONSENT_TEXT,
  SMS_QUOTE_CONSENT_TEXT,
  SMS_QUOTE_CONSENT_TEXT_VERSION,
  SMS_QUOTE_CONSENT_V3_TEXT,
  SMS_QUOTE_CONSENT_V3_TEXT_VERSION,
} from '../../../../lib/smsConsent'

const calcMock = jest.fn(() => ({ total: 100, breakdown: mockBreakdown }))
jest.mock('../../../../lib/pricing/calculateQuote', () => ({ calculateQuote: calcMock }))

const activePricingSettings = {
  source: 'table',
  settingsId: 'quotePricingSettings-1',
  pricingPublicationId: null,
  key: 'active',
  config: DEFAULT_QUOTE_PRICING_CONFIG,
  configVersion: 1,
  updatedAt: 1_714_000_000_000,
  updatedByEmail: 'admin@example.com',
} as const

describe('quote API route', () => {
  let POST: typeof import('../route').POST
  beforeAll(async () => {
    process.env.CONVEX_QUOTE_WRITE_KEY = 'test-write-key'
    process.env.NEXT_PUBLIC_CONVEX_URL = 'https://test.convex.cloud'
    process.env.QUOTE_PRICING_SOURCE = 'shed_convex'
    ;({ POST } = await import('../route'))
  })

  afterAll(() => {
    delete process.env.QUOTE_PRICING_SOURCE
  })

  const buildRequest = (
    body: Record<string, unknown>,
    headers: Record<string, string> = {}
  ) => {
    const bytes = new Uint8Array(Buffer.from(JSON.stringify(body)))
    let consumed = false

    return {
      headers: {
        get: (name: string) => {
          const key = name.toLowerCase()
          return headers[key] ?? null
        },
      },
      body: {
        getReader: () => ({
          read: async () => {
            if (consumed) return { done: true, value: undefined }
            consumed = true
            return { done: false, value: bytes }
          },
          cancel: async () => undefined,
          releaseLock: () => undefined,
        }),
      },
    }
  }

  const jsonHeaders = {
    'content-type': 'application/json',
  } as const

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.QUOTE_PRICING_SOURCE = 'shed_convex'
    delete process.env.FRONTIER_PIXEL_CRM_CONVEX_URL
    delete process.env.FRONTIER_PIXEL_CRM_QUOTE_PRICING_KEY
    mockQuery.mockResolvedValue(activePricingSettings)
    // No TURNSTILE_SECRET_KEY: nothing is checked, as before the bot check.
    mockVerifyTurnstileToken.mockResolvedValue('unconfigured')
    mockMutation.mockImplementation((_reference, args) =>
      Promise.resolve(
        args && typeof args === 'object' && 'keyHash' in args
          ? { allowed: true, retryAfterSeconds: 0 }
          : null
      )
    )
  })

  function quoteCreatePayloads() {
    return mockMutation.mock.calls
      .map((call) => call[1])
      .filter((payload) => payload && typeof payload === 'object' && 'publicId' in payload)
  }

  function latestQuoteCreatePayload() {
    const payloads = quoteCreatePayloads()
    return payloads[payloads.length - 1]
  }

  function quoteRateLimitPayloads() {
    return mockMutation.mock.calls
      .map((call) => call[1])
      .filter((payload) => payload && typeof payload === 'object' && 'keyHash' in payload)
  }

  const quoteSaveUnavailableBody = {
    error: `We couldn't save your quote right now. Please try again in a minute, or call or text us at ${PHONE_DISPLAY}.`,
  }

  function expectQuoteIntakeReported(stage: string, provider?: string) {
    expect(mockCaptureException).toHaveBeenCalledTimes(1)
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        level: 'error',
        tags: expect.objectContaining({
          area: 'quote_intake',
          stage,
          ...(provider ? { provider } : {}),
        }),
      })
    )
    // The event is flushed after the response so a suspended function cannot drop it.
    expect(mockAfter).toHaveBeenCalledTimes(1)
    expect(mockSentryFlush).toHaveBeenCalledTimes(1)
    expect(mockSentryFlush).toHaveBeenCalledWith(2_000)
  }

  function expectNothingReported() {
    expect(mockCaptureException).not.toHaveBeenCalled()
    expect(mockSentryFlush).not.toHaveBeenCalled()
  }

  function reportedReason() {
    return mockCaptureException.mock.calls[0][1].tags.reason
  }

  // Everything handed to Sentry, including the reported error's message and stack.
  function sentryReportText() {
    return mockCaptureException.mock.calls
      .map(([error, context]) => [
        error instanceof Error ? `${error.name} ${error.message} ${error.stack}` : String(error),
        JSON.stringify(context),
      ].join(' '))
      .join('\n')
  }

  it.each<Record<string, string>>([{}, { dnt: '1' }, { 'sec-gpc': '1' }])('keeps optional attribution separate and honors request privacy headers %j', async (privacyHeaders) => {
    const measurement = { sessionId: '6152c011-1a23-44a3-9bf1-5fa0067d2cb6', attribution: {
      firstTouch: { landingPath: '/service-area', referrer: 'perplexity' },
      lastTouch: { landingPath: '/quote', referrer: 'direct', utmCampaign: 'local-sheds' },
    } };
    const req = buildRequest({ name: 'Test', email: 'info@shed210.com', phone: '(210) 772-3028', smsConsentOptIn: true, structureType: 'storage_shed', length: 10, width: 10, measurement: { ...measurement, privateAnswer: 'never-record-this' } }, { ...jsonHeaders, ...privacyHeaders });
    const response = await POST(req as unknown as NextRequest);
    expect(response.status).toBe(201);
    const payload = latestQuoteCreatePayload();
    if (Object.keys(privacyHeaders).length) expect(payload.measurement).toBeUndefined();
    else expect(payload.measurement).toEqual(measurement);
    expect(JSON.stringify(payload)).not.toContain('never-record-this');
  });

  it('drops malformed optional analytics without rejecting the customer quote', async () => {
    const req = buildRequest({ name: 'Test', email: 'info@shed210.com', phone: '(210) 772-3028', smsConsentOptIn: true, structureType: 'storage_shed', length: 10, width: 10, measurement: {
      sessionId: '6152c011-1a23-44a3-9bf1-5fa0067d2cb6', attribution: { firstTouch: { landingPath: '/', referrer: ['google'], utmSource: '__proto__' }, lastTouch: { landingPath: '/quote', referrer: 'direct' } },
    } }, jsonHeaders);
    expect((await POST(req as unknown as NextRequest)).status).toBe(201);
    expect(latestQuoteCreatePayload().measurement).toEqual({ sessionId: '6152c011-1a23-44a3-9bf1-5fa0067d2cb6', attribution: undefined });
  });

  it('stores quote in Convex and returns quote result', async () => {
    const req = buildRequest(
      {
        name: 'Test',
        email: 'info@shed210.com',
        phone: '(210) 772-3028',
        smsConsentOptIn: true,
        structureType: 'storage_shed',
        length: 10,
        width: 10,
      },
      jsonHeaders
    )

    const res = await POST(req as unknown as NextRequest)

    expect(mockConvexHttpClient).toHaveBeenCalledWith('https://test.convex.cloud')
    expect(mockQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ readKey: 'test-write-key' })
    )
    // The per-minute check, then the address's day limit (no session id here).
    expect(quoteRateLimitPayloads().map(({ windowMs, maxRequests }) => ({ windowMs, maxRequests }))).toEqual([
      { windowMs: 60_000, maxRequests: 10 },
      { windowMs: 86_400_000, maxRequests: 12 },
    ])
    expect(quoteCreatePayloads()).toHaveLength(1)
    const payload = latestQuoteCreatePayload()
    expect(payload).toEqual(
      expect.objectContaining({
        publicId: expect.any(String),
        writeKey: 'test-write-key',
        sessionId: expect.any(String),
        contact: { name: 'Test', email: 'info@shed210.com', phone: '+12107723028' },
        smsConsent: expect.objectContaining({
          status: 'opted_in',
          source: 'website_quote_form',
          consentTextVersion: 'shed210_quote_contact_consent_v2_2026_05',
          pageUrl: '/quote',
        }),
        smsMarketingConsent: expect.objectContaining({
          status: 'not_opted_in',
          source: 'website_quote_form',
          consentText: null,
          consentTextVersion: null,
          pageUrl: null,
        }),
        inputs: expect.objectContaining({
          structureType: 'storage_shed',
          length: 10,
          width: 10,
          addOns: [],
          visualPlacement: expect.objectContaining({
            version: 1,
            defaultsVersion: QUOTE_VISUAL_DEFAULTS_VERSION,
            customized: false,
            doors: [
              expect.objectContaining({
                side: 'front',
                placement: 'default',
              }),
            ],
            windows: [],
          }),
        }),
        pricing: {
          total: 100,
          breakdown: mockBreakdown,
          deliveryPricingStatus: 'pending_verification',
          config: {
            provider: 'shed_convex',
            source: 'table',
            settingsId: 'quotePricingSettings-1',
            pricingPublicationId: null,
            key: 'active',
            configVersion: 1,
            pricingSchemaVersion: 1,
            pricingPublicationVersion: null,
            updatedAt: 1_714_000_000_000,
          },
        },
      })
    )
    expect(calcMock).toHaveBeenCalledWith(
      expect.objectContaining({
        structureType: 'storage_shed',
        length: 10,
        width: 10,
      }),
      DEFAULT_QUOTE_PRICING_CONFIG
    )
    expect(res.status).toBe(201)
    expect(res.body).toEqual({
      id: payload.publicId,
      total: 100,
      breakdown: mockBreakdown,
      estimate: mockEstimate,
    })
  })

  it('stores the immutable CRM publication used for a quote', async () => {
    process.env.QUOTE_PRICING_SOURCE = 'frontier_pixel_crm'
    process.env.FRONTIER_PIXEL_CRM_CONVEX_URL =
      'https://youthful-horse-290.convex.cloud'
    process.env.FRONTIER_PIXEL_CRM_QUOTE_PRICING_KEY = 'crm-pricing-key'
    mockQuery.mockResolvedValue({
      ...activePricingSettings,
      settingsId: null,
      pricingPublicationId: 'pricing-publication-4',
      configVersion: 4,
      updatedAt: 1_785_000_000_000,
    })
    const req = buildRequest(
      {
        name: 'Test',
        email: 'info@shed210.com',
        phone: '(210) 772-3028',
        smsConsentOptIn: true,
        structureType: 'storage_shed',
        length: 10,
        width: 12,
        roofStyle: 'barn',
      },
      jsonHeaders
    )

    const res = await POST(req as unknown as NextRequest)

    expect(res.status).toBe(201)
    expect(mockConvexHttpClient).toHaveBeenCalledWith(
      'https://youthful-horse-290.convex.cloud',
      expect.objectContaining({ fetch: expect.any(Function) })
    )
    expect(mockQuery).toHaveBeenCalledWith(expect.anything(), {
      tenantSlug: 'shed210',
      readKey: 'crm-pricing-key',
    })
    expect(latestQuoteCreatePayload().pricing.config).toEqual({
      provider: 'frontier_pixel_crm',
      source: 'table',
      settingsId: null,
      pricingPublicationId: 'pricing-publication-4',
      key: 'active',
      configVersion: 4,
      pricingSchemaVersion: 1,
      pricingPublicationVersion: 4,
      updatedAt: 1_785_000_000_000,
    })
  })

  it('sanitizes submitted visual placement with the 6-foot wall default', async () => {
    const req = buildRequest(
      {
        name: 'Test',
        email: 'info@shed210.com',
        phone: '(210) 772-3028',
        smsConsentOptIn: true,
        structureType: 'storage_shed',
        length: 10,
        width: 10,
        door: 'garage_roll_up',
        visualPlacement: {
          version: 1,
          defaultsVersion: 'quote-visual-defaults-v2',
          customized: true,
          doors: [
            {
              id: 'door-default-garage_roll_up',
              side: 'back',
              width: 2,
              height: 2,
              offset: 99,
              placement: 'custom',
            },
          ],
          windows: [],
        },
      },
      jsonHeaders
    )

    const res = await POST(req as unknown as NextRequest)

    expect(res.status).toBe(201)
    const payload = latestQuoteCreatePayload()
    expect(payload.inputs.visualPlacement).toMatchObject({
      customized: true,
      doors: [
        {
          id: 'door-default-garage_roll_up',
          side: 'back',
          width: 8,
          height: 5.75,
          offset: 0.5,
          placement: 'custom',
        },
      ],
      windows: [],
    })
  })

  it('rebuilds default spots posted by a page loaded before the defaults changed', async () => {
    const window = (n: number, side: string) => ({
      id: `window-default-${n}`,
      side,
      width: 2,
      height: 3,
      offset: 0,
      heightFromFloor: 3,
      placement: 'default',
    })
    const req = buildRequest(
      {
        name: 'Test',
        email: 'info@shed210.com',
        phone: '(210) 772-3028',
        smsConsentOptIn: true,
        structureType: 'storage_shed',
        length: 12,
        width: 10,
        door: 'single_shed',
        windowPackage: '24x36',
        windowCount: 4,
        visualPlacement: {
          version: 1,
          defaultsVersion: 'quote-visual-defaults-v2',
          customized: false,
          doors: [
            { id: 'door-default-single_shed', side: 'front', width: 3, height: 5.75, offset: 0, placement: 'default' },
          ],
          // v2 put the fourth window on the front wall, over the door.
          windows: [window(1, 'right'), window(2, 'left'), window(3, 'back'), window(4, 'front')],
        },
      },
      jsonHeaders
    )

    const res = await POST(req as unknown as NextRequest)

    expect(res.status).toBe(201)
    const placement = latestQuoteCreatePayload().inputs.visualPlacement
    expect(placement).toMatchObject({ defaultsVersion: QUOTE_VISUAL_DEFAULTS_VERSION, customized: false })
    expect(placement.windows.every((w: { placement: string }) => w.placement === 'default')).toBe(true)
    expect(placement.windows).not.toContainEqual(expect.objectContaining({ side: 'front', offset: 0 }))
  })

  it.each([
    {},
    { smsConsentOptIn: false },
    { smsConsentOptIn: 'invalid' },
    { smsUnifiedConsentOptIn: false },
    { smsUnifiedConsentOptIn: false, smsConsentOptIn: true },
    { smsMarketingConsentOptIn: true },
  ])('rejects requests without affirmative quote consent: %j', async (consent) => {
    const req = buildRequest(
      {
        name: 'Test',
        email: 'info@shed210.com',
        phone: '(210) 772-3028',
        ...consent,
        structureType: 'storage_shed',
        length: 10,
        width: 10,
      },
      jsonHeaders
    )

    const res = await POST(req as unknown as NextRequest)

    expect(res.status).toBe(400)
    expect(quoteCreatePayloads()).toEqual([])
    expect(calcMock).not.toHaveBeenCalled()
    expectNothingReported()
  })

  it('stores the current quote-only wording without granting marketing consent', async () => {
    const req = buildRequest({
      name: 'Test', email: 'info@shed210.com', phone: '(210) 772-3028',
      structureType: 'storage_shed', length: 10, width: 10,
      smsConsentOptIn: true,
      smsConsentTextVersion: SMS_QUOTE_CONSENT_TEXT_VERSION,
      smsMarketingConsentOptIn: false,
    }, jsonHeaders)
    const res = await POST(req as unknown as NextRequest)
    expect(res.status).toBe(201)
    const payload = latestQuoteCreatePayload()
    expect(payload.smsConsent).toMatchObject({
      status: 'opted_in', source: 'website_quote_form',
      consentText: SMS_QUOTE_CONSENT_TEXT,
      consentTextVersion: SMS_QUOTE_CONSENT_TEXT_VERSION,
      recordedAt: expect.any(Number),
    })
    expect(payload.smsMarketingConsent).toMatchObject({
      status: 'not_opted_in', consentText: null, consentTextVersion: null,
    })
  })

  it('still accepts v3 consent from pages opened before v4 and records the v3 copy', async () => {
    const req = buildRequest({
      name: 'Test', email: 'info@shed210.com', phone: '(210) 772-3028',
      structureType: 'storage_shed', length: 10, width: 10,
      smsConsentOptIn: true,
      smsConsentTextVersion: SMS_QUOTE_CONSENT_V3_TEXT_VERSION,
      smsMarketingConsentOptIn: false,
    }, jsonHeaders)
    const res = await POST(req as unknown as NextRequest)
    expect(res.status).toBe(201)
    expect(latestQuoteCreatePayload().smsConsent).toMatchObject({
      status: 'opted_in',
      consentText: SMS_QUOTE_CONSENT_V3_TEXT,
      consentTextVersion: SMS_QUOTE_CONSENT_V3_TEXT_VERSION,
    })
  })

  it('shows the no-purchase statement and phone alternative in current consent copy', () => {
    expect(SMS_QUOTE_CONSENT_TEXT).toContain('Consent is not a condition of purchase.')
    expect(SMS_QUOTE_CONSENT_TEXT).toContain('Prefer not to receive texts? Call (855) 578-0944 for a quote.')
    expect(SMS_QUOTE_CONSENT_TEXT).not.toContain('Required to use the online quote tool')
  })

  it.each([
    { smsConsentTextVersion: 'unknown-version' },
    { smsConsentTextVersion: SMS_QUOTE_CONSENT_TEXT_VERSION, smsMarketingConsentOptIn: true },
    { smsConsentTextVersion: SMS_QUOTE_CONSENT_TEXT_VERSION, smsUnifiedConsentOptIn: true },
  ])('rejects unknown or mixed current consent scope: %j', async (consent) => {
    const req = buildRequest({
      name: 'Test', email: 'info@shed210.com', phone: '(210) 772-3028',
      structureType: 'storage_shed', length: 10, width: 10,
      smsConsentOptIn: true, ...consent,
    }, jsonHeaders)
    const res = await POST(req as unknown as NextRequest)
    expect(res.status).toBe(400)
    expect(quoteCreatePayloads()).toEqual([])
  })

  it('stores explicit SMS opt-in proof when checked', async () => {
    const req = buildRequest(
      {
        name: 'Test',
        email: 'info@shed210.com',
        phone: '(210) 772-3028',
        smsConsentOptIn: true,
        structureType: 'storage_shed',
        length: 10,
        width: 10,
      },
      {
        ...jsonHeaders,
        'x-forwarded-for': '203.0.113.10',
        'user-agent': 'Jest Browser',
      }
    )

    const res = await POST(req as unknown as NextRequest)

    expect(res.status).toBe(201)
    const payload = latestQuoteCreatePayload()
    expect(payload.smsConsent).toMatchObject({
      status: 'opted_in',
      source: 'website_quote_form',
      consentTextVersion: 'shed210_quote_contact_consent_v2_2026_05',
      pageUrl: '/quote',
      ipAddress: '203.0.113.10',
      userAgent: 'Jest Browser',
    })
    expect(payload.smsConsent.consentText).toContain(
      'I agree to receive calls or text messages'
    )
    expect(payload.smsConsent.recordedAt).toEqual(expect.any(Number))
  })

  it('rejects malformed forwarded IP metadata and bounds the user agent', async () => {
    const longIp = '1'.repeat(80)
    const longUserAgent = 'browser'.repeat(200)
    const req = buildRequest(
      {
        name: 'Test',
        email: 'info@shed210.com',
        phone: '(210) 772-3028',
        smsConsentOptIn: true,
        structureType: 'storage_shed',
        length: 10,
        width: 10,
      },
      {
        ...jsonHeaders,
        'x-forwarded-for': `${longIp}, 203.0.113.10`,
        'user-agent': longUserAgent,
      }
    )

    const res = await POST(req as unknown as NextRequest)

    expect(res.status).toBe(201)
    const payload = latestQuoteCreatePayload()
    expect(payload.smsConsent.ipAddress).toBe('unknown')
    expect(payload.smsConsent.userAgent).toBe(longUserAgent.slice(0, 1_024))
  })

  it('treats client-provided delivery mileage as unverified planning input', async () => {
    const req = buildRequest(
      {
        name: 'Test',
        email: 'info@shed210.com',
        phone: '(210) 772-3028',
        smsConsentOptIn: true,
        structureType: 'storage_shed',
        length: 10,
        width: 10,
        deliveryAddress: '500 Far Away Rd, Austin, TX',
        deliveryZip: '78701',
        deliveryRadius: 250,
      },
      jsonHeaders
    )

    const res = await POST(req as unknown as NextRequest)

    expect(res.status).toBe(201)
    expect(calcMock).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryRadius: 0 }),
      DEFAULT_QUOTE_PRICING_CONFIG
    )
    expect(latestQuoteCreatePayload()).toMatchObject({
      inputs: {
        deliveryAddress: '500 Far Away Rd, Austin, TX',
        deliveryZip: '78701',
        deliveryRadius: 0,
      },
      pricing: {
        deliveryPricingStatus: 'pending_verification',
      },
    })
    expect(res.body).toMatchObject({
      estimate: {
        kind: 'build_subtotal',
        delivery: {
          status: 'pending_verification',
          includedInTotal: false,
        },
      },
    })
  })

  it('stores optional marketing SMS proof only when checked', async () => {
    const req = buildRequest(
      {
        name: 'Test',
        email: 'info@shed210.com',
        phone: '(210) 772-3028',
        smsConsentOptIn: true,
        smsMarketingConsentOptIn: true,
        structureType: 'storage_shed',
        length: 10,
        width: 10,
      },
      {
        ...jsonHeaders,
        'x-forwarded-for': '203.0.113.10',
        'user-agent': 'Jest Browser',
      }
    )

    const res = await POST(req as unknown as NextRequest)

    expect(res.status).toBe(201)
    const payload = latestQuoteCreatePayload()
    expect(payload.smsMarketingConsent).toMatchObject({
      status: 'opted_in',
      source: 'website_quote_form',
      consentTextVersion: 'shed210_marketing_sms_consent_v1_2026_05',
      pageUrl: '/quote',
      ipAddress: '203.0.113.10',
      userAgent: 'Jest Browser',
    })
    expect(payload.smsMarketingConsent.consentText).toContain(
      'I agree to receive promotional texts'
    )
    expect(payload.smsMarketingConsent.recordedAt).toEqual(expect.any(Number))
  })

  it('stores the exact unified consent proof in both CRM consent scopes', async () => {
    const req = buildRequest(
      {
        name: 'Test',
        email: 'info@shed210.com',
        phone: '(210) 772-3028',
        smsUnifiedConsentOptIn: true,
        structureType: 'storage_shed',
        length: 10,
        width: 10,
      },
      {
        ...jsonHeaders,
        'x-forwarded-for': '203.0.113.10',
        'user-agent': 'Jest Browser',
      }
    )

    const res = await POST(req as unknown as NextRequest)

    expect(res.status).toBe(201)
    const payload = latestQuoteCreatePayload()
    const expectedProof = expect.objectContaining({
      status: 'opted_in',
      source: 'website_quote_form',
      consentTextVersion: 'shed210_unified_sms_consent_v1_2026_07',
      pageUrl: '/quote',
      ipAddress: '203.0.113.10',
      userAgent: 'Jest Browser',
    })
    expect(payload.smsConsent).toEqual(expectedProof)
    expect(payload.smsMarketingConsent).toEqual(expectedProof)
    expect(payload.smsConsent.consentText).toBe(SMS_UNIFIED_CONSENT_TEXT)
    expect(payload.smsMarketingConsent.consentText).toBe(SMS_UNIFIED_CONSENT_TEXT)
    expect(payload.smsMarketingConsent.recordedAt).toBe(
      payload.smsConsent.recordedAt
    )
  })

  it('parses frameGauge strings to numbers', async () => {
    const req = buildRequest(
      {
        name: 'Test',
        email: 'info@shed210.com',
        phone: '(210) 772-3028',
        smsConsentOptIn: true,
        structureType: 'carport',
        length: 10,
        width: 10,
        frameGauge: '14-ga',
      },
      jsonHeaders
    )

    const res = await POST(req as unknown as NextRequest)

    expect(res.status).toBe(201)
    expect(mockMutation).toHaveBeenCalled()
    const payload = latestQuoteCreatePayload()
    expect(payload.inputs.frameGauge).toBe('14-ga')
    expect(payload.pricing.total).toBe(100)
  })

  it('normalizes various US phone inputs to E.164', async () => {
    const cases = [
      '+1 (210) 772-3028',
      '1 210 772 3028',
      '(210) 772-3028',
      '210-772-3028',
    ]

    for (const phone of cases) {
      const req = buildRequest(
        {
          name: 'Test',
          email: 'info@shed210.com',
          structureType: 'storage_shed',
          length: 10,
          width: 10,
          phone,
          smsConsentOptIn: true,
        },
        jsonHeaders
      )

      const res = await POST(req as unknown as NextRequest)
      expect(res.status).toBe(201)
      const payload = latestQuoteCreatePayload()
      expect(payload.contact.phone).toBe('+12107723028')
    }
  })

  it('rejects invalid US phone inputs', async () => {
    const req = buildRequest(
      {
        name: 'Test',
        email: 'info@shed210.com',
        structureType: 'storage_shed',
        length: 10,
        width: 10,
        phone: '077-2302',
        smsConsentOptIn: true,
      },
      jsonHeaders
    )

    const res = await POST(req as unknown as NextRequest)
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Invalid phone number' })
  })

  it('rejects missing phone inputs before saving', async () => {
    const req = buildRequest(
      {
        name: 'Test',
        email: 'info@shed210.com',
        structureType: 'storage_shed',
        length: 10,
        width: 10,
        smsConsentOptIn: true,
      },
      jsonHeaders
    )

    const res = await POST(req as unknown as NextRequest)
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Phone number is required' })
    expect(quoteCreatePayloads()).toHaveLength(0)
  })

  it('rejects non-json payloads', async () => {
    mockMutation.mockImplementation(() =>
      Promise.reject(new Error('shared limiter unavailable'))
    )
    const req = buildRequest(
      {
        name: 'Test',
        email: 'info@shed210.com',
        phone: '(210) 772-3028',
        smsConsentOptIn: true,
        structureType: 'storage_shed',
        length: 10,
        width: 10,
      },
      { 'content-type': 'application/x-www-form-urlencoded' }
    )

    const res = await POST(req as unknown as NextRequest)
    expect(res.status).toBe(415)
    expect(res.body).toEqual({ error: 'Unsupported content type' })
    expect(mockMutation).not.toHaveBeenCalled()
    expect(mockQuery).not.toHaveBeenCalled()
    expect(calcMock).not.toHaveBeenCalled()
  })

  it('rejects media types that only contain the application/json substring', async () => {
    const req = buildRequest(
      {
        name: 'Test',
        email: 'info@shed210.com',
        phone: '(210) 772-3028',
        smsConsentOptIn: true,
        structureType: 'storage_shed',
        length: 10,
        width: 10,
      },
      { 'content-type': 'text/application/json-evil' }
    )

    const res = await POST(req as unknown as NextRequest)
    expect(res.status).toBe(415)
    expect(res.body).toEqual({ error: 'Unsupported content type' })
    expect(mockMutation).not.toHaveBeenCalled()
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('rejects a missing content type before calling Convex', async () => {
    const req = buildRequest(
      {
        name: 'Test',
        email: 'info@shed210.com',
        phone: '(210) 772-3028',
        smsConsentOptIn: true,
        structureType: 'storage_shed',
        length: 10,
        width: 10,
      },
      {}
    )

    const res = await POST(req as unknown as NextRequest)

    expect(res.status).toBe(415)
    expect(res.body).toEqual({ error: 'Unsupported content type' })
    expect(mockMutation).not.toHaveBeenCalled()
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('accepts structured JSON media types with parameters', async () => {
    const req = buildRequest(
      {
        name: 'Test',
        email: 'info@shed210.com',
        phone: '(210) 772-3028',
        smsConsentOptIn: true,
        structureType: 'storage_shed',
        length: 10,
        width: 10,
      },
      { 'content-type': 'application/problem+json; charset=utf-8' }
    )

    const res = await POST(req as unknown as NextRequest)

    expect(res.status).toBe(201)
    expect(quoteCreatePayloads()).toHaveLength(1)
  })

  it('rejects cross-origin submissions', async () => {
    const req = buildRequest(
      {
        name: 'Test',
        email: 'info@shed210.com',
        structureType: 'storage_shed',
        length: 10,
        width: 10,
      },
      {
        'content-type': 'application/json',
        origin: 'https://evil.example',
        host: 'www.shed210.com',
      }
    )

    const res = await POST(req as unknown as NextRequest)
    expect(res.status).toBe(403)
    expect(res.body).toEqual({ error: 'Forbidden origin' })
  })

  it('rejects browser-declared cross-site submissions without an Origin header', async () => {
    const req = buildRequest(
      {
        name: 'Test',
        email: 'info@shed210.com',
        phone: '(210) 772-3028',
        smsConsentOptIn: true,
        structureType: 'storage_shed',
        length: 10,
        width: 10,
      },
      {
        'content-type': 'application/json',
        'sec-fetch-site': 'cross-site',
      }
    )

    const res = await POST(req as unknown as NextRequest)

    expect(res.status).toBe(403)
    expect(quoteCreatePayloads()).toHaveLength(0)
  })

  it('rejects a filled honeypot without pricing or saving', async () => {
    const req = buildRequest(
      {
        name: 'Test',
        email: 'info@shed210.com',
        phone: '(210) 772-3028',
        website: 'https://spam.example',
        structureType: 'storage_shed',
        length: 10,
        width: 10,
      },
      jsonHeaders
    )

    const res = await POST(req as unknown as NextRequest)

    expect(res.status).toBe(400)
    expect(mockQuery).not.toHaveBeenCalled()
    expect(quoteCreatePayloads()).toHaveLength(0)
  })

  it('applies a shared session limit without exposing the session id', async () => {
    let rateLimitCheckCount = 0
    mockMutation.mockImplementation((_reference, args) => {
      if (args && typeof args === 'object' && 'keyHash' in args) {
        rateLimitCheckCount += 1
        return Promise.resolve(
          rateLimitCheckCount === 2
            ? { allowed: false, retryAfterSeconds: 120 }
            : { allowed: true, retryAfterSeconds: 0 }
        )
      }
      return Promise.resolve(null)
    })
    const sessionId = '00000000-0000-4000-8000-000000000001'
    const req = buildRequest(
      {
        session_id: sessionId,
        name: 'Test',
        email: 'info@shed210.com',
        phone: '(210) 772-3028',
        smsConsentOptIn: true,
        structureType: 'storage_shed',
        length: 10,
        width: 10,
      },
      jsonHeaders
    )

    const res = await POST(req as unknown as NextRequest)

    expect(res.status).toBe(429)
    expect(res.headers).toEqual({ 'Retry-After': '120' })
    expect(quoteRateLimitPayloads()).toHaveLength(2)
    expect(JSON.stringify(quoteRateLimitPayloads())).not.toContain(sessionId)
    expect(quoteCreatePayloads()).toHaveLength(0)
  })

  it("stops one address at its day limit, tells the customer to call, and reports it", async () => {
    mockMutation.mockImplementation((_reference, args) => {
      if (args && typeof args === 'object' && 'keyHash' in args) {
        return Promise.resolve(
          (args as { windowMs: number }).windowMs === 86_400_000
            ? { allowed: false, retryAfterSeconds: 3_600 }
            : { allowed: true, retryAfterSeconds: 0 }
        )
      }
      return Promise.resolve(null)
    })
    const req = buildRequest({
        name: 'Test',
        email: 'info@shed210.com',
        phone: '(210) 772-3028',
        smsConsentOptIn: true,
        structureType: 'storage_shed',
        length: 10,
        width: 10,
      }, {
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.10',
    })

    const res = await POST(req as unknown as NextRequest)

    expect(res.status).toBe(429)
    expect(res.headers).toEqual({ 'Retry-After': '3600' })
    expect(res.body).toEqual({
      error: `That's the most online quotes we can take from one connection in a day. Call or text us at ${PHONE_DISPLAY} and we'll price the rest with you.`,
    })
    expect(quoteCreatePayloads()).toHaveLength(0)
    expect(mockQuery).not.toHaveBeenCalled()

    const [minute, day] = quoteRateLimitPayloads()
    expect(day).toMatchObject({ tenantSlug: 'shed210', windowMs: 86_400_000, maxRequests: 12 })
    // Its own counter, and still no address in what is stored.
    expect(day.keyHash).toMatch(/^[a-f0-9]{64}$/)
    expect(day.keyHash).not.toBe(minute.keyHash)
    expect(JSON.stringify(day)).not.toContain('203.0.113.10')

    expect(mockCaptureException).toHaveBeenCalledTimes(1)
    const [reported, context] = mockCaptureException.mock.calls[0]
    expect(reported.message).toBe('Quote intake limit reached: visitor_day')
    expect(context).toMatchObject({
      level: 'warning',
      fingerprint: ['quote_intake', 'limit', 'visitor_day'],
      tags: { area: 'quote_intake', stage: 'limit', limit: 'visitor_day' },
    })
  })

  it('does not count a malformed request against the day limit', async () => {
    const req = buildRequest({ name: 'Test' }, jsonHeaders)

    const res = await POST(req as unknown as NextRequest)

    expect(res.status).toBe(400)
    expect(quoteRateLimitPayloads().map(({ windowMs }) => windowMs)).toEqual([60_000])
  })

  it('turns a failed day-limit check into the retryable 503', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    mockMutation.mockImplementation((_reference, args) => {
      if (args && typeof args === 'object' && 'keyHash' in args) {
        return (args as { windowMs: number }).windowMs === 86_400_000
          ? Promise.reject(new TypeError('fetch failed'))
          : Promise.resolve({ allowed: true, retryAfterSeconds: 0 })
      }
      return Promise.resolve(null)
    })
    const req = buildRequest({
        name: 'Test',
        email: 'info@shed210.com',
        phone: '(210) 772-3028',
        smsConsentOptIn: true,
        structureType: 'storage_shed',
        length: 10,
        width: 10,
      }, jsonHeaders)

    const res = await POST(req as unknown as NextRequest)

    expect(res.status).toBe(503)
    expect(res.body).toEqual(quoteSaveUnavailableBody)
    expect(quoteCreatePayloads()).toHaveLength(0)
    expect(consoleSpy).toHaveBeenCalledWith(
      'quote visitor day limit preflight failed',
      expect.any(TypeError)
    )
    expectQuoteIntakeReported('preflight')
    consoleSpy.mockRestore()
  })

  describe('bot check on submit', () => {
    // The limiter's counters by what they allow: [windowMs, maxRequests].
    const MINUTE = [60_000, 10]
    const ADDRESS_DAY = [86_400_000, 12]
    const UNCHECKED_ADDRESS_DAY = [86_400_000, 5]
    const UNCHECKED_SITE_DAY = [86_400_000, 20]
    const countersUsed = () =>
      quoteRateLimitPayloads().map(({ windowMs, maxRequests }) => [windowMs, maxRequests])

    function fullCounter(windowMs: number, maxRequests: number, retryAfterSeconds: number) {
      mockMutation.mockImplementation((_reference, args) => {
        if (args && typeof args === 'object' && 'keyHash' in args) {
          const counter = args as { windowMs: number; maxRequests: number }
          return Promise.resolve(
            counter.windowMs === windowMs && counter.maxRequests === maxRequests
              ? { allowed: false, retryAfterSeconds }
              : { allowed: true, retryAfterSeconds: 0 }
          )
        }
        return Promise.resolve(null)
      })
    }

    const submit = () =>
      POST(buildRequest({
        name: 'Test',
        email: 'info@shed210.com',
        phone: '(210) 772-3028',
        smsConsentOptIn: true,
        structureType: 'storage_shed',
        length: 10,
        width: 10,
        turnstileToken: 'token-from-the-browser',
      }, {
        'content-type': 'application/json',
        'x-forwarded-for': '203.0.113.10',
      }) as unknown as NextRequest)

    it('saves a quote that passed the check without touching the unchecked allowance', async () => {
      mockVerifyTurnstileToken.mockResolvedValue('passed')

      const res = await submit()

      expect(res.status).toBe(201)
      expect(mockVerifyTurnstileToken).toHaveBeenCalledWith({
        token: 'token-from-the-browser',
        action: 'quote_submit',
        remoteIp: '203.0.113.10',
      })
      expect(countersUsed()).toEqual([MINUTE, ADDRESS_DAY])
      // The token is spent by the check and never stored with the quote.
      expect(JSON.stringify(quoteCreatePayloads())).not.toContain('token-from-the-browser')
      expectNothingReported()
    })

    it.each(['failed', 'unavailable'] as const)(
      'still saves a quote whose check %s, counted against the unchecked allowance',
      async (verdict) => {
        mockVerifyTurnstileToken.mockResolvedValue(verdict)

        const res = await submit()

        expect(res.status).toBe(201)
        expect(quoteCreatePayloads()).toHaveLength(1)
        expect(countersUsed()).toEqual([
          MINUTE,
          ADDRESS_DAY,
          UNCHECKED_ADDRESS_DAY,
          UNCHECKED_SITE_DAY,
        ])
        // The address and the site are separate counters.
        const [, , address, site] = quoteRateLimitPayloads()
        expect(address.keyHash).not.toBe(site.keyHash)
        expectNothingReported()
      }
    )

    it("turns an unchecked quote away once the site's unchecked allowance is used up", async () => {
      mockVerifyTurnstileToken.mockResolvedValue('failed')
      fullCounter(86_400_000, 20, 5_400)

      const res = await submit()

      expect(res.status).toBe(429)
      expect(res.headers).toEqual({ 'Retry-After': '5400' })
      expect(res.body).toEqual({
        error: `We can't take online quotes right now. Call or text us at ${PHONE_DISPLAY} and we'll get you a price.`,
      })
      expect(quoteCreatePayloads()).toHaveLength(0)
      expect(mockCaptureException).toHaveBeenCalledTimes(1)
      expect(mockCaptureException.mock.calls[0][1]).toMatchObject({
        level: 'warning',
        fingerprint: ['quote_intake', 'limit', 'unchecked_site_day'],
      })
    })

    it("turns one address's sixth unchecked quote away without using the site's allowance", async () => {
      mockVerifyTurnstileToken.mockResolvedValue('failed')
      fullCounter(86_400_000, 5, 3_600)

      const res = await submit()

      expect(res.status).toBe(429)
      expect(res.body).toEqual({
        error: `That's the most online quotes we can take from one connection in a day. Call or text us at ${PHONE_DISPLAY} and we'll price the rest with you.`,
      })
      expect(countersUsed()).toEqual([MINUTE, ADDRESS_DAY, UNCHECKED_ADDRESS_DAY])
      expect(quoteCreatePayloads()).toHaveLength(0)
      expect(mockCaptureException.mock.calls[0][1]).toMatchObject({
        fingerprint: ['quote_intake', 'limit', 'unchecked_address_day'],
      })
    })

    it('does not spend the check on a malformed request', async () => {
      mockVerifyTurnstileToken.mockResolvedValue('passed')

      const res = await POST(
        buildRequest({ name: 'Test', turnstileToken: 'token-from-the-browser' }, jsonHeaders) as unknown as NextRequest
      )

      expect(res.status).toBe(400)
      expect(mockVerifyTurnstileToken).not.toHaveBeenCalled()
    })

    it('rejects a token too long to be one', async () => {
      const res = await POST(
        buildRequest(
          {
            name: 'Test',
            email: 'info@shed210.com',
            phone: '(210) 772-3028',
            smsConsentOptIn: true,
            structureType: 'storage_shed',
            length: 10,
            width: 10,
            turnstileToken: 'x'.repeat(2_049),
          },
          jsonHeaders
        ) as unknown as NextRequest
      )

      expect(res.status).toBe(400)
      expect(mockVerifyTurnstileToken).not.toHaveBeenCalled()
    })
  })

  it('blocks submissions when the shared Convex rate limiter denies the request', async () => {
    mockMutation.mockImplementation((_reference, args) =>
      Promise.resolve(
        args && typeof args === 'object' && 'keyHash' in args
          ? { allowed: false, retryAfterSeconds: 17 }
          : null
      )
    )
    const req = buildRequest(
      {
        name: 'Test',
        email: 'info@shed210.com',
        phone: '(210) 772-3028',
        smsConsentOptIn: true,
        structureType: 'storage_shed',
        length: 10,
        width: 10,
      },
      {
        'content-type': 'application/json',
        'x-forwarded-for': '203.0.113.10',
      }
    )

    const res = await POST(req as unknown as NextRequest)

    expect(res.status).toBe(429)
    expect(res.headers).toEqual({ 'Retry-After': '17' })
    expect(res.body).toEqual({
      error: 'Too many requests. Please try again shortly.',
    })
    expect(quoteCreatePayloads()).toHaveLength(0)
    expect(mockQuery).not.toHaveBeenCalled()
    const rateLimitPayload = quoteRateLimitPayloads()[0]
    expect(rateLimitPayload).toMatchObject({
      writeKey: 'test-write-key',
      tenantSlug: 'shed210',
      windowMs: 60_000,
      maxRequests: 10,
    })
    expect(rateLimitPayload.keyHash).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(rateLimitPayload)).not.toContain('203.0.113.10')
    expectNothingReported()
  })

  it('bounds the rate-limit preflight with an abortable fetch', async () => {
    const req = buildRequest(
      {
        name: 'Test',
        email: 'info@shed210.com',
        phone: '(210) 772-3028',
        smsConsentOptIn: true,
        structureType: 'storage_shed',
        length: 10,
        width: 10,
      },
      jsonHeaders
    )

    const res = await POST(req as unknown as NextRequest)

    expect(res.status).toBe(201)
    // The rate-limit client gets the timeout fetch; the quote save does not,
    // because aborting a committed create would duplicate the quote on retry.
    expect(mockConvexHttpClient).toHaveBeenCalledWith('https://test.convex.cloud', {
      fetch: expect.any(Function),
    })
    expect(mockConvexHttpClient).toHaveBeenLastCalledWith('https://test.convex.cloud')
  })

  it('turns a failed rate-limit preflight into a retryable 503 with the phone number', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    // Convex validation errors can echo call arguments, keys and contact details included.
    mockMutation.mockImplementation((_reference, args) =>
      args && typeof args === 'object' && 'keyHash' in args
        ? Promise.reject(
          new Error(
            'ArgumentValidationError: Object: {writeKey: "test-write-key", name: "Jordan Rivera", email: "jordan@example.com", phone: "+12107723028"}'
          )
        )
        : Promise.resolve(null)
    )
    const req = buildRequest(
      {
        name: 'Jordan Rivera',
        email: 'jordan@example.com',
        phone: '(210) 772-3028',
        smsConsentOptIn: true,
        structureType: 'storage_shed',
        length: 10,
        width: 10,
      },
      jsonHeaders
    )

    const res = await POST(req as unknown as NextRequest)

    expect(res.status).toBe(503)
    expect(res.headers).toEqual({ 'Retry-After': '60' })
    expect(res.body).toEqual(quoteSaveUnavailableBody)
    expect(mockQuery).not.toHaveBeenCalled()
    expect(quoteCreatePayloads()).toHaveLength(0)
    expect(consoleSpy).toHaveBeenCalledWith(
      'quote rate limit preflight failed',
      expect.any(Error)
    )
    expectQuoteIntakeReported('preflight', 'shed_convex')
    const reported = sentryReportText()
    for (const secretOrContact of [
      'test-write-key',
      'Jordan',
      'Rivera',
      'jordan@example.com',
      '2107723028',
      '772-3028',
    ]) {
      expect(reported).not.toContain(secretOrContact)
    }
    consoleSpy.mockRestore()
  })

  it('returns the same 503 when the quote write key is missing', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    delete process.env.CONVEX_QUOTE_WRITE_KEY
    try {
      const req = buildRequest(
        {
          name: 'Test',
          email: 'info@shed210.com',
          phone: '(210) 772-3028',
          smsConsentOptIn: true,
          structureType: 'storage_shed',
          length: 10,
          width: 10,
        },
        jsonHeaders
      )

      const res = await POST(req as unknown as NextRequest)

      expect(res.status).toBe(503)
      expect(res.headers).toEqual({ 'Retry-After': '60' })
      expect(res.body).toEqual(quoteSaveUnavailableBody)
      expect(mockMutation).not.toHaveBeenCalled()
      expectQuoteIntakeReported('preflight', 'shed_convex')
      expect(reportedReason()).toBe('config')
    } finally {
      process.env.CONVEX_QUOTE_WRITE_KEY = 'test-write-key'
      consoleSpy.mockRestore()
    }
  })

  it('turns a failed session preflight into the same retryable 503', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    let rateLimitCheckCount = 0
    mockMutation.mockImplementation((_reference, args) => {
      if (args && typeof args === 'object' && 'keyHash' in args) {
        rateLimitCheckCount += 1
        return rateLimitCheckCount === 2
          ? Promise.reject(new TypeError('fetch failed'))
          : Promise.resolve({ allowed: true, retryAfterSeconds: 0 })
      }
      return Promise.resolve(null)
    })
    const req = buildRequest(
      {
        session_id: '00000000-0000-4000-8000-000000000002',
        name: 'Test',
        email: 'info@shed210.com',
        phone: '(210) 772-3028',
        smsConsentOptIn: true,
        structureType: 'storage_shed',
        length: 10,
        width: 10,
      },
      jsonHeaders
    )

    const res = await POST(req as unknown as NextRequest)

    expect(res.status).toBe(503)
    expect(res.headers).toEqual({ 'Retry-After': '60' })
    expect(res.body).toEqual(quoteSaveUnavailableBody)
    expect(quoteRateLimitPayloads()).toHaveLength(2)
    expect(mockQuery).not.toHaveBeenCalled()
    expect(quoteCreatePayloads()).toHaveLength(0)
    expect(consoleSpy).toHaveBeenCalledWith(
      'quote session rate limit preflight failed',
      expect.any(TypeError)
    )
    expectQuoteIntakeReported('preflight', 'shed_convex')
    expect(mockCaptureException.mock.calls[0][1].tags.error_type).toBe('TypeError')
    expect(reportedReason()).toBe('network')
    consoleSpy.mockRestore()
  })

  it.each([
    ['timeout', new Error('Quote rate limit check timed out after 5000ms')],
    ['server_error', new Error('[Request ID: 0123456789abcdef] Server Error')],
    ['unauthorized', new Error('[Request ID: 0123456789abcdef] Server Error\nUncaught Error: Unauthorized quote write')],
    ['other', 'not an error'],
  ])('tags a %s preflight failure without forwarding its text', async (reason, failure) => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    mockMutation.mockImplementation((_reference, args) =>
      args && typeof args === 'object' && 'keyHash' in args
        ? Promise.reject(failure)
        : Promise.resolve(null)
    )
    const req = buildRequest(
      {
        name: 'Test',
        email: 'info@shed210.com',
        phone: '(210) 772-3028',
        smsConsentOptIn: true,
        structureType: 'storage_shed',
        length: 10,
        width: 10,
      },
      jsonHeaders
    )

    const res = await POST(req as unknown as NextRequest)

    expect(res.status).toBe(503)
    expect(quoteCreatePayloads()).toHaveLength(0)
    expectQuoteIntakeReported('preflight', 'shed_convex')
    expect(reportedReason()).toBe(reason)
    const reported = sentryReportText()
    expect(reported).not.toContain('Request ID')
    expect(reported).not.toContain('timed out')
    consoleSpy.mockRestore()
  })

  it('fails closed without saving when current pricing cannot be verified', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    mockQuery.mockRejectedValueOnce(new Error('pricing deployment unavailable'))
    const req = buildRequest(
      {
        name: 'Test',
        email: 'info@shed210.com',
        phone: '(210) 772-3028',
        smsConsentOptIn: true,
        structureType: 'storage_shed',
        length: 10,
        width: 12,
        roofStyle: 'barn',
      },
      jsonHeaders
    )

    const res = await POST(req as unknown as NextRequest)

    expect(res.status).toBe(503)
    expect(res.headers).toEqual({ 'Retry-After': '60' })
    expect(res.body).toEqual({
      error:
        `We could not verify the latest pricing. Please try again shortly or call or text us at ${PHONE_DISPLAY}.`,
    })
    expect(quoteCreatePayloads()).toHaveLength(0)
    expect(calcMock).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith(
      'quote pricing settings read failed',
      expect.any(Error)
    )
    expectQuoteIntakeReported('pricing', 'shed_convex')
    consoleSpy.mockRestore()
  })

  it('tags CRM pricing failures with the CRM provider', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    process.env.QUOTE_PRICING_SOURCE = 'frontier_pixel_crm'
    process.env.FRONTIER_PIXEL_CRM_CONVEX_URL =
      'https://youthful-horse-290.convex.cloud'
    process.env.FRONTIER_PIXEL_CRM_QUOTE_PRICING_KEY = 'crm-pricing-key'
    mockQuery.mockRejectedValueOnce(new Error('Unauthorized quote pricing read'))
    const req = buildRequest(
      {
        name: 'Test',
        email: 'info@shed210.com',
        phone: '(210) 772-3028',
        smsConsentOptIn: true,
        structureType: 'storage_shed',
        length: 10,
        width: 12,
      },
      jsonHeaders
    )

    const res = await POST(req as unknown as NextRequest)

    expect(res.status).toBe(503)
    expect(quoteCreatePayloads()).toHaveLength(0)
    expectQuoteIntakeReported('pricing', 'frontier_pixel_crm')
    expect(reportedReason()).toBe('unauthorized')
    expect(sentryReportText()).not.toContain('crm-pricing-key')
    consoleSpy.mockRestore()
  })

  it('keeps the CRM provider tag when the CRM pricing key is missing', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    process.env.QUOTE_PRICING_SOURCE = 'frontier_pixel_crm'
    process.env.FRONTIER_PIXEL_CRM_CONVEX_URL =
      'https://youthful-horse-290.convex.cloud'
    const req = buildRequest(
      {
        name: 'Test',
        email: 'info@shed210.com',
        phone: '(210) 772-3028',
        smsConsentOptIn: true,
        structureType: 'storage_shed',
        length: 10,
        width: 12,
      },
      jsonHeaders
    )

    const res = await POST(req as unknown as NextRequest)

    expect(res.status).toBe(503)
    expect(mockQuery).not.toHaveBeenCalled()
    expect(quoteCreatePayloads()).toHaveLength(0)
    expectQuoteIntakeReported('pricing', 'frontier_pixel_crm')
    expect(reportedReason()).toBe('config')
    consoleSpy.mockRestore()
  })

  describe('tenant slug selection', () => {
    afterEach(() => {
      delete process.env.QUOTE_TENANT_SLUG
    })

    const validBody = {
      name: 'Test',
      email: 'info@shed210.com',
      phone: '(210) 772-3028',
      smsConsentOptIn: true,
      structureType: 'storage_shed',
      length: 10,
      width: 10,
    }

    it('passes the default shed210 tenant slug downstream when QUOTE_TENANT_SLUG is unset', async () => {
      delete process.env.QUOTE_TENANT_SLUG
      const req = buildRequest(validBody, jsonHeaders)

      const res = await POST(req as unknown as NextRequest)

      expect(res.status).toBe(201)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          readKey: 'test-write-key',
          tenantSlug: 'shed210',
        })
      )
      const payload = latestQuoteCreatePayload()
      expect(payload.tenantSlug).toBe('shed210')
    })

    it('passes QUOTE_TENANT_SLUG to pricing reads and quote saves when set', async () => {
      process.env.QUOTE_TENANT_SLUG = 'tenant-b'
      const req = buildRequest(validBody, jsonHeaders)

      const res = await POST(req as unknown as NextRequest)

      expect(res.status).toBe(201)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          readKey: 'test-write-key',
          tenantSlug: 'tenant-b',
        })
      )
      const payload = latestQuoteCreatePayload()
      expect(payload.tenantSlug).toBe('tenant-b')
    })

    it('ignores tenant slugs sent in the client request body', async () => {
      delete process.env.QUOTE_TENANT_SLUG
      const req = buildRequest(
        { ...validBody, tenantSlug: 'evil-tenant' },
        jsonHeaders
      )

      const res = await POST(req as unknown as NextRequest)

      expect(res.status).toBe(201)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ tenantSlug: 'shed210' })
      )
      const payload = latestQuoteCreatePayload()
      expect(payload.tenantSlug).toBe('shed210')
      expect(payload.inputs).not.toHaveProperty('tenantSlug')
    })

    it('keeps tenantSlug out of the client-facing response', async () => {
      process.env.QUOTE_TENANT_SLUG = 'tenant-b'
      const req = buildRequest(validBody, jsonHeaders)

      const res = await POST(req as unknown as NextRequest)

      expect(res.status).toBe(201)
      const payload = latestQuoteCreatePayload()
      expect(res.body).toEqual({
        id: payload.publicId,
        total: 100,
        breakdown: mockBreakdown,
        estimate: mockEstimate,
      })
      expect(JSON.stringify(res.body)).not.toContain('tenant')
    })
  })

  it('does not leak backend insert errors and offers a call or text instead', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    mockMutation.mockImplementation((_reference, args) =>
      args && typeof args === 'object' && 'keyHash' in args
        ? Promise.resolve({ allowed: true, retryAfterSeconds: 0 })
        : Promise.reject(new Error('constraint details'))
    )
    const req = buildRequest(
      {
        name: 'Test',
        email: 'info@shed210.com',
        phone: '(210) 772-3028',
        smsConsentOptIn: true,
        structureType: 'storage_shed',
        length: 10,
        width: 10,
      },
      jsonHeaders
    )

    const res = await POST(req as unknown as NextRequest)
    expect(res.status).toBe(503)
    expect(res.headers).toEqual({ 'Retry-After': '60' })
    expect(res.body).toEqual(quoteSaveUnavailableBody)
    expect(consoleSpy).toHaveBeenCalledWith('quote insert failed', expect.any(Error))
    expectQuoteIntakeReported('insert', 'shed_convex')
    expect(reportedReason()).toBe('other')
    expect(sentryReportText()).not.toContain('constraint details')
    consoleSpy.mockRestore()
  })

  it('reports unexpected route errors without changing the 500 response', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    calcMock.mockImplementationOnce(() => {
      throw new Error('pricing table mismatch')
    })
    const req = buildRequest(
      {
        name: 'Test',
        email: 'info@shed210.com',
        phone: '(210) 772-3028',
        smsConsentOptIn: true,
        structureType: 'storage_shed',
        length: 10,
        width: 10,
      },
      jsonHeaders
    )

    const res = await POST(req as unknown as NextRequest)

    expect(res.status).toBe(500)
    expect(quoteCreatePayloads()).toHaveLength(0)
    expect(consoleSpy).toHaveBeenCalledWith('quote route error', expect.any(Error))
    expectQuoteIntakeReported('unexpected')
    expect(mockCaptureException.mock.calls[0][1].tags).not.toHaveProperty('provider')
    consoleSpy.mockRestore()
  })

  it('maps structured atomic backend quota rejections to a stable 429 response', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const quotaError = Object.assign(new Error('Convex mutation failed'), {
      data: {
        code: 'QUOTE_RATE_LIMITED',
        retryAfterSeconds: 3_421.2,
      },
    })
    mockMutation.mockImplementation((_reference, args) =>
      args && typeof args === 'object' && 'keyHash' in args
        ? Promise.resolve({ allowed: true, retryAfterSeconds: 0 })
        : Promise.reject(quotaError)
    )
    const req = buildRequest(
      {
        name: 'Test',
        email: 'info@shed210.com',
        phone: '(210) 772-3028',
        smsConsentOptIn: true,
        structureType: 'storage_shed',
        length: 10,
        width: 10,
      },
      jsonHeaders
    )

    const res = await POST(req as unknown as NextRequest)

    expect(res.status).toBe(429)
    expect(res.headers).toEqual({ 'Retry-After': '3422' })
    expect(res.body).toEqual({
      error: 'Too many requests. Please try again shortly.',
    })
    expect(consoleSpy).not.toHaveBeenCalled()
    expectNothingReported()
    consoleSpy.mockRestore()
  })

  it('tells the customer to call and reports it when the whole site is at its quota', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const quotaError = Object.assign(new Error('Convex mutation failed'), {
      data: {
        code: 'QUOTE_RATE_LIMITED',
        retryAfterSeconds: 7_200,
        siteWide: true,
      },
    })
    mockMutation.mockImplementation((_reference, args) =>
      args && typeof args === 'object' && 'keyHash' in args
        ? Promise.resolve({ allowed: true, retryAfterSeconds: 0 })
        : Promise.reject(quotaError)
    )
    const req = buildRequest({
        name: 'Test',
        email: 'info@shed210.com',
        phone: '(210) 772-3028',
        smsConsentOptIn: true,
        structureType: 'storage_shed',
        length: 10,
        width: 10,
      }, jsonHeaders)

    const res = await POST(req as unknown as NextRequest)

    expect(res.status).toBe(429)
    expect(res.headers).toEqual({ 'Retry-After': '7200' })
    expect(res.body).toEqual({
      error: `We can't take online quotes right now. Call or text us at ${PHONE_DISPLAY} and we'll get you a price.`,
    })
    expect(consoleSpy).not.toHaveBeenCalled()
    expect(mockCaptureException).toHaveBeenCalledTimes(1)
    expect(mockCaptureException.mock.calls[0][0].message).toBe(
      'Quote intake limit reached: site_quota'
    )
    expect(mockCaptureException.mock.calls[0][1]).toMatchObject({
      level: 'warning',
      fingerprint: ['quote_intake', 'limit', 'site_quota'],
    })
    consoleSpy.mockRestore()
  })
})
