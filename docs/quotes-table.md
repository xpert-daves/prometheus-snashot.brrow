# Quote Backend Tables

This repo now owns the public Shed210 site, quote pricing, quote persistence,
and quote alert delivery only. Frontier Pixel CRM owns admin auth, CRM UI,
leads, calls, inbound SMS/email, push notifications, and future CRM operations.

This repo no longer serves `/admin/*`; those paths should fall through to the
normal site 404. Access the separate Frontier Pixel CRM directly for admin work.

## Active Convex Tables

| Table | Purpose |
| --- | --- |
| `tenants` | Legacy compatibility for the Shed210 tenant id used by quote rows and settings. |
| `quoteRequests` | One row per public website quote submission, including contact, inputs, server build subtotal, delivery-verification state, SMS consent proof, and alert statuses. |
| `quoteRateLimitBuckets` | Shared fixed-window buckets for preflight IP limits and atomic create-time contact, session, short-window tenant/global, and daily tenant/global quotas. Identifiers are hashed; raw limiter identities are not stored. |
| `quoteRetentionState` | Durable cursor and fixed cutoff for the optional, disabled-by-default quote-retention sweep. |
| `quotePricingSettings` | Legacy/local pricing config used only when `QUOTE_PRICING_SOURCE=shed_convex`. CRM mode reads an immutable publication from Frontier Pixel CRM instead. |
| `notificationRecipients` | Active SMS alert recipients for quote and ready-to-schedule alerts. |
| `notificationAttempts` | Per-recipient Twilio SMS alert attempts. `scheduleRequestId` is set on attempts for a ready-to-schedule alert. |
| `quoteEmailNotificationAttempts` | Per-recipient Zoho email alert attempts. `scheduleRequestId` is set the same way. |
| `quoteDiscussionRequests` | One Ready to schedule request per saved quote: CRM delivery state plus its own staff SMS/email alert statuses. See `docs/quote-discussions.md`. |
| `crmQuoteSyncOutbox` | Durable, idempotent delivery state for the independent Frontier Pixel CRM intake. |

Historical CRM tables such as `leads`, `leadQuotes`, `calls`, `messages`,
`communicationIntake`, and push tables are not deleted by this cleanup. They
may remain in existing Convex deployments as historical/unvalidated data until
Frontier Pixel CRM imports or intentionally purges them. New quote submissions
from this repo do not write to those tables.

## Limits on the quote form

These, with the bot check below, are what stand between a script and the
owner's phone.

| Limit | Where | Counts |
| --- | --- | --- |
| 10 per minute per network address | route, before the body is read | every request |
| 8 per 15 minutes per session | route | requests that send a `session_id` |
| 12 per UTC day per network address | route, after validation | well-formed quotes |
| 5 per UTC day per network address, 20 per UTC day for the site | route, after the bot check | quotes that did not pass the bot check |
| 10 per hour per email, 10 per hour per phone, 8 per 15 minutes per session | Convex, with the insert | saved quotes |
| 30 per 5 minutes and 100 per UTC day for the site | Convex, with the insert | saved quotes |
| 100 per 5 minutes and 250 per UTC day for the deployment | Convex, with the insert | saved quotes |

The site and deployment quotas turn away **every** customer once they fill, so
the per-address day limit exists to keep one address from filling them: before
it, about 100 scripted submissions from one address closed the form to
everyone until midnight UTC and sent the owner an alert for each. The most one
browser session had sent by October 2026 was 10, comparing options. An IPv6 address counts by its /64.

A customer stopped by the per-address day limit, or by a full site or
deployment quota, is told to call or text instead of "try again shortly".
Both are reported to Sentry as a warning (`QuoteIntakeLimitReached`, tag
`limit`: `visitor_day` or `site_quota`), because either means a script is at
the form or the limits are too low for real demand. A customer's own contact
or session limit is not reported.

### Bot check on submit

Submitting runs Cloudflare Turnstile's invisible check in the browser, the
same one a website chat start uses (`src/lib/turnstile.ts`, action
`quote_submit`). The token rides along as `turnstileToken`, and the route
asks Cloudflare whether it is real before saving
(`src/lib/turnstileVerify.server.ts`). The token is spent by that check and
never stored.

It is on when both keys are set:

| Name | Where | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Vercel | Already set for chat. The browser runs no check without it. |
| `TURNSTILE_SECRET_KEY` | Vercel, server only | The same widget's secret key from Cloudflare. Without it the route checks nothing and the limits above are all there is. |

A quote is never refused just because the check didn't pass. A customer whose
browser blocks the script, or whose check times out after 8 seconds, still
gets a price. What changes is which allowance the quote uses:

| The check | The quote |
| --- | --- |
| Passed | Saved, under the limits in the table above. |
| Failed, missing, or Cloudflare unreachable | Saved while the unchecked allowance lasts: 5 per UTC day from one address and 20 per UTC day for the whole site. After that the customer is told to call or text. |

So a script that can't pass the check can send the owner at most 20 alerts a
day, and can't reach the site's 100-a-day quota that would close the form to
customers who did pass. A full unchecked allowance is reported to Sentry
(`limit`: `unchecked_address_day` or `unchecked_site_day`).

A script that does pass the check from many addresses can still fill the site
quota; that takes solving Turnstile at volume.

## Quote Submission Flow

1. `src/app/api/quote/route.ts` validates the request, normalizes phone input,
   enforces the shared IP/session rate limits (see
   [Limits on the quote form](#limits-on-the-quote-form)), reads the explicitly
   selected pricing source, and calculates the server-side build subtotal.
   Browser mileage is not trusted; delivery is saved as
   `pending_verification`. If pricing cannot be verified, the route returns
   `503` before saving or scheduling notifications.
2. `src/lib/quotePersistence.ts` calls `api.quoteRequests.create` with
   `CONVEX_QUOTE_WRITE_KEY`.
3. `convex/quoteRequests.ts` atomically checks contact, session, and both
   short-window and daily tenant/global create quotas, inserts `quoteRequests`,
   creates its CRM outbox row, then schedules:
   - `internal.notifications.sendQuoteSms`
   - `internal.notifications.sendQuoteEmailAlerts`
4. SMS alerts read active `notificationRecipients`, look up earlier quotes from
   the same tenant and phone in the last 30 days (index
   `by_tenant_id_and_contact_phone_and_created_at`, at most 25) to label the
   alert `NEW LEAD` or `SAME LEAD, OPTION n`, send through Twilio, and record
   `notificationAttempts`.
5. Email alerts read `QUOTE_NOTIFICATION_EMAIL_RECIPIENTS`, use the same lead
   label in the subject, send through Zoho, record
   `quoteEmailNotificationAttempts`, and include an `Open CRM` link built from
   `FRONTIER_PIXEL_CRM_ADMIN_URL` plus the quote public id and row id.
6. CRM delivery validates the approved receiver and its success acknowledgement.
   During the receiver-first rollout, bound acknowledgement enforcement remains
   off. Once enabled, success must echo the payload's `externalSubmissionId`,
   source `documentId` as `sourceDocumentId`, and `publicId` exactly. A strictly
   verified success records `acknowledgementBindingVersion` on the outbox;
   compatibility-mode and historical successes leave it absent and are not
   eligible for destructive source retention.

## Required Environment

Next.js/Vercel runtime:

- `NEXT_PUBLIC_CONVEX_URL`
- `CONVEX_QUOTE_WRITE_KEY`
- `CONVEX_QUOTE_PRICING_READ_KEY` optional dedicated key for local Shed pricing;
  when absent, the Next server uses the write key during the rollout window
- `QUOTE_PRICING_SOURCE` (`shed_convex` or `frontier_pixel_crm`)
- `FRONTIER_PIXEL_CRM_CONVEX_URL` pinned to
  `https://youthful-horse-290.convex.cloud` when CRM pricing is selected
- `FRONTIER_PIXEL_CRM_QUOTE_PRICING_KEY` matching the CRM deployment's
  dedicated `SHED_QUOTE_PRICING_READ_KEY` when CRM pricing is selected
- `QUOTE_TENANT_SLUG` optional; defaults to `shed210`

Convex runtime:

- `CONVEX_QUOTE_WRITE_KEY`
- `CONVEX_QUOTE_WRITE_KEY_PREVIOUS` optional and temporary during rotation
- `CONVEX_QUOTE_PRICING_READ_KEY` dedicated local pricing-read key
- `CONVEX_QUOTE_PRICING_READ_KEY_PREVIOUS` optional and temporary during
  pricing-key rotation
- `CONVEX_PRICING_ALLOW_WRITE_KEY_FALLBACK` set to `false` after Vercel
  has the dedicated local pricing key; unset/`true` is rollout compatibility
- `FRONTIER_PIXEL_CRM_ADMIN_URL`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `QUOTE_NOTIFICATION_EMAIL_RECIPIENTS` optional comma-separated email list
- `ZOHO_CLIENT_ID`
- `ZOHO_CLIENT_SECRET`
- `ZOHO_REFRESH_TOKEN`
- `ZOHO_MAIL_ACCOUNT_ID`
- `ZOHO_FROM_ADDRESS`
- `SHED_CRM_REQUIRE_BOUND_ACKNOWLEDGEMENT` defaults to `false`; enable only
  after receiver-first echo verification
- `QUOTE_DATA_RETENTION_DAYS` optional whole days from 30-3650; unset disables
  deletion

Key rotation and retention rollout order are recorded in
[`convex-migrations.md`](convex-migrations.md). Historical CRM data retirement
requires the separate export/reconciliation runbook in
[`legacy-convex-data-retirement.md`](legacy-convex-data-retirement.md); this
rollout does not delete those tables.

Before production rollout, repoint or disable CRM-owned inbound Twilio Voice/SMS
and Zoho inbound webhooks. This repo no longer serves those Convex or Next.js
HTTP routes.

## Inspection Commands

Active SMS recipients:

```bash
pnpm exec convex run --prod --inline-query 'const recipients = await ctx.db.query("notificationRecipients").withIndex("by_active", q => q.eq("active", true)).take(20); return recipients.map(({label, phone, active}) => ({label, phone, active, normalizedPhoneLooksValid: /^\+1\d{10}$/.test(phone)}));'
```

Recent quote and alert rows:

```bash
pnpm exec convex data quoteRequests --prod --limit 5 --order desc --format jsonArray
pnpm exec convex data notificationAttempts --prod --limit 5 --order desc --format jsonArray
pnpm exec convex data quoteEmailNotificationAttempts --prod --limit 5 --order desc --format jsonArray
```
