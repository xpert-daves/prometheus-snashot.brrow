import { getFunctionName } from "convex/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  CRM_QUOTE_BACKFILL_MAX_BATCH_SIZE,
  CRM_QUOTE_BACKFILL_SYNC_MODE,
  CRM_QUOTE_SYNC_ENDPOINT_URL,
  CRM_QUOTE_SYNC_PROCESSING_STALE_MS,
  CRM_QUOTE_SYNC_RECOVERY_RESCHEDULE_MS,
  CRM_QUOTE_SYNC_RETRY_DELAYS_MS,
  buildCrmQuoteSyncPayload,
  claimAttempt,
  claimCrmQuoteSyncAttemptMutation,
  enqueueHistoricalBackfillBatch,
  executeHistoricalBackfill,
  getCrmQuoteSyncRetryDelayMs,
  isCrmQuoteAcknowledgementBindingRequired,
  isCrmQuoteSyncEnabled,
  markDeadLetter,
  markSucceeded,
  postCrmQuoteRequest,
  postCrmQuoteRequestWithHistoricalCapability,
  previewHistoricalBackfill,
  probeCrmQuoteBackfillCapability,
  recoverCrmQuoteSyncOutboxMutation,
  replayDeadLetterMutation,
  runCrmQuoteBackfillOperator,
  runCrmQuoteSyncAttempt,
  scheduleRetry,
  sendQuoteToCrm,
  validateCrmQuoteSyncConfiguration,
  validateCrmQuoteSyncEndpoint,
  type ClaimedCrmQuoteSyncAttempt,
  type CrmQuoteDeliveryResult,
  type CrmQuoteBackfillPreview,
  type CrmQuoteBackfillRunResult,
} from "../crmQuoteSync";
import { CRM_QUOTE_ACKNOWLEDGEMENT_BINDING_VERSION } from "../validators";

const quoteRequestId = "quoteRequests-1" as Id<"quoteRequests">;
const outboxId = "crmQuoteSyncOutbox-1" as Id<"crmQuoteSyncOutbox">;
const tenantId = "tenants-shed210" as Id<"tenants">;

type HistoricalBackfillActionArgs = {
  tenantSlug: "shed210";
  cutoffTimestamp: number;
  backfillRunId: string;
  batchSize: number;
  expectedRemainingCount: number;
  dryRun: boolean;
};

type HistoricalBackfillActionCtx = {
  runQuery: (
    reference: unknown,
    args: Record<string, unknown>
  ) => Promise<CrmQuoteBackfillPreview>;
  runMutation: (
    reference: unknown,
    args: Record<string, unknown>
  ) => Promise<CrmQuoteBackfillRunResult>;
};

const executeHistoricalBackfillHandler = (
  executeHistoricalBackfill as unknown as {
    _handler: (
      ctx: HistoricalBackfillActionCtx,
      args: HistoricalBackfillActionArgs
    ) => Promise<CrmQuoteBackfillRunResult>;
  }
)._handler;

function registeredArgumentNames(registeredFunction: unknown) {
  const { exportArgs } = registeredFunction as {
    exportArgs: () => string;
  };
  const validator = JSON.parse(exportArgs()) as {
    type: string;
    value: Record<string, unknown>;
  };
  if (validator.type !== "object" || !validator.value) {
    throw new Error("Expected a registered object argument validator");
  }
  return Object.keys(validator.value).sort();
}

const successfulAcknowledgement = {
  ok: true,
  status: "created",
  tenantSlug: "shed210",
  leadId: "leads-1",
  quoteRequestId: "quoteRequests-target-1",
  shedQuoteRequestId: "shedQuoteRequests-1",
  externalSubmissionId: "shed210:quote:quote-public-1",
  sourceDocumentId: "quoteRequests-1",
  publicId: "quote-public-1",
};

const quote = {
  _id: quoteRequestId,
  _creationTime: 1_714_000_000_000,
  tenantId,
  publicId: "quote-public-1",
  sessionId: "session-1",
  contact: {
    name: "Maria Garcia",
    email: "maria@example.com",
    phone: "+12105550123",
  },
  smsConsent: {
    status: "opted_in",
    source: "website_quote_form",
    consentText: "I agree to transactional texts.",
    consentTextVersion: "transactional-v1",
    pageUrl: "https://shed210.com/quote",
    ipAddress: "203.0.113.10",
    userAgent: "Example browser",
    recordedAt: 1_713_999_999_000,
  },
  smsMarketingConsent: {
    status: "not_opted_in",
    source: "website_quote_form",
    consentText: null,
    consentTextVersion: "marketing-v1",
    pageUrl: "https://shed210.com/quote",
    ipAddress: "203.0.113.10",
    userAgent: "Example browser",
    recordedAt: 1_713_999_999_000,
  },
  inputs: {
    structureType: "storage_shed",
    length: 12,
    width: 8,
    roofStyle: "gabled",
    wallHeight: 8,
    roofMaterial: "29ga metal",
    frameGauge: "14-ga",
    addOns: ["Workbench"],
    ventilation: true,
    deliveryAddress: "123 Test St, San Antonio, TX 78205",
    deliveryZip: "78205",
    deliveryRadius: 5,
    visualPlacement: {
      version: 1,
      defaultsVersion: "shed-v3",
      customized: true,
      doors: [
        {
          id: "door-1",
          side: "front",
          width: 4,
          height: 6,
          offset: 0.25,
          placement: "custom",
        },
      ],
      windows: [],
    },
  },
  pricing: {
    total: 3500,
    breakdown: {
      base: 3000,
      wallHeight: 200,
      roof: 0,
      siding: 0,
      door: 0,
      windows: 0,
      addOns: 300,
      delivery: 0,
      discount: 0,
      interiorUpgrades: [],
    },
    config: {
      provider: "frontier_pixel_crm",
      source: "table",
      settingsId: null,
      pricingPublicationId: "publication-7",
      key: "active",
      configVersion: 7,
      pricingSchemaVersion: 1,
      pricingPublicationVersion: 7,
      updatedAt: 1_713_000_000_000,
    },
  },
  notificationStatus: "queued",
  notificationQueuedAt: 1_714_000_000_000,
  emailNotificationStatus: "queued",
  emailNotificationQueuedAt: 1_714_000_000_000,
  crmSyncStatus: "pending",
  crmSyncOutboxId: outboxId,
  createdAt: 1_714_000_000_000,
} satisfies Doc<"quoteRequests">;

const outbox = {
  _id: outboxId,
  _creationTime: 1_714_000_000_000,
  tenantId,
  tenantSlug: "shed210",
  quoteRequestId,
  externalSubmissionId: "shed210:quote:quote-public-1",
  sourceDeployment: "prod:handsome-pigeon-985",
  status: "pending",
  attemptCount: 0,
  replayCount: 0,
  createdAt: 1_714_000_000_000,
  updatedAt: 1_714_000_000_000,
} satisfies Doc<"crmQuoteSyncOutbox">;

function claimedAttempt(
  attemptNumber = 1
): ClaimedCrmQuoteSyncAttempt {
  return {
    outboxId,
    attemptNumber,
    payload: buildCrmQuoteSyncPayload({ quote, outbox }),
  };
}

function createRunHarness(args: {
  enabled?: boolean;
  attemptNumber?: number;
  deliveryResult?: CrmQuoteDeliveryResult;
  endpointUrl?: string;
  intakeKey?: string;
  requireBoundAcknowledgement?: boolean;
} = {}) {
  const claimAttempt = jest.fn(async () =>
    claimedAttempt(args.attemptNumber ?? 1)
  );
  const deliveryResult: CrmQuoteDeliveryResult = args.deliveryResult ?? {
    kind: "succeeded",
    httpStatus: 201,
  };
  const postQuote = jest.fn(
    async (): Promise<CrmQuoteDeliveryResult> => deliveryResult
  );
  const markSucceeded = jest.fn(async () => null);
  const scheduleRetry = jest.fn(async () => null);
  const markDeadLetter = jest.fn(async () => null);

  return {
    run: () =>
      runCrmQuoteSyncAttempt({
        enabled: args.enabled ?? true,
        endpointUrl:
          args.endpointUrl === undefined
            ? CRM_QUOTE_SYNC_ENDPOINT_URL
            : args.endpointUrl,
        intakeKey:
          args.intakeKey === undefined ? "crm-intake-key" : args.intakeKey,
        requireBoundAcknowledgement: args.requireBoundAcknowledgement,
        claimAttempt,
        postQuote,
        markSucceeded,
        scheduleRetry,
        markDeadLetter,
      }),
    claimAttempt,
    postQuote,
    markSucceeded,
    scheduleRetry,
    markDeadLetter,
  };
}

type RecoveryCondition = {
  kind: "eq" | "lte";
  field: string;
  value: unknown;
};

type RecoveryIndexBuilder = {
  eq: (field: string, value: unknown) => RecoveryIndexBuilder;
  lte: (field: string, value: unknown) => RecoveryIndexBuilder;
};

class RecoveryFakeQuery {
  private readonly conditions: RecoveryCondition[] = [];

  constructor(private readonly rows: Doc<"crmQuoteSyncOutbox">[]) {}

  withIndex(_name: string, build: (q: RecoveryIndexBuilder) => unknown) {
    const builder: RecoveryIndexBuilder = {
      eq: (field, value) => {
        this.conditions.push({ kind: "eq", field, value });
        return builder;
      },
      lte: (field, value) => {
        this.conditions.push({ kind: "lte", field, value });
        return builder;
      },
    };
    build(builder);
    return this;
  }

  async take(limit: number) {
    return this.rows
      .filter((row) =>
        this.conditions.every((condition) => {
          const actual = (row as unknown as Record<string, unknown>)[
            condition.field
          ];
          if (condition.kind === "eq") return actual === condition.value;
          return (
            typeof actual === "number" &&
            typeof condition.value === "number" &&
            actual <= condition.value
          );
        })
      )
      .slice(0, limit);
  }
}

function createRecoveryMutationCtx(
  outboxes: Doc<"crmQuoteSyncOutbox">[],
  quotes: Doc<"quoteRequests">[] = [{ ...quote }]
) {
  const scheduled: Array<{
    delayMs: number;
    args: { outboxId: Id<"crmQuoteSyncOutbox"> };
  }> = [];
  const allRows = [...outboxes, ...quotes];
  const ctx = {
    db: {
      query: () => new RecoveryFakeQuery(outboxes),
      get: async (id: string) => allRows.find((row) => row._id === id) ?? null,
      patch: async (id: string, value: Record<string, unknown>) => {
        const row = allRows.find((candidate) => candidate._id === id);
        if (!row) throw new Error(`Document not found: ${id}`);
        Object.assign(row, value);
      },
    },
    scheduler: {
      runAfter: async (
        delayMs: number,
        _ref: unknown,
        args: { outboxId: Id<"crmQuoteSyncOutbox"> }
      ) => {
        scheduled.push({ delayMs, args });
      },
    },
  } as unknown as MutationCtx;
  return { ctx, scheduled };
}

type SendQuoteActionCtx = {
  runMutation: (
    reference: Parameters<typeof getFunctionName>[0],
    args: Record<string, unknown>
  ) => Promise<unknown>;
};

const sendQuoteToCrmHandler = (
  sendQuoteToCrm as unknown as {
    _handler: (
      ctx: SendQuoteActionCtx,
      args: { outboxId: Id<"crmQuoteSyncOutbox"> }
    ) => Promise<null>;
  }
)._handler;

// Runs the real delivery mutations against the in-memory recovery ctx, so the
// action boundary can be exercised end to end with a stubbed global fetch.
function createSendQuoteActionCtx(mutationCtx: MutationCtx): SendQuoteActionCtx {
  const registered: Record<string, unknown> = {
    "crmQuoteSync:claimAttempt": claimAttempt,
    "crmQuoteSync:markSucceeded": markSucceeded,
    "crmQuoteSync:scheduleRetry": scheduleRetry,
    "crmQuoteSync:markDeadLetter": markDeadLetter,
  };
  return {
    runMutation: async (reference, args) => {
      const mutation = registered[getFunctionName(reference)] as
        | {
            _handler: (
              ctx: MutationCtx,
              args: Record<string, unknown>
            ) => Promise<unknown>;
          }
        | undefined;
      if (!mutation) {
        throw new Error(`Unexpected mutation ${getFunctionName(reference)}`);
      }
      return await mutation._handler(mutationCtx, args);
    },
  };
}

function stubReceiverStatus(status: number) {
  const fetchSpy = jest.fn(async () => ({
    ok: false,
    status,
  })) as unknown as jest.Mock<Promise<Response>>;
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: fetchSpy,
  });
  return fetchSpy;
}

function enableLiveSync() {
  process.env.SHED_CRM_SYNC_ENABLED = "true";
  process.env.FRONTIER_PIXEL_CRM_INTAKE_URL = CRM_QUOTE_SYNC_ENDPOINT_URL;
  process.env.FRONTIER_PIXEL_CRM_INTAKE_KEY = "crm-intake-key";
}

function expectNoContactData(logged: unknown) {
  const serialized = JSON.stringify(logged);
  for (const secretOrContact of [
    quote.contact.name,
    quote.contact.email,
    quote.contact.phone,
    quote.inputs.deliveryAddress,
    quote.smsConsent.ipAddress,
    "crm-intake-key",
  ]) {
    expect(serialized).not.toContain(secretOrContact);
  }
}

describe("Shed CRM quote sync", () => {
  const originalSyncEnabled = process.env.SHED_CRM_SYNC_ENABLED;
  const originalBackfillEnabled = process.env.SHED_CRM_BACKFILL_ENABLED;
  const originalIntakeUrl = process.env.FRONTIER_PIXEL_CRM_INTAKE_URL;
  const originalIntakeKey = process.env.FRONTIER_PIXEL_CRM_INTAKE_KEY;
  const originalFetchDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "fetch"
  );

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalFetchDescriptor) {
      Object.defineProperty(globalThis, "fetch", originalFetchDescriptor);
    } else {
      delete (globalThis as { fetch?: typeof fetch }).fetch;
    }
    if (originalSyncEnabled === undefined) {
      delete process.env.SHED_CRM_SYNC_ENABLED;
    } else {
      process.env.SHED_CRM_SYNC_ENABLED = originalSyncEnabled;
    }
    if (originalBackfillEnabled === undefined) {
      delete process.env.SHED_CRM_BACKFILL_ENABLED;
    } else {
      process.env.SHED_CRM_BACKFILL_ENABLED = originalBackfillEnabled;
    }
    if (originalIntakeUrl === undefined) {
      delete process.env.FRONTIER_PIXEL_CRM_INTAKE_URL;
    } else {
      process.env.FRONTIER_PIXEL_CRM_INTAKE_URL = originalIntakeUrl;
    }
    if (originalIntakeKey === undefined) {
      delete process.env.FRONTIER_PIXEL_CRM_INTAKE_KEY;
    } else {
      process.env.FRONTIER_PIXEL_CRM_INTAKE_KEY = originalIntakeKey;
    }
  });

  it("builds the deterministic receiver payload with consent, placement, and pricing metadata", () => {
    const payload = buildCrmQuoteSyncPayload({ quote, outbox });

    expect(payload).toMatchObject({
      externalSubmissionId: "shed210:quote:quote-public-1",
      tenantSlug: "shed210",
      source: {
        system: "shed210",
        deployment: "prod:handsome-pigeon-985",
        documentId: quoteRequestId,
        pricingSettingsId: null,
        pricingPublicationId: "publication-7",
        pricingConfigVersion: 7,
        pricingProvider: "frontier_pixel_crm",
        pricingSchemaVersion: 1,
        pricingPublicationVersion: 7,
      },
      publicId: "quote-public-1",
      sessionId: "session-1",
      submittedAt: 1_714_000_000_000,
      contact: quote.contact,
      consent: {
        transactional: quote.smsConsent,
        marketing: quote.smsMarketingConsent,
      },
      quote: {
        inputs: quote.inputs,
        pricing: quote.pricing,
      },
    });
  });

  it("omits new provenance fields for legacy quotes so retries stay idempotent", () => {
    const legacyQuote = JSON.parse(JSON.stringify(quote)) as Doc<"quoteRequests">;
    const legacyConfig = legacyQuote.pricing.config;
    expect(legacyConfig).toBeDefined();
    if (!legacyConfig) throw new Error("Expected pricing config fixture");
    delete legacyConfig.provider;
    delete legacyConfig.pricingSchemaVersion;
    delete legacyConfig.pricingPublicationVersion;

    const payload = buildCrmQuoteSyncPayload({
      quote: legacyQuote,
      outbox,
    });

    expect(payload.source).not.toHaveProperty("pricingProvider");
    expect(payload.source).not.toHaveProperty("pricingSchemaVersion");
    expect(payload.source).not.toHaveProperty("pricingPublicationVersion");
  });

  it("omits portable provenance for a local built-in default", () => {
    const defaultQuote = JSON.parse(JSON.stringify(quote)) as Doc<"quoteRequests">;
    const config = defaultQuote.pricing.config;
    expect(config).toBeDefined();
    if (!config) throw new Error("Expected pricing config fixture");
    config.provider = "shed_convex";
    config.source = "default";
    config.settingsId = null;
    config.pricingPublicationId = null;
    config.configVersion = 1;
    config.pricingSchemaVersion = 1;
    config.pricingPublicationVersion = null;

    const payload = buildCrmQuoteSyncPayload({
      quote: defaultQuote,
      outbox,
    });

    expect(payload.source).not.toHaveProperty("pricingProvider");
    expect(payload.source).not.toHaveProperty("pricingSchemaVersion");
    expect(payload.source).not.toHaveProperty("pricingPublicationVersion");
  });

  it("adds historical provenance only to historical payloads", () => {
    const livePayload = buildCrmQuoteSyncPayload({ quote, outbox });
    expect(livePayload.source).not.toHaveProperty("syncMode");
    expect(livePayload.source).not.toHaveProperty("backfillRunId");

    const historicalPayload = buildCrmQuoteSyncPayload({
      quote,
      outbox: {
        ...outbox,
        syncMode: CRM_QUOTE_BACKFILL_SYNC_MODE,
        backfillRunId: "shed210-quotes-2026-07-15",
      },
    });
    expect(historicalPayload.source).toMatchObject({
      syncMode: "historical_backfill",
      backfillRunId: "shed210-quotes-2026-07-15",
    });
  });

  it("requires the exact authenticated no-store historical capability", async () => {
    const fetchImpl = jest.fn(async () => ({
      status: 200,
      json: async () => ({
        ok: true,
        tenantSlug: "shed210",
        historicalBackfillVersion: 1,
      }),
    })) as unknown as typeof fetch;

    await expect(
      probeCrmQuoteBackfillCapability({
        endpointUrl: CRM_QUOTE_SYNC_ENDPOINT_URL,
        intakeKey: "crm-intake-key",
        fetchImpl,
      })
    ).resolves.toEqual({
      ok: true,
      tenantSlug: "shed210",
      historicalBackfillVersion: 1,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      CRM_QUOTE_SYNC_ENDPOINT_URL,
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
        redirect: "manual",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer crm-intake-key",
          "Cache-Control": "no-cache",
        },
      })
    );
  });

  it.each([404, 405, 401])(
    "rejects historical capability HTTP %i before enqueue",
    async (status) => {
      const fetchImpl = jest.fn(async () => ({
        status,
        json: async () => ({}),
      })) as unknown as typeof fetch;
      await expect(
        probeCrmQuoteBackfillCapability({
          endpointUrl: CRM_QUOTE_SYNC_ENDPOINT_URL,
          intakeKey: "crm-intake-key",
          fetchImpl,
        })
      ).rejects.toThrow(`capability returned ${status}`);
    }
  );

  it.each([
    {
      ok: true,
      tenantSlug: "wrong",
      historicalBackfillVersion: 1,
    },
    {
      ok: true,
      tenantSlug: "shed210",
      historicalBackfillVersion: 2,
    },
    {
      ok: true,
      tenantSlug: "shed210",
      historicalBackfillVersion: 1,
      extra: true,
    },
  ])("rejects a non-exact historical capability %#", async (body) => {
    const fetchImpl = jest.fn(async () => ({
      status: 200,
      json: async () => body,
    })) as unknown as typeof fetch;
    await expect(
      probeCrmQuoteBackfillCapability({
        endpointUrl: CRM_QUOTE_SYNC_ENDPOINT_URL,
        intakeKey: "crm-intake-key",
        fetchImpl,
      })
    ).rejects.toThrow("did not match version 1");
  });

  it("rejects historical capability network failures", async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error("socket reset");
    }) as unknown as typeof fetch;
    await expect(
      probeCrmQuoteBackfillCapability({
        endpointUrl: CRM_QUOTE_SYNC_ENDPOINT_URL,
        intakeKey: "crm-intake-key",
        fetchImpl,
      })
    ).rejects.toThrow("socket reset");
  });

  it("probes immediately before each historical POST but sends live payloads directly", async () => {
    const historicalPayload = buildCrmQuoteSyncPayload({
      quote,
      outbox: {
        ...outbox,
        syncMode: CRM_QUOTE_BACKFILL_SYNC_MODE,
        backfillRunId: "shed210-quotes-2026-07-15",
      },
    });
    const historicalMethods: string[] = [];
    const historicalFetch = jest.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        historicalMethods.push(init?.method ?? "GET");
        if (init?.method === "GET") {
          return {
            status: 200,
            json: async () => ({
              ok: true,
              tenantSlug: "shed210",
              historicalBackfillVersion: 1,
            }),
          } as Response;
        }
        return {
          ok: true,
          status: 201,
          json: async () => successfulAcknowledgement,
        } as Response;
      }
    ) as unknown as typeof fetch;
    await expect(
      postCrmQuoteRequestWithHistoricalCapability({
        endpointUrl: CRM_QUOTE_SYNC_ENDPOINT_URL,
        intakeKey: "crm-intake-key",
        payload: historicalPayload,
        fetchImpl: historicalFetch,
      })
    ).resolves.toEqual({ kind: "succeeded", httpStatus: 201 });
    expect(historicalMethods).toEqual(["GET", "POST"]);

    const liveMethods: string[] = [];
    const liveFetch = jest.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        liveMethods.push(init?.method ?? "GET");
        return {
          ok: true,
          status: 201,
          json: async () => successfulAcknowledgement,
        } as Response;
      }
    ) as unknown as typeof fetch;
    await expect(
      postCrmQuoteRequestWithHistoricalCapability({
        endpointUrl: CRM_QUOTE_SYNC_ENDPOINT_URL,
        intakeKey: "crm-intake-key",
        payload: buildCrmQuoteSyncPayload({ quote, outbox }),
        fetchImpl: liveFetch,
      })
    ).resolves.toEqual({ kind: "succeeded", httpStatus: 201 });
    expect(liveMethods).toEqual(["POST"]);
  });

  it("turns historical capability failures into retries without a quote POST", async () => {
    const historicalPayload = buildCrmQuoteSyncPayload({
      quote,
      outbox: {
        ...outbox,
        syncMode: CRM_QUOTE_BACKFILL_SYNC_MODE,
        backfillRunId: "shed210-quotes-2026-07-15",
      },
    });
    const scenarios: Array<{
      name: string;
      fetchImpl: typeof fetch;
    }> = [
      {
        name: "missing receiver",
        fetchImpl: jest.fn(async () => ({
          status: 404,
          json: async () => ({}),
        })) as unknown as typeof fetch,
      },
      {
        name: "old receiver",
        fetchImpl: jest.fn(async () => ({
          status: 405,
          json: async () => ({}),
        })) as unknown as typeof fetch,
      },
      {
        name: "wrong capability",
        fetchImpl: jest.fn(async () => ({
          status: 200,
          json: async () => ({
            ok: true,
            tenantSlug: "shed210",
            historicalBackfillVersion: 2,
          }),
        })) as unknown as typeof fetch,
      },
      {
        name: "network failure",
        fetchImpl: jest.fn(async () => {
          throw new Error("socket reset");
        }) as unknown as typeof fetch,
      },
    ];

    for (const scenario of scenarios) {
      const deliveryResult =
        await postCrmQuoteRequestWithHistoricalCapability({
          endpointUrl: CRM_QUOTE_SYNC_ENDPOINT_URL,
          intakeKey: "crm-intake-key",
          payload: historicalPayload,
          fetchImpl: scenario.fetchImpl,
        });
      expect(deliveryResult).toMatchObject({
        kind: "retryable",
        httpStatus: null,
        error: expect.stringContaining(
          "historical backfill capability check failed"
        ),
      });
      expect(scenario.fetchImpl).toHaveBeenCalledTimes(1);

      const harness = createRunHarness({ deliveryResult });
      await expect(harness.run()).resolves.toBe("retry_scheduled");
      expect(harness.scheduleRetry).toHaveBeenCalledTimes(1);
      expect(harness.markSucceeded).not.toHaveBeenCalled();
      expect(harness.markDeadLetter).not.toHaveBeenCalled();
    }
  });

  it("keeps dry-run read-only and capability-free", async () => {
    const preview: CrmQuoteBackfillPreview = {
      tenantSlug: "shed210",
      cutoffTimestamp: 1_714_000_000_000,
      backfillRunId: "shed210-quotes-2026-07-15",
      eligibleSourceCount: 76,
      alreadyOutboxedCount: 1,
      remainingCount: 75,
      validRemainingCount: 75,
      invalidRemainingCount: 0,
      requestedBatchSize: 10,
      wouldEnqueueCount: 10,
      ready: true,
      issueCounts: [],
    };
    const previewFn = jest.fn(async () => preview);
    const enqueue = jest.fn();
    const probeCapability = jest.fn();
    await expect(
      runCrmQuoteBackfillOperator({
        request: {
          tenantSlug: "shed210",
          cutoffTimestamp: preview.cutoffTimestamp,
          backfillRunId: preview.backfillRunId,
          batchSize: 10,
          expectedRemainingCount: 75,
          dryRun: true,
        },
        syncEnabled: false,
        backfillEnabled: false,
        preview: previewFn,
        enqueue,
        probeCapability,
      })
    ).resolves.toMatchObject({
      mode: "dry_run",
      remainingBefore: 75,
      enqueuedCount: 0,
      remainingAfter: 75,
    });
    expect(previewFn).toHaveBeenCalledTimes(1);
    expect(previewFn).toHaveBeenCalledWith({
      tenantSlug: "shed210",
      cutoffTimestamp: preview.cutoffTimestamp,
      backfillRunId: preview.backfillRunId,
      batchSize: 10,
    });
    expect(probeCapability).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("passes only the registered preview arguments through the dry-run action boundary", async () => {
    const request: HistoricalBackfillActionArgs = {
      tenantSlug: "shed210",
      cutoffTimestamp: 1_714_000_000_000,
      backfillRunId: "shed210-quotes-2026-07-15",
      batchSize: 10,
      expectedRemainingCount: 75,
      dryRun: true,
    };
    const preview: CrmQuoteBackfillPreview = {
      tenantSlug: "shed210",
      cutoffTimestamp: request.cutoffTimestamp,
      backfillRunId: request.backfillRunId,
      eligibleSourceCount: 76,
      alreadyOutboxedCount: 1,
      remainingCount: 75,
      validRemainingCount: 75,
      invalidRemainingCount: 0,
      requestedBatchSize: 10,
      wouldEnqueueCount: 10,
      ready: true,
      issueCounts: [],
    };
    const previewArgumentNames = registeredArgumentNames(
      previewHistoricalBackfill
    );
    const runQuery = jest.fn(async (_reference, args) => {
      expect(Object.keys(args).sort()).toEqual(previewArgumentNames);
      return preview;
    });
    const runMutation = jest.fn();
    const runAfter = jest.fn();
    const runAt = jest.fn();
    const fetchSpy = jest
      .fn()
      .mockRejectedValue(new Error("dry-run must not use the network"));
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: fetchSpy,
    });

    await expect(
      executeHistoricalBackfillHandler(
        {
          runQuery,
          runMutation,
          scheduler: { runAfter, runAt },
        } as HistoricalBackfillActionCtx,
        request
      )
    ).resolves.toMatchObject({
      mode: "dry_run",
      remainingBefore: 75,
      enqueuedCount: 0,
      remainingAfter: 75,
    });

    expect(runQuery).toHaveBeenCalledTimes(1);
    expect(runMutation).not.toHaveBeenCalled();
    expect(runAfter).not.toHaveBeenCalled();
    expect(runAt).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("probes capability before passing only registered enqueue arguments through the execute action boundary", async () => {
    process.env.SHED_CRM_SYNC_ENABLED = "true";
    process.env.SHED_CRM_BACKFILL_ENABLED = "true";
    process.env.FRONTIER_PIXEL_CRM_INTAKE_URL = CRM_QUOTE_SYNC_ENDPOINT_URL;
    process.env.FRONTIER_PIXEL_CRM_INTAKE_KEY = "crm-intake-key";

    const request: HistoricalBackfillActionArgs = {
      tenantSlug: "shed210",
      cutoffTimestamp: 1_714_000_000_000,
      backfillRunId: "shed210-quotes-2026-07-15",
      batchSize: 10,
      expectedRemainingCount: 75,
      dryRun: false,
    };
    const result: CrmQuoteBackfillRunResult = {
      mode: "executed",
      tenantSlug: "shed210",
      cutoffTimestamp: request.cutoffTimestamp,
      backfillRunId: request.backfillRunId,
      expectedRemainingCount: 75,
      remainingBefore: 75,
      enqueuedCount: 10,
      remainingAfter: 65,
    };
    const events: string[] = [];
    const enqueueArgumentNames = registeredArgumentNames(
      enqueueHistoricalBackfillBatch
    );
    const fetchSpy = jest.fn(async () => {
      events.push("capability");
      return {
        status: 200,
        json: async () => ({
          ok: true,
          tenantSlug: "shed210",
          historicalBackfillVersion: 1,
        }),
      } as Response;
    });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: fetchSpy,
    });
    const runQuery = jest.fn();
    const runMutation = jest.fn(async (_reference, args) => {
      events.push("mutation");
      expect(Object.keys(args).sort()).toEqual(enqueueArgumentNames);
      expect(args).not.toHaveProperty("dryRun");
      return result;
    });

    await expect(
      executeHistoricalBackfillHandler(
        { runQuery, runMutation } as HistoricalBackfillActionCtx,
        request
      )
    ).resolves.toEqual(result);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(runMutation).toHaveBeenCalledTimes(1);
    expect(runQuery).not.toHaveBeenCalled();
    expect(events).toEqual(["capability", "mutation"]);
  });

  it("fails closed before enqueue on capability failure or an invalid batch", async () => {
    const enqueue = jest.fn();
    const request = {
      tenantSlug: "shed210" as const,
      cutoffTimestamp: 1_714_000_000_000,
      backfillRunId: "shed210-quotes-2026-07-15",
      batchSize: 1,
      expectedRemainingCount: 75,
      dryRun: false,
    };
    const preview = jest.fn();
    const probeCapability = jest.fn(async () => {
      throw new Error("old receiver");
    });
    await expect(
      runCrmQuoteBackfillOperator({
        request,
        syncEnabled: true,
        backfillEnabled: true,
        endpointUrl: CRM_QUOTE_SYNC_ENDPOINT_URL,
        intakeKey: "crm-intake-key",
        preview,
        enqueue,
        probeCapability,
      })
    ).rejects.toThrow("old receiver");
    expect(preview).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();

    await expect(
      runCrmQuoteBackfillOperator({
        request: {
          ...request,
          batchSize: CRM_QUOTE_BACKFILL_MAX_BATCH_SIZE + 1,
        },
        syncEnabled: true,
        backfillEnabled: true,
        endpointUrl: CRM_QUOTE_SYNC_ENDPOINT_URL,
        intakeKey: "crm-intake-key",
        preview,
        enqueue,
        probeCapability,
      })
    ).rejects.toThrow("batch size");
    expect(probeCapability).toHaveBeenCalledTimes(1);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("treats the kill switch as off unless it is explicitly true", async () => {
    expect(isCrmQuoteSyncEnabled(undefined)).toBe(false);
    expect(isCrmQuoteSyncEnabled("false")).toBe(false);
    expect(isCrmQuoteSyncEnabled(" TRUE ")).toBe(true);

    const harness = createRunHarness({ enabled: false });
    await expect(harness.run()).resolves.toBe("disabled");
    expect(harness.claimAttempt).not.toHaveBeenCalled();
    expect(harness.postQuote).not.toHaveBeenCalled();
  });

  it("enables acknowledgement binding only for an explicit valid flag", () => {
    expect(isCrmQuoteAcknowledgementBindingRequired(undefined)).toBe(false);
    expect(isCrmQuoteAcknowledgementBindingRequired(" false ")).toBe(false);
    expect(isCrmQuoteAcknowledgementBindingRequired(" TRUE ")).toBe(true);
    expect(() => isCrmQuoteAcknowledgementBindingRequired("enabled")).toThrow(
      "must be true or false"
    );
  });

  it("resumes pending and due retries after enable and recovers stale processing", async () => {
    const now = 1_714_001_000_000;
    const pending: Doc<"crmQuoteSyncOutbox"> = {
      ...outbox,
      _id: "crmQuoteSyncOutbox-pending" as Id<"crmQuoteSyncOutbox">,
      nextAttemptAt: now - 1,
    };
    const dueRetry: Doc<"crmQuoteSyncOutbox"> = {
      ...outbox,
      _id: "crmQuoteSyncOutbox-due" as Id<"crmQuoteSyncOutbox">,
      status: "retry_scheduled",
      attemptCount: 1,
      nextAttemptAt: now,
    };
    const futureRetry: Doc<"crmQuoteSyncOutbox"> = {
      ...outbox,
      _id: "crmQuoteSyncOutbox-future" as Id<"crmQuoteSyncOutbox">,
      status: "retry_scheduled",
      attemptCount: 1,
      nextAttemptAt: now + 1,
    };
    const staleProcessing: Doc<"crmQuoteSyncOutbox"> = {
      ...outbox,
      _id: "crmQuoteSyncOutbox-stale" as Id<"crmQuoteSyncOutbox">,
      status: "processing",
      attemptCount: 2,
      lastAttemptAt: now - CRM_QUOTE_SYNC_PROCESSING_STALE_MS - 1,
    };
    const freshProcessing: Doc<"crmQuoteSyncOutbox"> = {
      ...outbox,
      _id: "crmQuoteSyncOutbox-fresh" as Id<"crmQuoteSyncOutbox">,
      status: "processing",
      attemptCount: 2,
      lastAttemptAt: now - CRM_QUOTE_SYNC_PROCESSING_STALE_MS + 1,
    };
    const mutableQuote: Doc<"quoteRequests"> = {
      ...quote,
      crmSyncStatus: "processing",
    };
    const { ctx, scheduled } = createRecoveryMutationCtx(
      [pending, dueRetry, futureRetry, staleProcessing, freshProcessing],
      [mutableQuote]
    );

    await expect(
      recoverCrmQuoteSyncOutboxMutation(ctx, { enabled: false, now })
    ).resolves.toEqual({
      enabled: false,
      pendingScheduled: 0,
      retryScheduled: 0,
      staleProcessingRecovered: 0,
    });
    expect(scheduled).toHaveLength(0);

    await expect(
      recoverCrmQuoteSyncOutboxMutation(ctx, { enabled: true, now })
    ).resolves.toEqual({
      enabled: true,
      pendingScheduled: 1,
      retryScheduled: 1,
      staleProcessingRecovered: 1,
    });
    expect(scheduled.map((job) => job.args.outboxId)).toEqual([
      pending._id,
      dueRetry._id,
      staleProcessing._id,
    ]);
    expect(pending.nextAttemptAt).toBe(
      now + CRM_QUOTE_SYNC_RECOVERY_RESCHEDULE_MS
    );
    expect(dueRetry.nextAttemptAt).toBe(
      now + CRM_QUOTE_SYNC_RECOVERY_RESCHEDULE_MS
    );
    expect(futureRetry.nextAttemptAt).toBe(now + 1);
    expect(staleProcessing).toMatchObject({
      status: "pending",
      nextAttemptAt: now + CRM_QUOTE_SYNC_RECOVERY_RESCHEDULE_MS,
      lastError: "Recovered stale CRM sync attempt 2",
    });
    expect(freshProcessing.status).toBe("processing");
    expect(mutableQuote).toMatchObject({
      crmSyncStatus: "pending",
      crmSyncError: "Recovered stale CRM sync attempt 2",
    });
  });

  it("claims only pending or retry-scheduled rows and guards active or terminal statuses", async () => {
    for (const status of [
      "processing",
      "succeeded",
      "dead_letter",
    ] as const) {
      const guarded: Doc<"crmQuoteSyncOutbox"> = { ...outbox, status };
      const { ctx } = createRecoveryMutationCtx([guarded]);
      await expect(
        claimCrmQuoteSyncAttemptMutation(ctx, { outboxId: guarded._id })
      ).resolves.toBeNull();
      expect(guarded.attemptCount).toBe(0);
    }

    const now = 1_714_001_100_000;
    const claimable: Doc<"crmQuoteSyncOutbox"> = {
      ...outbox,
      nextAttemptAt: now,
    };
    const { ctx } = createRecoveryMutationCtx([claimable]);
    jest.spyOn(Date, "now").mockReturnValue(now);
    await expect(
      claimCrmQuoteSyncAttemptMutation(ctx, { outboxId: claimable._id })
    ).resolves.toMatchObject({ outboxId, attemptNumber: 1 });
    expect(claimable).toMatchObject({
      status: "processing",
      attemptCount: 1,
      lastAttemptAt: now,
    });
  });

  it("marks a successful delivery once", async () => {
    const harness = createRunHarness();

    await expect(harness.run()).resolves.toBe("succeeded");
    expect(harness.markSucceeded).toHaveBeenCalledWith({
      outboxId,
      attemptNumber: 1,
      httpStatus: 201,
      acknowledgementBindingVersion: null,
    });
    expect(harness.scheduleRetry).not.toHaveBeenCalled();
    expect(harness.markDeadLetter).not.toHaveBeenCalled();
  });

  it("requires source-bound delivery for a quote carrying a discussion capability", async () => {
    const protectedQuote: Doc<"quoteRequests"> = {
      ...quote,
      discussionTokenHash: "a".repeat(64),
      discussionTokenExpiresAt: Date.now() + 60_000,
    };
    const mutableOutbox: Doc<"crmQuoteSyncOutbox"> = { ...outbox };
    const { ctx } = createRecoveryMutationCtx([mutableOutbox], [protectedQuote]);
    const claimed = await claimCrmQuoteSyncAttemptMutation(ctx, { outboxId });
    expect(claimed).toMatchObject({ requireBoundAcknowledgement: true });
    expect(claimed?.payload).not.toHaveProperty("discussionTokenHash");
    expect(claimed?.payload).not.toHaveProperty("discussionTokenExpiresAt");

    const harness = createRunHarness({ requireBoundAcknowledgement: false });
    harness.claimAttempt.mockResolvedValueOnce(claimed!);
    await expect(harness.run()).resolves.toBe("succeeded");
    expect(harness.postQuote).toHaveBeenCalledWith(expect.objectContaining({
      requireBoundAcknowledgement: true,
    }));
    expect(harness.markSucceeded).toHaveBeenCalledWith(expect.objectContaining({
      acknowledgementBindingVersion: CRM_QUOTE_ACKNOWLEDGEMENT_BINDING_VERSION,
    }));
  });

  it("records source-identifier provenance only for strict acknowledgements", async () => {
    const harness = createRunHarness({ requireBoundAcknowledgement: true });

    await expect(harness.run()).resolves.toBe("succeeded");
    expect(harness.markSucceeded).toHaveBeenCalledWith({
      outboxId,
      attemptNumber: 1,
      httpStatus: 201,
      acknowledgementBindingVersion:
        CRM_QUOTE_ACKNOWLEDGEMENT_BINDING_VERSION,
    });
  });

  it("uses the required retry delays and dead-letters after they are exhausted", async () => {
    expect(CRM_QUOTE_SYNC_RETRY_DELAYS_MS).toEqual([
      60_000,
      5 * 60_000,
      30 * 60_000,
      2 * 60 * 60_000,
      12 * 60 * 60_000,
    ]);

    for (let attemptNumber = 1; attemptNumber <= 5; attemptNumber += 1) {
      const harness = createRunHarness({
        attemptNumber,
        deliveryResult: {
          kind: "retryable",
          httpStatus: 500,
          error: "CRM unavailable",
        },
      });

      await expect(harness.run()).resolves.toBe("retry_scheduled");
      expect(harness.scheduleRetry).toHaveBeenCalledWith({
        outboxId,
        attemptNumber,
        httpStatus: 500,
        error: "CRM unavailable",
        delayMs: CRM_QUOTE_SYNC_RETRY_DELAYS_MS[attemptNumber - 1],
      });
      expect(harness.markDeadLetter).not.toHaveBeenCalled();
    }

    expect(getCrmQuoteSyncRetryDelayMs(6)).toBeNull();
    const exhausted = createRunHarness({
      attemptNumber: 6,
      deliveryResult: {
        kind: "retryable",
        httpStatus: 503,
        error: "Still unavailable",
      },
    });
    await expect(exhausted.run()).resolves.toBe("dead_letter");
    expect(exhausted.markDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        outboxId,
        attemptNumber: 6,
        httpStatus: 503,
        error: expect.stringContaining("retry budget exhausted"),
      })
    );
  });

  it("dead-letters permanent receiver responses", async () => {
    const rejected = createRunHarness({
      deliveryResult: {
        kind: "permanent",
        httpStatus: 400,
        error: "Bad Request",
      },
    });
    await expect(rejected.run()).resolves.toBe("dead_letter");
    expect(rejected.markDeadLetter).toHaveBeenCalledWith({
      outboxId,
      attemptNumber: 1,
      httpStatus: 400,
      error: "Bad Request",
    });

  });

  it.each([
    ["missing URL", "", "crm-intake-key"],
    ["malformed URL", "not a URL", "crm-intake-key"],
    [
      "unencrypted URL",
      "http://youthful-horse-290.convex.site/api/intake/shed-quote",
      "crm-intake-key",
    ],
    [
      "embedded credentials",
      "https://user:pass@youthful-horse-290.convex.site/api/intake/shed-quote",
      "crm-intake-key",
    ],
    [
      "non-default port",
      "https://youthful-horse-290.convex.site:8443/api/intake/shed-quote",
      "crm-intake-key",
    ],
    [
      "unapproved host",
      "https://other-project.convex.site/api/intake/shed-quote",
      "crm-intake-key",
    ],
    [
      "wrong path",
      "https://youthful-horse-290.convex.site/api/intake/lead",
      "crm-intake-key",
    ],
    [
      "query string",
      "https://youthful-horse-290.convex.site/api/intake/shed-quote?target=other",
      "crm-intake-key",
    ],
    [
      "fragment",
      "https://youthful-horse-290.convex.site/api/intake/shed-quote#other",
      "crm-intake-key",
    ],
    ["missing key", CRM_QUOTE_SYNC_ENDPOINT_URL, ""],
  ])(
    "leaves rows pending without claiming when configuration has %s",
    async (_caseName, endpointUrl, intakeKey) => {
      const misconfigured = createRunHarness({ endpointUrl, intakeKey });
      await expect(misconfigured.run()).resolves.toBe("misconfigured");
      expect(misconfigured.claimAttempt).not.toHaveBeenCalled();
      expect(misconfigured.postQuote).not.toHaveBeenCalled();
      expect(misconfigured.markDeadLetter).not.toHaveBeenCalled();
    }
  );

  it("accepts only the approved complete receiver configuration", () => {
    expect(validateCrmQuoteSyncEndpoint(CRM_QUOTE_SYNC_ENDPOINT_URL)).toEqual({
      ok: true,
      endpointUrl: CRM_QUOTE_SYNC_ENDPOINT_URL,
    });
    expect(
      validateCrmQuoteSyncConfiguration({
        endpointUrl: `  ${CRM_QUOTE_SYNC_ENDPOINT_URL}  `,
        intakeKey: "  crm-intake-key  ",
      })
    ).toEqual({
      ok: true,
      endpointUrl: CRM_QUOTE_SYNC_ENDPOINT_URL,
      intakeKey: "crm-intake-key",
    });
  });

  it.each([
    [400, "permanent"],
    [401, "retryable"],
    [403, "retryable"],
    [404, "retryable"],
    [405, "retryable"],
    [409, "permanent"],
    [413, "permanent"],
    [422, "permanent"],
    [429, "retryable"],
    [500, "retryable"],
    [503, "retryable"],
  ] as const)("classifies HTTP %i as %s", async (status, kind) => {
    const responseText = jest.fn(async () => "receiver detail");
    const fetchImpl = jest.fn(async () => ({
      ok: false,
      status,
      text: responseText,
    })) as unknown as typeof fetch;

    await expect(
      postCrmQuoteRequest({
        endpointUrl: CRM_QUOTE_SYNC_ENDPOINT_URL,
        intakeKey: "crm-intake-key",
        payload: claimedAttempt().payload,
        fetchImpl,
      })
    ).resolves.toEqual({
      kind,
      httpStatus: status,
      error: `CRM intake returned ${status}`,
    });
    expect(responseText).not.toHaveBeenCalled();
  });

  it("retries a rejected intake key on the normal budget and dead-letters it only after six attempts", async () => {
    enableLiveSync();
    const fetchSpy = stubReceiverStatus(403);
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const mutableOutbox: Doc<"crmQuoteSyncOutbox"> = { ...outbox };
    const mutableQuote: Doc<"quoteRequests"> = { ...quote };
    const { ctx, scheduled } = createRecoveryMutationCtx(
      [mutableOutbox],
      [mutableQuote]
    );
    const actionCtx = createSendQuoteActionCtx(ctx);

    for (
      let attemptNumber = 1;
      attemptNumber <= CRM_QUOTE_SYNC_RETRY_DELAYS_MS.length;
      attemptNumber += 1
    ) {
      await sendQuoteToCrmHandler(actionCtx, { outboxId });
      expect(mutableOutbox).toMatchObject({
        status: "retry_scheduled",
        attemptCount: attemptNumber,
        lastHttpStatus: 403,
        lastError: "CRM intake returned 403",
      });
    }
    expect(scheduled.map((job) => job.delayMs)).toEqual([
      ...CRM_QUOTE_SYNC_RETRY_DELAYS_MS,
    ]);
    expect(consoleError).not.toHaveBeenCalledWith(
      "CRM quote sync dead-lettered",
      expect.anything()
    );

    await sendQuoteToCrmHandler(actionCtx, { outboxId });
    const exhaustedError =
      "CRM intake returned 403; retry budget exhausted after 6 attempts";
    expect(fetchSpy).toHaveBeenCalledTimes(6);
    expect(scheduled).toHaveLength(CRM_QUOTE_SYNC_RETRY_DELAYS_MS.length);
    expect(mutableOutbox).toMatchObject({
      status: "dead_letter",
      attemptCount: 6,
      lastHttpStatus: 403,
      lastError: exhaustedError,
    });
    expect(mutableQuote).toMatchObject({
      crmSyncStatus: "dead_letter",
      crmSyncError: exhaustedError,
    });

    const keyRejections = consoleError.mock.calls.filter(([message]) =>
      String(message).includes("rejected by the CRM intake")
    );
    expect(keyRejections).toHaveLength(6);
    expect(keyRejections[0][1]).toEqual({ outboxId, httpStatus: 403 });
    expect(consoleError).toHaveBeenCalledWith("CRM quote sync dead-lettered", {
      outboxId,
      quoteRequestId,
      attemptNumber: 6,
      httpStatus: 403,
      syncMode: null,
      error: exhaustedError,
    });
    expect(consoleError).toHaveBeenCalledTimes(7);
    expectNoContactData(consoleError.mock.calls);
  });

  it("dead-letters a payload rejection on the first attempt with one contact-free log line", async () => {
    enableLiveSync();
    stubReceiverStatus(400);
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const mutableOutbox: Doc<"crmQuoteSyncOutbox"> = { ...outbox };
    const mutableQuote: Doc<"quoteRequests"> = { ...quote };
    const { ctx, scheduled } = createRecoveryMutationCtx(
      [mutableOutbox],
      [mutableQuote]
    );

    await sendQuoteToCrmHandler(createSendQuoteActionCtx(ctx), { outboxId });

    expect(mutableOutbox).toMatchObject({
      status: "dead_letter",
      attemptCount: 1,
      lastHttpStatus: 400,
      lastError: "CRM intake returned 400",
    });
    expect(scheduled).toHaveLength(0);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith("CRM quote sync dead-lettered", {
      outboxId,
      quoteRequestId,
      attemptNumber: 1,
      httpStatus: 400,
      syncMode: null,
      error: "CRM intake returned 400",
    });
    expectNoContactData(consoleError.mock.calls);
  });

  it("logs a dead letter when the source quote is missing", async () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const orphaned: Doc<"crmQuoteSyncOutbox"> = {
      ...outbox,
      status: "retry_scheduled",
      attemptCount: 2,
      lastHttpStatus: 503,
    };
    const { ctx, scheduled } = createRecoveryMutationCtx([orphaned], []);

    await expect(
      claimCrmQuoteSyncAttemptMutation(ctx, { outboxId })
    ).resolves.toBeNull();

    expect(orphaned).toMatchObject({
      status: "dead_letter",
      attemptCount: 2,
      lastError: "Source quote request not found",
    });
    expect(scheduled).toHaveLength(0);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith("CRM quote sync dead-lettered", {
      outboxId,
      quoteRequestId,
      attemptNumber: 2,
      httpStatus: 503,
      syncMode: null,
      error: "Source quote request not found",
    });
  });

  it("sends bearer and idempotency headers and retries network failures", async () => {
    const successFetch = jest.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => successfulAcknowledgement,
      text: async () => "",
    })) as unknown as typeof fetch;

    await expect(
      postCrmQuoteRequest({
        endpointUrl: CRM_QUOTE_SYNC_ENDPOINT_URL,
        intakeKey: "crm-intake-key",
        payload: claimedAttempt().payload,
        fetchImpl: successFetch,
      })
    ).resolves.toEqual({ kind: "succeeded", httpStatus: 201 });
    expect(successFetch).toHaveBeenCalledWith(
      CRM_QUOTE_SYNC_ENDPOINT_URL,
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer crm-intake-key",
          "Content-Type": "application/json",
          "Idempotency-Key": "shed210:quote:quote-public-1",
        },
      })
    );

    const failedFetch = jest.fn(async () => {
      throw new Error("socket reset");
    }) as unknown as typeof fetch;
    await expect(
      postCrmQuoteRequest({
        endpointUrl: CRM_QUOTE_SYNC_ENDPOINT_URL,
        intakeKey: "crm-intake-key",
        payload: claimedAttempt().payload,
        fetchImpl: failedFetch,
      })
    ).resolves.toEqual({
      kind: "retryable",
      httpStatus: null,
      error: "CRM intake request failed: socket reset",
    });
  });

  it("requires exact source identifier echoes in strict acknowledgement mode", async () => {
    const payload = claimedAttempt().payload;
    const fetchWith = (body: unknown) =>
      jest.fn(async () => ({
        ok: true,
        status: 201,
        json: async () => body,
      })) as unknown as typeof fetch;
    const legacyAcknowledgement: Partial<typeof successfulAcknowledgement> = {
      ...successfulAcknowledgement,
    };
    delete legacyAcknowledgement.externalSubmissionId;
    delete legacyAcknowledgement.sourceDocumentId;
    delete legacyAcknowledgement.publicId;

    await expect(
      postCrmQuoteRequest({
        endpointUrl: CRM_QUOTE_SYNC_ENDPOINT_URL,
        intakeKey: "crm-intake-key",
        payload,
        fetchImpl: fetchWith(legacyAcknowledgement),
        requireBoundAcknowledgement: false,
      })
    ).resolves.toEqual({ kind: "succeeded", httpStatus: 201 });

    await expect(
      postCrmQuoteRequest({
        endpointUrl: CRM_QUOTE_SYNC_ENDPOINT_URL,
        intakeKey: "crm-intake-key",
        payload,
        fetchImpl: fetchWith(legacyAcknowledgement),
        requireBoundAcknowledgement: true,
      })
    ).resolves.toEqual({
      kind: "retryable",
      httpStatus: 201,
      error: "CRM intake returned an unbound success acknowledgement",
    });

    await expect(
      postCrmQuoteRequest({
        endpointUrl: CRM_QUOTE_SYNC_ENDPOINT_URL,
        intakeKey: "crm-intake-key",
        payload,
        fetchImpl: fetchWith({
          ...successfulAcknowledgement,
          sourceDocumentId: "quoteRequests-wrong",
        }),
        requireBoundAcknowledgement: true,
      })
    ).resolves.toMatchObject({
      kind: "retryable",
      error: "CRM intake returned an unbound success acknowledgement",
    });

    await expect(
      postCrmQuoteRequest({
        endpointUrl: CRM_QUOTE_SYNC_ENDPOINT_URL,
        intakeKey: "crm-intake-key",
        payload,
        fetchImpl: fetchWith(successfulAcknowledgement),
        requireBoundAcknowledgement: true,
      })
    ).resolves.toEqual({ kind: "succeeded", httpStatus: 201 });
  });

  it("retries malformed 2xx acknowledgements and request timeouts", async () => {
    const malformedFetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, status: "created" }),
    })) as unknown as typeof fetch;
    await expect(
      postCrmQuoteRequest({
        endpointUrl: CRM_QUOTE_SYNC_ENDPOINT_URL,
        intakeKey: "crm-intake-key",
        payload: claimedAttempt().payload,
        fetchImpl: malformedFetch,
      })
    ).resolves.toEqual({
      kind: "retryable",
      httpStatus: 200,
      error: "CRM intake returned a malformed success acknowledgement",
    });

    const timeoutFetch = jest.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new Error("aborted")),
            { once: true }
          );
        })
    ) as unknown as typeof fetch;
    await expect(
      postCrmQuoteRequest({
        endpointUrl: CRM_QUOTE_SYNC_ENDPOINT_URL,
        intakeKey: "crm-intake-key",
        payload: claimedAttempt().payload,
        fetchImpl: timeoutFetch,
        timeoutMs: 1,
      })
    ).resolves.toEqual({
      kind: "retryable",
      httpStatus: null,
      error: "CRM intake timed out after 1ms",
    });
  });

  it("replays a dead letter with a fresh retry budget", async () => {
    const mutableOutbox = {
      ...outbox,
      status: "dead_letter" as const,
      attemptCount: 6,
      replayCount: 2,
      lastAttemptAt: 1_714_000_100_000,
      lastHttpStatus: 503,
      lastError: "retry budget exhausted",
      completedAt: 1_714_000_200_000,
    };
    const mutableQuote = {
      ...quote,
      crmSyncStatus: "dead_letter" as const,
      crmSyncLastAttemptAt: 1_714_000_100_000,
      crmSyncCompletedAt: 1_714_000_200_000,
      crmSyncError: "retry budget exhausted",
    };
    const scheduled: Array<{ delayMs: number; args: unknown }> = [];
    const ctx = {
      db: {
        get: async (id: string) =>
          id === outboxId ? mutableOutbox : id === quoteRequestId ? mutableQuote : null,
        patch: async (id: string, value: Record<string, unknown>) => {
          Object.assign(id === outboxId ? mutableOutbox : mutableQuote, value);
        },
      },
      scheduler: {
        runAfter: async (delayMs: number, _ref: unknown, args: unknown) => {
          scheduled.push({ delayMs, args });
        },
      },
    } as unknown as MutationCtx;
    jest.spyOn(Date, "now").mockReturnValue(1_714_000_300_000);

    await expect(
      replayDeadLetterMutation(ctx, {
        outboxId,
      })
    ).resolves.toEqual({ replayed: true });
    expect(mutableOutbox).toMatchObject({
      status: "pending",
      attemptCount: 0,
      replayCount: 3,
      nextAttemptAt: 1_714_000_300_000,
      updatedAt: 1_714_000_300_000,
    });
    expect(mutableQuote).toMatchObject({ crmSyncStatus: "pending" });
    expect(scheduled).toEqual([{ delayMs: 0, args: { outboxId } }]);
  });
});
