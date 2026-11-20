# SEO Phase 1 validation

This file records the July 2026 Phase 1 work. For the current Search Console
assessment, indexing policy, and release checks, see
[the September 7 assessment](search-console-2026-09-07.md).

## Current sitemap and crawl checks

The sitemap includes public static routes, articles, published CRM projects, all
curated service-area pages, and CRM-only cities that have published projects.
The live sitemap contained 65 URLs on September 7; counts can change when CRM
projects or cities are published. It does not use the historical two-city gate.

`pnpm crawl:site -- <base-url>` now checks every sitemap page for homepage
reachability within two clicks, a successful HTML response without redirects,
a matching canonical URL, and absence of HTML `noindex` directives. The existing
asset and priority-link checks remain; Universal City is also a priority page.
When testing a local build, canonical URLs are compared to its sitemap's public
URLs. Preview response headers may intentionally prevent indexing; verify the
production response headers separately before requesting indexing.

Use `pnpm crawl:site -- <base-url> --indexing-only` for a focused sitemap audit.
This mode skips assets, filtered gallery variants, and URLs outside the sitemap.
The default command still checks those resources. Request timeouts cover response
bodies as well as headers.

Curated content can set `contentLastModified` for a real page edit. The registry
uses the later of that date and its CRM city update, so editing Universal City
does not falsely refresh every city in the sitemap.

## Historical sitemap evidence bar

The sitemap contains 12 canonical URLs: eight static public routes, two articles,
and only the two city routes with exact-city portfolio evidence (`San Antonio` and
`Schertz`). City routes remain live and keep their static params, but they stay out
of the sitemap until `getPortfolioProjectsForCity(area.city)` returns a real project.

The live baseline captured on 2026-07-15 contains 23 sitemap URLs, all on the
canonical `https://www.shed210.com` host. The 12-URL count is the expected result
after this evidence gate is deployed.

## Historical built-site crawl

Build and start the production server, then run the crawler from another terminal:

```bash
pnpm build
pnpm start
pnpm crawl:site -- http://localhost:3000
```

`SITE_CRAWL_BASE_URL` can supply the base URL instead of the positional argument.
The dependency-free crawler starts at `/`, follows same-origin anchors, checks linked
pages and referenced same-origin assets, and enforces the Phase 1 mesh for these URLs:

- `/service-area/san-antonio`
- `/service-area`
- `/our-work`
- `/news`
- `/news/san-antonio-shed-cost-guide`
- `/news/sanantonio_shed_guide`

Each priority URL must be within two homepage clicks and have descriptive links from
at least three distinct source pages. Empty or generic anchors such as `Learn more`
do not count.

The local production build completed this check on 2026-07-15: 23 page URLs and 164
same-origin assets passed, and every priority URL was one click from `/` with
descriptive links from 22 distinct source pages.

## External validation and remaining gates

External checks completed on 2026-07-15:

- Search Console reported 2.41K crawl requests over 90 days, including 70 `404`
  requests (3%). The exported table contained 66 examples: 22 `/favicon.ico`, 15
  `/home`, 10 each for the two Apple app-association probes, three each for the
  removed `/logo.svg` and `/shed210icon.svg`, two stale deployment assets, and one
  intentional `/admin` request. This change adds a real multi-size `/favicon.ico`
  and redirects exact `/home` requests to `/` in the same hop as host/protocol
  canonicalization. Apple probes, stale build assets, removed legacy logos, and
  `/admin` remain normal `404` responses.
- Mobile-only Search Console performance for the same three-month window was 162
  clicks, 3.25K impressions, 5% CTR, and average position 9.2. The highest-click
  nonbranded local queries were `shed builders san antonio` (4 clicks / 31
  impressions), `sheds for sale san antonio` (3 / 58), and `sheds san antonio`
  (2 / 29).
- Live incognito Pixel 7 searches located in San Antonio showed Shed210 first for
  the branded `shed 210` query, but not on page one for those three nonbranded
  local queries. The evidence supports testing the proposed title `San Antonio
  Shed Builders | Instant Pricing | Shed210` and a buying-intent description, but
  that one-page metadata change remains gated on Redacted Author's explicit approval.
- Rich Results code-mode validation found three valid items: Breadcrumbs, Local
  Business, and Organization. The Local Business item had only optional
  `priceRange` and `address` warnings. Preview URL mode fetched successfully but
  was correctly excluded by Vercel's preview `X-Robots-Tag: noindex` header.
- Vercel has a live firewall rule for `/api/google-reviews*`: 10 requests per IP
  per 60 seconds, followed by a `403` response.

Still gated:

- Do not request indexing in Search Console until all Phase 1 work is deployed.
  After release, monitor the production `404` share toward the requested sub-1%
  target.
- Confirm `NEXT_PUBLIC_SITE_URL=https://www.shed210.com` in production.
- Re-run production URL Inspection and Rich Results checks after deployment, and
  verify served project images contain no GPS EXIF data.
- Do not merge the proposed homepage metadata rewrite without Redacted Author's explicit
  confirmation of the live mobile SERP evidence.

The 2026-07-15 production redirect baseline is:

- `http://shed210.com` -> 308 `https://shed210.com` -> 308 `https://www.shed210.com`
- `https://shed210.com` -> 308 `https://www.shed210.com`
- `http://www.shed210.com` -> 308 `https://www.shed210.com`
- `https://www.shed210.com` -> 200

Reaching the requested one-hop 301 behavior requires Vercel domain configuration
after merge. Application middleware cannot eliminate the HTTP apex redirect that
happens before the request reaches Next.js.

ExifTool 13.59 found zero GPS or EXIF tags on all four JPEGs currently under
`public/portfolio`. `pnpm prebuild` losslessly removes JPEG EXIF/XMP, IPTC, and
comment segments before every build; `pnpm check:project-images` verifies the
source assets are already clean without rewriting them.

## Phase 2 remains separate

GA4 is already loaded, but the requested exact conversion events are not complete.
CRM lead attribution requires coordinated work in the separate CRM backend, and the
mobile/desktop Lighthouse reports have not been captured. Those measurement tasks
ship separately from this crawl-priority and sitemap change.
