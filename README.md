# Shed210 Production Site

Marketing site and quote calculator for Shed210, built with Next.js, TypeScript,
the App Router, and Convex.

## Project Layout

- `src/app`: route segments, page metadata, sitemap/robots, and the quote API route
- `src/components`: page sections and client UI, including the multi-step quote form
- `src/lib`: business logic for pricing, quote persistence, content loading, SEO, analytics, and utilities
- `src/articles`: Markdown and MDX content for the news section
- `docs`: operational docs for pricing rules, quote schema, and article authoring
- `public`: static images, icons, and gallery assets

A short orientation doc lives at [`docs/codebase-map.md`](docs/codebase-map.md).
Convex migration history and run commands live at
[`docs/convex-migrations.md`](docs/convex-migrations.md).

## Getting Started

Install dependencies and create a local env file:

```bash
pnpm install
cp .env.local.example .env.local
```

Set these values in `.env.local`:

- `NEXT_PUBLIC_CONVEX_URL`
- `CONVEX_QUOTE_WRITE_KEY`
- `CONVEX_QUOTE_PRICING_READ_KEY` optional during the Shed pricing-key split;
  when present it is preferred over the write key for local Shed pricing reads
- `QUOTE_PRICING_SOURCE` (`shed_convex` locally; use `frontier_pixel_crm` only
  after the CRM publication rollout is ready)
- `FRONTIER_PIXEL_CRM_CONVEX_URL` pinned to
  `https://youthful-horse-290.convex.cloud`; this server-only URL is required
  for published project reads and is also used when CRM quote pricing is selected
- `CRM_PROJECT_IMAGES_V3_REQUIRED=false` during the derivative rollout. Set it
  to `true` only after the CRM backfill is complete; required mode disables
  V2/V1 image fallbacks and limits Next Image upstream responses to 3 MB.
- `FRONTIER_PIXEL_CRM_QUOTE_PRICING_KEY` matching the CRM deployment's
  dedicated `SHED_QUOTE_PRICING_READ_KEY` when CRM pricing is selected
- `NEXT_PUBLIC_SITE_URL` (optional, but recommended for canonical URLs and production host redirects)
- `GOOGLE_PLACES_API_KEY` (optional server-only key for live Google reviews on `/gallery`)
- `NEXT_PUBLIC_HERO_VIDEO_WEBM_SRC` and `NEXT_PUBLIC_HERO_VIDEO_MP4_SRC` (optional paired overrides for the decorative home hero loop)
- `NEXT_PUBLIC_HERO_FULL_VIDEO_SRC` (optional MP4 override for the click-open full build video)
- `NEXT_PUBLIC_HERO_VIDEO_SRC` (legacy single-source override; prefer the paired variables)

Live Google review setup, API restrictions, display behavior, and cost notes live in
[`docs/google-reviews.md`](docs/google-reviews.md).

Convex handles quote storage plus quote alert SMS/email notifications. Configure
these values in the target Convex deployment:

- `CONVEX_QUOTE_WRITE_KEY` with the same value used by Next.js
- `CONVEX_QUOTE_PRICING_READ_KEY` matching Vercel when Shed pricing is used;
  keep `CONVEX_PRICING_ALLOW_WRITE_KEY_FALLBACK=true` only during the
  compatible rollout, then set it to `false`
- `FRONTIER_PIXEL_CRM_ADMIN_URL` with the external CRM admin base URL used in quote alert email handoff links
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `QUOTE_NOTIFICATION_EMAIL_RECIPIENTS` optional comma-separated email alert recipients
- `ZOHO_CLIENT_ID`
- `ZOHO_CLIENT_SECRET`
- `ZOHO_REFRESH_TOKEN`
- `ZOHO_MAIL_ACCOUNT_ID`
- `ZOHO_FROM_ADDRESS`
- `SHED_CRM_SYNC_ENABLED` set to `true` only when live CRM delivery should run
- `FRONTIER_PIXEL_CRM_INTAKE_URL` exact approved receiver URL: `https://youthful-horse-290.convex.site/api/intake/shed-quote`
- `FRONTIER_PIXEL_CRM_INTAKE_KEY` bearer key mapped to the CRM `shed210` tenant
- `SHED_CRM_REQUIRE_BOUND_ACKNOWLEDGEMENT` remains `false` until the receiver
  echoes all three source identifiers documented in
  [`docs/quotes-table.md`](docs/quotes-table.md); only successes verified after
  this is enabled carry the provenance required for source-quote retention
- `QUOTE_DATA_RETENTION_DAYS` optional whole days from 30-3650; leaving it
  unset disables source-quote deletion

The CRM outbox recovery cron runs every minute but performs no work while the
kill switch is off. The sender refuses non-HTTPS, alternate-host, credentialed,
redirected, or otherwise altered receiver URLs before claiming an outbox row.
The quote-retention cron is also inert unless its policy is explicitly set, and
it excludes outboxes without strict source-identifier acknowledgement
provenance.
Legacy deployment retirement and export safeguards are documented in
[`docs/legacy-convex-data-retirement.md`](docs/legacy-convex-data-retirement.md).
Every CRM dead letter writes a `CRM quote sync dead-lettered` line to the
Convex logs with the outbox and quote ids, attempt, HTTP status, and error (no
contact data); a rejected intake key also logs
`CRM quote sync was rejected by the CRM intake` on each attempt. Replay a
reviewed dead letter through the internal operator mutation (replace the id and
target the intended deployment):

```bash
pnpm exec convex run --prod crmQuoteSync:replayDeadLetter '{"outboxId":"<crmQuoteSyncOutbox id>"}'
```

Published project cards on service-area pages, the filterable `/gallery`, and
eligible `/projects/[citySlug]/[slug]` detail pages are read server-side from
the Frontier Pixel CRM deployment. The site probes derivative-only V3 queries
first, then V2 and V1 only while `CRM_PROJECT_IMAGES_V3_REQUIRED` is false.
List pages receive one thumbnail cover plus `photoCount`; only a project detail
read receives the full gallery. These reads never use or fall back to the
website's `NEXT_PUBLIC_CONVEX_URL`, which remains the separate quote backend.
Published project pages and service-area pages with project proof are
regenerated at most once per hour, and a failed regeneration throws so Next.js
can continue serving the last successful page rather than replacing project
proof with empty content.

Quote lead SMS recipients are managed in the Convex `notificationRecipients` table.
This repo no longer serves `/admin/*`; those paths should fall through to the
normal site 404. Access the separate Frontier Pixel CRM directly for admin work.
Run `pnpm exec convex dev` once to link the project and regenerate Convex's
typed `_generated` helpers after schema/function changes.
For schema changes that need data backfills or cleanup, use the Convex
migrations component and record the rollout in `docs/convex-migrations.md`.

Vercel production and preview builds are configured in `vercel.json` to run
`pnpm exec convex deploy --cmd 'pnpm build' --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL`
when `VERCEL_ENV` is `production` or `preview`. Set Vercel Production
`CONVEX_DEPLOY_KEY` to the Convex production deploy key. Set Vercel Preview
`CONVEX_DEPLOY_KEY` to a Convex preview deploy key so each PR preview gets its
own temporary Convex backend instead of sharing the dev deployment. Vercel
Preview also needs `CONVEX_QUOTE_WRITE_KEY` and any other non-Convex app env
vars used at runtime.

Convex preview deployments are fresh backends. Configure project default
environment variables for preview deployments in Convex before relying on
quote submissions in Vercel previews: at minimum `CONVEX_QUOTE_WRITE_KEY`,
`FRONTIER_PIXEL_CRM_ADMIN_URL`, Twilio SMS env vars, Zoho send env vars, and
`QUOTE_NOTIFICATION_EMAIL_RECIPIENTS` if preview email alerts should send.
Use a separate non-production Twilio configuration if preview SMS should send
real messages.

Start the development server:

```bash
pnpm dev
```

Then open `http://localhost:3000`.

The home hero defaults to paired 720p background files at `public/hero-background.webm` and `public/hero-background.mp4`. `public/herobackground.webp` remains the priority first-paint media and exact poster fallback. The decorative loop is attached only after the poster and page load, then paused outside the viewport or when reduced motion/data-saving constraints apply. The separate Watch action lazy-mounts the self-hosted `public/shed-build-day.mp4` with native playback controls in a lightbox. See `docs/home-hero-video.md` for override and encoding details.

## Common Commands

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm test
pnpm new:article "My New Article"
```

## How The Quote Flow Works

1. The quote page renders at `src/app/quote/page.tsx`.
2. The multi-step client flow lives in `src/components/QuotePageClient.tsx`.
3. Submissions POST to `src/app/api/quote/route.ts`.
4. The API reads one verified pricing source, then calculates server-side in
   `src/lib/pricing/calculateQuote.ts`. It returns `503` without saving or
   notifying when the selected source cannot provide current pricing.
5. Validated quote payloads are persisted to Convex through `src/lib/quotePersistence.ts`.
6. Convex schedules the existing Twilio SMS and Zoho email alerts to configured recipients.
7. The same transaction creates a durable CRM outbox row and schedules an independent, kill-switched receiver delivery.
8. Convex quote email alerts include Frontier Pixel CRM handoff links; this repo does not serve `/admin/*` or directly create CRM leads.

If you change quote behavior, review:

- [`docs/pricing-rules.md`](docs/pricing-rules.md)
- [`docs/quote-pricing-operations.md`](docs/quote-pricing-operations.md)
- [`docs/quotes-table.md`](docs/quotes-table.md)

## Content Authoring

Articles are stored in `src/articles` and loaded by `src/lib/articles.ts`.
Use the article scaffold script to create new content:

```bash
pnpm new:article "My New Article" --tags tips,backyard
```

Authoring notes live in [`docs/authoring.md`](docs/authoring.md).

## Notes

- MDX is enabled through `@next/mdx`, so `.md` and `.mdx` files can be used in the content pipeline.
- The app targets modern browsers only, as defined by `browserslist` in `package.json`.
- Production host/protocol redirects are enforced by `src/proxy.ts` for production deployments; Vercel preview deployments stay on their preview host.
- `pnpm` is the preferred package manager for this repo.
