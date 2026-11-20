# Review page

Review texts from the CRM link to `https://www.shed210.com/review/<code>`.
`<code>` is the 8-character Crockford base32 `reviewLinkCode` the CRM issues for
each review request. The personal link goes straight to Google, with no stars
and no private feedback box, so every customer gets the same Google link:

- **Android, computers, and other devices**: the page records the open, then
  replaces itself with `search.google.com/local/writereview` for
  `GOOGLE_PLACE_ID`. Chrome on Android is usually signed in to Google already.
- **iPhone and iPad**: one button, **Open Google Maps to review**, linking to
  `GOOGLE_MAPS_APP_URL`. Safari is often signed out of Google even when the
  Google Maps app is signed in, and only a tap (not a redirect) reliably hands
  the link to the app. The customer then taps Write a review on the listing.
  A smaller **Review in your browser** link goes to the web form.
- A mistyped code still goes to Google; nothing is recorded.

The stars-first page was replaced on 2026-10-10. Customers who picked 5 stars
there often tapped through to Google without posting, and sending only
unhappy customers to a private box sits close to review gating under Google's
policy and the FTC's 2024 consumer review rule.

`/review` with no code (cards, QR codes, older texts) goes straight to Google
the same way; the stars page it used until 2026-11-01 asked for a rating
first and sent 1-4 stars to call and text buttons, with Google as a small
link. Nothing is sent to the CRM without a code. Both routes are `noindex`,
and the floating quote CTA and phone action bar are hidden on them.

## Events

The browser posts to `POST /api/review-feedback` with
`{code, event, rating?, comment?, device?}`, where `event` is `opened`,
`rated`, `commented` or `google_opened`. The site now sends only `opened`,
since neither route collects a rating; the route still accepts the older
events. The CRM shows that open as the customer heading to Google. `opened` is sent once when a personal
link loads in a browser (link-preview bots don't run the script). It has no
rating and carries a coarse `device` (`iphone`, `android`, `desktop`, or
`other`), so the CRM can show "Opened their review link on an iPhone" and alert
staff. Opens use `keepalive` because the page navigates away immediately.

The route applies the same same-origin check, local plus shared rate limit
(20 per minute), and bounded JSON body as other public routes. It never logs
codes or comments. It calls the guarded Convex action `reviewFeedback:forward`
with `CONVEX_QUOTE_WRITE_KEY`. That action posts synchronously to the CRM's
`/api/intake/shed-review-feedback` using the existing validated
`FRONTIER_PIXEL_CRM_INTAKE_URL` origin and `FRONTIER_PIXEL_CRM_INTAKE_KEY`. It
is gated by `SHED_CRM_SYNC_ENABLED`.

There is deliberately no outbox. CRM events are idempotent. Unknown codes
return 404 ("This review link is no longer active.").

## Rollout

1. Deploy this site change. `/review` works immediately; personal links do too
   once the CRM receiver exists.
2. Deploy the CRM change that issues codes, adds the receiver, and switches the
   review text to the personal link.
3. Check on a real iPhone: signed out of Google in Safari, signed in, a private
   tab, and with the Google Maps app installed.
