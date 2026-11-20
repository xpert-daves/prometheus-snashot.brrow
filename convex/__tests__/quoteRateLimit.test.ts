import type { MutationCtx } from "../_generated/server";
import { checkQuoteRateLimitMutation } from "../quoteRequests";

type QuoteRateLimitBucket = {
  _id: string;
  tenantSlug: string;
  keyHash: string;
  windowStartMs: number;
  resetAt: number;
  count: number;
  updatedAt: number;
};

type Constraint =
  | { kind: "eq"; field: keyof QuoteRateLimitBucket; value: unknown }
  | { kind: "lt"; field: keyof QuoteRateLimitBucket; value: number };

class FakeQuoteRateLimitQuery {
  private constraints: Constraint[] = [];
  private indexName: string | null = null;

  constructor(private readonly db: FakeQuoteRateLimitDb) {}

  withIndex(
    indexName: string,
    apply: (query: {
      eq: (field: keyof QuoteRateLimitBucket, value: unknown) => unknown;
      lt: (field: keyof QuoteRateLimitBucket, value: number) => unknown;
    }) => unknown
  ) {
    this.indexName = indexName;
    this.db.indexesUsed.push(indexName);
    const builder = {
      eq: (field: keyof QuoteRateLimitBucket, value: unknown) => {
        this.constraints.push({ kind: "eq", field, value });
        return builder;
      },
      lt: (field: keyof QuoteRateLimitBucket, value: number) => {
        this.constraints.push({ kind: "lt", field, value });
        return builder;
      },
    };
    apply(builder);
    return this;
  }

  async take(limit: number) {
    let rows = this.db.buckets.filter((bucket) =>
      this.constraints.every((constraint) => {
        if (constraint.kind === "eq") {
          return bucket[constraint.field] === constraint.value;
        }
        return Number(bucket[constraint.field]) < constraint.value;
      })
    );

    if (this.indexName === "by_reset_at") {
      rows = [...rows].sort((a, b) => a.resetAt - b.resetAt);
    }

    return rows.slice(0, limit);
  }
}

class FakeQuoteRateLimitDb {
  buckets: QuoteRateLimitBucket[] = [];
  indexesUsed: string[] = [];
  private nextId = 1;

  query(table: "quoteRateLimitBuckets") {
    expect(table).toBe("quoteRateLimitBuckets");
    return new FakeQuoteRateLimitQuery(this);
  }

  async insert(table: "quoteRateLimitBuckets", doc: Omit<QuoteRateLimitBucket, "_id">) {
    expect(table).toBe("quoteRateLimitBuckets");
    const row = { _id: `bucket-${this.nextId++}`, ...doc };
    this.buckets.push(row);
    return row._id;
  }

  async patch(id: string, patch: Partial<QuoteRateLimitBucket>) {
    const row = this.buckets.find((bucket) => bucket._id === id);
    if (!row) throw new Error(`Missing bucket ${id}`);
    Object.assign(row, patch);
  }

  async delete(id: string) {
    this.buckets = this.buckets.filter((bucket) => bucket._id !== id);
  }
}

function ctxWithDb(db: FakeQuoteRateLimitDb) {
  return { db } as unknown as MutationCtx;
}

function defaultArgs(overrides: Partial<Parameters<typeof checkQuoteRateLimitMutation>[1]> = {}) {
  return {
    writeKey: "test-write-key",
    tenantSlug: "shed210",
    keyHash: "hash-1",
    now: 45_000,
    windowMs: 60_000,
    maxRequests: 10,
    ...overrides,
  };
}

describe("quote rate limit Convex mutation", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      CONVEX_QUOTE_WRITE_KEY: "test-write-key",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("allows the first request in a tenant/key window and uses indexed reads", async () => {
    const db = new FakeQuoteRateLimitDb();

    const result = await checkQuoteRateLimitMutation(ctxWithDb(db), defaultArgs());

    expect(result).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(db.buckets).toMatchObject([
      {
        tenantSlug: "shed210",
        keyHash: "hash-1",
        windowStartMs: 0,
        resetAt: 60_000,
        count: 1,
        updatedAt: 45_000,
      },
    ]);
    expect(db.indexesUsed).toEqual([
      "by_reset_at",
      "by_tenant_slug_and_key_hash_and_window_start_ms",
    ]);
  });

  it("blocks requests once the bucket reaches the configured maximum", async () => {
    const db = new FakeQuoteRateLimitDb();
    db.buckets.push({
      _id: "bucket-existing",
      tenantSlug: "shed210",
      keyHash: "hash-1",
      windowStartMs: 0,
      resetAt: 60_000,
      count: 10,
      updatedAt: 44_000,
    });

    const result = await checkQuoteRateLimitMutation(ctxWithDb(db), defaultArgs());

    expect(result).toEqual({ allowed: false, retryAfterSeconds: 15 });
    expect(db.buckets[0].count).toBe(10);
  });

  it("starts a fresh bucket after the prior window has reset", async () => {
    const db = new FakeQuoteRateLimitDb();
    db.buckets.push({
      _id: "bucket-old",
      tenantSlug: "shed210",
      keyHash: "hash-1",
      windowStartMs: 0,
      resetAt: 60_000,
      count: 10,
      updatedAt: 45_000,
    });

    const result = await checkQuoteRateLimitMutation(
      ctxWithDb(db),
      defaultArgs({ now: 60_001 })
    );

    expect(result.allowed).toBe(true);
    expect(db.buckets).toMatchObject([
      {
        tenantSlug: "shed210",
        keyHash: "hash-1",
        windowStartMs: 60_000,
        count: 1,
      },
    ]);
  });

  it("cleans up expired buckets in bounded batches", async () => {
    const db = new FakeQuoteRateLimitDb();
    for (let index = 0; index < 30; index += 1) {
      db.buckets.push({
        _id: `expired-${index}`,
        tenantSlug: "shed210",
        keyHash: `old-${index}`,
        windowStartMs: 0,
        resetAt: 1_000 + index,
        count: 1,
        updatedAt: 1_000,
      });
    }

    await checkQuoteRateLimitMutation(
      ctxWithDb(db),
      defaultArgs({ keyHash: "current", now: 120_000 })
    );

    expect(db.buckets.filter((bucket) => bucket._id.startsWith("expired-"))).toHaveLength(
      5
    );
    expect(db.buckets.some((bucket) => bucket.keyHash === "current")).toBe(true);
  });

  it("rejects calls without the matching quote write key", async () => {
    const db = new FakeQuoteRateLimitDb();

    await expect(
      checkQuoteRateLimitMutation(
        ctxWithDb(db),
        defaultArgs({ writeKey: "wrong-key" })
      )
    ).rejects.toThrow("Unauthorized quote write");
    expect(db.buckets).toHaveLength(0);
  });
});
