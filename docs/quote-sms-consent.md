# Quote-related SMS consent

The online quote tool requires one unchecked SMS checkbox covering quote
requests, scheduling, and project updates. It does not offer promotional opt-in.
The contact fields remain required; the existing compare action retains the
current in-memory form and consent choice. Reloading in the same tab restores
name, email and phone from `sessionStorage`, but never the consent choice, so
the box is unchecked again on every new page load.

`smsConsent.ts` owns the exact displayed and recorded copy. The current browser
payload sends `smsConsentOptIn`, `smsConsentTextVersion` equal to
`shed210_quote_sms_consent_v4_2026_09_28`, and `smsMarketingConsentOptIn: false`.
The v4 copy states that consent is not a condition of purchase and names the
phone alternative: "Prefer not to receive texts? Call (855) 578-0944 for a
quote." The number is a tap-to-call link. v3 ("Required to use the online quote
tool") is still accepted from pages opened before v4 and is recorded with its
original copy.
The quote API validates affirmative quote consent before calculating or saving
an estimate. Unknown copy versions and current-version requests that mix in
unified or promotional consent are rejected.

The API records the exact quote-only copy and version in `smsConsent` and leaves
`smsMarketingConsent` as `not_opted_in`, with no granted consent text/version.
Existing persistence and CRM mapping already carry these scopes separately;
there is no schema migration or historical record update.

For cached clients, affirmative legacy split or unified consent is still
accepted with its original displayed text and version. Legacy unified consent
explicitly included marketing, so both scopes retain that original proof. A
missing or declined legacy quote opt-in now fails validation; it is never
silently promoted to consent. The new form never sends the unified field.

Submitting a quote keeps the existing CRM acknowledgment workflow, including
recipient deduplication, opt-out checks, and provider sending rules. The saved
build follow-up action does not change consent or send another customer text.
Consent is not a delivery guarantee.

Before production rollout, verify the messaging provider registration and
approval for this required online-tool flow and its quote-related message
scope. Update registration evidence if required. The code and policy copy do
not establish provider approval. Preview and local checks must not send to
customers. SMS consent is not required to purchase; direct contact remains
available for people who do not use the online tool.
