jest.mock('@sentry/nextjs/config', () => ({
  withSentryConfig: <T,>(config: T) => config,
}))

import nextConfig, {
  buildContentSecurityPolicy,
  buildProductionSecurityHeaders,
  contentSecurityPolicy,
  cspInlineAllowlistRationale,
} from '../../../next.config'
import { REVERSE_GEOCODE_ENDPOINT } from '../useQuoteDeliveryPrefill'

function getDirective(policy: string, name: string): string {
  return (
    policy
      .split('; ')
      .find((directive) => directive.startsWith(`${name} `)) ?? ''
  )
}

describe('security headers', () => {
  it('allows Microsoft Clarity bootstrap and runtime hosts', () => {
    expect(contentSecurityPolicy).toContain('https://www.clarity.ms')
    expect(contentSecurityPolicy).toContain('https://scripts.clarity.ms')
    expect(contentSecurityPolicy).toContain('https://*.clarity.ms')
    expect(getDirective(contentSecurityPolicy, 'img-src')).toContain(
      'https://c.bing.com'
    )
  })

  it('allows the configured Google Analytics collection origins', () => {
    const connectSrc = getDirective(contentSecurityPolicy, 'connect-src')
    expect(connectSrc).toContain('https://www.google-analytics.com')
    expect(connectSrc).toContain('https://analytics.google.com')
    expect(connectSrc).toContain('https://www.google.com')
  })

  it('allows the Build Location reverse geocoder the quote flow calls', () => {
    const connectSrc = getDirective(contentSecurityPolicy, 'connect-src')
    expect(connectSrc.split(/\s+/)).toContain(
      new URL(REVERSE_GEOCODE_ENDPOINT).origin
    )
  })

  it('keeps retained inline CSP exceptions documented', () => {
    expect(contentSecurityPolicy).toContain("script-src 'self' 'unsafe-inline'")
    expect(contentSecurityPolicy).toContain("script-src-attr 'none'")
    expect(contentSecurityPolicy).toContain("style-src 'self' 'unsafe-inline'")
    expect(cspInlineAllowlistRationale).toHaveLength(2)
  })

  it('does not use a blanket HTTPS image source', () => {
    const imgSrc = getDirective(contentSecurityPolicy, 'img-src')
    expect(imgSrc).toContain("img-src 'self' data: blob:")
    expect(imgSrc.split(/\s+/)).not.toContain('https:')
    expect(imgSrc.split(/\s+/)).toContain('https://lh3.googleusercontent.com')
    expect(contentSecurityPolicy).toContain('https://files.convex.dev')
    expect(contentSecurityPolicy).toContain('https://tile.openstreetmap.org')
  })

  it('uses exact configured Convex and hero media origins', () => {
    const policy = buildContentSecurityPolicy({
      NEXT_PUBLIC_CONVEX_URL: 'https://quote-deployment.convex.cloud',
      NEXT_PUBLIC_CONVEX_SITE_URL: 'https://quote-deployment.convex.site',
      FRONTIER_PIXEL_CRM_CONVEX_URL: 'https://crm-deployment.convex.cloud',
      NEXT_PUBLIC_HERO_VIDEO_MP4_SRC:
        'https://media.shed210.example/videos/hero.mp4',
      NEXT_PUBLIC_HERO_FULL_VIDEO_EMBED_SRC:
        'https://player.shed210.example/embed/build-day',
    })

    expect(getDirective(policy, 'connect-src')).toContain(
      'https://quote-deployment.convex.cloud'
    )
    expect(getDirective(policy, 'connect-src')).toContain(
      'wss://quote-deployment.convex.cloud'
    )
    expect(getDirective(policy, 'img-src')).toContain(
      'https://crm-deployment.convex.cloud'
    )
    expect(getDirective(policy, 'media-src')).toContain(
      'https://media.shed210.example'
    )
    expect(getDirective(policy, 'frame-src')).toContain(
      'https://player.shed210.example'
    )
    expect(policy).not.toContain('*.convex.cloud')
    expect(policy).not.toContain('*.convex.site')
  })

  it('does not trust non-Convex hosts supplied as Convex configuration', () => {
    const policy = buildContentSecurityPolicy({
      NEXT_PUBLIC_CONVEX_URL: 'https://attacker.example',
      FRONTIER_PIXEL_CRM_CONVEX_URL: 'http://crm-deployment.convex.cloud',
    })

    expect(policy).not.toContain('attacker.example')
    expect(policy).not.toContain('crm-deployment.convex.cloud')
  })

  it('allows the exact CRM chat origin and Cloudflare Turnstile for website chat', () => {
    const policy = buildContentSecurityPolicy({
      NEXT_PUBLIC_CRM_CHAT_URL: 'https://crm-deployment.convex.site/',
    })

    expect(getDirective(policy, 'connect-src').split(/\s+/)).toContain(
      'https://crm-deployment.convex.site'
    )
    expect(getDirective(policy, 'script-src').split(/\s+/)).toContain(
      'https://challenges.cloudflare.com'
    )
    expect(getDirective(policy, 'frame-src').split(/\s+/)).toContain(
      'https://challenges.cloudflare.com'
    )
    expect(policy).not.toContain('*.convex.site')
  })

  it('does not trust a chat URL that is not an https convex.site origin', () => {
    for (const value of [
      'https://attacker.example',
      'http://crm-deployment.convex.site',
      'https://crm-deployment.convex.cloud',
    ]) {
      const connectSrc = getDirective(
        buildContentSecurityPolicy({ NEXT_PUBLIC_CRM_CHAT_URL: value }),
        'connect-src'
      )
      expect(connectSrc).not.toContain('attacker.example')
      expect(connectSrc).not.toContain('crm-deployment')
    }
  })

  it('denies framing and emits the complete production header set', () => {
    const headers = new Map(
      buildProductionSecurityHeaders('test-policy').map(({ key, value }) => [
        key,
        value,
      ])
    )

    expect(contentSecurityPolicy).toContain("frame-ancestors 'none'")
    expect(headers.get('Content-Security-Policy')).toBe('test-policy')
    expect(headers.get('X-Frame-Options')).toBe('DENY')
    expect(headers.get('X-Permitted-Cross-Domain-Policies')).toBe('none')
    expect(headers.get('Strict-Transport-Security')).toContain(
      'includeSubDomains'
    )
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('keeps experimental SRI disabled for Next managed scripts', () => {
    expect(nextConfig.experimental ?? {}).not.toHaveProperty('sri')
  })

  it('delegates trailing-slash redirects to the app proxy', () => {
    expect(nextConfig.skipTrailingSlashRedirect).toBe(true)
  })
})
