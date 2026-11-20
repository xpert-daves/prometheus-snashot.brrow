import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { canonicalHost } from '@/lib/seo'
import { shouldEnforceCanonicalHost } from '@/lib/deployment'

const LEGACY_LULING_PROJECT_PATH =
  '/projects/luling/16x20x9-side-utility-luling-2'
const CANONICAL_LULING_PROJECT_PATH =
  '/projects/luling/16x20x9-side-utility-luling'

function replacePathname(url: { href: string }, pathname: string) {
  const destination = new URL(url.href)
  destination.pathname = pathname
  url.href = destination.href
}

function wasExcludedFromPrimaryProxyMatcher(pathname: string) {
  return [
    '/_next/static',
    '/_next/image',
    '/favicon.ico',
    '/robots.txt',
    '/sitemap.xml',
    '/sentry-tunnel',
  ].some((prefix) => pathname.startsWith(prefix))
}

export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone()
  const isSafeNavigationRequest = request.method === 'GET' || request.method === 'HEAD'
  const isLegacyLulingProjectPath =
    isSafeNavigationRequest &&
    (url.pathname === LEGACY_LULING_PROJECT_PATH ||
      url.pathname === `${LEGACY_LULING_PROJECT_PATH}/`)
  const isLegacyHomePath =
    isSafeNavigationRequest && (url.pathname === '/home' || url.pathname === '/home/')
  const isLegacyGalleryPath =
    isSafeNavigationRequest &&
    (url.pathname === '/our-work' || url.pathname === '/our-work/')
  const hasNonRootTrailingSlash =
    url.pathname !== '/' && url.pathname.endsWith('/')

  if (
    !hasNonRootTrailingSlash &&
    wasExcludedFromPrimaryProxyMatcher(url.pathname)
  ) {
    return NextResponse.next()
  }

  let redirectStatus: 301 | 308 | undefined

  if (isLegacyHomePath) {
    replacePathname(url, '/')
    redirectStatus = 301
  } else if (isLegacyGalleryPath) {
    replacePathname(url, '/gallery')
    redirectStatus = 301
  } else if (isLegacyLulingProjectPath) {
    replacePathname(url, CANONICAL_LULING_PROJECT_PATH)
    redirectStatus = 301
  } else if (hasNonRootTrailingSlash) {
    replacePathname(url, url.pathname.replace(/\/+$/, ''))
    redirectStatus = 308
  }

  if (process.env.NODE_ENV === 'production') {
    const isLoopbackHost = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (!isLoopbackHost && url.protocol !== 'https:') {
      url.protocol = 'https:'
      redirectStatus ??= isSafeNavigationRequest ? 301 : 308
    }

    const expectedHost = canonicalHost()
    if (
      !isLoopbackHost &&
      shouldEnforceCanonicalHost() &&
      expectedHost &&
      url.host !== expectedHost
    ) {
      url.host = expectedHost
      redirectStatus ??= isSafeNavigationRequest ? 301 : 308
    }
  }

  if (redirectStatus) {
    return NextResponse.redirect(url, redirectStatus)
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/:path*',
}
