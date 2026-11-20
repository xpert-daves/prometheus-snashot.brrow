const mockQuery = jest.fn();
const mockConvexHttpClient = jest.fn(() => ({
  query: mockQuery,
}));

jest.mock('convex/browser', () => ({
  ConvexHttpClient: mockConvexHttpClient,
}));

import { DEFAULT_QUOTE_PRICING_CONFIG } from '../pricing/pricingData';

let createQuotePricingFetch: typeof import('../quotePricingSettings').createQuotePricingFetch;
let getConfiguredQuotePricingProvider: typeof import('../quotePricingSettings').getConfiguredQuotePricingProvider;
let readActiveQuotePricingSettingsForServer: typeof import('../quotePricingSettings').readActiveQuotePricingSettingsForServer;
let crmPricingUrl: typeof import('../quotePricingSettings').FRONTIER_PIXEL_CRM_PRICING_DEPLOYMENT_URL;

const publishedSettings = {
  source: 'table',
  settingsId: null,
  pricingPublicationId: 'pricing-publication-3',
  key: 'active',
  config: DEFAULT_QUOTE_PRICING_CONFIG,
  configVersion: 3,
  updatedAt: 1_785_000_000_000,
  updatedByEmail: 'owner@example.com',
} as const;

const PRICING_ENV_NAMES = [
  'QUOTE_PRICING_SOURCE',
  'NEXT_PUBLIC_CONVEX_URL',
  'CONVEX_QUOTE_PRICING_READ_KEY',
  'CONVEX_QUOTE_WRITE_KEY',
  'FRONTIER_PIXEL_CRM_CONVEX_URL',
  'FRONTIER_PIXEL_CRM_QUOTE_PRICING_KEY',
] as const;

describe('quote pricing settings provider', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const mutableEnv = process.env as Record<string, string | undefined>;

  beforeAll(async () => {
    ({
      createQuotePricingFetch,
      getConfiguredQuotePricingProvider,
      readActiveQuotePricingSettingsForServer,
      FRONTIER_PIXEL_CRM_PRICING_DEPLOYMENT_URL: crmPricingUrl,
    } = await import('../quotePricingSettings'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    for (const name of PRICING_ENV_NAMES) delete process.env[name];
    mutableEnv.NODE_ENV = 'test';
  });

  afterAll(() => {
    for (const name of PRICING_ENV_NAMES) delete process.env[name];
    mutableEnv.NODE_ENV = originalNodeEnv;
  });

  function configureShedPricing() {
    process.env.QUOTE_PRICING_SOURCE = 'shed_convex';
    process.env.NEXT_PUBLIC_CONVEX_URL = 'https://test.convex.cloud';
    process.env.CONVEX_QUOTE_WRITE_KEY = 'shed-read-key';
  }

  function configureCrmPricing() {
    process.env.QUOTE_PRICING_SOURCE = 'frontier_pixel_crm';
    process.env.FRONTIER_PIXEL_CRM_CONVEX_URL = crmPricingUrl;
    process.env.FRONTIER_PIXEL_CRM_QUOTE_PRICING_KEY = 'crm-pricing-key';
  }

  it('uses the Shed Convex deployment when explicitly selected', async () => {
    configureShedPricing();
    mockQuery.mockResolvedValue({
      ...publishedSettings,
      settingsId: 'quote-pricing-settings-1',
      pricingPublicationId: null,
      configVersion: 1,
    });

    const settings = await readActiveQuotePricingSettingsForServer('shed210');

    expect(mockConvexHttpClient).toHaveBeenCalledWith(
      'https://test.convex.cloud',
      undefined
    );
    expect(mockQuery).toHaveBeenCalledWith(expect.anything(), {
      tenantSlug: 'shed210',
      readKey: 'shed-read-key',
    });
    expect(settings).toMatchObject({
      provider: 'shed_convex',
      pricingSchemaVersion: 1,
      pricingPublicationVersion: null,
    });
  });

  it('prefers the dedicated Shed pricing read key over the write key', async () => {
    configureShedPricing();
    process.env.CONVEX_QUOTE_PRICING_READ_KEY = 'dedicated-read-key';
    mockQuery.mockResolvedValue({
      ...publishedSettings,
      settingsId: 'quote-pricing-settings-1',
      pricingPublicationId: null,
      configVersion: 1,
    });

    await readActiveQuotePricingSettingsForServer('shed210');

    expect(mockQuery).toHaveBeenCalledWith(expect.anything(), {
      tenantSlug: 'shed210',
      readKey: 'dedicated-read-key',
    });
  });

  it('requires an explicit pricing source in production', () => {
    mutableEnv.NODE_ENV = 'production';

    expect(() => getConfiguredQuotePricingProvider()).toThrow(
      'QUOTE_PRICING_SOURCE is required in production'
    );
    expect(mockConvexHttpClient).not.toHaveBeenCalled();
  });

  it('rejects a default Shed pricing row in production', async () => {
    configureShedPricing();
    mutableEnv.NODE_ENV = 'production';
    mockQuery.mockResolvedValue({
      ...publishedSettings,
      source: 'default',
      settingsId: null,
      pricingPublicationId: null,
      configVersion: 1,
      updatedAt: null,
      updatedByEmail: null,
    });

    await expect(
      readActiveQuotePricingSettingsForServer('shed210')
    ).rejects.toThrow('verified active pricing config');
  });

  it('rejects ambiguous publication metadata from the Shed provider', async () => {
    configureShedPricing();
    mockQuery.mockResolvedValue({
      ...publishedSettings,
      settingsId: 'quote-pricing-settings-1',
      pricingPublicationId: 'foreign-publication-id',
      configVersion: 1,
    });

    await expect(
      readActiveQuotePricingSettingsForServer('shed210')
    ).rejects.toThrow('verified active pricing config');
  });

  it('uses only an active CRM publication from the approved deployment', async () => {
    configureCrmPricing();
    mockQuery.mockResolvedValue(publishedSettings);

    const settings = await readActiveQuotePricingSettingsForServer('shed210');

    expect(mockConvexHttpClient).toHaveBeenCalledWith(
      crmPricingUrl,
      expect.objectContaining({ fetch: expect.any(Function) })
    );
    expect(mockQuery).toHaveBeenCalledWith(expect.anything(), {
      tenantSlug: 'shed210',
      readKey: 'crm-pricing-key',
    });
    expect(settings).toMatchObject({
      provider: 'frontier_pixel_crm',
      pricingPublicationId: 'pricing-publication-3',
      configVersion: 3,
      pricingSchemaVersion: 1,
      pricingPublicationVersion: 3,
    });
  });

  it('accepts a legacy 7-ft/multiplier CRM publication', async () => {
    configureCrmPricing();
    const legacyConfig = JSON.parse(
      JSON.stringify(DEFAULT_QUOTE_PRICING_CONFIG)
    ) as typeof DEFAULT_QUOTE_PRICING_CONFIG;
    legacyConfig.standardWallHeight = 7;
    delete legacyConfig.wallHeightPriceAdjustmentsPerSqft;
    delete legacyConfig.roof.barnPricePerSqft;
    mockQuery.mockResolvedValue({
      ...publishedSettings,
      config: legacyConfig,
    });

    const settings = await readActiveQuotePricingSettingsForServer('shed210');

    expect(settings.config.standardWallHeight).toBe(7);
    expect(settings.config.wallHeightPriceAdjustmentsPerSqft).toBeUndefined();
    expect(settings.config.roof.barnPricePerSqft).toBeUndefined();
  });

  it('rejects a 6-ft publication without its explicit height map', async () => {
    configureCrmPricing();
    const invalidConfig = JSON.parse(
      JSON.stringify(DEFAULT_QUOTE_PRICING_CONFIG)
    ) as typeof DEFAULT_QUOTE_PRICING_CONFIG;
    delete invalidConfig.wallHeightPriceAdjustmentsPerSqft;
    mockQuery.mockResolvedValue({
      ...publishedSettings,
      config: invalidConfig,
    });

    await expect(
      readActiveQuotePricingSettingsForServer('shed210')
    ).rejects.toThrow('Literal pricing requires a 6 ft base');
  });

  it('rejects a 6-ft publication without barn floor-area pricing', async () => {
    configureCrmPricing();
    const invalidConfig = JSON.parse(
      JSON.stringify(DEFAULT_QUOTE_PRICING_CONFIG)
    ) as typeof DEFAULT_QUOTE_PRICING_CONFIG;
    delete invalidConfig.roof.barnPricePerSqft;
    mockQuery.mockResolvedValue({
      ...publishedSettings,
      config: invalidConfig,
    });

    await expect(
      readActiveQuotePricingSettingsForServer('shed210')
    ).rejects.toThrow('Literal pricing requires a 6 ft base');
  });

  it('rejects explicit barn pricing in a legacy 7-ft publication', async () => {
    configureCrmPricing();
    const invalidConfig = JSON.parse(
      JSON.stringify(DEFAULT_QUOTE_PRICING_CONFIG)
    ) as typeof DEFAULT_QUOTE_PRICING_CONFIG;
    invalidConfig.standardWallHeight = 7;
    delete invalidConfig.wallHeightPriceAdjustmentsPerSqft;
    mockQuery.mockResolvedValue({
      ...publishedSettings,
      config: invalidConfig,
    });

    await expect(
      readActiveQuotePricingSettingsForServer('shed210')
    ).rejects.toThrow('Legacy pricing requires a 7 ft base');
  });

  it.each([
    'http://youthful-horse-290.convex.cloud',
    'https://attacker-999.convex.cloud',
    'https://youthful-horse-290.convex.cloud.evil.example',
    'https://user:pass@youthful-horse-290.convex.cloud',
    'https://youthful-horse-290.convex.cloud:444',
    'https://youthful-horse-290.convex.cloud/api/query',
    'https://youthful-horse-290.convex.cloud?next=evil',
  ])('rejects an unapproved CRM URL before exposing the key: %s', (url) => {
    process.env.QUOTE_PRICING_SOURCE = 'frontier_pixel_crm';
    process.env.FRONTIER_PIXEL_CRM_CONVEX_URL = url;
    process.env.FRONTIER_PIXEL_CRM_QUOTE_PRICING_KEY = 'crm-pricing-key';

    expect(() => getConfiguredQuotePricingProvider()).toThrow(
      'must exactly target'
    );
    expect(mockConvexHttpClient).not.toHaveBeenCalled();
  });

  it('rejects a CRM response that falls back to legacy settings', async () => {
    configureCrmPricing();
    mockQuery.mockResolvedValue({
      ...publishedSettings,
      pricingPublicationId: null,
    });

    await expect(
      readActiveQuotePricingSettingsForServer('shed210')
    ).rejects.toThrow('active published pricing config');
  });

  it('rejects a CRM response with a settings-row id', async () => {
    configureCrmPricing();
    mockQuery.mockResolvedValue({
      ...publishedSettings,
      settingsId: 'legacy-settings-row',
    });

    await expect(
      readActiveQuotePricingSettingsForServer('shed210')
    ).rejects.toThrow('active published pricing config');
  });

  it('rejects malformed or unsupported CRM pricing at runtime', async () => {
    configureCrmPricing();
    mockQuery.mockResolvedValue({
      ...publishedSettings,
      config: {
        ...DEFAULT_QUOTE_PRICING_CONFIG,
        version: 2,
      },
    });

    await expect(
      readActiveQuotePricingSettingsForServer('shed210')
    ).rejects.toThrow();
  });

  it('requires a tenant slug for CRM pricing reads', async () => {
    configureCrmPricing();

    await expect(
      readActiveQuotePricingSettingsForServer()
    ).rejects.toThrow('QUOTE_TENANT_SLUG is required');
    expect(mockConvexHttpClient).not.toHaveBeenCalled();
  });

  it('aborts a stalled CRM read after the configured timeout', async () => {
    jest.useFakeTimers();
    try {
      const stalledFetch = jest.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              'abort',
              () => reject(init.signal?.reason),
              { once: true }
            );
          })
      );
      const timedFetch = createQuotePricingFetch(stalledFetch, 25);
      const request = timedFetch('https://example.test');
      const rejection = expect(request).rejects.toThrow(
        'Quote pricing read timed out after 25ms'
      );

      await jest.advanceTimersByTimeAsync(25);
      await rejection;
      expect(stalledFetch).toHaveBeenCalledWith(
        'https://example.test',
        expect.objectContaining({
          redirect: 'error',
          signal: expect.any(AbortSignal),
        })
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects incomplete CRM configuration before making a request', () => {
    process.env.QUOTE_PRICING_SOURCE = 'frontier_pixel_crm';
    process.env.FRONTIER_PIXEL_CRM_CONVEX_URL = crmPricingUrl;

    expect(() => getConfiguredQuotePricingProvider()).toThrow(
      'FRONTIER_PIXEL_CRM_QUOTE_PRICING_KEY'
    );
    expect(mockConvexHttpClient).not.toHaveBeenCalled();
  });

  it('rejects unknown pricing sources', () => {
    process.env.QUOTE_PRICING_SOURCE = 'automatic';

    expect(() => getConfiguredQuotePricingProvider()).toThrow(
      'QUOTE_PRICING_SOURCE must be shed_convex or frontier_pixel_crm'
    );
  });
});
