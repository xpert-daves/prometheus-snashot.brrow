import { ExternalLink, Star, StarHalf } from 'lucide-react'
import { FacebookBadgeIcon, GoogleBadgeIcon } from './BrandIcons'
import { SOCIAL_LINKS } from '@/lib/contact'
import type { GoogleReview, GoogleReviewsSnapshot } from '@/lib/googleReviews.server'

type ReviewsProps = {
  googleReviews: GoogleReviewsSnapshot | null
}

const FACEBOOK_BUILD_VIDEO_URL =
  'https://www.facebook.com/shed210/videos/592495263524622/'

function Stars({ rating }: { rating: number }) {
  const normalizedRating = Math.max(0, Math.min(5, rating))
  const full = Math.floor(normalizedRating)
  const hasHalf = normalizedRating - full >= 0.25
  const empty = 5 - full - (hasHalf ? 1 : 0)

  return (
    <span
      className="inline-flex items-center gap-0.5 text-amber-400"
      role="img"
      aria-label={`${rating.toFixed(1)} out of 5 stars`}
    >
      {Array.from({ length: full }).map((_, index) => (
        <Star key={`full-${index}`} aria-hidden="true" size={16} fill="currentColor" stroke="currentColor" />
      ))}
      {hasHalf ? <StarHalf aria-hidden="true" size={16} fill="currentColor" stroke="currentColor" /> : null}
      {Array.from({ length: empty }).map((_, index) => (
        <Star key={`empty-${index}`} aria-hidden="true" size={16} className="text-white/25" />
      ))}
    </span>
  )
}

function AuthorAvatar({ review }: { review: GoogleReview }) {
  const initials = review.authorName.trim().slice(0, 1).toUpperCase() || 'G'

  if (!review.authorPhotoUri) {
    return (
      <span
        aria-hidden="true"
        className="brand-subheading grid h-11 w-11 shrink-0 place-items-center rounded-full border border-amber-300/30 bg-amber-300/10 text-sm text-amber-200"
      >
        {initials}
      </span>
    )
  }

  const image = (
    // Google attribution photos must load directly from Google rather than through an image proxy.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={review.authorPhotoUri}
      alt=""
      width="44"
      height="44"
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className="h-11 w-11 rounded-full border border-white/15 object-cover"
    />
  )

  return review.authorUri ? (
    <a
      href={review.authorUri}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`View ${review.authorName}'s Google Maps profile`}
      className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
    >
      {image}
    </a>
  ) : (
    image
  )
}

function ReviewCard({ review, index }: { review: GoogleReview; index: number }) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b1017]/90 p-5 shadow-[0_22px_55px_-34px_rgba(0,0,0,0.9)]">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/65 to-transparent"
      />
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <AuthorAvatar review={review} />
          <div className="min-w-0">
            {review.authorUri ? (
              <a
                href={review.authorUri}
                target="_blank"
                rel="noopener noreferrer"
                className="brand-subheading block truncate text-sm text-white transition hover:text-amber-300"
              >
                {review.authorName}
              </a>
            ) : (
              <p className="brand-subheading truncate text-sm text-white">{review.authorName}</p>
            )}
            {review.relativePublishTime ? (
              <time dateTime={review.publishTime} className="mt-1 block text-xs text-white/50">
                {review.relativePublishTime}
              </time>
            ) : null}
          </div>
        </div>
        <span className="motif-spec shrink-0 text-[0.58rem] text-amber-300/65">
          REVIEW / {String(index + 1).padStart(2, '0')}
        </span>
      </div>

      <div className="mt-4">
        <Stars rating={review.rating} />
      </div>
      <blockquote className="mt-3 text-sm leading-6 text-white/78 sm:text-[0.95rem]">
        <span aria-hidden="true" className="mr-1 text-amber-300/70">&ldquo;</span>
        {review.text}
        <span aria-hidden="true" className="ml-1 text-amber-300/70">&rdquo;</span>
      </blockquote>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/8 pt-4 text-xs">
        <a
          href={review.sourceUri}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-medium text-blue-300 transition hover:text-blue-200"
        >
          View on Google Maps
          <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
        </a>
        {review.reportUri ? (
          <a
            href={review.reportUri}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/60 underline decoration-white/30 underline-offset-2 transition hover:text-white"
          >
            Report review
          </a>
        ) : null}
      </div>
    </article>
  )
}

export function ReviewsLoading() {
  return (
    <div className="mt-8 min-h-[22rem] text-white" aria-busy="true" aria-label="Loading current Google reviews">
      <div className="mx-auto max-w-3xl text-center">
        <p className="motif-spec text-[0.62rem] text-amber-300/70">FIELD NOTES / CUSTOMER FEEDBACK</p>
        <h3 className="brand-subheading mt-2 text-2xl text-white">Built right. Reviewed publicly.</h3>
      </div>
      <div className="mt-7 animate-pulse rounded-2xl border border-white/10 bg-slate-950/55 p-6">
        <div className="h-4 w-36 rounded bg-white/10" />
        <div className="mt-4 h-8 w-56 rounded bg-white/10" />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="h-44 rounded-xl bg-white/5" />
          <div className="h-44 rounded-xl bg-white/5" />
        </div>
      </div>
    </div>
  )
}

export default function Reviews({ googleReviews }: ReviewsProps) {
  const rating = googleReviews?.rating
  const reviewCount = googleReviews?.reviewCount
  const reviewCountLabel =
    reviewCount === null || reviewCount === undefined
      ? 'Google reviews'
      : `${new Intl.NumberFormat('en-US').format(reviewCount)} Google reviews`
  const reviewsUri = googleReviews?.reviewsUri || SOCIAL_LINKS.google

  return (
    <div className="mt-8 text-white">
      <div className="mx-auto max-w-3xl text-center">
        <p className="motif-spec text-[0.62rem] text-amber-300/70">FIELD NOTES / CUSTOMER FEEDBACK</p>
        <h3 className="brand-subheading mt-2 text-2xl text-white sm:text-3xl">
          Built right. Reviewed publicly.
        </h3>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/62">
          Current feedback from customers who found Shed210 on Google.
        </p>
      </div>

      <div className="mt-7 grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(16rem,0.75fr)]">
        <div className="relative overflow-hidden rounded-2xl border border-amber-300/25 bg-[linear-gradient(135deg,rgba(245,158,11,0.16),rgba(15,23,42,0.88)_52%)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <a
              href={reviewsUri}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Read ${reviewCountLabel}`}
              className="group flex min-w-0 items-center gap-4 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white shadow-lg shadow-black/20">
                <GoogleBadgeIcon className="h-7 w-7 text-[#EA4335]" />
              </span>
              <span className="min-w-0">
                <span className="motif-spec block text-[0.58rem] text-amber-200/70">GOOGLE / LIVE PROFILE</span>
                {rating !== null && rating !== undefined ? (
                  <span className="mt-1 flex flex-wrap items-center gap-2">
                    <strong className="brand-subheading text-2xl text-white">{rating.toFixed(1)}</strong>
                    <Stars rating={rating} />
                    <span className="text-sm text-white/60">{reviewCountLabel}</span>
                  </span>
                ) : (
                  <span className="brand-subheading mt-1 block text-lg text-white">
                    Read current reviews on Google
                  </span>
                )}
              </span>
            </a>
            {googleReviews?.writeReviewUri ? (
              <a
                href={googleReviews.writeReviewUri}
                target="_blank"
                rel="noopener noreferrer"
                className="brand-button inline-flex items-center gap-2 rounded-full border border-amber-300/35 bg-amber-300/10 px-4 py-2 text-xs text-amber-100 transition hover:bg-amber-300/18"
              >
                Write a review
                <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
        </div>

        <a
          href={SOCIAL_LINKS.facebook}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/55 p-5 transition hover:border-blue-300/30 hover:bg-slate-950/75"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#1877F2]/12">
            <FacebookBadgeIcon className="h-6 w-6 text-[#1877F2]" />
          </span>
          <span>
            <span className="motif-spec block text-[0.58rem] text-blue-200/60">MORE CUSTOMER PROOF</span>
            <span className="brand-subheading mt-1 block text-sm text-white">Visit Shed210 on Facebook</span>
          </span>
          <ExternalLink aria-hidden="true" className="ml-auto h-4 w-4 text-white/35 transition group-hover:text-blue-200" />
        </a>
      </div>

      {googleReviews?.reviews.length ? (
        <section aria-label="Google customer reviews" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2">
            {googleReviews.reviews.map((review, index) => (
              <ReviewCard key={review.id} review={review} index={index} />
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-1 text-center text-[0.7rem] leading-5 text-white/60">
            <p>Reviews are selected and ordered by Google based on relevance.</p>
            <p>
              Review content provided by{' '}
              <a
                href={googleReviews.placeUri}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/65 underline decoration-white/25 underline-offset-2 hover:text-white"
              >
                Google Maps
              </a>
              {googleReviews.attributions.map((attribution) => (
                <span key={`${attribution.provider}-${attribution.providerUri || ''}`}>
                  {' · '}
                  {attribution.providerUri ? (
                    <a
                      href={attribution.providerUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white/65 underline decoration-white/25 underline-offset-2 hover:text-white"
                    >
                      {attribution.provider}
                    </a>
                  ) : (
                    attribution.provider
                  )}
                </span>
              ))}
            </p>
          </div>
        </section>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-white/15 bg-slate-950/35 px-5 py-8 text-center">
          <p className="text-sm text-white/65">
            See the latest rating and customer feedback directly on Google.
          </p>
          <a
            href={SOCIAL_LINKS.google}
            target="_blank"
            rel="noopener noreferrer"
            className="brand-button mt-3 inline-flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200"
          >
            Read current reviews on Google
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
          </a>
        </div>
      )}

      <section aria-labelledby="facebook-proof-heading" className="mt-10 border-t border-white/10 pt-8">
        <div className="mb-4 text-center">
          <p className="motif-spec text-[0.58rem] text-blue-200/75">SOCIAL / BUILD DAY</p>
          <h4 id="facebook-proof-heading" className="brand-subheading mt-1 text-lg text-white">
            More from the Shed210 crew
          </h4>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <a
            href={FACEBOOK_BUILD_VIDEO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-2xl border border-white/10 bg-slate-950/55 p-5 transition hover:border-blue-300/35 hover:bg-slate-950/75"
          >
            <span className="motif-spec text-[0.62rem] text-blue-200/75">
              BUILD-DAY VIDEO
            </span>
            <span className="brand-subheading mt-2 flex items-center gap-2 text-base text-white">
              Watch a recent shed build
              <ExternalLink aria-hidden="true" className="h-4 w-4 text-blue-200" />
            </span>
            <span className="mt-2 block text-sm leading-6 text-white/65">
              Open the original video post with Facebook&apos;s playback controls.
              <span className="sr-only"> Opens in a new tab.</span>
            </span>
          </a>
          <a
            href={SOCIAL_LINKS.facebook}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-2xl border border-white/10 bg-slate-950/55 p-5 transition hover:border-blue-300/35 hover:bg-slate-950/75"
          >
            <span className="motif-spec text-[0.62rem] text-blue-200/75">
              FACEBOOK UPDATES
            </span>
            <span className="brand-subheading mt-2 flex items-center gap-2 text-base text-white">
              Visit the Shed210 page
              <ExternalLink aria-hidden="true" className="h-4 w-4 text-blue-200" />
            </span>
            <span className="mt-2 block text-sm leading-6 text-white/65">
              Browse current project photos, videos, and crew updates.
              <span className="sr-only"> Opens in a new tab.</span>
            </span>
          </a>
        </div>
      </section>
    </div>
  )
}
