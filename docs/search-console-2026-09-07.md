# Shed210 Search Console assessment — September 7, 2026

Shed210's main opportunity is broader visibility beyond the homepage, with a
smaller, measurable mobile download problem. The evidence does not show a
sitewide crawl block, HTTPS failure, or Google penalty. This PR improves mobile
delivery and the one crawled-but-unindexed customer page, and adds crawl checks
covering the entire sitemap. Google indexing and ranking outcomes still require
post-release observation.

## Search performance

Source: the authenticated Chrome [Web performance report](https://search.google.com/search-console/performance/search-analytics?resource_id=sc-domain%3Ashed210.com&num_of_days=28),
August 9–September 5, 2026, all devices and countries. The report said its latest
update was six hours earlier at inspection.

| Measure | Last 28 days |
| --- | ---: |
| Clicks | 85 |
| Impressions (rounded by Google) | 3.49K |
| CTR | 2.4% |
| Average position | 23.5 |
| Homepage clicks | 68 (80% of total) |
| Homepage impressions | 2,537 |

The three-month report, June 6–September 5, showed 201 clicks, 8.66K impressions,
2.3% CTR, and position 17.3. These overlapping, unequal windows are context,
not a before/after comparison.

Selected query opportunities in the 28-day report:

| Query | Clicks | Impressions | Average position |
| --- | ---: | ---: | ---: |
| shed 210 | 15 | 20 | 1.1 |
| shed builder | 0 | 387 | 4.4 |
| custom sheds | 0 | 141 | 80.2 |
| build on site shed service | 0 | 99 | 39.2 |
| storage buildings near me | 0 | 63 | 23.5 |
| storage sheds san antonio | 0 | 36 | 26.0 |
| shed builders san antonio | 1 | 15 | 21.9 |

These are diagnostic slices, not an additive breakdown of total traffic. Search
Console can omit anonymized query rows. Low click counts and broad queries do
not establish that a title rewrite would improve local qualified traffic. The
current homepage title and conversion copy remain appropriate; measure local,
nonbranded queries and quote conversions after release before attributing gains.
This assessment does not include GA4 or CRM conversion data.

## Indexing: all four exclusions accounted for

Source: [Page indexing](https://search.google.com/search-console/index?resource_id=sc-domain%3Ashed210.com),
last updated September 3. Google reported 37 indexed and 35 unindexed URLs.

| Category | Count | Finding and disposition |
| --- | ---: | --- |
| Page with redirect | 4 | All verified: HTTP www, HTTP apex, HTTPS apex, and HTTPS apex `/contact` lead to their HTTPS/www pages with permanent 308 redirects and final HTTP 200. Keep these canonical redirects. |
| Not found (404) | 1 | A retired deployment's JavaScript chunk, not a customer page. Keep an honest 404; do not redirect missing scripts to HTML or block all `/_next/` resources. |
| Crawled, currently not indexed | 2 | Universal City's service-area page plus a font asset. Improve the city page with useful local information. The font is a rendering resource, not a search landing page. |
| Discovered, currently not indexed | 28 | 18 projects, five city pages, the service-area directory, three news URLs, and terms. All 65 live sitemap URLs returned HTTP 200 with matching canonicals and no HTML `noindex`. No code-level indexing block was reproduced. |

The obsolete script example was
`/_next/static/chunks/0le4n157divqb.js?dpl=dpl_xVgb86RtTVD8bNsJs1qXtr5Gduh8`
(last crawled September 2). The font example was
`/_next/static/immutable/media/85d221305b371308-s.p.1awwf8ewnhcz0.woff2`
(August 8). Universal City was crawled September 2.

HTTP apex still takes two permanent hops (HTTPS first, then www). This occurs
at Vercel's domain layer before the application; changing app redirects cannot
remove it. The other three examples take one hop. This is an optional hosting
optimization, not an indexing failure or a reason to change the canonical host.

The discovery category displays a historical validation pass on July 1 while
still listing 28 current examples. That badge is not evidence that these pages
are currently indexed. All examples showed no last-crawl date.

### Complete discovery backlog

All paths below use `https://www.shed210.com`:

- `/news`
- `/news/san-antonio-shed-cost-guide`
- `/news/sanantonio_shed_guide`
- `/projects/boerne/10x12x7-greenhouse-boerne`
- `/projects/boerne/10x12x8-storage-shed-boerne`
- `/projects/bulverde/6x-16-x9-side-utility-bulverde`
- `/projects/converse/8x8x6-custom-doggie-house-converse`
- `/projects/floresville/10x10x8-water-well-shed-floresville`
- `/projects/floresville/8x12-greenhouse-san-antonio`
- `/projects/hallettsville/8x12x7-deluxe-doggie-house-hallettsville`
- `/projects/karnes-city/6x6x7-water-well-shelter-karnes-city`
- `/projects/karnes-city/8x8x7-storage-shed-karnes-city`
- `/projects/lakehills/6x8x7-shed-lakehills`
- `/projects/luling/10x12-green-house-luling`
- `/projects/natalia/10x16x9-greenhouse-natalia`
- `/projects/san-antonio/10x12x8-storage-shed-san-antonio`
- `/projects/san-antonio/10x16-and-10x10-portable-buildings-san-antonio`
- `/projects/san-antonio/10x16x7-storage-shed-san-antonio`
- `/projects/san-antonio/12x16x9-heavy-duty-portable-building-san-antonio`
- `/projects/san-antonio/15x30x10-slanted-roof-utility-san-antonio`
- `/projects/san-antonio/8x8x7-storage-shed-san-antonio`
- `/service-area`
- `/service-area/boerne`
- `/service-area/cibolo`
- `/service-area/poteet`
- `/service-area/san-antonio`
- `/service-area/schertz`
- `/terms-and-conditions`

The [submitted sitemap](https://search.google.com/search-console/sitemaps?resource_id=sc-domain%3Ashed210.com)
was successful, last read September 3, with 65 discovered pages. The later local
build read fresh public CRM data and generated 67 URLs, adding the Centerpoint
city and project. That difference is content freshness, not two new pages
invented by this PR. Live sitemap data and the lagging Google report need not
match at every instant.

Google explains why valid exclusions and indexing delays should be assessed
individually in its [Page indexing guidance](https://support.google.com/webmasters/answer/7440203).

## Loading performance

The September 5 Core Web Vitals report had insufficient real-user data for both
mobile and desktop. This is an unavailable measurement, not a pass or failure.

[PageSpeed report](https://pagespeed.web.dev/analysis/https-www-shed210-com/nzp6txj99y?form_factor=mobile),
September 7 at 7:15 PM CDT, Lighthouse 13.4.1:

| Metric | Mobile, simulated slow 4G | Desktop |
| --- | ---: | ---: |
| Performance | 91 | 97 |
| Largest Contentful Paint | 3.5 s | 1.2 s |
| First Contentful Paint | 1.2 s | 0.3 s |
| Total Blocking Time | 70 ms | 80 ms |
| Cumulative Layout Shift | 0 | 0 |
| Accessibility / Best Practices / SEO | 100 / 100 / 100 | 100 / 100 / 100 |

The mobile run transferred 5,250 KiB. It included 1,930.0 KiB of MP4,
1,822.5 KiB of WebM, and a 310.3 KiB unoptimized hero poster in addition to the
51.1 KiB responsive hero image. The PR keeps decorative autoplay on eligible
desktop pointers only and disables it on 3G or slower connections. Mobile
visitors retain the optimized hero image and can explicitly open the full video.
The background video no longer requests the redundant raw poster; the optimized
image beneath it remains visible until playback starts.

These changes avoid approximately 4 MB of downloads seen in this mobile run.
They do not establish a new Lighthouse score or a field LCP result. Desktop
autoplay retains its native format fallback. Remaining lab diagnostics include
stylesheet blocking, framework compatibility code, third-party caching, and
unused JavaScript; the scores and source attribution should be reassessed after
deployment rather than disabling required styles, analytics, or compatibility
code solely to clear a warning.

## Content and technical changes

Universal City gains local permit and HOA references from the
[City permit page](https://universalcitytexas.gov/540/Permits) and
[Building/Permits FAQ](https://www.universalcitytexas.gov/faq.aspx?TID=27),
practical preparation steps, and a related cost guide. City-specific rules must
be confirmed for the actual property. No invented local projects, ratings,
addresses, or permit exemptions were added.

Only this edited city's content date advances to September 7. Newer CRM updates
still take precedence. The crawler now checks all sitemap pages for reachability,
canonical consistency, redirects, and HTML indexing directives, plus the
existing linked-asset checks. Universal City is included in the priority link
checks. Historical Phase 1 docs now distinguish the current policy from the
retired two-city sitemap proposal.

The crawler's `--indexing-only` mode audits sitemap routes without downloading
assets or traversing every gallery filter combination. Request deadlines now
cover response bodies too. A full asset crawl was stopped during this assessment;
it is not reported as passed.

## Other Google reports

- HTTPS: 28 HTTPS URLs, zero non-HTTPS URLs, no critical issues; updated September 5.
- Breadcrumbs: 23 valid items, zero invalid items; updated September 5.
- Manual actions: no issues detected.
- Security issues: no issues detected.

These report counts describe different populations and are not interchangeable.

## Validation and release follow-up

- Lint passed; 95 Jest suites / 734 tests passed on Node 22, including mobile video,
  reduced-motion, connection, viewport-change, and sitemap-date coverage.
- The focused live crawl passed for all 65 sitemap URLs: every page was within
  two homepage clicks, with matching canonicals and indexable HTML. Universal
  City had six descriptive source-page inlinks and was one homepage click away.
  Five in-memory CLI tests cover the passing case and rejected orphaned,
  redirected, wrong-canonical, and noindex project pages.
- Production build and TypeScript checks passed with Node 22.23.2 and Next 16.3.0.
- Generated HTML includes the new Universal City sources, its self-canonical,
  and indexable metadata. The built sitemap has the scoped content date.
- The homepage build retains the prioritized optimized image and emits no
  initial background video or raw poster request.
- This PR does not change Convex schema, data, quote pricing, or alerts.

After preview review and deployment, inspect the live Universal City page,
service-area directory, news guides, and representative projects in Search
Console. Use the live URL test to confirm fetch, rendering, and canonical
selection, then request indexing for the important changed pages. Recheck the
submitted sitemap and repeat PageSpeed on production. Compare the next complete
28-day window with August 9–September 5, separating homepage from other pages and
branded from local nonbranded queries. Do not claim indexing or traffic gains
until Google and conversion data confirm them. No indexing request or validation
submission was made before these changes are deployed.
