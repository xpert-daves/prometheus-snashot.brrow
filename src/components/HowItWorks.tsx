import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { MessageSquareText } from 'lucide-react'
import Container from './Container'
import TrackedActionLink from './TrackedActionLink'
import { PHONE_NUMBER } from '@/lib/contact'

type Duty = {
  /** Who does this part: the customer, or David (and his crew on build day). */
  who: string
  text: ReactNode
}

type Step = {
  n: number
  title: string
  /** Exactly two, so every ticket has the same four rows (stub, duty, duty, note) to share via subgrid. */
  duties: [Duty, Duty]
  /** A line David has actually texted customers at this stage, lightly trimmed. */
  note: string
  /** Hang angle on lg+, so the row reads as tickets taped to a wall rather than a grid of cards. */
  tilt: string
}

const inlineLinkClassName =
  'font-semibold text-[var(--ticket-ink)] underline decoration-[var(--accent)] decoration-2 underline-offset-[3px] transition-colors hover:text-[var(--accent-dark)]'

/*
 * The steps follow how jobs actually run in Shed210's texts with customers
 * (Frontier Pixel CRM, docs/sms-assistant-shed210-knowledge.md): David needs a
 * size, the build address, and the three colors before he confirms a price and
 * a build day; a $250 deposit holds that day (since 2026-11-10); the customer
 * clears the spot; most sheds go up in one day; and the balance is due when
 * the build is done.
 */
const steps: Step[] = [
  {
    n: 1,
    title: 'Get your price',
    duties: [
      {
        who: 'You',
        text: (
          <>
            Run the{' '}
            <TrackedActionLink
              href="/quote"
              eventName="quote_cta_clicked"
              eventProperties={{ location: 'how_it_works_step' }}
              className={inlineLinkClassName}
            >
              instant quote
            </TrackedActionLink>
            , or{' '}
            <TrackedActionLink
              href={`sms:${PHONE_NUMBER}`}
              eventName="text_click"
              eventProperties={{ location: 'how_it_works_step' }}
              className={inlineLinkClassName}
            >
              text us
            </TrackedActionLink>{' '}
            the size you have in mind. Photos of the spot and your gate help.
          </>
        ),
      },
      {
        who: 'David',
        text: 'Confirms the exact price. Site work, travel past 35 miles, and add-ons like a loft or electrical prep are priced per job.',
      },
    ],
    note: 'We custom build to the inch.',
    tilt: '-0.6deg',
  },
  {
    n: 2,
    title: 'Pick colors, book a day',
    duties: [
      {
        who: 'You',
        text: 'Send your main, trim, and roof colors from our chart, plus the build address. A $250 deposit holds your build day and comes off the total. Clear the spot before build day.',
      },
      {
        who: 'David',
        text: 'Books your build day, usually a week or two out.',
      },
    ],
    note: 'When you get a chance, I just need the colors of your choice to complete the booking, please.',
    tilt: '0.5deg',
  },
  {
    n: 3,
    title: 'Build day',
    duties: [
      {
        who: 'David & crew',
        text: 'Bring every material, level the base, and build it in your yard. Most sheds are done in a day. Bigger or finished builds take longer.',
      },
      {
        who: 'You',
        text: "Pay the balance once it's built, by cash or check. Financing is available.",
      },
    ],
    note: 'I offer a 2-year labor warranty and use 40-year materials.',
    tilt: '-0.4deg',
  },
]

/**
 * "From first text to build day" as three claim tickets taped to charcoal
 * steel shed siding, ribs running horizontally like the sheds in the gallery. Styles for the wall, tickets, and tape live under
 * `.job-*` in globals.css. Orange stays on the step numbers, links, and the
 * primary button, so it marks what to tap rather than filling the section.
 */
export default function HowItWorks() {
  return (
    <section
      aria-labelledby="how-heading"
      className="job-wall relative isolate overflow-hidden border-y-[6px] border-[#0d0e0f] py-14 sm:py-20 lg:py-24"
    >
      <Container>
        <div className="mx-auto flex max-w-2xl flex-col gap-5 lg:max-w-none lg:flex-row lg:items-end lg:justify-between lg:gap-16">
          <div>
            <p className="mb-0 inline-block -rotate-1 rounded-[2px] bg-[var(--ticket-paper)] px-3.5 py-1.5 font-heading text-xs font-semibold uppercase leading-tight tracking-[0.18em] text-[var(--ticket-ink)] shadow-[0_2px_4px_rgb(0_0_0/0.5)] sm:text-sm">
              How it works
            </p>
            <h2
              id="how-heading"
              className="brand-heading mb-0 mt-5 text-4xl text-[var(--ticket-paper)] sm:text-5xl lg:text-6xl"
            >
              From first text to build day
            </h2>
          </div>
          <p className="mb-0 max-w-md text-base leading-7 text-white/75 sm:text-lg lg:max-w-sm lg:pb-2">
            No sales team and no showroom. You work with David, our owner, from your first question to the day your
            shed goes up.
          </p>
        </div>

        {/*
         * On lg the tickets sit side by side and share four subgrid rows (stub, duty, duty, note), so
         * the dashed dividers and the "David, by text" notes line up across the row instead of each
         * ticket leaving a blank band wherever its copy runs shorter than its neighbors'.
         */}
        <ol className="mx-auto mt-12 grid max-w-2xl grid-cols-1 gap-10 sm:mt-16 lg:max-w-none lg:grid-cols-3 lg:gap-x-6 lg:gap-y-0">
          {steps.map((step) => (
            <li
              key={step.n}
              className="job-ticket-wrap lg:row-span-4 lg:grid lg:grid-rows-subgrid"
              style={{ '--ticket-tilt': step.tilt } as CSSProperties}
            >
              <div className="job-ticket lg:row-span-4 lg:grid lg:grid-rows-subgrid">
                <div className="job-ticket-stub flex items-center gap-4 px-5 sm:px-6">
                  <span aria-hidden="true" className="brand-display text-5xl leading-none text-[var(--accent)]">
                    {step.n}
                  </span>
                  <h3 className="mb-0 text-balance font-heading text-xl font-bold uppercase leading-tight tracking-[0.04em] text-[var(--ticket-paper)] sm:text-2xl">
                    <span className="sr-only">Step {step.n}: </span>
                    {step.title}
                  </h3>
                </div>

                <dl className="mb-0 px-5 pt-2 sm:px-6 lg:row-span-2 lg:grid lg:grid-rows-subgrid">
                  {step.duties.map((duty) => (
                    <div
                      key={duty.who}
                      className="grid gap-1 border-b-2 border-dashed border-[#dccdb6] py-4 sm:grid-cols-[5.25rem_1fr] sm:gap-3"
                    >
                      <dt className="pt-0.5 font-heading text-sm font-bold uppercase leading-5 tracking-[0.08em] text-[var(--accent-dark)]">
                        {duty.who}
                      </dt>
                      <dd className="m-0 text-[0.95rem] leading-6 text-[#3b2a1b]">{duty.text}</dd>
                    </div>
                  ))}
                </dl>

                <figure className="mx-5 mb-6 pt-5 sm:mx-6">
                  <figcaption className="font-heading text-xs font-bold uppercase tracking-[0.12em] text-[#7a6650]">
                    David, by text
                  </figcaption>
                  <blockquote className="mb-0 mt-1.5 border-l-4 border-[var(--accent)] pl-3 text-sm italic leading-6 text-[#3b2a1b]">
                    &ldquo;{step.note}&rdquo;
                  </blockquote>
                </figure>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-12 flex flex-col items-center gap-6 sm:mt-14">
          <div className="flex w-full max-w-xl flex-col items-center justify-center gap-3 sm:flex-row">
            <TrackedActionLink
              href="/quote"
              eventName="quote_cta_clicked"
              eventProperties={{ location: 'how_it_works_footer' }}
              className="btn btn-primary btn-md w-full sm:w-auto"
            >
              Get Instant Price
            </TrackedActionLink>
            <TrackedActionLink
              href={`sms:${PHONE_NUMBER}`}
              eventName="text_click"
              eventProperties={{ location: 'how_it_works_footer' }}
              className="btn btn-outline btn-md w-full gap-2 sm:w-auto"
            >
              <MessageSquareText className="h-5 w-5" aria-hidden="true" />
              <span>Text David</span>
            </TrackedActionLink>
          </div>
          <p className="mb-0 max-w-2xl text-balance text-center text-sm leading-6 text-white/65">
            Permits and HOA approval are up to the homeowner. Our{' '}
            <Link
              href="/news/sanantonio_shed_guide"
              className="font-semibold text-white/90 underline decoration-[var(--accent)] decoration-2 underline-offset-[3px] transition-colors hover:text-white"
            >
              San Antonio permit guide
            </Link>{' '}
            covers the basics.
          </p>
        </div>
      </Container>
    </section>
  )
}
