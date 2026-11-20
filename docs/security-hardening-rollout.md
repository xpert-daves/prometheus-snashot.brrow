# Security Hardening Rollout

This runbook covers the operational steps that accompany the August 2026
security-hardening change. The code deploy is backward-compatible by default:
credential fallbacks remain available for a controlled rotation window, CRM
acknowledgement binding is off until the receiver supports it, and quote-data
retention is disabled until an owner selects a policy.

Never print secret values in CI logs, terminals captured for support, PRs, or
deployment notes.

## What the PR Enforces

- Public quote totals are build subtotals. Browser-provided delivery mileage is
  ignored; delivery and site costs remain pending staff verification.
- Quote creation consumes atomic session, contact, short-window tenant/global,
  and daily tenant/global Convex quotas before notifications or CRM work are
  scheduled. The client session identifier is duplicate protection, not a
  trusted identity.
- Public request bodies are byte-bounded, dangerous formatting controls are
  rejected, IPv6 rate-limit identities are grouped by `/64`, and in-memory
  limiters have bounded storage and cleanup work.
- Google review requests are coalesced only while in flight, back off after
  upstream failures, and remain `private, no-store` to comply with Places
  content-storage rules.
- CSP sources are narrowed to configured deployment origins, framing is denied,
  and server-secret modules have explicit server-only boundaries.
- CI runs lint, tests, typecheck, build, dependency audits, image checks, and a
  full-history Gitleaks scan. Dependabot monitors npm and GitHub Actions.

## Preview Before Production

1. Confirm the branch is using a Convex Preview Deploy Key, not a dev or
   production deploy key.
2. Confirm Preview has `NEXT_PUBLIC_CONVEX_URL` and a preview-only
   `CONVEX_QUOTE_WRITE_KEY` in Vercel, with the matching write key in the Convex
   Preview deployment.
3. Configure a preview-only `CONVEX_QUOTE_PRICING_READ_KEY` in both Vercel and
   the Convex Preview deployment when `QUOTE_PRICING_SOURCE=shed_convex`.
4. Leave `QUOTE_DATA_RETENTION_DAYS` unset in Preview unless deletion behavior
   is being tested with disposable data.
5. Leave `SHED_CRM_REQUIRE_BOUND_ACKNOWLEDGEMENT=false` or unset until the
   Frontier Pixel CRM receiver has shipped the echo contract described below.
6. Verify the quote flow returns **Estimated build subtotal**, shows delivery as
   pending, persists the same status, and produces matching SMS/email copy with
   preview-safe providers or mocks.
7. Verify `/api/google-reviews` and `/api/google-reviews/summary` retain
   `private, no-store`, return `Retry-After` on throttling/failure, and do not
   expose the Google key.
8. Confirm `/admin` still returns the normal site 404.

## Separate the Pricing Read Credential

The Shed Convex pricing query accepts a dedicated read key. During rollout it
can temporarily fall back to the quote write key.

1. Generate a new high-entropy value in a secure operator session.
2. Set `CONVEX_QUOTE_PRICING_READ_KEY` to that same value in the target Convex
   deployment and the matching Vercel environment.
3. Deploy and verify a public quote can read pricing and persist successfully.
4. Set `CONVEX_PRICING_ALLOW_WRITE_KEY_FALLBACK=false` in Convex.
5. Verify a pricing read with the dedicated key succeeds and a pricing read
   using only the write key is rejected.

For a zero-downtime read-key rotation:

1. Set the old current value as
   `CONVEX_QUOTE_PRICING_READ_KEY_PREVIOUS` in Convex.
2. Set the new value as `CONVEX_QUOTE_PRICING_READ_KEY` in Convex.
3. Update Vercel's current pricing read key to the new value and redeploy.
4. Verify a pricing read and a persisted quote in the target environment.
5. Remove `CONVEX_QUOTE_PRICING_READ_KEY_PREVIOUS` from Convex.

Never move the sender first or leave a previous key configured after the
rotation is complete.

## Rotate the Quote Write Credential

The Convex write guard accepts `CONVEX_QUOTE_WRITE_KEY_PREVIOUS` only when a
current write key is also configured.

1. In a secure operator UI, set the current production value as
   `CONVEX_QUOTE_WRITE_KEY_PREVIOUS` in Convex.
2. Set a newly generated value as `CONVEX_QUOTE_WRITE_KEY` in Convex.
3. Update Vercel Production `CONVEX_QUOTE_WRITE_KEY` to the new value and
   redeploy.
4. Submit one controlled quote and verify persistence, quota consumption, and
   expected notification/CRM scheduling.
5. Remove `CONVEX_QUOTE_WRITE_KEY_PREVIOUS` from Convex immediately after the
   new deployment is verified.

## Rotate the CRM Intake Key

The Frontier Pixel CRM holds one intake key per tenant in
`CRM_INTAKE_TENANT_KEYS_JSON` and has no previous-key slot, so every delivery
gets `403` while the two deployments disagree. Pause delivery first instead of
racing the two updates.

1. Set `SHED_CRM_SYNC_ENABLED=false` in the Shed Convex deployment. Quote and
   discussion delivery then stop before claiming any outbox row, so new and
   retrying rows stay queued. Quote submission and the owner's SMS and email
   alerts are unaffected.
2. In a secure operator session, generate the new key and replace only the
   `shed210` entry in the CRM deployment's `CRM_INTAKE_TENANT_KEYS_JSON`,
   keeping every other tenant's entry intact.
3. Set `FRONTIER_PIXEL_CRM_INTAKE_KEY` in the Shed Convex deployment to the same
   value through a secure operator UI, with no trailing whitespace or control
   characters. Never print the key or pipe it through a logged shell command.
4. Set `SHED_CRM_SYNC_ENABLED=true`. The minute recovery crons resume the queued
   quote and discussion rows; nothing needs a manual replay.
5. Submit one controlled quote. Verify its `crmQuoteSyncOutbox` row reaches
   `succeeded` and the lead appears in the CRM, and confirm the Convex logs show
   no `CRM quote sync was rejected by the CRM intake` lines.

If a mismatch slips through anyway, the sender logs every `401` or `403` and
retries it on the normal 1 minute, 5 minute, 30 minute, 2 hour, and 12 hour
schedule. Fixing the key within about 14.6 hours lets those rows deliver on
their own. After that they are dead-lettered with `retry budget exhausted`,
logged as `CRM quote sync dead-lettered`, and must be replayed one outbox id at
a time with `crmQuoteSync:replayDeadLetter` (see the README).

## Bind CRM Success Acknowledgements

Before enabling strict acknowledgement binding, the Frontier Pixel CRM intake
success response must echo these exact outbound identifiers:

- `externalSubmissionId`
- `sourceDocumentId`
- `publicId`

Ship and verify the receiver first. Then set
`SHED_CRM_REQUIRE_BOUND_ACKNOWLEDGEMENT=true` in the Shed Convex deployment.
An absent or mismatched echo is retryable and must not mark an outbox row
successful. Strictly verified successes record
`acknowledgementBindingVersion: "source_identifiers_v1"` on the outbox. Rows
that succeeded before strict binding was enabled have no such provenance and
remain ineligible for destructive source retention unless a separate reviewed
reconciliation establishes it.

## Current Quote Retention

`QUOTE_DATA_RETENTION_DAYS` is disabled when absent. A configured value must be
a whole number from 30 through 3650. Every six hours, the cron starts or resumes
a fixed-cutoff sweep. Each transaction scans and deletes at most six quotes,
then schedules an immediate durable-cursor continuation while more pages remain.
A quote is deleted only when:

- CRM sync succeeded;
- SMS and email notification states are terminal; and
- exactly one same-tenant CRM outbox row exists, is linked to the quote and its
  external submission id, succeeded, and records strict source-identifier
  acknowledgement provenance.

Every destructive precondition is checked before any child row is removed.
Oversized terminal attempt sets are then removed in transaction-safe bounded
batches; the parent quote and succeeded outbox are removed together only after
their child rows are exhausted. Select the retention period only after business,
legal, SMS-consent, and CRM owners approve it. Frontier Pixel CRM must have its
own matching retention policy; deleting Shed's local copy does not delete the
CRM copy.

## Legacy Convex Data

The production deployment still contains nonempty historical CRM,
communications, auth/membership, push, AI, and settings tables omitted from the
current quote-only schema. This PR intentionally does not delete those tables.
The authoritative inventory and retirement procedure is
[`legacy-convex-data-retirement.md`](./legacy-convex-data-retirement.md).

Before retirement:

1. Create a restricted, encrypted production export with `pnpm exec convex
   export --prod --include-file-storage --path <restricted-path>`.
2. Verify the required records and attachments were imported into Frontier
   Pixel CRM and reconcile counts by table/domain without copying PII into the
   PR or logs.
3. Obtain written data-owner and retention approval for each nonempty legacy
   domain.
4. Let pending quote alerts and CRM outbox work reach a reviewed terminal state,
   then explicitly decide whether current quote, notification-attempt, and
   outbox records will be migrated with intact references, retained in the
   restricted old deployment for an approved period, or dispositioned under an
   approved retention policy. Never silently drop them during a cutover.
5. Prefer moving the quote backend to a fresh Convex deployment containing only
   the current schema. Keep the old deployment access-restricted until export
   verification, reconciliation, the observation window, restore rehearsal,
   and the applicable retention period are complete.

Do not improvise an inline production deletion. The current Convex CLI inline
evaluator is read-only, and omitted-schema tables cannot be safely targeted by
the typed migrations component. Do not add a legacy purge migration to the
current narrowed schema.

## Remove Confirmed Stale Environment Names

Re-run a tracked-code reference search before removal. At the time of this
change, the following Shed Convex production names were not referenced by the
deployed quote-only runtime:

- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_TRUSTED_ORIGINS`
- `CONVEX_AUTH_AUDIT_KEY`
- `LEAD_TRACKER_ADMIN_EMAILS`
- `OPENAI_API_KEY`
- `PLATFORM_ADMIN_EMAILS`
- `SITE_URL`
- `WEB_PUSH_VAPID_PRIVATE_KEY`
- `WEB_PUSH_VAPID_PUBLIC_KEY`
- `WEB_PUSH_VAPID_SUBJECT`
- `ZOHO_WEBHOOK_SETUP_TOKEN`

After production verification, remove each confirmed name with `pnpm exec
convex env remove <NAME> --prod`. List names without values using `pnpm exec
convex env list --prod --names-only`.

Also remove the stale Vercel Production `CONVEX_AUTH_AUDIT_KEY`, and remove
Preview-only `ZOHO_RELAY_CONVEX_SITE_URL` and
`NEXT_PUBLIC_LEAD_TRACKER_SIGN_UP_ENABLED` after confirming no maintained branch
uses them. Use `vercel env rm <NAME> <production|preview> --yes`, one explicit
name and environment at a time.

The Convex CLI also reported trailing carriage returns on
`FRONTIER_PIXEL_CRM_INTAKE_KEY`, `FRONTIER_PIXEL_CRM_INTAKE_URL`, and
`SHED_CRM_SYNC_ENABLED`. Re-enter those active values through a secure operator
UI without the trailing control character, pausing delivery while the key
changes as described in [Rotate the CRM Intake Key](#rotate-the-crm-intake-key)
(steps 1 and 3 to 5; the CRM entry stays the same), then verify CRM sync. Do not
retrieve or pipe their current values through a logged shell command.

## Provider and Repository Controls

- Restrict the Google key to Places API (New), set a daily quota and billing
  alerts, and add Vercel Firewall/WAF limits for both Google review routes.
- Put `/api/quote` behind Vercel bot/WAF controls and a server-verified challenge.
  The Convex daily circuit breakers cap fan-out cost, but a distributed client
  can still rotate optional session IDs and contact values to consume that
  budget or deny service. Treat the session quota only as duplicate protection.
- Confirm untrusted fork previews cannot read Vercel Preview secrets and that
  the Preview Convex deploy key is preview-scoped.
- Require the new CI workflow before merging to `main`.
- Enable GitHub native secret scanning/code scanning if the private repository's
  plan supports them. The repository CI does not assume those paid settings are
  available.

## Production Verification

- Run `pnpm lint`, `pnpm test`, `pnpm typecheck`, `pnpm build`, and both
  dependency audit commands from CI.
- Confirm production pricing reads with the intended credential and wrong-key
  reads fail closed.
- Submit one controlled quote; verify build-subtotal language, delivery-pending
  metadata, Convex persistence, notification text, and CRM outbox state.
- Confirm no repeating quota, retention, notification, or CRM errors in Convex
  logs.
- Confirm Google review routes remain no-store and provider usage stays within
  the configured budget.
- Recheck HTTPS/security headers and `/admin` 404 behavior.
