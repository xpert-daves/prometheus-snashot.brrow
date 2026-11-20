# Legacy Convex Data Retirement

This runbook covers the historical CRM data still present in the Shed210
production Convex deployment after CRM ownership moved to Frontier Pixel. It
does not authorize deletion. Production export, reconciliation, cutover, or
deployment retirement requires explicit owner approval and a recorded change
window.

## Audited Production Inventory

The read-only inventory on 2026-08-04 found 50 tables outside this repo's
current schema ownership. Thirty-three contained at least one document:

- `activityEvents`, `adminAuditEvents`, `aiReplyDrafts`,
  `aiReplyProfileSettings`, `aiReplyPromptSettings`,
  `callForwardingSettings`, `calls`, `communicationIdentities`,
  `communicationIntake`, `contacts`, `conversations`,
  `emailComposerSettings`, `emailMessages`, `emailThreads`, `leadActivity`,
  `leadQuotes`, `leads`, `messages`, `pipelineStages`, `pipelines`,
  `pushNotificationDeliveries`, `pushNotificationEvents`,
  `pushSubscriptions`, `scheduledCommunications`, `smsConsentEvents`,
  `smsPhoneConsentStates`, `smsTemplateSends`, `smsTemplates`,
  `tenantInvites`, `tenantMembers`, `tenantSettings`,
  `zohoEmailDiagnostics`, and `zohoWebhookSettings`.

Seventeen returned no documents during that inventory:

- `aiReplySuggestions`, `projectEstimateRequests`,
  `projectEstimatorDraftConfigs`, `projectEstimatorPublications`,
  `shedQuoteFormDrafts`, `shedQuoteFormPublications`,
  `shedQuotePricingDrafts`, `shedQuotePricingPublications`,
  `shedQuoteRequests`, `tenantAssets`, `tenantChannels`, `tenantCmsDrafts`,
  `tenantIngestRequests`, `tenantMemberships`, `tenantModules`,
  `tenantSitePublications`, and `usageLedgerEvents`.

An empty result is not a deletion decision. Re-run the inventory immediately
before any retirement because production data can change. Treat every export
as sensitive: these tables can contain customer contact, communications,
consent, authentication, and audit data.

## Safe Retirement Sequence

1. Confirm that current Shed210 code no longer reads or writes every legacy
   table. Freeze old CRM writers and inbound webhooks before taking the final
   snapshot.
2. Record per-table document counts, latest creation/update timestamps, and the
   deployment identifier. Store this manifest with the change ticket; do not
   paste customer rows or secret values into tickets or logs.
3. Export the complete production deployment to an access-controlled encrypted
   location. Use a new destination path so the CLI cannot overwrite a prior
   evidence file:

   ```bash
   umask 077
   pnpm exec convex export --prod --include-file-storage --path /secure/offline/shed210-prod-YYYYMMDD.zip
   sha256sum /secure/offline/shed210-prod-YYYYMMDD.zip
   ```

4. Verify that the archive opens, contains the expected table manifests, and
   matches the recorded checksum. Keep the checksum separately from the
   archive. Apply the company's encryption, access, and retention controls to
   the archive before proceeding.
5. Reconcile the exported CRM records against Frontier Pixel CRM using stable
   source identifiers and counts. At minimum verify lead/contact ownership,
   quote links, communication history, consent state, scheduled work, and audit
   evidence. Resolve duplicates and unmatched rows explicitly; aggregate totals
   alone are not proof of a complete import.
6. Obtain business-owner, privacy/legal, and operations sign-off for the
   retention disposition of each table. Consent and audit records may require a
   different retention period from ordinary CRM content.
7. Before cutover, let pending quote alerts and CRM outbox work reach a reviewed
   terminal state. Decide explicitly whether current-schema `quoteRequests`,
   alert attempts, and outbox rows will be migrated with intact references,
   retained in the access-restricted old deployment for an approved period, or
   dispositioned under the approved quote-retention policy. Never silently drop
   those source records during a deployment move.
8. Prefer a fresh Convex deployment containing only the current schema over
   in-place legacy table deletion. Configure only the required environment
   names, seed the current tenant/pricing/recipient data, apply the approved
   current-quote record decision, and validate through the repo's
   `shed210-prod-pipeline` Preview checklist before cutover.
9. During cutover, verify quote pricing, one controlled quote submission,
   atomic rate limits, SMS/email alert records, CRM handoff, and the expected
   `/admin/*` 404. Observe both the website and Frontier Pixel CRM before
   revoking old integration credentials.
10. Retire the old deployment only after the observation window, reconciliation
   sign-off, restore rehearsal, and a separate explicit approval. Record what
   was retired, when, by whom, and where the recoverable export is held.

Do not express legacy cleanup as an `@convex-dev/migrations` migration in the
current narrowed schema. Those historical tables are intentionally outside the
typed application model, and a migration that guesses their ownership or shape
would create an unsafe deletion path.

## Current Quote Retention

`QUOTE_DATA_RETENTION_DAYS` controls a separate, current-schema retention job.
It is unset and disabled by default; this rollout must not enable it in
production. Accepted values are whole days from 30 through 3650.

When enabled, the six-hour cron starts or resumes a durable-cursor sweep with a
fixed cutoff. Each transaction scans and deletes at most six old
CRM-succeeded quotes, then schedules an immediate continuation while more pages
remain. This drains a normal eligible backlog without waiting six hours between
pages while keeping the worst-case transaction below Convex's I/O limit.

A quote is eligible only when both SMS and email notification states are
explicitly terminal and it has exactly one same-tenant, succeeded CRM outbox
row linked by the quote id and expected external submission id, with
`acknowledgementBindingVersion: "source_identifiers_v1"`. Every one of those
preconditions is checked before child deletion. Alert attempts are then
deleted in bounded batches of at most 50 per table and candidate; larger child
sets defer the parent to a later sweep. Missing state, queued or pending work,
unsuccessful CRM delivery, duplicate/missing/unbound outboxes, and any tenant
mismatch defer deletion without removing child evidence.

Monitor `deferredQuotes`, `deletedQuotes`, and sweep completion in Convex logs
before and after enabling a policy. Repeated deferrals require investigation,
not relaxed guards. This job removes only the Shed210 source quote and its owned
alert/outbox rows. Frontier Pixel CRM must enforce and document its own data
retention policy independently.
