import * as Sentry from '@sentry/nextjs'
import {
  SENTRY_DATA_COLLECTION,
  SENTRY_DSN,
  SENTRY_ENABLED,
  scrubSentryBreadcrumb,
  scrubSentryEvent,
} from '@/lib/sentryConfig'

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: SENTRY_ENABLED,
  sendDefaultPii: false,
  enableLogs: false,
  // Keep tracing off until span URL attributes have a reviewed redaction policy.
  tracesSampleRate: 0,
  dataCollection: SENTRY_DATA_COLLECTION,
  beforeSend: scrubSentryEvent,
  beforeSendTransaction: scrubSentryEvent,
  beforeBreadcrumb: scrubSentryBreadcrumb,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
