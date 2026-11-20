import type { NextRequest } from 'next/server'
import { calculateQuote } from '../../../../lib/pricing/calculateQuote'
import { DEFAULT_QUOTE_PRICING_CONFIG } from '../../../../lib/pricing/pricingData'
import { mapParsedQuoteToParams, validateQuoteRequest } from '../../../../lib/quoteRoute'

const mockQuery = jest.fn()
const mockMutation = jest.fn()
const mockConvexHttpClient = jest.fn(() => ({
  query: mockQuery,
  mutation: mockMutation,
}))

jest.mock('convex/browser', () => ({
  ConvexHttpClient: mockConvexHttpClient,
}))

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
      status: init?.status ?? 200,
      body: data,
      headers: init?.headers ?? {},
    }),
  },
}))

let POST: typeof import('../route').POST
beforeAll(async () => {
  process.env.CONVEX_QUOTE_WRITE_KEY = 'test-write-key'
  process.env.NEXT_PUBLIC_CONVEX_URL = 'https://test.convex.cloud'
  ;({ POST } = await import('../route'))
})

const basePayload = {
  structureType: 'storage_shed',
  length: 10,
  width: 10,
  deliveryRadius: 5,
  name: 'Valid Name',
  email: 'info@shed210.com',
  phone: '(210) 772-3028',
  smsUnifiedConsentOptIn: true,
}

function buildRequest(
  body: Record<string, unknown>,
  headers: Record<string, string> = { 'content-type': 'application/json' }
) {
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
  } as unknown as NextRequest
}

beforeEach(() => {
  mockQuery.mockClear()
  mockQuery.mockResolvedValue({
    source: 'default',
    settingsId: null,
    pricingPublicationId: null,
    key: 'active',
    config: DEFAULT_QUOTE_PRICING_CONFIG,
    configVersion: 1,
    updatedAt: null,
    updatedByEmail: null,
  })
  mockMutation.mockClear()
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

describe('quote validation max length', () => {
  it('rejects name over 255 characters', async () => {
    const req = buildRequest({ ...basePayload, name: 'a'.repeat(256) })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('rejects email over 255 characters', async () => {
    const longEmail = `${'a'.repeat(247)}@shed210.com`
    const req = buildRequest({ ...basePayload, email: longEmail })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('rejects phone over 255 characters', async () => {
    const req = buildRequest({ ...basePayload, phone: '1'.repeat(256) })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

describe('frameGauge parsing', () => {
  it('accepts gauge strings', async () => {
    const req = buildRequest({ ...basePayload, frameGauge: '14-ga' })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })
})

describe('security validation', () => {
  it('rejects unknown structure types', async () => {
    const req = buildRequest({ ...basePayload, structureType: 'warehouse' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('rejects oversized payload headers', async () => {
    const req = buildRequest(basePayload, {
      'content-type': 'application/json',
      'content-length': '40000',
    })
    const res = await POST(req)
    expect(res.status).toBe(413)
  })

  it('rejects an oversized streamed body when Content-Length is understated', async () => {
    const req = buildRequest(
      { ...basePayload, ignoredPadding: 'x'.repeat(33_000) },
      {
        'content-type': 'application/json',
        'content-length': '100',
      }
    )

    const res = await POST(req)

    expect(res.status).toBe(413)
    expect(quoteCreatePayloads()).toHaveLength(0)
  })

  it('rejects newline and bidirectional controls in human-entered fields', async () => {
    const newlineName = await POST(
      buildRequest({ ...basePayload, name: 'Alice\nPRICE: $1' })
    )
    expect(newlineName.status).toBe(400)

    const bidiAddress = await POST(
      buildRequest({
        ...basePayload,
        deliveryAddress: '123 Main St\u202Etxt.live',
      })
    )
    expect(bidiAddress.status).toBe(400)
    expect(quoteCreatePayloads()).toHaveLength(0)
  })
})

describe('pricing input validation', () => {
  it.each(['length', 'width'])(
    'rejects fractional %s values before saving a quote',
    async (dimension) => {
      const res = await POST(buildRequest({ ...basePayload, [dimension]: 10.5 }))
      expect(res.status).toBe(400)
      expect(quoteCreatePayloads()).toHaveLength(0)
    }
  )

  it.each([6, 40])('accepts whole-number dimensions at the %s foot boundary', async (dimension) => {
    const res = await POST(buildRequest({ ...basePayload, length: dimension, width: dimension }))
    expect(res.status).toBe(201)
  })

  it('accepts the 250 mile delivery maximum', async () => {
    const req = buildRequest({ ...basePayload, deliveryRadius: 250 })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('accepts an optional delivery address', async () => {
    const req = buildRequest({
      ...basePayload,
      deliveryAddress: '123 Test St, San Antonio, TX 78205',
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('rejects delivery over 250 miles', async () => {
    const req = buildRequest({ ...basePayload, deliveryRadius: 251 })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(quoteCreatePayloads()).toHaveLength(0)
  })

  it('rejects fractional delivery radius strings', async () => {
    const req = buildRequest({ ...basePayload, deliveryRadius: '10.5' })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(quoteCreatePayloads()).toHaveLength(0)
  })

  it('rejects lean-to spans over 16 feet', async () => {
    const req = buildRequest({ ...basePayload, roofStyle: 'lean-to', width: 17 })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(quoteCreatePayloads()).toHaveLength(0)
  })

  it('accepts lean-to spans at 16 feet', async () => {
    const req = buildRequest({ ...basePayload, roofStyle: 'lean-to', width: 16 })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('requires a window count when a window package is selected', async () => {
    const req = buildRequest({ ...basePayload, windowPackage: '24x36' })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(quoteCreatePayloads()).toHaveLength(0)
  })

  it('accepts the 20 window maximum', async () => {
    const res = await POST(buildRequest({ ...basePayload, windowPackage: '24x36', windowCount: 20 }))
    expect(res.status).toBe(201)
  })

  it('rejects window counts above 20 before saving a quote', async () => {
    const res = await POST(buildRequest({ ...basePayload, windowPackage: '24x36', windowCount: 21 }))
    expect(res.status).toBe(400)
    expect(quoteCreatePayloads()).toHaveLength(0)
  })

  it('rejects malformed window count strings instead of repairing them', async () => {
    const req = buildRequest({
      ...basePayload,
      windowPackage: '24x36',
      windowCount: '1.5',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(quoteCreatePayloads()).toHaveLength(0)
  })

  it('rejects unknown add-ons', async () => {
    const req = buildRequest({ ...basePayload, addOns: ['Mystery Upgrade'] })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(quoteCreatePayloads()).toHaveLength(0)
  })

  it('rejects duplicate add-ons', async () => {
    const req = buildRequest({
      ...basePayload,
      addOns: ['Ground Anchoring', 'Ground Anchoring'],
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(quoteCreatePayloads()).toHaveLength(0)
  })

  it('rejects ramp add-ons that do not match the selected door', async () => {
    const req = buildRequest({
      ...basePayload,
      door: 'double_shed',
      addOns: ['Ramp (Single Door)'],
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(quoteCreatePayloads()).toHaveLength(0)
  })

  it('rejects double-door ramp add-ons without a double shed door', async () => {
    const req = buildRequest({
      ...basePayload,
      door: 'single_shed',
      addOns: ['Ramp (Double Door)'],
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(quoteCreatePayloads()).toHaveLength(0)
  })

  it('accepts ramp add-ons that match the selected door', async () => {
    const singleReq = buildRequest({
      ...basePayload,
      door: 'single_shed',
      addOns: ['Ramp (Single Door)'],
    })
    const singleRes = await POST(singleReq)
    expect(singleRes.status).toBe(201)

    mockMutation.mockClear()
    const doubleReq = buildRequest({
      ...basePayload,
      door: 'double_shed',
      addOns: ['Ramp (Double Door)'],
    })
    const doubleRes = await POST(doubleReq)
    expect(doubleRes.status).toBe(201)
  })
})

describe('options the structure type does not offer', () => {
  const carportPayload = { ...basePayload, structureType: 'carport', length: 10, width: 8 }

  function parseQuote(payload: Record<string, unknown>) {
    const parsed = validateQuoteRequest(payload)
    if (!parsed.success) throw new Error(JSON.stringify(parsed.error.issues))
    return parsed.data
  }

  it('prices a carport sent with a leftover barn roof and windows as a plain carport', () => {
    const stale = parseQuote({
      ...carportPayload,
      roofStyle: 'barn',
      windowPackage: '24x36',
      windowCount: 4,
    })
    const clean = parseQuote({ ...carportPayload, roofStyle: 'gabled' })

    expect(stale).toMatchObject({ roofStyle: 'gabled', windowPackage: null, windowCount: null })
    expect(calculateQuote(mapParsedQuoteToParams(stale), DEFAULT_QUOTE_PRICING_CONFIG)).toEqual(
      calculateQuote(mapParsedQuoteToParams(clean), DEFAULT_QUOTE_PRICING_CONFIG)
    )
  })

  it('saves the carport without the hidden roof style and windows', async () => {
    const res = await POST(
      buildRequest({
        ...carportPayload,
        roofStyle: 'barn',
        windowPackage: '24x36',
        windowCount: 4,
      })
    )

    expect(res.status).toBe(201)
    const [saved] = quoteCreatePayloads()
    expect(saved.inputs).toMatchObject({ structureType: 'carport', roofStyle: 'gabled' })
    expect(saved.inputs).not.toHaveProperty('windowPackage')
    expect(saved.inputs).not.toHaveProperty('windowCount')
    expect(saved.inputs.visualPlacement.windows).toEqual([])
    expect(saved.pricing.breakdown).toMatchObject({ roof: 0, windows: 0 })
  })

  it('keeps greenhouse windows but drops the hidden barn roof', () => {
    const parsed = parseQuote({
      ...basePayload,
      structureType: 'greenhouse',
      roofStyle: 'barn',
      windowPackage: '24x36',
      windowCount: 4,
    })

    expect(parsed).toMatchObject({ roofStyle: 'gabled', windowPackage: '24x36', windowCount: 4 })
  })

  it.each(['greenhouse', 'carport', 'well_pump', 'open_loafing'])(
    'saves and prices a %s sent with a leftover barn roof as gabled',
    async (structureType) => {
      const res = await POST(buildRequest({ ...basePayload, structureType, roofStyle: 'barn' }))

      expect(res.status).toBe(201)
      const [saved] = quoteCreatePayloads()
      expect(saved.inputs).toMatchObject({ structureType, roofStyle: 'gabled' })
      expect(saved.pricing.breakdown).toMatchObject({ roof: 0 })
    }
  )

  it.each(['greenhouse', 'carport', 'well_pump', 'open_loafing'])(
    'accepts a %s wider than the lean-to span when a lean-to roof is left over',
    async (structureType) => {
      const res = await POST(
        buildRequest({ ...basePayload, structureType, roofStyle: 'lean-to', length: 20, width: 20 })
      )

      expect(res.status).toBe(201)
      const [saved] = quoteCreatePayloads()
      expect(saved.inputs).toMatchObject({ width: 20, roofStyle: 'gabled' })
      expect(saved.pricing.breakdown).toMatchObject({ roof: 0 })
    }
  )

  it('still rejects a lean-to storage shed wider than the lean-to span', async () => {
    const res = await POST(buildRequest({ ...basePayload, roofStyle: 'lean-to', width: 20 }))

    expect(res.status).toBe(400)
    expect(quoteCreatePayloads()).toHaveLength(0)
  })

  it('resets ventilation outside greenhouses and well pump houses', () => {
    expect(parseQuote({ ...basePayload, ventilation: true }).ventilation).toBe(false)
    expect(
      parseQuote({ ...basePayload, structureType: 'well_pump', ventilation: true }).ventilation
    ).toBe(true)
  })

  it.each([
    ['an unknown roof style', { roofStyle: 'mansard' }],
    ['too many windows', { windowPackage: '24x36', windowCount: 21 }],
    ['a malformed window count', { windowPackage: '24x36', windowCount: '1.5' }],
  ])('still rejects %s on a type that hides the option', async (_label, options) => {
    const res = await POST(buildRequest({ ...carportPayload, ...options }))

    expect(res.status).toBe(400)
    expect(quoteCreatePayloads()).toHaveLength(0)
  })
})
