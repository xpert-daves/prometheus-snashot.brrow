export const SENTRY_DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN ??
  'https://45091856a00eca8a290cbb065dd8cfc5@o4510231255580672.ingest.us.sentry.io/4512013281394688'

// Only production builds report. `next dev` runs on laptops and in agent
// sessions would otherwise fill Sentry with half-finished edits and missing
// local env vars.
export function shouldEnableSentry(dsn: string, nodeEnv: string | undefined) {
  return dsn.length > 0 && nodeEnv === 'production'
}

export const SENTRY_ENABLED = shouldEnableSentry(SENTRY_DSN, process.env.NODE_ENV)

export const SENTRY_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: false, response: false },
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  stackFrameVariables: false,
  frameContextLines: 0,
}

type SentryEventWithRequest = {
  request?: { url?: string; data?: unknown; cookies?: unknown; headers?: unknown }
  transaction?: string
}

type SentryBreadcrumb = {
  category?: string
  data?: Record<string, unknown>
}

function stripUrlDetails(value: string): string {
  const methodAndPath = value.match(/^([A-Z]+\s+)(\/?\S.*)$/)
  if (methodAndPath) {
    return `${methodAndPath[1]}${stripUrlDetails(methodAndPath[2])}`
  }

  try {
    const parsed = new URL(value, 'https://sentry.invalid')
    parsed.search = ''
    parsed.hash = ''
    return parsed.origin === 'https://sentry.invalid'
      ? parsed.pathname
      : parsed.toString()
  } catch {
    return value.split(/[?#]/, 1)[0] ?? value
  }
}

export function scrubSentryEvent<T extends SentryEventWithRequest>(event: T): T {
  if (event.request) {
    // A buffered request body can still be attached (for example under
    // `next start`), and a quote body is the customer's contact details.
    delete event.request.data
    delete event.request.cookies
    delete event.request.headers
  }
  if (event.request?.url) {
    event.request.url = stripUrlDetails(event.request.url)
  }
  if (event.transaction) {
    event.transaction = stripUrlDetails(event.transaction)
  }
  return event
}

export function scrubSentryBreadcrumb<T extends SentryBreadcrumb>(
  breadcrumb: T
): T | null {
  if (breadcrumb.category === 'console') return null

  if (breadcrumb.data) {
    for (const key of ['url', 'from', 'to'] as const) {
      const value = breadcrumb.data[key]
      if (typeof value === 'string') {
        breadcrumb.data[key] = stripUrlDetails(value)
      }
    }
  }
  return breadcrumb
}
