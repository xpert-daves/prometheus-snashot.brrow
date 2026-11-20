import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs/config'
import {
  areCrmProjectImagesV3Required,
  getCrmProjectImageRemotePattern,
  type CrmProjectsEnv,
} from './src/lib/projectsConfig'

export const cspInlineAllowlistRationale = [
  "script-src retains 'unsafe-inline' for Next/App Router bootstrap data, the inline gtag bootstrap, and Microsoft Clarity; a nonce-based policy would force dynamic rendering.",
  "style-src retains 'unsafe-inline' for Next/App Router style injection without forcing nonce-based dynamic rendering.",
] as const

type SecurityPolicyEnv = Record<string, string | undefined>

const CONVEX_ENV_NAMES = [
  'NEXT_PUBLIC_CONVEX_URL',
  'NEXT_PUBLIC_CONVEX_SITE_URL',
  'FRONTIER_PIXEL_CRM_CONVEX_URL',
] as const

const HERO_MEDIA_ENV_NAMES = [
  'NEXT_PUBLIC_HERO_VIDEO_WEBM_SRC',
  'NEXT_PUBLIC_HERO_VIDEO_MP4_SRC',
  'NEXT_PUBLIC_HERO_VIDEO_SRC',
  'NEXT_PUBLIC_HERO_FULL_VIDEO_SRC',
] as const

const HERO_FRAME_ENV_NAMES = [
  'NEXT_PUBLIC_HERO_FULL_VIDEO_EMBED_SRC',
] as const

function uniqueSources(sources: readonly string[]): string[] {
  return Array.from(new Set(sources))
}

function getHttpsOrigin(value: string | undefined): string | null {
  if (!value?.trim()) return null

  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    return url.origin
  } catch {
    return null
  }
}

function configuredHttpsOrigins(
  env: SecurityPolicyEnv,
  names: readonly string[]
): string[] {
  return uniqueSources(
    names.flatMap((name) => {
      const origin = getHttpsOrigin(env[name])
      return origin ? [origin] : []
    })
  )
}

function configuredConvexOrigins(env: SecurityPolicyEnv): string[] {
  return configuredHttpsOrigins(env, CONVEX_ENV_NAMES).filter((origin) => {
    const hostname = new URL(origin).hostname
    return hostname.endsWith('.convex.cloud') || hostname.endsWith('.convex.site')
  })
}

/**
 * Website chat calls the CRM's Convex HTTP routes straight from the browser.
 * Only an exact https `*.convex.site` origin is trusted.
 */
function configuredChatOrigins(env: SecurityPolicyEnv): string[] {
  return configuredHttpsOrigins(env, ['NEXT_PUBLIC_CRM_CHAT_URL']).filter((origin) =>
    new URL(origin).hostname.endsWith('.convex.site')
  )
}

// Cloudflare Turnstile (invisible check when a website chat starts and when a
// quote is submitted).
const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com'

function websocketOrigins(origins: readonly string[]): string[] {
  return origins.map((origin) => {
    const url = new URL(origin)
    url.protocol = 'wss:'
    return url.origin
  })
}

function directive(name: string, sources: readonly string[]): string {
  return `${name} ${uniqueSources(sources).join(' ')}`
}

export function buildContentSecurityPolicy(
  env: SecurityPolicyEnv = process.env
): string {
  const convexOrigins = configuredConvexOrigins(env)
  const chatOrigins = configuredChatOrigins(env)
  const heroMediaOrigins = configuredHttpsOrigins(env, HERO_MEDIA_ENV_NAMES)
  const heroFrameOrigins = configuredHttpsOrigins(env, HERO_FRAME_ENV_NAMES)

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    directive('script-src', [
      "'self'",
      "'unsafe-inline'",
      'https://www.googletagmanager.com',
      'https://www.google-analytics.com',
      'https://www.clarity.ms',
      'https://scripts.clarity.ms',
      'https://va.vercel-scripts.com',
      TURNSTILE_ORIGIN,
    ]),
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    directive('img-src', [
      "'self'",
      'data:',
      'blob:',
      'https://www.google-analytics.com',
      'https://www.googletagmanager.com',
      'https://www.clarity.ms',
      'https://*.clarity.ms',
      'https://c.bing.com',
      'https://www.facebook.com',
      'https://lh3.googleusercontent.com',
      'https://files.convex.dev',
      'https://tile.openstreetmap.org',
      ...convexOrigins,
    ]),
    "font-src 'self' data:",
    directive('connect-src', [
      "'self'",
      'https://www.google-analytics.com',
      'https://analytics.google.com',
      'https://www.google.com',
      'https://region1.google-analytics.com',
      'https://stats.g.doubleclick.net',
      'https://www.clarity.ms',
      'https://*.clarity.ms',
      'https://va.vercel-scripts.com',
      'https://vitals.vercel-insights.com',
      // Build Location reverse geocoder (REVERSE_GEOCODE_ENDPOINT).
      'https://api-bdc.io',
      ...convexOrigins,
      ...websocketOrigins(convexOrigins),
      ...chatOrigins,
    ]),
    directive('frame-src', [
      "'self'",
      'https://www.facebook.com',
      'https://facebook.com',
      TURNSTILE_ORIGIN,
      ...heroFrameOrigins,
    ]),
    directive('media-src', [
      "'self'",
      'blob:',
      'https://files.convex.dev',
      ...convexOrigins,
      ...heroMediaOrigins,
    ]),
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    'upgrade-insecure-requests',
  ].join('; ')
}

export const contentSecurityPolicy = buildContentSecurityPolicy()

export function buildProductionSecurityHeaders(
  csp = contentSecurityPolicy
) {
  return [
    {
      key: 'Content-Security-Policy',
      value: csp,
    },
    {
      key: 'Cross-Origin-Opener-Policy',
      value: 'same-origin',
    },
    {
      key: 'Cross-Origin-Resource-Policy',
      value: 'same-site',
    },
    {
      key: 'Referrer-Policy',
      value: 'strict-origin-when-cross-origin',
    },
    {
      key: 'Strict-Transport-Security',
      value: 'max-age=31536000; includeSubDomains; preload',
    },
    {
      key: 'X-Content-Type-Options',
      value: 'nosniff',
    },
    {
      key: 'X-Frame-Options',
      value: 'DENY',
    },
    {
      key: 'X-Permitted-Cross-Domain-Policies',
      value: 'none',
    },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(self)',
    },
  ]
}

const securityHeaders =
  process.env.NODE_ENV === 'production'
    ? buildProductionSecurityHeaders()
    : []

const crossOriginLogoHeaders = securityHeaders.map((header) =>
  header.key === 'Cross-Origin-Resource-Policy'
    ? { ...header, value: 'cross-origin' }
    : header
)

export function buildImageRemotePatterns(
  env: CrmProjectsEnv = process.env
) {
  const crmProjectPattern = getCrmProjectImageRemotePattern(env)
  return crmProjectPattern ? [crmProjectPattern] : []
}

export function buildProjectImageOptimizationLimits(
  env: CrmProjectsEnv = process.env
) {
  return {
    minimumCacheTTL: 2_678_400,
    ...(areCrmProjectImagesV3Required(env)
      ? { maximumResponseBody: 3_000_000 }
      : {}),
  };
}

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
  // three is ES modules only from r187 (its CommonJS entry just re-exports the
  // ES build), as react-three-fiber's Next.js setup expects. Listing it here
  // also makes next/jest compile it, which Jest needs to load it at all.
  transpilePackages: ['three'],
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [50, 60, 75],
    ...buildProjectImageOptimizationLimits(),
    remotePatterns: buildImageRemotePatterns(),
  },
  async headers() {
    if (!securityHeaders.length) {
      return []
    }

    return [
      {
        source: '/logos/:path*',
        headers: crossOriginLogoHeaders,
      },
      {
        source: '/((?!logos(?:/|$)).*)',
        headers: securityHeaders,
      },
    ]
  },
}

const sentryConfig = withSentryConfig(nextConfig, {
  org: '404dealer',
  project: 'shed210-production',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  telemetry: false,
  silent: !process.env.CI,
  tunnelRoute: '/sentry-tunnel',
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
  },
})

// Sentry adds per-render trace IDs even with tracesSampleRate: 0. Keeping them
// in cached HTML makes unchanged ISR pages count as new writes on every refresh.
// Remove only trace propagation metadata after the wrapper; keep error reporting,
// source maps, instrumentation, and the event tunnel configured by Sentry.
if (sentryConfig.experimental?.clientTraceMetadata) {
  sentryConfig.experimental.clientTraceMetadata =
    sentryConfig.experimental.clientTraceMetadata.filter(
      (name) => name !== 'sentry-trace' && name !== 'baggage'
    )
}

export default sentryConfig
