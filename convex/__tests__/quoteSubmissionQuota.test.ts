import type { MutationCtx } from "../_generated/server";
import { webcrypto } from "node:crypto";
import { TextEncoder } from "node:util";
import {
  consumeQuoteSubmissionQuotas,
  QUOTE_SUBMISSION_QUOTAS,
  QUOTE_SUBMISSION_RATE_LIMIT_CODE,
} from "../quoteSubmissionQuota";

Object.defineProperty(globalThis, "crypto", {
  configurable: true,
  value: webcrypto,
});
Object.defineProperty(globalThis, "TextEncoder", {
  configurable: true,
  value: TextEncoder,
});

type Bucket = {
  _id: string;
  tenantSlug: string;
  keyHash: string;
  windowStartMs: number;
  resetAt: number;
  count: number;
  updatedAt: number;
};

type Constraint =
  | { kind: "eq"; field: keyof Bucket; value: unknown }
  | { kind: "lt"; field: keyof Bucket; value: number };

class FakeQuery {
  private constraints: Constraint[] = [];

  constructor(private readonly db: FakeDb) {}

  withIndex(
    _name: string,
    apply: (builder: {
      eq: (field: keyof Bucket, value: unknown) => unknown;
      lt: (field: keyof Bucket, value: number) => unknown;
    }) => unknown
  ) {
    const builder = {
      eq: (field: keyof Bucket, value: unknown) => {
        this.constraints.push({ kind: "eq", field, value });
        return builder;
      },
      lt: (field: keyof Bucket, value: number) => {
        this.constraints.push({ kind: "lt", field, value });
        return builder;
      },
    };
    apply(builder);
    return this;
  }

  async unique() {
    const rows = this.matches();
    if (rows.length > 1) throw new Error("Expected unique bucket");
    return rows[0] ?? null;
  }

  async take(limit: number) {
    return this.matches().slice(0, limit);
  }

  private matches() {
    return this.db.buckets.filter((bucket) =>
      this.constraints.every((constraint) =>
        constraint.kind === "eq"
          ? bucket[constraint.field] === constraint.value
          : Number(bucket[constraint.field]) < constraint.value
      )
    );
  }
}

class FakeDb {
  buckets: Bucket[] = [];
  private nextId = 1;

  query(table: "quoteRateLimitBuckets") {
    expect(table).toBe("quoteRateLimitBuckets");
    return new FakeQuery(this);
  }

  async insert(
    table: "quoteRateLimitBuckets",
    value: Omit<Bucket, "_id">
  ) {
    expect(table).toBe("quoteRateLimitBuckets");
    const id = `bucket-${this.nextId++}`;
    this.buckets.push({ _id: id, ...value });
    return id;
  }

  async patch(id: string, value: Partial<Bucket>) {
    const bucket = this.buckets.find((candidate) => candidate._id === id);
    if (!bucket) throw new Error("Bucket not found");
    Object.assign(bucket, value);
  }

  async delete(id: string) {
    this.buckets = this.buckets.filter((bucket) => bucket._id !== id);
  }
}

function quotaCtx(db: FakeDb) {
  return { db } as unknown as MutationCtx;
}

function quotaArgs(index = 0) {
  return {
    tenantSlug: "shed210",
    contact: {
      email: `buyer-${index}@example.com`,
      phone: `+1210555${String(index).padStart(4, "0")}`,
    },
    sessionId: `session-${index}`,
    writeKey: "current-write-key",
    now: 1_714_000_000_000,
  };
}

describe("atomic quote submission quotas", () => {
  it("stores keyed hashes for every contact and circuit-breaker scope", async () => {
    const db = new FakeDb();
    await consumeQuoteSubmissionQuotas(quotaCtx(db), quotaArgs());

    expect(db.buckets.map((bucket) => bucket.keyHash.split(":")[0]).sort()).toEqual(
      [
        "email",
        "global",
        "globalDaily",
        "phone",
        "session",
        "tenant",
        "tenantDaily",
      ]
    );
    expect(JSON.stringify(db.buckets)).not.toContain("buyer-0@example.com");
    expect(JSON.stringify(db.buckets)).not.toContain("12105550000");
  });

  it("allows several configurations but blocks the eleventh use of one email", async () => {
    const db = new FakeDb();
    for (let index = 0; index < QUOTE_SUBMISSION_QUOTAS.email.maxRequests; index += 1) {
      const args = quotaArgs(index);
      args.contact.email = "repeat@example.com";
      await consumeQuoteSubmissionQuotas(quotaCtx(db), args);
    }

    const blocked = quotaArgs(99);
    blocked.contact.email = "repeat@example.com";
    await expect(
      consumeQuoteSubmissionQuotas(quotaCtx(db), blocked)
    ).rejects.toMatchObject({
      data: {
        code: QUOTE_SUBMISSION_RATE_LIMIT_CODE,
        retryAfterSeconds: expect.any(Number),
      },
    });
  });

  it("blocks the ninth submission from one session even with varied contacts", async () => {
    const db = new FakeDb();
    for (
      let index = 0;
      index < QUOTE_SUBMISSION_QUOTAS.session.maxRequests;
      index += 1
    ) {
      const args = quotaArgs(index);
      args.sessionId = "repeat-session";
      await consumeQuoteSubmissionQuotas(quotaCtx(db), args);
    }

    const blocked = quotaArgs(99);
    blocked.sessionId = "repeat-session";
    await expect(
      consumeQuoteSubmissionQuotas(quotaCtx(db), blocked)
    ).rejects.toMatchObject({
      data: {
        code: QUOTE_SUBMISSION_RATE_LIMIT_CODE,
        retryAfterSeconds: expect.any(Number),
        // One customer's own limit: nobody else is turned away.
        siteWide: false,
      },
    });
  });

  it("enforces the tenant circuit breaker across distinct contacts", async () => {
    const db = new FakeDb();
    for (
      let index = 0;
      index < QUOTE_SUBMISSION_QUOTAS.tenant.maxRequests;
      index += 1
    ) {
      await consumeQuoteSubmissionQuotas(quotaCtx(db), quotaArgs(index));
    }

    await expect(
      consumeQuoteSubmissionQuotas(quotaCtx(db), quotaArgs(999))
    ).rejects.toMatchObject({
      data: {
        code: QUOTE_SUBMISSION_RATE_LIMIT_CODE,
        retryAfterSeconds: expect.any(Number),
        // Every customer is turned away, so the site reports it.
        siteWide: true,
      },
    });
  });

  it("caps daily tenant fan-out cost across short-window resets", async () => {
    const db = new FakeDb();
    const fiveMinutes = QUOTE_SUBMISSION_QUOTAS.tenant.windowMs;
    const dailyWindow = QUOTE_SUBMISSION_QUOTAS.tenantDaily.windowMs;
    const dayStart =
      Math.floor(quotaArgs().now / dailyWindow) * dailyWindow;
    for (
      let index = 0;
      index < QUOTE_SUBMISSION_QUOTAS.tenantDaily.maxRequests;
      index += 1
    ) {
      const args = quotaArgs(index);
      args.now = dayStart + index * fiveMinutes;
      await consumeQuoteSubmissionQuotas(quotaCtx(db), args);
    }

    const blocked = quotaArgs(999);
    blocked.now =
      dayStart +
      QUOTE_SUBMISSION_QUOTAS.tenantDaily.maxRequests * fiveMinutes;
    await expect(
      consumeQuoteSubmissionQuotas(quotaCtx(db), blocked)
    ).rejects.toMatchObject({
      data: {
        code: QUOTE_SUBMISSION_RATE_LIMIT_CODE,
        retryAfterSeconds: expect.any(Number),
      },
    });
  });

  it("caps daily global fan-out across distinct tenants", async () => {
    const db = new FakeDb();
    const fiveMinutes = QUOTE_SUBMISSION_QUOTAS.global.windowMs;
    const dailyWindow = QUOTE_SUBMISSION_QUOTAS.globalDaily.windowMs;
    const dayStart =
      Math.floor(quotaArgs().now / dailyWindow) * dailyWindow;
    for (
      let index = 0;
      index < QUOTE_SUBMISSION_QUOTAS.globalDaily.maxRequests;
      index += 1
    ) {
      const args = quotaArgs(index);
      args.tenantSlug = `tenant-${index}`;
      args.now = dayStart + index * fiveMinutes;
      await consumeQuoteSubmissionQuotas(quotaCtx(db), args);
    }

    const blocked = quotaArgs(999);
    blocked.tenantSlug = "tenant-blocked";
    blocked.now =
      dayStart +
      QUOTE_SUBMISSION_QUOTAS.globalDaily.maxRequests * fiveMinutes;
    await expect(
      consumeQuoteSubmissionQuotas(quotaCtx(db), blocked)
    ).rejects.toMatchObject({
      data: {
        code: QUOTE_SUBMISSION_RATE_LIMIT_CODE,
        retryAfterSeconds: expect.any(Number),
      },
    });
  });
});
