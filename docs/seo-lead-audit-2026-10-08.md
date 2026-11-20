# Shed210 SEO and lead-conversion audit — October 8, 2026

> The findings below are as written on October 8, 2026. For which action items
> have shipped, see [Status as of November 7, 2026](#status-as-of-november-7-2026).

The goal of this audit is more **qualified leads**: in-area buyers who request a
quote, call, or text about a building Shed210 actually builds. Raw traffic is a
means, not the target.

Sources, all read on October 8, 2026: Search Console (Sep 9–Oct 6 and 3-month
views, Page indexing, Sitemaps, URL Inspection), Google Business Profile
(May–Oct performance and profile settings), Vercel Web Analytics and Speed
Insights (30 days), Microsoft Clarity (30 days), the live site, and this repo at
`9c9ea4e`. **Not reviewed:** GA4 reports, Google Ads, and the CRM's lead
outcomes (qualified, won, revenue). Volumes are small (72 Google clicks and about
7 saved quotes a month), so treat single-month changes as noise unless they are
large.

Method: eight parallel audits (indexing, keyword targeting, local/GBP, content,
conversion, measurement, performance, competitors) produced 82 findings. 65 were
independently re-checked against the code, the live site, and the data; most held
up with corrections, which are applied below. The 17 conversion and performance
findings that missed an independent check were spot-checked by hand for every item
in the action plan. Numbers in `[brackets]` refer to the action plan.

## Bottom line

- **The site is technically sound.** All 73 sitemap URLs return 200 with
  self-canonicals, server-rendered content and no blocking directives. Nothing on
  the site prevents indexing. The constraints are elsewhere.
- **Two live compliance risks sit on the lead path.** The quote form requires
  SMS consent before showing a price, which conflicts with texting-provider rules
  and the registered opt-in description `[1]`. The `/review` page sends only
  5-star raters straight to Google, which Google's review policy prohibits `[2]`.
  Both are small code changes.
- **Most "top-3" positions are Business Profile visibility, not website
  rankings.** "sheds" (1.3) and "shed builder" (1.5) earn about 0% CTR. The
  organic gap is the "+ San Antonio" buyer queries at positions 13–22. The
  Business Profile `[4]` and a storage-shed page `[13]` are the levers.
- **Six core city pages have never been crawled** (San Antonio, Schertz, Cibolo,
  Boerne, Poteet, the hub). Google knows them from the sitemap and from internal
  links, but has not fetched them. The free first step, Request indexing, was
  deferred in July and September and apparently never done `[3]`.
- **On phones (61% of visitors), the site makes calling or texting hard and
  hides prices.** Call/Text only show at 1280px and wider, no sticky mobile CTA
  exists, and no price appears until a visitor gives contact details `[7][8]`.
- **GA4's "Request quote" conversion counts every `/quote` page view**, and it is
  linked to Google Ads `[5]`. First-party attribution in Convex/CRM does exist,
  but it groups landing pages into 7 categories and nothing joins source to
  outcome `[12]`.
- **Several trust claims need the owner's confirmation:** "No Payment Upfront" vs
  "no final payment until complete", "Financing Available" with nothing behind it,
  and "Licensed & insured" `[6]`.

## Where leads come from today

| Source | Window | Numbers |
| --- | --- | --- |
| Search Console, web | Sep 9–Oct 6 | 72 clicks, 3.27K impressions, 2.2% CTR, avg position 12.2 (Aug 9–Sep 5: 85 / 3.49K / 2.4% / 23.5) |
| ↳ homepage | same | 54 clicks, 2,045 impressions, pos 12.9 (75% of clicks) |
| ↳ visible queries | same | Only 13 of 72 clicks are tied to a visible query; the rest are anonymized |
| Google Business Profile | May–Oct | 3,508 profile views (~646/month), 854 searches, 175 interactions; monthly interactions ~50, 33, 36, 37, 29. Maps is only 8% of views |
| Vercel Analytics | 30 days | 207 visitors, 697 page views, 41% bounce; google.com 90, DuckDuckGo 9, Brave 7, ChatGPT 2; 61% mobile |
| Clarity | 30 days | 192 sessions, 124 users; homepage 179 visits → `/quote` 45 → 7 sessions with `quote_request_saved` |
| Convex / CRM saved quotes | — | Not reviewed. This is the source of truth for lead counts |

The average-position improvement (23.5 → 12.2) is mostly a change in query mix,
because the head terms counted at positions 1–2 are almost certainly local-pack
impressions. Report progress on local, non-brand queries (a regex such as
`san antonio|near me|\btx\b|seguin|boerne|new braunfels|schertz|cibolo|…`), not
on the sitewide average.

## Since the September audits

Improved:

- Indexed pages rose from 37 (Sep 3) to 44.
- Both San Antonio guides left the discovery backlog and now earn 545 impressions
  at positions 5.7 and 7.0. Two storage-shed project pages and Universal City also
  graduated.
- "shed builders san antonio" moved from 21.9 to 8.1 and is the top non-brand
  click query.
- The site's review count is live (4.8 / 42, matching GBP). The "39 reviews"
  Clarity recorded was an older value.

Still stuck:

- 24 of the 28 Sep 7 backlog URLs are still "Discovered – currently not indexed".
  Three newer projects have joined them (27 in total).
- URL Inspection on `/service-area/san-antonio` (Oct 8) shows referring pages `/`
  and `/quote` and the sitemap, but last crawl **N/A**. The pattern is consistent:
  5 of the 7 original February city URLs are stuck, while all 21 city pages added
  on or after Jul 11 were crawled and indexed. The stuck pages are not weaker (San
  Antonio has the most inlinks and the most unique text of any city page). Old URL
  scheduling is the likeliest explanation, which makes a manual request the right
  first move.
- The deferred follow-ups in `docs/search-console-2026-09-07.md:197-205` (inspect,
  request indexing, compare windows) have no recorded outcome.

## Prioritized action plan

| # | Action | Why it matters for leads | Effort | Owner | When |
| ---: | --- | --- | :---: | --- | --- |
| 1 | Make the quote's SMS checkbox optional, after confirming the CRM only auto-texts opted-in customers | Removes a required gate at the money step and a texting-registration risk | S | code | This week |
| 2 | Make the `/review` page ask every customer the same way | Protects the 4.8 / 42-review profile from a policy violation | S | code | This week |
| 3 | Check host health, then Request indexing for the core city and project pages | Free; the only untried lever for the six never-crawled pages | S | owner/agency | This week |
| 4 | Clean up the Business Profile: description, service areas, category, services, UTM link, hours, weekly photos/posts | The profile, not the site, wins "sheds" / "shed builder" searches | S | GBP | This week |
| 5 | Make GA4/Ads count saved quotes, not `/quote` page views | Today's conversion number is inflated, and Ads may optimize to it | S | measurement | This week |
| 6 | Get written answers from the owner on payment, financing, licensing, hours and warranty, then align all copy | Contradictory or unbacked claims cost trust at the decision point | S | owner | This week |
| 7 | Put Call / Text / Get price within reach on phones | 61% of visitors are mobile; Call/Text hidden below 1280px | S | code | 30 days |
| 8 | Show starting prices before the contact step | Lets buyers self-qualify on budget; every direct competitor shows prices | M | code | 30 days |
| 9 | Make the quote collect qualifying info: required build ZIP, optional timeline, next steps after the price | Screens out-of-area leads and speeds follow-up | M | code | 30 days |
| 10 | Homepage proof fixes: clickable rating, payment/warranty FAQs, video CTA, storage builds in "Latest builds" | Visitors tap badges that go nowhere; 0 of the 6 homepage builds are storage sheds | S | code | 30 days |
| 11 | Retarget the homepage title and copy to buyer terms ("shed builder", "storage sheds", metal roof/siding), with an honest "for sale" FAQ | The homepage holds 63% of impressions but misses the terms it ranks for | S | code | 30 days |
| 12 | Fix measurement plumbing: GA4 queue stub, Clarity step events and funnel, exact landing page on quotes, source on calls/texts, CRM outcome routine | Lets the owner see which pages and sources produce *qualified* leads | S–M | code + owner | 30 days |
| 13 | Build `/buildings/storage-sheds`, then greenhouse and water-well pages once indexing moves | The organic gap is "storage sheds/buildings san antonio" at 13–22 | M | code + content | 90 days |
| 14 | Stop auto-indexing template city pages for one-off distant jobs | Near-duplicate pages dilute the `/service-area/` set and invite out-of-area leads | S | code | 90 days |
| 15 | Turn project pages into proof: real build specifics, per-photo alt text, clean leaked notes | Thin, templated pages; internal notes visible to customers | M | content | 90 days |
| 16 | Publish an About / company-facts page | No page says who runs Shed210, since when, or what backs the warranty | M | content | 90 days |
| 17 | Citations and review velocity: Bing Places, Apple Business Connect, Yelp, BBB, Nextdoor; neutral ask to every customer | Almost no third-party presence; reviews drive Maps visibility | M | owner | 90 days |
| 18 | Strengthen core city pages with first-hand local proof; sharpen city, gallery and guide snippets | Local pages rank 5–10 with near-zero clicks | L | content | 90 days |
| 19 | Speed bundle: guide hero images, map tiles, 3D preview on phones, quote deep-link layout shift, bundle trims | Small, measured wins on mobile | S–M | code | 90 days |
| 20 | Hygiene: hydration error, footer city links, honest sitemap `lastmod`, one LocalBusiness node, weekly index-status check | Low impact individually; prevents drift | S | code | 90 days |

## Status as of November 7, 2026

Checked against `main` at `56d98ab`, merged PRs since `9c9ea4e` (#818 onward),
and the current code. Rows 13 and 20 were updated on November 8, 2026 after #849
merged and the business JSON-LD was reduced to one node. "Needs owner, unknown" means the work happens outside this
repo (Search Console, Business Profile, GA4/Ads, owner answers) and nothing in
the repo records whether it was done.

| # | Status | Evidence |
| ---: | --- | --- |
| 1 | Not started | The SMS checkbox is still `required` (`src/components/quote/QuoteDeliveryContactStep.tsx:314`), and `src/lib/quoteRoute.ts:171-177` still rejects quotes without consent. #842 left the box unchanged on purpose. Nothing records the CRM opt-in check. |
| 2 | Done | #826 (Oct 10) sends personal `/review/<code>` links straight to Google, and #842 (Nov 1) does the same for plain `/review` and deletes `ReviewExperience`. Every customer now gets the same Google link with no star step, so the change carries out item 2 rather than working against it. It differs from the plan in three ways, none of them rating-based: there is no optional private-feedback path, Android and desktop auto-redirect (iPhone gets a button), and only the `opened` event is sent (no `google_opened`). |
| 3 | Needs owner, unknown | No dated `docs/` note on crawl stats or Request indexing since Oct 8. |
| 4 | Needs owner, unknown | Business Profile work is outside the repo. |
| 5 | Needs owner, unknown | GA4/Ads admin work is outside the repo. Note that #690 (Oct 13) limits GA4 event parameters to `location` and `category` (`src/lib/analytics.ts:9`), so `quote_success` no longer carries `quoteId`. It can still be the key event, but the `quoteId` custom dimension would need #690 revisited. |
| 6 | Needs owner, unknown | Copy is unchanged: "No Payment Upfront" (`src/components/ValuePropsBar.tsx:14`) against "no final payment until complete" (homepage description), and "Licensed & insured" (`src/components/Footer.tsx:226`). #842 points the "Financing Available" chip at `/contact`, but no program backs it. Nov 8: How It Works no longer says "No hidden fees"; it was rewritten from David's texts with customers and now says site work, travel past 35 miles, and per-job add-ons are priced separately. |
| 7 | Done | #842 adds `MobileActionBar` (Call / Text / Instant Price) on phones after 200px of scrolling, everywhere except `/quote` and `/review`. #818 makes the hidden `FloatingCTA` inert. Business hours are still not shown; they wait on [6]. |
| 8 | Not started | No starting price on `/`, `/buildings` or `/quote` before the contact step. Homepage build cards (`src/components/PortfolioSection.tsx`) show no recorded price. |
| 9 | Partial | #848 removes the automatic location dialog (location is asked only from Use Current Location) and replaces the no-token "use Compare another option" text with "call or text David" plus a "Ready to schedule this build" button. Still open: the build ZIP is still optional, there is no timeline question, and there is no "what happens next" with a response window. |
| 10 | Partial | #842 links the rating to `/gallery#reviews` (not a new homepage reviews section) and removes hover-lift from cards that don't link. Still open: payment and warranty FAQ answers, CTAs in the build-video modal (still only Close), and storage builds in "Latest builds" (`src/lib/homepageGallery.ts` unchanged). |
| 11 | Partial | #842 changes the homepage title to "Shed Builder in San Antonio, TX \| Storage & Metal Sheds", with a matching description and hero intro that name storage and metal sheds. Still open: the "sheds for sale" FAQ and the building-types paragraph. |
| 12 | Partial | #818 loads the Google tag only in Vercel production. #842 sends quote step events (`quote_step_1_size`, `quote_step_2_materials`, `quote_step_3_contact`) to Clarity. Still open in code: the inline gtag stub (`src/components/GoogleTag.tsx` still loads the init script `lazyOnload`), removing Vercel `track()` (`src/lib/analytics.ts:43`), an exact landing path on quotes (still 7 categories), and a source on calls/texts (`sms:` links have no body). The Clarity funnel and CRM outcome routine need the owner; status unknown. |
| 13 | Not started | No `/buildings/*` routes, and the loafing-shed gallery link (`src/lib/buildingCatalog.ts`) is unchanged. #849 (merged Nov 8) adds JSON-LD to `/buildings` only. |
| 14 | Not started | `src/app/sitemap.ts` and `src/app/service-area/[city]/page.tsx` are unchanged since Oct 8. |
| 15 | Not started | Internal notes are still live, e.g. "The Facebook source used the spelling…" (`src/lib/serviceAreas.ts:944`) and the Shady Oaks "project source" copy (`:1037`, `:1074`). |
| 16 | Not started | No `/about` route. |
| 17 | Needs owner, unknown | Citations and review asks are outside the repo. |
| 18 | Not started | City page titles, the cost guide title and `/gallery` metadata are unchanged since Oct 8. |
| 19 | Partial | #818 and #822 render the phone 3D preview on demand (`frameloop` in `src/components/quote/QuotePreviewCard.tsx`). #822 deliberately mounts the preview early, at idle (skipped with Save-Data), so it is ready before the building pick; that goes the other way from the audit's mount-on-scroll idea. Still open: guide hero `priority={false}` (`src/app/news/[slug]/page.tsx`), live map tiles, Sentry `excludeTracing`, the favicon, Plex Mono `preload`, and static `/gallery`. Quote deep-link CLS was not re-measured after the #819 redesign. |
| 20 | Partial | One LocalBusiness node is done: #849 (merged Nov 8) drops the city list repeated in every Offer, and the business node is now defined only on the homepage. City, contact, project, guide and `/buildings` schema point at it by id, and project pages no longer type it as `Organization` (`docs/local-seo-san-antonio.md`). Still open: no `timeZone` in `NewsCard`, no `formatDetection`, the footer links only the service-area hub, sitemap `lastmod` is unchanged, and there is no weekly index-status check. |

Code items still open, in the audit's priority order:

1. [1] Make the SMS checkbox optional, after confirming the CRM only texts
   opted-in customers.
2. [8] Show starting prices before the contact step.
3. [9] Required build ZIP, an optional timeline question, and "what happens next"
   after the price.
4. [10] Payment and warranty FAQs, video-modal CTAs, and storage builds in
   "Latest builds".
5. [11] The "sheds for sale" FAQ and the building-types paragraph.
6. [12] Inline gtag stub, drop Vercel `track()`, exact landing path, and a source
   on texts.
7. [13] `/buildings/storage-sheds` and the loafing-shed link fix.
8. [14] Index curated city pages only.
9. [19] The remaining speed items.
10. [20] The remaining hygiene items: `NewsCard` time zone, `formatDetection`,
    footer city links, sitemap `lastmod`, and the index-status check.

Content items [15], [16] and [18] also need code changes, but wait on owner
copy and facts.

## Findings by theme

### Compliance on the lead path

**[1] The online price requires SMS consent.**
- `src/lib/quoteRoute.ts:154-161` rejects any quote without quote SMS consent, the
  checkbox is `required` (`src/components/quote/QuoteDeliveryContactStep.tsx:189`),
  and the hint reads "Check the box to get your online estimate"
  (`src/lib/smsConsent.ts:38-39`). Live since #809 (Sep 27), with v4 copy on Sep 28.
- Twilio's registration rules reject opt-in flows that make consent a condition
  of using the service: error 30923 for 10DLC, and 30475/30505 for toll-free
  verification. The business number is toll-free.
- `docs/shed210_sms_opt_in_implementation_spec.md:525`, the message-flow text
  given to the provider, says users can submit "without checking the box". The
  live flow now contradicts it, and `docs/quote-sms-consent.md` says provider
  acceptance of the required flow is unverified.
- The v4 copy says "Consent is not a condition of purchase" right next to a
  checkbox the form requires.
- Lead loss at this step is not measured. At ~7 saved quotes a month, the
  realistic effect is 0–2 quotes a month. The main case is compliance plus
  friction removal.

Do:
- **Before shipping,** confirm the external CRM acknowledgment workflow only
  texts customers whose `smsConsent` is opted in (`convex/crmQuoteSync.ts:616`
  passes it through). Otherwise unchecked quotes would receive texts nobody
  consented to.
- Then make the box optional and label it "(optional)". Remove only the
  required-consent issue from `superRefine`, keeping the version checks. Save
  unchecked quotes with `not_opted_in`.
- Ship v5 copy, keep accepting v3/v4 from open tabs, and update
  `src/app/privacy-policy/page.tsx:107,120-123`,
  `src/app/terms-and-conditions/page.tsx:147,169-172`, the three docs, and the
  #809 tests.
- Add a non-PII `failedField` tag to `form_error` first, so the change has a
  baseline.

**[2] The review page routes by star rating.**
- A 5-star tap navigates straight to Google
  (`src/components/review/ReviewExperience.tsx:144-149`). The headline says "Tap 5
  stars and we'll take you to Google." (line 198).
- The 5-star panel tells customers to "Pick 5 stars there" (lines 260-262).
- Ratings of 1–4 get a private feedback form, with Google reduced to a
  `text-xs text-white/40` link (lines 356-357).
- Google's contribution policy prohibits selectively soliciting positive reviews
  and influencing the rating. The rating-based flow has been live since #812
  (Oct 1) and became instant in #816 (Oct 8), so most of the 42 reviews predate
  it.
- This is risk reduction, not lead upside, but the reviews are the main local
  ranking and trust asset.

Do:
- Show one rating-neutral "Share how your build went on Google" button to every
  customer, before or regardless of any star tap.
- Offer "Send private feedback to David" to everyone as an optional parallel
  path.
- Remove the auto-redirect and the "Pick 5 stars" line. Keep the CRM
  `opened`/`google_opened` events.
- Update `docs/review-page.md`.

### Indexing and crawl

**[3] Request indexing, after a host-health check.**
- Step 1: in Search Console → Settings → Crawl stats, record Host status and any
  429/5xx, and check the Vercel Firewall for challenged Googlebot requests.
  Google's description of this status mentions rescheduling to avoid overload.
- Step 2: for each URL, Test live URL, confirm the rendered H1/body and
  self-canonical, then Request indexing (about 10 per day).
  - Day 1: `/service-area/san-antonio`, `/service-area/schertz`,
    `/service-area/cibolo`, `/service-area/boerne`, `/service-area/poteet`,
    `/service-area`.
  - Day 2: the San Antonio storage projects
    (`10x12x8-storage-shed-san-antonio`,
    `12x16x9-heavy-duty-portable-building-san-antonio`), the Luling, Natalia and
    Floresville greenhouse/well projects, and the Centerpoint doghouse.
- Step 3: re-inspect on day 7 and day 14 and record coverage and last-crawl date
  in a dated `docs/` note.
- Expect modest upside. The homepage already ranks for the San Antonio queries,
  and crawled sibling city pages average well under one click a month each.

**[14] Template city pages for one-off distant jobs.**
- Any CRM city with one project becomes an indexable page
  (`src/app/sitemap.ts:37-39`, `src/app/service-area/[city]/page.tsx:59-67`).
- Fredericksburg, Rocksprings and Centerpoint share a template with 0.67–0.72
  raw 5-word-shingle similarity (about 0.8–0.9 once city names are normalized).
  Curated pairs sit at 0.06–0.10.
- Fredericksburg and Rocksprings are far outside the radius. Centerpoint is about
  40 mi and its project page is a top-5 page, so keep that project indexable.

Do:
- Index curated city pages only, and leave project pages indexable.
- The owner decides which far markets deserve a curated page with real local
  content.

**[20] Hygiene.**
- Descriptive footer links to the core cities. Today
  `src/components/Footer.tsx:30-33` links only the hub, and the homepage grid
  anchor reads "H San Antonio" because the badge leaks into the anchor text.
- Sitemap `lastmod` from real content changes. Today 41 of 73 URLs have none, and
  city dates do not move when new projects appear.
- A single LocalBusiness node. Today 30 pages redefine `#localbusiness`, project
  pages declare the same `@id` as `Organization`, and the homepage repeats the
  28-city list in every Offer (~10 KB).
- A weekly URL Inspection API check on ~12 money URLs. The repo crawler's "passed"
  result confirms indexability, not index status.

### Keyword and page targeting

| Intent cluster | Evidence (28 days) | Target page | Notes |
| --- | --- | --- | --- |
| Head terms: shed, sheds, shed builder, metal shed, storage shed | Pos 1.3–3.7, ~0% CTR; same terms top the GBP search list | Business Profile `[4]` | Local-pack visibility; don't rewrite pages to chase these |
| shed builder(s) san antonio, sheds san antonio | 28 impr @ 8.1 (2 clicks); 19 @ 13.1; 26 @ 18.9 | `/` `[11]` | Top non-brand click query |
| storage sheds / storage buildings san antonio, metal sheds san antonio | 27 @ 21.1; 16 @ 14.4; 25 @ 21.6 | New `/buildings/storage-sheds` `[13]` | Homepage never says "storage sheds"; describe metal roof and siding on a wood frame truthfully |
| sheds for sale (san antonio / near me) | 7 queries, 59 impr, 3 clicks | Homepage + storage FAQ `[11]` | Answer honestly: built on your property, usually in a day, instant price. No inventory or rent-to-own pages |
| custom sheds, sheds built on site (no location) | Pos 45–64, 0 clicks | — | National phrasing; local variants already rank 2–7. Not worth chasing |
| greenhouse, water well shed | ≤3 impressions each | Later `/buildings/*` pages `[13]` | Strong project proof; build after indexing moves |

**[11] Homepage title and copy.**
- Title `Custom Sheds San Antonio | Built On-Site in 1 Day` (`src/app/page.tsx:23`)
  has no "builder", no "storage" and no brand; the `%s | Shed210` template does
  not apply to the root page.
- The H1 has no location, and the main copy never says "storage sheds". "metal"
  appears only in a warranty tile, yet "metal shed" is the #3 GBP search term
  (175).
- The Sep 7 audit kept this title on purpose. The new data that reopens it:
  "shed builders san antonio" is now the top non-brand click query, and San
  Antonio-modified queries sit at 13–21.

Do:
- Try `Shed Builder San Antonio | Custom Storage Sheds | Shed210` (57 chars) and
  move "1 day" into the description as "most built in one day". The flat "Built
  On-Site in 1 Day" overstates `src/components/FAQ.tsx:12`.
- Add a ~150-word building-types paragraph and an honest "Looking for sheds for
  sale in San Antonio?" FAQ.
- Change one thing at a time and compare 4-week windows.

**[13] Product pages.**
- `/buildings` is one 533-word page with ~30-word cards. Gallery type filters
  canonicalize to `/gallery`, so no product URL exists.
- Start with `/buildings/storage-sheds` from an explicit slug allowlist, not
  every catalog entry. Give it every real storage project (a hub for unindexed
  project pages), sizes, live starting prices `[8]`, an FAQ, and
  `/quote?structureType=storage_shed`.
- Greenhouse and water-well pages are medium priority. 8 of their 10 project URLs
  are still unindexed.
- Fix the loafing-shed "See real projects" link, which shows only doghouses
  (`src/lib/buildingCatalog.ts:55`).
- The owner should decide whether doghouses and offices are products to sell.

**[18] Snippets.**
- City pages at positions 5–10 with near-zero CTR use generic `Custom Sheds in
  {City}, TX` titles.
- `/gallery` (118 impressions @ 7.3, 0 clicks) could name the real build count
  and types.
- The cost guide's 95-character title truncates. Shorten it to something like
  `Shed Cost in San Antonio (2026): Prices by Size`.
- Expect a few extra clicks a month, not a step change.

### Local and Google Business Profile

**[4] Profile cleanup**, all guideline-safe:
- **Description:** fix "Sheds 210" and describe what is built instead of the
  website. Use only owner-confirmed facts: building types, metal roof and siding
  on a wood frame, most builds in one day, no distance fee within 35 miles,
  payment terms per `[6]`.
- **Service areas:** expand from 5 to San Antonio plus the ~18 towns inside the
  35-mile radius (GBP allows 20). Leave out Rocksprings, Hallettsville and
  Fredericksburg.
- **Categories:** keep "Shed builder" primary. Add "Carport and pergola builder"
  if the owner confirms carports (the catalog and a completed project say yes).
  Add nothing inaccurate.
- **Services:** remove "Cabin design & building" and "Shed moving" unless
  offered. Keep "Steel shed", which truthfully covers steel-framed carports and
  loafing shelters (`src/lib/quoteFlow.ts:60`).
- **Website link:**
  `https://www.shed210.com/?utm_source=google&utm_medium=organic&utm_campaign=gbp_listing`
  (canonical stays clean; first-party attribution already stores UTMs). Use
  `gbp_post` for posts.
- **Hours:** GBP says 7–6 daily, while `/contact` says "Monday-Friday"
  (`src/components/ContactPageClient.tsx:52-54`). Set both to the truth, and add
  `openingHoursSpecification` from one constant.
- **Activity:** no owner photos in 133 days and no posts. Post 3–5 real photos
  plus an update for each new project, linking to its project page.

**Phone:** keep (855) 578-0944 as the single number. It is consistent everywhere
except two hard-coded `sms:` links in the articles. The number changed five times
between May and July, which matters more than the area code. If a local number is
wanted, add a forwarding 210 number only as a GBP "Additional phone".

**Maps share (8%)** is partly structural for a service-area business: proximity
is measured from the hidden address. The legitimate levers are relevance
(categories, services, matching site copy), prominence (reviews `[2][17]`,
citations `[17]`) and engagement.

### Content and trust

**[6] Claims that need the owner's word:**
- **Payment:** "No Payment Upfront" (`src/components/ValuePropsBar.tsx:14`)
  versus "no final payment until complete" (`src/app/page.tsx:25`,
  `src/lib/serviceAreas.ts:143`). The second implies a deposit. Commit `db7a200`
  hedged it. If there is truly no deposit, it is the strongest differentiator:
  The Shedfather requires 50% down and others take deposits.
- **Fees:** "No hidden fees - what you see is what you pay"
  (`src/components/HowItWorks.tsx:37`) conflicts with the quote saying travel and
  site costs are confirmed separately.
- **Financing:** "Financing Available" (`src/components/hero.tsx:36`) has no
  provider, terms or page behind it; `/financing` is a 404. Name the program or
  remove the badge. Monthly-payment claims carry Truth in Lending disclosure
  rules.
- **Licensing:** "Licensed & insured Texas shed builders."
  (`src/components/Footer.tsx:226`). Texas has no statewide shed or
  general-contractor license, so name the actual registration, or keep
  "insured" with a carrier the owner can document.
- **Warranty:** what the "40-Year Metal Warranty" covers (panels or finish) and
  who issues it.

**[15] Project pages.**
- Blurbs run 9–74 words (median ~45). 114 of 192 photos share a `{size} {type}
  built in {City}, TX` alt.
- Some meta descriptions are raw CRM spec lists (Centerpoint) or fall back to a
  template when a short blurb is discarded (`src/lib/projectPresentation.ts`).
- Internal notes are visible on live pages, e.g. "The Facebook source used the
  spelling…" (`src/lib/serviceAreas.ts:944`) and Shady Oaks' "project source"
  FAQ, plus ~9 CRM blurbs with post dates or collage notes.
- Add 80–150 words of true specifics per project (use, site conditions,
  foundation, options, build time) and per-photo alts.
- List every city project as a text link on its city page; `RecentInstalls`
  stops at 6.
- These pages have never been crawled, so this is mainly conversion and proof
  work, not an indexing fix.

**[16] About / company facts.**
- `/about`, `/faq`, `/warranty` and `/financing` return 404. The only identity
  signal is "David" (`src/components/HowItWorks.tsx:44`).
- Publish verifiable facts only: owner, since January 2020 (confirm), crew, the 5
  building types and construction, payment and warranty terms, service area.
- This also gives AI assistants and Bing a clean entity summary. ChatGPT and
  Copilot already send a little traffic, and AI crawlers are allowed.

**[18] City pages.**
- The 25 curated pages are 70–87% unique text, but mostly paraphrased permit
  material. Nine show no local project, and Schertz shows a text-only card.
- Add first-hand notes (HOA and subdivision patterns, access, soil and slope),
  drive context, and every real project.
- Don't mass-noindex or merge curated pages.

### Conversion and lead quality

**[7] Mobile Call/Text.**
- The header Call/Text pill is `hidden … xl:flex` (`src/components/Navbar.tsx:40`),
  so phones see only the logo, an "Instant Price" pill and the menu, which is the
  most-tapped homepage element (12 of 103 taps).
- `FloatingCTA` is desktop-only (`hidden md:block`,
  `src/components/FloatingCTA.tsx:32`) and disabled on `/`
  (`src/components/FloatingCTAGate.tsx:14`).
- No page shows business hours.
- Add a mobile sticky bar `[Call] [Text] [Get price]` on content pages (not
  `/quote` or `/review`) that appears after the hero, or a phone icon in the
  header. Add hours once `[6]` settles them.
- While there, set `pointer-events-none`/`aria-hidden` on the invisible
  FloatingCTA state.

**[8] Prices before contact.**
- No current starting price appears on `/`, `/buildings` or `/quote`; the price
  arrives only after name, email, phone and consent.
- Dated "Recorded build price" figures already appear on `/gallery`, city pages
  and project pages. The homepage promises "see a clear price".
- Cheapest first step: show the existing dated recorded price on the homepage
  project cards.
- Then server-render "from $X" per type and size from
  `readActiveQuotePricingSettingsForServer()` (`src/lib/quotePricingSettings.ts`),
  labeled "base build before options; travel and site work confirmed
  separately".
- Reconcile the gap the owner may be asked about: e.g. the 10x16x7 recorded at
  $3,300 vs the current calculator default of about $4,980.

**[9] Quote qualification and follow-up.**
- "Build Location" is collapsed and marked "Optional"
  (`src/components/quote/QuoteDeliveryContactStep.tsx:240-283`). When step 3 opens
  with no ZIP, a full-screen "Improve quote accuracy" geolocation dialog appears
  (`src/lib/useQuoteDeliveryPrefill.ts`, via api.bigdatacloud.net). No timeline is
  captured.
- After the price, #809 removed the Call/Text tiles and "next steps" from
  `QuoteNextSteps`. Unless a discussion token exists, the panel tells the
  customer to "use Compare another option".

Do:
- Replace the dialog with one required 5-digit build ZIP with instant feedback
  ("inside our no-distance-fee area" / "about N miles out; any travel charge is
  confirmed before scheduling").
- Add an optional "When do you want it built?" chip.
- Restore Call/Text plus a three-line "what happens next" with a response window
  the owner will honor.
- ZIP and timeline are additive `/api/quote` and Convex fields, so update the
  contract docs.

**[10] Homepage proof.**
- About 12 of 103 homepage taps hit elements that go nowhere ("4.8", the review
  count, stars, "FINANCING AVAILABLE", "Local support after build day"),
  versus 4 on the hero CTA.
- Link the rating (`src/components/HeroGoogleReviewProof.tsx:104-126`) to a new
  homepage reviews section, reusing the live Google reviews component (no review
  schema).
- Link the payment and warranty cards to new FAQ answers, and drop hover-lift
  from non-links.
- Add "Get my price" and "Text David" to the build-video modal, which currently
  offers only Close (`src/components/hero.tsx:500-577`).
- The "Latest 6 builds" picks the six newest and then prioritizes storage
  (`src/lib/homepageGallery.ts:53-54`), so today it shows no storage shed and four
  out-of-area niche jobs. Always include the two newest in-radius storage builds,
  or add a CRM "featured" flag.

### Measurement

**[5] GA4 / Ads conversion.**
- The live Google tag creates `ads_conversion_Request_quote_1` on any `page_view`
  whose path starts with `/quote`, marks it as a key event, and GA4 is linked to
  Ads. So "Request quote" counts page loads, roughly an order of magnitude above
  real saved quotes.
- In GA4 Admin, remove or demote that rule, mark `quote_success` (already fired
  with `quoteId` from `src/lib/useQuoteFlow.ts`) as the key event, and register
  `quoteId` as a custom dimension.
- In Ads, set "Request quote" to Secondary and check whether any campaign spends
  or bids on it.

**[12] Plumbing.**
- **Early GA4 events are lost.** Both gtag scripts are `lazyOnload`
  (`src/app/layout.tsx:92-104`), and `trackEvent` drops events until
  `window.gtag` exists (`src/lib/analytics.ts:34`). Emit the dataLayer/gtag stub
  inline and keep only gtag.js lazy.
- **Vercel `track()` does nothing on Hobby.** Remove it and correct
  `docs/local-seo-san-antonio.md`.
- **GA4 should run on production only**, matching Clarity.
- **Clarity has one custom event and no funnel.** Add step events and build the
  funnel `/` → `/quote` → step 2 → step 3 → `quote_request_saved`.
- **Quote attribution is too coarse.** It stores first/last touch, but collapses
  landing pages into 7 categories (`src/lib/websiteMeasurement.ts:40-44`). Add an
  exact, allow-listed landing path and a coarse device field.
- **Calls and texts have no source.** Prefill the `sms:` body ("…found you on
  shed210.com…") and have staff log a source on every call/text lead.
- **Lead outcomes.** Confirm the CRM pipeline records qualified / out-of-area /
  won / lost within 48 hours. That is what turns "quotes" into "qualified leads".

### Performance

Field data is healthy: Clarity LCP 1 s, INP 170 ms, CLS 0.007; Vercel desktop RES
100. The keyless PageSpeed API returned quota 0, so the lab numbers below come
from a throttled mobile harness and are not PSI scores. `[19]` bundles:

- **Guide hero images are lazy-loaded.** Both guides load their cover with
  `priority={false}` (`src/app/news/[slug]/page.tsx:221,255,259`), giving a lab
  LCP of 3.5 s versus ~2.5 s on pages that preload their hero.
- **Homepage map tiles.** It fetches 12 live OpenStreetMap tiles (278 KB, 23% of
  the page) through SVG `<image>`, which can't lazy-load
  (`src/components/StaticServiceAreaMap.tsx:199`). Replace them with one static
  image of about 30–60 KB.
- **3D preview on phones.** Choosing a structure downloads a ~300 KB brotli
  three.js chunk for a preview that sits below the form, and its render loop never
  stops. Mount it on scroll-into-view below `md` and use `frameloop="demand"`.
- **Quote deep links shift the layout.** `/quote?structureType=…` shifts 0.188
  CLS after hydration. Reserve the size/style block's height.
- **Smaller trims:**
  - Sentry `excludeTracing` (tracing is off but bundled).
  - An 86 KB favicon fetched on every first visit.
  - `preload: false` for the decorative IBM Plex Mono.
  - Static rendering for `/gallery`, which is currently dynamic and ~80 ms slower.

`[20]` **Hydration error #418.**
- `/news` dates are formatted without a time zone
  (`src/components/NewsCard.tsx:15-23`), so US visitors see the day before the
  server's date. Add `timeZone: 'UTC'`.
- The "HTML" variant is likely iOS phone-number auto-linking. Set
  `formatDetection: { telephone: false }` and render the menu phone line as a
  `tel:` link.
- Neither explains the dead clicks.

### Competitive positioning

- **Competitors** in San Antonio results:
  - Tuff Shed stores (dealer lots, hundreds of reviews).
  - The Shedfather: the closest copy of Shed210's on-site/3D/instant-price
    pitch, but 50% down and 20 Google reviews.
  - Bulverde Sheds: full price list, Wisetack financing.
  - J B Woolf.
  - Delivered/rent-to-own lots.
  - Search results here were not geo-localized, so treat the set as indicative.
- **Shed210's defensible position:** owner-led local crew, built in your yard in
  about a day, instant online price, 35-mile no-distance-fee area. It also has
  the only published completed-build prices, and possibly no deposit (confirm).
  Its 42 Google reviews already double The Shedfather's.
- **Gaps versus competitors:**
  - Starting prices on money pages `[8]`.
  - Clear payment and financing terms `[6]`.
  - Product pages `[13]`.
  - Third-party profiles `[17]`.
  - A built-on-site vs delivered comparison guide.
- **Don't chase** rent-to-own, in-stock inventory, or fully enclosed steel
  buildings unless the owner offers them.

## What is healthy

- All 73 sitemap URLs return 200 to Googlebot, with one self-canonical, no
  `noindex`/`X-Robots-Tag`, and the same bytes for Chrome, Googlebot and Bingbot.
  TTFB is 0.16–0.33 s with edge-cache hits.
- `robots.txt` blocks only `/api/`. Unknown slugs return real 404s with
  `noindex`, trailing slashes 308 to canonical, and gallery filters canonicalize
  to `/gallery`. The three 404s in Search Console are retired build assets, not
  pages.
- Main content is server-rendered on every template. The homepage HTML is 285 KB
  raw but 33 KB on the wire.
- No self-serving review or `AggregateRating` schema, and no published street
  address: correct for a service-area business. Breadcrumbs: 27 valid, 0 invalid.
- The phone and email are consistent across the site, schema and GBP. The site's
  review count is fetched live.
- First-party quote attribution (first/last touch, referrer bucket, UTMs) is
  stored with each saved quote and survives ad blockers. `quote_request_saved`
  fires in Clarity only after a server-confirmed save.
- Both guides funnel readers to `/quote`, carry BlogPosting/FAQ/Breadcrumb
  schema, and are distinct (3.8% overlap). Do not merge them.
- AI and search crawlers (GPTBot, OAI-SearchBot, PerplexityBot, ClaudeBot,
  bingbot) are allowed. Bing Webmaster verification is live.

## How to measure success

Report monthly on a rolling 90 days, and change one major thing at a time where
possible.

1. **Saved quotes:** the Convex `quoteRequests` count, excluding tests. This is
   the ground truth. Reconcile GA4 `quote_success` and Clarity against it.
2. **In-area share:** saved quotes with a ZIP inside the service area `[9]`.
3. **Qualified leads:** CRM qualified = yes within 48 hours (in-area, product
   fit, reachable), including calls and texts with a staff-logged source `[12]`.
4. **Won jobs and revenue** by first-touch source and exact landing page.
5. **Leading indicators:**
   - Coverage and last-crawl date for the six core city URLs `[3]`.
   - Local non-brand clicks (regex segment) and impressions for "+ San Antonio"
     storage queries.
   - GBP calls, website clicks and `gbp_*` UTM quotes `[4]`.
   - Mobile tel/sms taps per session `[7]`.
   - Step-3 consent and validation errors `[1]`.

Phone/text taps and quote-page visits are intent signals; never report them as
leads.

## Appendix

### Buyer-intent queries, Sep 9–Oct 6 (≥3 impressions)

| Query | Clicks | Impr. | Pos. |
| --- | ---: | ---: | ---: |
| shed builders san antonio | 2 | 28 | 8.1 |
| sheds for sale near me | 2 | 20 | 9.9 |
| sheds for sale san antonio | 1 | 10 | 12.2 |
| storage sheds san antonio | 0 | 27 | 21.1 |
| san antonio sheds | 0 | 26 | 18.9 |
| metal sheds san antonio | 0 | 25 | 21.6 |
| sheds san antonio | 0 | 19 | 13.1 |
| storage buildings san antonio texas | 0 | 16 | 14.4 |
| sheds in san antonio | 0 | 15 | 17.1 |
| shed san antonio | 0 | 13 | 17.9 |
| storage shed san antonio | 0 | 12 | 13.8 |
| shed builders near me | 0 | 11 | 10.5 |
| shed builder san antonio | 0 | 7 | 9.6 |
| shed for sale san antonio | 0 | 7 | 22.0 |
| storage sheds for sale san antonio | 0 | 6 | 28.3 |
| sheds built on site near me | 0 | 5 | 6.8 |
| custom sheds near me | 1 | 3 | 3.0 |
| build on site storage buildings | 1 | 3 | 2.0 |

Head terms, likely local-pack impressions: shed builder 280 @ 1.5, sheds 231 @
1.3 (1 click), shed 37 @ 3.6, storage shed 34 @ 3.1 (1 click), metal shed 34 @
3.7, small shed 19 @ 4.8.

### Pages with impressions, Sep 9–Oct 6 (top 15)

| Page | Clicks | Impr. | Pos. |
| --- | ---: | ---: | ---: |
| `/` | 54 | 2,045 | 12.9 |
| `/news/sanantonio_shed_guide` | 3 | 291 | 5.7 |
| `/news/san-antonio-shed-cost-guide` | 2 | 254 | 7.0 |
| `/buildings` | 3 | 145 | 13.7 |
| `/gallery` | 0 | 118 | 7.3 |
| `/contact` | 0 | 110 | 22.2 |
| `/service-area/floresville` | 1 | 92 | 10.3 |
| `/quote` | 1 | 77 | 7.3 |
| `/service-area/seguin` | 3 | 67 | 11.3 |
| `/service-area` | 0 | 56 | 8.8 |
| `/news` | 0 | 55 | 8.9 |
| `/service-area/lytle` | 0 | 48 | 6.8 |
| `/service-area/luling` | 0 | 48 | 12.4 |
| `/service-area/pleasanton` | 0 | 42 | 6.5 |
| `/service-area/bulverde` | 0 | 42 | 16.9 |

Zero impressions: `/service-area/san-antonio`, `/schertz`, `/cibolo`, `/boerne`,
`/poteet`, and most project pages.

### "Discovered – currently not indexed" (27, no crawl dates, Oct 8)

`/news` (now shows impressions; the report lags), `/service-area` (same),
`/service-area/boerne`, `/service-area/cibolo`, `/service-area/poteet`,
`/service-area/san-antonio`, `/service-area/schertz`, `/terms-and-conditions`, and
19 projects:

- Boerne 10x12x7 greenhouse
- Bulverde 6x16x9 side utility
- Centerpoint 6x10x7 doghouse
- Converse 8x8x6 doghouse
- Floresville 10x10x8 well shed and 8x12 greenhouse
- Fredericksburg 4x10x6 well shed
- Hallettsville 8x12x7 doghouse
- Karnes City 6x6x7 well shelter and 8x8x7 storage
- Lakehills 6x8x7
- Luling 10x12 greenhouse
- Natalia 10x16x9 greenhouse
- Rocksprings 8x10x7 well shed
- San Antonio 10x12x8 storage, 10x16 + 10x10 portable, 12x16x9 portable,
  15x30x10 utility, 8x8x7 storage

The other not-indexed categories: 4 permanent redirects (http/apex variants, as
intended), 3 × 404 for retired `/_next/static` assets, and 1 crawled-not-indexed
asset.
