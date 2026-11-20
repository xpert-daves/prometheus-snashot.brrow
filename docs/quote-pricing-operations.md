# Quote Pricing Operations

This is the operating guide for changing Shed210 prices without creating a
second admin system or silently falling back to stale values.

## Ownership

- Frontier Pixel CRM owns David's pricing editor, internal calculator, drafts,
  and immutable publications.
- Shed210 owns the public quote form, calculation code, quote persistence, and
  customer/admin notifications.
- Shed210 must read one explicitly configured pricing source. Production should
  use a CRM publication that passed the
  [pre-publish checklist](#pre-publish-checklist); local development may use
  `shed_convex`.
- This repo does not serve `/admin/*`.

The CRM module route is:

`/admin/t/shed210/modules/shed-quotes`

David needs an active Shed210 CRM membership with `canManageSettings`. Tenant
owners receive that capability by default.

## David's Change Workflow

**Publish prices** is live the moment it succeeds. With
`QUOTE_PRICING_SOURCE=frontier_pixel_crm`, every Shed deployment, Preview and
Production alike, reads the same active publication from the pinned CRM
deployment (`youthful-horse-290`) on each quote request. There is no staged
copy of prices to promote. The CRM has no owner-review gate either: it
publishes any saved draft that passes its config validation. The
[pre-publish checklist](#pre-publish-checklist) is the only check before
customers see a new price.

1. Open the Shed Quotes module in Frontier Pixel CRM.
2. Enter or update pricing in **Quote pricing**.
3. Select **Save working changes**. A saved draft never changes public quotes.
4. Use the internal quote calculator on the same page to test representative
   sizes, roof styles, heights, doors, windows, upgrades, delivery, and
   discounts.
5. Work through the [pre-publish checklist](#pre-publish-checklist): record each
   expected total, compare its line-item breakdown, and record the sign-off.
6. Select **Publish prices** only after the checklist passes. The next public
   quote on every CRM-mode Shed deployment uses the new version.
7. After publishing, submit one quote on a Shed Preview deployment running in
   CRM mode (it reads the same publication as Production) and confirm its
   saved metadata shows the new pricing publication id and version.

The Vercel Preview and Production pipeline applies to Shed210 code and
environment changes only. It does not stage, promote, or hold back a price
change.

Publishing affects new quotes only. It does not rewrite old quote records or
recall SMS/email alerts. To undo a bad publish, re-publish the last known-good
values as a new version (see [Rollback](#rollback)).

## What Each Field Controls

| Section | Meaning |
| --- | --- |
| Footprint gabled/base price | Standard 6-ft gabled price. A non-listed size rounds up to the smallest listed footprint that contains it. |
| Footprint barn price | Optional completed 6-ft barn price for those exact dimensions only. Blank uses the global barn floor-area surcharge. |
| Footprint lean-to price | Optional completed 6-ft lean-to price for those exact dimensions only. Blank uses the global lean-to surcharge. |
| Custom price per sq ft | Prices any size no listed footprint contains: first footprint row's price + (`length × width` − that row's area) × this rate, never below that row's price. The line starts from the first row (6x6 in the default table), not the largest, so it meets the largest row's price only while this rate equals the table's own slope. With the defaults it does: `$1,600 + (256 − 36) × $15 = $4,900`, the 16x16 price. |
| Custom rounding | Rounds extended custom-size pricing up to this increment. |
| Wall-height surcharge per floor sq ft | Separate 6/7/8-ft rates multiplied by `length × width`; 6 ft is included at $0, the seeded 7-ft rate is $3, and the seeded 8-ft rate is $6. The 8-ft rate must be above the 7-ft rate. |
| Barn price per floor sq ft | Added when the selected exact footprint has no barn override; the seeded rate is $4.50 × `length × width`. |
| Legacy wall rate / barn multiplier | Compatibility-only fallbacks for older 7-ft-baseline publications that lack the explicit fields. |
| Lean-to surcharge | Fallback for a footprint whose lean-to price is blank. |
| Doors and windows | Flat amount per selected door or per window. |
| Exterior upgrades | Flat, per-square-foot, or per-linear-foot charges. |
| Delivery | Included radius plus the configured rate for jobs beyond it. |
| Discount codes | Percentage removed from the full subtotal. Shed210 matches the customer's code regardless of case or surrounding spaces, so `summer10` applies `SUMMER10`. The CRM internal calculator still matches exactly, so test codes there in uppercase. |

Roof material, frame gauge, ventilation, color, and interior upgrades are
currently descriptive-only. They add `$0` unless the pricing model is
deliberately extended and tested.

An anchored slab is deliberately outside the online estimate, not an unpriced
gap. The customer sees it listed as **Priced after site review** and is asked
to send photos; David prices it from those photos, most likely after a site
visit. Do not add a slab price to the CRM publication.

Every building type uses the same enclosed-shed footprint table. Building type
changes the price only through the options that type offers: wall height is
priced for storage sheds/garages and greenhouses, roof style for storage
sheds/garages, and windows for storage sheds/garages and greenhouses.
Greenhouses are priced with a gabled roof. Water well sheds, loafing sheds /
3-sided shelters, and carports are priced at the standard wall height with a
gabled roof and no windows. Whether open buildings should have their own prices
is an open calibration question (see Building types below).

## Calibration Intake

Before changing a shared rule, David should answer these questions:

| Decision | Required answer |
| --- | --- |
| Footprints | Confirm that each amount is the completed 6-ft gabled base and whether non-listed sizes should round up. |
| Roofs | Confirm the $4.50 per floor-square-foot barn rule and any exact-size completed-price exceptions. |
| Wall height | Confirm the 6/7/8 floor-area surcharge map: $0 / $3 / $6 per sq ft. |
| Materials | What do 26ga roofing, frame gauge, and interior upgrades add? (Anchored slab stays outside the online estimate.) |
| Delivery | Is the extra charge for all miles or only miles beyond the included radius? |
| Rounding | At which stage should each line and the final total be rounded? |
| Building types | Are carports, loafing sheds / 3-sided shelters, water well sheds, and greenhouses priced from the same 6-ft footprint table as enclosed sheds? If not, give completed prices for a 12x20 and a 20x20 carport and a 12x20 loafing shed. |

**November 2026 price list.** CRM publication version 6 went live on
2026-11-10 02:53 UTC (the evening of November 9 in San Antonio). Every price
is 20% higher than the list below describes: flat prices rounded to the
nearest $5, per-foot and per-mile rates exactly 20%. The SUMMER10 code was
removed. David OK'd a price sheet showing the full list and the three
checklist totals on 2026-11-09; Redacted Author confirmed his OK, and David's own
message is not saved in either repo. It was published by a reviewed CRM
migration (`publishShed210PriceListNov2026`) instead of the editor, and the
CRM's `docs/convex-migrations.md` has the record. The cases below keep their
October numbers as history.

Known calibration cases (first recorded July 25, 2026; building types added
October 8, 2026):

- **Unverified target:** 10x12, 7-ft, barn roof, 29ga roof, single shed door,
  blocks/level foundation, no priced upgrades, included delivery: **$3,800**.
  This was recorded on July 25, 2026 as David's confirmed price, but no message
  or note from David was saved with it. Confirm it with David before changing
  any rule to match. The literal rules currently calculate **$3,900**:
  - floor area: `10 × 12 = 120 sq ft`
  - 6-ft gabled base: `$3,000`
  - 7-ft wall surcharge: `120 × $3 = $360`
  - barn surcharge: `120 × $4.50 = $540`
  - total: `$3,000 + $360 + $540 = $3,900`
  This $100 mismatch must stay visible until David corrects or clarifies one of
  the source rules. There is no seeded 10x12 override.
- **Pending David:** 12x14, 8-ft, barn roof, 26ga roof, garage roll-up door,
  anchored slab, Workbench and Skirting, included delivery. The literal rules
  now calculate **$6,756**: `$3,800` base + `168 × $6 = $1,008` wall +
  `168 × $4.50 = $756` barn + `$750` door + `$442` Skirting. (Before the 8-ft
  rate was corrected from $3 to $6 on October 9, 2026, they gave `$6,252`.)
  The 26ga roof and Workbench remain `$0` in the model. The slab is excluded
  by design and priced after site review, so compare this case against
  David's price without the slab. Neither `$6,044` nor `$6,756` is approved
  until David explicitly confirms the components or supplies the corrections.
- **Pending David (building types):** carports and loafing sheds use the
  enclosed-shed table at the 6-ft standard wall, gabled roof, no windows, and
  included delivery. Both sizes are longer than any listed footprint, so the
  custom square-foot rule applies:
  - 12x20 carport or 12x20 loafing shed: `$1,600 + (240 − 36) × $15 = $4,660`,
    rounded up to **$4,700**
  - 20x20 carport: `$1,600 + (400 − 36) × $15 = $7,060`, rounded up to
    **$7,100**
  These are today's results, not approved prices, until David confirms that
  open buildings share the enclosed-shed table or supplies his own completed
  prices. A CRM publish cannot express different open-building prices. That
  needs a Shed210 pricing change first, deployed before the CRM publishes any
  new field, because Shed210 rejects pricing fields it does not recognize and
  would stop taking quotes.

An exact-size roof override is an available exception only after David
explicitly supplies or approves that completed 6-ft price. It applies to the
exact dimensions in either orientation, never to custom sizes that merely
round up to the same base-price row.

## Pre-Publish Checklist

The CRM no longer has owner-review sections or a **Needs changes** state, and
**Publish prices** accepts any saved, valid draft. This checklist replaces
that gate. Run it against the saved draft in the CRM internal quote calculator
before every publish, and record the sign-off in the pull request or change
note that goes with the publish.

| Case | Calculator inputs | Literal rules give | David's answer | Status | Signed off (who, when) |
| --- | --- | --- | --- | --- | --- |
| 10x12 barn | 10x12, 7-ft, barn roof, 29ga roof, single shed door, blocks/level foundation, no upgrades, included delivery | $4,680 on publication version 6 (was $3,900) | Accepted on the November 2026 price sheet | Signed off | David, 2026-11-09 (confirmed by Redacted Author) |
| 12x14 barn | 12x14, 8-ft, barn roof, 26ga roof, garage roll-up door, anchored slab, Workbench and Skirting, included delivery | $8,107 on publication version 6 (was $6,756; earlier models gave $6,044 and $6,252) | Accepted on the November 2026 price sheet, without the slab | Signed off | David, 2026-11-09 (confirmed by Redacted Author) |
| Open buildings | 12x20 and 20x20, 6-ft, gabled roof, single shed door, no windows or upgrades, included delivery | $5,600 / $8,500 on publication version 6 (were $4,700 / $7,100) | Accepted on the November 2026 price sheet | Signed off | David, 2026-11-09 (confirmed by Redacted Author) |

- Compare each line of the breakdown, not only the total.
- The CRM calculator always prices a storage shed. While every building type
  uses the same table, a storage shed of the same size with a gabled roof,
  6-ft walls, and no windows shows the carport and loafing-shed price.
- Do not publish until every case is signed off: David either accepts the
  calculated total or the draft is corrected to his answer. Record who signed
  off and when. A case needs a new sign-off whenever its calculated total
  changes.
- After publishing, open the active publication in the CRM UI, confirm its
  version, and update each case's status here and in the known calibration
  cases above. Do not use Convex CLI commands to inspect or change pricing.

## Production Source Rollout

Configure and verify in this order:

1. Deploy the companion Frontier Pixel CRM change first. It widens the optional
   roof-price fields and quote audit metadata and adds the dedicated pricing
   read credential.
2. In CRM production, enable the Shed Quotes module and public access.
3. Set `PLATFORM_USE_NEW_SHED_QUOTE_MODULE_READS=true` and a strong, unique
   `SHED_QUOTE_PRICING_READ_KEY` in the target CRM Convex deployment.
4. Give David an active Shed210 membership with `canManageSettings`.
5. Select **Save working changes**, run the
   [pre-publish checklist](#pre-publish-checklist) in the CRM internal
   calculator, then select **Publish prices**. The CRM has no owner-review
   step; the checklist is the gate. From here on, any Shed deployment set to
   CRM mode reads this publication on its next quote.
6. Deploy this Shed210 change through Vercel Preview and set:
   - `QUOTE_PRICING_SOURCE=frontier_pixel_crm`
   - `FRONTIER_PIXEL_CRM_CONVEX_URL=https://youthful-horse-290.convex.cloud`
   - `FRONTIER_PIXEL_CRM_QUOTE_PRICING_KEY` to the same value as the CRM
     deployment's `SHED_QUOTE_PRICING_READ_KEY`
7. Confirm the preview quote stores the CRM provider, publication id/version,
   and pricing schema version.
8. Copy the verified configuration to Vercel Production and deploy normally.

Steps 6-8 move environment settings, not prices. After the rollout, every price
change follows [David's Change Workflow](#davids-change-workflow) and is live on
publish.

The CRM pricing key is server-only. Never expose it in client code, logs,
screenshots, or committed env files. It is a dedicated read credential and
must not reuse either deployment's quote write key. Shed210 pins the allowed
CRM pricing origin exactly and refuses redirects before sending the key.

When `QUOTE_PRICING_SOURCE=shed_convex`, use a separate
`CONVEX_QUOTE_PRICING_READ_KEY` in both Vercel and the Shed Convex deployment.
The local query is tenant-scoped; a missing tenant row uses the built-in default
config and never borrows another tenant's active row.
Deploy the compatible query first; it temporarily accepts the quote write key
while `CONVEX_PRICING_ALLOW_WRITE_KEY_FALLBACK` is unset or `true`.
After Preview and Production both prove reads with the dedicated key, set the
fallback flag to `false`. For rotation, configure the old key as
`CONVEX_QUOTE_PRICING_READ_KEY_PREVIOUS` and the new current key in Convex
before changing Vercel, then remove the previous key after verification.

Production requires an explicit pricing source. When CRM mode is selected,
missing configuration, a request longer than five seconds, an unavailable CRM,
a malformed/unsupported response, or a response without an active publication
returns `503` with `Retry-After: 60`. Shed mode also rejects built-in defaults
in production. No quote or notification is created.

## Rollback

The preferred rollback is to re-publish the last known-good values as a new,
audited CRM publication. Changing `QUOTE_PRICING_SOURCE` back to `shed_convex`
is an emergency-only fallback and must happen only after someone verifies the
local active row. Production refuses an empty local deployment instead of
quoting built-in defaults.

## Historical Corrections

Do not patch only one copy of a submitted quote. A public quote can have a
source row plus linked CRM quote and lead projections, and its notifications
may already have been sent. Historical corrections need an append-only audit
record or a coordinated mutation that keeps every linked projection and the
line-item breakdown consistent.
