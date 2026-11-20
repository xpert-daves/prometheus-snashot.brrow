# On-Site Build Language Plan

## Goal

Make it unmistakable that Shed210 crews bring the materials to the customer's
property and build sheds where they will stand. Avoid language that makes a
Shed210 project sound like a finished prefab building dropped off from a truck.

The limited exception is some dog houses, which may arrive assembled. That
exception should appear only where it is relevant to the selected product so it
does not weaken the main shed value proposition.

## Source of Truth

Customer-facing copy should consistently communicate these facts:

1. Shed210 sheds are built on the customer's property.
2. The crew brings the materials and equipment needed for the build.
3. Most shed builds are completed in one day after the project and site are
   confirmed.
4. Travel has no added distance charge within the current 35-mile service area;
   distance may affect a quote outside that area.
5. Some dog houses may be delivered assembled. Shed210 confirms the build or
   delivery method for those products before scheduling.

## Baseline Language Assessment

The site already leads with the right promise in several places:

- The home page metadata and hero say "Built On-Site in 1 Day."
- The home page process says, "We bring everything needed and build right in
  your backyard."
- Service-area content repeatedly refers to on-site builds.
- The San Antonio cost guide gives the clearest value explanation: Shed210
  constructs the shed in the yard instead of hauling in a finished building on
  a trailer, which makes tight access easier to solve.

At the start of this PR, that message was diluted by repeated use of "delivery"
on prominent surfaces:

| Surface | Original signal | Why it is unclear |
| --- | --- | --- |
| Home hero | "Free Delivery in SA Area" and "Projects Delivered" | Suggests the finished shed arrives on a truck immediately beside the on-site-build headline. |
| Home stats and footer | "Projects Delivered" and "500 projects delivered" | Measures Shed210 like a prefab delivery business instead of a local builder. |
| Home project gallery | "Site-built or delivered" | Directly presents delivery and site building as equivalent project methods without explaining the dog-house exception. |
| Home service-area map | "Free Delivery — 35 Mi Radius" | Frames the service-area benefit as product delivery instead of included crew/material travel. |
| Service-area directory | "Delivered Across the Region" and "delivery radius" | Conflicts with "Built Local" and understates the regional body of on-site work. |
| San Antonio service-area page | "delivery area," "Free delivery," and "unloading access" | Can sound like clearance is needed to move a finished shed, even though the access review is for the crew and materials. |
| Quote flow | "Delivery & Contact," "Delivery Details," "Delivery Zip," and "Schedule Delivery" | Makes delivery sound like the customer's final outcome and gives that concept an entire step in the purchase path. |
| Quote helper copy | "Built-on-site service may be included" | Makes on-site construction sound optional or like an add-on instead of the core method. |
| Contact and next steps | "delivery timing" | Uses logistics language for what is normally build-day scheduling. |
| Cost guide conclusion | "500+ projects ... delivered" | Reintroduces the weaker term after the article has clearly explained the on-site advantage. |

Internal uses of "delivery" also cover unrelated concepts such as SMS or CRM
message delivery. Those are accurate technical terms and are not part of this
copy change.

## Recommended Vocabulary

Use customer language based on building, project location, and travel:

| Instead of | Prefer |
| --- | --- |
| Free delivery | No distance fee within 35 miles |
| Delivery radius / delivery area | Included service area / 35-mile service area |
| Projects delivered | Sheds built / projects completed |
| Delivered across the region | Built across the region |
| Delivery & Contact | Build Location & Contact |
| Delivery Details | Build Location |
| Install Address | Build Address |
| Delivery ZIP | Build ZIP |
| Improve delivery accuracy | Improve quote accuracy |
| Schedule delivery | Schedule build day |
| Delivery timing | Build timing |
| Delivery assumptions | Travel assumptions |
| Unloading access | Crew and material access |

"Delivery" remains appropriate for:

- Dog-house-specific copy when an assembled product will actually be delivered.
- Operational or legal copy where delivery is genuinely one possible service.
- Message-delivery, notification, and CRM terminology.
- Internal API, database, analytics, and pricing identifiers retained for
  compatibility.

## Proposed Copy Direction

The exact copy can be refined in implementation, but these statements establish
the intended hierarchy:

- **Primary promise:** "We bring the materials and build your shed on your
  property—usually in one day."
- **Access value:** "Because we build where the shed will stand, we can often
  work with backyard access that would block a finished prefab shed."
- **Service-area value:** "On-site shed builds across the region, with no added
  distance fee within 35 miles of Shed210."
- **Quote helper:** "Your build location helps us estimate crew and material
  travel. There is no distance fee within our current 35-mile service area."
- **Product-aware exception:** "Sheds are built on your property. Some dog
  houses may arrive assembled; we will confirm the method before scheduling."

Do not place the dog-house qualifier beside every general shed claim. Show it in
the pet-structure selection or result flow and in one explanatory FAQ so the
exception is transparent without obscuring the standard shed process.

## Implementation Plan

### 1. Fix the highest-visibility contradictions

- Update the home hero trust/proof labels, stats strip, project-gallery footer,
  footer summary, service-area map badge, and service-area directory hero.
- Replace counts based on "delivered" with "built" or "completed."
- Remove "Site-built or delivered" and replace it with a direct on-property
  build benefit.

### 2. Reframe the quote journey around the build location

- Rename the visible third step and its accessible label to "Build Location &
  Contact."
- Rename the visible details control and fields to "Build Location," "Build
  Address," and "Build ZIP."
- Replace delivery-accuracy and delivery-timing copy with quote-accuracy,
  distance, access, and build-day language.
- Change the acceptance action from "Schedule Delivery" to "Schedule Build
  Day."
- Keep internal delivery field names where schema compatibility requires them.
  `deliveryRadius` is now legacy request input only: the public route normalizes
  it to zero, persists delivery as pending verification, and returns a build
  subtotal rather than treating browser mileage as authoritative.

### 3. Explain why on-site construction is valuable

- Bring a concise version of the cost guide's tight-access explanation onto a
  high-intent surface such as the home process or service-area section.
- Clarify that access checks concern the path for the crew and materials, not
  clearance for a completed shed.
- Reinforce build-day language in contact and quote next-step copy.

### 4. Handle the dog-house exception contextually

- Confirm exactly which dog-house configurations may arrive assembled.
- Add conditional copy for those configurations in the quote selection/result
  experience.
- Add one general FAQ that distinguishes sheds from the limited assembled
  dog-house case.
- Do not imply that sheds may switch between site-built and delivered methods.

### 5. Align supporting content

- Update page metadata, service-area content, the cost guide conclusion, and
  customer-facing operations documentation where "delivery" describes a shed
  build.
- Preserve accurate legal references to "delivery or installation" unless
  business/legal review decides they should be narrower.
- Preserve SMS, email, CRM, and notification uses of delivery.

### 6. Update and validate tests

- Update assertions for renamed headings, controls, field labels, accessible
  names, and proof labels.
- Add coverage that the standard shed flow says it is built on the property.
- Add coverage for the dog-house exception once the eligible configurations are
  confirmed.
- Run `pnpm lint` and `pnpm test`.
- Finish with a targeted search of public source files for `delivery`,
  `delivered`, and `install` so every remaining customer-facing use is reviewed
  intentionally.

## Scope Guardrails

The 35-mile included service-area business rule remains unchanged, but the
public browser no longer claims to verify mileage or apply a distance surcharge.
This rollout deliberately changes the quote contract in these bounded ways:

- Legacy `deliveryRadius` input is accepted for compatibility but normalized to
  zero before server pricing.
- The public response is a build subtotal and marks delivery pricing as pending
  verification.
- Convex storage and the CRM payload carry the optional pending-verification
  status so downstream copy cannot present zero miles as verified.

Internal notification-delivery terminology and legal terms remain unchanged
unless business/legal review explicitly approves a separate change.

## Remaining Product Decision

1. Which dog-house sizes or configurations can arrive assembled?

This decision is required for conditional dog-house copy.

## Confirmed Wording Decision

Use "No Distance Fee Within 35 Miles" in place of "Free Delivery in SA Area."
This preserves the pricing benefit without implying that a finished shed is
delivered.

The 500+ proof point uses "Projects Completed" until the dog-house mix is known.
That removes the delivery implication without claiming every counted project
was an on-site shed build.

## Implementation Status

Completed in this PR:

- Updated the home hero trust item.
- Updated the shared map badge and accessible service-area description.
- Updated the home service-area caption and San Antonio coverage copy.
- Reframed the service-area directory around on-site builds, service guidance,
  and the no-distance-fee area.
- Renamed visible quote steps and fields around build location, quote accuracy,
  and build-day scheduling while preserving internal delivery identifiers.
- Replaced "Projects Delivered" with "Projects Completed."
- Replaced ambiguous public gallery and project "install" language with
  "build/built."
- Normalized CRM-fed project model names, blurbs, and photo descriptions at the
  public-data boundary so externally authored copy cannot reintroduce
  portable-building, delivery, or shed-install framing.
- Added regression coverage for the home hero, maps, service-area pages, quote
  flow, proof counts, footer, contact page, recent-build sections, and CRM-fed
  project copy, plus a source-level guard against reintroducing the misleading
  phrase families.

Remaining source matches are intentionally limited to:

- Legal privacy and terms language that covers delivery or installation as a
  possible service.
- Internal API, form, pricing, analytics, and DOM identifiers.
- Notification and CRM message-delivery terminology.
- The cost guide's intentional comparison with a prefab delivery truck.
- The build-video sentence describing the crew installing exterior materials.
