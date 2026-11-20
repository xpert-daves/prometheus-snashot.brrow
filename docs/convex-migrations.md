# Convex Migrations

This repo uses `@convex-dev/migrations` for tracked, resumable Convex data
migrations. Schema history still lives in Git through `convex/schema.ts`, but
data migrations should be defined in `convex/migrations.ts` and recorded here.

## Commands

On the dev deployment, run the component directly:

```bash
pnpm exec convex run --component migrations lib:getStatus
pnpm exec convex run migrations:run '{"fn":"migrations:<migrationName>","dryRun":true}'
pnpm exec convex run migrations:run '{"fn":"migrations:<migrationName>"}'
```

## Changing Production Data

This repo has no gated wrapper like the CRM's `scripts/prod-data.mjs`, so the
safety steps are manual. Follow them in order.

1. **Write the change as code.** Every production write is a
   `migrations.define(...)` in `convex/migrations.ts`. It must be idempotent
   (no patch when the row is already correct), narrow (it matches only the
   rows to change), and covered by a test in `convex/__tests__` for both the
   change and the no-op. Never write to production with an ad-hoc mutation
   through `convex run --prod`, `convex import`, or dashboard edits. Existing
   reviewed operator runbooks (CRM dead-letter replay in `README.md`,
   `crm-quote-historical-backfill.md`) keep their own steps and still need the
   user's approval before a production write.
2. **Ship it.** Open a PR with lint, typecheck, and tests green, then merge.
   Merging deploys the migration code; it does not run it.
3. **Check status.**

   ```bash
   pnpm exec convex run --prod --component migrations lib:getStatus
   ```

4. **Dry-run.** The component runs one batch, reports what it would change,
   then rolls it back.

   ```bash
   pnpm exec convex run --prod migrations:run '{"fn":"migrations:<migrationName>","dryRun":true}'
   ```

5. **Get approval.** Review the dry-run output with the user. Agents never run
   the next step without the user's explicit approval for that migration.
6. **Run it.**

   ```bash
   pnpm exec convex run --prod migrations:run '{"fn":"migrations:<migrationName>"}'
   ```

7. **Verify.** Re-check status until the migration reports done, confirm the
   target documents changed as expected, and add a History entry below.

The `--prod` commands recorded in the history below describe how earlier runs
were done. Use the procedure above for new work.

## History

### 2026-11-04 - Lead-labeled quote alerts and Ready to schedule alerts

- Adds the `quoteRequests` index `by_tenant_id_and_contact_phone_and_created_at`
  for same-lead alert labels, optional `smsAlertStatus` / `emailAlertStatus` /
  `smsAlertError` / `emailAlertError` on `quoteDiscussionRequests`, and an
  optional `scheduleRequestId` on `notificationAttempts` and
  `quoteEmailNotificationAttempts`.
- Migration type: additive/compatible schema and index only. Existing documents
  remain valid; no data migration is required. Convex builds the new index on
  deploy. See `quote-discussions.md` and `quotes-table.md` for alert behavior.

### 2026-09-26 - Saved quote discussion requests (planned rollout)

- Adds optional capability hash/expiry fields to quotes and a separate
  `quoteDiscussionRequests` delivery ledger. Existing documents remain valid;
  no data migration is required. This entry records the code change, not a
  completed production deployment.
- Deploy the compatible CRM receiver before enabling the website feature.
  See `quote-discussions.md` for delivery, retention, rollout, and rollback.

### 2026-09-22 - Compatible optional quote attribution

- Adds optional `quoteRequests.measurement` containing the privacy-permitted browser session and sanitized first/last attribution. Existing rows remain valid and historical unknowns stay unknown; no data migration is required.
- Existing authenticated CRM outbox payloads forward this optional field. Deploy the compatible CRM receiver first. See `quote-measurement.md` for validation and measurement definitions. No production mutation or backfill was performed as part of this change.

### 2026-08-04 - Quote Intake Security and Optional Retention

- Atomic quotas: `quoteRequests.create` now consumes contact, session,
  short-window tenant/global, and daily tenant/global quotas in the same Convex
  mutation that inserts the quote. Limits
  are email 10/hour, phone 10/hour, session 8/15 minutes, tenant 30/5 minutes
  and 100/day, and global 100/5 minutes and 250/day. Bucket identifiers are
  keyed SHA-256 hashes derived from the configured current write key; raw
  contact/session values are not stored. An idempotent retry of an existing
  tenant/public id does not consume a second quota. Rejections use structured
  Convex error code `QUOTE_RATE_LIMITED` with `retryAfterSeconds`.
- Credentials: quote writes accept the current `CONVEX_QUOTE_WRITE_KEY` plus an
  optional `CONVEX_QUOTE_WRITE_KEY_PREVIOUS` only when a current key exists.
  Local Shed pricing reads now prefer `CONVEX_QUOTE_PRICING_READ_KEY` and may
  accept its optional previous value. The pricing query temporarily accepts the
  write-key family while
  `CONVEX_PRICING_ALLOW_WRITE_KEY_FALLBACK` is unset or `true`.
- Pricing tenancy: local Shed pricing reads use only the requested tenant's
  `by_tenant_id_and_key` row. A tenant without an active row receives the
  built-in default config and never falls back to another tenant's sole row.
- Write-key rotation order: first set the old value as
  `CONVEX_QUOTE_WRITE_KEY_PREVIOUS` and the new value as
  `CONVEX_QUOTE_WRITE_KEY` in Convex; then update the Vercel current write key,
  deploy and verify a quote; finally remove the previous key. The current key
  remains the quota hash material throughout the request, including calls made
  with the previous credential.
- Pricing-key split order: deploy this compatible query first; configure the
  same new dedicated pricing read key in Convex and Vercel; verify a Shed
  pricing read and quote through Preview; then set
  `CONVEX_PRICING_ALLOW_WRITE_KEY_FALLBACK=false` in Convex. Pricing-key
  rotations use the same current/previous receiver-first sequence. Never remove
  a previous key before all senders use the new current key.
- CRM acknowledgement binding: the sender can require a success acknowledgement
  to echo `externalSubmissionId`, `sourceDocumentId`, and `publicId`. Leave
  `SHED_CRM_REQUIRE_BOUND_ACKNOWLEDGEMENT=false` while the receiver adds and
  verifies those echoes. Enable it only after receiver-first production QA;
  unbound successes then remain retryable instead of being marked delivered.
  Strict successes write optional
  `acknowledgementBindingVersion: "source_identifiers_v1"`; existing and
  compatibility-mode outboxes remain valid without it and are excluded from
  destructive retention. This is a schema widening and needs no backfill.
- Delivery pricing: saved quote pricing accepts optional
  `deliveryPricingStatus: "pending_verification"`. Legacy rows remain valid.
  SMS/email/CRM payloads carry the pending state and do not describe zero miles
  or included delivery as verified.
- Sanitization: customer-controlled strings used in SMS/email subjects and
  bodies now remove control, bidirectional, and zero-width formatting characters,
  collapse whitespace, and use bounded lengths before alert construction.
- Retention schema: added the
  `quoteRequests.by_crm_sync_status_and_created_at` index and the singleton
  `quoteRetentionState` table. The six-hour job is disabled unless
  `QUOTE_DATA_RETENTION_DAYS` is a whole number from 30-3650. Each transaction
  scans and deletes at most six rows, reads at most 51 child attempts per table
  and candidate to detect overflow, deletes at most 50 per table when batching,
  and immediately schedules the next durable-cursor page until the fixed-cutoff
  sweep completes. The six-row cap keeps the worst-case transaction below
  Convex's 1,000-I/O limit. Missing or nonterminal
  notification state and missing, duplicate, unsuccessful, cross-tenant,
  mislinked, externally mismatched, or acknowledgement-unbound outboxes defer
  deletion without deleting child evidence. Monitor repeated deferrals; CRM
  data retention remains independently owned by Frontier Pixel.
- Migration type: additive/compatible schema, indexes, and optional job only.
  No data migration or production deletion is part of this rollout. Keep quote
  retention disabled until its separate approval and monitoring plan is ready.
- Legacy data: the production audit found 50 historical tables outside current
  ownership, including 33 with documents. Do not delete them in place. Export,
  reconcile, obtain retention approval, and prefer a fresh deployment by
  following [`legacy-convex-data-retirement.md`](legacy-convex-data-retirement.md).

### 2026-07-25 - Audited CRM Pricing and Per-Footprint Roof Prices

- Change: widened pricing with optional exact-footprint barn/lean-to
  completed-price overrides, an explicit 6/7/8 wall-height floor-area
  surcharge map, an optional barn floor-area surcharge, and quote metadata with
  provider, schema-version, and immutable publication-version fields.
- Calibration: the literal seeded rules calculate the confirmed 10x12, 7-ft
  barn target at $3,900 rather than $3,800. The mismatch remains visible for
  owner resolution instead of being hidden by a seeded override.
- Safety: production pricing reads require an explicit verified source. CRM
  reads pin the approved deployment, use a dedicated read credential, refuse
  redirects, time out after five seconds, and runtime-validate the full
  publication before any quote is calculated or saved.
- Migration type: additive/compatible schema deploy only. Existing pricing
  configs and quotes remain valid because every added stored field is optional.
  The pricing read temporarily accepts both the legacy `writeKey` argument and
  the new `readKey` argument so the Convex/Vercel rollout is non-breaking. No
  data backfill is required.
- Rollout order: deploy the compatible Frontier Pixel CRM schema/query/editor
  first, configure its pricing-read key, verify a published pricing version,
  then deploy Shed210 through Preview before changing the production pricing
  source.

### 2026-07-15 - Quote-only CRM Historical Backfill Operator

- Change: added optional historical provenance to CRM quote outbox rows plus
  internal preview, execute, and reconciliation functions for the audited
  Shed210 pre-outbox quote set.
- Safety: production execution requires the live CRM sync configuration, a
  separate backfill gate, an authenticated receiver capability handshake, an
  fixed audited cutoff and run id, an exact remaining count, full candidate validation,
  and batches of at most ten. Historical delivery also repeats the capability
  handshake immediately before every POST and retry.
- Notifications: the operator schedules only the CRM quote delivery action. It
  never schedules the Shed SMS or email quote alert jobs.
- Migration type: additive schema and operator code only. Deploying this change
  does not enqueue or mutate historical data; the explicit runbook remains a
  separate production operation.

### 2026-07-11 - Shed Quote CRM Sync Outbox

- Change: added the `crmQuoteSyncOutbox` table and optional quote sync summary
  fields. New Shed210 quote writes create the source quote and deterministic
  outbox row in one transaction, then deliver to the Frontier Pixel CRM intake
  asynchronously without changing the existing SMS or email alert jobs.
- Recovery: a kill-switch-aware minute cron uses bounded status/time indexes to
  resume pending and due retry rows and to requeue processing leases older than
  five minutes. CRM acknowledgements must include the expected tenant, status,
  and target ids before delivery is marked successful.
- Operator access: dead-letter replay is an internal Convex mutation intended
  for authenticated CLI/dashboard operators; it does not reuse the public quote
  write key.
- Migration type: additive/compatible schema and write-path tracking only. The
  new table starts empty, all quote sync fields are optional, and no existing
  quote documents require a data migration.

### 2026-07-08 - Admin/CRM Extraction and Quote-Only Backend

- Change: removed local admin/auth/CRM write paths from the active Next.js and
  Convex bundles. The surviving Convex schema covers `tenants`,
  `quoteRequests`, `quoteRateLimitBuckets`, `quotePricingSettings`,
  `notificationRecipients`, `notificationAttempts`, and
  `quoteEmailNotificationAttempts`.
- Quote writes now insert only `quoteRequests` and schedule SMS/email alerts.
  They no longer create `leads`, `leadQuotes`, `shedQuoteRequests`, activity
  rows, push events, messages, calls, or intake records.
- This repo no longer serves `/admin/*`; those paths should fall through to the
  normal site 404. Frontier Pixel CRM remains the admin system and should be
  accessed directly. Convex quote email alerts still use
  `FRONTIER_PIXEL_CRM_ADMIN_URL` for CRM handoff links.
- Migration type: narrowing active schema/code ownership without data deletion.
  Historical CRM tables may remain in existing Convex deployments as
  unvalidated data until Frontier Pixel CRM imports or intentionally purges
  them.
- Data migration: none run for this cleanup.

### 2026-07-08 - Shared Quote Rate Limit Buckets

- Change: added the `quoteRateLimitBuckets` table and indexed
  `quoteRequests.checkQuoteRateLimit` mutation so public quote submissions use
  a shared tenant/key/window bucket instead of only per-runtime memory.
- Migration type: additive/compatible schema deploy only. The new table starts
  empty, stores server-generated client-key hashes rather than raw IP
  addresses, and no existing quote or lead documents require a data migration.
- Data migration: none required. Expired limiter buckets are cleaned up in
  bounded batches by the write-key-guarded limiter mutation.

### 2026-07-04 - Quote Lead Email Alert Attempts

- Change: added internal admin email alerts for fresh website quote leads using
  the existing Zoho sender config and comma-separated
  `QUOTE_NOTIFICATION_EMAIL_RECIPIENTS` Convex env var. Delivery attempts are
  stored in the new `quoteEmailNotificationAttempts` table, and `quoteRequests`
  now has optional email notification status/error/timestamp fields.
- Migration type: additive/compatible schema and write-path tracking only.
  Existing quote rows remain valid because the new quote status fields are
  optional, the new attempts table starts empty, and no migrations component run
  is required.

### 2026-06-12 - Shed Quote Pricing Publication Metadata

- Change: widened saved quote pricing config metadata with optional
  `pricingPublicationId`. Public quote pricing reads now return the active
  `shedQuotePricingPublications` id when the Shed quote module read flag serves
  module pricing, and Shed quote module request dual-writes/repairs persist
  that publication link on `shedQuoteRequests`.
- Migration type: additive/compatible schema metadata field and write-path
  linkage only. Existing quote metadata remains valid because the new field is
  optional and no migrations component run is required.

### 2026-06-08 - Security Overview Tenant Guard

- Change: added a tenant-first `adminAuditEvents` index for tenant + createdAt
  security report reads. The Security overview now loads audit events through
  the selected tenant and filters active Better Auth sessions to users with an
  active `tenantMembers` row for that tenant before returning session metadata.
- Migration type: additive/compatible schema index and query guard only.
  Existing audit rows remain valid, legacy unscoped Shed210 audit rows stay
  readable during the widen window, and no migrations component run is required.

### 2026-06-08 - Lead Quote Child-Read Tenant Guard

- Change: added a tenant-first `leadQuotes` index for tenant + lead detail reads.
  Lead list quote summaries and lead detail quote links now load through the
  selected tenant before attaching quote request data, so inconsistent
  cross-tenant child rows cannot leak quote facts into another tenant's CRM view.
- Migration type: additive/compatible schema index and query guard only. Existing
  narrowed `leadQuotes.tenantId` data remains valid and no migrations component
  run is required.

### 2026-06-01 - Preauthorized Account Links and Invite Acceptance Hardening

- Change: direct tenant-member grants now return an account link for the
  granted email. `/admin/sign-in` can open directly in account-creation mode
  for that link, and the Better Auth sign-up gate allows creation only when the
  submitted email has an active pre-authorized `tenantMembers` row or a valid
  pending invite token.
- Invite/access hardening: accepting an invite and resolving signed-in tenant
  access now reuse an existing tenant-member row matched by auth token or
  normalized email without relying on a unique token lookup, so pre-existing
  duplicate rows do not surface as a Convex `.unique()` error during invite
  acceptance or the immediately following admin page load.
- Migration type: additive/compatible auth, mutation, and UI guardrail only.
  No schema change or migrations component run is required.

### 2026-06-01 - Tenant Member Duplicate Guardrail

- Change: platform readiness now detects active duplicate `tenantMembers` rows
  grouped by tenant and normalized email, and exposes a platform-only repair
  action. The repair keeps one active canonical row, merges the strongest
  existing tenant role and permission fields, prefers the current auth token
  when repairing the signed-in platform admin, and deactivates extra active rows.
- Identity clarity: newly ensured platform-admin membership rows default to
  tenant `member` while platform-admin power remains a separate global
  capability. Team & Access now labels the signed-in viewer's tenant role,
  platform-admin state, effective capabilities, and duplicate data rows
  separately.
- Migration type: additive/compatible code and UI guardrail only. No schema
  change or migrations component run is required; production duplicate cleanup
  is an explicit platform-only repair after deployment.

### 2026-06-01 - Tenant Member Role and AI Grant Boundary

- Change: widened `tenantMembers.role` and `tenantInvites.role` from
  `owner | admin` to `owner | admin | member`. Tenant owner remains the full
  tenant-control role, tenant admin keeps CRM access plus explicit tenant
  permissions, and tenant member is regular CRM access with no team, settings,
  or security permissions by default.
- Access boundary: platform admins can manage all tenant roles and grant or
  remove `canUseAiReplies`. Tenant owners can manage non-self tenant members
  and non-AI permissions. Tenant admins with `canManageTeam` can manage member
  and admin rows only, and cannot promote users to owner or edit owner rows.
  Self-deactivation is blocked by either matching auth token identifier or
  email.
- UI proof: Team & Access role selectors include Tenant member. Non-platform
  tenant managers do not see AI grant controls or AI helper copy; platform
  admins see editable AI access controls from Team & Access and
  `/admin/platform`.
- Migration type: additive/compatible role enum widening. Existing `owner` and
  `admin` documents remain valid and no production data migration is required.

### 2026-06-01 - Tenant-Scoped CRM Routing

- Change: added canonical tenant CRM routes under `/admin/t/[tenantSlug]` for
  dashboard, leads, lead detail, manual lead entry, quote, intake, settings,
  security, and team. Current Shed210 code no longer serves these local admin
  routes; use Frontier Pixel CRM directly.
- Runtime compatibility: CRM access now resolves the selected tenant by slug,
  requires an active, unarchived tenant with `crmRoutingEnabled: true`, allows
  platform admins to access any CRM-enabled tenant, and allows non-platform
  users only through active `tenantMembers`. Setup-only tenants remain visible
  in Platform and are selectable in the admin header, but are blocked from CRM
  pages until routing is enabled. Archived tenants remain visible and restorable
  in Platform, but are hidden from tenant switching and blocked from CRM access.
- Data flow: CRM queries, mutations, and actions accept a tenant slug, validate
  access server-side, filter selected-tenant reads, stamp selected-tenant
  writes, and verify document ids belong to the selected tenant before changes.
  During the widen window, unscoped legacy rows are readable only for
  `tenantSlug === "shed210"`.
- Platform controls: `/admin/platform` can seed CRM defaults for any tenant
  before enabling routing. Non-Shed210 tenants receive independent
  tenant-scoped defaults; Shed210 repair may attach legacy singleton rows.
  Enabling CRM routing fails until required settings, quote pricing,
  communication identity placeholders, and the default pipeline exist.
  Non-Shed210 tenants can be archived instead of deleted; archiving sets the
  tenant inactive and records archive metadata so it can be restored.
- Tenant access: tenant team managers can continue using expiring invite links,
  or explicitly pre-authorize a verified email as an active tenant member.
  Pre-authorization relies on Better Auth verified email checks and does not
  create a wildcard domain allowlist.
- Migration type: additive/compatible widen deploy only. No field is narrowed
  and no data migration is required in this slice.
- Rollout order: seed defaults, add the intended tenant member, enable CRM
  routing, verify `/admin/t/shed210` and the second tenant locally or in Vercel
  Preview, then run the standard production pipeline before promotion.

### 2026-05-31 - Multitenant CRM Platform Widen Step

- Change: added the additive multitenant platform foundation for the admin CRM:
  `tenants`, `tenantMembers`, `tenantSettings`, `communicationIdentities`,
  `pipelines`, `pipelineStages`, and `usageLedgerEvents`. Existing CRM tables
  gained optional `tenantId`; SMS consent rows also gained optional
  `senderIdentityId` so consent can become tenant/sender scoped.
- Migration type: additive/compatible widen deploy. Existing documents remain
  valid because the new fields are optional.
- Data migration: large backfills are defined in `convex/migrations.ts` with
  `@convex-dev/migrations`. Run the Shed210 tenant/setup repair mutations first,
  then dry-run and execute the tenant backfill functions against dev/Preview
  before production. SMS consent backfills should run after the Twilio SMS
  communication identity exists.
- Runtime compatibility: CRM reads and writes infer the default Shed210 tenant
  server-side and attach `tenantId`/SMS sender scope where applicable. Admin
  read/action paths filter tenant-scoped rows to Shed210 while still accepting
  unscoped legacy rows during the widened migration window. Settings reads
  prefer tenant-scoped rows and fall back to legacy singleton rows until the
  backfill/narrow step is complete.
- UI proof: `/admin/platform` now includes Platform Readiness with live
  pass/fail rows, repair controls, missing `tenantId` table counts, SMS consent
  scope counts, pipeline stage state, active pricing version, communication
  identities, exact migration component status, and usage-ledger status.
- Follow-up repair hardening: `callForwardingSettings.forwardTo` and
  `zohoWebhookSettings.hookSecret` can be null during the widen step so
  `ensureShed210SettingsDefaults` can create tenant-scoped settings rows
  without inventing an admin forwarding number or webhook secret. Saving call
  forwarding and Zoho webhook setup still writes real values through the admin
  settings UI.
- Follow-up admin-access layer: added optional `crmRoutingEnabled` on
  `tenants`, optional permission booleans on `tenantMembers`, and the new
  `tenantInvites` table with hashed invite tokens. Existing tenant and member
  documents remain valid because the new tenant/member fields are optional and
  the invite table starts empty. No data migration is required for the schema
  deploy; run `ensureShed210AiReplyPermissions` from `/admin/platform`
  Platform Readiness to seed existing Shed210 members so `engineer@johnnyr.dev`
  has `canUseAiReplies=true` and other existing members get an explicit false
  when the field is missing.
- Runtime compatibility: `PLATFORM_ADMIN_EMAILS` now grants platform-only
  access, `LEAD_TRACKER_ADMIN_EMAILS` remains only a temporary Shed210 CRM
  fallback, and active Shed210 `tenantMembers` rows are the durable CRM gate.
  Setup-only tenants can be created and configured in `/admin/platform`, but
  CRM routing remains enabled only for Shed210 in this PR.
- Dev validation: on 2026-05-31, the Shed210 setup repair mutations and all 30
  tenant backfill migrations were dry-run and then executed against the Convex
  dev deployment. Platform Readiness showed every targeted tenant-owned table
  at zero missing `tenantId` rows, SMS consent at zero missing tenant/sender
  scope rows, and every listed migration state as `success`.
- Preview validation: on 2026-05-31, Vercel Preview deployment
  `dpl_47XKKhPXbh15v6gWpopNZGQd7yxx` for commit `a177c32` deployed Convex
  Preview `healthy-kookabura-427`. Platform Readiness repair created the
  missing tenant-scoped call forwarding and Zoho webhook settings rows, all 30
  backfill migrations were dry-run and then executed, and final readiness showed
  zero missing tenant/sender scope rows with every migration state `success`.
- Production execution: on 2026-06-01, production Convex
  `handsome-pigeon-985` was bootstrapped with `PLATFORM_ADMIN_EMAILS` for
  `engineer@johnnyr.dev`, the Shed210 tenant and owner memberships were created,
  the Shed210 setup repairs seeded CRM defaults, and all 30 tenant backfill
  migrations were dry-run and then executed. Platform Readiness showed every
  targeted table at zero missing `tenantId` rows, SMS consent at zero missing
  tenant/sender scope rows, and every listed migration state as `success`.
- Rollout order: verify Platform Readiness against Convex dev or Vercel
  Preview, run dry-run migrations, run the backfills, confirm all missing-count
  rows are zero, then narrow required tenant fields in a later deploy only after
  production verification.

### 2026-05-30 - Live Quote Pricing Settings

- Change: added the `quotePricingSettings` singleton table for the active quote
  pricing config and extended quote pricing records with optional config
  metadata. The public quote API reads the active config through a
  `CONVEX_QUOTE_WRITE_KEY` guarded Convex query; `/admin/settings` edits it and
  `/admin/quote` uses it for calculate-only estimates.
- Migration type: additive/compatible schema deploy only.
- Data migration: none required. Existing quote rows do not need pricing config
  metadata, and each deployment falls back to the built-in default pricing until
  an admin saves an active row there.
- Rollout order: verify the admin pricing editor, `/admin/quote`, and public
  `/api/quote` against Convex dev or Vercel Preview before production promotion.

### 2026-05-27 - CRM SMS/MMS Photo Media

- Change: extended SMS `messages.media` and `communicationIntake.smsMedia`
  entries with optional Convex storage metadata for inbound Twilio photo copies
  and outbound admin-uploaded MMS photos.
- Migration type: additive/compatible schema deploy only.
- Data migration: none required. Existing SMS media rows keep their Twilio URL
  metadata and remain valid because all new storage fields are optional.
- Rollout order: verify inbound JPEG/PNG/GIF copies, unsupported attachment
  fallbacks, intake attachment, outbound multi-photo MMS, and text-only scheduled
  SMS behavior against Convex dev or Vercel Preview before production promotion.

### 2026-05-25 - Scheduled CRM Communications

- Change: added one-time scheduled SMS/email support through the new
  `scheduledCommunications` table, with Central-time schedule metadata, queued
  edit/cancel state, links to sent SMS/email records, and failure audit fields.
- Migration type: additive/compatible schema deploy only.
- Data migration: none required. Existing leads, SMS, email threads, calls,
  activity, and AI reply rows are unchanged.
- Rollout order: verify scheduling, editing, canceling, stale scheduled-job
  skipping, SMS opt-out-at-send behavior, and Zoho new-email/thread-reply sends
  against Convex dev or Vercel Preview before production promotion.

### 2026-05-25 - AI Staged Reply Schema

- Change: added single-user AI staged reply support with prompt/profile
  settings, draft logs, and suggestion review rows:
  `aiReplyPromptSettings`, `aiReplyProfileSettings`, `aiReplyDrafts`, and
  `aiReplySuggestions`.
- Migration type: additive/compatible schema deploy only.
- Data migration: none required. AI settings fall back to built-in defaults
  until `engineer@johnnyr.dev` bootstraps or saves them from `/admin/settings`.
  Existing leads, SMS, Zoho email, calls, and activity rows are unchanged.
- Environment data: set `OPENAI_API_KEY` in the target Convex deployment before
  using AI staged replies. Optionally set `OPENAI_STAGE_REPLY_MODEL`; it
  defaults to `gpt-5.5`.
- Rollout order: verify the access gate, SMS draft staging, Zoho thread/new
  email staging, and settings suggestion review against Convex dev or Vercel
  Preview before production promotion.

### 2026-05-24 - Lead Conversation Done State

- Change: extended `leads` with optional `conversationClosedAt` metadata and
  added the `leads.by_archived_and_conversation_closed_at` index so the admin
  CRM can list handled conversations separately from active conversations.
- Migration type: additive/compatible schema deploy only.
- Data migration: none required. Existing leads without
  `conversationClosedAt` remain valid and continue to appear in active or
  status-based CRM views according to their existing contact activity.
- Rollout order: verify Today pipeline lanes, Done conversation actions, and
  the handled conversation filter against Convex dev or Vercel Preview before
  production promotion.

### 2026-05-19 - Zoho Email CRM Completion

- Change: completed the Zoho email CRM rollout with lead email aliases for
  history matching, shared email composer signature settings, and admin Web
  Push events for matched and unmatched inbound email.
- Migration type: additive/compatible schema deploy only. New or widened fields
  are optional for existing documents, including `leads.emailAliases`,
  `pushNotificationEvents.emailMessageId`, and
  `pushNotificationEvents.intakeId`.
- Data migration: none required. Existing leads, email history, intake rows,
  and push notification events remain valid; signature settings fall back to
  built-in defaults until saved from `/admin/settings`.
- Rollout order: verify local/dev email send and inbound webhook behavior,
  deploy through Vercel Preview with Convex Preview env configured, confirm
  `/admin/settings`, lead email threads, `/admin/intake`, and email push
  notifications before production promotion.

### 2026-05-18 - Zoho Email Threaded Replies

- Change: added thread-aware Zoho CRM replies, inbound fallback matching by
  normalized subject plus participant email, and additional `emailMessages`
  participant indexes for reply matching.
- Migration type: additive/compatible schema deploy only.
- Data migration: none required. Existing split test threads remain unchanged;
  new inbound replies can patch local thread metadata when Zoho provides a
  thread id.
- Rollout order: verify a new CRM email, customer reply, CRM in-thread reply,
  and follow-up customer reply against Convex dev or Preview before production.

### 2026-05-18 - Zoho Email Reply Body Cleanup

- Change: cleaned inbound Zoho email summary text before storage so HTML
  entities and quoted reply separators do not appear in CRM email history.
- Migration type: compatible data cleanup for existing `emailMessages` rows
  only; schema is unchanged.
- Data migration: `cleanZohoEmailReplyBodies` rewrites affected inbound Zoho
  email `bodyText` values using the same cleanup logic used for new webhooks.
- Rollout order: deploy Convex code first, dry-run the migration against dev or
  Preview, then run it before production if early production Zoho test replies
  were captured with quoted history.

### 2026-05-09 - Quote Visual Placement Metadata

- Change: extended `quoteRequests.inputs` with optional
  `visualPlacement` metadata for server-generated default or server-sanitized
  custom door/window placements used by the 3D quote preview.
- Migration type: additive/compatible schema deploy only.
- Data migration: none required. Existing quote rows without placement metadata
  remain valid and admin quote details render them as not saved.
- Rollout order: verify quote submission and admin quote detail rendering
  against Convex dev or Vercel Preview before production.

### 2026-05-08 - SMS Opt-In Consent Schema

- Change: extended leads and quote requests with SMS consent proof
  fields, added `smsConsentEvents` for audit history, and added
  `smsPhoneConsentStates` for phone-level opt-out protection. A follow-up
  patch also added separate optional marketing SMS consent proof fields so
  promotional consent is not mixed with quote-contact consent.
- Migration type: additive/compatible schema deploy only.
- Data migration: none required. Existing lead and quote rows remain valid;
  leads without explicit `smsConsentStatus: "opted_in"` are treated as not
  opted in by outbound SMS guardrails.
- Rollout order: verify quote submission is blocked without checked quote
  contact consent, verify successful submission with consent, then verify
  STOP/HELP/START inbound webhooks, admin manual opt-out, CRM reply blocking,
  and intro template blocking against Convex dev or Vercel Preview before
  production.

### 2026-05-07 - Voice Call Diagnostics Schema

- Change: extended `calls` with optional admin-leg caller ID and latest SIP
  response code fields for click-to-call diagnostics.
- Migration type: additive/compatible schema deploy only.
- Data migration: none required. Existing call rows remain valid and will show
  diagnostics only after future Twilio callbacks provide them.
- Rollout order: deploy code and schema before setting
  `TWILIO_CALL_ADMIN_CALLER_ID` in Convex production.

### 2026-05-06 - CRM SMS Template Schema

- Change: added `smsTemplates` for admin-editable template overrides and
  `smsTemplateSends` for per-lead Intro template send locks.
- Migration type: additive/compatible schema deploy only.
- Data migration: none required. The Intro template falls back to built-in copy
  until an admin saves an override from `/admin/settings`.
- Rollout order: verify staged Intro sends and duplicate lockout against Convex
  dev or Vercel Preview before production.

### 2026-05-04 - Admin Web Push Notifications Schema

- Change: added `pushSubscriptions`, `pushNotificationEvents`, and
  `pushNotificationDeliveries` tables for admin Web Push device registration,
  event dedupe, and delivery auditing.
- Migration type: additive/compatible schema deploy only.
- Data migration: none required. Admins opt in per device from
  `/admin/settings`; existing lead, message, call, and quote rows are unchanged.
- Environment data: set `WEB_PUSH_VAPID_PUBLIC_KEY`,
  `WEB_PUSH_VAPID_PRIVATE_KEY`, and `WEB_PUSH_VAPID_SUBJECT` separately in each
  Convex deployment before enabling notifications there.
- Rollout order: verify against Convex dev or Vercel Preview first, including
  Android Chrome and iOS Home Screen behavior, before production VAPID setup.

### 2026-05-04 - Missed Call Auto Text Schema

- Change: extended `callForwardingSettings` with optional missed-call auto-text
  controls and extended `calls` with optional auto-text status, message link,
  timestamps, and error fields.
- Migration type: additive/compatible schema deploy only.
- Data migration: none required. Existing settings and call rows remain valid;
  the feature is disabled unless an admin enables it from `/admin/settings`.
- Rollout order: verify against Convex dev or Preview with a non-production
  Twilio number before enabling the setting in production.

### 2026-05-04 - Call History Schema

- Change: added CRM Voice call logging through new `calls` and
  `callForwardingSettings` tables, indexes, webhook functions, and the `call`
  lead activity type.
- Migration type: additive schema deploy only.
- Data migration: none required. Existing lead, activity, quote, conversation,
  and message documents remain valid.
- Environment data: create the first `callForwardingSettings` row separately in
  each Convex deployment by saving `/admin/settings`; do not copy Preview data
  into dev or prod.
- Rollout order: deploy/verify Convex dev first, then production, then switch
  Twilio Voice to the production `.convex.site` inbound-call webhook.

### 2026-05-04 - Outbound Click-to-Call Schema

- Change: extended `calls` with optional direction, Twilio caller ID, creator,
  and error fields, and made `parentCallSid` nullable so pending outbound calls
  can be stored before Twilio returns a parent SID.
- Migration type: additive/compatible schema deploy only.
- Data migration: none required. Existing inbound call rows remain valid and
  are treated as inbound when `direction` is missing.
- Rollout order: verify against Convex dev or Preview with a non-production
  Twilio number before promoting to production.
