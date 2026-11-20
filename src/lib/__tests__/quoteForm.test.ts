import { z } from 'zod';
import { EMAIL_PATTERN } from '../emailPattern';
import { initialQuoteFormParams, validateQuoteForm } from '../quoteForm';
import { validateQuoteRequest } from '../quoteRoute';
import { buildQuoteSubmissionPayload } from '../quoteSubmission';

function validDraft() {
  return {
    ...initialQuoteFormParams,
    structureType: 'storage_shed' as const,
    name: 'Test User',
    email: 'info@shed210.com',
    phone: '(210) 772-3028',
    smsConsentOptIn: true,
  };
}

describe('validateQuoteForm', () => {
  it('starts customer quotes with the included 6-foot wall height', () => {
    expect(initialQuoteFormParams.wallHeight).toBe('6');
    expect(initialQuoteFormParams.deliveryRadius).toBe('0');
  });

  it('requires quote-related SMS consent and starts it unchecked', () => {
    expect(initialQuoteFormParams.smsConsentOptIn).toBe(false);
    expect(
      validateQuoteForm({ ...validDraft(), smsConsentOptIn: false })
        .smsConsentOptIn
    ).toBe('Check the box to get your online estimate, or call (855) 578-0944 for a quote.');
    expect(validateQuoteForm(validDraft()).smsConsentOptIn).toBeUndefined();
  });

  it('does not let legacy hidden mileage block the customer form', () => {
    expect(
      validateQuoteForm({ ...validDraft(), deliveryRadius: 'not-authoritative' })
        .deliveryRadius
    ).toBeUndefined();
  });

  it('uses the same email pattern as the server schema', () => {
    expect(EMAIL_PATTERN.source).toBe(z.regexes.email.source);
    expect(EMAIL_PATTERN.flags).toBe(z.regexes.email.flags);
  });

  it.each([
    'info@shed210.com',
    'Maria.Lopez@Gmail.COM',
    'maria+quotes@gmail.com',
    "o'brien@gmail.com",
    'maria@my-ranch.co.uk',
    ' maria@gmail.com ',
    'maria@gmail.com.',
    'maria.@gmail.com',
    '.maria@gmail.com',
    'maria@gmail..com',
    'maria..lopez@gmail.com',
    'maria@gmail.c',
    'maria@gmail',
    'maria,lopez@gmail.com',
    'maria@gmail,com',
    'josé@gmail.com',
    'maria@-gmail.com',
    'maria lopez@gmail.com',
  ])('agrees with /api/quote about the email %p', (email) => {
    const draft = { ...validDraft(), email };
    const clientAccepts = !validateQuoteForm(draft).email;
    const parsed = validateQuoteRequest(
      buildQuoteSubmissionPayload({
        params: draft,
        deliveryZip: '78205',
        sessionId: '123e4567-e89b-42d3-a456-426614174000',
      }) as unknown as Record<string, unknown>
    );
    const serverAccepts = parsed.success
      ? true
      : !parsed.error.issues.some((issue) => issue.path[0] === 'email');

    expect(clientAccepts).toBe(serverAccepts);
    if (serverAccepts) expect(parsed.success).toBe(true);
  });

  it('rejects install addresses over 255 characters', () => {
    expect(
      validateQuoteForm({
        ...validDraft(),
        deliveryAddress: 'a'.repeat(256),
      }).deliveryAddress
    ).toBe('Max: 255 characters');
  });

  it('rejects lean-to spans over 16 feet', () => {
    expect(
      validateQuoteForm({ ...validDraft(), roofStyle: 'lean-to', width: '17' }).width
    ).toBe('Lean-to roof max span: 16ft');
  });

  it.each(['length', 'width'] as const)(
    'rejects fractional custom %s before submission',
    (dimension) => {
      expect(
        validateQuoteForm({ ...validDraft(), [dimension]: '10.5' })[dimension]
      ).toBe('Enter a whole number of feet');
    }
  );

  it.each(['6', '10', '40'])(
    'allows whole-number dimensions of %s feet',
    (dimension) => {
      expect(
        validateQuoteForm({ ...validDraft(), length: dimension, width: dimension })
      ).toEqual({});
    }
  );

  it.each([
    ['', 'Please enter a valid number'],
    ['Infinity', 'Please enter a valid number'],
    ['5', 'Min: 6ft'],
    ['41', 'Max: 40ft'],
  ])('rejects an unsupported dimension of %s', (dimension, message) => {
    const errors = validateQuoteForm({
      ...validDraft(),
      length: dimension,
      width: dimension,
    });
    expect(errors.length).toBe(message);
    expect(errors.width).toBe(message);
  });

  it('requires a whole-number window count when windows are selected', () => {
    expect(
      validateQuoteForm({ ...validDraft(), windowPackage: '24x36', windowCount: '' })
        .windowCount
    ).toBe('Enter number of windows');
    expect(
      validateQuoteForm({
        ...validDraft(),
        windowPackage: '24x36',
        windowCount: '1.5',
      }).windowCount
    ).toBe('Enter number of windows');
  });

  it('rejects window counts above the server limit', () => {
    expect(
      validateQuoteForm({
        ...validDraft(),
        windowPackage: '24x36',
        windowCount: '21',
      }).windowCount
    ).toBe('Max: 20 windows');
  });

  it.each(['1', '20'])('allows %s selected windows', (windowCount) => {
    expect(
      validateQuoteForm({ ...validDraft(), windowPackage: '24x36', windowCount })
    ).toEqual({});
  });

  it('ignores an unused window count when windows are deselected', () => {
    expect(
      validateQuoteForm({ ...validDraft(), windowPackage: '', windowCount: '21' })
    ).toEqual({});
  });

  it('rejects unknown, duplicate, and mismatched add-ons', () => {
    expect(validateQuoteForm({ ...validDraft(), addOns: ['Mystery Upgrade'] }).addOns).toBe(
      'Select only available upgrades'
    );
    expect(
      validateQuoteForm({
        ...validDraft(),
        addOns: ['Ground Anchoring', 'Ground Anchoring'],
      }).addOns
    ).toBe('Remove duplicate upgrades');
    expect(
      validateQuoteForm({
        ...validDraft(),
        door: 'double_shed',
        addOns: ['Ramp (Single Door)'],
      }).addOns
    ).toBe('Single-door ramp requires a single shed door');
    expect(
      validateQuoteForm({
        ...validDraft(),
        door: 'single_shed',
        addOns: ['Ramp (Double Door)'],
      }).addOns
    ).toBe('Double-door ramp requires a double shed door');
  });

  it('allows ramp add-ons that match the selected shed door', () => {
    expect(
      validateQuoteForm({
        ...validDraft(),
        door: 'single_shed',
        addOns: ['Ramp (Single Door)'],
      }).addOns
    ).toBeUndefined();
    expect(
      validateQuoteForm({
        ...validDraft(),
        door: 'double_shed',
        addOns: ['Ramp (Double Door)'],
      }).addOns
    ).toBeUndefined();
  });
});
