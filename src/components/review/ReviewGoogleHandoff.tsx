'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, MapPin } from 'lucide-react';
import {
  GOOGLE_MAPS_APP_URL,
  GOOGLE_REVIEW_URL,
  reviewLinkDevice,
  type ReviewLinkDevice,
} from '@/lib/reviewPage';

const primaryButton =
  'brand-button hero-primary-cta inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-base text-[var(--accent-contrast)] transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0d0f]';

function recordOpen(code: string, device: ReviewLinkDevice) {
  return fetch('/api/review-feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, event: 'opened', device }),
    // The page navigates to Google right away; keep the open alive.
    keepalive: true,
  });
}

function defaultNavigate(url: string) {
  window.location.replace(url);
}

/**
 * Personal review links go straight to Google (docs/review-page.md). The open
 * is recorded from the browser, so link-preview bots don't count. iPhone and
 * iPad get one button instead of a redirect: only a tap reliably hands the
 * link to the Google Maps app, where most people are already signed in.
 */
export default function ReviewGoogleHandoff({
  code,
  navigate = defaultNavigate,
}: {
  code: string | null;
  /** Injected in tests; jsdom cannot follow external URLs. */
  navigate?: (url: string) => void;
}) {
  const [device, setDevice] = useState<ReviewLinkDevice | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // Once per page load (refs survive React's dev double-mount).
    if (started.current) return;
    started.current = true;
    const current = reviewLinkDevice(navigator);
    setDevice(current);
    if (code) void recordOpen(code, current).catch(() => undefined);
    if (current !== 'iphone') navigate(GOOGLE_REVIEW_URL);
  }, [code, navigate]);

  return (
    <section className="interior-page text-white">
      <div className="mx-auto flex min-h-[calc(100svh-4.5rem)] w-full max-w-xl items-center px-4 py-10 sm:py-16">
        <div className="interior-hero w-full px-5 py-9 text-center sm:px-10 sm:py-12">
          <div className="relative z-10">
            <p className="interior-kicker">Your Shed210 build</p>
            <h1 className="brand-heading mt-4 text-4xl leading-none text-white sm:text-5xl">
              Thanks for building with us
            </h1>
            {device === 'iphone' ? (
              <>
                <p className="mx-auto mt-3 max-w-sm text-balance text-white/70">
                  Leave your review in Google Maps, where you&apos;re probably already signed in.
                  Tap <span className="whitespace-nowrap">Write a review</span> on our listing.
                </p>
                <a href={GOOGLE_MAPS_APP_URL} className={`${primaryButton} mt-7`}>
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Open Google Maps to review
                </a>
                <p className="mt-5 text-sm text-white/55">
                  No Google Maps app?{' '}
                  <a
                    href={GOOGLE_REVIEW_URL}
                    className="inline-block py-2 text-white/70 underline underline-offset-2 hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)]"
                  >
                    Review in your browser
                  </a>
                </p>
              </>
            ) : device ? (
              <>
                <p className="mx-auto mt-3 max-w-sm text-balance text-white/70" role="status">
                  Opening Google so you can leave a review.
                </p>
                <a href={GOOGLE_REVIEW_URL} className={`${primaryButton} mt-7`}>
                  Review us on Google
                  <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </a>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
