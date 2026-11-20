import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { flushSync } from 'react-dom';
import {
  ChevronDown,
  CircleAlert,
  MapPin,
  Navigation,
  TicketPercent,
} from 'lucide-react';
import Link from 'next/link';
import { type QuoteFormErrors, type QuoteFormParams } from '@/lib/quoteForm';
import { DELIVERY_ADDRESS_MAX_LENGTH } from '@/lib/quoteLimits';
import { SMS_QUOTE_CONSENT_BODY_TEXT } from '@/lib/smsConsent';
import { PHONE_DISPLAY, PHONE_NUMBER } from '@/lib/contact';
import { triggerHaptic } from '@/lib/haptics';
import { isCompactViewport } from '@/lib/useCompactViewport';
import {
  QuoteFieldError,
  QuoteSectionCard,
} from '@/components/quote/QuoteSectionCard';
import { specField, specLabel } from '@/components/quote/quoteStyles';

// Server limits from quoteRoute.ts; longer values would fail only after submit.
const NAME_MAX_LENGTH = 255;
const EMAIL_MAX_LENGTH = 255;
const DISCOUNT_CODE_MAX_LENGTH = 32;

const consentPanel =
  'flex items-start gap-3 rounded-none border border-white/12 bg-black/25 p-3 text-sm leading-6 text-white/65';

/*
 * Phone layout (iOS inset grouped lists). Every class below is `phone:`-only,
 * so desktop renders exactly as before. Groups are painted row by row (surface,
 * inset hairline, rounded first/last row) because the existing DOM nests Name,
 * Email/Phone and Consent differently than the visual groups.
 */
const qmRowSurface =
  'phone:relative phone:bg-[var(--qm-group)] phone:transition-colors phone:duration-200';
/** Inset 0.5px hairline above a row that follows another row in its group. */
const qmRowSeparator =
  'phone:before:pointer-events-none phone:before:absolute phone:before:top-0 phone:before:right-0 phone:before:left-4 phone:before:h-px phone:before:origin-top phone:before:scale-y-50 phone:before:bg-[var(--qm-sep)]';
const qmGroupTop = 'phone:rounded-t-[var(--qm-radius-group)]';
const qmGroupBottom = 'phone:rounded-b-[var(--qm-radius-group)]';
/** Text-field rows show focus on the row (the input's outline is off via data-qm-row-input). */
const qmFieldFocus = 'phone:focus-within:bg-white/[0.1]';
/** A field <label> as an iOS form row: caption column, filling input, error footnote below. */
const qmFieldLayout =
  'group/qmrow phone:flex phone:min-h-[52px] phone:flex-wrap phone:items-center phone:gap-x-3 phone:px-4 phone:font-normal phone:[&>p]:-mt-2 phone:[&>p]:basis-full phone:[&>p]:px-0 phone:[&>p]:pb-3';
/** Resets the shared spec field into a borderless row input. */
const qmFieldInput =
  'phone:m-0 phone:h-[52px] phone:w-auto phone:min-w-0 phone:flex-1 phone:rounded-none phone:border-0 phone:bg-transparent phone:p-0 phone:shadow-none phone:qm-body phone:text-[var(--qm-label)]';
/** A tappable list row (disclosure / action). */
const qmButtonRow =
  'phone:flex phone:min-h-[52px] phone:w-full phone:items-center phone:gap-3 phone:px-4 phone:text-left phone:qm-body phone:qm-no-select phone:active:scale-100 phone:active:bg-[var(--qm-group-pressed)] phone:active:duration-0';

function qmCaption(invalid: boolean) {
  return `phone:w-[5.5rem] phone:shrink-0 phone:qm-body phone:transition-colors ${
    invalid
      ? 'phone:text-[var(--qm-danger)]'
      : 'phone:text-[var(--qm-label)] phone:group-focus-within/qmrow:text-[var(--accent-light)]'
  }`;
}

/** Staggered rise for the contact rows that appear once Name has text. */
const qmRevealRise = [
  'phone:animate-[qm-rise_0.5s_var(--qm-ease-spring)_both]',
  'phone:animate-[qm-rise_0.5s_var(--qm-ease-spring)_60ms_both]',
  'phone:animate-[qm-rise_0.5s_var(--qm-ease-spring)_120ms_both]',
] as const;

/*
 * Phones show the consent's first sentence as the row's primary line and the
 * rest as fine print. Splitting the constant keeps the label's textContent
 * identical to SMS_QUOTE_CONSENT_TEXT (it is recorded as displayed).
 */
const consentLeadEnd = SMS_QUOTE_CONSENT_BODY_TEXT.indexOf('. ');
const SMS_CONSENT_LEAD =
  consentLeadEnd < 0
    ? SMS_QUOTE_CONSENT_BODY_TEXT
    : SMS_QUOTE_CONSENT_BODY_TEXT.slice(0, consentLeadEnd + 1);
const SMS_CONSENT_DETAIL =
  consentLeadEnd < 0 ? '' : SMS_QUOTE_CONSENT_BODY_TEXT.slice(consentLeadEnd + 2);

/**
 * Phones: Return moves to the next field (iOS Contacts style) instead of
 * implicitly submitting the step, which would flag consent mid-entry. With no
 * next field it dismisses the keyboard. Desktop keeps native behaviour.
 */
function handleReturnKey(nextFieldName?: string) {
  return (event: KeyboardEvent<HTMLInputElement>) => {
    if (
      event.key !== 'Enter' ||
      event.nativeEvent.isComposing ||
      !isCompactViewport()
    ) {
      return;
    }
    event.preventDefault();
    const next = nextFieldName
      ? event.currentTarget.form?.elements.namedItem(nextFieldName)
      : null;
    if (next instanceof HTMLInputElement && !next.disabled) {
      next.focus();
      return;
    }
    event.currentTarget.blur();
  };
}

export function QuoteDeliveryContactStep({
  draft,
  errors,
  deliveryZip,
  showConsentError,
  showDeliveryDetails,
  showDiscountCode,
  zipLoading,
  locationError,
  submissionError,
  onInputChange,
  onDeliveryZipChange,
  onToggleDeliveryDetails,
  onRequestCurrentLocation,
  onShowDiscountCode,
}: {
  draft: QuoteFormParams;
  errors: QuoteFormErrors;
  deliveryZip: string;
  showConsentError: boolean;
  showDeliveryDetails: boolean;
  showDiscountCode: boolean;
  zipLoading: boolean;
  locationError: string | null;
  submissionError: string | null;
  onInputChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onDeliveryZipChange: (deliveryZip: string) => void;
  onToggleDeliveryDetails: () => void;
  onRequestCurrentLocation: () => void;
  onShowDiscountCode: () => void;
}) {
  const discountInputRef = useRef<HTMLInputElement>(null);
  const consentError = showConsentError ? errors.smsConsentOptIn : undefined;
  const hasName = draft.name.trim() !== '';
  const nameInvalid = hasName && !!errors.name;
  const emailInvalid = draft.email.trim() !== '' && !!errors.email;
  const phoneInvalid = draft.phone.trim() !== '' && !!errors.phone;
  // Rows already shown when the step mounts arrive with the step's own push;
  // only rows revealed by typing a name animate in.
  const [animateContactReveal, setAnimateContactReveal] = useState(!hasName);
  if (!hasName && !animateContactReveal) setAnimateContactReveal(true);
  const revealClass = (index: 0 | 1 | 2) =>
    animateContactReveal ? qmRevealRise[index] : '';
  const locationSummary =
    deliveryZip.trim() || draft.deliveryAddress.trim() || 'Optional';

  const handleConsentChange = (event: ChangeEvent<HTMLInputElement>) => {
    triggerHaptic('selection');
    onInputChange(event);
  };

  const handleUseCurrentLocation = () => {
    if (zipLoading) return;
    onRequestCurrentLocation();
  };

  const handleShowDiscountCode = () => {
    if (!isCompactViewport()) {
      onShowDiscountCode();
      return;
    }
    // Commit the reveal inside the tap so focus() still raises the iOS keyboard.
    flushSync(() => onShowDiscountCode());
    discountInputRef.current?.focus();
  };

  return (
    <>
      <QuoteSectionCard
        title="Build Location & Contact"
        code="03 / 03"
        eyebrow="Step 3 of 3"
      >
        <p className="mb-4 text-xs text-white/65 phone:hidden">
          Fields marked <span aria-hidden="true">*</span> are required.
        </p>
        <div className="space-y-4 phone:space-y-0">
          <label
            aria-hidden="true"
            className="absolute left-[-10000px] h-px w-px overflow-hidden"
          >
            Website
            <input
              type="text"
              name="website"
              value={draft.website}
              onChange={onInputChange}
              autoComplete="off"
              tabIndex={-1}
            />
          </label>
          <div
            data-qm-row=""
            className={`${qmRowSurface} ${qmFieldFocus} ${qmGroupTop} ${
              hasName ? '' : qmGroupBottom
            }`}
          >
            <label className={`block text-sm font-medium ${qmFieldLayout}`}>
              <span className={`${specLabel} ${qmCaption(nameInvalid)}`}>
                Name <span aria-hidden="true" className="phone:hidden">*</span>
              </span>
              <input
                type="text"
                name="name"
                required
                autoComplete="name"
                maxLength={NAME_MAX_LENGTH}
                autoCapitalize="words"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                onKeyDown={handleReturnKey('email')}
                data-qm-row-input=""
                value={draft.name}
                onChange={onInputChange}
                aria-invalid={draft.name.trim() ? !!errors.name : undefined}
                aria-describedby={
                  draft.name.trim() && errors.name ? 'err-name' : undefined
                }
                className={`${specField} ${qmFieldInput}`}
              />
              <QuoteFieldError
                id="err-name"
                message={draft.name.trim() ? errors.name : undefined}
              />
            </label>
          </div>

          {draft.name.trim() ? (
            <div className="space-y-4 phone:space-y-0">
              <label
                data-qm-row=""
                className={`block text-sm font-medium ${qmRowSurface} ${qmFieldFocus} ${qmRowSeparator} ${qmFieldLayout} ${revealClass(0)}`}
              >
                <span className={`${specLabel} ${qmCaption(emailInvalid)}`}>
                  Email <span aria-hidden="true" className="phone:hidden">*</span>
                </span>
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  maxLength={EMAIL_MAX_LENGTH}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="next"
                  onKeyDown={handleReturnKey('phone')}
                  data-qm-row-input=""
                  value={draft.email}
                  onChange={onInputChange}
                  aria-invalid={draft.email.trim() ? !!errors.email : undefined}
                  aria-describedby={
                    draft.email.trim() && errors.email ? 'err-email' : undefined
                  }
                  className={`${specField} ${qmFieldInput}`}
                />
                <QuoteFieldError
                  id="err-email"
                  message={draft.email.trim() ? errors.email : undefined}
                />
              </label>

              <label
                data-qm-row=""
                className={`block text-sm font-medium ${qmRowSurface} ${qmFieldFocus} ${qmRowSeparator} ${qmGroupBottom} ${qmFieldLayout} ${revealClass(1)}`}
              >
                <span className={`${specLabel} ${qmCaption(phoneInvalid)}`}>
                  Phone<span className="phone:hidden"> Number</span>{' '}
                  <span aria-hidden="true" className="phone:hidden">*</span>
                </span>
                <input
                  type="tel"
                  name="phone"
                  required
                  autoComplete="tel"
                  inputMode="tel"
                  enterKeyHint="done"
                  onKeyDown={handleReturnKey()}
                  data-qm-row-input=""
                  value={draft.phone}
                  onChange={onInputChange}
                  aria-invalid={draft.phone.trim() ? !!errors.phone : undefined}
                  aria-describedby={
                    draft.phone.trim() && errors.phone ? 'err-phone' : undefined
                  }
                  className={`${specField} font-mono tabular-nums ${qmFieldInput}`}
                />
                <QuoteFieldError
                  id="err-phone"
                  message={draft.phone.trim() ? errors.phone : undefined}
                />
              </label>

              <div className={`phone:mt-6 ${revealClass(2)}`}>
                <label
                  data-qm-row=""
                  className={`${consentPanel} phone:min-h-[52px] phone:gap-3.5 phone:rounded-[var(--qm-radius-group)] phone:border-0 phone:bg-[var(--qm-group)] phone:px-4 phone:py-3.5 phone:transition-[background-color,box-shadow] phone:duration-200 phone:qm-no-select phone:active:bg-[var(--qm-group-pressed)] phone:active:duration-0 ${
                    consentError
                      ? 'phone:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--qm-danger)_65%,transparent)]'
                      : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    name="smsConsentOptIn"
                    required
                    checked={draft.smsConsentOptIn}
                    onChange={handleConsentChange}
                    aria-invalid={consentError ? true : undefined}
                    aria-describedby={consentError ? 'err-sms-consent' : undefined}
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] phone:qm-check-input phone:-mt-[3px]! phone:aria-invalid:border-[var(--qm-danger)]!"
                  />
                  <span className="phone:qm-footnote phone:text-[var(--qm-label-2)]">
                    {/* New tab keeps the unsaved contact details; the hint is in aria-label so the recorded text is unchanged. */}
                    <span className="phone:mb-1 phone:block phone:qm-subhead phone:text-white/85">
                      {SMS_CONSENT_LEAD}
                    </span>
                    {SMS_CONSENT_DETAIL ? ` ${SMS_CONSENT_DETAIL}` : null} See our{' '}
                    <Link
                      href="/privacy-policy"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Privacy Policy (opens in a new tab)"
                      className="text-[var(--accent-light)] underline underline-offset-2"
                    >
                      Privacy Policy
                    </Link>
                    {' '}and{' '}
                    <Link
                      href="/terms-and-conditions#sms-terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Terms & SMS Policy (opens in a new tab)"
                      className="text-[var(--accent-light)] underline underline-offset-2"
                    >
                      Terms &amp; SMS Policy
                    </Link>
                    .{' '}
                    {/* Must read exactly as SMS_QUOTE_CONSENT_ALTERNATIVE_TEXT; it is recorded as displayed. */}
                    Prefer not to receive texts? Call{' '}
                    <a
                      href={`tel:${PHONE_NUMBER}`}
                      className="text-[var(--accent-light)] underline underline-offset-2"
                    >
                      {PHONE_DISPLAY}
                    </a>
                    {' '}for a quote.
                  </span>
                </label>
                <QuoteFieldError id="err-sms-consent" message={consentError} />
              </div>
            </div>
          ) : null}
        </div>

        <hr className="my-5 border-t border-white/10 phone:hidden" />

        <div className="space-y-2 phone:relative phone:mt-6 phone:space-y-0">
          {/*
            iOS value cell: outside the toggle so its name stays exactly "Build
            Location", and first so the toggle keeps its desktop space-y margins.
          */}
          <span
            aria-hidden="true"
            className="hidden phone:pointer-events-none phone:absolute phone:top-0 phone:right-[2.625rem] phone:z-[1] phone:flex phone:h-[52px] phone:max-w-[calc(100%-14rem)] phone:items-center phone:qm-body phone:text-[var(--qm-label-2)]"
          >
            {zipLoading ? (
              <span className="block h-[18px] w-[18px] animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <span className="truncate">{locationSummary}</span>
            )}
          </span>
          <button
            id="quote-delivery-details-toggle"
            type="button"
            onClick={onToggleDeliveryDetails}
            aria-expanded={showDeliveryDetails}
            aria-controls="quote-delivery-details-panel"
            className={`brand-subheading flex w-full items-center justify-between text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${qmRowSurface} ${qmButtonRow} ${qmGroupTop} ${
              showDeliveryDetails ? '' : qmGroupBottom
            } phone:justify-start phone:text-[var(--qm-label)]`}
          >
            <span
              aria-hidden="true"
              className="hidden phone:flex phone:size-[30px] phone:shrink-0 phone:items-center phone:justify-center phone:rounded-[8px] phone:bg-[var(--accent)] phone:text-white"
            >
              <MapPin className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <span>Build Location</span>
            <ChevronDown
              className={`h-4 w-4 text-white/50 transition-transform ${
                showDeliveryDetails ? 'rotate-180' : ''
              } phone:ml-auto phone:h-[18px] phone:w-[18px] phone:text-[var(--qm-label-3)] phone:duration-300 phone:ease-[var(--qm-ease-spring)] ${
                showDeliveryDetails ? 'phone:rotate-0' : 'phone:-rotate-90'
              }`}
            />
          </button>

          {showDeliveryDetails ? (
            <div
              id="quote-delivery-details-panel"
              className="space-y-4 pt-2 phone:space-y-0 phone:pt-0 phone:qm-animate-fade"
            >
              {/* Stays mounted while locating (aria-disabled) so a focused row keeps focus. */}
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                aria-disabled={zipLoading || undefined}
                aria-describedby={locationError ? 'err-current-location' : undefined}
                className={`brand-button inline-flex items-center gap-2 text-sm text-[var(--accent-light)] underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] aria-disabled:text-white/50 ${qmRowSurface} ${qmRowSeparator} ${qmButtonRow} phone:no-underline phone:aria-disabled:text-[var(--qm-label-2)]`}
              >
                {zipLoading ? (
                  <span
                    aria-hidden="true"
                    className="h-[18px] w-[18px] shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
                  />
                ) : (
                  <Navigation
                    aria-hidden="true"
                    className="h-[18px] w-[18px] shrink-0 fill-current"
                  />
                )}
                Use Current Location
              </button>

              <label
                data-qm-row=""
                className={`block text-sm font-medium ${qmRowSurface} ${qmFieldFocus} ${qmRowSeparator} ${qmFieldLayout}`}
              >
                <span
                  className={`${specLabel} ${qmCaption(!!errors.deliveryAddress)}`}
                >
                  <span className="phone:hidden">Build </span>Address
                </span>
                <input
                  type="text"
                  name="deliveryAddress"
                  autoComplete="street-address"
                  autoCapitalize="words"
                  autoCorrect="off"
                  enterKeyHint="next"
                  onKeyDown={handleReturnKey('deliveryZip')}
                  data-qm-row-input=""
                  value={draft.deliveryAddress}
                  onChange={onInputChange}
                  maxLength={DELIVERY_ADDRESS_MAX_LENGTH}
                  aria-invalid={!!errors.deliveryAddress}
                  aria-describedby={
                    errors.deliveryAddress ? 'err-delivery-address' : undefined
                  }
                  placeholder="Optional"
                  className={`${specField} ${qmFieldInput}`}
                />
                <QuoteFieldError
                  id="err-delivery-address"
                  message={errors.deliveryAddress}
                />
              </label>

              <label
                data-qm-row=""
                className={`block text-sm font-medium ${qmRowSurface} ${qmFieldFocus} ${qmRowSeparator} ${qmGroupBottom} ${qmFieldLayout}`}
              >
                <span className={`${specLabel} ${qmCaption(false)}`}>
                  <span className="phone:hidden">Build </span>ZIP
                </span>
                <div className="relative phone:flex phone:min-w-0 phone:flex-1 phone:items-center phone:self-stretch">
                  <input
                    type="text"
                    name="deliveryZip"
                    autoComplete="postal-code"
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={5}
                    enterKeyHint="done"
                    onKeyDown={handleReturnKey()}
                    data-qm-row-input=""
                    value={deliveryZip}
                    disabled={zipLoading}
                    onChange={(event) => onDeliveryZipChange(event.target.value)}
                    className={`${specField} font-mono tabular-nums ${qmFieldInput}`}
                  />
                  {zipLoading ? (
                    <span className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-current border-t-transparent phone:right-0 phone:text-[var(--qm-label-2)]" />
                  ) : null}
                </div>
              </label>

              {/* Below the group, not under the button, so the phone list stays one piece. */}
              <QuoteFieldError
                id="err-current-location"
                message={locationError ?? undefined}
              />

              <p className="text-xs leading-5 text-white/50 phone:qm-section-footer">
                Shed210 builds on your property. Delivery, travel, and site costs are
                verified separately after we review the build location and are not
                included in the instant build subtotal.
              </p>
            </div>
          ) : null}
        </div>

        {!showDiscountCode ? (
          <button
            type="button"
            onClick={handleShowDiscountCode}
            className={`brand-button mt-4 text-sm text-[var(--accent-light)] underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${qmRowSurface} ${qmButtonRow} phone:mt-6 phone:rounded-[var(--qm-radius-group)] phone:no-underline`}
          >
            <TicketPercent
              aria-hidden="true"
              className="hidden h-[22px] w-[22px] shrink-0 phone:block"
            />
            Have a discount code?
          </button>
        ) : (
          <label
            data-qm-row=""
            className={`mt-4 block text-sm font-medium ${qmRowSurface} ${qmFieldFocus} ${qmFieldLayout} phone:mt-6 phone:rounded-[var(--qm-radius-group)] phone:qm-animate-fade`}
          >
            <span className={`${specLabel} ${qmCaption(false)}`}>
              Discount<span className="phone:hidden"> Code</span>
            </span>
            <input
              ref={discountInputRef}
              type="text"
              name="discountCode"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              onKeyDown={handleReturnKey()}
              data-qm-row-input=""
              value={draft.discountCode}
              onChange={onInputChange}
              maxLength={DISCOUNT_CODE_MAX_LENGTH}
              placeholder="Optional"
              className={`${specField} font-mono tabular-nums ${qmFieldInput}`}
            />
          </label>
        )}

        {submissionError ? (
          <div
            id="quote-submission-error"
            role="alert"
            tabIndex={-1}
            className="mt-4 rounded-none border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200 phone:mt-6 phone:grid phone:grid-cols-[1.25rem_minmax(0,1fr)] phone:items-start phone:gap-x-2.5 phone:rounded-[var(--qm-radius-tile)] phone:border-0 phone:bg-[color-mix(in_srgb,var(--qm-danger)_16%,transparent)] phone:px-4 phone:py-3.5 phone:qm-subhead phone:text-[var(--qm-label)] phone:shadow-[inset_0_0_0_0.5px_color-mix(in_srgb,var(--qm-danger)_45%,transparent)] phone:qm-animate-rise"
          >
            <CircleAlert
              aria-hidden="true"
              className="hidden h-5 w-5 shrink-0 text-[var(--qm-danger)] phone:row-span-2 phone:block"
            />
            <p>{submissionError}</p>
            {/* Outside the consent label, which must keep its recorded text. */}
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 phone:mt-1.5">
              <a
                href={`tel:${PHONE_NUMBER}`}
                className="font-medium text-white underline underline-offset-2 phone:text-[var(--accent-light)]"
              >
                Call {PHONE_DISPLAY}
              </a>
              <a
                href={`sms:${PHONE_NUMBER}`}
                className="font-medium text-white underline underline-offset-2 phone:text-[var(--accent-light)]"
              >
                Text {PHONE_DISPLAY}
              </a>
            </p>
          </div>
        ) : null}
      </QuoteSectionCard>
    </>
  );
}
