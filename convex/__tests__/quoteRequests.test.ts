import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { ConvexError } from "convex/values";
import { createQuoteRequestMutation } from "../quoteRequests";
import { consumeQuoteSubmissionQuotas } from "../quoteSubmissionQuota";

jest.mock("../quoteSubmissionQuota", () => ({
  consumeQuoteSubmissionQuotas: jest.fn().mockResolvedValue(undefined),
}));

const consumeQuoteSubmissionQuotasMock = jest.mocked(
  consumeQuoteSubmissionQuotas
);

type CreateQuoteArgs = Parameters<typeof createQuoteRequestMutation>[1];
type QuoteInputs = CreateQuoteArgs["inputs"];
type QuotePricing = CreateQuoteArgs["pricing"];

const quoteInputs: QuoteInputs = {
  structureType: "storage_shed",
  length: 12,
  width: 8,
  roofStyle: "gabled",
  wallHeight: 8,
  roofMaterial: "29ga metal",
  frameGauge: "14-ga",
  addOns: ["Workbench"],
  ventilation: true,
  deliveryZip: "78201",
  deliveryRadius: 5,
};

const quotePricing: QuotePricing = {
  total: 3500,
  breakdown: {
    base: 3000,
    wallHeight: 200,
    roof: 0,
    siding: 0,
    door: 0,
    windows: 0,
    addOns: 300,
    delivery: 0,
    discount: 0,
    interiorUpgrades: [],
  },
};

type TableName = "tenants" | "quoteRequests" | "crmQuoteSyncOutbox";
type TableDoc =
  | Doc<"tenants">
  | Doc<"quoteRequests">
  | Doc<"crmQuoteSyncOutbox">;
type EqCondition = { field: string; value: unknown };
type EqBuilder = {
  eq: (field: string, value: unknown) => EqBuilder;
};
type ScheduledJob = {
  delayMs: number;
  args:
    | { quoteRequestId: Id<"quoteRequests"> }
    | { outboxId: Id<"crmQuoteSyncOutbox"> };
};

class FakeQuery<Row extends TableDoc> {
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

  async take(limit: number) {
    return this.matches().slice(0, limit);
  }

  async unique() {
    const matches = this.matches();
    if (matches.length > 1) throw new Error("Expected unique result");
    return matches[0] ?? null;
  }

  private matches() {
    return this.rows.filter((row) =>
      this.conditions.every(
        (condition) =>
          (row as unknown as Record<string, unknown>)[condition.field] ===
          condition.value
      )
    );
  }
}

class FakeDb {
  tenants: Doc<"tenants">[] = [];
  quoteRequests: Doc<"quoteRequests">[] = [];
  crmQuoteSyncOutbox: Doc<"crmQuoteSyncOutbox">[] = [];
  insertTables: string[] = [];
  private nextId = 1;

  query(table: "tenants"): FakeQuery<Doc<"tenants">>;
  query(table: "quoteRequests"): FakeQuery<Doc<"quoteRequests">>;
  query(
    table: "crmQuoteSyncOutbox"
  ): FakeQuery<Doc<"crmQuoteSyncOutbox">>;
  query(table: TableName) {
    if (table === "tenants") return new FakeQuery(this.tenants);
    if (table === "quoteRequests") return new FakeQuery(this.quoteRequests);
    return new FakeQuery(this.crmQuoteSyncOutbox);
  }

  async insert(
    table: "crmQuoteSyncOutbox",
    value: Record<string, unknown>
  ): Promise<Id<"crmQuoteSyncOutbox">>;
  async insert(
    table: "quoteRequests",
    value: Record<string, unknown>
  ): Promise<Id<"quoteRequests">>;
  async insert(
    table: "quoteRequests" | "crmQuoteSyncOutbox",
    value: Record<string, unknown>
  ): Promise<Id<"quoteRequests"> | Id<"crmQuoteSyncOutbox">> {
    this.insertTables.push(table);
    const id = `${table}-${this.nextId++}`;
    const doc = {
      _id: id,
      _creationTime:
        typeof value.createdAt === "number" ? value.createdAt : Date.now(),
      ...value,
    };
    if (table === "quoteRequests") {
      this.quoteRequests.push(doc as Doc<"quoteRequests">);
      return id as Id<"quoteRequests">;
    }
    this.crmQuoteSyncOutbox.push(doc as Doc<"crmQuoteSyncOutbox">);
    return id as Id<"crmQuoteSyncOutbox">;
  }

  async patch(
    id: Id<"quoteRequests"> | Id<"crmQuoteSyncOutbox">,
    value: Record<string, unknown>
  ) {
    const doc = [...this.quoteRequests, ...this.crmQuoteSyncOutbox].find(
      (row) => row._id === id
    );
    if (!doc) throw new Error(`Document not found: ${id}`);
    Object.assign(doc, value);
  }
}

function createMutationCtx(
  db: FakeDb,
  scheduled: ScheduledJob[] = []
): MutationCtx {
  return {
    db,
    scheduler: {
      runAfter: async (delayMs: number, _functionRef: unknown, args: unknown) => {
        scheduled.push({
          delayMs,
          args: args as ScheduledJob["args"],
        });
      },
    },
  } as unknown as MutationCtx;
}

function addTenant(
  db: FakeDb,
  args: {
    tenantId: Id<"tenants">;
    slug: string;
  }
) {
  db.tenants.push({
    _id: args.tenantId,
    _creationTime: 1,
    name: args.slug,
    slug: args.slug,
    active: true,
    vertical: args.slug === "shed210" ? "shed_builder" : "digital_services",
    timeZone: "America/Chicago",
    crmRoutingEnabled: true,
    createdAt: 1,
    updatedAt: 1,
  });
}

function createArgs(overrides: Partial<CreateQuoteArgs> = {}): CreateQuoteArgs {
  return {
    writeKey: "test-write-key",
    publicId: "quote-public-1",
    sessionId: "session-1",
    contact: {
      name: "Maria Garcia",
      email: "maria@example.com",
      phone: "+12105550123",
    },
    inputs: quoteInputs,
    pricing: quotePricing,
    ...overrides,
  };
}

describe("quote request mutation", () => {
  const originalWriteKey = process.env.CONVEX_QUOTE_WRITE_KEY;

  beforeEach(() => {
    process.env.CONVEX_QUOTE_WRITE_KEY = "test-write-key";
    consumeQuoteSubmissionQuotasMock.mockReset().mockResolvedValue(undefined);
    jest.spyOn(Date, "now").mockReturnValue(1_714_000_000_000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalWriteKey === undefined) {
      delete process.env.CONVEX_QUOTE_WRITE_KEY;
    } else {
      process.env.CONVEX_QUOTE_WRITE_KEY = originalWriteKey;
    }
  });

  it("atomically stores the Shed quote outbox and schedules all three jobs", async () => {
    const db = new FakeDb();
    const scheduled: ScheduledJob[] = [];
    const tenantId = "tenants-shed210" as Id<"tenants">;
    addTenant(db, { tenantId, slug: "shed210" });

    const result = await createQuoteRequestMutation(
      createMutationCtx(db, scheduled),
      createArgs()
    );

    expect(result).toEqual({
      publicId: "quote-public-1",
      quoteRequestId: db.quoteRequests[0]._id,
    });
    expect(db.insertTables).toEqual(["quoteRequests", "crmQuoteSyncOutbox"]);
    expect(db.quoteRequests[0]).toMatchObject({
      tenantId,
      publicId: "quote-public-1",
      sessionId: "session-1",
      contact: {
        name: "Maria Garcia",
        email: "maria@example.com",
        phone: "+12105550123",
      },
      inputs: quoteInputs,
      pricing: quotePricing,
      notificationStatus: "queued",
      notificationQueuedAt: 1_714_000_000_000,
      emailNotificationStatus: "queued",
      emailNotificationQueuedAt: 1_714_000_000_000,
      crmSyncStatus: "pending",
      crmSyncOutboxId: db.crmQuoteSyncOutbox[0]._id,
      createdAt: 1_714_000_000_000,
    });
    expect(db.crmQuoteSyncOutbox[0]).toMatchObject({
      tenantId,
      tenantSlug: "shed210",
      quoteRequestId: db.quoteRequests[0]._id,
      externalSubmissionId: "shed210:quote:quote-public-1",
      status: "pending",
      attemptCount: 0,
      replayCount: 0,
      nextAttemptAt: 1_714_000_000_000,
      createdAt: 1_714_000_000_000,
      updatedAt: 1_714_000_000_000,
    });
    expect(scheduled).toEqual([
      {
        delayMs: 0,
        args: { quoteRequestId: db.quoteRequests[0]._id },
      },
      {
        delayMs: 0,
        args: { quoteRequestId: db.quoteRequests[0]._id },
      },
      {
        delayMs: 0,
        args: { outboxId: db.crmQuoteSyncOutbox[0]._id },
      },
    ]);
    expect(consumeQuoteSubmissionQuotasMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantSlug: "shed210",
        sessionId: "session-1",
        writeKey: "test-write-key",
      })
    );
  });

  it("dedupes public IDs per tenant without rescheduling alerts", async () => {
    const db = new FakeDb();
    const scheduled: ScheduledJob[] = [];
    const tenantA = "tenants-a" as Id<"tenants">;
    const tenantB = "tenants-b" as Id<"tenants">;
    addTenant(db, { tenantId: tenantA, slug: "tenant-a" });
    addTenant(db, { tenantId: tenantB, slug: "tenant-b" });

    const first = await createQuoteRequestMutation(
      createMutationCtx(db, scheduled),
      createArgs({ tenantSlug: "tenant-a", publicId: "shared-public-id" })
    );
    const repeat = await createQuoteRequestMutation(
      createMutationCtx(db, scheduled),
      createArgs({
        tenantSlug: "tenant-a",
        publicId: "shared-public-id",
        sessionId: "session-2",
      })
    );
    const otherTenant = await createQuoteRequestMutation(
      createMutationCtx(db, scheduled),
      createArgs({
        tenantSlug: "tenant-b",
        publicId: "shared-public-id",
        contact: {
          name: "Taylor Smith",
          email: "taylor@example.com",
          phone: "+12105550999",
        },
      })
    );

    expect(repeat.quoteRequestId).toBe(first.quoteRequestId);
    expect(otherTenant.quoteRequestId).not.toBe(first.quoteRequestId);
    expect(db.quoteRequests).toHaveLength(2);
    expect(db.quoteRequests.map((quote) => quote.tenantId)).toEqual([
      tenantA,
      tenantB,
    ]);
    expect(db.crmQuoteSyncOutbox).toHaveLength(0);
    expect(scheduled).toHaveLength(4);
    expect(consumeQuoteSubmissionQuotasMock).toHaveBeenCalledTimes(2);
  });

  it("trims install address before storing quote inputs", async () => {
    const db = new FakeDb();
    addTenant(db, {
      tenantId: "tenants-shed210" as Id<"tenants">,
      slug: "shed210",
    });

    await createQuoteRequestMutation(
      createMutationCtx(db),
      createArgs({
        inputs: {
          ...quoteInputs,
          deliveryAddress: "  123 Test St, San Antonio, TX 78205  ",
        },
      })
    );

    expect(db.quoteRequests[0].inputs.deliveryAddress).toBe(
      "123 Test St, San Antonio, TX 78205"
    );
  });

  it("rejects install addresses over 255 characters before writing", async () => {
    const db = new FakeDb();
    addTenant(db, {
      tenantId: "tenants-shed210" as Id<"tenants">,
      slug: "shed210",
    });

    await expect(
      createQuoteRequestMutation(
        createMutationCtx(db),
        createArgs({
          inputs: {
            ...quoteInputs,
            deliveryAddress: "a".repeat(256),
          },
        })
      )
    ).rejects.toThrow("Install address must be 255 characters or less");

    expect(db.quoteRequests).toHaveLength(0);
  });

  it("rejects calls without the matching quote write key", async () => {
    const db = new FakeDb();
    addTenant(db, {
      tenantId: "tenants-shed210" as Id<"tenants">,
      slug: "shed210",
    });

    await expect(
      createQuoteRequestMutation(
        createMutationCtx(db),
        createArgs({ writeKey: "wrong-key" })
      )
    ).rejects.toThrow("Unauthorized quote write");
    expect(db.quoteRequests).toHaveLength(0);
  });

  it("does not persist or schedule when the atomic create quota rejects", async () => {
    const db = new FakeDb();
    const scheduled: ScheduledJob[] = [];
    addTenant(db, {
      tenantId: "tenants-shed210" as Id<"tenants">,
      slug: "shed210",
    });
    consumeQuoteSubmissionQuotasMock.mockRejectedValueOnce(
      new ConvexError({
        code: "QUOTE_RATE_LIMITED",
        retryAfterSeconds: 300,
      })
    );

    await expect(
      createQuoteRequestMutation(
        createMutationCtx(db, scheduled),
        createArgs()
      )
    ).rejects.toMatchObject({
      data: { code: "QUOTE_RATE_LIMITED", retryAfterSeconds: 300 },
    });
    expect(db.quoteRequests).toHaveLength(0);
    expect(db.crmQuoteSyncOutbox).toHaveLength(0);
    expect(scheduled).toHaveLength(0);
  });

  it("rejects incoherent pricing provenance before storing or scheduling", async () => {
    const db = new FakeDb();
    const scheduled: ScheduledJob[] = [];
    addTenant(db, {
      tenantId: "tenants-shed210" as Id<"tenants">,
      slug: "shed210",
    });

    await expect(
      createQuoteRequestMutation(
        createMutationCtx(db, scheduled),
        createArgs({
          pricing: {
            ...quotePricing,
            config: {
              provider: "frontier_pixel_crm",
              source: "table",
              settingsId:
                "quotePricingSettings-impossible" as Id<"quotePricingSettings">,
              pricingPublicationId: "publication-7",
              key: "active",
              configVersion: 7,
              pricingSchemaVersion: 1,
              pricingPublicationVersion: 7,
              updatedAt: 1_714_000_000_000,
            },
          },
        })
      )
    ).rejects.toThrow(
      "CRM pricing provenance must identify one matching version 1 publication"
    );

    expect(db.quoteRequests).toHaveLength(0);
    expect(db.crmQuoteSyncOutbox).toHaveLength(0);
    expect(scheduled).toHaveLength(0);
  });
});
