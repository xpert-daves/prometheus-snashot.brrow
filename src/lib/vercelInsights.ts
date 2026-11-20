let insightsPromise: Promise<typeof import('@vercel/analytics') | null> | null = null

function getBasePath() {
  const basePath = process.env.NEXT_PUBLIC_VERCEL_OBSERVABILITY_BASEPATH?.trim()
  return basePath || undefined
}

export function loadVercelInsights() {
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') {
    return Promise.resolve(null)
  }

  insightsPromise ??= Promise.all([
    import('@vercel/analytics'),
    import('@vercel/speed-insights'),
  ])
    .then(([analytics, speedInsights]) => {
      const basePath = getBasePath()
      const props = {
        framework: 'next',
        ...(basePath ? { basePath } : {}),
      }

      analytics.inject(props)
      speedInsights.injectSpeedInsights(props)

      return analytics
    })
    .catch(() => null)

  return insightsPromise
}
