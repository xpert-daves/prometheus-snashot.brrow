import { query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import {
  getShed210TenantIdForExistingWrite,
  setActiveTenantContextBySlug,
} from "./platformTenancy";
import { quotePricingConfigValidator } from "./validators";
import { isQuotePricingReadKeyAuthorized } from "./quoteAccess";

const SETTINGS_KEY = "active";
const tenantSlugArg = { tenantSlug: v.optional(v.string()) };

const DOOR_KEYS = ["single_shed", "double_shed", "garage_roll_up", "house"] as const;
const WINDOW_KEYS = ["24x36"] as const;
const EXTERIOR_UPGRADE_KEYS = [
  "Ground Anchoring",
  "Ramp (Single Door)",
  "Ramp (Double Door)",
  "Steps",
  "Skirting",
  "2-Tone",
  "Roof Overhang",
  "A/C Knock Out",
] as const;

type ExteriorUpgradePricingMode = "flat" | "per_sqft" | "per_linear_foot";
export type QuotePricingConfig = {
  version: 1;
  standardWallHeight: 6 | 7;
  footprintBasePrices: Array<{
    length: number;
    width: number;
    price: number;
    roofStylePriceOverrides?: {
      barn?: number;
      leanTo?: number;
    };
  }>;
  customFootprintPricePerSqft: number;
  customFootprintPriceRounding: number;
  wallHeightPriceAdjustmentPerSqft: number;
  wallHeightPriceAdjustmentsPerSqft?: {
    six: number;
    seven: number;
    eight: number;
  };
  roof: {
    barnMultiplier: number;
    barnPricePerSqft?: number;
    leanToFlatCost: number;
  };
  doors: Record<string, number>;
  windows: Record<string, number>;
  exteriorUpgrades: Record<string, { price: number; mode: ExteriorUpgradePricingMode }>;
  delivery: {
    includedServiceRadius: number;
    ratePerMile: number;
  };
  discountCodes: Record<string, number>;
};

type EffectivePricingSettings = {
  source: "default" | "table";
  settingsId: Id<"quotePricingSettings"> | null;
  pricingPublicationId: string | null;
  key: string;
  config: QuotePricingConfig;
  configVersion: number;
  updatedAt: number | null;
  updatedByEmail: string | null;
};

export const DEFAULT_QUOTE_PRICING_CONFIG: QuotePricingConfig = {
  version: 1,
  standardWallHeight: 6,
  footprintBasePrices: [
    { length: 6, width: 6, price: 1600 },
    { length: 8, width: 6, price: 1900 },
    { length: 8, width: 8, price: 2100 },
    { length: 10, width: 8, price: 2400 },
    { length: 10, width: 10, price: 2700 },
    { length: 12, width: 10, price: 3000 },
    { length: 12, width: 12, price: 3400 },
    { length: 14, width: 12, price: 3800 },
    { length: 14, width: 14, price: 4200 },
    { length: 16, width: 14, price: 4500 },
    { length: 16, width: 16, price: 4900 },
  ],
  customFootprintPricePerSqft: 15,
  customFootprintPriceRounding: 100,
  wallHeightPriceAdjustmentPerSqft: 4,
  wallHeightPriceAdjustmentsPerSqft: {
    six: 0,
    seven: 3,
    eight: 6,
  },
  roof: {
    barnMultiplier: 1.1,
    barnPricePerSqft: 4.5,
    leanToFlatCost: 360,
  },
  doors: {
    single_shed: 0,
    double_shed: 185,
    garage_roll_up: 750,
    house: 375,
  },
  windows: {
    "24x36": 200,
  },
  exteriorUpgrades: {
    "Ground Anchoring": { price: 350, mode: "flat" },
    "Ramp (Single Door)": { price: 195, mode: "flat" },
    "Ramp (Double Door)": { price: 249, mode: "flat" },
    Steps: { price: 85, mode: "flat" },
    Skirting: { price: 8.5, mode: "per_linear_foot" },
    "2-Tone": { price: 165, mode: "flat" },
    "Roof Overhang": { price: 95, mode: "flat" },
    "A/C Knock Out": { price: 65, mode: "flat" },
  },
  delivery: {
    includedServiceRadius: 35,
    ratePerMile: 1.5,
  },
  discountCodes: {
    SUMMER10: 0.1,
  },
};

const effectivePricingSettingsValidator = v.object({
  source: v.union(v.literal("default"), v.literal("table")),
  settingsId: v.union(v.id("quotePricingSettings"), v.null()),
  pricingPublicationId: v.union(v.string(), v.null()),
  key: v.string(),
  config: quotePricingConfigValidator,
  configVersion: v.number(),
  updatedAt: v.union(v.number(), v.null()),
  updatedByEmail: v.union(v.string(), v.null()),
});

function assertFiniteNumber(
  label: string,
  value: number,
  options: { min?: number; max?: number; integer?: boolean } = {}
) {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  if (options.integer && !Number.isInteger(value)) {
    throw new Error(`${label} must be a whole number`);
  }
  if (options.min !== undefined && value < options.min) {
    throw new Error(`${label} must be at least ${options.min}`);
  }
  if (options.max !== undefined && value > options.max) {
    throw new Error(`${label} must be at most ${options.max}`);
  }
}

function assertExactKeys(
  label: string,
  record: Record<string, unknown>,
  expectedKeys: readonly string[]
) {
  const actual = Object.keys(record).sort();
  const expected = [...expectedKeys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error(`${label} keys must match the current quote options`);
  }
}

export function validateQuotePricingConfig(config: QuotePricingConfig) {
  if (config.version !== 1) throw new Error("Pricing config version must be 1");
  if (config.standardWallHeight !== 6 && config.standardWallHeight !== 7) {
    throw new Error("Standard wall height must be 6 or 7 ft");
  }
  const explicitWallHeightPricing =
    config.wallHeightPriceAdjustmentsPerSqft;
  const explicitBarnPricing = config.roof.barnPricePerSqft;
  if (
    config.standardWallHeight === 6 &&
    (!explicitWallHeightPricing || explicitBarnPricing === undefined)
  ) {
    throw new Error(
      "Literal pricing requires a 6 ft base, an explicit wall-height map, and a barn floor-area surcharge"
    );
  }
  if (
    config.standardWallHeight === 7 &&
    (explicitWallHeightPricing || explicitBarnPricing !== undefined)
  ) {
    throw new Error(
      "Legacy pricing requires a 7 ft base without explicit wall or barn floor-area fields"
    );
  }
  if (!config.footprintBasePrices.length) {
    throw new Error("At least one footprint price is required");
  }

  const seenFootprints = new Set<string>();
  for (const [index, footprint] of config.footprintBasePrices.entries()) {
    assertFiniteNumber(`Footprint ${index + 1} length`, footprint.length, {
      min: 1,
      max: 100,
      integer: true,
    });
    assertFiniteNumber(`Footprint ${index + 1} width`, footprint.width, {
      min: 1,
      max: 100,
      integer: true,
    });
    assertFiniteNumber(`Footprint ${index + 1} price`, footprint.price, {
      min: 0,
      max: 1_000_000,
    });
    for (const [roofStyle, price] of Object.entries(
      footprint.roofStylePriceOverrides ?? {}
    )) {
      if (roofStyle !== "barn" && roofStyle !== "leanTo") {
        throw new Error(
          `Footprint ${index + 1} roof override must be barn or leanTo`
        );
      }
      assertFiniteNumber(
        `Footprint ${index + 1} ${roofStyle} roof price`,
        price,
        { min: footprint.price, max: 1_000_000 }
      );
    }

    const shortSide = Math.min(footprint.length, footprint.width);
    const longSide = Math.max(footprint.length, footprint.width);
    const key = `${shortSide}x${longSide}`;
    if (seenFootprints.has(key)) {
      throw new Error(`Duplicate footprint price for ${key}`);
    }
    seenFootprints.add(key);
  }

  assertFiniteNumber(
    "Custom footprint price per square foot",
    config.customFootprintPricePerSqft,
    { min: 0, max: 10_000 }
  );
  assertFiniteNumber("Custom footprint rounding", config.customFootprintPriceRounding, {
    min: 1,
    max: 10_000,
  });
  assertFiniteNumber(
    "Wall height adjustment",
    config.wallHeightPriceAdjustmentPerSqft,
    { min: 0, max: 1_000 }
  );
  if (explicitWallHeightPricing) {
    assertFiniteNumber(
      "6 ft wall-height surcharge",
      explicitWallHeightPricing.six,
      { min: 0, max: 1_000 }
    );
    if (explicitWallHeightPricing.six !== 0) {
      throw new Error(
        "6 ft wall-height surcharge must be 0 for the standard base"
      );
    }
    assertFiniteNumber(
      "7 ft wall-height surcharge",
      explicitWallHeightPricing.seven,
      { min: 0, max: 1_000 }
    );
    assertFiniteNumber(
      "8 ft wall-height surcharge",
      explicitWallHeightPricing.eight,
      { min: 0, max: 1_000 }
    );
  }
  assertFiniteNumber("Barn roof multiplier", config.roof.barnMultiplier, {
    min: 0,
    max: 5,
  });
  if (config.roof.barnPricePerSqft !== undefined) {
    assertFiniteNumber(
      "Barn roof price per floor square foot",
      config.roof.barnPricePerSqft,
      { min: 0, max: 10_000 }
    );
  }
  assertFiniteNumber("Lean-to roof surcharge", config.roof.leanToFlatCost, {
    min: 0,
    max: 100_000,
  });

  assertExactKeys("Door pricing", config.doors, DOOR_KEYS);
  assertExactKeys("Window pricing", config.windows, WINDOW_KEYS);
  assertExactKeys("Exterior upgrade pricing", config.exteriorUpgrades, EXTERIOR_UPGRADE_KEYS);
}

async function getStoredPricingSettings(ctx: QueryCtx) {
  const tenantId = await getShed210TenantIdForExistingWrite(ctx);
  if (!tenantId) return null;

  return await ctx.db
    .query("quotePricingSettings")
    .withIndex("by_tenant_id_and_key", (query) =>
      query.eq("tenantId", tenantId).eq("key", SETTINGS_KEY)
    )
    .unique();
}

function buildEffectivePricingSettings(
  row: Doc<"quotePricingSettings"> | null
): EffectivePricingSettings {
  if (!row) {
    return {
      source: "default",
      settingsId: null,
      pricingPublicationId: null,
      key: SETTINGS_KEY,
      config: DEFAULT_QUOTE_PRICING_CONFIG,
      configVersion: DEFAULT_QUOTE_PRICING_CONFIG.version,
      updatedAt: null,
      updatedByEmail: null,
    };
  }

  return {
    source: "table",
    settingsId: row._id,
    pricingPublicationId: null,
    key: row.key,
    config: row.config,
    configVersion: row.config.version,
    updatedAt: row.updatedAt,
    updatedByEmail: row.updatedByEmail,
  };
}

export async function getActivePricingForQuoteRouteQuery(
  ctx: QueryCtx,
  args: { readKey?: string; writeKey?: string; tenantSlug?: string }
) {
  if (!isQuotePricingReadKeyAuthorized(args)) {
    throw new Error("Unauthorized quote pricing read");
  }

  if (args.tenantSlug) await setActiveTenantContextBySlug(ctx, args.tenantSlug);
  return buildEffectivePricingSettings(await getStoredPricingSettings(ctx));
}

export const getActivePricingForQuoteRoute = query({
  args: {
    ...tenantSlugArg,
    readKey: v.optional(v.string()),
    writeKey: v.optional(v.string()),
  },
  returns: effectivePricingSettingsValidator,
  handler: getActivePricingForQuoteRouteQuery,
});
