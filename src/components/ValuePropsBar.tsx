import type { ComponentType, CSSProperties } from 'react'
import Container from './Container'
import {
  FramingSquareIcon,
  MetalPanelIcon,
  SettledReceiptIcon,
  SunsetShedIcon,
} from './motif/diagrams'

type BuildTerm = {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>
  value: string
  /** Short unit printed beside the figure, e.g. "day", "yr", or a "$" prefix. */
  unit: string
  unitPosition: 'before' | 'after'
  /** How screen readers hear the figure, since the printed version is hidden from them. */
  spokenValue: string
  label: string
  detail: string
  /** Hang angle on sm+, so the row reads as tags on pegs rather than a grid of cards. */
  tilt: string
}

// Claims mirror the copy used elsewhere on the site (hero, How It Works, service-area warranty notes).
const buildTerms: BuildTerm[] = [
  {
    icon: SunsetShedIcon,
    value: '1',
    unit: 'day',
    unitPosition: 'after',
    spokenValue: '1-day',
    label: 'On-site build',
    detail: 'We build it in your yard. Most sheds are done by sunset.',
    tilt: '-1.5deg',
  },
  {
    icon: SettledReceiptIcon,
    value: '250',
    unit: '$',
    unitPosition: 'before',
    spokenValue: '$250',
    label: 'Deposit',
    detail: "Holds your build day and comes off the total. The rest isn't due until the build is finished.",
    tilt: '1deg',
  },
  {
    icon: FramingSquareIcon,
    value: '2',
    unit: 'yr',
    unitPosition: 'after',
    spokenValue: '2-year',
    label: 'Workmanship warranty',
    detail: 'Covers our build labor, with local support after build day.',
    tilt: '-1deg',
  },
  {
    icon: MetalPanelIcon,
    value: '40',
    unit: 'yr',
    unitPosition: 'after',
    spokenValue: '40-year',
    label: 'Metal warranty',
    detail: 'Covers qualifying metal materials.',
    tilt: '1.5deg',
  },
]

const unitClassName = 'font-heading text-lg font-bold uppercase tracking-[0.06em] text-[#c95400]'

/**
 * "Why buy from Shed210?" as price tags hanging on shed pegboard. Styles for the
 * board, tags, and label tape live under `.shop-*` / `.label-tape` in globals.css.
 */
export default function ValuePropsBar() {
  return (
    <section
      id="why-buy"
      aria-labelledby="why-buy-heading"
      className="shop-pegboard relative isolate overflow-hidden border-y-[6px] border-[#8b5e37] py-14 sm:py-20 lg:py-24"
    >
      <Container>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
          <div>
            <p className="label-tape mb-0 -rotate-1 text-xs sm:text-sm">Locally owned · San Antonio, TX</p>
            <h2
              id="why-buy-heading"
              className="brand-heading mb-0 mt-5 text-4xl text-[var(--shop-ink)] sm:text-5xl lg:text-6xl"
            >
              Why buy from Shed210?
            </h2>
          </div>
          {/* The pegboard-colored halo keeps the holes from crowding the letters. */}
          <p className="mb-0 max-w-sm text-base font-semibold leading-7 sm:text-lg text-[var(--shop-ink)] [text-shadow:0_0_4px_var(--pegboard),0_0_8px_var(--pegboard)] lg:pb-2">
            No middlemen. You buy from the crew that builds it, and every build comes with:
          </p>
        </div>

        <ul className="mt-8 grid grid-cols-1 gap-3.5 sm:mt-14 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-4">
          {buildTerms.map(({ icon: Icon, tilt, ...term }) => (
            <li
              key={term.label}
              className="shop-tag-wrap"
              style={{ '--tag-tilt': tilt } as CSSProperties}
            >
              <div className="shop-tag relative grid h-full grid-cols-[5.75rem_1fr] items-start gap-x-3 py-4 pl-[58px] pr-3 sm:block sm:px-6 sm:pb-7 sm:pt-[72px]">
                <span
                  aria-hidden="true"
                  className="shop-tag-hole absolute left-[13px] top-1/2 -translate-y-1/2 sm:left-1/2 sm:top-[15px] sm:-translate-x-1/2 sm:translate-y-0"
                />
                <div
                  aria-hidden="true"
                  className="text-[var(--shop-ink)] sm:flex sm:items-center sm:justify-between"
                >
                  <Icon className="h-8 w-8 sm:h-12 sm:w-12 lg:h-14 lg:w-14" strokeWidth={1.75} />
                  <p className="mb-0 mt-1.5 flex items-baseline gap-1 sm:mt-0">
                    {term.unitPosition === 'before' ? (
                      <span className={`${unitClassName} self-start pt-1`}>{term.unit}</span>
                    ) : null}
                    <span className="brand-display text-4xl sm:text-6xl">{term.value}</span>
                    {term.unitPosition === 'after' ? <span className={unitClassName}>{term.unit}</span> : null}
                  </p>
                </div>
                <div className="h-full border-l-2 border-dashed border-[#dccdb6] pl-3 sm:mt-5 sm:h-auto sm:border-l-0 sm:border-t-2 sm:pl-0 sm:pt-4">
                  <h3 className="mb-0 font-heading text-base font-bold uppercase tracking-[0.05em] text-[var(--shop-ink)] sm:text-lg">
                    <span className="sr-only">{term.spokenValue} </span>
                    {term.label}
                  </h3>
                  <p className="mb-0 mt-1 text-sm leading-6 text-[#5b4936]">{term.detail}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
