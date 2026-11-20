'use client'

import { useEffect, useState } from 'react'
import Reviews from '@/components/Reviews'
import type { GoogleReviewsSnapshot } from '@/lib/googleReviews.server'

export default function LiveGoogleReviews() {
  const [googleReviews, setGoogleReviews] = useState<GoogleReviewsSnapshot | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function hydrateGoogleReviews() {
      try {
        const response = await fetch('/api/google-reviews', {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok) return

        const snapshot = (await response.json()) as GoogleReviewsSnapshot
        if (!controller.signal.aborted) {
          setGoogleReviews(snapshot)
        }
      } catch {
        // Keep the server-rendered profile fallback when live reviews are unavailable.
      }
    }

    void hydrateGoogleReviews()
    return () => controller.abort()
  }, [])

  return <Reviews googleReviews={googleReviews} />
}
