import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import Container from './Container'
import TrackedActionLink from './TrackedActionLink'
import { BUILDING_CATALOG } from '@/lib/buildingCatalog'

const rowClassName =
  'group flex h-full min-h-[4.5rem] items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 transition-colors hover:border-amber-400/45 hover:bg-white/[0.07] sm:px-5'

/**
 * "What are you building?" Each row opens the instant quote with that building
 * already selected (the same `structureType` deep link the /buildings page
 * uses), so the homepage hands visitors to the right quote in one tap.
 */
export default function HomeBuildingPicker() {
  return (
    <section aria-labelledby="home-buildings-heading" className="bg-[#0b0c0d] py-14 sm:py-20">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-16">
          <div>
            <p className="interior-kicker mb-0">Start with the right building</p>
            <h2
              id="home-buildings-heading"
              className="brand-heading mb-0 mt-4 text-4xl text-white sm:text-5xl"
            >
              What are you building?
            </h2>
            <p className="mb-0 mt-4 max-w-md text-base leading-7 text-white/70">
              Pick one and the instant quote opens with that building already
              selected. Not sure yet? Compare what each one is for first.
            </p>
          </div>

          <ul className="grid gap-2.5 sm:auto-rows-fr sm:grid-cols-2">
            {BUILDING_CATALOG.map((building) => (
              <li key={building.value}>
                <TrackedActionLink
                  href={`/quote?structureType=${building.value}`}
                  eventName="quote_cta_clicked"
                  eventProperties={{ location: 'home_building_picker', category: building.value }}
                  aria-label={`Price ${building.quoteLabel}`}
                  className={rowClassName}
                >
                  <span className="min-w-0">
                    <span className="block text-base font-semibold leading-snug text-white">
                      {building.title}
                    </span>
                    <span className="mt-0.5 block text-sm leading-5 text-white/55">
                      {building.bestFor.slice(0, 2).join(' · ')}
                    </span>
                  </span>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-amber-400 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                    aria-hidden="true"
                  />
                </TrackedActionLink>
              </li>
            ))}
            <li>
              <Link
                href="/buildings"
                aria-label="Compare Buildings"
                className={`${rowClassName} border-dashed bg-transparent`}
              >
                <span className="min-w-0">
                  <span className="block text-base font-semibold leading-snug text-white">
                    Compare Buildings
                  </span>
                  <span className="mt-0.5 block text-sm leading-5 text-white/55">
                    Side by side, with the options for each
                  </span>
                </span>
                <ArrowRight
                  className="h-4 w-4 shrink-0 text-white/55 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                  aria-hidden="true"
                />
              </Link>
            </li>
          </ul>
        </div>
      </Container>
    </section>
  )
}
