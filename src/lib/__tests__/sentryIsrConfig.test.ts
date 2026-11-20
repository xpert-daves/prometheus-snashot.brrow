import type { NextConfig } from 'next';

jest.mock('@sentry/nextjs/config', () => ({
  withSentryConfig: jest.fn((config: NextConfig) => ({
    ...config,
    experimental: {
      ...config.experimental,
      clientTraceMetadata: ['baggage', 'sentry-trace', 'other-trace-key'],
    },
    // Stand in for the error-reporting instrumentation installed by the SDK.
    webpack: jest.fn(),
  })),
}));

import { withSentryConfig } from '@sentry/nextjs/config';
import config from '../../../next.config';

describe('Sentry ISR configuration', () => {
  it('removes changing trace metadata after Sentry injects it, retaining other metadata', () => {
    expect(config.experimental?.clientTraceMetadata).toEqual(['other-trace-key']);
  });

  it('retains Sentry instrumentation and the error event tunnel', () => {
    expect(config.webpack).toEqual(expect.any(Function));
    expect(withSentryConfig).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        org: '404dealer',
        project: 'shed210-production',
        tunnelRoute: '/sentry-tunnel',
      })
    );
  });
});
