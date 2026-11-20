# Shed210 Historical Quote Backfill

This operator runbook backfills only the 75 Shed210 quote rows that predate the
live CRM outbox launch. It reuses the live quote outbox and receiver. It does
not schedule Shed SMS or email alerts.

## Fixed audited scope

- Tenant: `shed210`
- Cutoff: `1783794259390` (`2026-07-11T18:24:19.390Z`)
- Run id: `shed210-quotes-through-2026-07-11`
- Expected historical source rows: 75
- Existing live source/outbox row after the cutoff: 1

Do not change the cutoff or run id during the run. Every mutation includes the
exact remaining count so a concurrent or stale invocation aborts before writes.
The maximum batch size is 10.

## Preconditions

1. Deploy the CRM receiver historical-mode change first.
2. Deploy this Shed change with `SHED_CRM_BACKFILL_ENABLED=false`.
3. Keep the existing `SHED_CRM_SYNC_ENABLED=true`, approved receiver URL, and
   receiver key configured.
4. Do not enable the backfill gate until preview and dry-run both report exactly
   75 ready rows and zero invalid rows.

Every non-dry-run action performs an authenticated, no-store `GET` capability
probe against the exact configured receiver URL. It requires HTTP 200 and the
exact response:

```json
{"ok":true,"tenantSlug":"shed210","historicalBackfillVersion":1}
```

An old receiver, wrong tenant/version, auth failure, malformed response, or
network failure aborts before the write mutation. Every asynchronous historical
delivery attempt and retry repeats the same capability probe immediately before
its quote POST; a failed probe is retryable and sends no quote body.

## Preview and dry-run

```powershell
npx convex run internal.crmQuoteSync.previewHistoricalBackfill '{"tenantSlug":"shed210","cutoffTimestamp":1783794259390,"backfillRunId":"shed210-quotes-through-2026-07-11","batchSize":10}' --prod
```

Required preview:

- `eligibleSourceCount=75`
- `alreadyOutboxedCount=0`
- `remainingCount=75`
- `validRemainingCount=75`
- `invalidRemainingCount=0`
- `wouldEnqueueCount=10`
- `ready=true`

The action dry-run performs no network request, database write, or schedule:

```powershell
npx convex run internal.crmQuoteSync.executeHistoricalBackfill '{"tenantSlug":"shed210","cutoffTimestamp":1783794259390,"backfillRunId":"shed210-quotes-through-2026-07-11","batchSize":10,"expectedRemainingCount":75,"dryRun":true}' --prod
```

Required dry-run: `mode=dry_run`, `enqueuedCount=0`,
`remainingBefore=75`, and `remainingAfter=75`.

## Enable and canary

```powershell
npx convex env set SHED_CRM_BACKFILL_ENABLED true --prod
npx convex run internal.crmQuoteSync.executeHistoricalBackfill '{"tenantSlug":"shed210","cutoffTimestamp":1783794259390,"backfillRunId":"shed210-quotes-through-2026-07-11","batchSize":1,"expectedRemainingCount":75,"dryRun":false}' --prod
npx convex run internal.crmQuoteSync.reconcileHistoricalBackfill '{"tenantSlug":"shed210","cutoffTimestamp":1783794259390,"backfillRunId":"shed210-quotes-through-2026-07-11"}' --prod
```

The canary must enqueue exactly one row and leave 74. Wait for the historical
run status to show one succeeded and zero pending, processing, retry-scheduled,
or dead-letter rows before continuing.

## Batches

Run one command at a time. Reconcile after each command and wait for every
enqueued historical row to succeed before starting the next batch.

```powershell
npx convex run internal.crmQuoteSync.executeHistoricalBackfill '{"tenantSlug":"shed210","cutoffTimestamp":1783794259390,"backfillRunId":"shed210-quotes-through-2026-07-11","batchSize":10,"expectedRemainingCount":74,"dryRun":false}' --prod
npx convex run internal.crmQuoteSync.executeHistoricalBackfill '{"tenantSlug":"shed210","cutoffTimestamp":1783794259390,"backfillRunId":"shed210-quotes-through-2026-07-11","batchSize":10,"expectedRemainingCount":64,"dryRun":false}' --prod
npx convex run internal.crmQuoteSync.executeHistoricalBackfill '{"tenantSlug":"shed210","cutoffTimestamp":1783794259390,"backfillRunId":"shed210-quotes-through-2026-07-11","batchSize":10,"expectedRemainingCount":54,"dryRun":false}' --prod
npx convex run internal.crmQuoteSync.executeHistoricalBackfill '{"tenantSlug":"shed210","cutoffTimestamp":1783794259390,"backfillRunId":"shed210-quotes-through-2026-07-11","batchSize":10,"expectedRemainingCount":44,"dryRun":false}' --prod
npx convex run internal.crmQuoteSync.executeHistoricalBackfill '{"tenantSlug":"shed210","cutoffTimestamp":1783794259390,"backfillRunId":"shed210-quotes-through-2026-07-11","batchSize":10,"expectedRemainingCount":34,"dryRun":false}' --prod
npx convex run internal.crmQuoteSync.executeHistoricalBackfill '{"tenantSlug":"shed210","cutoffTimestamp":1783794259390,"backfillRunId":"shed210-quotes-through-2026-07-11","batchSize":10,"expectedRemainingCount":24,"dryRun":false}' --prod
npx convex run internal.crmQuoteSync.executeHistoricalBackfill '{"tenantSlug":"shed210","cutoffTimestamp":1783794259390,"backfillRunId":"shed210-quotes-through-2026-07-11","batchSize":10,"expectedRemainingCount":14,"dryRun":false}' --prod
npx convex run internal.crmQuoteSync.executeHistoricalBackfill '{"tenantSlug":"shed210","cutoffTimestamp":1783794259390,"backfillRunId":"shed210-quotes-through-2026-07-11","batchSize":4,"expectedRemainingCount":4,"dryRun":false}' --prod
```

Reconciliation command:

```powershell
npx convex run internal.crmQuoteSync.reconcileHistoricalBackfill '{"tenantSlug":"shed210","cutoffTimestamp":1783794259390,"backfillRunId":"shed210-quotes-through-2026-07-11"}' --prod
```

Stop immediately on any unexpected remaining count, invalid row, retry,
dead-letter, or capability error. Do not change expected counts to force past a
drift error; rerun preview and investigate.

## Disable and verify

```powershell
npx convex env set SHED_CRM_BACKFILL_ENABLED false --prod
npx convex run internal.crmQuoteSync.reconcileHistoricalBackfill '{"tenantSlug":"shed210","cutoffTimestamp":1783794259390,"backfillRunId":"shed210-quotes-through-2026-07-11"}' --prod
npx convex run internal.crmQuoteSync.executeHistoricalBackfill '{"tenantSlug":"shed210","cutoffTimestamp":1783794259390,"backfillRunId":"shed210-quotes-through-2026-07-11","batchSize":1,"expectedRemainingCount":0,"dryRun":true}' --prod
```

Required source reconciliation:

- `sourceMissingOutboxCount=0`
- `invalidRemainingCount=0`
- `sourceOutboxCoverageComplete=true`
- `historicalRunOutboxCount=75`
- historical statuses: 75 succeeded and all other statuses zero
- `historicalRunDeliveryComplete=true`
- all outboxes: 76 succeeded and pending/processing/retry/dead-letter all zero
- replay dry-run: remaining 0, enqueued 0

The CRM-side aggregate audit must independently show 76 source-linked quotes,
76 projections, and zero duplicate or orphan rows.

Disabling `SHED_CRM_BACKFILL_ENABLED` prevents new historical enqueue batches
but does not cancel rows already queued. In an incident, disabling
`SHED_CRM_SYNC_ENABLED` pauses both historical delivery and new live quote
delivery, so use that broader switch only when necessary.
