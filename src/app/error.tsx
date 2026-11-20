'use client'

import * as Sentry from '@sentry/nextjs'
import { MessageSquareText, Phone } from 'lucide-react'
import { useEffect } from 'react'
import Container from '@/components/Container'
import TrackedActionLink from '@/components/TrackedActionLink'
import { PHONE_DISPLAY, PHONE_NUMBER } from '@/lib/contact'

type ErrorPageProps = {
  error: Error & { digest?: string }
  retry: () => void
}

const secondaryAction =
  'brand-button inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-6 text-sm text-white/90 transition-colors hover:border-white/35 hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] sm:w-auto'

/**
 * Catches render errors on any page. It renders inside the root layout, so the
 * navbar and footer (with the phone number) stay on screen; global-error.tsx
 * only takes over when the root layout itself fails.
 */
export default function ErrorPage({ error, retry }: ErrorPageProps) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <main id="main" tabIndex={-1} className="interior-page py-10 text-white sm:py-14 lg:py-18">
      <Container>
        <section className="interior-hero mx-auto max-w-3xl px-6 py-8 sm:px-9 sm:py-10">
          <h1 className="brand-heading text-3xl text-white sm:text-4xl">This page didn&apos;t load</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/70">
            The problem was reported. Try again, or call or text us at {PHONE_DISPLAY} and we&apos;ll
            help you directly.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => retry()}
              className="brand-button hero-primary-cta inline-flex min-h-12 w-full items-center justify-center rounded-full px-6 text-base text-[var(--accent-contrast)] transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0d0f] sm:w-auto"
            >
              Try again
            </button>
            <TrackedActionLink
              href={`tel:${PHONE_NUMBER}`}
              eventName="phone_click"
              eventProperties={{ location: 'error_page' }}
              aria-label={`Call ${PHONE_DISPLAY}`}
              className={secondaryAction}
            >
              <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
              Call
            </TrackedActionLink>
            <TrackedActionLink
              href={`sms:${PHONE_NUMBER}`}
              eventName="text_click"
              eventProperties={{ location: 'error_page' }}
              aria-label={`Text ${PHONE_DISPLAY}`}
              className={secondaryAction}
            >
              <MessageSquareText className="h-4 w-4 shrink-0" aria-hidden="true" />
              Text
            </TrackedActionLink>
          </div>
        </section>
      </Container>
    </main>
  )
}
