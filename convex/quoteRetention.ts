import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { CRM_QUOTE_ACKNOWLEDGEMENT_BINDING_VERSION } from "./validators";

export const QUOTE_RETENTION_MIN_DAYS = 30;
export const QUOTE_RETENTION_MAX_DAYS = 3_650;
export const QUOTE_RETENTION_DELETE_BATCH_SIZE = 6;
export const QUOTE_RETENTION_SCAN_BATCH_SIZE =
  QUOTE_RETENTION_DELETE_BATCH_SIZE;
export const QUOTE_RETENTION_CHILD_BATCH_SIZE = 50;
const QUOTE_RETENTION_STATE_KEY = "quoteRequests" as const;

if (QUOTE_RETENTION_SCAN_BATCH_SIZE > QUOTE_RETENTION_DELETE_BATCH_SIZE) {
  throw new Error("Quote retention scan batch cannot exceed its delete batch");
}

type QuoteRetentionResult = {
  enabled: boolean;
  scannedQuotes: number;
  eligibleQuotes: number;
  deletedQuotes: number;
  deletedChildRows: number;
  deferredQuotes: number;
  sweepCompleted: boolean;
  sweepCutoff: number | null;
};

type QuoteRetentionContinuation = {
  expectedCutoff?: number;
  expectedCursor?: string;
};

function emptyQuoteRetentionResult(
  enabled: boolean,
  sweepCompleted = false
): QuoteRetentionResult {
  return {
    enabled,
    scannedQuotes: 0,
    eligibleQuotes: 0,
    deletedQuotes: 0,
    deletedChildRows: 0,
    deferredQuotes: 0,
    sweepCompleted,
    sweepCutoff: null,
  };
}

export function parseQuoteDataRetentionDays(
  rawValue = process.env.QUOTE_DATA_RETENTION_DAYS
) {
  const raw = rawValue?.trim();
  if (!raw) return null;

  const days = Number(raw);
  if (
    !Number.isSafeInteger(days) ||
    days < QUOTE_RETENTION_MIN_DAYS ||
    days > QUOTE_RETENTION_MAX_DAYS
  ) {
    throw new Error(
      `QUOTE_DATA_RETENTION_DAYS must be a whole number from ${QUOTE_RETENTION_MIN_DAYS}-${QUOTE_RETENTION_MAX_DAYS}`
    );
  }
  return days;
}

function quoteIsSafeToDelete(quote: {
  crmSyncStatus?: string;
  notificationStatus: string;
  emailNotificationStatus?: string;
}) {
  const isTerminalNotificationStatus = (status: string | undefined) =>
    status === "sent" ||
    status === "partial_failed" ||
    status === "failed" ||
    status === "no_recipients";

  return (
    quote.crmSyncStatus === "succeeded" &&
    isTerminalNotificationStatus(quote.notificationStatus) &&
    isTerminalNotificationStatus(quote.emailNotificationStatus)
  );
}

export async function cleanupExpiredQuoteDataMutation(
  ctx: MutationCtx,
  args: {
    retentionDays: number | null;
    now: number;
  } & QuoteRetentionContinuation
): Promise<QuoteRetentionResult> {
  if (args.retentionDays === null) {
    return emptyQuoteRetentionResult(false);
  }

  const state = await ctx.db
    .query("quoteRetentionState")
    .withIndex("by_key", (query) =>
      query.eq("key", QUOTE_RETENTION_STATE_KEY)
    )
    .unique();
  const isContinuation =
    args.expectedCutoff !== undefined || args.expectedCursor !== undefined;
  if (
    isContinuation &&
    (args.expectedCutoff === undefined ||
      args.expectedCursor === undefined ||
      !state ||
      state.retentionDays !== args.retentionDays ||
      state.cutoff !== args.expectedCutoff ||
      state.cursor !== args.expectedCursor)
  ) {
    return emptyQuoteRetentionResult(true);
  }

  const startsNewSweep =
    !state || state.cursor === null || state.retentionDays !== args.retentionDays;
  const cutoff = startsNewSweep
    ? args.now - args.retentionDays * 24 * 60 * 60_000
    : state.cutoff;
  const pagination = await ctx.db
    .query("quoteRequests")
    .withIndex("by_crm_sync_status_and_created_at", (query) =>
      query.eq("crmSyncStatus", "succeeded").lt("createdAt", cutoff)
    )
    .order("asc")
    .paginate({
      cursor: startsNewSweep ? null : (state?.cursor ?? null),
      numItems: QUOTE_RETENTION_SCAN_BATCH_SIZE,
    });
  const candidates = pagination.page;
  const eligible = candidates.filter(quoteIsSafeToDelete);

  let deletedQuotes = 0;
  let deletedChildRows = 0;
  let deferredQuotes = candidates.length - eligible.length;
  for (const quote of eligible.slice(0, QUOTE_RETENTION_DELETE_BATCH_SIZE)) {
    const [smsAttempts, emailAttempts, outboxes, discussions] = await Promise.all([
      ctx.db
        .query("notificationAttempts")
        .withIndex("by_quote_request", (query) =>
          query.eq("quoteRequestId", quote._id)
        )
        .take(QUOTE_RETENTION_CHILD_BATCH_SIZE + 1),
      ctx.db
        .query("quoteEmailNotificationAttempts")
        .withIndex("by_quote_request", (query) =>
          query.eq("quoteRequestId", quote._id)
        )
        .take(QUOTE_RETENTION_CHILD_BATCH_SIZE + 1),
      ctx.db
        .query("crmQuoteSyncOutbox")
        .withIndex("by_quote_request_id", (query) =>
          query.eq("quoteRequestId", quote._id)
        )
        .take(2),
      ctx.db
        .query("quoteDiscussionRequests")
        .withIndex("by_quote_request_id", (query) =>
          query.eq("quoteRequestId", quote._id)
        )
        .take(2),
    ]);

    const outbox = outboxes[0];
    if (
      discussions.length > 1 ||
      discussions.some((row) => row.tenantId !== quote.tenantId || row.status !== "succeeded") ||
      outboxes.length !== 1 ||
      !outbox ||
      outbox.status !== "succeeded" ||
      outbox.tenantId !== quote.tenantId ||
      quote.crmSyncOutboxId !== outbox._id ||
      outbox.externalSubmissionId !== `shed210:quote:${quote.publicId}` ||
      outbox.acknowledgementBindingVersion !==
        CRM_QUOTE_ACKNOWLEDGEMENT_BINDING_VERSION
    ) {
      deferredQuotes += 1;
      continue;
    }

    const attemptsAreOwnedAndTerminal = [
      ...smsAttempts,
      ...emailAttempts,
    ].every(
      (attempt) =>
        attempt.tenantId === quote.tenantId && attempt.status !== "pending"
    );
    if (!attemptsAreOwnedAndTerminal) {
      deferredQuotes += 1;
      continue;
    }

    if (
      smsAttempts.length > QUOTE_RETENTION_CHILD_BATCH_SIZE ||
      emailAttempts.length > QUOTE_RETENTION_CHILD_BATCH_SIZE
    ) {
      for (const attempt of smsAttempts.slice(
        0,
        QUOTE_RETENTION_CHILD_BATCH_SIZE
      )) {
        await ctx.db.delete(attempt._id);
        deletedChildRows += 1;
      }
      for (const attempt of emailAttempts.slice(
        0,
        QUOTE_RETENTION_CHILD_BATCH_SIZE
      )) {
        await ctx.db.delete(attempt._id);
        deletedChildRows += 1;
      }
      deferredQuotes += 1;
      continue;
    }

    for (const attempt of [...smsAttempts, ...emailAttempts]) {
      await ctx.db.delete(attempt._id);
      deletedChildRows += 1;
    }
    await ctx.db.delete(outbox._id);
    for (const discussion of discussions) {
      await ctx.db.delete(discussion._id);
      deletedChildRows += 1;
    }
    await ctx.db.delete(quote._id);
    deletedChildRows += 1;
    deletedQuotes += 1;
  }

  const nextState = {
    key: QUOTE_RETENTION_STATE_KEY,
    cursor: pagination.isDone ? null : pagination.continueCursor,
    cutoff,
    retentionDays: args.retentionDays,
    updatedAt: args.now,
  };
  if (state) await ctx.db.patch(state._id, nextState);
  else await ctx.db.insert("quoteRetentionState", nextState);

  if (!pagination.isDone) {
    await ctx.scheduler.runAfter(
      0,
      internal.quoteRetention.cleanupExpiredQuoteData,
      {
        expectedCutoff: cutoff,
        expectedCursor: pagination.continueCursor,
      }
    );
  }

  return {
    enabled: true,
    scannedQuotes: candidates.length,
    eligibleQuotes: eligible.length,
    deletedQuotes,
    deletedChildRows,
    deferredQuotes,
    sweepCompleted: pagination.isDone,
    sweepCutoff: cutoff,
  };
}

export const cleanupExpiredQuoteData = internalMutation({
  args: {
    expectedCutoff: v.optional(v.number()),
    expectedCursor: v.optional(v.string()),
  },
  returns: v.object({
    enabled: v.boolean(),
    scannedQuotes: v.number(),
    eligibleQuotes: v.number(),
    deletedQuotes: v.number(),
    deletedChildRows: v.number(),
    deferredQuotes: v.number(),
    sweepCompleted: v.boolean(),
    sweepCutoff: v.union(v.number(), v.null()),
  }),
  handler: async (ctx, args): Promise<QuoteRetentionResult> => {
    const result = await cleanupExpiredQuoteDataMutation(ctx, {
      retentionDays: parseQuoteDataRetentionDays(),
      now: Date.now(),
      expectedCutoff: args.expectedCutoff,
      expectedCursor: args.expectedCursor,
    });
    console.info("quote retention cleanup", result);
    return result;
  },
});
