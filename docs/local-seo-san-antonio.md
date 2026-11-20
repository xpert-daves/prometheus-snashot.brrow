# San Antonio local SEO notes

## Scope

The first local SEO push targets quote-ready San Antonio shed searches. The homepage is the primary conversion page for custom sheds in San Antonio, and `/service-area/san-antonio` supports it with local planning proof, neighborhood coverage, permit/HOA guidance, project examples, and quote CTAs.

## Service-area business schema

- Keep Shed210 modeled as a service-area business. The business node uses the
  `HomeAndConstructionBusiness` type (a `LocalBusiness` subtype) with the stable
  `/#localbusiness` id.
- Define the business node once, on the homepage (`buildServiceAreaBusinessJsonLd`
  in `src/app/page.tsx`). Every node with that id claims to describe the same
  business, so a second definition with different facts (one city in
  `areaServed`, another `@type`) contradicts the first. `seoBusinessNode.test.ts` fails if another
  file builds the node or hand-writes the id.
- Do not add a public street address unless the business starts publishing one consistently across the site and Google Business Profile.
- Use service-area fields, phone, email, sameAs links, image, and accurate offered services.
- Offered services come from `BUILDING_CATALOG` in `src/lib/buildingCatalog.ts`
  (plus HOA planning help), so adding a building type there updates the schema.
  Each service's id is its `/buildings#<type>` card anchor, and `/buildings`
  publishes the same services as an `ItemList`. Cities stay on the business's
  `areaServed`; do not repeat them under every service. The business
  `description` is hand-written; `seo.test.ts` fails until a new building type
  is named in it.
- Every other page points at the node with `buildBusinessReferenceJsonLd` (type,
  id, name, url):
  - `/service-area/<city>` renders a `Service` for that city with the business as
    `provider`.
  - `/contact` renders a `ContactPage` whose `mainEntity` is the business.
  - `/buildings` uses it as each service's `provider`.
  - `/news` and articles use it as `publisher`; articles also use it as `author`.
  - Project pages use it as the `CreativeWork` `creator`.
- `alternateName` carries "Shed 210", the spelling on the Google Business Profile.
- Do not add `logo` until there is a logo file that reads on a white background;
  the current icons are white artwork on transparency.
- Add `sameAs` profiles and `openingHoursSpecification` only from the client's
  confirmed profile URLs and hours.
- Do not add self-serving review or aggregate-rating schema.
- Pages with visible breadcrumbs should also render `BreadcrumbList` JSON-LD.
- `/news` publishes a `Blog` listing every article's `BlogPosting`.

## San Antonio permit language

Use official City of San Antonio DSD pages for permit statements:

- Development Services getting-started FAQ: https://www.sa.gov/Directory/Departments/DSD/Resources/Getting-Started
- Residential permits page: https://www.sa.gov/Directory/Departments/DSD/Constructing/Residential/Permits

Current site copy should say the City DSD FAQ identifies accessory structures greater than 300 sq. ft. as requiring a permit and that setbacks apply. Avoid unsupported fee ranges, guaranteed timelines, or broad claims that every small shed is permit-free.

## Analytics events

`trackEvent` sends to both Vercel Analytics and GA4 when available. Jest stays no-op through the test environment guard.

Primary conversion:

- `quote_success`

Secondary actions:

- `quote_cta_clicked`
- `contact_cta_clicked`
- `text_click`

Keep event properties free of customer PII. Use location labels such as `home_hero`, `floating_cta`, or `quote_next_steps`.
