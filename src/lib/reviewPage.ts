import { GOOGLE_PLACE_ID } from '@/lib/contact';

/** Review links carry the CRM's 8-character Crockford base32 code. */
export const REVIEW_LINK_CODE_PATTERN = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{8}$/;
export const REVIEW_COMMENT_MAX_LENGTH = 1_000;

export type ReviewFeedbackEvent = 'opened' | 'rated' | 'commented' | 'google_opened';
export type ReviewLinkDevice = 'iphone' | 'android' | 'desktop' | 'other';
export const REVIEW_LINK_DEVICES: readonly ReviewLinkDevice[] = ['iphone', 'android', 'desktop', 'other'];

/** Coarse device class for the CRM's "opened their review link" note; no fingerprinting. */
export function reviewLinkDevice(
  nav: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'>,
): ReviewLinkDevice {
  const ua = nav.userAgent;
  if (/iPhone|iPod|iPad/.test(ua) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)) return 'iphone';
  if (/Android/.test(ua)) return 'android';
  if (/Windows NT|Macintosh|X11|CrOS/.test(ua)) return 'desktop';
  return 'other';
}

/** Accepts a hand-typed code: case-insensitive, O read as 0, I/L read as 1. */
export function normalizeReviewLinkCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1');
  return REVIEW_LINK_CODE_PATTERN.test(code) ? code : null;
}

/** Opens Google's review form for the Shed210 listing (sign-in required). */
export const GOOGLE_REVIEW_URL =
  `https://search.google.com/local/writereview?placeid=${GOOGLE_PLACE_ID}`;

/**
 * A Google Maps URL that iOS hands to the Google Maps app when it is
 * installed, where most customers are already signed in.
 */
export const GOOGLE_MAPS_APP_URL =
  `https://www.google.com/maps/search/?api=1&query=Sheds%20210&query_place_id=${GOOGLE_PLACE_ID}`;
