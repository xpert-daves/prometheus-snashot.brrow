import { v, type Infer } from "convex/values";
import { quoteMeasurementValidator } from "./quoteMeasurement";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  getShed210Tenant,
  SHED210_TENANT_SLUG,
} from "./platformTenancy";
import {
  CRM_QUOTE_ACKNOWLEDGEMENT_BINDING_VERSION,
  quoteContactValidator,
  quoteInputsValidator,
  quotePricingValidator,
  quoteSmsConsentValidator,
} from "./validators";

export const CRM_QUOTE_SYNC_RETRY_DELAYS_MS = [
  60_000,
  5 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
  12 * 60 * 60_000,
] as const;

// Auth and missing-route responses come from the intake key or the receiver
// deployment, never from the payload, so they spend the normal retry budget
// instead of dead-lettering on the first attempt. Payload rejections such as
// 400, 409, 413 and 422 stay permanent.
export const CRM_QUOTE_SYNC_CONFIGURATION_RETRY_STATUSES: readonly number[] = [
  401, 403, 404, 405,
];

export const CRM_QUOTE_SYNC_REQUEST_TIMEOUT_MS = 15_000;
export const CRM_QUOTE_SYNC_RECOVERY_BATCH_SIZE = 25;
export const CRM_QUOTE_SYNC_RECOVERY_RESCHEDULE_MS = 2 * 60_000;
export const CRM_QUOTE_SYNC_PROCESSING_STALE_MS = 5 * 60_000;
export const CRM_QUOTE_SYNC_ENDPOINT_URL =
  "https://youthful-horse-290.convex.site/api/intake/shed-quote";
export const CRM_QUOTE_BACKFILL_SYNC_MODE = "historical_backfill" as const;
export const CRM_QUOTE_BACKFILL_CAPABILITY_VERSION = 1 as const;
export const CRM_QUOTE_BACKFILL_MAX_BATCH_SIZE = 10;
export const CRM_QUOTE_BACKFILL_MAX_RUN_ID_LENGTH = 128;
export const CRM_QUOTE_BACKFILL_SCAN_LIMIT = 500;
export const CRM_QUOTE_SYNC_MAX_PAYLOAD_BYTES = 65_536;
export const CRM_QUOTE_SYNC_MIN_SUBMITTED_AT = Date.UTC(2020, 0, 1);
export const CRM_QUOTE_SYNC_FUTURE_TOLERANCE_MS = 5 * 60_000;

const MAX_STORED_ERROR_LENGTH = 1_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const crmQuoteSyncPayloadValidator = v.object({
  externalSubmissionId: v.string(),
  tenantSlug: v.literal("shed210"),
  source: v.object({
    system: v.literal("shed210"),
    deployment: v.string(),
    documentId: v.string(),
    pricingSettingsId: v.union(v.string(), v.null()),
    pricingPublicationId: v.union(v.string(), v.null()),
    pricingConfigVersion: v.union(v.number(), v.null()),
    pricingProvider: v.optional(
      v.union(
        v.literal("shed_convex"),
        v.literal("frontier_pixel_crm"),
        v.null()
      )
    ),
    pricingSchemaVersion: v.optional(v.union(v.number(), v.null())),
    pricingPublicationVersion: v.optional(v.union(v.number(), v.null())),
    syncMode: v.optional(v.literal("historical_backfill")),
    backfillRunId: v.optional(v.string()),
  }),
  publicId: v.string(),
  sessionId: v.string(),
  measurement: v.optional(quoteMeasurementValidator),
  submittedAt: v.number(),
  contact: quoteContactValidator,
  consent: v.object({
    transactional: v.union(quoteSmsConsentValidator, v.null()),
    marketing: v.union(quoteSmsConsentValidator, v.null()),
  }),
  quote: v.object({
    inputs: quoteInputsValidator,
    pricing: quotePricingValidator,
  }),
});

export type CrmQuoteSyncPayload = Infer<
  typeof crmQuoteSyncPayloadValidator
>;

export type ClaimedCrmQuoteSyncAttempt = {
  outboxId: Id<"crmQuoteSyncOutbox">;
  attemptNumber: number;
  payload: CrmQuoteSyncPayload;
  requireBoundAcknowledgement?: boolean;
};

export type CrmQuoteDeliveryResult =
  | { kind: "succeeded"; httpStatus: number }
  | {
      kind: "retryable";
      httpStatus: number | null;
      error: string;
    }
  | {
      kind: "permanent";
      httpStatus: number | null;
      error: string;
    };

export type CrmQuoteSyncRunResult =
  | "disabled"
  | "misconfigured"
  | "skipped"
  | "succeeded"
  | "retry_scheduled"
  | "dead_letter";

type AttemptCompletion = {
  outboxId: Id<"crmQuoteSyncOutbox">;
  attemptNumber: number;
  httpStatus: number | null;
  error: string;
};

type CrmQuoteSyncAcknowledgement = {
  ok: true;
  status: "created" | "linked" | "deduped";
  tenantSlug: "shed210";
  leadId: string;
  quoteRequestId: string;
  shedQuoteRequestId: string;
  externalSubmissionId?: string;
  sourceDocumentId?: string;
  publicId?: string;
};

type CrmQuoteSyncAcknowledgementBinding = {
  externalSubmissionId: string;
  sourceDocumentId: string;
  publicId: string;
};

export type CrmQuoteSyncRecoveryResult = {
  enabled: boolean;
  pendingScheduled: number;
  retryScheduled: number;
  staleProcessingRecovered: number;
};

export type CrmQuoteBackfillIssueCode =
  | "backfill_run_mismatch"
  | "duplicate_public_id"
  | "existing_outbox_mismatch"
  | "external_submission_collision"
  | "invalid_public_id"
  | "invalid_session_id"
  | "invalid_submitted_at"
  | "payload_not_json_safe"
  | "payload_too_large";

export type CrmQuoteBackfillCommonArgs = {
  tenantSlug: typeof SHED210_TENANT_SLUG;
  cutoffTimestamp: number;
  backfillRunId: string;
  batchSize: number;
};

export type CrmQuoteBackfillPreview = {
  tenantSlug: typeof SHED210_TENANT_SLUG;
  cutoffTimestamp: number;
  backfillRunId: string;
  eligibleSourceCount: number;
  alreadyOutboxedCount: number;
  remainingCount: number;
  validRemainingCount: number;
  invalidRemainingCount: number;
  requestedBatchSize: number;
  wouldEnqueueCount: number;
  ready: boolean;
  issueCounts: Array<{ code: CrmQuoteBackfillIssueCode; count: number }>;
};

export type CrmQuoteBackfillRunResult = {
  mode: "dry_run" | "executed";
  tenantSlug: typeof SHED210_TENANT_SLUG;
  cutoffTimestamp: number;
  backfillRunId: string;
  expectedRemainingCount: number;
  remainingBefore: number;
  enqueuedCount: number;
  remainingAfter: number;
};

type CrmQuoteSyncStatusCounts = {
  pending: number;
  processing: number;
  retryScheduled: number;
  succeeded: number;
  deadLetter: number;
};

export type CrmQuoteBackfillReconciliation = {
  tenantSlug: typeof SHED210_TENANT_SLUG;
  cutoffTimestamp: number;
  backfillRunId: string;
  eligibleSourceCount: number;
  sourceWithOutboxCount: number;
  sourceMissingOutboxCount: number;
  invalidRemainingCount: number;
  outboxTotalCount: number;
  historicalRunOutboxCount: number;
  allOutboxStatuses: CrmQuoteSyncStatusCounts;
  historicalRunStatuses: CrmQuoteSyncStatusCounts;
  sourceOutboxCoverageComplete: boolean;
  historicalRunDeliveryComplete: boolean;
};

const crmQuoteBackfillIssueValidator = v.object({
  code: v.union(
    v.literal("backfill_run_mismatch"),
    v.literal("duplicate_public_id"),
    v.literal("existing_outbox_mismatch"),
    v.literal("external_submission_collision"),
    v.literal("invalid_public_id"),
    v.literal("invalid_session_id"),
    v.literal("invalid_submitted_at"),
    v.literal("payload_not_json_safe"),
    v.literal("payload_too_large")
  ),
  count: v.number(),
});

const crmQuoteBackfillPreviewValidator = v.object({
  tenantSlug: v.literal("shed210"),
  cutoffTimestamp: v.number(),
  backfillRunId: v.string(),
  eligibleSourceCount: v.number(),
  alreadyOutboxedCount: v.number(),
  remainingCount: v.number(),
  validRemainingCount: v.number(),
  invalidRemainingCount: v.number(),
  requestedBatchSize: v.number(),
  wouldEnqueueCount: v.number(),
  ready: v.boolean(),
  issueCounts: v.array(crmQuoteBackfillIssueValidator),
});

const crmQuoteBackfillRunResultValidator = v.object({
  mode: v.union(v.literal("dry_run"), v.literal("executed")),
  tenantSlug: v.literal("shed210"),
  cutoffTimestamp: v.number(),
  backfillRunId: v.string(),
  expectedRemainingCount: v.number(),
  remainingBefore: v.number(),
  enqueuedCount: v.number(),
  remainingAfter: v.number(),
});

const crmQuoteSyncStatusCountsValidator = v.object({
  pending: v.number(),
  processing: v.number(),
  retryScheduled: v.number(),
  succeeded: v.number(),
  deadLetter: v.number(),
});

const crmQuoteBackfillReconciliationValidator = v.object({
  tenantSlug: v.literal("shed210"),
  cutoffTimestamp: v.number(),
  backfillRunId: v.string(),
  eligibleSourceCount: v.number(),
  sourceWithOutboxCount: v.number(),
  sourceMissingOutboxCount: v.number(),
  invalidRemainingCount: v.number(),
  outboxTotalCount: v.number(),
  historicalRunOutboxCount: v.number(),
  allOutboxStatuses: crmQuoteSyncStatusCountsValidator,
  historicalRunStatuses: crmQuoteSyncStatusCountsValidator,
  sourceOutboxCoverageComplete: v.boolean(),
  historicalRunDeliveryComplete: v.boolean(),
});

type RunCrmQuoteSyncAttemptArgs = {
  enabled: boolean;
  endpointUrl?: string;
  intakeKey?: string;
  claimAttempt: () => Promise<ClaimedCrmQuoteSyncAttempt | null>;
  postQuote?: (args: {
    endpointUrl: string;
    intakeKey: string;
    payload: CrmQuoteSyncPayload;
    requireBoundAcknowledgement: boolean;
  }) => Promise<CrmQuoteDeliveryResult>;
  requireBoundAcknowledgement?: boolean;
  markSucceeded: (args: {
    outboxId: Id<"crmQuoteSyncOutbox">;
    attemptNumber: number;
    httpStatus: number;
    acknowledgementBindingVersion:
      | typeof CRM_QUOTE_ACKNOWLEDGEMENT_BINDING_VERSION
      | null;
  }) => Promise<unknown>;
  scheduleRetry: (
    args: AttemptCompletion & { delayMs: number }
  ) => Promise<unknown>;
  markDeadLetter: (args: AttemptCompletion) => Promise<unknown>;
};

function truncateError(value: string) {
  return value.slice(0, MAX_STORED_ERROR_LENGTH);
}

function stringifyError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

// Nothing retries a dead letter automatically, so each one leaves a Convex log
// line for the operator. Log document ids and delivery status only, never
// contact data.
function logCrmQuoteSyncDeadLetter(
  outbox: Doc<"crmQuoteSyncOutbox">,
  details: { attemptNumber: number; httpStatus: number | null; error: string }
) {
  console.error("CRM quote sync dead-lettered", {
    outboxId: outbox._id,
    quoteRequestId: outbox.quoteRequestId,
    attemptNumber: details.attemptNumber,
    httpStatus: details.httpStatus,
    syncMode: outbox.syncMode ?? null,
    error: details.error,
  });
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

type CrmQuoteSyncConfigurationResult =
  | { ok: true; endpointUrl: string; intakeKey: string }
  | { ok: false; error: string };

export function validateCrmQuoteSyncEndpoint(value: string | undefined) {
  const raw = value?.trim();
  if (!raw) {
    return {
      ok: false as const,
      error: "FRONTIER_PIXEL_CRM_INTAKE_URL is missing",
    };
  }

  try {
    const endpoint = new URL(raw);
    const approved = new URL(CRM_QUOTE_SYNC_ENDPOINT_URL);
    if (
      endpoint.protocol !== "https:" ||
      endpoint.username !== "" ||
      endpoint.password !== "" ||
      endpoint.port !== "" ||
      endpoint.hostname !== approved.hostname ||
      endpoint.pathname !== approved.pathname ||
      endpoint.search !== "" ||
      endpoint.hash !== ""
    ) {
      return {
        ok: false as const,
        error: "FRONTIER_PIXEL_CRM_INTAKE_URL is not the approved HTTPS receiver",
      };
    }
    return { ok: true as const, endpointUrl: endpoint.toString() };
  } catch {
    return {
      ok: false as const,
      error: "FRONTIER_PIXEL_CRM_INTAKE_URL is invalid",
    };
  }
}

export function validateCrmQuoteSyncConfiguration(args: {
  endpointUrl?: string;
  intakeKey?: string;
}): CrmQuoteSyncConfigurationResult {
  const endpoint = validateCrmQuoteSyncEndpoint(args.endpointUrl);
  if (!endpoint.ok) return endpoint;

  const intakeKey = args.intakeKey?.trim();
  if (!intakeKey) {
    return {
      ok: false,
      error: "FRONTIER_PIXEL_CRM_INTAKE_KEY is missing",
    };
  }

  return { ok: true, endpointUrl: endpoint.endpointUrl, intakeKey };
}

export function isValidCrmQuoteSyncAcknowledgement(
  value: unknown,
  expectedBinding?: CrmQuoteSyncAcknowledgementBinding
): value is CrmQuoteSyncAcknowledgement {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const acknowledgement = value as Record<string, unknown>;
  const validShape =
    acknowledgement.ok === true &&
    (acknowledgement.status === "created" ||
      acknowledgement.status === "linked" ||
      acknowledgement.status === "deduped") &&
    acknowledgement.tenantSlug === SHED210_TENANT_SLUG &&
    isNonEmptyString(acknowledgement.leadId) &&
    isNonEmptyString(acknowledgement.quoteRequestId) &&
    isNonEmptyString(acknowledgement.shedQuoteRequestId);
  if (!validShape) return false;
  if (!expectedBinding) return true;

  return (
    acknowledgement.externalSubmissionId ===
      expectedBinding.externalSubmissionId &&
    acknowledgement.sourceDocumentId === expectedBinding.sourceDocumentId &&
    acknowledgement.publicId === expectedBinding.publicId
  );
}

export function isCrmQuoteSyncEnabled(
  value = process.env.SHED_CRM_SYNC_ENABLED
) {
  return value?.trim().toLowerCase() === "true";
}

export function isCrmQuoteBackfillEnabled(
  value = process.env.SHED_CRM_BACKFILL_ENABLED
) {
  return value?.trim().toLowerCase() === "true";
}

export function isCrmQuoteAcknowledgementBindingRequired(
  value = process.env.SHED_CRM_REQUIRE_BOUND_ACKNOWLEDGEMENT
) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new Error(
    "SHED_CRM_REQUIRE_BOUND_ACKNOWLEDGEMENT must be true or false"
  );
}

function normalizeBackfillRunId(value: string) {
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > CRM_QUOTE_BACKFILL_MAX_RUN_ID_LENGTH
  ) {
    throw new Error(
      `Backfill run id must be 1-${CRM_QUOTE_BACKFILL_MAX_RUN_ID_LENGTH} characters`
    );
  }
  return normalized;
}

function validateBackfillCommonArgs(
  args: CrmQuoteBackfillCommonArgs,
  now = Date.now()
): CrmQuoteBackfillCommonArgs {
  if (args.tenantSlug !== SHED210_TENANT_SLUG) {
    throw new Error("Historical quote backfill is restricted to shed210");
  }
  if (
    !Number.isSafeInteger(args.cutoffTimestamp) ||
    args.cutoffTimestamp < CRM_QUOTE_SYNC_MIN_SUBMITTED_AT ||
    args.cutoffTimestamp > now
  ) {
    throw new Error(
      "Backfill cutoff must be a safe timestamp from 2020-01-01 through now"
    );
  }
  if (
    !Number.isSafeInteger(args.batchSize) ||
    args.batchSize < 1 ||
    args.batchSize > CRM_QUOTE_BACKFILL_MAX_BATCH_SIZE
  ) {
    throw new Error(
      `Backfill batch size must be an integer from 1-${CRM_QUOTE_BACKFILL_MAX_BATCH_SIZE}`
    );
  }
  return {
    tenantSlug: args.tenantSlug,
    cutoffTimestamp: args.cutoffTimestamp,
    backfillRunId: normalizeBackfillRunId(args.backfillRunId),
    batchSize: args.batchSize,
  };
}

function isExactCrmQuoteBackfillCapability(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const capability = value as Record<string, unknown>;
  const keys = Object.keys(capability).sort();
  return (
    keys.length === 3 &&
    keys[0] === "historicalBackfillVersion" &&
    keys[1] === "ok" &&
    keys[2] === "tenantSlug" &&
    capability.ok === true &&
    capability.tenantSlug === SHED210_TENANT_SLUG &&
    capability.historicalBackfillVersion ===
      CRM_QUOTE_BACKFILL_CAPABILITY_VERSION
  );
}

export async function probeCrmQuoteBackfillCapability(args: {
  endpointUrl: string;
  intakeKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}) {
  const endpoint = validateCrmQuoteSyncEndpoint(args.endpointUrl);
  if (!endpoint.ok) throw new Error(endpoint.error);
  const intakeKey = args.intakeKey.trim();
  if (!intakeKey) throw new Error("FRONTIER_PIXEL_CRM_INTAKE_KEY is missing");

  const fetchImpl = args.fetchImpl ?? fetch;
  const timeoutMs = args.timeoutMs ?? CRM_QUOTE_SYNC_REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(endpoint.endpointUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${intakeKey}`,
        "Cache-Control": "no-cache",
      },
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    });
    if (response.status !== 200) {
      throw new Error(
        `CRM historical backfill capability returned ${response.status}`
      );
    }

    let capability: unknown;
    try {
      capability = await response.json();
    } catch {
      throw new Error(
        "CRM historical backfill capability returned malformed JSON"
      );
    }
    if (!isExactCrmQuoteBackfillCapability(capability)) {
      throw new Error(
        "CRM historical backfill capability response did not match version 1"
      );
    }
    return {
      ok: true as const,
      tenantSlug: SHED210_TENANT_SLUG,
      historicalBackfillVersion: CRM_QUOTE_BACKFILL_CAPABILITY_VERSION,
    };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        `CRM historical backfill capability timed out after ${timeoutMs}ms`
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function getCrmQuoteSyncRetryDelayMs(attemptNumber: number) {
  return CRM_QUOTE_SYNC_RETRY_DELAYS_MS[attemptNumber - 1] ?? null;
}

export function getSourceDeploymentIdentifier() {
  return (
    process.env.CONVEX_DEPLOYMENT?.trim() ||
    process.env.CONVEX_CLOUD_URL?.trim() ||
    process.env.CONVEX_SITE_URL?.trim() ||
    "unknown"
  );
}

export function buildCrmQuoteSyncPayload(args: {
  quote: Doc<"quoteRequests">;
  outbox: Doc<"crmQuoteSyncOutbox">;
}): CrmQuoteSyncPayload {
  const pricingConfig = args.quote.pricing.config;
  const pricingProvenance =
    pricingConfig?.provider &&
    pricingConfig.source === "table" &&
    pricingConfig.pricingSchemaVersion !== undefined
      ? {
          pricingProvider: pricingConfig.provider,
          pricingSchemaVersion: pricingConfig.pricingSchemaVersion,
          pricingPublicationVersion:
            pricingConfig.pricingPublicationVersion ?? null,
        }
      : {};
  const historicalSource =
    args.outbox.syncMode === CRM_QUOTE_BACKFILL_SYNC_MODE
      ? {
          syncMode: CRM_QUOTE_BACKFILL_SYNC_MODE,
          backfillRunId: normalizeBackfillRunId(
            args.outbox.backfillRunId ?? ""
          ),
        }
      : {};

  return {
    externalSubmissionId: args.outbox.externalSubmissionId,
    tenantSlug: SHED210_TENANT_SLUG,
    source: {
      system: "shed210",
      deployment: args.outbox.sourceDeployment,
      documentId: String(args.quote._id),
      pricingSettingsId: pricingConfig?.settingsId
        ? String(pricingConfig.settingsId)
        : null,
      pricingPublicationId: pricingConfig?.pricingPublicationId ?? null,
      pricingConfigVersion: pricingConfig?.configVersion ?? null,
      ...pricingProvenance,
      ...historicalSource,
    },
    publicId: args.quote.publicId,
    sessionId: args.quote.sessionId,
    ...(args.quote.measurement ? { measurement: args.quote.measurement } : {}),
    submittedAt: args.quote.createdAt,
    contact: args.quote.contact,
    consent: {
      transactional: args.quote.smsConsent ?? null,
      marketing: args.quote.smsMarketingConsent ?? null,
    },
    quote: {
      inputs: args.quote.inputs,
      pricing: args.quote.pricing,
    },
  };
}

export async function enqueueCrmQuoteSyncOutbox(
  ctx: MutationCtx,
  args: {
    tenantId: Id<"tenants">;
    quoteRequestId: Id<"quoteRequests">;
    publicId: string;
    syncMode?: typeof CRM_QUOTE_BACKFILL_SYNC_MODE;
    backfillRunId?: string;
  }
) {
  if (
    (args.syncMode === CRM_QUOTE_BACKFILL_SYNC_MODE) !==
    (args.backfillRunId !== undefined)
  ) {
    throw new Error(
      "Historical CRM sync mode and backfill run id must be provided together"
    );
  }
  const backfillRunId = args.backfillRunId?.trim();
  if (
    backfillRunId !== undefined &&
    (backfillRunId.length === 0 ||
      backfillRunId.length > CRM_QUOTE_BACKFILL_MAX_RUN_ID_LENGTH)
  ) {
    throw new Error(
      `Backfill run id must be 1-${CRM_QUOTE_BACKFILL_MAX_RUN_ID_LENGTH} characters`
    );
  }

  const externalSubmissionId = `shed210:quote:${args.publicId}`;
  const existing = await ctx.db
    .query("crmQuoteSyncOutbox")
    .withIndex("by_tenant_id_and_external_submission_id", (query) =>
      query
        .eq("tenantId", args.tenantId)
        .eq("externalSubmissionId", externalSubmissionId)
    )
    .unique();

  if (existing) return existing._id;

  const now = Date.now();
  const outboxId = await ctx.db.insert("crmQuoteSyncOutbox", {
    tenantId: args.tenantId,
    tenantSlug: SHED210_TENANT_SLUG,
    quoteRequestId: args.quoteRequestId,
    externalSubmissionId,
    sourceDeployment: getSourceDeploymentIdentifier(),
    syncMode: args.syncMode,
    backfillRunId,
    status: "pending",
    attemptCount: 0,
    replayCount: 0,
    nextAttemptAt: now,
    createdAt: now,
    updatedAt: now,
  });

  await ctx.db.patch(args.quoteRequestId, {
    crmSyncStatus: "pending",
    crmSyncOutboxId: outboxId,
  });

  return outboxId;
}

type CrmQuoteBackfillPlan = {
  preview: CrmQuoteBackfillPreview;
  validCandidates: Doc<"quoteRequests">[];
  tenantId: Id<"tenants">;
};

function containsNonFiniteNumber(
  value: unknown,
  seen = new Set<object>()
): boolean {
  if (typeof value === "number") return !Number.isFinite(value);
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return true;
  seen.add(value);
  const invalid = Array.isArray(value)
    ? value.some((entry) => containsNonFiniteNumber(entry, seen))
    : Object.values(value).some((entry) =>
        containsNonFiniteNumber(entry, seen)
      );
  seen.delete(value);
  return invalid;
}

function utf8ByteLength(value: string) {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit < 0x80) bytes += 1;
    else if (codeUnit < 0x800) bytes += 2;
    else if (
      codeUnit >= 0xd800 &&
      codeUnit <= 0xdbff &&
      index + 1 < value.length
    ) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    } else bytes += 3;
  }
  return bytes;
}

function previewOutboxForQuote(args: {
  quote: Doc<"quoteRequests">;
  tenantId: Id<"tenants">;
  backfillRunId: string;
  now: number;
}): Doc<"crmQuoteSyncOutbox"> {
  return {
    _id: "crmQuoteSyncOutbox-preview" as Id<"crmQuoteSyncOutbox">,
    _creationTime: args.now,
    tenantId: args.tenantId,
    tenantSlug: SHED210_TENANT_SLUG,
    quoteRequestId: args.quote._id,
    externalSubmissionId: `shed210:quote:${args.quote.publicId}`,
    sourceDeployment: getSourceDeploymentIdentifier(),
    syncMode: CRM_QUOTE_BACKFILL_SYNC_MODE,
    backfillRunId: args.backfillRunId,
    status: "pending",
    attemptCount: 0,
    replayCount: 0,
    createdAt: args.now,
    updatedAt: args.now,
  };
}

function validateHistoricalQuoteForCrmSync(args: {
  quote: Doc<"quoteRequests">;
  tenantId: Id<"tenants">;
  backfillRunId: string;
  now: number;
}): CrmQuoteBackfillIssueCode[] {
  const issues: CrmQuoteBackfillIssueCode[] = [];
  if (!UUID_PATTERN.test(args.quote.publicId)) issues.push("invalid_public_id");
  if (!UUID_PATTERN.test(args.quote.sessionId)) {
    issues.push("invalid_session_id");
  }
  if (
    !Number.isSafeInteger(args.quote.createdAt) ||
    args.quote.createdAt < CRM_QUOTE_SYNC_MIN_SUBMITTED_AT ||
    args.quote.createdAt >
      args.now + CRM_QUOTE_SYNC_FUTURE_TOLERANCE_MS
  ) {
    issues.push("invalid_submitted_at");
  }

  const payload = buildCrmQuoteSyncPayload({
    quote: args.quote,
    outbox: previewOutboxForQuote(args),
  });
  if (containsNonFiniteNumber(payload)) {
    issues.push("payload_not_json_safe");
    return issues;
  }
  try {
    const serialized = JSON.stringify(payload);
    JSON.parse(serialized);
    if (utf8ByteLength(serialized) > CRM_QUOTE_SYNC_MAX_PAYLOAD_BYTES) {
      issues.push("payload_too_large");
    }
  } catch {
    issues.push("payload_not_json_safe");
  }
  return issues;
}

function issueCounts(
  issues: CrmQuoteBackfillIssueCode[]
): Array<{ code: CrmQuoteBackfillIssueCode; count: number }> {
  const counts = new Map<CrmQuoteBackfillIssueCode, number>();
  for (const issue of issues) counts.set(issue, (counts.get(issue) ?? 0) + 1);
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([code, count]) => ({ code, count }));
}

async function buildCrmQuoteBackfillPlan(
  ctx: QueryCtx | MutationCtx,
  rawArgs: CrmQuoteBackfillCommonArgs,
  now = Date.now()
): Promise<CrmQuoteBackfillPlan> {
  const args = validateBackfillCommonArgs(rawArgs, now);
  const tenant = await getShed210Tenant(ctx);
  if (!tenant || tenant.slug !== SHED210_TENANT_SLUG) {
    throw new Error("Shed210 tenant is not configured");
  }

  const eligibleQuotes = await ctx.db
    .query("quoteRequests")
    .withIndex("by_tenant_id_and_created_at", (query) =>
      query
        .eq("tenantId", tenant._id)
        .lte("createdAt", args.cutoffTimestamp)
    )
    .order("asc")
    .take(CRM_QUOTE_BACKFILL_SCAN_LIMIT + 1);
  if (eligibleQuotes.length > CRM_QUOTE_BACKFILL_SCAN_LIMIT) {
    throw new Error(
      `Backfill source scan exceeded the ${CRM_QUOTE_BACKFILL_SCAN_LIMIT}-quote safety limit`
    );
  }

  const missingOutbox: Doc<"quoteRequests">[] = [];
  const allIssues: CrmQuoteBackfillIssueCode[] = [];
  let provenanceConflictCount = 0;
  for (const quote of eligibleQuotes) {
    const existing = await ctx.db
      .query("crmQuoteSyncOutbox")
      .withIndex("by_quote_request_id", (query) =>
        query.eq("quoteRequestId", quote._id)
      )
      .unique();
    if (!existing) {
      missingOutbox.push(quote);
      continue;
    }

    let hasConflict = false;
    if (
      existing.tenantId !== tenant._id ||
      existing.tenantSlug !== SHED210_TENANT_SLUG ||
      existing.externalSubmissionId !==
        `shed210:quote:${quote.publicId}`
    ) {
      allIssues.push("existing_outbox_mismatch");
      hasConflict = true;
    }
    if (
      existing.syncMode === CRM_QUOTE_BACKFILL_SYNC_MODE &&
      existing.backfillRunId !== args.backfillRunId
    ) {
      allIssues.push("backfill_run_mismatch");
      hasConflict = true;
    } else if (
      existing.syncMode !== CRM_QUOTE_BACKFILL_SYNC_MODE &&
      existing.backfillRunId !== undefined
    ) {
      allIssues.push("existing_outbox_mismatch");
      hasConflict = true;
    }
    if (hasConflict) provenanceConflictCount += 1;
  }

  const publicIdCounts = new Map<string, number>();
  for (const quote of missingOutbox) {
    publicIdCounts.set(
      quote.publicId,
      (publicIdCounts.get(quote.publicId) ?? 0) + 1
    );
  }

  const validCandidates: Doc<"quoteRequests">[] = [];
  for (const quote of missingOutbox) {
    const quoteIssues = validateHistoricalQuoteForCrmSync({
      quote,
      tenantId: tenant._id,
      backfillRunId: args.backfillRunId,
      now,
    });
    if ((publicIdCounts.get(quote.publicId) ?? 0) > 1) {
      quoteIssues.push("duplicate_public_id");
    }
    const externalSubmissionId = `shed210:quote:${quote.publicId}`;
    const externalCollision = await ctx.db
      .query("crmQuoteSyncOutbox")
      .withIndex("by_tenant_id_and_external_submission_id", (query) =>
        query
          .eq("tenantId", tenant._id)
          .eq("externalSubmissionId", externalSubmissionId)
      )
      .unique();
    if (externalCollision) {
      quoteIssues.push("external_submission_collision");
    }
    if (quoteIssues.length === 0) {
      validCandidates.push(quote);
    } else {
      allIssues.push(...quoteIssues);
    }
  }

  const remainingCount = missingOutbox.length;
  const validRemainingCount = validCandidates.length;
  const invalidRemainingCount =
    remainingCount - validRemainingCount + provenanceConflictCount;
  return {
    tenantId: tenant._id,
    validCandidates,
    preview: {
      tenantSlug: SHED210_TENANT_SLUG,
      cutoffTimestamp: args.cutoffTimestamp,
      backfillRunId: args.backfillRunId,
      eligibleSourceCount: eligibleQuotes.length,
      alreadyOutboxedCount: eligibleQuotes.length - remainingCount,
      remainingCount,
      validRemainingCount,
      invalidRemainingCount,
      requestedBatchSize: args.batchSize,
      wouldEnqueueCount:
        invalidRemainingCount === 0
          ? Math.min(args.batchSize, validRemainingCount)
          : 0,
      ready: invalidRemainingCount === 0,
      issueCounts: issueCounts(allIssues),
    },
  };
}

export async function postCrmQuoteRequest(args: {
  endpointUrl: string;
  intakeKey: string;
  payload: CrmQuoteSyncPayload;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  requireBoundAcknowledgement?: boolean;
}): Promise<CrmQuoteDeliveryResult> {
  const endpoint = validateCrmQuoteSyncEndpoint(args.endpointUrl);
  if (!endpoint.ok) {
    return {
      kind: "permanent",
      httpStatus: null,
      error: endpoint.error,
    };
  }

  const fetchImpl = args.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeoutMs = args.timeoutMs ?? CRM_QUOTE_SYNC_REQUEST_TIMEOUT_MS;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(endpoint.endpointUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.intakeKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": args.payload.externalSubmissionId,
      },
      body: JSON.stringify(args.payload),
      redirect: "manual",
      signal: controller.signal,
    });

    if (response.ok) {
      let acknowledgement: unknown;
      try {
        acknowledgement = await response.json();
      } catch {
        return {
          kind: "retryable",
          httpStatus: response.status,
          error: "CRM intake returned a malformed success acknowledgement",
        };
      }
      const expectedBinding = args.requireBoundAcknowledgement
        ? {
            externalSubmissionId: args.payload.externalSubmissionId,
            sourceDocumentId: args.payload.source.documentId,
            publicId: args.payload.publicId,
          }
        : undefined;
      if (
        !isValidCrmQuoteSyncAcknowledgement(
          acknowledgement,
          expectedBinding
        )
      ) {
        return {
          kind: "retryable",
          httpStatus: response.status,
          error: args.requireBoundAcknowledgement
            ? "CRM intake returned an unbound success acknowledgement"
            : "CRM intake returned a malformed success acknowledgement",
        };
      }
      return { kind: "succeeded", httpStatus: response.status };
    }

    const error = `CRM intake returned ${response.status}`;

    if (
      response.status === 429 ||
      response.status >= 500 ||
      CRM_QUOTE_SYNC_CONFIGURATION_RETRY_STATUSES.includes(response.status)
    ) {
      return {
        kind: "retryable",
        httpStatus: response.status,
        error,
      };
    }

    return {
      kind: "permanent",
      httpStatus: response.status,
      error,
    };
  } catch (error) {
    const message = controller.signal.aborted
      ? `CRM intake timed out after ${timeoutMs}ms`
      : `CRM intake request failed: ${stringifyError(error)}`;
    return {
      kind: "retryable",
      httpStatus: null,
      error: truncateError(message),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function postCrmQuoteRequestWithHistoricalCapability(args: {
  endpointUrl: string;
  intakeKey: string;
  payload: CrmQuoteSyncPayload;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  requireBoundAcknowledgement?: boolean;
}): Promise<CrmQuoteDeliveryResult> {
  if (args.payload.source.syncMode === CRM_QUOTE_BACKFILL_SYNC_MODE) {
    try {
      await probeCrmQuoteBackfillCapability({
        endpointUrl: args.endpointUrl,
        intakeKey: args.intakeKey,
        fetchImpl: args.fetchImpl,
        timeoutMs: args.timeoutMs,
      });
    } catch (error) {
      return {
        kind: "retryable",
        httpStatus: null,
        error: truncateError(
          `CRM historical backfill capability check failed: ${stringifyError(error)}`
        ),
      };
    }
  }
  return await postCrmQuoteRequest(args);
}

export async function runCrmQuoteSyncAttempt(
  args: RunCrmQuoteSyncAttemptArgs
): Promise<CrmQuoteSyncRunResult> {
  if (!args.enabled) return "disabled";

  const configuration = validateCrmQuoteSyncConfiguration({
    endpointUrl: args.endpointUrl,
    intakeKey: args.intakeKey,
  });
  if (!configuration.ok) return "misconfigured";

  const claimed = await args.claimAttempt();
  if (!claimed) return "skipped";

  const postQuote =
    args.postQuote ??
    ((request) =>
      postCrmQuoteRequestWithHistoricalCapability({
        ...request,
      }));
  const requireBoundAcknowledgement =
    claimed.requireBoundAcknowledgement || (args.requireBoundAcknowledgement ?? false);
  const result = await postQuote({
    endpointUrl: configuration.endpointUrl,
    intakeKey: configuration.intakeKey,
    payload: claimed.payload,
    requireBoundAcknowledgement,
  });

  if (result.kind === "succeeded") {
    await args.markSucceeded({
      outboxId: claimed.outboxId,
      attemptNumber: claimed.attemptNumber,
      httpStatus: result.httpStatus,
      acknowledgementBindingVersion: requireBoundAcknowledgement
        ? CRM_QUOTE_ACKNOWLEDGEMENT_BINDING_VERSION
        : null,
    });
    return "succeeded";
  }

  if (result.kind === "permanent") {
    await args.markDeadLetter({
      outboxId: claimed.outboxId,
      attemptNumber: claimed.attemptNumber,
      httpStatus: result.httpStatus,
      error: result.error,
    });
    return "dead_letter";
  }

  const delayMs = getCrmQuoteSyncRetryDelayMs(claimed.attemptNumber);
  if (delayMs === null) {
    await args.markDeadLetter({
      outboxId: claimed.outboxId,
      attemptNumber: claimed.attemptNumber,
      httpStatus: result.httpStatus,
      error: truncateError(
        `${result.error}; retry budget exhausted after ${claimed.attemptNumber} attempts`
      ),
    });
    return "dead_letter";
  }

  await args.scheduleRetry({
    outboxId: claimed.outboxId,
    attemptNumber: claimed.attemptNumber,
    httpStatus: result.httpStatus,
    error: result.error,
    delayMs,
  });
  return "retry_scheduled";
}

export async function claimCrmQuoteSyncAttemptMutation(
  ctx: MutationCtx,
  args: { outboxId: Id<"crmQuoteSyncOutbox"> }
): Promise<ClaimedCrmQuoteSyncAttempt | null> {
  const outbox = await ctx.db.get(args.outboxId);
  if (
    !outbox ||
    (outbox.status !== "pending" && outbox.status !== "retry_scheduled")
  ) {
    return null;
  }

  const quote = await ctx.db.get(outbox.quoteRequestId);
  if (!quote) {
    const now = Date.now();
    const error = "Source quote request not found";
    await ctx.db.patch(outbox._id, {
      status: "dead_letter",
      lastError: error,
      completedAt: now,
      updatedAt: now,
    });
    logCrmQuoteSyncDeadLetter(outbox, {
      attemptNumber: outbox.attemptCount,
      httpStatus: outbox.lastHttpStatus ?? null,
      error,
    });
    return null;
  }

  const attemptNumber = outbox.attemptCount + 1;
  const now = Date.now();
  await ctx.db.patch(outbox._id, {
    status: "processing",
    attemptCount: attemptNumber,
    nextAttemptAt: undefined,
    lastAttemptAt: now,
    lastError: undefined,
    updatedAt: now,
  });
  await ctx.db.patch(quote._id, {
    crmSyncStatus: "processing",
    crmSyncLastAttemptAt: now,
    crmSyncError: undefined,
  });

  return {
    outboxId: outbox._id,
    attemptNumber,
    payload: buildCrmQuoteSyncPayload({ quote, outbox }),
    ...(quote.discussionTokenHash ? { requireBoundAcknowledgement: true } : {}),
  };
}

export async function recoverCrmQuoteSyncOutboxMutation(
  ctx: MutationCtx,
  args: { enabled: boolean; now?: number }
): Promise<CrmQuoteSyncRecoveryResult> {
  const emptyResult = {
    enabled: args.enabled,
    pendingScheduled: 0,
    retryScheduled: 0,
    staleProcessingRecovered: 0,
  };
  if (!args.enabled) return emptyResult;

  const now = args.now ?? Date.now();
  const staleBefore = now - CRM_QUOTE_SYNC_PROCESSING_STALE_MS;
  const [pending, dueRetries, staleProcessing] = await Promise.all([
    ctx.db
      .query("crmQuoteSyncOutbox")
      .withIndex("by_status_and_next_attempt_at", (query) =>
        query.eq("status", "pending").lte("nextAttemptAt", now)
      )
      .take(CRM_QUOTE_SYNC_RECOVERY_BATCH_SIZE),
    ctx.db
      .query("crmQuoteSyncOutbox")
      .withIndex("by_status_and_next_attempt_at", (query) =>
        query.eq("status", "retry_scheduled").lte("nextAttemptAt", now)
      )
      .take(CRM_QUOTE_SYNC_RECOVERY_BATCH_SIZE),
    ctx.db
      .query("crmQuoteSyncOutbox")
      .withIndex("by_status_and_last_attempt_at", (query) =>
        query.eq("status", "processing").lte("lastAttemptAt", staleBefore)
      )
      .take(CRM_QUOTE_SYNC_RECOVERY_BATCH_SIZE),
  ]);

  const reserveUntil = now + CRM_QUOTE_SYNC_RECOVERY_RESCHEDULE_MS;
  for (const outbox of [...pending, ...dueRetries]) {
    await ctx.db.patch(outbox._id, {
      nextAttemptAt: reserveUntil,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.crmQuoteSync.sendQuoteToCrm, {
      outboxId: outbox._id,
    });
  }

  for (const outbox of staleProcessing) {
    const recoveryError = `Recovered stale CRM sync attempt ${outbox.attemptCount}`;
    await ctx.db.patch(outbox._id, {
      status: "pending",
      nextAttemptAt: reserveUntil,
      lastError: recoveryError,
      updatedAt: now,
    });
    const quote = await ctx.db.get(outbox.quoteRequestId);
    if (quote) {
      await ctx.db.patch(quote._id, {
        crmSyncStatus: "pending",
        crmSyncError: recoveryError,
      });
    }
    await ctx.scheduler.runAfter(0, internal.crmQuoteSync.sendQuoteToCrm, {
      outboxId: outbox._id,
    });
  }

  return {
    enabled: true,
    pendingScheduled: pending.length,
    retryScheduled: dueRetries.length,
    staleProcessingRecovered: staleProcessing.length,
  };
}

function validateExpectedRemainingCount(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(
      "Expected remaining count must be a non-negative safe integer"
    );
  }
}

function requireReadyBackfillPreview(
  preview: CrmQuoteBackfillPreview,
  expectedRemainingCount: number
) {
  if (preview.remainingCount !== expectedRemainingCount) {
    throw new Error(
      `Backfill expected ${expectedRemainingCount} remaining quotes but found ${preview.remainingCount}; rerun preview before continuing`
    );
  }
  if (!preview.ready) {
    throw new Error(
      `Backfill preflight found ${preview.invalidRemainingCount} invalid historical quotes; no rows were enqueued`
    );
  }
}

export async function previewCrmQuoteBackfillQuery(
  ctx: QueryCtx,
  args: CrmQuoteBackfillCommonArgs
): Promise<CrmQuoteBackfillPreview> {
  return (await buildCrmQuoteBackfillPlan(ctx, args)).preview;
}

function emptyCrmQuoteSyncStatusCounts(): CrmQuoteSyncStatusCounts {
  return {
    pending: 0,
    processing: 0,
    retryScheduled: 0,
    succeeded: 0,
    deadLetter: 0,
  };
}

function incrementCrmQuoteSyncStatus(
  counts: CrmQuoteSyncStatusCounts,
  status: Doc<"crmQuoteSyncOutbox">["status"]
) {
  if (status === "retry_scheduled") counts.retryScheduled += 1;
  else if (status === "dead_letter") counts.deadLetter += 1;
  else counts[status] += 1;
}

export async function reconcileCrmQuoteBackfillQuery(
  ctx: QueryCtx,
  args: Omit<CrmQuoteBackfillCommonArgs, "batchSize">
): Promise<CrmQuoteBackfillReconciliation> {
  const commonArgs = validateBackfillCommonArgs({
    ...args,
    batchSize: 1,
  });
  const plan = await buildCrmQuoteBackfillPlan(ctx, commonArgs);
  const outboxes = await ctx.db
    .query("crmQuoteSyncOutbox")
    .withIndex("by_tenant_id", (query) =>
      query.eq("tenantId", plan.tenantId)
    )
    .take(CRM_QUOTE_BACKFILL_SCAN_LIMIT + 1);
  if (outboxes.length > CRM_QUOTE_BACKFILL_SCAN_LIMIT) {
    throw new Error(
      `Backfill outbox scan exceeded the ${CRM_QUOTE_BACKFILL_SCAN_LIMIT}-row safety limit`
    );
  }

  const allOutboxStatuses = emptyCrmQuoteSyncStatusCounts();
  const historicalRunStatuses = emptyCrmQuoteSyncStatusCounts();
  let historicalRunOutboxCount = 0;
  for (const outbox of outboxes) {
    incrementCrmQuoteSyncStatus(allOutboxStatuses, outbox.status);
    if (
      outbox.syncMode === CRM_QUOTE_BACKFILL_SYNC_MODE &&
      outbox.backfillRunId === commonArgs.backfillRunId
    ) {
      historicalRunOutboxCount += 1;
      incrementCrmQuoteSyncStatus(historicalRunStatuses, outbox.status);
    }
  }

  return {
    tenantSlug: SHED210_TENANT_SLUG,
    cutoffTimestamp: commonArgs.cutoffTimestamp,
    backfillRunId: commonArgs.backfillRunId,
    eligibleSourceCount: plan.preview.eligibleSourceCount,
    sourceWithOutboxCount: plan.preview.alreadyOutboxedCount,
    sourceMissingOutboxCount: plan.preview.remainingCount,
    invalidRemainingCount: plan.preview.invalidRemainingCount,
    outboxTotalCount: outboxes.length,
    historicalRunOutboxCount,
    allOutboxStatuses,
    historicalRunStatuses,
    sourceOutboxCoverageComplete:
      plan.preview.remainingCount === 0 &&
      plan.preview.invalidRemainingCount === 0,
    historicalRunDeliveryComplete:
      historicalRunOutboxCount > 0 &&
      historicalRunStatuses.succeeded === historicalRunOutboxCount &&
      historicalRunStatuses.pending === 0 &&
      historicalRunStatuses.processing === 0 &&
      historicalRunStatuses.retryScheduled === 0 &&
      historicalRunStatuses.deadLetter === 0,
  };
}

export async function enqueueCrmQuoteBackfillBatchMutation(
  ctx: MutationCtx,
  args: CrmQuoteBackfillCommonArgs & { expectedRemainingCount: number }
): Promise<CrmQuoteBackfillRunResult> {
  const normalized = validateBackfillCommonArgs(args);
  validateExpectedRemainingCount(args.expectedRemainingCount);
  if (!isCrmQuoteSyncEnabled()) {
    throw new Error("SHED_CRM_SYNC_ENABLED must be true before backfill");
  }
  if (!isCrmQuoteBackfillEnabled()) {
    throw new Error("SHED_CRM_BACKFILL_ENABLED must be true before backfill");
  }
  const configuration = validateCrmQuoteSyncConfiguration({
    endpointUrl: process.env.FRONTIER_PIXEL_CRM_INTAKE_URL,
    intakeKey: process.env.FRONTIER_PIXEL_CRM_INTAKE_KEY,
  });
  if (!configuration.ok) throw new Error(configuration.error);

  const plan = await buildCrmQuoteBackfillPlan(ctx, normalized);
  requireReadyBackfillPreview(plan.preview, args.expectedRemainingCount);
  const candidates = plan.validCandidates.slice(0, normalized.batchSize);
  for (const quote of candidates) {
    const outboxId = await enqueueCrmQuoteSyncOutbox(ctx, {
      tenantId: plan.tenantId,
      quoteRequestId: quote._id,
      publicId: quote.publicId,
      syncMode: CRM_QUOTE_BACKFILL_SYNC_MODE,
      backfillRunId: normalized.backfillRunId,
    });
    await ctx.scheduler.runAfter(0, internal.crmQuoteSync.sendQuoteToCrm, {
      outboxId,
    });
  }

  return {
    mode: "executed",
    tenantSlug: SHED210_TENANT_SLUG,
    cutoffTimestamp: normalized.cutoffTimestamp,
    backfillRunId: normalized.backfillRunId,
    expectedRemainingCount: args.expectedRemainingCount,
    remainingBefore: plan.preview.remainingCount,
    enqueuedCount: candidates.length,
    remainingAfter: plan.preview.remainingCount - candidates.length,
  };
}

export async function runCrmQuoteBackfillOperator(args: {
  request: CrmQuoteBackfillCommonArgs & {
    expectedRemainingCount: number;
    dryRun: boolean;
  };
  syncEnabled: boolean;
  backfillEnabled: boolean;
  endpointUrl?: string;
  intakeKey?: string;
  preview: (
    request: CrmQuoteBackfillCommonArgs
  ) => Promise<CrmQuoteBackfillPreview>;
  enqueue: (
    request: CrmQuoteBackfillCommonArgs & { expectedRemainingCount: number }
  ) => Promise<CrmQuoteBackfillRunResult>;
  probeCapability?: typeof probeCrmQuoteBackfillCapability;
}): Promise<CrmQuoteBackfillRunResult> {
  const request = validateBackfillCommonArgs(args.request);
  validateExpectedRemainingCount(args.request.expectedRemainingCount);

  if (args.request.dryRun) {
    const preview = await args.preview(request);
    requireReadyBackfillPreview(
      preview,
      args.request.expectedRemainingCount
    );
    return {
      mode: "dry_run",
      tenantSlug: SHED210_TENANT_SLUG,
      cutoffTimestamp: request.cutoffTimestamp,
      backfillRunId: request.backfillRunId,
      expectedRemainingCount: args.request.expectedRemainingCount,
      remainingBefore: preview.remainingCount,
      enqueuedCount: 0,
      remainingAfter: preview.remainingCount,
    };
  }

  if (!args.syncEnabled) {
    throw new Error("SHED_CRM_SYNC_ENABLED must be true before backfill");
  }
  if (!args.backfillEnabled) {
    throw new Error("SHED_CRM_BACKFILL_ENABLED must be true before backfill");
  }
  const configuration = validateCrmQuoteSyncConfiguration({
    endpointUrl: args.endpointUrl,
    intakeKey: args.intakeKey,
  });
  if (!configuration.ok) throw new Error(configuration.error);

  const probeCapability =
    args.probeCapability ?? probeCrmQuoteBackfillCapability;
  await probeCapability({
    endpointUrl: configuration.endpointUrl,
    intakeKey: configuration.intakeKey,
  });
  return await args.enqueue({
    ...request,
    expectedRemainingCount: args.request.expectedRemainingCount,
  });
}

export const previewHistoricalBackfill = internalQuery({
  args: {
    tenantSlug: v.literal("shed210"),
    cutoffTimestamp: v.number(),
    backfillRunId: v.string(),
    batchSize: v.number(),
  },
  returns: crmQuoteBackfillPreviewValidator,
  handler: previewCrmQuoteBackfillQuery,
});

export const reconcileHistoricalBackfill = internalQuery({
  args: {
    tenantSlug: v.literal("shed210"),
    cutoffTimestamp: v.number(),
    backfillRunId: v.string(),
  },
  returns: crmQuoteBackfillReconciliationValidator,
  handler: reconcileCrmQuoteBackfillQuery,
});

export const enqueueHistoricalBackfillBatch = internalMutation({
  args: {
    tenantSlug: v.literal("shed210"),
    cutoffTimestamp: v.number(),
    backfillRunId: v.string(),
    batchSize: v.number(),
    expectedRemainingCount: v.number(),
  },
  returns: crmQuoteBackfillRunResultValidator,
  handler: enqueueCrmQuoteBackfillBatchMutation,
});

export const executeHistoricalBackfill = internalAction({
  args: {
    tenantSlug: v.literal("shed210"),
    cutoffTimestamp: v.number(),
    backfillRunId: v.string(),
    batchSize: v.number(),
    expectedRemainingCount: v.number(),
    dryRun: v.boolean(),
  },
  returns: crmQuoteBackfillRunResultValidator,
  handler: async (ctx, args): Promise<CrmQuoteBackfillRunResult> => {
    return await runCrmQuoteBackfillOperator({
      request: args,
      syncEnabled: isCrmQuoteSyncEnabled(),
      backfillEnabled: isCrmQuoteBackfillEnabled(),
      endpointUrl: process.env.FRONTIER_PIXEL_CRM_INTAKE_URL,
      intakeKey: process.env.FRONTIER_PIXEL_CRM_INTAKE_KEY,
      preview: (request) =>
        ctx.runQuery(
          internal.crmQuoteSync.previewHistoricalBackfill,
          request
        ),
      enqueue: (request) =>
        ctx.runMutation(
          internal.crmQuoteSync.enqueueHistoricalBackfillBatch,
          request
        ),
    });
  },
});

export const claimAttempt = internalMutation({
  args: {
    outboxId: v.id("crmQuoteSyncOutbox"),
  },
  returns: v.union(
    v.object({
      outboxId: v.id("crmQuoteSyncOutbox"),
      attemptNumber: v.number(),
      payload: crmQuoteSyncPayloadValidator,
      requireBoundAcknowledgement: v.optional(v.boolean()),
    }),
    v.null()
  ),
  handler: claimCrmQuoteSyncAttemptMutation,
});

export const recoverOutbox = internalMutation({
  args: {},
  returns: v.object({
    enabled: v.boolean(),
    pendingScheduled: v.number(),
    retryScheduled: v.number(),
    staleProcessingRecovered: v.number(),
  }),
  handler: async (ctx) => {
    const enabled = isCrmQuoteSyncEnabled();
    const configured = validateCrmQuoteSyncConfiguration({
      endpointUrl: process.env.FRONTIER_PIXEL_CRM_INTAKE_URL?.trim(),
      intakeKey: process.env.FRONTIER_PIXEL_CRM_INTAKE_KEY?.trim(),
    }).ok;
    if (enabled && !configured) {
      console.error(
        "CRM quote sync recovery is paused because its Convex runtime configuration is invalid"
      );
    }
    return recoverCrmQuoteSyncOutboxMutation(ctx, {
      enabled: enabled && configured,
    });
  },
});

export const markSucceeded = internalMutation({
  args: {
    outboxId: v.id("crmQuoteSyncOutbox"),
    attemptNumber: v.number(),
    httpStatus: v.number(),
    acknowledgementBindingVersion: v.union(
      v.literal(CRM_QUOTE_ACKNOWLEDGEMENT_BINDING_VERSION),
      v.null()
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const outbox = await ctx.db.get(args.outboxId);
    if (
      !outbox ||
      outbox.status !== "processing" ||
      outbox.attemptCount !== args.attemptNumber
    ) {
      return null;
    }

    const now = Date.now();
    await ctx.db.patch(outbox._id, {
      status: "succeeded",
      lastHttpStatus: args.httpStatus,
      lastError: undefined,
      acknowledgementBindingVersion:
        args.acknowledgementBindingVersion ?? undefined,
      completedAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(outbox.quoteRequestId, {
      crmSyncStatus: "succeeded",
      crmSyncCompletedAt: now,
      crmSyncError: undefined,
    });
    return null;
  },
});

export const scheduleRetry = internalMutation({
  args: {
    outboxId: v.id("crmQuoteSyncOutbox"),
    attemptNumber: v.number(),
    httpStatus: v.union(v.number(), v.null()),
    error: v.string(),
    delayMs: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const outbox = await ctx.db.get(args.outboxId);
    if (
      !outbox ||
      outbox.status !== "processing" ||
      outbox.attemptCount !== args.attemptNumber
    ) {
      return null;
    }

    const now = Date.now();
    await ctx.db.patch(outbox._id, {
      status: "retry_scheduled",
      nextAttemptAt: now + args.delayMs,
      lastHttpStatus: args.httpStatus ?? undefined,
      lastError: truncateError(args.error),
      updatedAt: now,
    });
    await ctx.db.patch(outbox.quoteRequestId, {
      crmSyncStatus: "retry_scheduled",
      crmSyncError: truncateError(args.error),
    });
    await ctx.scheduler.runAfter(
      args.delayMs,
      internal.crmQuoteSync.sendQuoteToCrm,
      { outboxId: outbox._id }
    );
    return null;
  },
});

export const markDeadLetter = internalMutation({
  args: {
    outboxId: v.id("crmQuoteSyncOutbox"),
    attemptNumber: v.number(),
    httpStatus: v.union(v.number(), v.null()),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const outbox = await ctx.db.get(args.outboxId);
    if (
      !outbox ||
      outbox.status !== "processing" ||
      outbox.attemptCount !== args.attemptNumber
    ) {
      return null;
    }

    const now = Date.now();
    const error = truncateError(args.error);
    await ctx.db.patch(outbox._id, {
      status: "dead_letter",
      nextAttemptAt: undefined,
      lastHttpStatus: args.httpStatus ?? undefined,
      lastError: error,
      completedAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(outbox.quoteRequestId, {
      crmSyncStatus: "dead_letter",
      crmSyncCompletedAt: now,
      crmSyncError: error,
    });
    logCrmQuoteSyncDeadLetter(outbox, {
      attemptNumber: args.attemptNumber,
      httpStatus: args.httpStatus,
      error,
    });
    return null;
  },
});

export const sendQuoteToCrm = internalAction({
  args: {
    outboxId: v.id("crmQuoteSyncOutbox"),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const result = await runCrmQuoteSyncAttempt({
      enabled: isCrmQuoteSyncEnabled(),
      endpointUrl: process.env.FRONTIER_PIXEL_CRM_INTAKE_URL?.trim(),
      intakeKey: process.env.FRONTIER_PIXEL_CRM_INTAKE_KEY?.trim(),
      requireBoundAcknowledgement:
        isCrmQuoteAcknowledgementBindingRequired(),
      claimAttempt: () =>
        ctx.runMutation(internal.crmQuoteSync.claimAttempt, {
          outboxId: args.outboxId,
        }),
      postQuote: async (request) => {
        const delivery =
          await postCrmQuoteRequestWithHistoricalCapability(request);
        // A rejected key retries quietly otherwise; surface it on every attempt
        // so the key can be fixed inside the retry window.
        if (
          delivery.kind !== "succeeded" &&
          (delivery.httpStatus === 401 || delivery.httpStatus === 403)
        ) {
          console.error(
            "CRM quote sync was rejected by the CRM intake; check FRONTIER_PIXEL_CRM_INTAKE_KEY",
            { outboxId: args.outboxId, httpStatus: delivery.httpStatus }
          );
        }
        return delivery;
      },
      markSucceeded: (completion) =>
        ctx.runMutation(internal.crmQuoteSync.markSucceeded, completion),
      scheduleRetry: (completion) =>
        ctx.runMutation(internal.crmQuoteSync.scheduleRetry, completion),
      markDeadLetter: (completion) =>
        ctx.runMutation(internal.crmQuoteSync.markDeadLetter, completion),
    });
    if (result === "misconfigured") {
      console.error(
        "CRM quote sync is enabled but its Convex runtime configuration is invalid"
      );
    }
    return null;
  },
});

export async function replayDeadLetterMutation(
  ctx: MutationCtx,
  args: {
    outboxId: Id<"crmQuoteSyncOutbox">;
  }
) {
  const outbox = await ctx.db.get(args.outboxId);
  if (!outbox) throw new Error("CRM sync outbox entry not found");
  if (outbox.status !== "dead_letter") return { replayed: false };

  const now = Date.now();
  await ctx.db.patch(outbox._id, {
    status: "pending",
    attemptCount: 0,
    replayCount: outbox.replayCount + 1,
    nextAttemptAt: now,
    lastAttemptAt: undefined,
    lastHttpStatus: undefined,
    lastError: undefined,
    completedAt: undefined,
    updatedAt: now,
  });

  const quote = await ctx.db.get(outbox.quoteRequestId);
  if (quote) {
    await ctx.db.patch(quote._id, {
      crmSyncStatus: "pending",
      crmSyncLastAttemptAt: undefined,
      crmSyncCompletedAt: undefined,
      crmSyncError: undefined,
    });
  }

  await ctx.scheduler.runAfter(0, internal.crmQuoteSync.sendQuoteToCrm, {
    outboxId: outbox._id,
  });
  return { replayed: true };
}

export const replayDeadLetter = internalMutation({
  args: {
    outboxId: v.id("crmQuoteSyncOutbox"),
  },
  returns: v.object({
    replayed: v.boolean(),
  }),
  handler: replayDeadLetterMutation,
});
