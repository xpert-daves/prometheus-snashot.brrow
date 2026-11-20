# Shed210 SMS A2P Campaign Notes

Use this draft copy when registering an SMS campaign with Twilio, Telnyx,
Bandwidth, or another messaging provider. Keep it aligned with the live website
consent flow before submitting a campaign review. This document does not assert
that the current provider campaign has been approved for any listed message
category.

The September 27, 2026 quote-form change requires quote-related consent to use
the online tool. Verify provider acceptance of that flow and update registration
evidence before production rollout. The copy below describes the implementation;
it does not confirm that the existing campaign registration covers this change.

## Campaign Description

The online quote tool collects consent for Shed210 text messages about quote
requests, scheduling, and project updates. It does not collect promotional
consent. Any promotional program needs its own applicable consent and provider
approval; it must not treat the current quote checkbox as marketing opt-in.

## Message Flow

On the Shed210 quote form, users must actively check one initially unchecked
quote-related SMS consent box to submit an online estimate. The displayed body says:

> I agree to receive text messages from Shed210 about my quote request,
> scheduling, and project updates. Consent is not a condition of purchase.
> Message frequency may vary. Message and data rates may apply. Reply STOP to
> opt out or HELP for help. See our Privacy Policy and Terms & SMS Policy.
> Prefer not to receive texts? Call (855) 578-0944 for a quote.

The Privacy Policy and Terms & SMS Policy are links, and the phone number is a
tap-to-call link, so customers who decline texts have a direct way to get a
quote.
The server rejects online quote submissions without affirmative quote consent.
Consent is not required to purchase goods or services; customers can contact
Shed210 directly instead of using the online tool. Transactional consent stores
the exact quote-only text, linked disclosure text, and version
`shed210_quote_sms_consent_v4_2026_09_28`. Marketing consent remains ungranted.
The v3 wording (September 27, 2026), which said consent was "Required to use
the online quote tool," is still accepted from pages opened before the v4
release and is recorded with that original copy.
Historical and cached-client consent records retain their original scope and
copy, as described in [quote SMS consent](quote-sms-consent.md).

## Sample Messages

1. Shed210: Thanks for requesting a shed quote. We received your request and will follow up soon. Reply STOP to opt out or HELP for help.
2. Shed210: Your shed delivery/installation appointment is scheduled for [date/time]. Reply STOP to opt out or HELP for help.
3. Shed210: We have an update about your shed quote/order. Please contact us at [phone/email] when available. Reply STOP to opt out or HELP for help.

Before enabling any sample category, confirm that the provider registration and
configuration permit it; inclusion here is not evidence of provider approval.

## Live Consent Pages

- `/quote`
- `/privacy-policy`
- `/terms-and-conditions#sms-terms`
- `/sms-terms` redirects to `/terms-and-conditions#sms-terms` for old links.
