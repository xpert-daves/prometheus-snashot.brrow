# Public content cache refresh

The homepage and contact page use a one-hour ISR fallback. Other public ISR
pages retain their existing hourly interval. The CRM notifies this website when
published projects, project photos, city availability, or public access change.
`POST /api/revalidate` marks affected pages stale; their next visit regenerates
them. Existing browser tabs are not pushed an update.

## Callback contract

Use `Authorization: Bearer <secret>` and `Content-Type: application/json`.
The dedicated `SHED210_SITE_REVALIDATION_SECRET` must match the CRM Convex
deployment and contain at least 32 characters. Keep it server-only and separate
from quote, pricing and intake credentials. Missing/short configuration disables
the receiver with HTTP 503; missing/incorrect authentication returns 401.

Project event:

```json
{"version":1,"tenantSlug":"shed210","kind":"projects","projectPaths":["/projects/san-antonio/old-slug","/projects/luling/new-slug"]}
```

Include old and new canonical paths for moves, slug changes and unpublishing.
The receiver accepts 1-50 paths, validates both slugs, rejects additional fields
and limits the request body to 32 KiB. It never accepts arbitrary cache paths,
tags, layouts, origins or tenant names.

City/public-access event:

```json
{"version":1,"tenantSlug":"shed210","kind":"cities"}
```

Both event types invalidate the homepage, buildings/gallery lists, service-area
index, city page pattern and sitemap. A project event invalidates its exact
project URLs; a city event also invalidates contact locations and all project
detail pages because their visibility and metadata depend on city availability.
Repeated delivery is safe. An invalidation failure returns 503 so the CRM can
retry. The hourly fallback covers missed notifications.

## Rollout and verification

1. Deploy this receiver before enabling the CRM sender. Validate with an
   isolated preview and a separate random preview secret.
2. Configure `SHED210_SITE_REVALIDATION_SECRET` in the website environment and
   the corresponding CRM Convex environment. Configure the sender's
   `SHED210_SITE_REVALIDATION_URL` with the exact HTTPS endpoint. Production is
   `https://www.shed210.com/api/revalidate`; avoid the apex host because the
   website redirects it and the sender intentionally rejects redirects.
3. Keep development/preview callbacks pointed at isolated previews, never at
   the production receiver. Sender configuration belongs in CRM Convex, not
   the CRM Next.js frontend or the Shed210 quote Convex deployment.
4. On the preview, warm a public page, update a published fixture, deliver the
   event and verify new content on the next visit. Check old URLs after moves
   and unpublishing, affected city/contact pages and sitemap, unauthorized
   requests, other-tenant isolation and bounded callback retries.
5. Compare two regenerated homepage HTML responses with unchanged source data:
   Sentry `sentry-trace` and `baggage` metadata must be absent, while error
   instrumentation, source maps and the Sentry tunnel remain configured.
6. Check V3 thumbnails on desktop/mobile: generated thumbnails (at most 800px)
   share one same-origin optimizer URL at the allowed width 828 and quality 60.
   The outer image skips further optimization to prevent nested optimizer URLs.
   This creates one canonical width/quality variant per negotiated format
   (AVIF/WebP), not zero transformations. Keeping the same-origin optimizer
   preserves public CDN caching and image indexability: direct Convex storage
   responses carry a `noindex` header and private caching. Legacy originals and
   larger gallery photos keep responsive image optimization. Track ISR units
   and image transformations after rollout; no particular reduction is guaranteed.

If that canonical optimizer request fails (including an exhausted transformation
quota), the client switches once to the existing bounded V3 thumbnail WebP,
served directly without another optimizer request. A second image failure does
not cause a retry loop, and changing photos restores the normal primary source.
The initial HTML and normal successful image requests keep the indexable
same-origin optimizer URL. Only this failure fallback inherits Convex storage's
`noindex` and private caching; it prioritizes showing the photo during optimizer
outages. Legacy originals, incomplete derivative metadata, and full gallery
images never receive this direct-storage fallback.

The Sentry metadata filter runs after `withSentryConfig` because the SDK injects
trace fields into Next's `experimental.clientTraceMetadata` even when tracing
sampling is zero. Error reporting is retained. No database/schema migration is
needed for the website changes.
