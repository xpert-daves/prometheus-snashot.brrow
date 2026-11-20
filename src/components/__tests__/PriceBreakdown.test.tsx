import { render, screen } from '@testing-library/react';
import PriceBreakdown from '../PriceBreakdown';
import type { QuoteBreakdown } from '@/lib/pricing/calculateQuote';

const baseBreakdown: QuoteBreakdown = {
  base: 1000,
  wallHeight: 400,
  roof: 0,
  siding: 0,
  door: 0,
  windows: 0,
  addOns: 0,
  delivery: 0,
  discount: 0,
  interiorUpgrades: [],
};

describe('PriceBreakdown', () => {
  it('labels 8 ft wall height upgrades without hardcoded pricing copy', () => {
    render(<PriceBreakdown breakdown={baseBreakdown} total={1400} wallHeight={8} />);

    expect(screen.getByText('Wall height upgrade (8 ft)')).toBeInTheDocument();
  });

  it('uses a generic wall height label when the height is already in the base price', () => {
    render(<PriceBreakdown breakdown={baseBreakdown} total={1400} wallHeight={7} />);

    expect(screen.getByText('Wall height upgrade')).toBeInTheDocument();
  });

  it('uses build-day language for the optional acceptance action', () => {
    render(
      <PriceBreakdown
        breakdown={baseBreakdown}
        total={1400}
        wallHeight={7}
        onAccept={jest.fn()}
      />
    );

    expect(
      screen.getByRole('button', { name: /accept quote & schedule build day/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /schedule delivery/i })
    ).not.toBeInTheDocument();
  });

  it('labels delivery as pending and the amount as a build subtotal', () => {
    render(
      <PriceBreakdown
        breakdown={baseBreakdown}
        total={1400}
        deliveryPricingStatus="pending_verification"
      />
    );

    expect(screen.getByText('Delivery & site costs')).toBeInTheDocument();
    expect(screen.getByText('Pending verification')).toBeInTheDocument();
    expect(screen.getByText('Build subtotal')).toBeInTheDocument();
    expect(screen.queryByText('Distance surcharge')).not.toBeInTheDocument();
  });

  it('lists an anchored slab as priced after site review instead of in the subtotal', () => {
    render(
      <PriceBreakdown breakdown={baseBreakdown} total={1400} foundation="anchored_slab" />
    );

    expect(screen.getByText('Anchored slab')).toBeInTheDocument();
    expect(screen.getByText('Priced after site review')).toBeInTheDocument();
  });

  it.each(['blocks_level', 'none', undefined])(
    'adds no slab row for the %s foundation',
    (foundation) => {
      render(<PriceBreakdown breakdown={baseBreakdown} total={1400} foundation={foundation} />);

      expect(screen.queryByText('Anchored slab')).not.toBeInTheDocument();
    }
  );
});
