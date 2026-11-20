# Portfolio images

Portfolio thumbnails and detail views load images defined in `public/portfolio/portfolio.json`.
Add JPEGs or PNGs to `public/portfolio` and update the JSON file with their paths and captions.

Images are served with `next/image` using container-specific responsive sizes. Grid thumbnails use stronger compression than lightbox/detail views, so source files should still be pre-optimized before you add them to `public/portfolio`.

Prefer source images around 1600-2200px on the long edge for gallery photos. Avoid uploading oversized camera originals directly; export web-ready files first so Next.js has less source data to process and cache.

## Published project covers

The CRM-backed `/gallery` route renders one cover image per project in a
three-column card grid. The photo-count badge and project link lead to the
city-slugged detail page, where the complete photo set remains available.

Treat the selected CRM cover as the project's storefront:

- Choose a finished exterior "money shot" with the whole shed readable at
  thumbnail size.
- Prefer a clean front three-quarter angle, useful daylight, and a finished
  yard or pad when those options exist.
- Keep framing progress, unfinished OSB interiors, equipment close-ups, and
  utility details in the project photo set for the detail-page build story,
  not as the cover.
- Confirm the CRM cover selection after reordering photos; the public API's
  `coverPhoto` and `coverPhotoIndex` must continue to identify the same image.

Gallery filters update as soon as a city or project type changes. The public
site presents five controlled project types: Storage & Utility, Greenhouse,
Animal Shelter, Well House, and Office & Workspace. Counts show how many
projects remain available for the other active filter, and zero-result city
links fall back to recent projects from configured nearby service areas.

The CRM V2 project API separates the specific customer-facing `title` from the
general `model` used as the project type. Public names are always rendered as
`size + title`; while a V1 response is still in use, the site falls back to
`size + model`. Existing project slugs stay unchanged. The gallery accepts old
`model` query values such as `Side Utility` and maps them to the appropriate
controlled project type so saved links continue to produce a useful filter.

During rollout, the site calls V2 first. An explicit missing-function error or
the same error redacted by the production Convex client triggers exactly one
probe of the corresponding V1 function. V2 responses are strictly validated
with a required `title`; V1 responses are separately strict and title-less. A
failed V1 probe is surfaced unchanged. If the V1 gallery list predates the
`includePhotos` argument, the existing summary-plus-detail fallback still
builds the full gallery.

`src/lib/serviceAreas.ts` remains the curated copy registry and ordering for
established service-area pages. The server-only
`projects:publicListProjectCitiesV1` query can append complete, public CRM towns
to the map, directory, gallery filters, project validation, and dynamic
`/service-area/*` routes. CRM metadata and verified coordinates augment a
matching curated city without replacing its researched copy. CRM-only towns use
conservative generic planning copy and are omitted from the sitemap (and marked
`noindex`) until they have a published project. During a site-first rollout,
only a missing or production-redacted city-query error falls back to the curated
registry; schema, network, and named provider errors remain visible.
