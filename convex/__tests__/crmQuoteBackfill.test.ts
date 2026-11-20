import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getFunctionName } from "convex/server";
import {
  CRM_QUOTE_BACKFILL_SYNC_MODE,
  CRM_QUOTE_SYNC_ENDPOINT_URL,
  enqueueCrmQuoteBackfillBatchMutation,
  previewCrmQuoteBackfillQuery,
  reconcileCrmQuoteBackfillQuery,
} from "../crmQuoteSync";

const NOW = 1_780_000_000_000;
const CUTOFF = NOW - 10_000;
const RUN_ID = "shed210-quotes-2026-07-15";
const tenantId = "tenants-shed210" as Id<"tenants">;

type TableName = "tenants" | "quoteRequests" | "crmQuoteSyncOutbox";
type TableRow =
  | Doc<"tenants">
  | Doc<"quoteRequests">
  | Doc<"crmQuoteSyncOutbox">;
type Condition =
  | { kind: "eq"; field: string; value: unknown }
  | { kind: "lte"; field: string; value: number };
type IndexBuilder = {
  eq: (field: string, value: unknown) => IndexBuilder;
  lte: (field: string, value: number) => IndexBuilder;
};

class FakeQuery<Row extends TableRow> {
  private readonly conditions: Condition[] = [];
  private direction: "asc" | "desc" = "asc";

  constructor(private readonly rows: Row[]) {}

  withIndex(_name: string, build: (query: IndexBuilder) => unknown) {
    const query: IndexBuilder = {
      eq: (field, value) => {
        this.conditions.push({ kind: "eq", field, value });
        return query;
      },
      lte: (field, value) => {
        this.conditions.push({ kind: "lte", field, value });
        return query;
      },
    };
    build(query);
    return this;
  }

  order(direction: "asc" | "desc") {
    this.direction = direction;
    return this;
  }

  async take(limit: number) {
    return this.matches().slice(0, limit);
  }

  async unique() {
    const matches = this.matches();
    if (matches.length > 1) throw new Error("Expected unique row");
    return matches[0] ?? null;
  }

  private matches() {
    const matching = this.rows.filter((row) =>
      this.conditions.every((condition) => {
        const actual = (row as unknown as Record<string, unknown>)[
          condition.field
        ];
        if (condition.kind === "eq") return actual === condition.value;
        return typeof actual === "number" && actual <= condition.value;
      })
    );
    return matching.sort((left, right) => {
      const leftRecord = left as unknown as Record<string, unknown>;
      const rightRecord = right as unknown as Record<string, unknown>;
      const leftOrder =
        typeof leftRecord.createdAt === "number"
          ? leftRecord.createdAt
          : left._creationTime;
      const rightOrder =
        typeof rightRecord.createdAt === "number"
          ? rightRecord.createdAt
          : right._creationTime;
      return this.direction === "asc"
        ? leftOrder - rightOrder
        : rightOrder - leftOrder;
    });
  }
}

class FakeDb {
  tenants: Doc<"tenants">[] = [];
  quoteRequests: Doc<"quoteRequests">[] = [];
  crmQuoteSyncOutbox: Doc<"crmQuoteSyncOutbox">[] = [];
  insertCount = 0;

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
    value: Omit<
      Doc<"crmQuoteSyncOutbox">,
      "_id" | "_creationTime"
    >
  ): Promise<Id<"crmQuoteSyncOutbox">> {
    if (table !== "crmQuoteSyncOutbox") {
      throw new Error("Unexpected insert table");
    }
    this.insertCount += 1;
    const id = `crmQuoteSyncOutbox-new-${this.insertCount}` as Id<"crmQuoteSyncOutbox">;
    this.crmQuoteSyncOutbox.push({
      _id: id,
      _creationTime: NOW + this.insertCount,
      ...value,
    });
    return id;
  }

  async patch(
    id: Id<"quoteRequests"> | Id<"crmQuoteSyncOutbox">,
    value: Record<string, unknown>
  ) {
    const row = [
      ...this.quoteRequests,
      ...this.crmQuoteSyncOutbox,
    ].find((candidate) => candidate._id === id);
    if (!row) throw new Error(`Missing row ${id}`);
    Object.assign(row, value);
  }
}

function addTenant(db: FakeDb) {
  db.tenants.push({
    _id: tenantId,
    _creationTime: 1,
    name: "Shed210",
    slug: "shed210",
    active: true,
    vertical: "shed_builder",
    timeZone: "America/Chicago",
    crmRoutingEnabled: true,
    createdAt: 1,
    updatedAt: 1,
  });
}

function uuid(prefix: string, index: number) {
  return `${prefix}0000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function makeQuote(
  index: number,
  overrides: Partial<Doc<"quoteRequests">> = {}
): Doc<"quoteRequests"> {
  const createdAt = CUTOFF - 5_000 + index * 100;
  return {
    _id: `quoteRequests-${index}` as Id<"quoteRequests">,
    _creationTime: createdAt,
    tenantId,
    publicId: uuid("a", index),
    sessionId: uuid("b", index),
    contact: {
      name: `Customer ${index}`,
      email: `customer${index}@example.com`,
      phone: "+12105550123",
    },
    inputs: {
      structureType: "storage_shed",
      length: 12,
      width: 8,
      addOns: [],
      deliveryRadius: 5,
    },
    pricing: {
      total: 3500,
      breakdown: {
        base: 3500,
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
    },
    notificationStatus: "sent",
    emailNotificationStatus: "sent",
    createdAt,
    ...overrides,
  };
}

function makeOutbox(
  quote: Doc<"quoteRequests">,
  overrides: Partial<Doc<"crmQuoteSyncOutbox">> = {}
): Doc<"crmQuoteSyncOutbox"> {
  return {
    _id: `crmQuoteSyncOutbox-${quote._id}` as Id<"crmQuoteSyncOutbox">,
    _creationTime: quote.createdAt,
    tenantId,
    tenantSlug: "shed210",
    quoteRequestId: quote._id,
    externalSubmissionId: `shed210:quote:${quote.publicId}`,
    sourceDeployment: "prod:handsome-pigeon-985",
    status: "succeeded",
    attemptCount: 1,
    replayCount: 0,
    createdAt: quote.createdAt,
    updatedAt: quote.createdAt,
    ...overrides,
  };
}

function createCtx(db: FakeDb) {
  const scheduled: Array<{
    delayMs: number;
    functionRef: Parameters<typeof getFunctionName>[0];
    args: unknown;
  }> = [];
  const ctx = {
    db,
    scheduler: {
      runAfter: async (
        delayMs: number,
        functionRef: Parameters<typeof getFunctionName>[0],
        args: unknown
      ) => {
        scheduled.push({ delayMs, functionRef, args });
      },
    },
  } as unknown as MutationCtx;
  return { ctx, scheduled };
}

function backfillArgs(
  overrides: Partial<{
    cutoffTimestamp: number;
    backfillRunId: string;
    batchSize: number;
    expectedRemainingCount: number;
  }> = {}
) {
  return {
    tenantSlug: "shed210" as const,
    cutoffTimestamp: CUTOFF,
    backfillRunId: RUN_ID,
    batchSize: 10,
    expectedRemainingCount: 0,
    ...overrides,
  };
}

describe("historical Shed quote backfill", () => {
  const originalEnv = {
    sync: process.env.SHED_CRM_SYNC_ENABLED,
    backfill: process.env.SHED_CRM_BACKFILL_ENABLED,
    endpoint: process.env.FRONTIER_PIXEL_CRM_INTAKE_URL,
    key: process.env.FRONTIER_PIXEL_CRM_INTAKE_KEY,
  };

  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(NOW);
    process.env.SHED_CRM_SYNC_ENABLED = "true";
    process.env.SHED_CRM_BACKFILL_ENABLED = "true";
    process.env.FRONTIER_PIXEL_CRM_INTAKE_URL =
      CRM_QUOTE_SYNC_ENDPOINT_URL;
    process.env.FRONTIER_PIXEL_CRM_INTAKE_KEY = "crm-intake-key";
  });

  afterEach(() => {
    jest.restoreAllMocks();
    for (const [name, value] of [
      ["SHED_CRM_SYNC_ENABLED", originalEnv.sync],
      ["SHED_CRM_BACKFILL_ENABLED", originalEnv.backfill],
      ["FRONTIER_PIXEL_CRM_INTAKE_URL", originalEnv.endpoint],
      ["FRONTIER_PIXEL_CRM_INTAKE_KEY", originalEnv.key],
    ] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it("previews without writes and enqueues missing quotes oldest-first in resumable batches", async () => {
    const db = new FakeDb();
    addTenant(db);
    const first = makeQuote(1);
    const second = makeQuote(2);
    const third = makeQuote(3);
    const afterCutoff = makeQuote(4, {
      createdAt: CUTOFF + 1,
      _creationTime: CUTOFF + 1,
    });
    db.quoteRequests.push(third, afterCutoff, first, second);
    db.crmQuoteSyncOutbox.push(makeOutbox(first));
    const { ctx, scheduled } = createCtx(db);

    await expect(
      previewCrmQuoteBackfillQuery(
        ctx as unknown as QueryCtx,
        backfillArgs({ batchSize: 1 })
      )
    ).resolves.toMatchObject({
      eligibleSourceCount: 3,
      alreadyOutboxedCount: 1,
      remainingCount: 2,
      validRemainingCount: 2,
      invalidRemainingCount: 0,
      wouldEnqueueCount: 1,
      ready: true,
    });
    expect(db.insertCount).toBe(0);
    expect(scheduled).toHaveLength(0);

    await expect(
      enqueueCrmQuoteBackfillBatchMutation(
        ctx,
        backfillArgs({
          batchSize: 1,
          expectedRemainingCount: 2,
        })
      )
    ).resolves.toMatchObject({
      mode: "executed",
      remainingBefore: 2,
      enqueuedCount: 1,
      remainingAfter: 1,
    });
    const firstHistorical = db.crmQuoteSyncOutbox.find(
      (row) => row.syncMode === CRM_QUOTE_BACKFILL_SYNC_MODE
    );
    expect(firstHistorical).toMatchObject({
      quoteRequestId: second._id,
      syncMode: "historical_backfill",
      backfillRunId: RUN_ID,
      status: "pending",
    });
    expect(scheduled).toEqual([
      {
        delayMs: 0,
        functionRef: expect.anything(),
        args: { outboxId: firstHistorical?._id },
      },
    ]);
    expect(scheduled.map((job) => getFunctionName(job.functionRef))).toEqual([
      "crmQuoteSync:sendQuoteToCrm",
    ]);
    expect(scheduled.some((job) => "quoteRequestId" in (job.args as object))).toBe(
      false
    );
    expect(second).toMatchObject({
      notificationStatus: "sent",
      emailNotificationStatus: "sent",
      crmSyncStatus: "pending",
    });

    const differentRunPreview = await previewCrmQuoteBackfillQuery(
      ctx as unknown as QueryCtx,
      backfillArgs({
        backfillRunId: "different-run-after-canary",
        batchSize: 1,
      })
    );
    expect(differentRunPreview).toMatchObject({
      remainingCount: 1,
      invalidRemainingCount: 1,
      wouldEnqueueCount: 0,
      ready: false,
    });
    expect(differentRunPreview.issueCounts).toContainEqual({
      code: "backfill_run_mismatch",
      count: 1,
    });
    await expect(
      enqueueCrmQuoteBackfillBatchMutation(
        ctx,
        backfillArgs({
          backfillRunId: "different-run-after-canary",
          batchSize: 1,
          expectedRemainingCount: 1,
        })
      )
    ).rejects.toThrow("invalid historical quotes");
    expect(db.insertCount).toBe(1);
    expect(scheduled).toHaveLength(1);

    await expect(
      enqueueCrmQuoteBackfillBatchMutation(
        ctx,
        backfillArgs({
          batchSize: 1,
          expectedRemainingCount: 2,
        })
      )
    ).rejects.toThrow("expected 2 remaining quotes but found 1");
    expect(db.insertCount).toBe(1);
    expect(scheduled).toHaveLength(1);

    await expect(
      enqueueCrmQuoteBackfillBatchMutation(
        ctx,
        backfillArgs({ expectedRemainingCount: 1 })
      )
    ).resolves.toMatchObject({
      remainingBefore: 1,
      enqueuedCount: 1,
      remainingAfter: 0,
    });
    expect(
      db.crmQuoteSyncOutbox.filter(
        (row) => row.syncMode === CRM_QUOTE_BACKFILL_SYNC_MODE
      )
    ).toHaveLength(2);
    expect(scheduled).toHaveLength(2);

    await expect(
      enqueueCrmQuoteBackfillBatchMutation(
        ctx,
        backfillArgs({ expectedRemainingCount: 0 })
      )
    ).resolves.toMatchObject({
      remainingBefore: 0,
      enqueuedCount: 0,
      remainingAfter: 0,
    });
    expect(db.insertCount).toBe(2);
    expect(scheduled).toHaveLength(2);
  });

  it("aborts the whole batch before writes for invalid legacy rows", async () => {
    const db = new FakeDb();
    addTenant(db);
    const invalidUuid = makeQuote(1, { publicId: "not-a-uuid" });
    const invalidTimestamp = makeQuote(2, {
      createdAt: 1_000_000_000_000,
      _creationTime: 1_000_000_000_000,
    });
    const oversized = makeQuote(3);
    oversized.inputs = {
      ...oversized.inputs,
      deliveryAddress: "x".repeat(66_000),
    };
    db.quoteRequests.push(invalidUuid, invalidTimestamp, oversized);
    const { ctx, scheduled } = createCtx(db);

    const preview = await previewCrmQuoteBackfillQuery(
      ctx as unknown as QueryCtx,
      backfillArgs({ batchSize: 3 })
    );
    expect(preview).toMatchObject({
      remainingCount: 3,
      validRemainingCount: 0,
      invalidRemainingCount: 3,
      wouldEnqueueCount: 0,
      ready: false,
    });
    expect(preview.issueCounts).toEqual(
      expect.arrayContaining([
        { code: "invalid_public_id", count: 1 },
        { code: "invalid_submitted_at", count: 1 },
        { code: "payload_too_large", count: 1 },
      ])
    );

    await expect(
      enqueueCrmQuoteBackfillBatchMutation(
        ctx,
        backfillArgs({
          batchSize: 3,
          expectedRemainingCount: 3,
        })
      )
    ).rejects.toThrow("found 3 invalid historical quotes");
    expect(db.insertCount).toBe(0);
    expect(db.crmQuoteSyncOutbox).toHaveLength(0);
    expect(scheduled).toHaveLength(0);
  });

  it("rejects disabled gates, count drift, future cutoffs, and batches over ten with zero side effects", async () => {
    const db = new FakeDb();
    addTenant(db);
    db.quoteRequests.push(makeQuote(1));
    const { ctx, scheduled } = createCtx(db);

    process.env.SHED_CRM_BACKFILL_ENABLED = "false";
    await expect(
      enqueueCrmQuoteBackfillBatchMutation(
        ctx,
        backfillArgs({ expectedRemainingCount: 1 })
      )
    ).rejects.toThrow("SHED_CRM_BACKFILL_ENABLED");
    process.env.SHED_CRM_BACKFILL_ENABLED = "true";

    await expect(
      enqueueCrmQuoteBackfillBatchMutation(
        ctx,
        backfillArgs({ expectedRemainingCount: 2 })
      )
    ).rejects.toThrow("expected 2 remaining quotes but found 1");
    await expect(
      enqueueCrmQuoteBackfillBatchMutation(
        ctx,
        backfillArgs({
          batchSize: 11,
          expectedRemainingCount: 1,
        })
      )
    ).rejects.toThrow("batch size");
    await expect(
      enqueueCrmQuoteBackfillBatchMutation(
        ctx,
        backfillArgs({
          cutoffTimestamp: NOW + 1,
          expectedRemainingCount: 1,
        })
      )
    ).rejects.toThrow("cutoff");

    expect(db.insertCount).toBe(0);
    expect(db.crmQuoteSyncOutbox).toHaveLength(0);
    expect(scheduled).toHaveLength(0);
  });

  it("reports outbox coverage separately from successful historical delivery", async () => {
    const db = new FakeDb();
    addTenant(db);
    const live = makeQuote(1);
    const historicalA = makeQuote(2);
    const historicalB = makeQuote(3);
    db.quoteRequests.push(live, historicalA, historicalB);
    db.crmQuoteSyncOutbox.push(makeOutbox(live));
    const historicalOutboxA = makeOutbox(historicalA, {
      syncMode: CRM_QUOTE_BACKFILL_SYNC_MODE,
      backfillRunId: RUN_ID,
      status: "succeeded",
    });
    const historicalOutboxB = makeOutbox(historicalB, {
      syncMode: CRM_QUOTE_BACKFILL_SYNC_MODE,
      backfillRunId: RUN_ID,
      status: "pending",
      attemptCount: 0,
    });
    db.crmQuoteSyncOutbox.push(historicalOutboxA, historicalOutboxB);
    const { ctx } = createCtx(db);

    await expect(
      reconcileCrmQuoteBackfillQuery(ctx as unknown as QueryCtx, {
        tenantSlug: "shed210",
        cutoffTimestamp: CUTOFF,
        backfillRunId: RUN_ID,
      })
    ).resolves.toMatchObject({
      eligibleSourceCount: 3,
      sourceWithOutboxCount: 3,
      sourceMissingOutboxCount: 0,
      historicalRunOutboxCount: 2,
      historicalRunStatuses: {
        pending: 1,
        processing: 0,
        retryScheduled: 0,
        succeeded: 1,
        deadLetter: 0,
      },
      sourceOutboxCoverageComplete: true,
      historicalRunDeliveryComplete: false,
    });

    historicalOutboxB.status = "succeeded";
    await expect(
      reconcileCrmQuoteBackfillQuery(ctx as unknown as QueryCtx, {
        tenantSlug: "shed210",
        cutoffTimestamp: CUTOFF,
        backfillRunId: RUN_ID,
      })
    ).resolves.toMatchObject({
      historicalRunStatuses: {
        pending: 0,
        succeeded: 2,
      },
      sourceOutboxCoverageComplete: true,
      historicalRunDeliveryComplete: true,
    });
  });
});
