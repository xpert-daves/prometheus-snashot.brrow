# Search and buying-path improvements — September 23, 2026

This release addresses concrete customer-facing gaps found during the September
search decline investigation. It does not establish the cause of that decline or
promise a ranking increase.

## Customer behavior

- Header, mobile menu, footer, contact page, and quote results offer separate
  Call and Text actions. Native `tel:` and `sms:` links use the same configured
  phone number; phone clicks enter existing click measurement, not completed-call
  or lead totals. The mobile header can shrink its logo to avoid CTA overlap.
- Building-specific quote links carry a catalog-validated `structureType`. An
  empty quote selects that type. A configured saved draft is preserved unless the
  customer explicitly chooses to start a replacement; matching drafts resume.
  Restoration runs once and persistence waits for hydration. Consumed type
  parameters are removed without dropping attribution parameters or router state.
- The quote introduction explains that contact details precede the estimated
  build subtotal, and that travel/site costs need separate confirmation.
- Client, API, and input bounds share whole-foot dimension and window limits.
  Fractional dimensions and more than 20 windows receive inline errors. This
  closes an edge case, not a demonstrated source of lost leads.

## Page intent and completed work

- Buildings metadata and H1 explicitly describe sheds and custom buildings in
  San Antonio. San Antonio city metadata describes its local projects/planning
  role. Homepage title, canonical policy, and URL inventory are unchanged.
- Within the existing six newest homepage projects, the most recent storage
  project leads. The buildings preview likewise leads with storage and preserves
  other types. Selection uses existing model classification; the gallery remains
  chronological and locations are not inferred.
- Completed-build prices are labeled as historical, including the completion
  date on detail pages. Project schema remains CreativeWork, without a current
  Offer. Related-build cards rank known type matches, then actual city matches,
  exclude self/duplicates, and do not fill remaining slots with unrelated work.
- Cibolo, Schertz, and New Braunfels now link verified City resources and explain
  practical planning steps. Cibolo and Schertz were on the September 7 discovery
  backlog; New Braunfels was not. No blanket noindex or sitemap removal was used.

## Local resource verification

- [Cibolo residential process](https://www.cibolotx.gov/business/building_permits___inspections/residential_projects.php)
  and [HOA directory](https://www.cibolotx.gov/community/neighborhood_associations.php).
- [Schertz shed placement](https://schertz.com/223/Carport-Shed-Garage-Sale-Information),
  [permit FAQ](https://www.schertz.com/2314/Frequently-Asked-Questions), and
  [permit overview](https://schertz.com/456/Building-Permits). City pages describe
  exactly 120 square feet differently; the content directs that case to City
  confirmation instead of declaring an exemption.
- [New Braunfels permits](https://newbraunfels.gov/buildingpermits).

## Evaluation

Judge this release by comparable periods of local nonbranded search clicks,
accepted quotes, qualified enquiries, and eventual sales. Phone/text click events
are intent signals. Do not treat them as answered calls or qualified leads.
September 2 supplied 590 of 1,144 homepage impressions in its comparison week,
but only one click; optimizing for recovery of that spike is not the objective.

The September 23 public HTML crawl found 67 sitemap URLs responding successfully,
including 26 city and 29 project pages. Twenty-one project pages had exactly two
referring main-content pages and two had only one. Those counts motivated useful
project comparisons; they do not prove a ranking penalty or indexing rejection.

No pricing rules, CRM schema, data migrations, consent requirements, or outbound
message behavior changed. A test submission must use mocks or an isolated preview;
do not create production quotes solely to check this release.
