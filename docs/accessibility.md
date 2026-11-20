# Accessibility

Shed210 uses WCAG 2.2 Level AA as the technical accessibility target. This is
an engineering and content-maintenance standard, not a legal certification.

## Current safeguards

- Every public page has an English document language, a unique page title, one
  main landmark, and a keyboard-focusable `#main` skip-link destination.
- Interactive elements receive a high-contrast focus indicator.
- The mobile menu and modal viewers manage keyboard focus and restore it when
  closed.
- Optional hero motion has a pause control and is not loaded when the visitor
  requests reduced motion.
- The silent build video includes an equivalent text description.
- The quote tool uses native labels, required-field semantics, error
  descriptions, status messages, and focus guidance between steps.
- The project map includes a text description and places a labeled city-link
  list immediately after the visual map.
- Third-party Facebook embeds are not placed inside the site. Accessible links
  lead to the external content instead.
- `/accessibility` explains the target and gives visitors an email, text, and
  contact-page route for reporting barriers or requesting an equivalent quote
  workflow.

## Engineering audit — 2026-07-27

The local, hydrated application was checked in Chromium at desktop and mobile
sizes:

- Automated WCAG A/AA scans reported zero decided violations across 12
  representative desktop routes and seven mobile routes.
- All three quote steps, the location dialog, and the blank-contact guidance
  state were scanned separately with no decided violations.
- The skip link, mobile-menu focus behavior, hero-video dialog focus trap and
  focus return, motion pause control, and reduced-motion fallback were exercised
  in the browser.
- Seven representative routes had no horizontal scrolling at a 320 CSS-pixel
  viewport.
- Lint, the complete unit-test suite, type checking, and the production build
  passed.

Automated contrast checks could not resolve text over the site's layered
pseudo-elements and gradients, so those results remain manual review items.
Before publishing a formal conformance claim, repeat the checks against the
deployed production site and document testing with current screen-reader/browser
pairs, forced-colors mode, and browser zoom. Follow the
[manual accessibility test protocol](accessibility-manual-test.md) and retain
its evidence record with the release.

## Release checks

Test at least these routes:

- `/`
- `/quote`, including all three steps, validation errors, **Use Current
  Location** in Build Location, and the quote result
- `/gallery`, including filters, reviews, and the photo viewer
- `/contact`
- `/service-area` and one city route
- `/news`, one article, and one project page
- `/accessibility`, `/privacy-policy`, and `/terms-and-conditions`

For each representative route:

1. Run the repository lint and unit tests.
2. Run an automated WCAG A/AA scan in a real browser and review both violations
   and “needs review” results.
3. Complete the page using only the keyboard. Confirm focus order, focus
   visibility, Escape behavior, dialog focus containment, and focus return.
4. Check at 200% and 400% browser zoom, plus a 320 CSS-pixel-wide viewport.
5. Check normal, reduced-motion, and forced-colors/high-contrast settings.
6. Review text over images and gradients manually; automated contrast tools
   cannot reliably calculate those backgrounds.
7. Test the quote process with at least one current screen reader/browser pair
   on Windows and one on Apple platforms.
8. Confirm all newly added images, video, and audio have appropriate text
   alternatives, descriptions, captions, or transcripts.

Automated results are evidence, not proof of conformance. A WCAG conformance
claim should cover complete pages and complete processes and should only be
made after the manual checks above are documented.

## Content and design maintenance

- Do not communicate required state, errors, price changes, or selections by
  color alone.
- Keep normal text at 4.5:1 contrast and large text and essential UI graphics
  at 3:1 or better.
- Keep controls at least 24 by 24 CSS pixels; prefer 44 by 44 pixels for primary
  and touch-heavy actions.
- Preserve visible labels even when an accessible name is also present.
- Do not add autoplaying or auto-advancing content without a nearby pause,
  stop, or hide control.
- Do not add drag-only functionality. Provide buttons or another single-pointer
  and keyboard-operable alternative.
- Avoid accessibility overlay widgets. Fix barriers in the underlying content,
  design, and code.

Record the audit date, browser and assistive-technology versions, routes,
results, and remediation owner for each production review.
