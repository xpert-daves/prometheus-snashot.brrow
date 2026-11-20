import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { requireQuoteWriteKey } from "./quoteAccess";
import { getShed210Tenant } from "./platformTenancy";
import { CRM_QUOTE_ACKNOWLEDGEMENT_BINDING_VERSION } from "./validators";
import {
  CRM_QUOTE_SYNC_CONFIGURATION_RETRY_STATUSES,
  CRM_QUOTE_SYNC_RETRY_DELAYS_MS,
  CRM_QUOTE_SYNC_PROCESSING_STALE_MS,
  CRM_QUOTE_SYNC_REQUEST_TIMEOUT_MS,
  isCrmQuoteSyncEnabled,
  validateCrmQuoteSyncConfiguration,
} from "./crmQuoteSync";

const requestIdArgs = { requestId: v.id("quoteDiscussionRequests") };
const receiptValidator = v.object({
  ok: v.literal(true), requestId: v.string(),
  status: v.union(v.literal("created"), v.literal("deduped")),
});
const payloadValidator = v.object({
  version: v.literal(1), tenantSlug: v.literal("shed210"),
  externalRequestId: v.string(), quoteExternalSubmissionId: v.string(),
  publicId: v.string(), sourceDocumentId: v.string(), requestedAt: v.number(),
});
type DiscussionPayload = {
  version: 1; tenantSlug: "shed210"; externalRequestId: string;
  quoteExternalSubmissionId: string; publicId: string;
  sourceDocumentId: string; requestedAt: number;
};

// Nothing retries a dead letter automatically, so leave a log line; ids and status only, no contact data.
function logDiscussionDeadLetter(row: Doc<"quoteDiscussionRequests">, attemptNumber: number, error: string) {
  console.error("CRM quote discussion dead-lettered", {
    requestId: row._id, quoteRequestId: row.quoteRequestId, attemptNumber, error,
  });
}

export async function requestDiscussionMutation(ctx: MutationCtx, args: {
  writeKey: string; tenantSlug: string; publicId: string; tokenHash: string;
}) {
  requireQuoteWriteKey(args.writeKey);
  const tenant = args.tenantSlug === "shed210" ? await getShed210Tenant(ctx) : null;
  if (!tenant?.active) throw new ConvexError("DISCUSSION_UNAUTHORIZED");
  const quote = await ctx.db.query("quoteRequests")
    .withIndex("by_tenant_id_and_public_id", q => q.eq("tenantId", tenant._id).eq("publicId", args.publicId))
    .unique();
  if (!quote?.discussionTokenHash || !/^[a-f0-9]{64}$/.test(args.tokenHash) ||
      quote.discussionTokenHash !== args.tokenHash) {
    throw new ConvexError("DISCUSSION_UNAUTHORIZED");
  }
  const existing = await ctx.db.query("quoteDiscussionRequests")
    .withIndex("by_quote_request_id", q => q.eq("quoteRequestId", quote._id)).unique();
  // A lost response can be acknowledged after expiry; it cannot create another event.
  if (existing?.tenantId === tenant._id) {
    return { ok: true as const, requestId: existing.externalRequestId, status: "deduped" as const };
  }
  const now = Date.now();
  if (!quote.discussionTokenExpiresAt || quote.discussionTokenExpiresAt <= now) {
    throw new ConvexError("DISCUSSION_EXPIRED");
  }
  const externalRequestId = `shed210:quote-discussion:${quote.publicId}`;
  const requestId = await ctx.db.insert("quoteDiscussionRequests", {
    tenantId: tenant._id, quoteRequestId: quote._id, externalRequestId,
    requestedAt: now, status: "pending", attemptCount: 0, nextAttemptAt: now,
    smsAlertStatus: "queued", emailAlertStatus: "queued",
  });
  await ctx.scheduler.runAfter(0, internal.quoteDiscussions.deliver, { requestId });
  // Staff alerts go out on the tap itself; they do not wait on CRM delivery.
  const alertArgs = { quoteRequestId: quote._id, scheduleRequestId: requestId };
  await ctx.scheduler.runAfter(0, internal.notifications.sendScheduleRequestSms, alertArgs);
  await ctx.scheduler.runAfter(0, internal.notifications.sendScheduleRequestEmailAlerts, alertArgs);
  return { ok: true as const, requestId: externalRequestId, status: "created" as const };
}

export const requestDiscussion = mutation({
  args: { writeKey: v.string(), tenantSlug: v.string(), publicId: v.string(), tokenHash: v.string() },
  returns: receiptValidator, handler: requestDiscussionMutation,
});

export async function claimDiscussionMutation(ctx: MutationCtx, args: { requestId: Id<"quoteDiscussionRequests"> }) {
  const row = await ctx.db.get(args.requestId);
  const now = Date.now();
  if (!row || !["pending", "retry_scheduled"].includes(row.status) || (row.nextAttemptAt ?? 0) > now) return null;
  const tenant = await getShed210Tenant(ctx);
  const quote = await ctx.db.get(row.quoteRequestId);
  const parent = quote?.crmSyncOutboxId ? await ctx.db.get(quote.crmSyncOutboxId) : null;
  if (!tenant?.active || row.tenantId !== tenant._id || quote?.tenantId !== tenant._id ||
      row.externalRequestId !== `shed210:quote-discussion:${quote.publicId}`) {
    await ctx.db.patch(row._id, { status: "dead_letter", lastError: "Quote identity unavailable" });
    logDiscussionDeadLetter(row, row.attemptCount, "Quote identity unavailable");
    return null;
  }
  if (!parent || parent.status !== "succeeded" || parent.tenantId !== tenant._id ||
      parent.quoteRequestId !== quote._id || parent.externalSubmissionId !== `shed210:quote:${quote.publicId}` ||
      parent.acknowledgementBindingVersion !== CRM_QUOTE_ACKNOWLEDGEMENT_BINDING_VERSION) {
    // Waiting on the original quote must not exhaust discussion delivery retries.
    await ctx.db.patch(row._id, { nextAttemptAt: now + 60_000, lastError: "Waiting for quote delivery" });
    return null;
  }
  const attemptNumber = row.attemptCount + 1;
  await ctx.db.patch(row._id, { status: "processing", attemptCount: attemptNumber, lastAttemptAt: now, nextAttemptAt: undefined });
  return {
    attemptNumber,
    payload: {
      version: 1 as const, tenantSlug: "shed210" as const,
      externalRequestId: row.externalRequestId, quoteExternalSubmissionId: parent.externalSubmissionId,
      publicId: quote.publicId, sourceDocumentId: String(quote._id), requestedAt: row.requestedAt,
    },
  };
}

export const claim = internalMutation({
  args: requestIdArgs,
  returns: v.union(v.null(), v.object({ attemptNumber: v.number(), payload: payloadValidator })),
  handler: claimDiscussionMutation,
});

type Completion = { requestId: Id<"quoteDiscussionRequests">; attemptNumber: number; outcome: "succeeded" | "retryable" | "permanent"; error?: string };
export async function completeDiscussionMutation(ctx: MutationCtx, args: Completion) {
  const row = await ctx.db.get(args.requestId);
  if (!row || row.status !== "processing" || row.attemptCount !== args.attemptNumber) return null;
  if (args.outcome === "succeeded") {
    await ctx.db.patch(row._id, { status: "succeeded", completedAt: Date.now(), lastError: undefined });
    return null;
  }
  const delay = CRM_QUOTE_SYNC_RETRY_DELAYS_MS[args.attemptNumber - 1];
  const retry = args.outcome === "retryable" && delay !== undefined;
  const lastError = args.error?.slice(0, 200) ?? "Delivery failed";
  await ctx.db.patch(row._id, {
    status: retry ? "retry_scheduled" : "dead_letter",
    nextAttemptAt: retry ? Date.now() + delay : undefined,
    lastError,
  });
  if (retry) await ctx.scheduler.runAfter(delay, internal.quoteDiscussions.deliver, { requestId: row._id });
  else logDiscussionDeadLetter(row, args.attemptNumber, lastError);
  return null;
}
export const complete = internalMutation({
  args: { ...requestIdArgs, attemptNumber: v.number(), outcome: v.union(v.literal("succeeded"), v.literal("retryable"), v.literal("permanent")), error: v.optional(v.string()) },
  returns: v.null(), handler: completeDiscussionMutation,
});

export function isDiscussionAcknowledgement(value: unknown, expected: DiscussionPayload): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const ack = value as Record<string, unknown>;
  return ack.ok === true && (ack.status === "created" || ack.status === "deduped") &&
    ack.tenantSlug === expected.tenantSlug && ack.externalRequestId === expected.externalRequestId &&
    ack.quoteExternalSubmissionId === expected.quoteExternalSubmissionId &&
    ack.publicId === expected.publicId && ack.sourceDocumentId === expected.sourceDocumentId;
}

export async function postDiscussion(endpointUrl: string, intakeKey: string, payload: DiscussionPayload): Promise<Pick<Completion, "outcome" | "error">> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CRM_QUOTE_SYNC_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(endpointUrl, {
      method: "POST", redirect: "error", signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${intakeKey}`, "Idempotency-Key": payload.externalRequestId },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      const ack: unknown = await response.json().catch(() => null);
      return isDiscussionAcknowledgement(ack, payload)
        ? { outcome: "succeeded" }
        : { outcome: "retryable", error: "CRM acknowledgement mismatch" };
    }
    return {
      outcome: response.status >= 500 || [408, 429, ...CRM_QUOTE_SYNC_CONFIGURATION_RETRY_STATUSES].includes(response.status)
        ? "retryable" : "permanent",
      error: `CRM HTTP ${response.status}`,
    };
  } catch {
    return { outcome: "retryable", error: "CRM request failed or timed out" };
  } finally { clearTimeout(timeout); }
}

export const deliver = internalAction({
  args: requestIdArgs, returns: v.null(),
  handler: async (ctx, args) => {
    if (!isCrmQuoteSyncEnabled()) return null;
    const config = validateCrmQuoteSyncConfiguration({ endpointUrl: process.env.FRONTIER_PIXEL_CRM_INTAKE_URL, intakeKey: process.env.FRONTIER_PIXEL_CRM_INTAKE_KEY });
    if (!config.ok) return null;
    const attempt = await ctx.runMutation(internal.quoteDiscussions.claim, args);
    if (!attempt) return null;
    const endpoint = new URL(config.endpointUrl);
    endpoint.pathname = "/api/intake/shed-quote-discussion";
    const result = await postDiscussion(endpoint.toString(), config.intakeKey, attempt.payload);
    await ctx.runMutation(internal.quoteDiscussions.complete, { ...args, attemptNumber: attempt.attemptNumber, ...result });
    return null;
  },
});

export async function recoverDiscussionsMutation(ctx: MutationCtx) {
  if (!isCrmQuoteSyncEnabled()) return null;
  const now = Date.now();
  for (const status of ["pending", "retry_scheduled"] as const) {
    const rows = await ctx.db.query("quoteDiscussionRequests")
      .withIndex("by_status_and_next_attempt_at", q => q.eq("status", status).lte("nextAttemptAt", now)).take(25);
    for (const row of rows) {
      // The atomic claim makes duplicate scheduled workers harmless.
      await ctx.scheduler.runAfter(0, internal.quoteDiscussions.deliver, { requestId: row._id });
    }
  }
  const stale = await ctx.db.query("quoteDiscussionRequests")
    .withIndex("by_status_and_last_attempt_at", q => q.eq("status", "processing").lte("lastAttemptAt", now - CRM_QUOTE_SYNC_PROCESSING_STALE_MS)).take(25);
  for (const row of stale) {
    await completeDiscussionMutation(ctx, { requestId: row._id, attemptNumber: row.attemptCount, outcome: "retryable", error: "Interrupted delivery" });
  }
  return null;
}
export const recover = internalMutation({ args: {}, returns: v.null(), handler: recoverDiscussionsMutation });

export const replay = internalMutation({
  args: requestIdArgs, returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.requestId);
    if (row?.status !== "dead_letter") return null;
    await ctx.db.patch(row._id, { status: "pending", attemptCount: 0, nextAttemptAt: Date.now(), lastError: undefined });
    await ctx.scheduler.runAfter(0, internal.quoteDiscussions.deliver, args);
    return null;
  },
});
