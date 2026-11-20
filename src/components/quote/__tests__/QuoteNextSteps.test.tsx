import { fireEvent, render, screen } from '@testing-library/react';
import { QuoteNextSteps } from '../QuoteNextSteps';
import type { QuoteApiResponse } from '@/lib/quoteSubmission';

const quote: QuoteApiResponse = {
  id: 'quote-123',
  discussionToken: 'private-action-token',
  total: 100,
  breakdown: { base: 100, wallHeight: 0, roof: 0, siding: 0, door: 0, windows: 0, addOns: 0, delivery: 0, discount: 0, interiorUpgrades: [] },
  estimate: { kind: 'build_subtotal', delivery: { status: 'pending_verification', includedInTotal: false } },
};

const callbacks = { onCompareAnotherOption: jest.fn() };

describe('QuoteNextSteps discussion action', () => {
  it('offers a call or text for quotes without a scheduling capability and keeps comparisons usable', () => {
    render(<QuoteNextSteps {...callbacks} quote={{ ...quote, discussionToken: undefined }} />);
    expect(screen.queryByRole('button', { name: /ready to schedule this build/i })).not.toBeInTheDocument();
    expect(screen.getByText(/ready to schedule\? call or text david/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '(855) 578-0944' })).toHaveAttribute('href', 'tel:+18555780944');
    expect(screen.getByRole('button', { name: /compare another/i })).toBeEnabled();
  });

  it('confirms a saved request and leaves comparisons available', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, requestId: 'discussion-1', status: 'created' }) });
    render(<QuoteNextSteps {...callbacks} quote={quote} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ready to schedule this build' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'David now knows you want to schedule this build and will contact you as soon as possible to finalize the details.'
    );
    expect(screen.getByRole('button', { name: 'David knows you’re ready' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /compare another/i })).toBeEnabled();
    expect(screen.queryByText(/private-action-token/)).not.toBeInTheDocument();
  });

  it('starts a fresh action when the displayed saved quote changes', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, requestId: 'discussion-1', status: 'created' }) });
    const { rerender } = render(<QuoteNextSteps {...callbacks} quote={quote} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ready to schedule this build' }));
    await screen.findByRole('status');
    rerender(<QuoteNextSteps {...callbacks} quote={{ ...quote, id: 'quote-456', discussionToken: 'other-token' }} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ready to schedule this build' })).toBeEnabled();
  });

  it('stops retrying an expired capability and keeps the recovery action available', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 410 });
    render(<QuoteNextSteps {...callbacks} quote={quote} />);
    fireEvent.click(screen.getByRole('button', { name: /ready to schedule this build/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Use Compare another option');
    expect(screen.getByRole('button', { name: /ready to schedule this build/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /compare another/i }));
    expect(callbacks.onCompareAnotherOption).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
