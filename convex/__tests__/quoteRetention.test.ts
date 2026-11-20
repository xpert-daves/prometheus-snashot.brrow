import type { MutationCtx } from "../_generated/server";
import {
  cleanupExpiredQuoteDataMutation,
  parseQuoteDataRetentionDays,
  QUOTE_RETENTION_CHILD_BATCH_SIZE,
  QUOTE_RETENTION_DELETE_BATCH_SIZE,
  QUOTE_RETENTION_SCAN_BATCH_SIZE,
} from "../quoteRetention";
import { CRM_QUOTE_ACKNOWLEDGEMENT_BINDING_VERSION } from "../validators";

type Row = Record<string, unknown> & { _id: string };
type TableName =
  | "quoteRequests"
  | "notificationAttempts"
  | "quoteEmailNotificationAttempts"
  | "crmQuoteSyncOutbox"
  | "quoteRetentionState"
  | "quoteDiscussionRequests";
type Constraint = { kind: "eq" | "lt"; field: string; value: unknown };
type ContinuationArgs = {
  expectedCutoff?: number;
  expectedCursor?: string;
};
type ScheduledContinuation = {
  delayMs: number;
  args: ContinuationArgs;
};

class FakeQuery {
  private constraints: Constraint[] = [];

  constructor(
    private readonly db: FakeDb,
    private readonly table: TableName
  ) {}

  withIndex(
    _name: string,
    apply: (builder: {
      eq: (field: string, value: unknown) => unknown;
      lt: (field: string, value: number) => unknown;
    }) => unknown
  ) {
    const builder = {
      eq: (field: string, value: unknown) => {
        this.constraints.push({ kind: "eq", field, value });
        return builder;
      },
      lt: (field: string, value: number) => {
        this.constraints.push({ kind: "lt", field, value });
        return builder;
      },
    };
    apply(builder);
    return this;
  }

  order() {
    return this;
  }

  async unique() {
    this.db.recordIoOperation();
    const rows = this.matches();
    if (rows.length > 1) throw new Error("Expected unique row");
    return rows[0] ?? null;
  }

  async take(limit: number) {
    this.db.recordIoOperation();
    return this.matches().slice(0, limit);
  }

  async paginate(options: { cursor: string | null; numItems: number }) {
    this.db.recordIoOperation();
    const cursorPosition = options.cursor
      ? (JSON.parse(options.cursor) as [number, string])
      : null;
    const rows = this.matches().filter((row) => {
      if (!cursorPosition) return true;
      const createdAt = Number(row.createdAt ?? 0);
      return (
        createdAt > cursorPosition[0] ||
        (createdAt === cursorPosition[0] && row._id > cursorPosition[1])
      );
    });
    const page = rows.slice(0, options.numItems);
    const last = page[page.length - 1];
    return {
      page,
      isDone: page.length >= rows.length,
      continueCursor: last
        ? JSON.stringify([Number(last.createdAt ?? 0), last._id])
        : (options.cursor ?? ""),
    };
  }

  private matches() {
    return [...this.db.tables[this.table]]
      .filter((row) =>
        this.constraints.every((constraint) =>
          constraint.kind === "eq"
            ? row[constraint.field] === constraint.value
            : Number(row[constraint.field]) < Number(constraint.value)
        )
      )
      .sort((left, right) => {
        const createdAtDifference =
          Number(left.createdAt ?? 0) - Number(right.createdAt ?? 0);
        return createdAtDifference || left._id.localeCompare(right._id);
      });
  }
}

class FakeDb {
  tables: Record<TableName, Row[]> = {
    quoteRequests: [],
    notificationAttempts: [],
    quoteEmailNotificationAttempts: [],
    crmQuoteSyncOutbox: [],
    quoteRetentionState: [],
    quoteDiscussionRequests: [],
  };
  ioOperations = 0;
  private nextId = 1;

  recordIoOperation() {
    this.ioOperations += 1;
  }

  query(table: TableName) {
    return new FakeQuery(this, table);
  }

  async delete(id: string) {
    this.recordIoOperation();
    for (const table of Object.keys(this.tables) as TableName[]) {
      this.tables[table] = this.tables[table].filter((row) => row._id !== id);
    }
  }

  async patch(id: string, value: Record<string, unknown>) {
    this.recordIoOperation();
    const row = Object.values(this.tables)
      .flat()
      .find((candidate) => candidate._id === id);
    if (!row) throw new Error(`Missing row ${id}`);
    Object.assign(row, value);
  }

  async insert(table: TableName, value: Record<string, unknown>) {
    this.recordIoOperation();
    const id = `${table}-${this.nextId++}`;
    this.tables[table].push({ _id: id, ...value });
    return id;
  }
}

class FakeScheduler {
  jobs: ScheduledContinuation[] = [];
  totalScheduled = 0;

  constructor(private readonly db: FakeDb) {}

  async runAfter(
    delayMs: number,
    _functionReference: unknown,
    args: ContinuationArgs
  ) {
    this.db.recordIoOperation();
    this.totalScheduled += 1;
    this.jobs.push({ delayMs, args });
  }
}

function retentionCtx(db: FakeDb, scheduler = new FakeScheduler(db)) {
  return { db, scheduler } as unknown as MutationCtx;
}

function addQuote(
  db: FakeDb,
  overrides: Record<string, unknown> = {}
) {
  const index = db.tables.quoteRequests.length + 1;
  const quote: Row = {
    _id: `quote-${index}`,
    publicId: `public-${index}`,
    tenantId: "tenant-1",
    createdAt: 1_000 + index,
    crmSyncStatus: "succeeded",
    notificationStatus: "sent",
    emailNotificationStatus: "sent",
    ...overrides,
  };
  db.tables.quoteRequests.push(quote);
  return quote;
}

function addOutbox(
  db: FakeDb,
  quote: Row,
  overrides: Record<string, unknown> = {}
) {
  const outbox = {
    _id: `outbox-${quote._id}`,
    tenantId: quote.tenantId,
    quoteRequestId: quote._id,
    externalSubmissionId: `shed210:quote:${quote.publicId}`,
    status: "succeeded",
    acknowledgementBindingVersion:
      CRM_QUOTE_ACKNOWLEDGEMENT_BINDING_VERSION,
    ...overrides,
  };
  db.tables.crmQuoteSyncOutbox.push(outbox);
  quote.crmSyncOutboxId = outbox._id;
  return outbox;
}

function addTerminalChildren(
  db: FakeDb,
  quote: Row,
  smsCount = 1,
  emailCount = 1
) {
  for (let index = 0; index < smsCount; index += 1) {
    db.tables.notificationAttempts.push({
      _id: `sms-${quote._id}-${index}`,
      tenantId: quote.tenantId,
      quoteRequestId: quote._id,
      status: "sent",
    });
  }
  for (let index = 0; index < emailCount; index += 1) {
    db.tables.quoteEmailNotificationAttempts.push({
      _id: `email-${quote._id}-${index}`,
      tenantId: quote.tenantId,
      quoteRequestId: quote._id,
      status: "sent",
    });
  }
}

const RETENTION_NOW = 40 * 24 * 60 * 60_000;

async function runCleanup(
  db: FakeDb,
  scheduler: FakeScheduler,
  continuation: ContinuationArgs = {},
  now = RETENTION_NOW
) {
  return await cleanupExpiredQuoteDataMutation(retentionCtx(db, scheduler), {
    retentionDays: 30,
    now,
    ...continuation,
  });
}

describe("quote data retention", () => {
  it("retains pending discussion requests and removes only delivered requests with their quote", async () => {
    const db = new FakeDb();
    const scheduler = new FakeScheduler(db);
    const quote = addQuote(db);
    addOutbox(db, quote);
    db.tables.quoteDiscussionRequests.push({ _id: "discussion-1", tenantId: quote.tenantId, quoteRequestId: quote._id, status: "pending" });
    expect(await runCleanup(db, scheduler)).toMatchObject({ deletedQuotes: 0 });
    expect(db.tables.quoteDiscussionRequests).toHaveLength(1);
    db.tables.quoteDiscussionRequests[0].status = "succeeded";
    expect(await runCleanup(db, scheduler)).toMatchObject({ deletedQuotes: 1 });
    expect(db.tables.quoteDiscussionRequests).toHaveLength(0);
  });
  it("is disabled by default and rejects unsafe retention windows", () => {
    expect(parseQuoteDataRetentionDays(undefined)).toBeNull();
    expect(parseQuoteDataRetentionDays(" 365 ")).toBe(365);
    expect(() => parseQuoteDataRetentionDays("29")).toThrow("30-3650");
    expect(() => parseQuoteDataRetentionDays("30.5")).toThrow("30-3650");
  });

  it("does no reads, writes, or scheduling while disabled", async () => {
    const db = new FakeDb();
    const scheduler = new FakeScheduler(db);
    addQuote(db);

    await expect(
      cleanupExpiredQuoteDataMutation(retentionCtx(db, scheduler), {
        retentionDays: null,
        now: 100_000,
      })
    ).resolves.toMatchObject({ enabled: false, deletedQuotes: 0 });
    expect(db.tables.quoteRequests).toHaveLength(1);
    expect(db.tables.quoteRetentionState).toHaveLength(0);
    expect(db.ioOperations).toBe(0);
    expect(scheduler.jobs).toHaveLength(0);
  });

  it("deletes only bound, delivered, terminal quotes and their owned children", async () => {
    const db = new FakeDb();
    const scheduler = new FakeScheduler(db);
    const eligible = addQuote(db);
    addOutbox(db, eligible);
    addTerminalChildren(db, eligible);
    addQuote(db, { _id: "quote-unsynced", crmSyncStatus: "dead_letter" });
    const queued = addQuote(db, {
      _id: "quote-queued",
      notificationStatus: "queued",
    });
    addOutbox(db, queued);
    const legacyEmailState = addQuote(db, {
      _id: "quote-missing-email-state",
      emailNotificationStatus: undefined,
    });
    addOutbox(db, legacyEmailState);

    const result = await runCleanup(db, scheduler);

    expect(result).toMatchObject({
      enabled: true,
      deletedQuotes: 1,
      deletedChildRows: 3,
      deferredQuotes: 2,
      sweepCompleted: true,
    });
    expect(db.tables.quoteRequests.map((row) => row._id)).toEqual([
      "quote-unsynced",
      "quote-queued",
      "quote-missing-email-state",
    ]);
    expect(db.tables.notificationAttempts).toHaveLength(0);
    expect(db.tables.quoteEmailNotificationAttempts).toHaveLength(0);
  });

  it("preserves child audit rows for missing, failed, unbound, or mislinked outboxes", async () => {
    const db = new FakeDb();
    const scheduler = new FakeScheduler(db);
    const missing = addQuote(db, { _id: "quote-missing-outbox" });
    const failed = addQuote(db, { _id: "quote-failed-outbox" });
    const unbound = addQuote(db, { _id: "quote-unbound-outbox" });
    const mislinked = addQuote(db, { _id: "quote-mislinked-outbox" });
    const wrongExternalId = addQuote(db, {
      _id: "quote-wrong-external-id",
    });
    addOutbox(db, failed, { status: "dead_letter" });
    addOutbox(db, unbound, { acknowledgementBindingVersion: undefined });
    addOutbox(db, mislinked);
    mislinked.crmSyncOutboxId = "outbox-for-another-quote";
    addOutbox(db, wrongExternalId, {
      externalSubmissionId: "shed210:quote:another-public-id",
    });
    for (const quote of [
      missing,
      failed,
      unbound,
      mislinked,
      wrongExternalId,
    ]) {
      addTerminalChildren(db, quote);
    }

    const result = await runCleanup(db, scheduler);

    expect(result).toMatchObject({
      deletedQuotes: 0,
      deletedChildRows: 0,
      deferredQuotes: 5,
    });
    expect(db.tables.quoteRequests).toHaveLength(5);
    expect(db.tables.notificationAttempts).toHaveLength(5);
    expect(db.tables.quoteEmailNotificationAttempts).toHaveLength(5);
  });

  it("deletes oversized child sets in bounded batches only after outbox validation", async () => {
    const db = new FakeDb();
    const scheduler = new FakeScheduler(db);
    const quote = addQuote(db);
    addOutbox(db, quote);
    addTerminalChildren(db, quote, QUOTE_RETENTION_CHILD_BATCH_SIZE + 1, 0);

    const result = await runCleanup(db, scheduler);

    expect(result).toMatchObject({
      deletedQuotes: 0,
      deletedChildRows: QUOTE_RETENTION_CHILD_BATCH_SIZE,
      deferredQuotes: 1,
    });
    expect(db.tables.quoteRequests).toHaveLength(1);
    expect(db.tables.crmQuoteSyncOutbox).toHaveLength(1);
    expect(db.tables.notificationAttempts).toHaveLength(1);
  });

  it("defers pending or cross-tenant child attempts", async () => {
    const db = new FakeDb();
    const scheduler = new FakeScheduler(db);
    const quote = addQuote(db);
    addOutbox(db, quote);
    db.tables.notificationAttempts.push({
      _id: "sms-pending",
      tenantId: quote.tenantId,
      quoteRequestId: quote._id,
      status: "pending",
    });
    db.tables.quoteEmailNotificationAttempts.push({
      _id: "email-wrong-tenant",
      tenantId: "tenant-2",
      quoteRequestId: quote._id,
      status: "sent",
    });

    const result = await runCleanup(db, scheduler);

    expect(result).toMatchObject({ deletedQuotes: 0, deferredQuotes: 1 });
    expect(db.tables.quoteRequests).toHaveLength(1);
    expect(db.tables.notificationAttempts).toHaveLength(1);
    expect(db.tables.quoteEmailNotificationAttempts).toHaveLength(1);
  });

  it("stays safely below the Convex IO cap for a worst-case deletion batch", async () => {
    expect(QUOTE_RETENTION_SCAN_BATCH_SIZE).toBeLessThanOrEqual(
      QUOTE_RETENTION_DELETE_BATCH_SIZE
    );
    const db = new FakeDb();
    const scheduler = new FakeScheduler(db);
    for (let index = 0; index < QUOTE_RETENTION_DELETE_BATCH_SIZE; index += 1) {
      const quote = addQuote(db);
      addOutbox(db, quote);
      addTerminalChildren(
        db,
        quote,
        QUOTE_RETENTION_CHILD_BATCH_SIZE,
        QUOTE_RETENTION_CHILD_BATCH_SIZE
      );
    }

    const result = await runCleanup(db, scheduler);

    expect(result.deletedQuotes).toBe(QUOTE_RETENTION_DELETE_BATCH_SIZE);
    expect(db.tables.quoteRequests).toHaveLength(0);
    expect(db.ioOperations).toBeLessThan(800);
    expect(db.ioOperations).toBeLessThan(1_000);
  });

  it("immediately drains a fixed-cutoff sweep larger than 250 quotes", async () => {
    const db = new FakeDb();
    const scheduler = new FakeScheduler(db);
    for (let index = 0; index < 251; index += 1) {
      const quote = addQuote(db);
      addOutbox(db, quote);
    }

    let result = await runCleanup(db, scheduler);
    let executions = 1;
    const initialCutoff = db.tables.quoteRetentionState[0]?.cutoff;
    while (scheduler.jobs.length > 0) {
      const continuation = scheduler.jobs.shift();
      if (!continuation) break;
      expect(continuation.delayMs).toBe(0);
      result = await runCleanup(
        db,
        scheduler,
        continuation.args,
        RETENTION_NOW + executions
      );
      executions += 1;
      if (executions > 100) throw new Error("Retention continuation did not converge");
    }

    expect(db.tables.quoteRequests).toHaveLength(0);
    expect(db.tables.crmQuoteSyncOutbox).toHaveLength(0);
    expect(db.tables.quoteRetentionState[0]).toMatchObject({
      cursor: null,
      cutoff: initialCutoff,
    });
    expect(result.sweepCompleted).toBe(true);
    expect(executions).toBe(Math.ceil(251 / QUOTE_RETENTION_DELETE_BATCH_SIZE));
    expect(scheduler.totalScheduled).toBe(executions - 1);
  });

  it("rejects a stale continuation after an overlapping cron advances the cursor", async () => {
    const db = new FakeDb();
    const scheduler = new FakeScheduler(db);
    for (let index = 0; index < QUOTE_RETENTION_DELETE_BATCH_SIZE * 2 + 1; index += 1) {
      const quote = addQuote(db);
      addOutbox(db, quote);
    }

    await runCleanup(db, scheduler);
    const staleContinuation = scheduler.jobs.shift();
    expect(staleContinuation).toBeDefined();

    await runCleanup(db, scheduler, {}, RETENTION_NOW + 1);
    const remainingBeforeStaleRun = db.tables.quoteRequests.length;
    const staleResult = await runCleanup(
      db,
      scheduler,
      staleContinuation?.args,
      RETENTION_NOW + 2
    );

    expect(staleResult).toMatchObject({ scannedQuotes: 0, deletedQuotes: 0 });
    expect(db.tables.quoteRequests).toHaveLength(remainingBeforeStaleRun);

    const currentContinuation = scheduler.jobs.shift();
    expect(currentContinuation).toBeDefined();
    await runCleanup(
      db,
      scheduler,
      currentContinuation?.args,
      RETENTION_NOW + 3
    );
    expect(db.tables.quoteRequests).toHaveLength(0);
  });
});
