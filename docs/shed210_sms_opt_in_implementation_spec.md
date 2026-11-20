# Shed210 SMS Opt-In Implementation Spec

> **Current quote flow — September 28, 2026:** The online quote form now uses
> one unchecked, required quote-related SMS checkbox. It sends `smsConsentOptIn`
> with version `shed210_quote_sms_consent_v4_2026_09_28` and sets marketing consent
> to false. The API rejects missing or declined quote consent. The following
> July specification is retained as historical context for existing consent
> records and cached clients; its optional unified quote-form instructions are
> superseded. See [current implementation and rollout notes](quote-sms-consent.md).
> No historical consent records are rewritten. Provider registration and the
> required online-tool flow must be verified before production rollout; this
> implementation is not evidence of provider approval.

**Developer Handoff Document**
**Version:** 1.1
**Prepared:** July 31, 2026

> This document is implementation guidance, not legal advice. Have final legal
> language reviewed by a qualified attorney if the business wants legal
> certainty. The implementation should be conservative: no automated SMS unless
> the unified consent is recorded, send only the first-party Shed210 message
> categories disclosed at opt-in, and respect opt-outs across the system.

---

## What this document is for

Build SMS opt-in, consent logging, opt-out handling, legal-page support, and outbound SMS guardrails for **Shed210.com**.

The goal is to support recurring first-party Shed210 SMS, including:

- Shed quote requests
- Orders
- Delivery coordination
- Installation coordination
- Appointments
- Service requests
- Customer support
- Shed210 marketing or promotional offers

### Main rule

SMS consent must be:

- Optional
- Clearly disclosed
- Unchecked by default
- Logged with proof
- Enforced before any automated text is sent

### Scope

The quote-form opt-in covers recurring first-party text messages from Shed210,
including quote, scheduling, and project updates as well as Shed210 marketing or
promotional offers.

This consent design does not establish that any messaging provider has approved
the corresponding campaign or use case. Keep provider registration and sending
configuration aligned with the live consent flow before sending any message
category.

### Brand identity

Outbound messages should identify **Shed210**.

Do **not** register or send messages under Frontier Pixel if the customer-facing brand is Shed210.

### Provider-agnostic design

Design this to work with Twilio, Telnyx, Bandwidth, or another provider by isolating provider calls behind one SMS service module.

---

## 1. Required Public Pages

Create or update these public routes. They must not require authentication, must be accessible from the main site, and should not be blocked by `robots.txt`.

| Route | Purpose | Required SMS Content |
|---|---|---|
| `/privacy-policy` | Privacy Policy | Must include the mobile information privacy clause listed in Section 11. |
| `/terms-and-conditions` | Terms & Conditions and SMS Policy | Must include the complete SMS policy section listed in Section 10 with an `sms-terms` anchor. |
| `/sms-terms` | Legacy SMS Terms URL | Must redirect to `/terms-and-conditions#sms-terms`. |

Add footer links sitewide:

- Privacy Policy
- Terms & SMS Policy

---

## 2. Forms That Need SMS Opt-In

Add the SMS consent checkbox to every Shed210 form that collects a phone number and could lead to SMS communication.

Required forms:

- Main quote/request form
- Contact form
- Request estimate form
- Appointment/service request form
- Any future lead form that collects a phone number
- Any admin-created lead flow if admin is recording customer consent

---

## 3. Exact Unified SMS Consent Checkbox Copy

The quote form has one unified SMS checkbox. It must be unchecked by default and
optional. The user must actively check it, and leaving it unchecked must not
prevent the user from getting a quote or purchasing goods or services.

### Displayed Body Copy

```text
I agree to receive recurring first-party text messages from Shed210, including messages about my quote request, scheduling, project updates, and Shed210 marketing or promotional offers. Message frequency may vary. Message and data rates may apply. Reply STOP to opt out or HELP for help. Consent is not required to get a quote or purchase goods or services.
```

Place the linked disclosure immediately after the body copy:

```text
See our Privacy Policy and Terms & SMS Policy.
```

The phrases below should be clickable links:

- `Privacy Policy` → `/privacy-policy`
- `Terms & SMS Policy` → `/terms-and-conditions#sms-terms`

---

## 4. UI and Consent Rules

- Render one unified SMS checkbox on the quote form.
- The checkbox must be unchecked by default and optional.
- A quote submission must succeed when the checkbox is unchecked; SMS consent is
  not required to get a quote or purchase goods or services.
- The visible body copy must explicitly disclose both quote-related messages and
  Shed210 marketing or promotional offers.
- Do not bundle SMS consent into a general “I agree to terms” checkbox.
- Do not hide SMS disclosures behind a modal only. The important disclosure text must be visible near the phone field/form submit area.
- Store the exact consent text and version shown when the user opted in.
- The UI and public quote API use one unified opt-in value.
- For CRM compatibility, the backend continues to store separate transactional
  and marketing consent proof records. When the unified checkbox is checked,
  both records must use the same exact combined consent text (the body plus the
  linked disclosure text), consent-text version, timestamp, source, page URL,
  and available request metadata.
- When the unified checkbox is unchecked, neither transactional nor marketing
  SMS is authorized. The quote itself must still be saved normally.
- Use a new shared consent-text version for this disclosure, for example
  `shed210_unified_sms_consent_v1_2026_07`; do not reuse either legacy version.

---

## 5. Data Model Requirements

Recommended design: keep current SMS status on the lead/customer record, but also create a history table for consent and opt-out events.

If the existing app is simple, fields on the lead/customer table are acceptable for the first version, but an event log is better long-term.

### 5.1 Current Status Fields on Lead/Customer

| Field | Type / Values | Notes |
|---|---|---|
| `smsConsentStatus` | enum: `opted_in`, `opted_out`, `not_opted_in` | Current SMS eligibility status. Default: `not_opted_in`. |
| `smsConsentSource` | enum/string | Examples: `website_quote_form`, `website_contact_form`, `admin_manual`, `text_start`, `import`, `unknown`. |
| `smsConsentTimestamp` | timestamp | When user opted in. |
| `smsConsentText` | text | Exact unified consent text shown to the user: the body plus the linked disclosure text. |
| `smsConsentTextVersion` | string | Shared version for the unified disclosure, for example `shed210_unified_sms_consent_v1_2026_07`. |
| `smsConsentPageUrl` | text/url | URL where opt-in happened. |
| `smsConsentIpAddress` | string nullable | Capture if available. |
| `smsConsentUserAgent` | text nullable | Capture if available. |
| `smsMarketingConsentStatus` | enum: `opted_in`, `opted_out`, `not_opted_in` | Separate backend marketing status retained for CRM compatibility. Default: `not_opted_in`. |
| `smsMarketingConsentText` | text | The same exact unified consent text stored in `smsConsentText` when the user opts in. |
| `smsMarketingConsentTextVersion` | string | The same shared unified version stored in `smsConsentTextVersion`. |
| `smsOptOutTimestamp` | timestamp nullable | When user opted out. |
| `smsOptOutSource` | enum/string nullable | Examples: `inbound_stop`, `admin_manual`, `email_request`, `phone_request`, `website_request`, `other`. |
| `smsLastHelpRequestedAt` | timestamp nullable | When user last texted HELP. |
| `smsProvider` | string nullable | `twilio`, `telnyx`, `bandwidth`, `other`. |
| `phoneNormalized` | string | E.164 formatted phone number, example `+12105551234`. |

### 5.2 Optional but Recommended: `sms_consent_events`

| Field | Type / Values | Notes |
|---|---|---|
| `id` | uuid/string | Primary key. |
| `leadId` / `customerId` | foreign key nullable | Link to lead/customer if available. |
| `phoneNormalized` | string | E.164 phone number. |
| `eventType` | enum | `opt_in`, `opt_out`, `help`, `start`, `manual_opt_out`, `send_blocked`. |
| `source` | string | `website_quote_form`, `inbound_stop`, `admin_manual`, etc. |
| `consentText` | text nullable | Exact consent text for opt-in events. |
| `consentTextVersion` | string nullable | Version of consent language. |
| `pageUrl` | text nullable | Page where consent happened. |
| `ipAddress` | string nullable | If available. |
| `userAgent` | text nullable | If available. |
| `createdAt` | timestamp | Event timestamp. |
| `metadata` | json nullable | Provider data, admin note, webhook payload subset, etc. |

---

## 6. Phone Normalization

- Normalize all phone numbers to E.164 before saving or sending SMS.
- For US numbers, store as `+1XXXXXXXXXX`.
- If a phone number is invalid, save the lead if possible but block SMS sends and show a clear validation error/warning.
- Use one shared normalization utility in the backend. Do not duplicate phone formatting logic in multiple places.

---

## 7. Centralized Outbound SMS Service

All outbound SMS must go through one server-side function/service.

Do **not** scatter provider calls throughout the codebase.

Recommended service signature:

```ts
sendShed210Sms({
  leadId,
  customerId,
  to,
  body,
  category,
})
```

The send function must enforce these guardrails before calling the SMS provider:

- Phone number is valid and normalized.
- The applicable backend consent status is `"opted_in"`. Quote-form unified
  opt-ins should have matching opted-in transactional and marketing proof
  records with the same exact unified text and version.
- No opt-out timestamp exists after the latest opt-in.
- Phone number is not on a global opt-out list.
- Message body is not empty and identifies Shed210.
- The message category is allowed by the configured provider campaign or use
  case. Do not infer provider approval from this implementation spec:
  - `quote_update`
  - `order_update`
  - `appointment`
  - `delivery`
  - `installation`
  - `service_request`
  - `support`
  - `marketing_offer`
  - `optin_confirmation`
  - `help_response`
  - `stop_confirmation`
- Every send attempt is logged, including blocked attempts.

### 7.1 SMS Message Log

| Field | Type / Values | Notes |
|---|---|---|
| `id` | uuid/string | Primary key. |
| `leadId` / `customerId` | foreign key nullable | Link to lead/customer if available. |
| `toPhone` | string | Normalized destination phone. |
| `fromPhone` | string nullable | Provider number used. |
| `direction` | enum: `outbound`, `inbound` | Message direction. |
| `body` | text | Message content. |
| `providerMessageId` | string nullable | Twilio SID / provider equivalent. |
| `status` | string | `sent`, `delivered`, `failed`, `received`, `blocked`, `queued`, `unknown`. |
| `category` | string | `quote_update`, `appointment`, `delivery`, etc. |
| `blockedReason` | text nullable | Why a message was not sent. |
| `rawProviderPayload` | json nullable | Optional. Avoid storing unnecessary sensitive data. |
| `createdAt` | timestamp | Created timestamp. |
| `updatedAt` | timestamp | Updated timestamp. |

---

## 8. Inbound SMS Webhook

Create a provider webhook endpoint for incoming SMS replies.

Example route:

```text
/api/sms/inbound
```

The webhook should verify the provider signature if the selected SMS provider supports request signing.

Log inbound messages before handling keywords.

### 8.1 STOP / Opt-Out Keywords

Handle these keywords case-insensitively and with surrounding whitespace trimmed:

```text
STOP
STOPALL
UNSUBSCRIBE
CANCEL
END
QUIT
REVOKE
OPT OUT
```

When received:

- Set `smsConsentStatus = opted_out`.
- Set `smsOptOutTimestamp = now`.
- Set `smsOptOutSource = inbound_stop`.
- Create a consent event: `opt_out`.
- Add or update a global phone-level opt-out record.
- Log the inbound message.
- Reply once with the opt-out confirmation below.

```text
Shed210: You have opted out and will no longer receive text messages from Shed210. Reply START to opt in again.
```

### 8.2 HELP Keyword

If the incoming message is `HELP`:

- Log the inbound message.
- Set `smsLastHelpRequestedAt = now`.
- Reply with the support message below.

```text
Shed210: For help, contact us at [Shed210 phone/email]. Msg&data rates may apply. Reply STOP to opt out.
```

### 8.3 START Keyword

If START re-opt-in is implemented, do it intentionally and log it as a new opt-in source.

Do not treat a bare START keyword as acceptance of the quote form's unified
marketing disclosure unless the approved START flow presents that disclosure
and records affirmative consent to the exact text and version.

If the provider handles START automatically, confirm how provider-level opt-in interacts with app-level consent.

When received and accepted:

- Set `smsConsentStatus = opted_in`.
- Set `smsConsentSource = text_start`.
- Set `smsConsentTimestamp = now`.
- Clear `smsOptOutTimestamp` only if the new START is valid and intentional.
- Create a consent event: `opt_in`.
- Reply with the confirmation below.

```text
Shed210: You are opted in to receive texts about your quote, order, delivery, installation, appointment, service request, or support. Msg freq varies. Msg&data rates may apply. Reply STOP to opt out or HELP for help.
```

### 8.4 Inbound Matching

- Match inbound phone number to lead/customer by normalized phone number.
- If multiple records exist for the same phone number, update the most recent active record and always update phone-level opt-out/opt-in state.
- Do not rely only on lead ID for opt-out protection. A number that opted out from one record must not be texted from another duplicate record.

---

## 9. Global Opt-Out Protection

Implement phone-level opt-out protection.

If a phone number opts out, the system must block SMS to that same phone number even if another lead record exists.

Recommended table:

| Field | Type / Values | Notes |
|---|---|---|
| `phoneNormalized` | string | Unique key if possible. |
| `status` | enum: `opted_in`, `opted_out`, `unknown` | Phone-level SMS state. |
| `lastOptInAt` | timestamp nullable | Latest known opt-in. |
| `lastOptOutAt` | timestamp nullable | Latest known opt-out. |
| `source` | string nullable | `inbound_stop`, `text_start`, `admin_manual`, etc. |
| `createdAt` / `updatedAt` | timestamp | Audit timestamps. |

---

## 10. Terms & SMS Policy Section Content

Publish this content inside `/terms-and-conditions` with an `sms-terms` anchor.
Keep `/sms-terms` as a redirect to `/terms-and-conditions#sms-terms`.

Replace placeholders before launch.

## SMS Terms & Messaging Policy

**Effective Date:** [Month Day, Year]

## Types of Messages

If you opt in to receive text messages from Shed210, you agree to receive recurring first-party SMS or MMS messages from Shed210, including messages related to your shed quote, order, delivery, installation, appointment, service request, customer support, and Shed210 marketing or promotional offers.

Messages may include quote updates, appointment reminders, order updates, delivery or installation coordination, service updates, customer support messages, and Shed210 marketing or promotional offers.

Consent is not required to get a quote or purchase goods or services.

## Message Frequency

Message frequency varies depending on your quote, order, appointment, service
activity, and applicable Shed210 offers.

## Message and Data Rates

Message and data rates may apply depending on your mobile carrier and plan.

## Opt-Out Instructions

You may opt out of receiving text messages at any time by replying **STOP** to any message.

You may also contact us using the contact information below to request that we stop sending SMS messages.

After you opt out, you may receive one final confirmation message confirming that you have been unsubscribed. After that, you will no longer receive SMS messages from Shed210 unless you opt in again.

## Help Instructions

For help, reply **HELP** to any message or contact us at:

**Email:** [Shed210 Email]
**Phone:** [Shed210 Phone Number]

## Mobile Information Privacy

We do not sell, rent, or share your mobile phone number, SMS opt-in information, or text message consent with third parties or affiliates for marketing or promotional purposes.

We may share information with service providers who help us operate our messaging program, such as SMS delivery providers, only as needed to provide those services.

## Carrier Disclaimer

Mobile carriers are not liable for delayed or undelivered messages.

## Eligibility

By opting in, you confirm that you are the account holder or authorized user of the mobile phone number provided and that you are authorized to consent to receive text messages.

## Changes to These Terms

We may update these Terms from time to time. Updates will be posted on this page with a revised effective date.

## Contact

Shed210
**Email:** [Shed210 Email]
**Phone:** [Shed210 Phone Number]
**Address:** [Business Address, if applicable]

---

## 11. Required Privacy Policy SMS Clause

Insert this clause into `/privacy-policy` under a section like **SMS and Mobile Messaging Privacy**.

```text
If you provide your mobile phone number and opt in to receive text messages, we may use your phone number to send recurring first-party SMS or MMS messages from Shed210, including messages related to your inquiry, quote, order, delivery, installation, appointment, service request, customer support, and Shed210 marketing or promotional offers. Consent is not required to get a quote or purchase goods or services.

Message frequency varies. Message and data rates may apply. You may opt out at any time by replying STOP to any text message or by contacting us directly. For help, reply HELP or contact us using the information below.

No mobile information will be shared with third parties or affiliates for marketing or promotional purposes. This includes mobile phone numbers, SMS opt-in data, and text message consent. We may share mobile information with service providers who help us deliver text messages, but only as necessary for them to provide services to us.
```

---

## 12. Required Terms & Conditions SMS Clause

Insert this clause into `/terms-and-conditions` under **SMS Terms & Messaging Policy** with `id="sms-terms"`.

```text
If you opt in to receive text messages from Shed210, you agree to receive recurring first-party SMS or MMS messages from Shed210, including messages related to your shed quote request, scheduling, project updates, delivery, installation, appointment, service request, customer support, and Shed210 marketing or promotional offers. Consent is not required to get a quote or purchase goods or services.

Message frequency may vary. Message and data rates may apply. Reply STOP to opt out or HELP for help. See our Privacy Policy for more information.
```

---

## 13. Admin / CRM Requirements

In the admin lead/customer view, show:

- Transactional and marketing SMS consent statuses
- Consent timestamp
- Consent source
- Consent text and version for both backend proof records
- Opt-out timestamp if any
- Latest inbound/outbound SMS messages
- Whether SMS sending is currently allowed
- Blocked reason if sending is not allowed

Admin actions:

- Allow admin to manually mark a customer as opted out if the customer asks by phone, email, in person, or another clear method.
- Do not allow admin to manually opt someone in unless there is a recorded consent source and note.
- If admin tries to send SMS to someone not opted in or opted out, disable the send button and show the message below.

```text
SMS blocked: this contact has not opted in or has opted out.
```

---

## 14. SMS Auto-Reply Templates

| Event | Message |
|---|---|
| Web opt-in confirmation | `Shed210: Thanks for opting in. You may receive recurring texts about your quote, order, delivery, installation, appointment, support, and Shed210 offers. Msg freq varies. Msg&data rates may apply. Reply STOP to opt out or HELP for help.` |
| HELP response | `Shed210: For help, contact us at [Shed210 phone/email]. Msg&data rates may apply. Reply STOP to opt out.` |
| STOP confirmation | `Shed210: You have opted out and will no longer receive text messages from Shed210. Reply START to opt in again.` |
| START confirmation | Use only for an intentionally designed and provider-compatible START flow. Do not claim unified marketing consent unless that flow presents and records the exact unified disclosure. |

---

## 15. A2P Campaign Registration Notes

> **Superseded — do not reuse for registration.** The campaign description,
> message flow, and sample messages below describe the July 2026 optional
> unified checkbox, which bundled marketing consent. The live quote form uses
> one unchecked, required, quote-only checkbox (consent v4) and collects no
> promotional consent. Use [the current A2P campaign notes](sms-a2p-campaign-registration.md)
> for registration copy and [quote SMS consent](quote-sms-consent.md) for the
> current behavior. The July text is kept only as history.

Create a developer/admin note or config file with this content so it can be
reused during Twilio/Telnyx/Bandwidth campaign registration. This is draft
registration copy and does not assert that a provider has approved the campaign
or every listed message category.

### Campaign Description

```text
Shed210 sends recurring first-party SMS messages to customers and leads who actively opt in. Messages may include shed quote, scheduling, project, order, delivery, installation, appointment, service, and customer-support updates, as well as Shed210 marketing or promotional offers.
```

### Message Flow

```text
On the Shed210 quote form, users may actively check one unchecked optional SMS consent box. The displayed body says: “I agree to receive recurring first-party text messages from Shed210, including messages about my quote request, scheduling, project updates, and Shed210 marketing or promotional offers. Message frequency may vary. Message and data rates may apply. Reply STOP to opt out or HELP for help. Consent is not required to get a quote or purchase goods or services.” Links to Shed210’s Privacy Policy and Terms & SMS Policy follow the body copy. Users can submit the quote form and purchase goods or services without checking the box. The website and public quote API use one unified opt-in value. For CRM compatibility, an affirmative opt-in is stored as separate transactional and marketing proof records that contain the same exact combined consent text and version. The Privacy Policy states that mobile numbers and SMS consent are not shared with third parties or affiliates for marketing or promotional purposes.
```

### Sample Messages

1. `Shed210: Thanks for requesting a shed quote. We received your request and will follow up soon. Reply STOP to opt out or HELP for help.`
2. `Shed210: Your shed delivery/installation appointment is scheduled for [date/time]. Reply STOP to opt out or HELP for help.`
3. `Shed210: We have an update about your shed quote/order. Please contact us at [phone/email] when available. Reply STOP to opt out or HELP for help.`
4. `Shed210: [Marketing or promotional offer details]. Msg freq varies. Msg&data rates may apply. Reply STOP to opt out or HELP for help.`
5. `Shed210: Thanks for opting in. You may receive recurring texts about your quote, order, delivery, installation, appointment, support, and Shed210 offers. Msg freq varies. Msg&data rates may apply. Reply STOP to opt out or HELP for help.`

---

## 16. QA Checklist

- [ ] The quote form renders exactly one SMS checkbox and it is unchecked by default.
- [ ] The form submits successfully when the unified checkbox is unchecked.
- [ ] The displayed body copy exactly matches Section 3, and the Privacy Policy and Terms & SMS Policy links follow it.
- [ ] The public quote API accepts one unified opt-in value rather than separate UI-facing transactional and marketing choices.
- [ ] When the unified checkbox is checked, the backend stores separate transactional and marketing proof records with the same exact combined text, shared version, timestamp, page URL, source, IP address if available, and user agent if available.
- [ ] When the unified checkbox is unchecked, neither proof record grants SMS eligibility and the quote is still persisted.
- [ ] Phone numbers normalize to E.164.
- [ ] Outbound SMS is blocked when the applicable consent status is `not_opted_in`.
- [ ] Outbound SMS is blocked when the applicable consent status is `opted_out`.
- [ ] Outbound SMS sends only when the applicable consent status is `opted_in`, no later opt-out exists, and the provider configuration permits the message category.
- [ ] STOP updates lead/customer and phone-level opt-out state.
- [ ] HELP replies with support message and logs event.
- [ ] START behavior is tested only if intentionally implemented.
- [ ] Duplicate lead records with same phone number do not bypass opt-out.
- [ ] Admin cannot accidentally bypass opt-out.
- [ ] Footer links work on desktop and mobile.
- [ ] `/privacy-policy` and `/terms-and-conditions#sms-terms` are public and not blocked; `/sms-terms` redirects to the SMS policy anchor.
- [ ] A2P campaign registration notes match the real website opt-in flow.
- [ ] Provider registration/configuration has been checked for every transactional and marketing message category before that category is enabled; this document alone is not treated as proof of approval.

---

## 17. Do Not Implement

- Do not pre-check the checkbox.
- Do not require SMS consent to get a quote or purchase goods or services.
- Do not render separate quote-contact and marketing SMS checkboxes on the quote form.
- Do not infer SMS consent merely because a user provided a phone number or submitted a quote.
- Do not send a message category that the configured provider campaign or use case does not permit.
- Do not send SMS to contacts without `opted_in` status.
- Do not store different consent text or versions in the transactional and marketing proof records created from the unified opt-in.
- Do not share phone numbers or SMS consent data for marketing.
- Do not scatter provider SMS calls throughout the codebase.
- Do not register the SMS campaign under one brand and send messages as another brand.
- Do not ignore opt-out requests made outside SMS, such as email or phone requests.

---

## 18. Definition of Done

1. The quote form and public quote API use one unchecked optional unified SMS opt-in.
2. The quote can be submitted whether or not the user opts in.
3. Consent logging writes separate CRM-compatible transactional and marketing proof records with the same exact unified text and version.
4. Centralized SMS sending service enforces opt-in/opt-out guardrails.
5. Inbound SMS webhook handles STOP, HELP, and START if implemented.
6. Phone-level global opt-out protection is active.
7. Admin/CRM shows consent status and SMS history.
8. Public Privacy Policy and Terms & SMS Policy links are published in the footer, with `/sms-terms` redirecting to the SMS policy anchor.
9. QA checklist is completed.
10. A2P campaign registration notes are saved and match the production website.

---

## 19. Reference Links

These are implementation references for the developer. Final legal review should be handled separately if needed.

- [Twilio Help Center: A2P 10DLC Campaign Approval Best Practices](https://help.twilio.com/articles/11847054539547-A2P-10DLC-Campaign-Approval-Best-Practices)
- [Twilio: Programmable Messaging and A2P 10DLC](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc)
- [Twilio: How to collect customer consent in A2P 10DLC campaigns](https://help.twilio.com/articles/26147853183259-How-to-collect-customer-consent-in-A2P-10DLC-campaigns)
- [FCC Report and Order FCC-24-24A1: Revocation of consent for robocalls and robotexts](https://docs.fcc.gov/public/attachments/FCC-24-24A1.pdf)
- [Federal Register: Strengthening the Ability of Consumers To Stop Robocalls](https://www.federalregister.gov/documents/2024/03/05/2024-04587/strengthening-the-ability-of-consumers-to-stop-robocalls)
