const mockMutation = jest.fn();
const mockConvexHttpClient = jest.fn(() => ({
  mutation: mockMutation,
}));

jest.mock('convex/browser', () => ({
  ConvexHttpClient: mockConvexHttpClient,
}));

import type { QuoteRecord } from '../quotePersistence';
import { QUOTE_VISUAL_DEFAULTS_VERSION } from '../quoteVisualPlacement';

const smsConsent = {
  status: 'not_opted_in' as const,
  source: 'website_quote_form' as const,
  consentText: null,
  consentTextVersion: null,
  pageUrl: null,
  ipAddress: null,
  userAgent: null,
  recordedAt: 1_714_000_000_000,
};

describe('saveQuote', () => {
  const env = process.env;

  beforeAll(() => {
    process.env = {
      ...env,
      CONVEX_QUOTE_WRITE_KEY: 'test-write-key',
      NEXT_PUBLIC_CONVEX_URL: 'https://test.convex.cloud',
    };
  });

  afterAll(() => {
    process.env = env;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockMutation.mockResolvedValue(null);
  });

  it('stores quote in Convex', async () => {
    const { saveQuote } = await import('../quotePersistence');
    const data: QuoteRecord = {
      name: 'Test',
      email: 'info@shed210.com',
      structureType: 'storage_shed',
      length: 10,
      width: 10,
      roofStyle: 'gabled',
      door: 'single_shed',
      windowPackage: '24x36',
      windowCount: 2,
      deliveryAddress: '123 Test St, San Antonio, TX 78205',
      deliveryRadius: 5,
      sessionId: 'abc123',
      smsConsent,
      total: 100,
      deliveryPricingStatus: 'pending_verification',
      breakdown: {
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
      },
    };

    const result = await saveQuote(data);

    expect(mockConvexHttpClient).toHaveBeenCalledWith('https://test.convex.cloud');
    expect(mockMutation).toHaveBeenCalledTimes(1);
    const payload = mockMutation.mock.calls[0][1];
    expect(payload).toEqual(
      expect.objectContaining({
        publicId: expect.any(String),
        writeKey: 'test-write-key',
        sessionId: 'abc123',
        contact: {
          name: 'Test',
          email: 'info@shed210.com',
          phone: null,
        },
        smsConsent,
        inputs: expect.objectContaining({
          structureType: 'storage_shed',
          length: 10,
          width: 10,
          roofStyle: 'gabled',
          door: 'single_shed',
          windowPackage: '24x36',
          windowCount: 2,
          addOns: [],
          deliveryAddress: '123 Test St, San Antonio, TX 78205',
          deliveryRadius: 5,
          visualPlacement: expect.objectContaining({
            version: 1,
            defaultsVersion: QUOTE_VISUAL_DEFAULTS_VERSION,
            customized: false,
            doors: [
              expect.objectContaining({
                id: 'door-default-single_shed',
                side: 'front',
                placement: 'default',
              }),
            ],
            windows: [
              expect.objectContaining({
                id: 'window-default-1',
                side: 'right',
                placement: 'default',
              }),
              expect.objectContaining({
                id: 'window-default-2',
                side: 'left',
                placement: 'default',
              }),
            ],
          }),
        }),
        pricing: {
          total: 100,
          breakdown: data.breakdown,
          deliveryPricingStatus: 'pending_verification',
        },
      })
    );
    expect(result).toEqual({ id: payload.publicId, session_id: 'abc123' });
  });

  it('forwards tenantSlug to the Convex mutation when provided', async () => {
    const { saveQuote } = await import('../quotePersistence');
    const data: QuoteRecord = {
      name: 'Test',
      email: 'info@shed210.com',
      structureType: 'storage_shed',
      length: 10,
      width: 10,
      deliveryRadius: 5,
      sessionId: 'abc123',
      smsConsent,
      total: 100,
      breakdown: {
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
      },
      tenantSlug: 'tenant-b',
    };

    await saveQuote(data);

    expect(mockMutation).toHaveBeenCalledTimes(1);
    const payload = mockMutation.mock.calls[0][1];
    expect(payload.tenantSlug).toBe('tenant-b');
    expect(payload.inputs).not.toHaveProperty('tenantSlug');
  });

  it('omits tenantSlug from the Convex mutation when not provided', async () => {
    const { saveQuote } = await import('../quotePersistence');
    const data: QuoteRecord = {
      name: 'Test',
      email: 'info@shed210.com',
      structureType: 'storage_shed',
      length: 10,
      width: 10,
      deliveryRadius: 5,
      sessionId: 'abc123',
      smsConsent,
      total: 100,
      breakdown: {
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
      },
    };

    await saveQuote(data);

    expect(mockMutation).toHaveBeenCalledTimes(1);
    const payload = mockMutation.mock.calls[0][1];
    expect(payload).not.toHaveProperty('tenantSlug');
  });

  it('throws on Convex mutation error', async () => {
    mockMutation.mockRejectedValueOnce(new Error('boom'));
    const { saveQuote } = await import('../quotePersistence');
    const data: QuoteRecord = {
      name: 'Test',
      email: 'info@shed210.com',
      structureType: 'storage_shed',
      length: 10,
      width: 10,
      deliveryRadius: 5,
      sessionId: 'abc123',
      smsConsent,
      total: 100,
      breakdown: {
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
      },
    };

    await expect(saveQuote(data)).rejects.toThrow('boom');
    expect(mockMutation).toHaveBeenCalledTimes(1);
  });
});
