import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { ConvexError } from "convex/values";

export const QUOTE_SUBMISSION_RATE_LIMIT_CODE = "QUOTE_RATE_LIMITED";

export const QUOTE_SUBMISSION_QUOTAS = {
  email: { windowMs: 60 * 60_000, maxRequests: 10 },
  phone: { windowMs: 60 * 60_000, maxRequests: 10 },
  session: { windowMs: 15 * 60_000, maxRequests: 8 },
  tenant: { windowMs: 5 * 60_000, maxRequests: 30 },
  tenantDaily: { windowMs: 24 * 60 * 60_000, maxRequests: 100 },
  global: { windowMs: 5 * 60_000, maxRequests: 100 },
  globalDaily: { windowMs: 24 * 60 * 60_000, maxRequests: 250 },
} as const;

const GLOBAL_QUOTA_TENANT_SLUG = "__global__";
const QUOTA_CLEANUP_BATCH_SIZE = 25;

type QuotaScope = keyof typeof QUOTE_SUBMISSION_QUOTAS;
// A full one of these turns away every customer, not just the one who sent
// too many, so the site reports it and tells the customer to call instead.
const SITE_WIDE_QUOTA_SCOPES: ReadonlySet<QuotaScope> = new Set([
  "tenant",
  "tenantDaily",
  "global",
  "globalDaily",
]);
type QuotaDescriptor = {
  scope: QuotaScope;
  tenantSlug: string;
  keyHash: string;
  windowStartMs: number;
  resetAt: number;
  maxRequests: number;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits || null;
}

async function keyedQuotaHash(
  writeKey: string,
  scope: QuotaScope,
  value: string
) {
  const input = new TextEncoder().encode(`${writeKey}\0${scope}\0${value}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return `${scope}:${Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("")}`;
}

async function quotaDescriptor(args: {
  scope: QuotaScope;
  tenantSlug: string;
  value: string;
  writeKey: string;
  now: number;
}): Promise<QuotaDescriptor> {
  const limits = QUOTE_SUBMISSION_QUOTAS[args.scope];
  const windowStartMs =
    Math.floor(args.now / limits.windowMs) * limits.windowMs;
  return {
    scope: args.scope,
    tenantSlug: args.tenantSlug,
    keyHash: await keyedQuotaHash(args.writeKey, args.scope, args.value),
    windowStartMs,
    resetAt: windowStartMs + limits.windowMs,
    maxRequests: limits.maxRequests,
  };
}

async function buildQuotaDescriptors(args: {
  tenantSlug: string;
  contact: { email: string; phone: string | null };
  sessionId: string;
  writeKey: string;
  now: number;
}) {
  const requests: Array<Promise<QuotaDescriptor>> = [];
  const email = normalizeEmail(args.contact.email);
  if (email) {
    requests.push(
      quotaDescriptor({
        scope: "email",
        tenantSlug: args.tenantSlug,
        value: email,
        writeKey: args.writeKey,
        now: args.now,
      })
    );
  }

  const phone = normalizePhone(args.contact.phone);
  if (phone) {
    requests.push(
      quotaDescriptor({
        scope: "phone",
        tenantSlug: args.tenantSlug,
        value: phone,
        writeKey: args.writeKey,
        now: args.now,
      })
    );
  }

  const sessionId = args.sessionId.trim().toLowerCase();
  if (sessionId) {
    requests.push(
      quotaDescriptor({
        scope: "session",
        tenantSlug: args.tenantSlug,
        value: sessionId,
        writeKey: args.writeKey,
        now: args.now,
      })
    );
  }

  requests.push(
    quotaDescriptor({
      scope: "tenant",
      tenantSlug: args.tenantSlug,
      value: args.tenantSlug,
      writeKey: args.writeKey,
      now: args.now,
    }),
    quotaDescriptor({
      scope: "tenantDaily",
      tenantSlug: args.tenantSlug,
      value: args.tenantSlug,
      writeKey: args.writeKey,
      now: args.now,
    }),
    quotaDescriptor({
      scope: "global",
      tenantSlug: GLOBAL_QUOTA_TENANT_SLUG,
      value: "all-tenants",
      writeKey: args.writeKey,
      now: args.now,
    }),
    quotaDescriptor({
      scope: "globalDaily",
      tenantSlug: GLOBAL_QUOTA_TENANT_SLUG,
      value: "all-tenants",
      writeKey: args.writeKey,
      now: args.now,
    })
  );

  return await Promise.all(requests);
}

async function loadQuotaBucket(ctx: MutationCtx, quota: QuotaDescriptor) {
  return await ctx.db
    .query("quoteRateLimitBuckets")
    .withIndex(
      "by_tenant_slug_and_key_hash_and_window_start_ms",
      (query) =>
        query
          .eq("tenantSlug", quota.tenantSlug)
          .eq("keyHash", quota.keyHash)
          .eq("windowStartMs", quota.windowStartMs)
    )
    .unique();
}

async function cleanupExpiredQuotaBuckets(ctx: MutationCtx, now: number) {
  const expired = await ctx.db
    .query("quoteRateLimitBuckets")
    .withIndex("by_reset_at", (query) => query.lt("resetAt", now))
    .take(QUOTA_CLEANUP_BATCH_SIZE);
  for (const bucket of expired) await ctx.db.delete(bucket._id);
}

export async function consumeQuoteSubmissionQuotas(
  ctx: MutationCtx,
  args: {
    tenantSlug: string;
    contact: { email: string; phone: string | null };
    sessionId: string;
    writeKey: string;
    now: number;
  }
) {
  const quotas = await buildQuotaDescriptors(args);
  const buckets: Array<Doc<"quoteRateLimitBuckets"> | null> = [];
  for (const quota of quotas) {
    buckets.push(await loadQuotaBucket(ctx, quota));
  }

  const blockedQuotas = quotas.filter((quota, index) => {
    const bucket = buckets[index];
    return bucket !== null && bucket.count >= quota.maxRequests;
  });
  if (blockedQuotas.length > 0) {
    const retryAfterSeconds = Math.max(
      1,
      ...blockedQuotas.map((quota) =>
        Math.ceil((quota.resetAt - args.now) / 1_000)
      )
    );
    throw new ConvexError({
      code: QUOTE_SUBMISSION_RATE_LIMIT_CODE,
      retryAfterSeconds,
      siteWide: blockedQuotas.some((quota) =>
        SITE_WIDE_QUOTA_SCOPES.has(quota.scope)
      ),
    });
  }

  await cleanupExpiredQuotaBuckets(ctx, args.now);

  for (const [index, quota] of quotas.entries()) {
    const bucket = buckets[index];
    if (bucket) {
      await ctx.db.patch(bucket._id, {
        count: bucket.count + 1,
        updatedAt: args.now,
      });
      continue;
    }

    await ctx.db.insert("quoteRateLimitBuckets", {
      tenantSlug: quota.tenantSlug,
      keyHash: quota.keyHash,
      windowStartMs: quota.windowStartMs,
      resetAt: quota.resetAt,
      count: 1,
      updatedAt: args.now,
    });
  }
}
