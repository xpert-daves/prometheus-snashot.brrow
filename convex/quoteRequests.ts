import { internal } from "./_generated/api";
import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v, type Infer } from "convex/values";
import {
  quoteContactValidator,
  quoteInputsValidator,
  quotePricingValidator,
  quoteSmsConsentValidator,
} from "./validators";
import { assertQuotePricingProvenance } from "./quotePricingProvenance";
import {
  getShed210TenantIdForExistingWrite,
  normalizeTenantSlug,
  SHED210_TENANT_SLUG,
  setActiveTenantContextBySlug,
  tenantIdFields,
} from "./platformTenancy";
import { enqueueCrmQuoteSyncOutbox } from "./crmQuoteSync";
import {
  getCurrentQuoteWriteKey,
  requireQuoteWriteKey,
} from "./quoteAccess";
import { consumeQuoteSubmissionQuotas } from "./quoteSubmissionQuota";
import { quoteMeasurementValidator } from "./quoteMeasurement";

type CreateQuoteRequestArgs = {
  writeKey: string;
  tenantSlug?: string;
  publicId: string;
  sessionId: string;
  discussionTokenHash?: string;
  discussionTokenExpiresAt?: number;
  measurement?: Infer<typeof quoteMeasurementValidator>;
  contact: Infer<typeof quoteContactValidator>;
  smsConsent?: Infer<typeof quoteSmsConsentValidator>;
  smsMarketingConsent?: Infer<typeof quoteSmsConsentValidator>;
  inputs: Infer<typeof quoteInputsValidator>;
  pricing: Infer<typeof quotePricingValidator>;
};

const DELIVERY_ADDRESS_MAX_LENGTH = 255;
const RATE_LIMIT_CLEANUP_BATCH_SIZE = 25;

function positiveInteger(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  const integer = Math.trunc(value);
  return integer > 0 ? integer : fallback;
}

async function cleanupExpiredQuoteRateLimitBuckets(ctx: MutationCtx, now: number) {
  const expiredBuckets = await ctx.db
    .query("quoteRateLimitBuckets")
    .withIndex("by_reset_at", (query) => query.lt("resetAt", now))
    .take(RATE_LIMIT_CLEANUP_BATCH_SIZE);

  for (const bucket of expiredBuckets) {
    await ctx.db.delete(bucket._id);
  }
}

function normalizeQuoteInputs(
  inputs: CreateQuoteRequestArgs["inputs"]
): CreateQuoteRequestArgs["inputs"] {
  const deliveryAddress = inputs.deliveryAddress?.trim();

  if (deliveryAddress && deliveryAddress.length > DELIVERY_ADDRESS_MAX_LENGTH) {
    throw new Error(
      `Install address must be ${DELIVERY_ADDRESS_MAX_LENGTH} characters or less`
    );
  }

  if (!deliveryAddress) {
    const normalizedInputs = { ...inputs };
    delete normalizedInputs.deliveryAddress;
    return normalizedInputs;
  }

  return { ...inputs, deliveryAddress };
}

export async function createQuoteRequestMutation(
  ctx: MutationCtx,
  args: CreateQuoteRequestArgs
) {
  requireQuoteWriteKey(args.writeKey);
  assertQuotePricingProvenance(args.pricing.config);
  if (args.discussionTokenHash !== undefined || args.discussionTokenExpiresAt !== undefined) {
    if (!/^[a-f0-9]{64}$/.test(args.discussionTokenHash ?? "") ||
        !Number.isFinite(args.discussionTokenExpiresAt) ||
        (args.discussionTokenExpiresAt ?? 0) <= Date.now()) {
      throw new Error("Invalid discussion capability");
    }
  }

  if (args.tenantSlug) await setActiveTenantContextBySlug(ctx, args.tenantSlug);

  const tenantId = await getShed210TenantIdForExistingWrite(ctx);
  const existing = tenantId
    ? await ctx.db
        .query("quoteRequests")
        .withIndex("by_tenant_id_and_public_id", (query) =>
          query.eq("tenantId", tenantId).eq("publicId", args.publicId)
        )
        .unique()
    : null;

  if (existing) {
    return {
      publicId: existing.publicId,
      quoteRequestId: existing._id,
    };
  }

  const now = Date.now();
  const currentWriteKey = getCurrentQuoteWriteKey();
  if (!currentWriteKey) throw new Error("Unauthorized quote write");
  await consumeQuoteSubmissionQuotas(ctx, {
    tenantSlug: normalizeTenantSlug(args.tenantSlug),
    contact: args.contact,
    sessionId: args.sessionId,
    writeKey: currentWriteKey,
    now,
  });

  const requiredTenant = tenantIdFields(tenantId);
  const quoteRequestId = await ctx.db.insert("quoteRequests", {
    ...requiredTenant,
    publicId: args.publicId,
    sessionId: args.sessionId,
    measurement: args.measurement,
    ...(args.discussionTokenHash ? {
      discussionTokenHash: args.discussionTokenHash,
      discussionTokenExpiresAt: args.discussionTokenExpiresAt,
    } : {}),
    contact: args.contact,
    smsConsent: args.smsConsent,
    smsMarketingConsent: args.smsMarketingConsent,
    inputs: normalizeQuoteInputs(args.inputs),
    pricing: args.pricing,
    notificationStatus: "queued",
    notificationQueuedAt: now,
    emailNotificationStatus: "queued",
    emailNotificationQueuedAt: now,
    createdAt: now,
  });

  const crmSyncOutboxId =
    normalizeTenantSlug(args.tenantSlug ?? SHED210_TENANT_SLUG) ===
    SHED210_TENANT_SLUG
      ? await enqueueCrmQuoteSyncOutbox(ctx, {
          tenantId: requiredTenant.tenantId,
          quoteRequestId,
          publicId: args.publicId,
        })
      : null;

  await ctx.scheduler.runAfter(0, internal.notifications.sendQuoteSms, {
    quoteRequestId,
  });
  await ctx.scheduler.runAfter(0, internal.notifications.sendQuoteEmailAlerts, {
    quoteRequestId,
  });
  if (crmSyncOutboxId) {
    await ctx.scheduler.runAfter(0, internal.crmQuoteSync.sendQuoteToCrm, {
      outboxId: crmSyncOutboxId,
    });
  }

  return { publicId: args.publicId, quoteRequestId };
}

export const create = mutation({
  args: {
    writeKey: v.string(),
    tenantSlug: v.optional(v.string()),
    publicId: v.string(),
    sessionId: v.string(),
    discussionTokenHash: v.optional(v.string()),
    discussionTokenExpiresAt: v.optional(v.number()),
    measurement: v.optional(quoteMeasurementValidator),
    contact: quoteContactValidator,
    smsConsent: v.optional(quoteSmsConsentValidator),
    smsMarketingConsent: v.optional(quoteSmsConsentValidator),
    inputs: quoteInputsValidator,
    pricing: quotePricingValidator,
  },
  returns: v.object({
    publicId: v.string(),
    quoteRequestId: v.id("quoteRequests"),
  }),
  handler: createQuoteRequestMutation,
});

export async function checkQuoteRateLimitMutation(
  ctx: MutationCtx,
  args: {
    writeKey: string;
    tenantSlug: string;
    keyHash: string;
    now: number;
    windowMs: number;
    maxRequests: number;
  }
) {
  requireQuoteWriteKey(args.writeKey);

  const now = Number.isFinite(args.now) ? Math.trunc(args.now) : Date.now();
  const windowMs = positiveInteger(args.windowMs, 60_000);
  const maxRequests = positiveInteger(args.maxRequests, 10);
  const windowStartMs = Math.floor(now / windowMs) * windowMs;
  const resetAt = windowStartMs + windowMs;

  await cleanupExpiredQuoteRateLimitBuckets(ctx, now);

  const bucket = (
    await ctx.db
      .query("quoteRateLimitBuckets")
      .withIndex("by_tenant_slug_and_key_hash_and_window_start_ms", (query) =>
        query
          .eq("tenantSlug", args.tenantSlug)
          .eq("keyHash", args.keyHash)
          .eq("windowStartMs", windowStartMs)
      )
      .take(1)
  )[0];

  if (!bucket) {
    await ctx.db.insert("quoteRateLimitBuckets", {
      tenantSlug: args.tenantSlug,
      keyHash: args.keyHash,
      windowStartMs,
      resetAt,
      count: 1,
      updatedAt: now,
    });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= maxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  await ctx.db.patch(bucket._id, {
    count: bucket.count + 1,
    updatedAt: now,
  });

  return { allowed: true, retryAfterSeconds: 0 };
}

export const checkQuoteRateLimit = mutation({
  args: {
    writeKey: v.string(),
    tenantSlug: v.string(),
    keyHash: v.string(),
    now: v.number(),
    windowMs: v.number(),
    maxRequests: v.number(),
  },
  returns: v.object({
    allowed: v.boolean(),
    retryAfterSeconds: v.number(),
  }),
  handler: checkQuoteRateLimitMutation,
});
