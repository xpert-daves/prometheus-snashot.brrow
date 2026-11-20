import { defineSchema, defineTable } from "convex/server";
import {
  crmQuoteSyncOutboxFields,
  notificationAttemptFields,
  notificationRecipientFields,
  quoteEmailNotificationAttemptFields,
  quotePricingSettingsFields,
  quoteRateLimitBucketFields,
  quoteRetentionStateFields,
  quoteRequestFields,
  quoteDiscussionFields,
  tenantFields,
} from "./validators";

export default defineSchema({
  quoteDiscussionRequests: defineTable(quoteDiscussionFields)
    .index("by_quote_request_id", ["quoteRequestId"])
    .index("by_status_and_next_attempt_at", ["status", "nextAttemptAt"])
    .index("by_status_and_last_attempt_at", ["status", "lastAttemptAt"]),
  tenants: defineTable(tenantFields)
    .index("by_slug", ["slug"])
    .index("by_active_and_slug", ["active", "slug"]),
  quoteRequests: defineTable(quoteRequestFields)
    .index("by_tenant_id", ["tenantId"])
    .index("by_tenant_id_and_created_at", ["tenantId", "createdAt"])
    .index("by_tenant_id_and_public_id", ["tenantId", "publicId"])
    .index("by_tenant_id_and_contact_phone_and_created_at", [
      "tenantId",
      "contact.phone",
      "createdAt",
    ])
    .index("by_public_id", ["publicId"])
    .index("by_created_at", ["createdAt"])
    .index("by_crm_sync_status_and_created_at", [
      "crmSyncStatus",
      "createdAt",
    ])
    .index("by_notification_status", ["notificationStatus"]),
  quoteRateLimitBuckets: defineTable(quoteRateLimitBucketFields)
    .index("by_tenant_slug_and_key_hash_and_window_start_ms", [
      "tenantSlug",
      "keyHash",
      "windowStartMs",
    ])
    .index("by_reset_at", ["resetAt"]),
  quoteRetentionState: defineTable(quoteRetentionStateFields).index("by_key", [
    "key",
  ]),
  quotePricingSettings: defineTable(quotePricingSettingsFields)
    .index("by_tenant_id", ["tenantId"])
    .index("by_key", ["key"])
    .index("by_tenant_id_and_key", ["tenantId", "key"]),
  notificationRecipients: defineTable(notificationRecipientFields)
    .index("by_tenant_id", ["tenantId"])
    .index("by_tenant_id_and_active", ["tenantId", "active"])
    .index("by_active", ["active"]),
  notificationAttempts: defineTable(notificationAttemptFields)
    .index("by_tenant_id", ["tenantId"])
    .index("by_tenant_id_and_quote_request_id", ["tenantId", "quoteRequestId"])
    .index("by_quote_request", ["quoteRequestId"]),
  quoteEmailNotificationAttempts: defineTable(
    quoteEmailNotificationAttemptFields
  )
    .index("by_tenant_id", ["tenantId"])
    .index("by_tenant_id_and_quote_request_id", ["tenantId", "quoteRequestId"])
    .index("by_quote_request", ["quoteRequestId"])
    .index("by_recipient_email", ["recipientEmail"]),
  crmQuoteSyncOutbox: defineTable(crmQuoteSyncOutboxFields)
    .index("by_tenant_id", ["tenantId"])
    .index("by_tenant_id_and_status", ["tenantId", "status"])
    .index("by_tenant_id_and_external_submission_id", [
      "tenantId",
      "externalSubmissionId",
    ])
    .index("by_tenant_id_and_backfill_run_id", ["tenantId", "backfillRunId"])
    .index("by_quote_request_id", ["quoteRequestId"])
    .index("by_status", ["status"])
    .index("by_status_and_next_attempt_at", ["status", "nextAttemptAt"])
    .index("by_status_and_last_attempt_at", ["status", "lastAttemptAt"]),
});
