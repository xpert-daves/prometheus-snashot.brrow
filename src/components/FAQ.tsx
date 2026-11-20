import { MessageSquareText, Plus } from 'lucide-react'
import Container from './Container'
import TrackedActionLink from './TrackedActionLink'
import { homeSectionTheme } from '@/lib/theme/homeSectionTheme'
import { PHONE_NUMBER } from '@/lib/contact'

type QA = { q: string; a: string }

// Answers repeat what the rest of the page already promises (How It Works, the pegboard tags).
const faqs: QA[] = [
  {
    q: 'How fast can you build?',
    a: 'Most sheds are built on-site in a single day. Bigger or finished builds take longer.',
  },
  {
    q: 'Do you handle permits?',
    a: 'Permits and HOA approval are up to the homeowner, and every city is different. We help you understand the local rules and can provide documentation and drawings if needed.',
  },
  {
    q: 'What foundations do you use?',
    a: 'We typically build on concrete blocks or skids depending on the site, and blocking and leveling come with the standard build. An anchored concrete slab is priced separately: David reviews photos of the spot and usually needs to see it in person before pricing the slab.',
  },
  {
    q: 'Can I customize doors and windows?',
    a: 'Yes. Choose the size, placement, trim, colors, roof style, and more. The instant quote prices your choices right away.',
  },
]

export default function FAQ() {
  const theme = homeSectionTheme.faq

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      data-theme="warm-industrial"
      data-section-tone={theme.tone}
      className="relative isolate overflow-hidden border-b py-14 sm:py-20 lg:py-24"
      style={{ background: theme.sectionBg, borderColor: theme.borderTone }}
    >
      <Container>
        <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
          <div>
            <h2
              id="faq-heading"
              className="brand-heading mb-0 text-4xl sm:text-5xl"
              style={{ color: theme.headingTone }}
            >
              Questions before you book
            </h2>
            <p className="mb-0 mt-4 max-w-md text-base leading-7" style={{ color: theme.chipTone }}>
              Not on the list? Text your question to David, our owner.
            </p>
            <TrackedActionLink
              href={`sms:${PHONE_NUMBER}`}
              eventName="text_click"
              eventProperties={{ location: 'home_faq' }}
              className="btn btn-outline btn-md mt-6 gap-2 text-sm"
            >
              <MessageSquareText className="h-4 w-4" aria-hidden="true" />
              Text David
            </TrackedActionLink>
          </div>
          <div className="space-y-3">
            {faqs.map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl border text-white transition-colors open:border-amber-400/30 open:bg-white/[0.055]"
                style={{ borderColor: theme.borderTone, backgroundColor: theme.surfaceBg }}
              >
                <summary className="flex min-h-16 cursor-pointer list-none items-center gap-4 rounded-2xl px-5 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400/80 sm:px-6 [&::-webkit-details-marker]:hidden">
                  <span className="brand-subheading flex-1 text-base sm:text-lg">{item.q}</span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-amber-300">
                    <Plus className="h-4 w-4 transition duration-300 group-open:rotate-45" aria-hidden="true" />
                  </span>
                </summary>
                <p
                  className="mb-0 max-w-[62ch] px-5 pb-5 text-[0.95rem] leading-7 sm:px-6 sm:pb-6"
                  style={{ color: theme.chipTone }}
                >
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </Container>
    </section>
  )
}
