# Quote Flow Architecture

This note is the quickest way to orient yourself before changing the quote experience.

## Current Shape

- The quote route is a 3-step client flow:
  1. `Size & Style`
  2. `Materials`
  3. `Build Location & Contact`
- A successful quote is an outcome rendered below step 3, not a fourth step.
- The post-quote handoff (`src/components/quote/QuoteNextSteps.tsx`) offers:
  - the optional **Ready to schedule this build** action
    (`QuoteDiscussionAction`; see `docs/quote-discussions.md`), or a "call or
    text David" line with the business number when the response carries no
    action token
  - compare another option

## Orchestration Boundary

- `src/components/QuotePageClient.tsx` is intentionally thin.
- `src/lib/useQuoteFlow.ts` owns orchestration:
  - draft state
  - current step
  - local draft persistence
  - build ZIP/location prefill
  - submission lifecycle
  - result state
  - restart/reset behavior
- Presentational step components under `src/components/quote/` should not reach into:
  - `localStorage`
  - geolocation
  - analytics
  - fetch

## Persistence Rules

- Non-PII draft values persist between reloads in `localStorage`
  (`quote-params`, `quote-step`).
- `name`, `email`, `phone`, the build address, and the SMS consent choice
  (current and legacy fields) are stripped before draft persistence.
- `name`, `email` and `phone` are kept separately in `sessionStorage`
  (`quote-contact`) so a visitor who leaves the quote mid-way in the same tab
  comes back to a filled contact step. The browser drops it when the tab
  closes, so the next person on a shared device starts blank. Values must be
  strings of at most 320 characters or they are ignored; clearing all three
  fields removes the key.
- The SMS consent choice and the build address are never saved. Consent is
  ticked on the visit that sends the quote.
- Resetting the form clears persisted draft state, including the tab's saved contact details, and rotates the session id used for quote submissions.
- Comparing another option clears only the successful quote result, sends the
  customer back to `Size & Style`, and keeps the in-memory contact,
  build-location, and quote session context.

## Interaction Guidance

- One fixed action bar owns Back, Continue, and Get Quote at every
  breakpoint so the primary action does not fall below a long step.
- Next, Back, and stepper navigation scroll to and focus the selected step
  heading. Successful submissions do the same for `Your Quote`. A field the
  server rejected (today only email) is marked and focused instead of raising
  an alert; other request failures move to the submission alert, which carries
  Call and Text links. Honor the user's reduced-motion preference when choosing
  scroll behavior.
- Wizard steps are browser-history entries. Moving forward pushes a same-URL
  entry that records the steps so far and no form data, so a phone Back gesture
  or the browser Back button returns to the previous step, with the same
  scroll and focus as the in-app Back, instead of leaving `/quote`. The page is
  not remounted, so in-memory contact details and consent survive. A step
  restored from the saved draft pushes nothing, so Back from the step a visit
  started on still leaves the page.
- Each wizard entry also carries Next's router marker (`__NA` and its tree),
  captured when the page mounts. Next reloads the page when it pops an entry
  without it, and a fragment link such as "Skip to content" leaves the current
  entry without one, so never write a wizard entry without that marker.
- A shown quote has no history entry of its own. Back from it moves to
  Materials and clears the price, like any backward move from a result;
  contact details stay in memory, so Forward returns to the contact form,
  where Get Quote saves a new quote. Back while a quote is saving keeps the
  customer on the contact step.
- The active step is a form. The action bar submits it through the form id so
  Enter can continue or submit without duplicating controls inside each card.
- Keep the contact step progressively disclosed: name appears first, then
  email, phone, and the required quote SMS consent. This is intentional
  conversion behavior that lowers perceived effort; use the action-bar hint to
  explain what comes next without expanding all required fields up front.
- Keep optional upgrades progressively disclosed as compact Exterior and
  Interior groups. Only one group opens at a time, while each closed row keeps
  its selected count visible so choices are not lost from view.

## Phone Layout (< 48rem)

Phones get an iOS-app-style presentation of the same flow; desktop markup and
styling are unchanged.

- One DOM serves both layouts. Phone styling uses the `phone:` Tailwind custom
  variant (`@custom-variant phone` in `src/app/globals.css`), which sorts after
  every built-in variant so it beats `sm:`/`md:` classes below 48rem and never
  applies above it. Phone-only elements are `hidden phone:*`; desktop-only
  decoration is `phone:hidden`. Do not use `max-md:` here (it loses to `sm:`).
- The phone skin lives at the end of `globals.css`: `qm-*` utilities (applied
  only as `phone:qm-*`), tokens on `[data-quote-app]`, and an unlayered phone
  block that rolls back the unlayered brand classes with `revert-layer` so
  `phone:` utilities can restyle them.
- Because jsdom ignores CSS, phone-only elements are visible to tests: never
  duplicate a control, accessible name, or test-queried text for phones;
  restyle the existing element instead.
- Step history is shared with desktop: the wizard history entries above
  (`useQuoteFlow`'s `navigateToStep`) also make an edge swipe or Android Back
  move one step. `QuotePageClient` only adds phone presentation around them: a
  sticky nav bar (`QuoteMobileNavBar`), the floating action bar, push/pop step
  transitions (View Transitions with a CSS fallback), per-step scroll
  restoration, and phone-only action sheets (reset, discard). These branches
  run only when `isCompactViewport()` is true, so the desktop paths remain what
  the tests exercise.
- A View Transitions push moves the whole viewport snapshot (`root`) as one
  opaque screen while the named nav bar, action bar and Back button hold
  still. The old screen is captured exactly where it was scrolled; the new
  screen's scroll is set inside the update. Never scroll before
  `startViewTransition`, and keep `mix-blend-mode: normal` on the root images,
  or the two screens show through each other.
- The live preview (`QuotePreviewCard`) stays a single `StructurePreview`
  instance. On phones it is mounted early, hidden in the collapsed card with a
  stand-in storage shed, so three.js downloads and compiles its shaders before
  a building is chosen; it never reports the stand-in's doors and windows. It
  shimmers until its first frame, renders on demand, and docks as a
  picture-in-picture tile while scrolling steps 1–2.
- No step opens a location dialog. The browser asks for location only when the
  customer taps "Use Current Location" inside the Build Location field, on
  every screen size (`requestCurrentLocation` in
  `src/lib/useQuoteDeliveryPrefill.ts`). The rounded position is reverse
  geocoded with BigDataCloud's client endpoint (`REVERSE_GEOCODE_ENDPOINT`,
  `https://api-bdc.io`), whose origin must stay in the CSP `connect-src` in
  `next.config.ts`; `securityHeaders.test.ts` checks this. A denied permission,
  a failed lookup, or no answer within 20 seconds shows a message under the
  Build Location fields asking the customer to type the address or ZIP.
- Haptics (`src/lib/haptics.ts`) and motion are decorative and no-ops without a
  coarse pointer or when reduced motion is requested.

## Quote SMS Consent

- The contact step renders one SMS checkbox. It is unchecked by default and
  required for the online estimate (consent v4). It covers quote-related texts
  only: the quote request, scheduling, and project updates. It does not collect
  promotional consent, and its copy names a tap-to-call phone alternative for
  people who prefer not to receive texts.
- The client blocks Get Quote until the box is checked, and `/api/quote`
  enforces the same rule (see Submission Lifecycle).
- `src/lib/smsConsent.ts` owns the exact displayed and recorded copy and its
  version. Do not copy consent text into docs or components. The checkbox
  label must read exactly as the recorded text, which the quote page tests pin,
  so a wording change means a new version in that file.
- `docs/quote-sms-consent.md` owns consent behavior, recorded proof, and
  cached-client handling. Registration copy lives in
  `docs/sms-a2p-campaign-registration.md`.

## Submission Lifecycle

- `/api/quote` requires affirmative quote SMS consent and rejects a missing or
  declined opt-in before pricing or persistence. Website submissions also
  require a valid US phone number before persistence so quote alert recipients
  have a direct callback number.
- Browser mileage is never authoritative pricing input. The current client does
  not submit a delivery radius, and the server ignores the legacy radius field
  when older clients send it. Address and ZIP remain useful planning inputs.
- Successful responses are explicitly typed as a `build_subtotal`; delivery has
  status `pending_verification` and `includedInTotal: false`. The same status is
  persisted with pricing so customer and staff views do not imply a verified
  zero-mile or zero-dollar delivery charge.
- The current client sends `smsConsentOptIn`, `smsConsentTextVersion` (the v4
  version from `smsConsent.ts`), and `smsMarketingConsentOptIn: false`. The
  server rejects unknown versions and any versioned request that also carries
  `smsUnifiedConsentOptIn` or a marketing opt-in.
- The server keeps separate transactional and marketing consent proof records
  for CRM compatibility. For current submissions, the transactional record
  stores the exact quote-only copy, version, timestamp, source, page URL, and
  available request metadata; the marketing record is `not_opted_in` with no
  consent text or version.
- Cached clients: affirmative legacy payloads are still accepted and recorded
  with the copy and version those pages displayed. That covers v3 pages opened
  before the v4 release, the May two-field payload (quote consent plus a
  separate optional marketing choice), and the July `smsUnifiedConsentOptIn`
  payload. Unified copy included marketing, so a legacy unified opt-in still
  records both transactional and marketing proof with that text. Historical
  consent records are never rewritten. This legacy parsing is intentional;
  removing it would turn submissions from still-open older pages into `400`s.
- `/api/quote` persists validated, server-priced quotes to Convex and Convex handles internal Twilio SMS and Zoho email fan-out.
- The route reads JSON through an actual 32 KiB byte limit rather than trusting
  `Content-Length`, rejects control/bidirectional formatting characters, checks
  `Origin` and Fetch Metadata when browsers provide them, and includes a hidden
  honeypot field. Vercel-owned client IP metadata is normalized by IPv4 address or
  IPv6 `/64` before the bounded local and shared IP limits are checked.
- Rate-limit scopes are intentionally layered: IP `10/min`, session `8/15min`,
  and atomic Convex create quotas for contact, short-window tenant/global, and
  daily tenant/global traffic. The browser session ID is duplicate protection,
  not a trusted identity; production edge bot/WAF and server-verified challenge
  controls remain required for distributed abuse. Convex quota errors return a
  structured retry time that the public route maps to `429 Retry-After`.
- The public request contract accepts optional `visualPlacement` metadata from
  the quote-page preview. The server treats the quote inputs as authoritative,
  sanitizes placement against the validated size/door/window selections, and
  derives deterministic defaults whenever placement is missing or mismatched.
- In the same Convex transaction, the quote mutation writes `quoteRequests`
  plus a deterministic `crmQuoteSyncOutbox` row and schedules three independent
  jobs: the existing SMS alert, the existing email alert, and an asynchronous
  CRM intake delivery. CRM availability never changes the public quote response
  or the two existing alert jobs.
- Every saved quote alerts staff; customers comparing options are hot leads.
  Alerts are labeled by lead history (`convex/quoteLeadHistory.ts`): earlier
  quotes from the same tenant and phone in the last 30 days make it
  `SAME LEAD, OPTION n` with a `Before:` line (previous build and price),
  otherwise `NEW LEAD`. A Ready to schedule tap sends its own
  `READY TO SCHEDULE` alert. `describeQuoteAlert` in `convex/notificationText.ts`
  owns the SMS and email labels.
- The source mutation does not directly create CRM leads, `leadQuotes`, shed
  quote module rows, activity rows, push events, messages, calls, or intake
  records. The CRM receiver owns those projections and deduplicates deliveries
  by `shed210:quote:<publicId>`.
- CRM delivery is off unless Convex `SHED_CRM_SYNC_ENABLED=true`. Retryable
  network, `429`, and `5xx` failures, plus configuration failures (`401`/`403`
  intake-key rejections and `404`/`405` missing receiver routes), use 1 minute,
  5 minute, 30 minute, 2 hour, and 12 hour delays. Payload rejections (`400`,
  `409`, `413`, `422` and other `4xx`) and exhausted retries are dead-lettered
  for internal operator replay, and each dead letter logs
  `CRM quote sync dead-lettered` with ids and status only. A bounded minute
  cron leaves the kill switch authoritative while automatically resuming
  pending/due work after re-enable and recovering processing attempts whose
  five-minute lease expired.
- Historical quote enqueue is a separate internal operator path documented in
  `docs/crm-quote-historical-backfill.md`. It is bounded to ten rows, requires
  an exact remaining count and cutoff, stays off unless
  `SHED_CRM_BACKFILL_ENABLED=true`, and probes receiver capability before any
  write. Historical batches schedule only the existing CRM delivery action.
- This repo no longer serves `/admin/*`; those paths should fall through to the
  normal site 404. Email alerts include an `Open CRM` link built from Convex
  `FRONTIER_PIXEL_CRM_ADMIN_URL` plus the quote public id and Convex quote row
  id for handoff.
- `src/lib/useQuoteSubmission.ts` owns:
  - payload submission
  - loading/error/success state
  - stale request protection
- Submitted quote results are ephemeral client state and are not persisted locally.

## Future Visual Overhaul

- The quote form remains the source of truth for the 3D preview. The preview
  is display-only (`editMode={false}`): it reads derived doors/windows and
  overlay metadata from `src/lib/quoteVisualPlacement.ts`, and customers cannot
  drag or add doors and windows. The derived placement is submitted as
  optional `visualPlacement` and sanitized server-side before persistence.
- Keep new UI work inside `src/components/quote/` and leave orchestration in `useQuoteFlow`.
- If multi-quote comparison ships later, extend the result model in the hook first, then layer UI on top.
