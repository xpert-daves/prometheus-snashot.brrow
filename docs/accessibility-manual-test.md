# Manual Accessibility Test Protocol

Use this protocol against the Vercel Preview for the exact commit being
reviewed, then repeat the release-blocking checks against production after
deployment. It supplements automated testing; it does not replace a qualified
accessibility or legal review.

## Prepare the test

1. Record the commit SHA, deployment URL, date, tester, operating system,
   browser version, screen-reader version, viewport, and zoom level.
2. Confirm the Preview uses preview-safe Convex and notification settings.
   Submit a quote only when the Preview cannot notify production recipients or
   write to production data.
3. Use current stable browsers and assistive technology with default settings.
   Disable unrelated browser extensions.
4. Test complete tasks, not isolated controls. Do not use the mouse or visual
   inspection to recover from a keyboard or screen-reader failure.

Recommended minimum screen-reader matrix:

- Current [NVDA](https://www.nvaccess.org/download/) with current Firefox or
  Chrome on Windows.
- Current VoiceOver with Safari on macOS. Apple provides a
  [VoiceOver User Guide](https://support.apple.com/guide/voiceover/welcome/mac)
  and built-in tutorial.
- VoiceOver with Safari on a current iPhone for the mobile menu, quote flow,
  and dialogs when hardware is available.

An experienced assistive-technology user should perform or review this testing
whenever a formal conformance claim is being considered.

## Screen-reader and keyboard tasks

For each task, first read sequentially from the top. Then use the
screen-reader's lists or rotor to inspect landmarks, headings, links, form
controls, and images.

### Site navigation and home page

- The first keyboard focus is **Skip to content**, and activating it moves
  focus to the main content.
- Landmarks and headings provide a useful outline without skipped or misleading
  levels.
- Desktop and mobile navigation links have clear names and current-page state.
- Opening the mobile menu moves focus into it. Escape closes it and returns
  focus to the menu button. Closed-menu links are not reachable.
- The animated hero has a clearly named pause/play control. With reduced motion
  enabled, the animation does not load.
- The build-video dialog announces its title and visual description. Focus stays
  inside the dialog, Escape closes it, and focus returns to the opener.

### Quote process

Complete all three steps, including these states:

- Submit the first step without a structure. Focus moves to **Structure Type**.
- Select a structure and confirm the next step announces or focuses its heading.
- Every visible input has a useful label; required fields and current
  selections are announced without relying on color.
- On the contact step, no location dialog opens. Open **Build Location** and
  activate **Use Current Location**; the browser asks for location only then,
  and the filled ZIP and address are announced.
- On the contact step, activate **Get Quote** with the fields empty. Focus moves
  to **Name** and the guidance explains what is missing.
- Enter invalid email and phone values. Each error is announced and associated
  with the relevant field.
- Complete a safe Preview submission when preview notifications and data are
  isolated. The result and next actions must be announced and operable.
- Navigate backward and between available steps without losing values or focus.

### Remaining content

- Gallery and project images have concise, useful alternatives; decorative
  graphics are skipped.
- The service-area map has a text description followed by understandable city
  links. It does not expose a long sequence of unlabeled map markers.
- Articles, breadcrumbs, reviews, legal pages, and the footer have meaningful
  link names and a logical reading order.
- The accessibility page's email, text, contact-page, and equivalent-quote
  options are usable.

## Forced colors and contrast themes

On Windows 11, open **Settings → Accessibility → Contrast themes**, apply a
theme, and test with current Edge or Chrome. Microsoft documents the same
setting in its
[Edge accessibility guide](https://support.microsoft.com/en-us/accessibility/edge/accessibility-features-in-microsoft-edge).

Check every representative route and each quote state:

- Text, links, buttons, fields, selected states, errors, icons, and focus
  indicators remain visible.
- Button and input boundaries are still identifiable.
- Links and validation states are not communicated by color alone.
- Images do not cover text, and hidden decorative layers do not become
  distracting.
- The fixed quote action bar does not obscure the focused control.

Chrome DevTools can emulate `forced-colors`, `prefers-contrast`, and
`prefers-reduced-motion` from the Rendering panel. Treat emulation as an extra
check, not a replacement for a real Windows contrast theme.

## Zoom, text resize, and reflow

Use a desktop browser window approximately 1280 CSS pixels wide:

1. Test full-page zoom at 200%.
2. Test full-page zoom at 400%, or resize the content viewport to 320 CSS
   pixels wide.
3. In Firefox, also enable **View → Zoom → Zoom Text Only** and increase text to
   200%.

At each setting:

- All text and controls remain present, legible, and operable.
- Text is not clipped, overlapped, or replaced by ellipses that hide essential
  information.
- The page does not require horizontal scrolling to read ordinary content.
- Menus, dialogs, form errors, and the quote action bar fit in the viewport.
- Keyboard focus is not completely hidden by sticky or fixed content.

W3C explains that a 320 CSS-pixel viewport represents a 1280-pixel viewport at
400% zoom in its
[Reflow guidance](https://www.w3.org/WAI/WCAG21/Understanding/reflow), while
[Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text)
requires text to reach 200% without loss of content or functionality.

## Text over images and gradients

Automated scanners may be unable to resolve layered backgrounds. Review every
foreground/background combination manually, including hero video frames,
cards, dialogs, hover states, focus states, disabled states, and error text.

1. Pause animation and choose the least-contrasting visible background area
   behind the text.
2. Use the Chrome DevTools color picker/contrast details or another
   contrast-ratio tool to measure the rendered foreground and that background.
3. Require at least 4.5:1 for normal text and 3:1 for large text.
4. Require at least 3:1 for essential control boundaries, focus indicators,
   states, and meaningful graphics against adjacent colors.
5. Capture the measured colors, ratio, route, element, and screenshot. Record a
   failure if the worst realistic image or gradient area does not pass.

The W3C contrast guidance requires testing the
[background behind the text](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum)
and, for gradients and UI graphics, the
[least-contrasting area](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html).

## Evidence record

Use one row per task or finding:

| Date | Commit / deployment | OS | Browser | Assistive technology / setting | Route and task | Result | Issue / evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD | SHA and Preview URL | Windows 11 | Firefox version | NVDA version | Quote invalid email | Pass / Fail | Screenshot, recording, or issue URL |

Before a formal conformance claim:

- Resolve every known WCAG Level A and AA failure across complete pages and
  complete processes.
- Retest fixes with the combination that found the issue.
- State the exact site scope, WCAG version and level, date, and any third-party
  content exclusions.
- Keep the completed report with the release record and update the public
  accessibility page's review date.

Use the W3C
[WCAG-EM methodology](https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/)
and
[accessibility evaluation report template](https://www.w3.org/WAI/test-evaluate/report-template/)
when preparing a formal report.
