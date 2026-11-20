import { v } from "convex/values";
import { quoteMeasurementValidator } from "./quoteMeasurement";

export const tenantVerticalValidator = v.union(
  v.literal("shed_builder"),
  v.literal("digital_services"),
  v.literal("appointment_based_services"),
  v.literal("generic_services"),
  v.literal("other")
);

export const requiredTenantFields = {
  tenantId: v.id("tenants"),
};

export const tenantFields = {
  name: v.string(),
  slug: v.string(),
  active: v.boolean(),
  vertical: tenantVerticalValidator,
  timeZone: v.literal("America/Chicago"),
  crmRoutingEnabled: v.optional(v.boolean()),
  archivedAt: v.optional(v.union(v.number(), v.null())),
  archivedBy: v.optional(v.union(v.string(), v.null())),
  archivedByEmail: v.optional(v.union(v.string(), v.null())),
  createdAt: v.number(),
  updatedAt: v.number(),
};

export const quoteContactValidator = v.object({
  name: v.string(),
  email: v.string(),
  phone: v.union(v.string(), v.null()),
});

export const quoteRateLimitBucketFields = {
  tenantSlug: v.string(),
  keyHash: v.string(),
  windowStartMs: v.number(),
  resetAt: v.number(),
  count: v.number(),
  updatedAt: v.number(),
};

export const quoteRetentionStateFields = {
  key: v.literal("quoteRequests"),
  cursor: v.union(v.string(), v.null()),
  cutoff: v.number(),
  retentionDays: v.number(),
  updatedAt: v.number(),
};

export const CRM_QUOTE_ACKNOWLEDGEMENT_BINDING_VERSION =
  "source_identifiers_v1" as const;

const quoteVisualSideValidator = v.union(
  v.literal("front"),
  v.literal("back"),
  v.literal("left"),
  v.literal("right")
);

const quoteVisualPlacementKindValidator = v.union(
  v.literal("default"),
  v.literal("custom")
);

export const quoteVisualPlacementValidator = v.object({
  version: v.literal(1),
  defaultsVersion: v.string(),
  customized: v.boolean(),
  doors: v.array(
    v.object({
      id: v.string(),
      side: quoteVisualSideValidator,
      width: v.number(),
      height: v.number(),
      offset: v.number(),
      color: v.optional(v.string()),
      placement: quoteVisualPlacementKindValidator,
    })
  ),
  windows: v.array(
    v.object({
      id: v.string(),
      side: quoteVisualSideValidator,
      width: v.number(),
      height: v.number(),
      offset: v.number(),
      heightFromFloor: v.number(),
      placement: quoteVisualPlacementKindValidator,
    })
  ),
});

export const quoteInputsValidator = v.object({
  structureType: v.union(
    v.literal("storage_shed"),
    v.literal("portable_garage"),
    v.literal("greenhouse"),
    v.literal("well_pump"),
    v.literal("open_loafing"),
    v.literal("carport")
  ),
  length: v.number(),
  width: v.number(),
  roofStyle: v.optional(
    v.union(v.literal("gabled"), v.literal("barn"), v.literal("lean-to"))
  ),
  wallHeight: v.optional(v.union(v.literal(6), v.literal(7), v.literal(8))),
  roofMaterial: v.optional(v.union(v.literal("29ga metal"), v.literal("26ga metal"))),
  frameGauge: v.optional(v.union(v.literal("14-ga"), v.literal("12-ga"))),
  windowPackage: v.optional(v.string()),
  windowCount: v.optional(v.number()),
  ventilation: v.optional(v.boolean()),
  color: v.optional(v.string()),
  roofColor: v.optional(v.string()),
  trimColor: v.optional(v.string()),
  addOns: v.array(v.string()),
  foundation: v.optional(
    v.union(v.literal("none"), v.literal("blocks_level"), v.literal("anchored_slab"))
  ),
  deliveryAddress: v.optional(v.string()),
  deliveryZip: v.optional(v.string()),
  door: v.optional(
    v.union(
      v.literal("single_shed"),
      v.literal("double_shed"),
      v.literal("garage_roll_up"),
      v.literal("house")
    )
  ),
  siding: v.optional(v.literal("metal")),
  deliveryRadius: v.number(),
  discountCode: v.optional(v.string()),
  visualPlacement: v.optional(quoteVisualPlacementValidator),
});

export const quoteBreakdownValidator = v.object({
  base: v.number(),
  wallHeight: v.number(),
  roof: v.number(),
  siding: v.number(),
  door: v.number(),
  windows: v.number(),
  addOns: v.number(),
  delivery: v.number(),
  discount: v.number(),
  interiorUpgrades: v.array(v.string()),
});

export const quotePricingConfigValidator = v.object({
  version: v.literal(1),
  standardWallHeight: v.union(v.literal(6), v.literal(7)),
  footprintBasePrices: v.array(
    v.object({
      length: v.number(),
      width: v.number(),
      price: v.number(),
      roofStylePriceOverrides: v.optional(
        v.object({
          barn: v.optional(v.number()),
          leanTo: v.optional(v.number()),
        })
      ),
    })
  ),
  customFootprintPricePerSqft: v.number(),
  customFootprintPriceRounding: v.number(),
  wallHeightPriceAdjustmentPerSqft: v.number(),
  wallHeightPriceAdjustmentsPerSqft: v.optional(
    v.object({
      six: v.number(),
      seven: v.number(),
      eight: v.number(),
    })
  ),
  roof: v.object({
    barnMultiplier: v.number(),
    barnPricePerSqft: v.optional(v.number()),
    leanToFlatCost: v.number(),
  }),
  doors: v.record(v.string(), v.number()),
  windows: v.record(v.string(), v.number()),
  exteriorUpgrades: v.record(
    v.string(),
    v.object({
      price: v.number(),
      mode: v.union(
        v.literal("flat"),
        v.literal("per_sqft"),
        v.literal("per_linear_foot")
      ),
    })
  ),
  delivery: v.object({
    includedServiceRadius: v.number(),
    ratePerMile: v.number(),
  }),
  discountCodes: v.record(v.string(), v.number()),
});

export const quotePricingConfigMetadataValidator = v.object({
  provider: v.optional(
    v.union(v.literal("shed_convex"), v.literal("frontier_pixel_crm"))
  ),
  source: v.union(v.literal("default"), v.literal("table")),
  settingsId: v.union(v.id("quotePricingSettings"), v.null()),
  pricingPublicationId: v.optional(v.union(v.string(), v.null())),
  key: v.string(),
  configVersion: v.number(),
  pricingSchemaVersion: v.optional(v.number()),
  pricingPublicationVersion: v.optional(v.union(v.number(), v.null())),
  updatedAt: v.union(v.number(), v.null()),
});

export const quotePricingValidator = v.object({
  total: v.number(),
  breakdown: quoteBreakdownValidator,
  config: v.optional(quotePricingConfigMetadataValidator),
  deliveryPricingStatus: v.optional(v.literal("pending_verification")),
});

export const quoteSmsConsentValidator = v.object({
  status: v.union(v.literal("opted_in"), v.literal("not_opted_in")),
  source: v.literal("website_quote_form"),
  consentText: v.union(v.string(), v.null()),
  consentTextVersion: v.union(v.string(), v.null()),
  pageUrl: v.union(v.string(), v.null()),
  ipAddress: v.union(v.string(), v.null()),
  userAgent: v.union(v.string(), v.null()),
  recordedAt: v.number(),
});

export const notificationStatusValidator = v.union(
  v.literal("queued"),
  v.literal("sent"),
  v.literal("partial_failed"),
  v.literal("failed"),
  v.literal("no_recipients")
);

export const notificationAttemptStatusValidator = v.union(
  v.literal("pending"),
  v.literal("sent"),
  v.literal("failed")
);

export const crmQuoteSyncStatusValidator = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("retry_scheduled"),
  v.literal("succeeded"),
  v.literal("dead_letter")
);

export const quoteRequestFields = {
  ...requiredTenantFields,
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
  notificationStatus: notificationStatusValidator,
  notificationError: v.optional(v.string()),
  notificationQueuedAt: v.optional(v.number()),
  notificationCompletedAt: v.optional(v.number()),
  emailNotificationStatus: v.optional(notificationStatusValidator),
  emailNotificationError: v.optional(v.string()),
  emailNotificationQueuedAt: v.optional(v.number()),
  emailNotificationCompletedAt: v.optional(v.number()),
  crmSyncStatus: v.optional(crmQuoteSyncStatusValidator),
  crmSyncOutboxId: v.optional(v.id("crmQuoteSyncOutbox")),
  crmSyncLastAttemptAt: v.optional(v.number()),
  crmSyncCompletedAt: v.optional(v.number()),
  crmSyncError: v.optional(v.string()),
  createdAt: v.number(),
};

export const quoteRequestDocValidator = v.object({
  _id: v.id("quoteRequests"),
  _creationTime: v.number(),
  ...quoteRequestFields,
});

export const quotePricingSettingsFields = {
  ...requiredTenantFields,
  key: v.string(),
  config: quotePricingConfigValidator,
  createdBy: v.string(),
  updatedBy: v.string(),
  updatedByEmail: v.union(v.string(), v.null()),
  updatedByName: v.union(v.string(), v.null()),
  createdAt: v.number(),
  updatedAt: v.number(),
};

export const notificationRecipientFields = {
  ...requiredTenantFields,
  label: v.string(),
  phone: v.string(),
  active: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
};

export const notificationRecipientDocValidator = v.object({
  _id: v.id("notificationRecipients"),
  _creationTime: v.number(),
  ...notificationRecipientFields,
});

export const notificationAttemptFields = {
  ...requiredTenantFields,
  quoteRequestId: v.id("quoteRequests"),
  /** Set when the text announced a "ready to schedule" tap instead of the quote itself. */
  scheduleRequestId: v.optional(v.id("quoteDiscussionRequests")),
  recipientId: v.id("notificationRecipients"),
  recipientLabel: v.string(),
  recipientPhone: v.string(),
  status: notificationAttemptStatusValidator,
  messagePartCount: v.number(),
  twilioMessageSids: v.array(v.string()),
  error: v.optional(v.string()),
  createdAt: v.number(),
  completedAt: v.optional(v.number()),
};

export const quoteEmailNotificationAttemptFields = {
  ...requiredTenantFields,
  quoteRequestId: v.id("quoteRequests"),
  /** Set when the email announced a "ready to schedule" tap instead of the quote itself. */
  scheduleRequestId: v.optional(v.id("quoteDiscussionRequests")),
  recipientEmail: v.string(),
  status: notificationAttemptStatusValidator,
  providerMessageId: v.union(v.string(), v.null()),
  providerThreadId: v.union(v.string(), v.null()),
  providerStatus: v.union(v.string(), v.null()),
  error: v.optional(v.string()),
  createdAt: v.number(),
  completedAt: v.optional(v.number()),
};

export const crmQuoteSyncOutboxFields = {
  ...requiredTenantFields,
  tenantSlug: v.string(),
  quoteRequestId: v.id("quoteRequests"),
  externalSubmissionId: v.string(),
  sourceDeployment: v.string(),
  syncMode: v.optional(v.literal("historical_backfill")),
  backfillRunId: v.optional(v.string()),
  status: crmQuoteSyncStatusValidator,
  attemptCount: v.number(),
  replayCount: v.number(),
  nextAttemptAt: v.optional(v.number()),
  lastAttemptAt: v.optional(v.number()),
  lastHttpStatus: v.optional(v.number()),
  lastError: v.optional(v.string()),
  acknowledgementBindingVersion: v.optional(
    v.literal(CRM_QUOTE_ACKNOWLEDGEMENT_BINDING_VERSION)
  ),
  completedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
};

export const crmQuoteSyncOutboxDocValidator = v.object({
  _id: v.id("crmQuoteSyncOutbox"),
  _creationTime: v.number(),
  ...crmQuoteSyncOutboxFields,
});

export const quoteDiscussionFields = {
  ...requiredTenantFields,
  quoteRequestId: v.id("quoteRequests"),
  externalRequestId: v.string(),
  requestedAt: v.number(),
  status: crmQuoteSyncStatusValidator,
  attemptCount: v.number(),
  nextAttemptAt: v.optional(v.number()),
  lastAttemptAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  lastError: v.optional(v.string()),
  /** Staff "ready to schedule" alerts, sent apart from CRM delivery. */
  smsAlertStatus: v.optional(notificationStatusValidator),
  smsAlertError: v.optional(v.string()),
  emailAlertStatus: v.optional(notificationStatusValidator),
  emailAlertError: v.optional(v.string()),
};
