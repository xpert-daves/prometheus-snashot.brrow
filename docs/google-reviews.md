# Live Google reviews

## Overview

`/gallery` prerenders the project gallery and a complete Google profile fallback.
After hydration, the browser requests the current rating, rating count, and review
selection from the same-origin `/api/google-reviews` route. That route calls Places
API (New) only on the server, so Google cannot delay or break the crawlable page HTML.

The homepage stays statically renderable. Its hero initially shows a stable live-review
fallback, then requests only `rating` and `userRatingCount` from a same-origin route
after the browser load event and an idle callback. The Google request therefore does
not delay the initial HTML, hero image, or primary call to action.

Shed210's current public identifiers are centralized in `src/lib/contact.ts`:

- Profile link: `https://www.google.com/maps/place/?q=place_id:ChIJueBVkBv3XIYR6eSUXgDTEv8`
- Place ID: `ChIJueBVkBv3XIYR6eSUXgDTEv8`

Place IDs are public identifiers. The API key is a secret and must never be committed
or exposed through a `NEXT_PUBLIC_*` variable.

## Google Cloud setup

1. Select or create a billed Google Cloud project.
2. Enable **Places API (New)**.
3. Create a dedicated server key and restrict its API access to **Places API (New)**.
4. Add an IP application restriction only when the deployment has stable outbound IPs.
5. Set `GOOGLE_PLACES_API_KEY` in Vercel Production and Preview, and in `.env.local`
   when live local review testing is needed.
6. Open `/gallery` and confirm the live rating, count, reviewer attribution, review
   source links, and Google Maps attribution.

If the key is absent, invalid, over quota, or Google is unavailable, the page keeps
working and links directly to the current Google profile without showing stale review
figures.

## Data and display rules

- The Place Details field mask requests only `rating`, `userRatingCount`, `reviews`,
  `googleMapsLinks`, and `attributions`.
- Google returns at most five reviews and selects/orders them by relevance. The page
  discloses that ordering and must not describe the cards as the newest reviews.
- Review text, ratings, counts, authors, and photos are requested with `cache: 'no-store'`.
  Do not persist them in Convex, a database, a static build, or a cross-request cache.
- The homepage summary route, full review route, and browser requests are explicitly
  `no-store`.
  Google Maps Platform terms do not permit a daily ISR, CDN, database, browser, or
  stale-while-revalidate cache for the rating or rating count. Only the Place ID is
  stored long-term.
- Concurrent requests for the same field set are coalesced only while the Google
  request is in flight. A summary request may also await an already-running full
  details request. The settled Google response is immediately released and is not
  retained as a content cache.
- Failed upstream requests activate an in-memory exponential retry backoff from 5
  to 60 seconds. The backoff stores only failure timing, never Places content.
  During backoff the routes return `503` with `Retry-After` and do not call Google.
- Reviewer names, available profile photos, author links, original-review links, Google
  Maps attribution, returned provider attributions, and report links stay visible.
- Do not add `Review` or `AggregateRating` JSON-LD for Shed210's own reviews. The repo's
  local SEO policy intentionally excludes self-serving review schema.

## Cost control

The `reviews` field uses a higher-tier Place Details SKU. Review the current Google Maps
Platform price sheet, set a quota and billing alerts, and monitor `/gallery` traffic.
Every hydrated `/gallery` visit can create a billable Place Details Enterprise +
Atmosphere request because review content is not stored. Each deferred homepage summary
can create a Place Details Enterprise request; its field mask excludes the higher-tier
`reviews` field. The Next routes add bounded best-effort per-instance/per-IP limits
of 12 full requests and 30 summary requests per minute, with IPv6 clients grouped by
`/64`; responses remain `private, no-store`. These local limits and in-flight
coalescing reduce bursts but cannot stop a distributed attack across serverless
instances. Keep API quotas and billing alerts configured for both traffic paths and
apply Vercel Firewall/WAF limits to `/api/google-reviews` and
`/api/google-reviews/summary` so distributed direct traffic cannot exhaust the quota.

Official references:

- https://developers.google.com/maps/documentation/places/web-service/place-details
- https://developers.google.com/maps/documentation/places/web-service/policies
- https://developers.google.com/maps/api-security-best-practices
- https://developers.google.com/maps/billing-and-pricing/pricing
