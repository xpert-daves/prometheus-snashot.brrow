# Shed210 website performance

This installation measures the journey from browsing buildings and projects to requesting a quote. Its primary goal is **Quote requests received** (`quote-request`, type `quote`): a valid live production quote persisted by Shed210 and received through its durable CRM sync. It does not measure a completed sale, a new customer, a qualified lead, or revenue.

This document defines the adapter's intended behavior. Confirm deployment and the first production event before treating a zero count as evidence that nobody used the website.

## Tenant configuration

- Tenant: `shed210`; module: `website_performance`, private.
- Website origin: `https://www.shed210.com`, matching the canonical default in `src/lib/seo.ts`.
- Allowed measurement paths: `/`, `/quote`, `/buildings`, `/gallery`, `/service-area`, `/news`, `/contact`.
- Conversion goal: `{ "key": "quote-request", "label": "Quote requests received", "kind": "quote" }`.
- CRM inquiry mapping: omitted. `/contact` has text/email links, copy buttons, and a link to `/quote`; there is no contact submission form to confirm.

The ten optional groups below distinguish browsing sections and contact actions. The CRM API retains the field name `offers` for these groups; the report calls them page groups.

| Group key | Report label | Source activity |
| --- | --- | --- |
| `home` | Home | `/` |
| `quote` | Quote calculator | `/quote`, including confirmed quote requests |
| `buildings` | Buildings | `/buildings` |
| `projects` | Projects and gallery | `/gallery` and `/projects/[citySlug]/[slug]` |
| `areas` | Service areas | `/service-area` and `/service-area/[city]` |
| `guides` | Guides | `/news` and `/news/[slug]` |
| `contact` | Contact page | `/contact` and contact-page navigation |
| `text` | Text actions | Clicks on `sms:` links |
| `email` | Email actions | Clicks on `mailto:` links |
| `phone` | Phone actions | Actual `tel:` link clicks, if present |

The adapter collapses project-detail URLs to `/gallery`, service-area details to `/service-area`, and guide details to `/news`; building children, if added, collapse to `/buildings`. These are exact measurement buckets, not wildcard paths. For example, the existing `/news/sanantonio_shed_guide` and `/news/san-antonio-shed-cost-guide` both report under `/news`. There is no `/projects` index route. The initial report cannot compare individual projects, cities, or guides.

Text, email, and phone are action groups, not invented page routes. Their events retain the normalized page on which the action happened. A text/email click or copying contact details does not prove a message was sent. The inspected navigation has no telephone link, so the phone group can legitimately remain empty; it does not count incoming calls.

## What each count means

| Report count | Definition and limit |
| --- | --- |
| Page views | Recorded page-view events after route normalization. Repeated navigation can produce another view; these are not unique visitors. |
| Action clicks | Recorded intentional navigation/contact actions. They show interest, not confirmed contact or purchase. |
| Form starts | The first actual input interaction with the quote form within the adapter's deduplication scope. Rendering/restoring the form is not a start. |
| Submission failures | Recorded validation, network, unavailable-service, or rejected-submit failures. One person can retry; a network error alone does not prove that no source quote was saved. A blocked Get Quote (`validation`) also sends `failureField`, the first thing the visitor has to fix: `selection` (building, size or options), `name`, `email`, `phone`, `consent` or `address`. It is a fixed word chosen by `getQuoteBlockingField`, never what was typed. A blocked Continue on an earlier step is not counted. |
| Quote requests received | Eligible source quote records confirmed in the CRM, deduplicated by their stable source quote identity. A person comparing two configurations can create two quote requests. |

Existing analytics names need careful interpretation. `useQuoteFlow.ts` sends `quote_form_opened` when the persistence hook mounts/restores and when it resets; do not map that to a form start. `quote_form_submitted` runs before the server request finishes. Both `quote_success` and `quote_generated` run after the same successful response; neither should independently add another confirmed goal. Existing Google/Vercel custom-event totals are separate from this module's counters.

Browser events respect the adapter's opt-out, Do Not Track, and Global Privacy Control handling. Blockers, offline delivery failures, and unrecognized staff visits can also affect coverage. Confirmed quote goals are operational CRM records and do not depend on anonymous browser measurement being enabled. Therefore **completed goals divided by browser starts or page views is not a reliable conversion rate**: the numerator and denominator have different coverage and do not represent the same visitor cohort.

## Confirmed quote delivery

The quote API saves the quote before returning HTTP 201. Source `convex/quoteRequests.ts` inserts the quote and enqueues a `crmQuoteSyncOutbox` item in the same mutation; `convex/crmQuoteSync.ts` supplies retries, acknowledgement binding, and recovery. The CRM adapter records the eligible goal as part of its quote-ingestion mutation, using the same stable quote identity on repeated delivery.

The completion eligibility boundary excludes historical backfills, records submitted before the module installation, test/internal contacts, and non-production sources. The reporting timestamp is the source `submittedAt`, not when a delayed retry arrives. A delayed sync can consequently update an earlier day's count. Module disabling or missing measurement configuration must not reject an otherwise valid customer quote or change its notification behavior.

Do not add a separate Next.js `after()` goal emitter to `/api/quote`. A callback after the HTTP response is a separate delivery step from the committed source quote; without a durable record it cannot provide the existing outbox's replay/recovery guarantees. Emitting from both the route and the CRM adapter can double-count unless they share one event identity. Keeping the goal write in CRM ingestion also makes a retried acknowledgement safe: quote state and the measurement write commit together. Every create/link/deduplication path must preserve this guarantee, and historical-backfill paths must remain excluded.

Operational quote identifiers may provide server-side deduplication. Browser event payloads should contain only approved event tokens, normalized paths, group keys, and permitted attribution. Do not forward quote contact fields, addresses, form answers, complete destination URLs, quote totals, or arbitrary existing analytics properties into this module.

## Historical baselines and weekly review

The module starts measuring forward from installation. Do not manufacture past page views, form starts, click behavior, or confirmed-goal events from old quote records. Existing source-quote and CRM data can be reported separately with an extraction time, date window, and explicit definition:

- Source quotes: persisted quote requests, potentially multiple per customer. Quote value is proposed pricing, not booked revenue.
- CRM quotes received: synchronized quote records; the gap from source records can indicate pending, failed, excluded, or historical sync activity.
- CRM leads: customer/contact records, which may combine several quote requests. Lead counts are not quote counts or sales counts.

For each weekly review, use the same UTC window as the report and record the observation time. First check the connection's most recent event and any sync backlog. Then review which sections drew attention, whether visitors interacted with the quote form, and whether submission failures increased. Compare confirmed quote requests with the separate operational quote baseline to identify delivery gaps before drawing conclusions about demand.

Choose one practical improvement from that evidence: clarify the quote CTA if browsing produces little interaction; simplify a confusing quote step if genuine starts produce repeated failures; improve the information around popular building/project sections; or investigate follow-up separately when quote requests arrive but business outcomes remain weak. Read CRM conversations and explicit sales status to assess quality or revenue. This website report alone cannot establish either, and small weekly samples should not be treated as stable trends.

Repository sources: `src/lib/useQuoteFlow.ts`, `src/lib/useQuoteFormPersistence.ts`, `src/lib/useQuoteSubmission.ts`, `src/lib/analytics.ts`, `src/components/ContactPageClient.tsx`, `src/app/api/quote/route.ts`, `src/lib/quotePersistence.ts`, `convex/quoteRequests.ts`, `convex/crmQuoteSync.ts`, and `src/app/sitemap.ts`. Configuration and server-goal constraints come from the CRM's `convex/marketingEventContract.ts` and `convex/marketingEvents.ts`.
