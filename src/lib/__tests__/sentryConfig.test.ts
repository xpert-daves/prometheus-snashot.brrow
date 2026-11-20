import {
  scrubSentryBreadcrumb,
  scrubSentryEvent,
  shouldEnableSentry,
} from '@/lib/sentryConfig'

describe('shouldEnableSentry', () => {
  const dsn = 'https://key@example.ingest.sentry.io/1'

  it('reports from production builds', () => {
    expect(shouldEnableSentry(dsn, 'production')).toBe(true)
  })

  it.each(['development', 'test', undefined])('stays off when NODE_ENV is %s', (nodeEnv) => {
    expect(shouldEnableSentry(dsn, nodeEnv)).toBe(false)
  })

  it('stays off without a DSN', () => {
    expect(shouldEnableSentry('', 'production')).toBe(false)
  })
})

describe('Sentry privacy scrubbers', () => {
  it('removes query strings and fragments from errors and transactions', () => {
    const event = scrubSentryEvent({
      request: {
        url: 'https://www.shed210.com/projects/san-antonio/example?lead=123#gallery',
      },
      transaction: 'GET /api/quote?email=person@example.com',
    })

    expect(event.request?.url).toBe(
      'https://www.shed210.com/projects/san-antonio/example'
    )
    expect(event.transaction).toBe('GET /api/quote')
  })

  it('drops request bodies, cookies and headers before an event is sent', () => {
    const event = scrubSentryEvent({
      request: {
        url: 'https://www.shed210.com/api/quote',
        data: '{"name":"Pat","email":"pat@gmail.com","phone":"+12105550000"}',
        cookies: { session: 'abc' },
        headers: { 'x-forwarded-for': '203.0.113.7' },
      },
    })

    expect(event.request).toEqual({ url: 'https://www.shed210.com/api/quote' })
  })

  it('scrubs navigation breadcrumb URLs and drops console breadcrumbs', () => {
    expect(
      scrubSentryBreadcrumb({
        category: 'navigation',
        data: {
          from: '/quote?email=person@example.com',
          to: '/thank-you#confirmation',
        },
      })
    ).toEqual({
      category: 'navigation',
      data: { from: '/quote', to: '/thank-you' },
    })

    expect(scrubSentryBreadcrumb({ category: 'console' })).toBeNull()
  })
})
