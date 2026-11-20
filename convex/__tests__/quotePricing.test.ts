/**
 * @jest-environment node
 */

import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  DEFAULT_QUOTE_PRICING_CONFIG as APP_DEFAULT_QUOTE_PRICING_CONFIG,
} from "../../src/lib/pricing/pricingData";
import {
  DEFAULT_QUOTE_PRICING_CONFIG,
  getActivePricingForQuoteRouteQuery,
  validateQuotePricingConfig,
} from "../quotePricing";

type EqCondition = { field: string; value: unknown };
type EqBuilder = {
  eq: (field: string, value: unknown) => EqBuilder;
};

class FakeQuery<Row> {
  private conditions: EqCondition[] = [];

  constructor(private readonly rows: Row[]) {}

  withIndex(_name: string, build: (q: EqBuilder) => unknown) {
    const builder: EqBuilder = {
      eq: (field, value) => {
        this.conditions.push({ field, value });
        return builder;
      },
    };
    build(builder);
    return this;
  }

  async unique() {
    const matches = this.rows.filter((row) =>
      this.conditions.every(
        (condition) =>
          (row as Record<string, unknown>)[condition.field] === condition.value
      )
    );
    if (matches.length > 1) throw new Error("Expected unique result");
    return matches[0] ?? null;
  }

  async take(limit: number) {
    return this.rows
      .filter((row) =>
        this.conditions.every(
          (condition) =>
            (row as Record<string, unknown>)[condition.field] === condition.value
        )
      )
      .slice(0, limit);
  }
}

class FakeDb {
  tenants: Doc<"tenants">[] = [
    {
      _id: "tenants-shed210" as Id<"tenants">,
      _creationTime: 1,
      name: "Shed210",
      slug: "shed210",
      active: true,
      vertical: "shed_builder",
      timeZone: "America/Chicago",
      crmRoutingEnabled: true,
      createdAt: 1,
      updatedAt: 1,
    },
  ];
  quotePricingSettings: Doc<"quotePricingSettings">[] = [];

  query(table: "tenants"): FakeQuery<Doc<"tenants">>;
  query(table: "quotePricingSettings"): FakeQuery<Doc<"quotePricingSettings">>;
  query(table: "tenants" | "quotePricingSettings") {
    if (table === "tenants") return new FakeQuery(this.tenants);
    return new FakeQuery(this.quotePricingSettings);
  }
}

function createCtx(db: FakeDb) {
  return { db } as unknown as QueryCtx;
}

async function runWithEnv<T>(env: Record<string, string | undefined>, fn: () => Promise<T>) {
  const previous = process.env;
  process.env = {
    ...previous,
    ...env,
  };

  try {
    return await fn();
  } finally {
    process.env = previous;
  }
}

function cloneDefaultConfig() {
  return JSON.parse(JSON.stringify(DEFAULT_QUOTE_PRICING_CONFIG));
}

function addPricingSettings(
  db: FakeDb,
  overrides: Partial<Doc<"quotePricingSettings">> = {}
) {
  const row = {
    _id: `quotePricingSettings-${db.quotePricingSettings.length + 1}` as Id<"quotePricingSettings">,
    _creationTime: 1,
    tenantId: "tenants-shed210" as Id<"tenants">,
    key: "active",
    config: DEFAULT_QUOTE_PRICING_CONFIG,
    createdBy: "admin@example.com",
    updatedBy: "admin@example.com",
    updatedByEmail: "admin@example.com",
    updatedByName: "Admin",
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  } satisfies Doc<"quotePricingSettings">;
  db.quotePricingSettings.push(row);
  return row;
}

describe("quote pricing settings", () => {
  it("keeps Convex pricing defaults and option keys in parity with the app", () => {
    expect(DEFAULT_QUOTE_PRICING_CONFIG).toEqual(APP_DEFAULT_QUOTE_PRICING_CONFIG);
    expect(Object.keys(DEFAULT_QUOTE_PRICING_CONFIG.doors).sort()).toEqual(
      Object.keys(APP_DEFAULT_QUOTE_PRICING_CONFIG.doors).sort()
    );
    expect(Object.keys(DEFAULT_QUOTE_PRICING_CONFIG.windows).sort()).toEqual(
      Object.keys(APP_DEFAULT_QUOTE_PRICING_CONFIG.windows).sort()
    );
    expect(Object.keys(DEFAULT_QUOTE_PRICING_CONFIG.exteriorUpgrades).sort()).toEqual(
      Object.keys(APP_DEFAULT_QUOTE_PRICING_CONFIG.exteriorUpgrades).sort()
    );
  });

  it("guards the public quote-route read with the configured server key", async () => {
    const db = new FakeDb();

    await expect(
      runWithEnv({ CONVEX_QUOTE_WRITE_KEY: "write-key" }, async () =>
        getActivePricingForQuoteRouteQuery(createCtx(db), {
          readKey: "wrong-key",
        })
      )
    ).rejects.toThrow("Unauthorized quote pricing read");
  });

  it("accepts the legacy writeKey argument during the rollout window", async () => {
    const db = new FakeDb();

    const result = await runWithEnv(
      { CONVEX_QUOTE_WRITE_KEY: "write-key" },
      async () =>
        getActivePricingForQuoteRouteQuery(createCtx(db), {
          writeKey: "write-key",
        })
    );

    expect(result.source).toBe("default");
  });

  it("uses the dedicated pricing key after legacy fallback is disabled", async () => {
    const db = new FakeDb();
    const env = {
      CONVEX_QUOTE_WRITE_KEY: "write-key",
      CONVEX_QUOTE_PRICING_READ_KEY: "pricing-read-key",
      CONVEX_PRICING_ALLOW_WRITE_KEY_FALLBACK: "false",
    };

    await expect(
      runWithEnv(env, async () =>
        getActivePricingForQuoteRouteQuery(createCtx(db), {
          readKey: "write-key",
        })
      )
    ).rejects.toThrow("Unauthorized quote pricing read");

    await expect(
      runWithEnv(env, async () =>
        getActivePricingForQuoteRouteQuery(createCtx(db), {
          readKey: "pricing-read-key",
        })
      )
    ).resolves.toMatchObject({ source: "default" });
  });

  it("rejects conflicting old and new key arguments", async () => {
    const db = new FakeDb();

    await expect(
      runWithEnv({ CONVEX_QUOTE_WRITE_KEY: "write-key" }, async () =>
        getActivePricingForQuoteRouteQuery(createCtx(db), {
          readKey: "write-key",
          writeKey: "different-key",
        })
      )
    ).rejects.toThrow("Unauthorized quote pricing read");
  });

  it("falls back to the default config when no active row exists", async () => {
    const db = new FakeDb();

    const result = await runWithEnv({ CONVEX_QUOTE_WRITE_KEY: "write-key" }, async () =>
      getActivePricingForQuoteRouteQuery(createCtx(db), {
        readKey: "write-key",
      })
    );

    expect(result).toMatchObject({
      source: "default",
      settingsId: null,
      pricingPublicationId: null,
      config: DEFAULT_QUOTE_PRICING_CONFIG,
      updatedAt: null,
      updatedByEmail: null,
    });
  });

  it("returns the active table config for the default Shed210 tenant", async () => {
    const db = new FakeDb();
    const config = cloneDefaultConfig();
    config.delivery.ratePerMile = 2.25;
    const row = addPricingSettings(db, { config, updatedAt: 1_714_000_000_000 });

    const result = await runWithEnv({ CONVEX_QUOTE_WRITE_KEY: "write-key" }, async () =>
      getActivePricingForQuoteRouteQuery(createCtx(db), {
        readKey: "write-key",
      })
    );

    expect(result).toMatchObject({
      source: "table",
      settingsId: row._id,
      pricingPublicationId: null,
      key: "active",
      configVersion: 1,
      updatedAt: 1_714_000_000_000,
      updatedByEmail: "admin@example.com",
    });
    expect(result.config.delivery.ratePerMile).toBe(2.25);
  });

  it("uses the requested tenant slug for active pricing reads", async () => {
    const db = new FakeDb();
    const tenantB = {
      _id: "tenants-b" as Id<"tenants">,
      _creationTime: 1,
      name: "Tenant B",
      slug: "tenant-b",
      active: true,
      vertical: "digital_services",
      timeZone: "America/Chicago",
      crmRoutingEnabled: true,
      createdAt: 1,
      updatedAt: 1,
    } satisfies Doc<"tenants">;
    db.tenants.push(tenantB);
    const config = cloneDefaultConfig();
    config.doors.double_shed = 225;
    addPricingSettings(db, {
      _id: "quotePricingSettings-tenant-b" as Id<"quotePricingSettings">,
      tenantId: tenantB._id,
      config,
    });

    const result = await runWithEnv({ CONVEX_QUOTE_WRITE_KEY: "write-key" }, async () =>
      getActivePricingForQuoteRouteQuery(createCtx(db), {
        readKey: "write-key",
        tenantSlug: "tenant-b",
      })
    );

    expect(result.settingsId).toBe("quotePricingSettings-tenant-b");
    expect(result.config.doors.double_shed).toBe(225);
  });

  it("does not fall back to another tenant's sole active pricing row", async () => {
    const db = new FakeDb();
    const tenantB = {
      _id: "tenants-b" as Id<"tenants">,
      _creationTime: 1,
      name: "Tenant B",
      slug: "tenant-b",
      active: true,
      vertical: "digital_services",
      timeZone: "America/Chicago",
      crmRoutingEnabled: true,
      createdAt: 1,
      updatedAt: 1,
    } satisfies Doc<"tenants">;
    db.tenants.push(tenantB);
    const shedConfig = cloneDefaultConfig();
    shedConfig.delivery.ratePerMile = 99;
    addPricingSettings(db, { config: shedConfig });

    const result = await runWithEnv(
      { CONVEX_QUOTE_WRITE_KEY: "write-key" },
      async () =>
        getActivePricingForQuoteRouteQuery(createCtx(db), {
          readKey: "write-key",
          tenantSlug: "tenant-b",
        })
    );

    expect(result).toMatchObject({
      source: "default",
      settingsId: null,
      config: DEFAULT_QUOTE_PRICING_CONFIG,
    });
    expect(result.config.delivery.ratePerMile).not.toBe(99);
  });

  it("rejects unknown tenant slugs", async () => {
    const db = new FakeDb();

    await expect(
      runWithEnv({ CONVEX_QUOTE_WRITE_KEY: "write-key" }, async () =>
        getActivePricingForQuoteRouteQuery(createCtx(db), {
          readKey: "write-key",
          tenantSlug: "missing",
        })
      )
    ).rejects.toThrow("Tenant not found");
  });

  it("rejects invalid pricing configs", () => {
    const config = cloneDefaultConfig();
    delete config.doors.house;

    expect(() => validateQuotePricingConfig(config)).toThrow(
      "Door pricing keys must match"
    );
  });

  it("validates optional per-footprint roof prices", () => {
    const config = cloneDefaultConfig();
    config.footprintBasePrices[0].roofStylePriceOverrides = {
      barn: Number.NaN,
    };

    expect(() => validateQuotePricingConfig(config)).toThrow(
      "Footprint 1 barn roof price must be a finite number"
    );
  });

  it("accepts legacy 7-ft baseline and barn-multiplier configs", () => {
    const config = cloneDefaultConfig();
    config.standardWallHeight = 7;
    delete config.wallHeightPriceAdjustmentsPerSqft;
    delete config.roof.barnPricePerSqft;

    expect(() => validateQuotePricingConfig(config)).not.toThrow();
  });

  it("requires an included 6-ft row in explicit wall-height mode", () => {
    const config = cloneDefaultConfig();
    config.wallHeightPriceAdjustmentsPerSqft.six = 1;

    expect(() => validateQuotePricingConfig(config)).toThrow(
      "6 ft wall-height surcharge must be 0"
    );
  });

  it("rejects a partial 6-ft literal pricing mode", () => {
    const config = cloneDefaultConfig();
    delete config.roof.barnPricePerSqft;

    expect(() => validateQuotePricingConfig(config)).toThrow(
      "Literal pricing requires a 6 ft base"
    );
  });

  it("rejects explicit barn pricing in legacy 7-ft mode", () => {
    const config = cloneDefaultConfig();
    config.standardWallHeight = 7;
    delete config.wallHeightPriceAdjustmentsPerSqft;

    expect(() => validateQuotePricingConfig(config)).toThrow(
      "Legacy pricing requires a 7 ft base"
    );
  });
});
