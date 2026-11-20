'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Star } from 'lucide-react'

/** Shared by the hero proof items that open a page. */
export const heroProofLinkClassName =
  'min-h-10 rounded-xl transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70'

/** Icon over text on phones, beside it from sm up. Shared so all three proof items line up. */
export const heroProofItemLayoutClassName =
  'flex min-w-0 flex-col items-center justify-start gap-1.5 sm:flex-row sm:justify-center sm:gap-2'

type HeroGoogleReviewProofProps = {
  icon: ReactNode
}

type GoogleReviewSummaryPayload = {
  rating: number
  reviewCount: number
}

const reviewCountFormatter = new Intl.NumberFormat('en-US')

function isGoogleReviewSummary(
  value: unknown
): value is GoogleReviewSummaryPayload {
  if (!value || typeof value !== 'object') return false

  const summary = value as Partial<GoogleReviewSummaryPayload>
  return (
    typeof summary.rating === 'number' &&
    Number.isFinite(summary.rating) &&
    summary.rating >= 0 &&
    summary.rating <= 5 &&
    typeof summary.reviewCount === 'number' &&
    Number.isInteger(summary.reviewCount) &&
    summary.reviewCount >= 0
  )
}

export default function HeroGoogleReviewProof({
  icon,
}: HeroGoogleReviewProofProps) {
  const [summary, setSummary] = useState<GoogleReviewSummaryPayload | null>(null)

  useEffect(() => {
    let active = true
    let idleCallbackId = 0
    let fallbackTimerId = 0
    let controller: AbortController | undefined

    const loadSummary = async () => {
      controller = new AbortController()

      try {
        const response = await fetch('/api/google-reviews/summary', {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        })
        if (!response.ok) return

        const payload: unknown = await response.json()
        if (active && isGoogleReviewSummary(payload)) {
          setSummary(payload)
        }
      } catch {
        // Keep the stable live-review fallback when the optional summary is unavailable.
      }
    }

    const scheduleSummary = () => {
      if (typeof window.requestIdleCallback === 'function') {
        idleCallbackId = window.requestIdleCallback(() => void loadSummary(), {
          timeout: 2_000,
        })
        return
      }

      fallbackTimerId = window.setTimeout(() => void loadSummary(), 0)
    }

    if (document.readyState === 'complete') {
      scheduleSummary()
    } else {
      window.addEventListener('load', scheduleSummary, { once: true })
    }

    return () => {
      active = false
      window.removeEventListener('load', scheduleSummary)
      if (idleCallbackId && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleCallbackId)
      }
      if (fallbackTimerId) window.clearTimeout(fallbackTimerId)
      controller?.abort()
    }
  }, [])

  const ratingLabel = summary?.rating.toFixed(1)
  const formattedReviewCount = summary
    ? reviewCountFormatter.format(summary.reviewCount)
    : null
  const reviewCountLabel = summary
    ? `${formattedReviewCount} ${summary.reviewCount === 1 ? 'review' : 'reviews'}`
    : null
  const accessibleLabel = summary
    ? `Google rating ${ratingLabel} out of 5 stars from ${reviewCountLabel}`
    : 'Live Google Reviews'

  return (
    <li className="min-w-0 px-2 first:pl-0 last:pr-0">
      <Link
        href="/gallery#reviews"
        aria-label={accessibleLabel}
        className={`${heroProofLinkClassName} ${heroProofItemLayoutClassName}`}
      >
        {icon}
        <span className="grid min-w-0 grid-rows-[1rem_1rem] justify-items-center text-center leading-tight sm:justify-items-start sm:text-left">
          <span className="flex min-w-0 items-center gap-1 text-sm font-semibold tracking-[0.01em] text-white/92 tabular-nums">
            {ratingLabel || 'Live'}
            {summary ? (
              <Star
                aria-hidden="true"
                data-testid="hero-google-rating-star"
                className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400"
                strokeWidth={1.8}
              />
            ) : null}
          </span>
          <span className="whitespace-nowrap text-[0.58rem] font-medium uppercase tracking-[0.04em] text-white/58 tabular-nums sm:text-[0.66rem] sm:tracking-[0.08em]">
            {reviewCountLabel || 'Google Reviews'}
          </span>
        </span>
      </Link>
    </li>
  )
}
