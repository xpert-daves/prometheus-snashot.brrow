import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrackedActionLink from '../TrackedActionLink';
import { trackEvent } from '../../lib/analytics';

jest.mock('../../lib/analytics', () => ({
  trackEvent: jest.fn(),
}));

describe('TrackedActionLink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('tracks quote CTA clicks', async () => {
    const user = userEvent.setup();

    render(
      <TrackedActionLink
        href="/quote"
        eventName="quote_cta_clicked"
        eventProperties={{ location: 'unit_test' }}
        onClick={(event) => event.preventDefault()}
      >
        Get Instant Price
      </TrackedActionLink>
    );

    await user.click(screen.getByRole('link', { name: /get instant price/i }));

    expect(trackEvent).toHaveBeenCalledWith('quote_cta_clicked', {
      location: 'unit_test',
    });
  });
});
