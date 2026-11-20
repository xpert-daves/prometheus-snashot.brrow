import { render, screen } from '@testing-library/react';
import { QuoteSelectionSummary } from '../QuoteSelectionSummary';
import { initialQuoteFormParams } from '@/lib/quoteForm';
import type { QuoteApiResponse } from '@/lib/quoteSubmission';

const quote: QuoteApiResponse = {
  id: 'quote-123',
  total: 14250,
  breakdown: { base: 14250, wallHeight: 0, roof: 0, siding: 0, door: 0, windows: 0, addOns: 0, delivery: 0, discount: 0, interiorUpgrades: [] },
  estimate: { kind: 'build_subtotal', delivery: { status: 'pending_verification', includedInTotal: false } },
};

const draft = {
  ...initialQuoteFormParams,
  structureType: 'storage_shed' as const,
  deliveryAddress: '1234 Oak Hollow Dr, San Antonio, TX 78258',
};

describe('QuoteSelectionSummary Clarity masking', () => {
  it('masks only the echoed build location in recordings', () => {
    const { container } = render(
      <QuoteSelectionSummary draft={draft} deliveryZip="78258" quote={quote} showWallHeight />,
    );

    const location = screen.getByText('1234 Oak Hollow Dr, San Antonio, TX 78258');
    expect(location.tagName).toBe('DD');
    expect(location).toHaveAttribute('data-clarity-mask', 'true');

    const masked = container.querySelectorAll('[data-clarity-mask]');
    expect(masked).toHaveLength(1);
    expect(masked[0]).toBe(location);
    expect(screen.getByText('Gable')).not.toHaveAttribute('data-clarity-mask');
    expect(screen.getByText('$14,250')).not.toHaveAttribute('data-clarity-mask');
  });

  it('keeps the build location masked when it falls back to the ZIP', () => {
    render(
      <QuoteSelectionSummary
        draft={{ ...draft, deliveryAddress: '' }}
        deliveryZip="78258"
        quote={null}
        showWallHeight={false}
      />,
    );

    expect(screen.getByText('78258')).toHaveAttribute('data-clarity-mask', 'true');
  });
});
