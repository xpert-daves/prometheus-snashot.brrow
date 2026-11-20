import { render, screen } from '@testing-library/react';
import { QuoteResultPanel } from '@/components/quote/QuoteResultPanel';
import type { QuoteApiResponse } from '@/lib/quoteSubmission';

const quote: QuoteApiResponse = {
  id: 'quote-123',
  total: 2_400,
  breakdown: {
    base: 2_400,
    wallHeight: 0,
    roof: 0,
    siding: 0,
    door: 0,
    windows: 0,
    addOns: 0,
    delivery: 0,
    discount: 0,
    interiorUpgrades: [],
  },
  estimate: {
    kind: 'build_subtotal',
    delivery: {
      status: 'pending_verification',
      includedInTotal: false,
    },
  },
};

describe('QuoteResultPanel', () => {
  it('does not present an unverified delivery charge as part of the total', () => {
    render(<QuoteResultPanel quote={quote} wallHeight={6} />);

    expect(screen.getByText('Estimated build subtotal')).toBeInTheDocument();
    expect(screen.getByText('Delivery & site costs')).toBeInTheDocument();
    expect(screen.getAllByText('Pending verification')).not.toHaveLength(0);
    expect(
      screen.getByText(/not included\. We will confirm them before a final quote/i)
    ).toBeInTheDocument();
  });

  it('says when an entered discount code was not applied', () => {
    render(<QuoteResultPanel quote={quote} wallHeight={6} attemptedDiscountCode=" SUMMER10 " />);

    expect(
      screen.getByText(
        "Code SUMMER10 wasn't applied to this estimate. Mention it when we follow up."
      )
    ).toBeInTheDocument();
  });

  it.each([
    ['no code was entered', '', 0],
    ['the code was applied', 'SUMMER10', 240],
  ])('shows no discount note when %s', (_case, attemptedDiscountCode, discount) => {
    render(
      <QuoteResultPanel
        quote={{ ...quote, breakdown: { ...quote.breakdown, discount } }}
        wallHeight={6}
        attemptedDiscountCode={attemptedDiscountCode}
      />
    );

    expect(screen.queryByText(/wasn't applied/i)).not.toBeInTheDocument();
  });

  it('tells a slab customer to send David photos and expect an on-site look', () => {
    render(<QuoteResultPanel quote={quote} wallHeight={6} foundation="anchored_slab" />);

    expect(screen.getByText(/anchored slab isn't in this subtotal/i)).toBeInTheDocument();
    expect(screen.getByText(/most likely need to see the site in person/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '(855) 578-0944' })).toHaveAttribute(
      'href',
      'sms:+18555780944'
    );
    expect(screen.getByRole('link', { name: 'info@shed210.com' })).toHaveAttribute(
      'href',
      'mailto:info@shed210.com'
    );
    expect(screen.getByText('Priced after site review')).toBeInTheDocument();
  });

  it('shows no slab note for blocks and level', () => {
    render(<QuoteResultPanel quote={quote} wallHeight={6} foundation="blocks_level" />);

    expect(screen.queryByText(/anchored slab/i)).not.toBeInTheDocument();
  });
});
