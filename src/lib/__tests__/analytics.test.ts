import { toGtagEventProperties, trackEvent } from '../analytics';
import { loadVercelInsights } from '../vercelInsights';

jest.mock('../vercelInsights', () => ({
  loadVercelInsights: jest.fn(),
}));

describe('analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.gtag = jest.fn();
  });

  afterEach(() => {
    delete window.gtag;
  });

  it('only forwards allowlisted GA4 event properties', () => {
    expect(toGtagEventProperties({
      location: 'home_hero',
      category: 'conversion',
      quoteId: null,
      total: 1200,
      complete: true,
    })).toEqual({
      location: 'home_hero',
      category: 'conversion',
    });
  });

  it('keeps analytics no-op behavior in tests', () => {
    trackEvent('quote_success', { quoteId: 'quote-123', total: 1200 });

    expect(window.gtag).not.toHaveBeenCalled();
    expect(loadVercelInsights).not.toHaveBeenCalled();
  });
});
