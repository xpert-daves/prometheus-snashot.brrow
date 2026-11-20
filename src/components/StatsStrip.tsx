import Container from './Container'
import { homeSectionTheme } from '@/lib/theme/homeSectionTheme'

export default function StatsStrip() {
  const theme = homeSectionTheme.statsStrip

  const stats = [
    { value: 'Local Projects', label: 'Photos & Build Details' },
    { value: '1 Day', label: 'Typical Build Time' },
    { value: '40 Yr', label: 'Metal Warranty' },
    { value: '2 Yr', label: 'Workmanship Warranty' },
  ]

  return (
    <section
      aria-label="Shed210 build details"
      data-theme="warm-industrial"
      data-section-tone={theme.tone}
      className="relative isolate overflow-hidden border-b py-8 shadow-[0_45px_140px_-60px_rgba(0,0,0,0.7)] sm:py-10"
      style={{ background: theme.sectionBg, borderColor: theme.borderTone }}
    >
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: theme.topGlow }} />
        <div
          className="absolute inset-x-[-25%] bottom-[-55%] h-[280px] rounded-full blur-[120px]"
          style={{ backgroundColor: theme.bottomGlow }}
        />
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: `linear-gradient(to right, transparent, ${theme.dividerTone}, transparent)` }}
        />
      </div>
      <Container>
        <ul className="mx-auto grid max-w-5xl grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((stat) => (
            <li
              key={stat.label}
              className="text-center transition duration-200 hover:-translate-y-0.5"
              style={{ color: theme.headingTone }}
            >
              <div className="brand-display text-2xl">{stat.value}</div>
              <div className="motif-spec mt-1 text-[0.66rem]" style={{ color: theme.chipTone }}>
                {stat.label}
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
