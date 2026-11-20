# Pricing Rules

Pricing values come from the server-selected `QUOTE_PRICING_SOURCE`.
`shed_convex` reads the active row in this app's Convex deployment and retains
the built-in defaults below only for an empty local deployment.
`frontier_pixel_crm` reads an immutable active publication created by the
CRM-owned pricing workflow. CRM mode rejects a response without a publication
id. Any read or configuration failure returns a temporary-unavailable response;
the public API does not silently calculate, save, or notify from stale defaults.

In `shed_convex` mode, dev, preview, and production each have separate Convex
data, and changing the active row in one deployment does not update another.
In `frontier_pixel_crm` mode, every Shed deployment, Preview and Production
alike, reads the same active publication from the pinned CRM deployment, so one
publish changes the next quote on all of them at once. A saved CRM draft is
private and never changes public quotes.

This repo no longer serves a local admin quote tool or pricing editor, and
`/admin/*` falls through to the normal site 404. David's editor and internal
calculator live in the Frontier Pixel CRM Shed Quotes module. Save a draft,
verify known-good configurations in the internal calculator, then publish.
Only a published version can affect new public quotes, and it does so
immediately; the CRM has no separate review or staging step. See
`docs/quote-pricing-operations.md` for the field guide, rollout order, and
calibration checklist.

- **Base price**: 6 ft gabled pricing is based on the owner's standard
  footprint table. The default table is:
  - 6x6: $1600.
  - 6x8: $1900.
  - 8x8: $2100.
  - 8x10: $2400.
  - 10x10: $2700.
  - 10x12: $3000.
  - 12x12: $3400.
  - 12x14: $3800.
  - 14x14: $4200.
  - 14x16: $4500.
  - 16x16: $4900.
- **Custom size pricing**:
  - Exact listed sizes use the listed price.
  - Non-listed sizes within the table envelope round up to the smallest listed
    footprint that contains both dimensions.
  - Sizes no listed footprint contains use the first footprint row's price plus
    (`length × width` − that row's area) × the custom square-foot rate, never
    below that row's price, rounded up to the custom rounding increment.
    Defaults: the 6x6 row at $1,600, $15 per sq ft, and the next $100. For
    example, 12x20 is `$1,600 + (240 − 36) × $15 = $4,660`, rounded to $4,700.
  - The line starts from the first row, not the largest. It meets the largest
    row's price only while the square-foot rate equals the table's own slope;
    with the defaults it does (`$1,600 + (256 − 36) × $15 = $4,900`, the 16x16
    price).
- **Building types**:
  - Every structure type (storage shed/garage, greenhouse, water well shed,
    loafing shed / 3-sided shelter, and carport) uses the same enclosed-shed
    footprint table and custom square-foot rule. There is no per-type price.
  - Structure type changes the price only through the options it offers. Wall
    height, roof style, and windows are priced only for the types listed in
    those sections below; every other type is priced at the standard wall
    height with a gabled roof and no windows.
  - Whether open buildings should have their own prices is pending David. See
    the building-types question and case in
    `docs/quote-pricing-operations.md`.
- **Pricing modes**:
  - Literal mode is one coherent set: a 6-ft standard base, the explicit
    6/7/8 wall-height map, and `barnPricePerSqft`.
  - Legacy mode is one coherent set: a 7-ft standard base with neither explicit
    field, using the saved one-rate wall adjustment and barn multiplier.
  - Partial or hybrid combinations are rejected at the Shed/CRM boundary.
- **Wall height**:
  - Priced only for storage sheds/garages and greenhouses. Other types use the
    standard wall height with no surcharge.
  - Surcharges use floor area: `length × width`.
  - 6 ft: included in the footprint base, so the surcharge is $0 per floor
    square foot.
  - 7 ft: +$3 per floor square foot.
  - 8 ft: +$6 per floor square foot. Each taller wall must cost more than the
    one below it; the CRM refuses to save or publish an 8-ft rate that is not
    above the 7-ft rate.
  - Legacy publications without the explicit 6/7/8 map retain their former
    7-ft baseline and one-rate subtraction/addition behavior.
- **Roof style**:
  - Priced only for storage sheds/garages, the only types that offer a roof
    choice. Every other type is priced as `gabled`.
  - Each footprint can have an explicit completed standard-wall `barn` and/or
    `lean-to` price. New publications use 6 ft as the standard wall.
  - A footprint override applies only to that exact pair of dimensions in
    either orientation. A non-listed size that rounds to the footprint for its
    base price still uses the global roof rule.
  - `gabled`: uses the footprint base price.
  - `barn`: uses the footprint's explicit barn price when present; otherwise
    adds $4.50 per floor square foot (`length × width`).
  - `lean-to`: uses the footprint's explicit lean-to price when present;
    otherwise the global $360 surcharge.
  - Legacy publications without `barnPricePerSqft` retain their saved barn
    multiplier.
  - A 10x12, 7-ft barn target of $3,800 was recorded without a saved source
    from David and is not yet verified. The literal default rules
    currently calculate `$3,000 + (120 × $3) + (120 × $4.50) = $3,900`.
    This $100 contradiction is deliberately visible for David to resolve; it
    is not masked with a one-off override.
- **Siding**:
  - `metal`: no multiplier.
- **Door**:
  - `single_shed`: included.
  - `double_shed`: +$185.
  - `garage_roll_up`: +$750.
  - `house`: +$375.
- **Windows**:
  - Priced only for storage sheds/garages and greenhouses, the types that offer
    windows. Every other type is priced with no windows.
  - `24x36` each: $200.
  - Window quotes must include a positive window count.
- **Exterior Upgrades**:
  - `Ground Anchoring`: $350 flat.
  - `Ramp (Single Door)`: $195 flat.
  - `Ramp (Double Door)`: $249 flat.
  - `Steps`: $85 flat.
  - `Skirting`: $8.50 per linear foot.
  - `2-Tone`: $165 flat.
  - `Roof Overhang`: $95 flat.
  - `A/C Knock Out`: $65 flat.
  - The total cost of any selected upgrades appears as an **Upgrades** line in the price breakdown.
  - Duplicate upgrades and unavailable upgrade names are rejected.
  - The quote UI shows one **Ramp** add-on, then saves and prices the matching
    single-door or double-door ramp SKU for the selected shed door. Ramps are not
    offered for garage roll-up or house doors.
  - Ramp upgrades must match the selected door type.
  - **Interior Upgrades** (Workbench, Loft, Insulation, Electrical Prep): listed individually in the price breakdown and do not add automatic pricing.
- **Service-area distance**:
  - Sheds are built on site with no extra distance charge inside the current
    service area.
  - Current service area pricing includes up to 35 miles from 341 Vista Rd, San
    Antonio, TX 78210.
  - Austin, Corpus Christi, Victoria, and other jobs outside the current service
    area add $1.50 per mile from 341 Vista Rd.
  - Distance is measured from 341 Vista Rd, San Antonio, TX 78210.
  - The pricing engine retains the configured distance rule for verified/internal
    calculations, but the public `/api/quote` route does not trust browser-entered
    or browser-derived mileage.
  - Public quote submissions accept the legacy `deliveryRadius` field only for
    rollout compatibility. The server always normalizes its effective value to
    zero before pricing and persistence; it never creates a verified `$0`
    delivery assertion from that value.
  - Public results are labeled **Estimated build subtotal**. Delivery, travel,
    and site costs are excluded until staff verifies the submitted address or ZIP.
    The API and saved pricing record carry
    `deliveryPricingStatus: pending_verification` (the public response exposes the
    equivalent nested estimate metadata).
- **Discount codes**:
  - `SUMMER10`: 10% off the full subtotal, including any distance surcharge.
  - The customer's code matches regardless of case or surrounding spaces, so
    `summer10` and `Summer10` apply `SUMMER10`. The saved quote keeps the
    customer's own spelling of the code.
  - A matching code applies only when its configured rate is above 0% and no
    more than 100%.
- **Saved quote metadata**:
  - New quote records identify the provider, pricing schema version, immutable
    CRM publication id/version when applicable, legacy source revision, and
    update time.
- **Foundation**:
  - `none` and `blocks_level`: $0. Blocking and leveling are part of the
    standard build.
  - `anchored_slab`: never priced online and never part of the build subtotal.
    David prices slab work from the customer's photos of the spot and, depending
    on what they show, most likely after seeing the site in person.
  - When a quote has an anchored slab, the foundation picker, price breakdown
    (**Anchored slab · Priced after site review**), and result screen say the
    slab is not in the subtotal, and the result screen asks for photos by text
    or email. David's SMS and email alerts mark the foundation
    `not in subtotal; price from photos/site visit`.
- **Descriptive selections**:
  - Roof material, frame gauge, ventilation, color, ZIP, and structure-type-specific descriptive choices do not add automatic pricing unless another listed rule applies.

Quotes returned by the public API include a detailed build-subtotal breakdown and
explicit delivery-verification metadata. They are not final prices until delivery,
travel, and site costs have been confirmed.
