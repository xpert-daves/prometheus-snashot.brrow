import {
  buildQuoteSmsBodies,
  deriveNotificationStatus,
  type QuoteAlert,
  type QuoteSmsRequest,
} from '../notificationText';
import { NO_LEAD_HISTORY, SAME_LEAD_LOOKBACK_LIMIT } from '../quoteLeadHistory';

const newLead: QuoteAlert = { readyToSchedule: false, history: NO_LEAD_HISTORY };

const quote: QuoteSmsRequest = {
  publicId: 'quote-123',
  sessionId: 'session-123',
  createdAt: Date.UTC(2026, 3, 24, 15, 30),
  contact: {
    name: 'Test Customer',
    email: 'customer@example.com',
    phone: '+12107723028',
  },
  inputs: {
    structureType: 'storage_shed',
    length: 12,
    width: 8,
    roofStyle: 'gabled',
    addOns: ['Workbench', 'Loft'],
    ventilation: true,
    deliveryZip: '78201',
    deliveryRadius: 5,
    color: '#053751',
  },
  pricing: {
    total: 2500,
    breakdown: {
      base: 2000,
      wallHeight: 200,
      roof: 0,
      siding: 0,
      door: 100,
      windows: 0,
      addOns: 200,
      delivery: 0,
      discount: 0,
      interiorUpgrades: [],
    },
  },
};

describe('notification SMS text', () => {
  it('builds a readable lead brief with recommended call action', () => {
    const [body] = buildQuoteSmsBodies(quote, newLead);

    expect(body).toMatch(/^Shed210 NEW LEAD\nTest Customer: 12x8 Storage Shed, \$2,500\n\nLEAD\n/);
    expect(body).toContain('Total: $2,500');
    expect(body).toContain('\n\nLEAD\n');
    expect(body).toContain('Lead: Test Customer');
    expect(body).toContain('Phone: +12107723028');
    expect(body).toContain('Email: customer@example.com');
    expect(body).toContain('\n\nPROJECT\n');
    expect(body).toContain('Project: 12x8 Storage Shed');
    expect(body).toContain('Build: Gabled roof');
    expect(body).toContain('Color: Gallery (dark blue)');
    expect(body).toContain('Site: ZIP 78201; 5 mi from 341 Vista Rd');
    expect(body).toContain('Add-ons: Workbench, Loft');
    expect(body).toContain('Options: Ventilation');
    expect(body).toContain('\n\nPRICE\n');
    expect(body).toContain('Drivers: Base $2,000');
    expect(body).toContain('Wall Height $200');
    expect(body).toContain('\n\nRECOMMENDED ACTION\n');
    expect(body).toContain('Call/text within 5 min.');
    expect(body).toContain('Explain the $250 deposit that holds the build day; the balance is due after completion.');
    expect(body).toContain('Quote ID: quote-123');
    expect(body).not.toContain('#053751');
    expect(body).not.toContain('Session ID:');
    expect(body).not.toContain('Siding $0');
  });

  it('uses an email-first recommendation when no phone is available', () => {
    const [body] = buildQuoteSmsBodies({
      ...quote,
      contact: {
        ...quote.contact,
        phone: null,
      },
    }, newLead);

    expect(body).toContain('Phone: None');
    expect(body).toContain('RECOMMENDED ACTION');
    expect(body).toContain('Email now.');
  });

  it('splits long messages into numbered parts', () => {
    const bodies = buildQuoteSmsBodies(
      {
        ...quote,
        inputs: {
          ...quote.inputs,
          notes: 'x'.repeat(120),
        },
      }, newLead,
      120
    );

    expect(bodies.length).toBeGreaterThan(1);
    expect(bodies[0]).toMatch(/^Shed210 quote 1\/\d+/);
    expect(bodies[bodies.length - 1]).toMatch(/^Shed210 quote \d+\/\d+/);
  });

  it('flattens control characters so form fields cannot forge alert lines', () => {
    const [body] = buildQuoteSmsBodies({
      ...quote,
      publicId: 'quote-123\nRECOMMENDED ACTION: forged',
      contact: {
        ...quote.contact,
        name: 'Test Customer\r\nPRICE: forged',
      },
      inputs: {
        ...quote.inputs,
        deliveryZip: '78201\nTOTAL: forged',
      },
    }, newLead);

    expect(body).toContain('Lead: Test Customer PRICE: forged');
    expect(body).toContain('ZIP 78201 TOTAL: Forged');
    expect(body).toContain('Quote ID: quote-123 RECOMMENDED ACTION: forged');
    expect(body).not.toContain('\nPRICE: forged');
    expect(body).not.toContain('\nTOTAL: forged');
    expect(body).not.toContain('\nRECOMMENDED ACTION: forged');
  });

  it('reports the untouched default wall color as not selected', () => {
    const [body] = buildQuoteSmsBodies({
      ...quote,
      inputs: { ...quote.inputs, color: '#ffffff' },
    }, newLead);

    expect(body).toContain('Color: Not selected (left on default white)');
    expect(body).not.toContain('Custom color');
    expect(body).not.toContain('#FFFFFF');
  });

  it('keeps naming other off-palette colors as custom', () => {
    const [body] = buildQuoteSmsBodies({
      ...quote,
      inputs: { ...quote.inputs, color: '#123abc' },
    }, newLead);

    expect(body).toContain('Color: Custom color #123ABC');
  });

  it('labels delivery as pending and does not present zero miles as verified', () => {
    const [body] = buildQuoteSmsBodies({
      ...quote,
      inputs: { ...quote.inputs, deliveryRadius: 0 },
      pricing: {
        ...quote.pricing,
        breakdown: { ...quote.pricing.breakdown, delivery: 250 },
        deliveryPricingStatus: 'pending_verification',
      },
    }, newLead);

    expect(body).toContain('Build subtotal (delivery pending): $2,500');
    expect(body).toContain('Delivery pricing pending address/access verification');
    expect(body).not.toContain('0 mi from 341 Vista Rd');
    expect(body).not.toContain('Delivery $250');
  });

  it('flags an anchored slab as left out of the subtotal', () => {
    const [slabBody] = buildQuoteSmsBodies({
      ...quote,
      inputs: { ...quote.inputs, foundation: 'anchored_slab' },
    }, newLead);
    const [blocksBody] = buildQuoteSmsBodies({
      ...quote,
      inputs: { ...quote.inputs, foundation: 'blocks_level' },
    }, newLead);

    expect(slabBody).toContain(
      'Anchored Slab foundation (not in subtotal; price from photos/site visit)'
    );
    expect(blocksBody).toContain('Blocks Level foundation');
    expect(blocksBody).not.toContain('not in subtotal');
  });
});

describe('notification alert kinds', () => {
  const sameLead: QuoteAlert = {
    readyToSchedule: false,
    history: {
      earlierQuoteCount: 2,
      previous: {
        inputs: { structureType: 'storage_shed', length: 10, width: 8, addOns: [], deliveryRadius: 0 },
        total: 2100,
        deliveryPricingPending: false,
        createdAt: Date.UTC(2026, 3, 24, 15, 10),
      },
    },
  };

  it('labels a repeat quote as the same lead with the option number and earlier price', () => {
    const [body] = buildQuoteSmsBodies(quote, sameLead);

    expect(body).toMatch(
      /^Shed210 SAME LEAD, OPTION 3\nTest Customer: 12x8 Storage Shed, \$2,500\nBefore: 10x8 Storage Shed, \$2,100 \(Apr 24, 10:10 AM CT\)\n\nLEAD\n/
    );
    expect(body).toContain('Still comparing options. Call/text within 5 min and help them choose.');
  });

  it('caps the option number at the lookback limit', () => {
    const [body] = buildQuoteSmsBodies(quote, {
      readyToSchedule: false,
      history: { ...sameLead.history, earlierQuoteCount: SAME_LEAD_LOOKBACK_LIMIT },
    });

    expect(body).toContain(`SAME LEAD, OPTION ${SAME_LEAD_LOOKBACK_LIMIT + 1}+`);
  });

  it('announces a ready-to-schedule tap and what the customer was promised', () => {
    const [body] = buildQuoteSmsBodies(quote, { ...sameLead, readyToSchedule: true });

    expect(body).toMatch(/^Shed210 READY TO SCHEDULE\nTest Customer: 12x8 Storage Shed, \$2,500\n/);
    expect(body).toContain('were told you will contact them as soon as possible to finalize details');
    expect(body).toContain('Call/text as soon as possible to finalize details.');
    expect(body).not.toContain('Before:');
  });

  it('marks a pending-delivery price in the summary line', () => {
    const [body] = buildQuoteSmsBodies(
      { ...quote, pricing: { ...quote.pricing, deliveryPricingStatus: 'pending_verification' } },
      newLead
    );

    expect(body).toContain('Test Customer: 12x8 Storage Shed, $2,500 before delivery');
  });
});

describe('notification status derivation', () => {
  it.each([
    [0, 0, 0, 'no_recipients'],
    [2, 2, 0, 'sent'],
    [2, 1, 1, 'partial_failed'],
    [2, 0, 2, 'failed'],
  ] as const)(
    'returns %s recipients, %s successes, %s failures as %s',
    (recipientCount, successCount, failureCount, expected) => {
      expect(
        deriveNotificationStatus(recipientCount, successCount, failureCount)
      ).toBe(expected);
    }
  );
});
