import 'server-only'

import { GOOGLE_PLACE_ID, SOCIAL_LINKS } from '@/lib/contact'

const GOOGLE_REVIEWS_FIELDS = [
  'rating',
  'userRatingCount',
  'reviews',
  'googleMapsLinks',
  'attributions',
].join(',')

const GOOGLE_REVIEW_SUMMARY_FIELDS = [
  'rating',
  'userRatingCount',
].join(',')

const GOOGLE_PLACES_TIMEOUT_MS = 5_000
const GOOGLE_ERROR_MESSAGE_MAX_LENGTH = 500
const GOOGLE_FAILURE_BACKOFF_BASE_MS = 5_000
const GOOGLE_FAILURE_BACKOFF_MAX_MS = 60_000

let consecutiveGoogleFailures = 0
let googleRetryNotBefore = 0
let fullDetailsRequestInFlight: Promise<GooglePlaceDetailsResponse | null> | null = null
let summaryRequestInFlight: Promise<GooglePlaceDetailsResponse | null> | null = null

type GoogleText = {
  text?: string
}

type GoogleAuthorAttribution = {
  displayName?: string
  uri?: string
  photoUri?: string
}

type GooglePlacesReview = {
  name?: string
  rating?: number
  text?: GoogleText
  relativePublishTimeDescription?: string
  publishTime?: string
  authorAttribution?: GoogleAuthorAttribution
  googleMapsUri?: string
  flagContentUri?: string
}

type GoogleMapsLinks = {
  placeUri?: string
  reviewsUri?: string
  writeAReviewUri?: string
}

type GoogleProviderAttribution = {
  provider?: string
  providerUri?: string
}

type GooglePlaceDetailsResponse = {
  rating?: number
  userRatingCount?: number
  reviews?: GooglePlacesReview[]
  googleMapsLinks?: GoogleMapsLinks
  attributions?: GoogleProviderAttribution[]
}

type GoogleApiErrorBody = {
  error?: {
    code?: unknown
    status?: unknown
    message?: unknown
  }
}

export type GoogleReview = {
  id: string
  authorName: string
  authorUri?: string
  authorPhotoUri?: string
  rating: number
  text: string
  relativePublishTime?: string
  publishTime?: string
  sourceUri: string
  reportUri?: string
}

export type GoogleReviewAttribution = {
  provider: string
  providerUri?: string
}

export type GoogleReviewsSnapshot = {
  rating: number | null
  reviewCount: number | null
  reviews: GoogleReview[]
  placeUri: string
  reviewsUri: string
  writeReviewUri?: string
  attributions: GoogleReviewAttribution[]
}

export type GoogleReviewSummary = {
  rating: number
  reviewCount: number
}

function safeHttpsUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined

  try {
    const trimmedValue = value.trim()
    const normalizedValue = trimmedValue.startsWith('//') ? `https:${trimmedValue}` : trimmedValue
    const url = new URL(normalizedValue)
    return url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

function trimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  return value.trim() || undefined
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function safeGoogleLogText(value: unknown, apiKey: string, fallback: string): string {
  if (typeof value !== 'string' || !value.trim()) return fallback

  return value
    .split(apiKey)
    .join('[redacted]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, GOOGLE_ERROR_MESSAGE_MAX_LENGTH)
}

async function logGoogleApiError(response: Response, apiKey: string): Promise<void> {
  let body: GoogleApiErrorBody = {}

  try {
    body = (await response.json()) as GoogleApiErrorBody
  } catch {
    // Preserve HTTP diagnostics when Google or a proxy returns an unreadable body.
  }

  const error = body.error
  console.error('[google-reviews] Place Details rejected request', {
    httpStatus: response.status,
    code: typeof error?.code === 'number' ? error.code : response.status,
    status: safeGoogleLogText(error?.status, apiKey, response.statusText || 'UNKNOWN'),
    message: safeGoogleLogText(
      error?.message,
      apiKey,
      'No readable Google error message'
    ),
  })
}

function normalizeReview(review: unknown, index: number): GoogleReview | null {
  const candidate = objectRecord(review)
  if (!candidate) return null

  const textContainer = objectRecord(candidate.text)
  const authorAttribution = objectRecord(candidate.authorAttribution)
  const text = trimmedString(textContainer?.text)
  const rating = candidate.rating
  if (
    !text ||
    typeof rating !== 'number' ||
    !Number.isFinite(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    return null
  }

  const authorName =
    trimmedString(authorAttribution?.displayName) || 'Google reviewer'
  const publishTime = trimmedString(candidate.publishTime)
  const sourceUri = safeHttpsUrl(candidate.googleMapsUri) || SOCIAL_LINKS.google

  return {
    id: trimmedString(candidate.name) || `${authorName}-${publishTime || index}`,
    authorName,
    authorUri: safeHttpsUrl(authorAttribution?.uri),
    authorPhotoUri: safeHttpsUrl(authorAttribution?.photoUri),
    rating,
    text,
    relativePublishTime: trimmedString(
      candidate.relativePublishTimeDescription
    ),
    publishTime,
    sourceUri,
    reportUri: safeHttpsUrl(candidate.flagContentUri),
  }
}

function normalizeRating(place: GooglePlaceDetailsResponse): number | null {
  return typeof place.rating === 'number' &&
    Number.isFinite(place.rating) &&
    place.rating >= 0 &&
    place.rating <= 5
    ? place.rating
    : null
}

function normalizeReviewCount(place: GooglePlaceDetailsResponse): number | null {
  return typeof place.userRatingCount === 'number' &&
    Number.isFinite(place.userRatingCount) &&
    place.userRatingCount >= 0
    ? place.userRatingCount
    : null
}

function normalizeAttributions(
  place: GooglePlaceDetailsResponse
): GoogleReviewAttribution[] {
  const attributions = Array.isArray(place.attributions) ? place.attributions : []
  return attributions.flatMap((attribution) => {
    const candidate = objectRecord(attribution)
    if (!candidate) return []
    const provider = trimmedString(candidate.provider)
    if (!provider) return []

    return [
      {
        provider,
        providerUri: safeHttpsUrl(candidate.providerUri),
      },
    ]
  })
}

function hasUsableGooglePlaceDetails(
  place: GooglePlaceDetailsResponse,
  fieldMask: string
) {
  const rating = normalizeRating(place)
  const reviewCount = normalizeReviewCount(place)

  if (fieldMask === GOOGLE_REVIEW_SUMMARY_FIELDS) {
    return rating !== null && reviewCount !== null
  }

  return (
    rating !== null ||
    reviewCount !== null ||
    (Array.isArray(place.reviews) ? place.reviews : []).some(
      (review, index) => normalizeReview(review, index) !== null
    )
  )
}

function recordGoogleRequestSuccess() {
  consecutiveGoogleFailures = 0
  googleRetryNotBefore = 0
}

function recordGoogleRequestFailure() {
  consecutiveGoogleFailures = Math.min(consecutiveGoogleFailures + 1, 8)
  const backoffMs = Math.min(
    GOOGLE_FAILURE_BACKOFF_MAX_MS,
    GOOGLE_FAILURE_BACKOFF_BASE_MS * 2 ** (consecutiveGoogleFailures - 1)
  )
  googleRetryNotBefore = Date.now() + backoffMs
}

async function requestGooglePlaceDetails(
  fieldMask: string
): Promise<GooglePlaceDetailsResponse | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim()
  if (!apiKey) {
    console.error('[google-reviews] GOOGLE_PLACES_API_KEY is not configured')
    recordGoogleRequestFailure()
    return null
  }

  const endpoint = new URL(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(GOOGLE_PLACE_ID)}`
  )
  endpoint.searchParams.set('languageCode', 'en')

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), GOOGLE_PLACES_TIMEOUT_MS)

  try {
    const response = await fetch(endpoint, {
      headers: {
        Accept: 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      cache: 'no-store',
      signal: controller.signal,
    })

    if (!response.ok) {
      await logGoogleApiError(response, apiKey)
      recordGoogleRequestFailure()
      return null
    }

    const place = (await response.json()) as GooglePlaceDetailsResponse
    if (!hasUsableGooglePlaceDetails(place, fieldMask)) {
      console.error(
        fieldMask === GOOGLE_REVIEW_SUMMARY_FIELDS
          ? '[google-reviews] Place Details returned no usable rating or review count'
          : '[google-reviews] Place Details returned no usable rating, review count, or reviews'
      )
      recordGoogleRequestFailure()
      return null
    }
    recordGoogleRequestSuccess()
    return place
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(
        `[google-reviews] Place Details timed out after ${GOOGLE_PLACES_TIMEOUT_MS}ms`
      )
    } else {
      console.error('[google-reviews] Place Details request failed')
    }
    recordGoogleRequestFailure()
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

async function fetchGooglePlaceDetails(
  fieldMask: string
): Promise<GooglePlaceDetailsResponse | null> {
  if (Date.now() < googleRetryNotBefore) return null

  const wantsFullDetails = fieldMask === GOOGLE_REVIEWS_FIELDS
  if (!wantsFullDetails && fullDetailsRequestInFlight) {
    return await fullDetailsRequestInFlight
  }

  const existingRequest = wantsFullDetails
    ? fullDetailsRequestInFlight
    : summaryRequestInFlight
  if (existingRequest) return await existingRequest

  const request = requestGooglePlaceDetails(fieldMask)
  if (wantsFullDetails) fullDetailsRequestInFlight = request
  else summaryRequestInFlight = request

  try {
    return await request
  } finally {
    if (wantsFullDetails && fullDetailsRequestInFlight === request) {
      fullDetailsRequestInFlight = null
    }
    if (!wantsFullDetails && summaryRequestInFlight === request) {
      summaryRequestInFlight = null
    }
  }
}

export function getGoogleReviewsRetryAfterSeconds() {
  if (googleRetryNotBefore <= Date.now()) return 0
  return Math.max(1, Math.ceil((googleRetryNotBefore - Date.now()) / 1_000))
}

export function resetGoogleReviewsRequestStateForTests() {
  consecutiveGoogleFailures = 0
  googleRetryNotBefore = 0
  fullDetailsRequestInFlight = null
  summaryRequestInFlight = null
}

export async function getGoogleReviewSummary(): Promise<GoogleReviewSummary | null> {
  const place = await fetchGooglePlaceDetails(GOOGLE_REVIEW_SUMMARY_FIELDS)
  if (!place) return null

  const rating = normalizeRating(place)
  const reviewCount = normalizeReviewCount(place)

  if (rating === null || reviewCount === null) {
    console.error(
      '[google-reviews] Place Details returned no usable rating or review count'
    )
    return null
  }

  return {
    rating,
    reviewCount,
  }
}

export async function getGoogleReviews(): Promise<GoogleReviewsSnapshot | null> {
  const place = await fetchGooglePlaceDetails(GOOGLE_REVIEWS_FIELDS)
  if (!place) return null

  const placeUri = safeHttpsUrl(place.googleMapsLinks?.placeUri) || SOCIAL_LINKS.google
  const reviewsUri = safeHttpsUrl(place.googleMapsLinks?.reviewsUri) || placeUri
  const rawReviews = Array.isArray(place.reviews) ? place.reviews : []
  const reviews = rawReviews.flatMap((review, index) => {
    const normalized = normalizeReview(review, index)
    return normalized ? [normalized] : []
  })
  const rating = normalizeRating(place)
  const reviewCount = normalizeReviewCount(place)

  if (rating === null && reviewCount === null && reviews.length === 0) {
    console.error(
      '[google-reviews] Place Details returned no usable rating, review count, or reviews'
    )
  }

  return {
    rating,
    reviewCount,
    reviews,
    placeUri,
    reviewsUri,
    writeReviewUri: safeHttpsUrl(place.googleMapsLinks?.writeAReviewUri),
    attributions: normalizeAttributions(place),
  }
}
