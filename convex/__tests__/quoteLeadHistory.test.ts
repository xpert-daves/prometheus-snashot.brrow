import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  getQuoteLeadHistory,
  NO_LEAD_HISTORY,
  SAME_LEAD_LOOKBACK_LIMIT,
  SAME_LEAD_WINDOW_MS,
} from "../quoteLeadHistory";

type Quote = Doc<"quoteRequests">;
type Constraint = { kind: "eq" | "gte" | "lt"; field: string; value: unknown };

const NOW = Date.UTC(2026, 9, 1, 15, 0);
const PHONE = "+12105550100";

function readField(row: Quote, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((value, key) => (value as Record<string, unknown> | null)?.[key], row);
}

class FakeQuery {
  private constraints: Constraint[] = [];
  private direction: "asc" | "desc" = "asc";

  constructor(
    private readonly rows: Quote[],
    private readonly indexNames: string[]
  ) {}

  withIndex(name: string, build: (q: Record<Constraint["kind"], (field: string, value: unknown) => unknown>) => unknown) {
    this.indexNames.push(name);
    const builder = {
      eq: (field: string, value: unknown) => this.add("eq", field, value, builder),
      gte: (field: string, value: unknown) => this.add("gte", field, value, builder),
      lt: (field: string, value: unknown) => this.add("lt", field, value, builder),
    };
    build(builder);
    return this;
  }

  order(direction: "asc" | "desc") {
    this.direction = direction;
    return this;
  }

  async take(limit: number) {
    const matches = this.rows
      .filter((row) =>
        this.constraints.every(({ kind, field, value }) => {
          const actual = readField(row, field);
          if (kind === "eq") return actual === value;
          if (kind === "gte") return Number(actual) >= Number(value);
          return Number(actual) < Number(value);
        })
      )
      .sort((a, b) => a.createdAt - b.createdAt);
    if (this.direction === "desc") matches.reverse();
    return matches.slice(0, limit);
  }

  private add<T>(kind: Constraint["kind"], field: string, value: unknown, builder: T): T {
    this.constraints.push({ kind, field, value });
    return builder;
  }
}

function makeCtx(rows: Quote[]) {
  const indexNames: string[] = [];
  const ctx = {
    db: {
      query: (table: string) => {
        expect(table).toBe("quoteRequests");
        return new FakeQuery(rows, indexNames);
      },
    },
  } as unknown as QueryCtx;
  return { ctx, indexNames };
}

let nextId = 0;
function makeQuote(overrides: {
  createdAt: number;
  phone?: string | null;
  tenantId?: string;
  length?: number;
  total?: number;
  pending?: boolean;
}): Quote {
  nextId += 1;
  return {
    _id: `quote-${nextId}`,
    _creationTime: overrides.createdAt,
    tenantId: overrides.tenantId ?? "tenant-shed210",
    createdAt: overrides.createdAt,
    contact: {
      name: "Maria Garcia",
      email: "maria@example.com",
      phone: overrides.phone === undefined ? PHONE : overrides.phone,
    },
    inputs: {
      structureType: "storage_shed",
      length: overrides.length ?? 12,
      width: 8,
      addOns: [],
      deliveryRadius: 0,
    },
    pricing: {
      total: overrides.total ?? 2500,
      ...(overrides.pending ? { deliveryPricingStatus: "pending_verification" } : {}),
    },
  } as unknown as Quote;
}

describe("getQuoteLeadHistory", () => {
  it("returns no history for a first quote", async () => {
    const current = makeQuote({ createdAt: NOW });
    const { ctx, indexNames } = makeCtx([current]);

    await expect(getQuoteLeadHistory(ctx, current)).resolves.toEqual(NO_LEAD_HISTORY);
    expect(indexNames).toEqual(["by_tenant_id_and_contact_phone_and_created_at"]);
  });

  it("counts earlier quotes from the same phone and returns the most recent one", async () => {
    const oldest = makeQuote({ createdAt: NOW - 60 * 60_000, length: 8, total: 1800 });
    const latest = makeQuote({ createdAt: NOW - 10 * 60_000, length: 10, total: 2100, pending: true });
    const current = makeQuote({ createdAt: NOW });
    const { ctx } = makeCtx([oldest, latest, current]);

    await expect(getQuoteLeadHistory(ctx, current)).resolves.toEqual({
      earlierQuoteCount: 2,
      previous: {
        inputs: latest.inputs,
        total: 2100,
        deliveryPricingPending: true,
        createdAt: latest.createdAt,
      },
    });
  });

  it("ignores later quotes, other phones, other tenants, and quotes outside the window", async () => {
    const current = makeQuote({ createdAt: NOW });
    const { ctx } = makeCtx([
      current,
      makeQuote({ createdAt: NOW + 60_000 }),
      makeQuote({ createdAt: NOW - 60_000, phone: "+12105550199" }),
      makeQuote({ createdAt: NOW - 60_000, tenantId: "tenant-other" }),
      makeQuote({ createdAt: NOW - SAME_LEAD_WINDOW_MS - 1 }),
    ]);

    await expect(getQuoteLeadHistory(ctx, current)).resolves.toEqual(NO_LEAD_HISTORY);
  });

  it("caps the count at the lookback limit", async () => {
    const earlier = Array.from({ length: SAME_LEAD_LOOKBACK_LIMIT + 5 }, (_, index) =>
      makeQuote({ createdAt: NOW - (index + 1) * 60_000 })
    );
    const current = makeQuote({ createdAt: NOW });
    const { ctx } = makeCtx([...earlier, current]);

    const history = await getQuoteLeadHistory(ctx, current);

    expect(history.earlierQuoteCount).toBe(SAME_LEAD_LOOKBACK_LIMIT);
    expect(history.previous?.createdAt).toBe(NOW - 60_000);
  });

  it("skips the lookup when the quote has no phone", async () => {
    const current = makeQuote({ createdAt: NOW, phone: null });
    const { ctx, indexNames } = makeCtx([makeQuote({ createdAt: NOW - 60_000, phone: null }), current]);

    await expect(getQuoteLeadHistory(ctx, current)).resolves.toEqual(NO_LEAD_HISTORY);
    expect(indexNames).toEqual([]);
  });
});
