export type HomeSectionTone = 0 | 1 | 2

export type HomeSectionTheme = {
  tone: HomeSectionTone
  sectionBg: string
  topGlow: string
  bottomGlow: string
  borderTone: string
  surfaceBg: string
  dividerTone: string
  headingTone: string
  chipTone: string
}

type HomeSectionKey =
  | 'statsStrip'
  | 'portfolioSection'
  | 'serviceAreaSection'
  | 'faq'
  | 'cta'

export const homeSectionTheme: Record<HomeSectionKey, HomeSectionTheme> = {
  statsStrip: {
    tone: 0,
    sectionBg: 'linear-gradient(180deg, #0a0d11 0%, #0d1014 100%)',
    topGlow: 'radial-gradient(140% 105% at 50% 0%, rgba(148, 163, 184, 0.12) 0%, transparent 66%)',
    bottomGlow: 'rgba(58, 84, 110, 0.18)',
    borderTone: 'rgba(74, 94, 112, 0.58)',
    surfaceBg: 'rgba(148, 163, 184, 0.05)',
    dividerTone: 'rgba(148, 163, 184, 0.28)',
    headingTone: 'rgba(244, 248, 252, 0.98)',
    chipTone: 'rgba(207, 219, 232, 0.82)',
  },
  portfolioSection: {
    tone: 1,
    sectionBg: 'linear-gradient(180deg, #151617 0%, #101113 100%)',
    topGlow: 'radial-gradient(100% 80% at 80% 0%, rgba(255, 122, 26, 0.08) 0%, transparent 60%)',
    bottomGlow: 'rgba(82, 89, 98, 0.12)',
    borderTone: 'rgba(255, 255, 255, 0.11)',
    surfaceBg: 'rgba(255, 255, 255, 0.045)',
    dividerTone: 'rgba(255, 255, 255, 0.17)',
    headingTone: 'rgba(249, 247, 242, 0.99)',
    chipTone: 'rgba(209, 210, 212, 0.8)',
  },
  serviceAreaSection: {
    tone: 0,
    sectionBg: 'linear-gradient(180deg, #151719 0%, #101214 100%)',
    topGlow: 'radial-gradient(140% 105% at 50% 0%, rgba(148, 163, 184, 0.1) 0%, transparent 68%)',
    bottomGlow: 'rgba(74, 94, 112, 0.16)',
    borderTone: 'rgba(74, 94, 112, 0.58)',
    surfaceBg: 'rgba(148, 163, 184, 0.05)',
    dividerTone: 'rgba(148, 163, 184, 0.28)',
    headingTone: 'rgba(244, 248, 252, 0.98)',
    chipTone: 'rgba(207, 219, 232, 0.82)',
  },
  faq: {
    tone: 1,
    sectionBg: 'linear-gradient(180deg, #101113 0%, #0a0b0c 100%)',
    topGlow: 'radial-gradient(100% 95% at 12% 0%, rgba(255, 122, 26, 0.08) 0%, transparent 61%)',
    bottomGlow: 'rgba(255, 122, 26, 0.07)',
    borderTone: 'rgba(255, 255, 255, 0.11)',
    surfaceBg: 'rgba(255, 255, 255, 0.04)',
    dividerTone: 'rgba(255, 255, 255, 0.17)',
    headingTone: 'rgba(249, 247, 242, 0.99)',
    chipTone: 'rgba(211, 210, 207, 0.8)',
  },
  cta: {
    tone: 2,
    sectionBg: 'linear-gradient(180deg, #0a0b0c 0%, #111214 100%)',
    topGlow: 'radial-gradient(90% 90% at 75% 0%, rgba(255, 122, 26, 0.11) 0%, transparent 62%)',
    bottomGlow: 'rgba(255, 122, 26, 0.08)',
    borderTone: 'rgba(255, 255, 255, 0.12)',
    surfaceBg: 'rgba(255, 255, 255, 0.05)',
    dividerTone: 'rgba(255, 255, 255, 0.18)',
    headingTone: 'rgba(249, 247, 242, 1)',
    chipTone: 'rgba(218, 217, 214, 0.84)',
  },
}
