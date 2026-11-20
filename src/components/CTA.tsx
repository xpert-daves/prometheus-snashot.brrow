import { ArrowRight, MessageSquareText, Phone } from 'lucide-react'
import Container from './Container'
import FramingDiagram from './motif/FramingDiagram'
import TrackedActionLink from './TrackedActionLink'
import { homeSectionTheme } from '@/lib/theme/homeSectionTheme'
import { PHONE_DISPLAY, PHONE_NUMBER } from '@/lib/contact'

const terms = ["$250 deposit, rest when it's built", '2-year workmanship warranty']

/** Closing call to action: the quote first, then the two ways to reach David directly. */
export default function CTA() {
  const theme = homeSectionTheme.cta

  return (
    <section
      id="quote"
      aria-labelledby="home-cta-heading"
      data-theme="warm-industrial"
      data-section-tone={theme.tone}
      className="relative isolate overflow-hidden py-14 text-white sm:py-20 lg:py-24"
      style={{ background: theme.sectionBg }}
    >
      <Container>
        <div
          className="grid overflow-hidden rounded-3xl border lg:grid-cols-[1.1fr_0.9fr]"
          style={{ borderColor: theme.borderTone, backgroundColor: theme.surfaceBg }}
        >
          <div className="p-6 sm:p-10 lg:p-14">
            <h2
              id="home-cta-heading"
              className="brand-heading mb-0 text-4xl sm:text-5xl lg:text-6xl"
              style={{ color: theme.headingTone }}
            >
              Get your price
            </h2>
            <p className="mb-0 mt-4 max-w-lg text-base leading-7 sm:text-lg" style={{ color: theme.chipTone }}>
              Choose your size and style in the instant quote, or text David the size you have in mind.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <TrackedActionLink
                href="/quote"
                eventName="quote_cta_clicked"
                eventProperties={{ location: 'home_bottom_cta' }}
                className="btn btn-primary btn-lg gap-2"
              >
                Get Instant Price <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </TrackedActionLink>
              <TrackedActionLink
                href={`sms:${PHONE_NUMBER}`}
                eventName="text_click"
                eventProperties={{ location: 'home_bottom_cta' }}
                className="btn btn-outline btn-lg gap-2"
              >
                <MessageSquareText className="h-4 w-4" aria-hidden="true" /> Text David
              </TrackedActionLink>
            </div>

            <p className="mb-0 mt-5 text-sm leading-6 text-white/60">
              Rather talk?{' '}
              <TrackedActionLink
                href={`tel:${PHONE_NUMBER}`}
                eventName="phone_click"
                eventProperties={{ location: 'home_bottom_cta' }}
                className="inline-flex items-center gap-1.5 font-semibold text-white/90 underline decoration-[var(--accent)] decoration-2 underline-offset-[3px] transition-colors hover:text-white"
              >
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                Call {PHONE_DISPLAY}
              </TrackedActionLink>
            </p>

            <ul className="mb-0 mt-8 flex flex-col gap-x-6 gap-y-2 border-t border-white/10 pt-6 text-sm font-medium text-white/65 sm:flex-row sm:flex-wrap">
              {terms.map((term) => (
                <li key={term} className="flex items-center gap-2">
                  <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                  {term}
                </li>
              ))}
            </ul>
          </div>

          <div className="motif-grid relative hidden items-center justify-center border-l border-white/10 bg-[#08090a] p-10 lg:flex">
            <FramingDiagram className="w-full max-w-md" />
          </div>
        </div>
      </Container>
    </section>
  )
}
