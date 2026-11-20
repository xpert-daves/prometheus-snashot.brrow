import 'server-only';

import { ConvexHttpClient } from 'convex/browser';
import { z } from 'zod';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { QuotePricingConfig } from '@/lib/pricing/pricingData';

export type QuotePricingProvider =
  | 'shed_convex'
  | 'frontier_pixel_crm';

export type QuotePricingConfigMetadata = {
  provider: QuotePricingProvider;
  source: 'default' | 'table';
  settingsId: Id<'quotePricingSettings'> | null;
  pricingPublicationId: string | null;
  key: string;
  /**
   * Legacy overloaded value retained for compatibility: schema version for
   * Shed settings, publication revision for CRM. New audit code must use
   * pricingSchemaVersion and pricingPublicationVersion.
   */
  configVersion: number;
  pricingSchemaVersion: number;
  pricingPublicationVersion: number | null;
  updatedAt: number | null;
};

export type EffectiveQuotePricingSettings = QuotePricingConfigMetadata & {
  config: QuotePricingConfig;
  updatedByEmail: string | null;
};

type ConfiguredQuotePricingProvider = {
  provider: QuotePricingProvider;
  convexUrl: string;
  readKey: string;
  requirePublication: boolean;
};

export const FRONTIER_PIXEL_CRM_PRICING_DEPLOYMENT_URL =
  'https://youthful-horse-290.convex.cloud';
export const QUOTE_PRICING_READ_TIMEOUT_MS = 5_000;

const nonNegativeMoneySchema = z.number().finite().min(0).max(1_000_000);
const footprintPricingSchema = z.object({
  length: z.number().finite().int().min(1).max(100),
  width: z.number().finite().int().min(1).max(100),
  price: nonNegativeMoneySchema,
  roofStylePriceOverrides: z.object({
    barn: nonNegativeMoneySchema.optional(),
    leanTo: nonNegativeMoneySchema.optional(),
  }).strict().optional(),
}).strict();

const footprintPricingListSchema = z.array(footprintPricingSchema)
  .min(1)
  .max(100)
  .superRefine((footprints, context) => {
    const seen = new Set<string>();
    for (const [index, footprint] of footprints.entries()) {
      const key = [
        Math.min(footprint.length, footprint.width),
        Math.max(footprint.length, footprint.width),
      ].join('x');
      if (seen.has(key)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate footprint price for ${key}`,
          path: [index],
        });
      }
      seen.add(key);

      for (const [roofStyle, price] of Object.entries(
        footprint.roofStylePriceOverrides ?? {}
      )) {
        if (price < footprint.price) {
          context.addIssue({
            code: 'custom',
            message: `${roofStyle} roof price must not be below the gabled/base price`,
            path: [index, 'roofStylePriceOverrides', roofStyle],
          });
        }
      }
    }
  });

const pricingConfigSchema = z.object({
  version: z.literal(1),
  standardWallHeight: z.union([z.literal(6), z.literal(7)]),
  footprintBasePrices: footprintPricingListSchema,
  customFootprintPricePerSqft: z.number().finite().min(0).max(10_000),
  customFootprintPriceRounding: z.number().finite().min(1).max(10_000),
  wallHeightPriceAdjustmentPerSqft: z.number().finite().min(0).max(1_000),
  wallHeightPriceAdjustmentsPerSqft: z.object({
    six: z.number().finite().min(0).max(1_000),
    seven: z.number().finite().min(0).max(1_000),
    eight: z.number().finite().min(0).max(1_000),
  }).strict().optional(),
  roof: z.object({
    barnMultiplier: z.number().finite().min(0).max(5),
    barnPricePerSqft: z.number().finite().min(0).max(10_000).optional(),
    leanToFlatCost: nonNegativeMoneySchema,
  }).strict(),
  doors: z.object({
    single_shed: nonNegativeMoneySchema,
    double_shed: nonNegativeMoneySchema,
    garage_roll_up: nonNegativeMoneySchema,
    house: nonNegativeMoneySchema,
  }).strict(),
  windows: z.object({
    '24x36': nonNegativeMoneySchema,
  }).strict(),
  exteriorUpgrades: z.object({
    'Ground Anchoring': z.object({
      price: nonNegativeMoneySchema,
      mode: z.enum(['flat', 'per_sqft', 'per_linear_foot']),
    }).strict(),
    'Ramp (Single Door)': z.object({
      price: nonNegativeMoneySchema,
      mode: z.enum(['flat', 'per_sqft', 'per_linear_foot']),
    }).strict(),
    'Ramp (Double Door)': z.object({
      price: nonNegativeMoneySchema,
      mode: z.enum(['flat', 'per_sqft', 'per_linear_foot']),
    }).strict(),
    Steps: z.object({
      price: nonNegativeMoneySchema,
      mode: z.enum(['flat', 'per_sqft', 'per_linear_foot']),
    }).strict(),
    Skirting: z.object({
      price: nonNegativeMoneySchema,
      mode: z.enum(['flat', 'per_sqft', 'per_linear_foot']),
    }).strict(),
    '2-Tone': z.object({
      price: nonNegativeMoneySchema,
      mode: z.enum(['flat', 'per_sqft', 'per_linear_foot']),
    }).strict(),
    'Roof Overhang': z.object({
      price: nonNegativeMoneySchema,
      mode: z.enum(['flat', 'per_sqft', 'per_linear_foot']),
    }).strict(),
    'A/C Knock Out': z.object({
      price: nonNegativeMoneySchema,
      mode: z.enum(['flat', 'per_sqft', 'per_linear_foot']),
    }).strict(),
  }).strict(),
  delivery: z.object({
    includedServiceRadius: z.number().finite().min(0).max(10_000),
    ratePerMile: z.number().finite().min(0).max(10_000),
  }).strict(),
  discountCodes: z.record(
    z.string(),
    z.number().finite().min(0).max(1)
  ),
}).strict().superRefine((config, context) => {
  const explicitWallHeightPricing =
    config.wallHeightPriceAdjustmentsPerSqft;
  const explicitBarnPricing = config.roof.barnPricePerSqft;
  if (
    config.standardWallHeight === 6 &&
    (!explicitWallHeightPricing || explicitBarnPricing === undefined)
  ) {
    context.addIssue({
      code: 'custom',
      message:
        'Literal pricing requires a 6 ft base, an explicit wall-height map, and a barn floor-area surcharge',
      path: ['standardWallHeight'],
    });
  }
  if (
    config.standardWallHeight === 7 &&
    (explicitWallHeightPricing || explicitBarnPricing !== undefined)
  ) {
    context.addIssue({
      code: 'custom',
      message:
        'Legacy pricing requires a 7 ft base without explicit wall or barn floor-area fields',
      path: ['standardWallHeight'],
    });
  }
  if (explicitWallHeightPricing && explicitWallHeightPricing.six !== 0) {
    context.addIssue({
      code: 'custom',
      message: '6 ft wall-height surcharge must be 0 for the standard base',
      path: ['wallHeightPriceAdjustmentsPerSqft', 'six'],
    });
  }
});

const effectivePricingSettingsSchema = z.object({
  source: z.enum(['default', 'table']),
  settingsId: z.string().trim().min(1).max(128).nullable(),
  pricingPublicationId: z.string().trim().min(1).max(128).nullable(),
  key: z.literal('active'),
  config: pricingConfigSchema,
  configVersion: z.number().finite().int().positive(),
  updatedAt: z.number().finite().nullable(),
  updatedByEmail: z.string().trim().max(320).nullable(),
}).strict();

function getShedConvexQuotePricingReadKey(): string {
  const key =
    process.env.CONVEX_QUOTE_PRICING_READ_KEY?.trim() ||
    process.env.CONVEX_QUOTE_WRITE_KEY?.trim();
  if (!key) {
    throw new Error(
      'CONVEX_QUOTE_PRICING_READ_KEY or CONVEX_QUOTE_WRITE_KEY is not configured'
    );
  }
  return key;
}

function getShedConvexUrl(): string {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!url) {
    throw new Error('NEXT_PUBLIC_CONVEX_URL is not configured');
  }
  return url;
}

function getRequiredServerEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for CRM quote pricing`);
  }
  return value;
}

function getApprovedCrmConvexUrl(): string {
  const value = getRequiredServerEnv('FRONTIER_PIXEL_CRM_CONVEX_URL');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('FRONTIER_PIXEL_CRM_CONVEX_URL must be a valid URL');
  }

  const approved = new URL(FRONTIER_PIXEL_CRM_PRICING_DEPLOYMENT_URL);
  const hasOnlyOrigin =
    url.protocol === 'https:' &&
    url.hostname === approved.hostname &&
    url.port === '' &&
    url.username === '' &&
    url.password === '' &&
    (url.pathname === '' || url.pathname === '/') &&
    url.search === '' &&
    url.hash === '';

  if (!hasOnlyOrigin) {
    throw new Error(
      `FRONTIER_PIXEL_CRM_CONVEX_URL must exactly target ${FRONTIER_PIXEL_CRM_PRICING_DEPLOYMENT_URL}`
    );
  }

  return FRONTIER_PIXEL_CRM_PRICING_DEPLOYMENT_URL;
}

export function createQuotePricingFetch(
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
  timeoutMs = QUOTE_PRICING_READ_TIMEOUT_MS
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
        new Error(`Quote pricing read timed out after ${timeoutMs}ms`)
      );
    }, timeoutMs);

    try {
      return await fetchImpl(input, {
        ...init,
        redirect: 'error',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
      upstreamSignal?.removeEventListener('abort', abortFromUpstream);
    }
  };
}

export function getConfiguredQuotePricingProvider(): ConfiguredQuotePricingProvider {
  const configuredSource = process.env.QUOTE_PRICING_SOURCE?.trim();
  if (!configuredSource && process.env.NODE_ENV === 'production') {
    throw new Error('QUOTE_PRICING_SOURCE is required in production');
  }
  const source = configuredSource || 'shed_convex';

  if (source === 'shed_convex') {
    return {
      provider: 'shed_convex',
      convexUrl: getShedConvexUrl(),
      readKey: getShedConvexQuotePricingReadKey(),
      requirePublication: false,
    };
  }

  if (source === 'frontier_pixel_crm') {
    return {
      provider: 'frontier_pixel_crm',
      convexUrl: getApprovedCrmConvexUrl(),
      readKey: getRequiredServerEnv('FRONTIER_PIXEL_CRM_QUOTE_PRICING_KEY'),
      requirePublication: true,
    };
  }

  throw new Error(
    'QUOTE_PRICING_SOURCE must be shed_convex or frontier_pixel_crm'
  );
}

export async function readActiveQuotePricingSettingsForServer(
  tenantSlug?: string
): Promise<EffectiveQuotePricingSettings> {
  const provider = getConfiguredQuotePricingProvider();
  if (provider.requirePublication && !tenantSlug) {
    throw new Error('QUOTE_TENANT_SLUG is required for CRM quote pricing');
  }

  const convex = new ConvexHttpClient(
    provider.convexUrl,
    provider.provider === 'frontier_pixel_crm'
      ? { fetch: createQuotePricingFetch() }
      : undefined
  );
  const response = await convex.query(api.quotePricing.getActivePricingForQuoteRoute, {
    readKey: provider.readKey,
    ...(tenantSlug ? { tenantSlug } : {}),
  });
  const settings = effectivePricingSettingsSchema.parse(response);

  if (provider.requirePublication) {
    if (
      settings.source !== 'table' ||
      settings.settingsId !== null ||
      !settings.pricingPublicationId ||
      settings.updatedAt === null
    ) {
      throw new Error(
        'Frontier Pixel CRM did not return an active published pricing config'
      );
    }
  } else {
    const isVerifiedTable =
      settings.source === 'table' &&
      settings.settingsId !== null &&
      settings.pricingPublicationId === null &&
      settings.configVersion === settings.config.version;
    const isCleanLocalDefault =
      settings.source === 'default' &&
      settings.settingsId === null &&
      settings.pricingPublicationId === null &&
      settings.configVersion === settings.config.version &&
      settings.updatedAt === null &&
      settings.updatedByEmail === null;

    if (
      !isVerifiedTable &&
      !(process.env.NODE_ENV !== 'production' && isCleanLocalDefault)
    ) {
      throw new Error(
        'Shed Convex did not return a verified active pricing config'
      );
    }
  }

  return {
    ...settings,
    settingsId: settings.settingsId as Id<'quotePricingSettings'> | null,
    provider: provider.provider,
    pricingSchemaVersion: settings.config.version,
    pricingPublicationVersion:
      provider.provider === 'frontier_pixel_crm'
        ? settings.configVersion
        : null,
  };
}

export function buildQuotePricingConfigMetadata(
  settings: EffectiveQuotePricingSettings
): QuotePricingConfigMetadata {
  return {
    provider: settings.provider,
    source: settings.source,
    settingsId: settings.settingsId,
    pricingPublicationId: settings.pricingPublicationId,
    key: settings.key,
    configVersion: settings.configVersion,
    pricingSchemaVersion: settings.pricingSchemaVersion,
    pricingPublicationVersion: settings.pricingPublicationVersion,
    updatedAt: settings.updatedAt,
  };
}
