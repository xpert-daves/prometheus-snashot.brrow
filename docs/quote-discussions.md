# Ready to schedule requests

Every saved estimate already reaches David as a lead alert, and the result says
so ("David has a copy of this estimate"), the same for a first estimate or a
compared option. After a successful estimate, an optional **Ready to schedule
this build** button is the step past that: it tells David the customer wants to
schedule that exact saved configuration. Internally it is still a "discussion
request" (`quoteDiscussionRequests`, `/api/quote/discussion`). Customers keep
the existing contact gate and can compare more options as before. A schedule
request does not create another quote, change SMS consent, accept an estimate,
or send a customer message. Once saved, the confirmation says David now knows
they want to schedule this build and will contact them as soon as possible to
finalize the details.

When the response carries no action token (the feature is off), the result
shows "Ready to schedule? Call or text David at" the business number instead.
It never tells the customer to resubmit.

The online estimate now requires quote-related SMS consent, independently of
this optional scheduling action. New submissions do not grant promotional
consent. See [quote SMS consent](quote-sms-consent.md) for exact copy/version,
legacy-client behavior, and provider verification before rollout.

## Capability and delivery

`QUOTE_DISCUSSIONS_ENABLED=true` in the Next.js server enables issuance of a
random 32-byte action token with each newly saved Shed210 quote. Only its SHA-256
hash and 24-hour expiry are persisted. The browser keeps the raw token in the
current result in memory; it is not a URL parameter, analytics value, or locally
persisted draft. Quote IDs alone cannot authorize an action. Editing the build
or delivery ZIP clears the old result and its button.

`POST /api/quote/discussion` accepts only `{quoteId, actionToken}`. The server
selects the tenant, limits the body and request rate, hashes the token, and uses
the existing guarded Convex write credential. One atomic mutation creates a
`quoteDiscussionRequests` row per saved quote and schedules delivery. Repeated
clicks return the original receipt and preserve its timestamp. The same valid
token can retrieve that receipt after expiry; an expired token cannot create a
new request. Different quotes can each have a request.

The discussion outbox waits for the original quote outbox to succeed with a
bound acknowledgment. Token-bearing quotes automatically require that strict
acknowledgment, regardless of the global compatibility flag. Dependency waits
do not consume delivery attempts. Failed requests retry using the existing quote
sync delays; a minute cron recovers pending and interrupted workers. Terminal
failures remain visible in `quoteDiscussionRequests` with `lastError`; operators
can replay a corrected dead letter with internal `quoteDiscussions:replay` and
its request document ID. Replay preserves the external ID and requestedAt.
Quote retention keeps any quote with an undelivered discussion request.

## Staff alerts

The same mutation also schedules `notifications:sendScheduleRequestSms` and
`notifications:sendScheduleRequestEmailAlerts` at once; they do not wait for
CRM delivery. They use the quote alert recipients and send a
`Shed210 READY TO SCHEDULE` text and a `Ready to schedule:` email for that
quote, with a recommended action to call or text as soon as possible. Their
status lives on the request row (`smsAlertStatus`, `emailAlertStatus`,
`smsAlertError`, `emailAlertError`), not on the quote's own alert statuses, and
their `notificationAttempts` / `quoteEmailNotificationAttempts` rows carry
`scheduleRequestId`. A repeated tap returns the original receipt and sends no
second alert.

The worker uses the existing validated CRM intake origin/key and posts to
`/api/intake/shed-quote-discussion` with this version-1 payload:

```json
{
  "version": 1,
  "tenantSlug": "shed210",
  "externalRequestId": "shed210:quote-discussion:<publicId>",
  "quoteExternalSubmissionId": "shed210:quote:<publicId>",
  "publicId": "<publicId>",
  "sourceDocumentId": "<source quote document ID>",
  "requestedAt": 0
}
```

`Idempotency-Key` equals `externalRequestId`. A successful response must contain
`ok:true`, status `created` or `deduped`, and matching tenant/external request/
external quote/public/source document IDs. The CRM follows the current quote
link to its lead, including after merges; it creates one module activity and
one staff push request. Existing quote submission and customer SMS workflows
are not invoked.

## Coordinated rollout

1. Deploy the compatible CRM receiver, ledger, indexed lead-link metadata, and
   comparison UI first. Verify its runtime and schema compatibility checks.
2. Deploy Shed210 with `QUOTE_DISCUSSIONS_ENABLED` unset/false. Its new table and
   optional quote capability fields require no existing-data migration.
3. Verify existing `SHED_CRM_SYNC_ENABLED`, intake credentials, active Shed210
   tenant, and `shed_quotes` CRM module. Use isolated/mocked credentials in
   preview: the current production intake endpoint allowlist is deliberately
   retained. Do not send test quotes or discussion events to production.
4. After isolated end-to-end validation, enable `QUOTE_DISCUSSIONS_ENABLED=true`
   for the intended environment and verify one authorized saved-quote flow,
   the ready-to-schedule text and email, duplicate suppression, latest
   requested build, and ordinary comparison.
5. Roll back new customer actions by disabling `QUOTE_DISCUSSIONS_ENABLED`.
   Leave the outbox worker/receiver available to deliver already-saved requests.

No historical request backfill or consent migration is needed. Compare leads
with discussion requests, repeat quote use, and eventual sales separately;
this action is an interest signal, not proof of a purchase or SMS opt-in.
