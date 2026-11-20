'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type SVGProps,
} from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Briefcase, MapPin, Pause, Play, X } from 'lucide-react'
import { trackEvent } from '@/lib/analytics'
import Container from './Container'
import HeroGoogleReviewProof, {
  heroProofItemLayoutClassName,
  heroProofLinkClassName,
} from './HeroGoogleReviewProof'

export type HeroVideoSource = {
  src: string
  type: 'video/webm' | 'video/mp4'
}

type HeroProps = {
  backgroundVideoSources?: readonly HeroVideoSource[]
  fullVideoSrc?: string
  fullVideoFallbackUrl?: string
}

const HERO_IMAGE_SRC = '/herobackground.webp'
const EMPTY_VIDEO_SOURCES: readonly HeroVideoSource[] = []
const heroMediaClassName =
  'object-cover object-[70%_center] scale-[1.08] brightness-[1.04] contrast-[1.04] saturate-[0.96] md:object-center md:scale-100'
// Visitors tap the financing chip looking for details, so it opens the contact page.
const trustItems = [
  { label: 'Built in 1 Day' },
  { label: 'No Distance Fee Within 35 Miles' },
  { label: 'Warranty Backed' },
  { label: 'Financing Available', href: '/contact' },
] as const satisfies readonly { label: string; href?: string }[]
const proofIconClassName = 'hero-proof-icon h-5 w-5 shrink-0'
const proofItems: {
  value: string
  label: string
  href?: string
  renderIcon: () => ReactNode
}[] = [
  {
    value: 'Local Projects',
    label: 'Photos & Build Details',
    href: '/gallery',
    renderIcon: () => <Briefcase className={proofIconClassName} strokeWidth={1.8} />,
  },
  {
    value: 'Locally Owned',
    label: '& Operated',
    renderIcon: () => <MapPin className={proofIconClassName} strokeWidth={1.8} />,
  },
]

function GoogleGIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      data-testid="google-g-icon"
      aria-hidden="true"
      {...props}
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.82-.07-1.6-.2-2.36H12v4.46h6.47c-.28 1.49-1.12 2.75-2.39 3.59v2.93h3.87c2.26-2.08 3.54-5.15 3.54-8.62Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.92l-3.87-2.93c-1.07.72-2.44 1.14-4.06 1.14-3.12 0-5.77-2.11-6.72-4.94H1.29v3.03C3.25 21.29 7.27 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.35A7.2 7.2 0 0 1 4.9 12c0-.82.14-1.61.38-2.35V6.62H1.29A11.96 11.96 0 0 0 0 12c0 1.94.46 3.77 1.29 5.38l3.99-3.03Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.71c1.76 0 3.34.61 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0 7.27 0 3.25 2.71 1.29 6.62l3.99 3.03C6.23 6.82 8.88 4.71 12 4.71Z"
      />
    </svg>
  )
}

function connectionAllowsBackgroundVideo() {
  if (typeof window === 'undefined') return false

  const connection = (window.navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string }
  }).connection

  if (connection?.saveData) return false

  const effectiveType = connection?.effectiveType?.toLowerCase()
  return !['slow-2g', '2g', '3g'].includes(effectiveType ?? '')
}

export default function Hero({
  backgroundVideoSources = EMPTY_VIDEO_SOURCES,
  fullVideoSrc,
  fullVideoFallbackUrl,
}: HeroProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const backgroundVideoRef = useRef<HTMLVideoElement>(null)
  const watchButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const hasBackgroundVideo = backgroundVideoSources.length > 0
  const backgroundSourcesKey = backgroundVideoSources
    .map(({ src, type }) => `${type}:${src}`)
    .join('|')

  const [canUseBackgroundVideo, setCanUseBackgroundVideo] = useState(false)
  const [documentVisible, setDocumentVisible] = useState(true)
  const [isHeroVisible, setIsHeroVisible] = useState(true)
  const [isFullVideoOpen, setIsFullVideoOpen] = useState(false)
  const [isBackgroundVideoPaused, setIsBackgroundVideoPaused] = useState(false)
  const [posterReady, setPosterReady] = useState(false)
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const [windowLoaded, setWindowLoaded] = useState(false)

  useEffect(() => {
    const updateWindowLoaded = () => setWindowLoaded(true)

    if (document.readyState === 'complete') {
      updateWindowLoaded()
      return
    }

    window.addEventListener('load', updateWindowLoaded, { once: true })
    return () => window.removeEventListener('load', updateWindowLoaded)
  }, [])

  useEffect(() => {
    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const desktopQuery = window.matchMedia?.('(min-width: 768px) and (hover: hover) and (pointer: fine)')
    const updateEligibility = () => {
      setCanUseBackgroundVideo(
        hasBackgroundVideo &&
          desktopQuery?.matches === true &&
          !motionQuery?.matches &&
          connectionAllowsBackgroundVideo()
      )
    }

    updateEligibility()
    motionQuery?.addEventListener?.('change', updateEligibility)
    desktopQuery?.addEventListener?.('change', updateEligibility)

    return () => {
      motionQuery?.removeEventListener?.('change', updateEligibility)
      desktopQuery?.removeEventListener?.('change', updateEligibility)
    }
  }, [hasBackgroundVideo])

  useEffect(() => {
    setVideoFailed(false)
    setVideoReady(false)
    setShouldLoadVideo(false)
  }, [backgroundSourcesKey])

  useEffect(() => {
    const section = sectionRef.current
    if (!section || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      ([entry]) => setIsHeroVisible(entry.isIntersecting),
      { threshold: 0.08 }
    )
    observer.observe(section)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const updateVisibility = () => setDocumentVisible(document.visibilityState !== 'hidden')
    updateVisibility()
    document.addEventListener('visibilitychange', updateVisibility)

    return () => document.removeEventListener('visibilitychange', updateVisibility)
  }, [])

  useEffect(() => {
    if (
      !canUseBackgroundVideo ||
      !posterReady ||
      !windowLoaded ||
      !isHeroVisible ||
      videoFailed
    ) {
      return
    }

    let firstFrame = 0
    let secondFrame = 0
    let idleCallback = 0
    let fallbackTimer = 0

    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        if (typeof window.requestIdleCallback === 'function') {
          idleCallback = window.requestIdleCallback(
            () => setShouldLoadVideo(true),
            { timeout: 2000 }
          )
          return
        }

        fallbackTimer = window.setTimeout(() => setShouldLoadVideo(true), 0)
      })
    })

    return () => {
      window.cancelAnimationFrame(firstFrame)
      window.cancelAnimationFrame(secondFrame)
      if (idleCallback && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleCallback)
      }
      if (fallbackTimer) window.clearTimeout(fallbackTimer)
    }
  }, [canUseBackgroundVideo, isHeroVisible, posterReady, videoFailed, windowLoaded])

  const shouldMountBackgroundVideo =
    canUseBackgroundVideo && shouldLoadVideo && !videoFailed

  useEffect(() => {
    const video = backgroundVideoRef.current
    if (!video) return

    const shouldPlay =
      shouldMountBackgroundVideo &&
      isHeroVisible &&
      documentVisible &&
      !isFullVideoOpen &&
      !isBackgroundVideoPaused

    if (!shouldPlay) {
      video.pause()
      return
    }

    let active = true
    const playPromise = video.play()
    if (playPromise) {
      void playPromise.catch(() => {
        if (!active) return
        setVideoReady(false)
        setVideoFailed(true)
      })
    }

    return () => {
      active = false
      video.pause()
    }
  }, [
    documentVisible,
    isBackgroundVideoPaused,
    isFullVideoOpen,
    isHeroVisible,
    shouldMountBackgroundVideo,
  ])

  const closeFullVideo = useCallback(() => setIsFullVideoOpen(false), [])

  useEffect(() => {
    if (!isFullVideoOpen) return

    const previousOverflow = document.body.style.overflow
    const previouslyFocused = document.activeElement as HTMLElement | null
    const watchButton = watchButtonRef.current
    document.body.style.overflow = 'hidden'

    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus())

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeFullVideo()
        return
      }

      if (event.key !== 'Tab') return

      const dialog = dialogRef.current
      if (!dialog) return

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, video, [href], [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute('disabled'))
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      window.requestAnimationFrame(() => {
        const focusTarget = watchButton ?? previouslyFocused
        focusTarget?.focus()
      })
    }
  }, [closeFullVideo, isFullVideoOpen])

  const openFullVideo = () => {
    trackEvent('hero_video_opened', { location: 'home_hero' })
    setIsFullVideoOpen(true)
  }

  return (
    <section
      ref={sectionRef}
      aria-label="Shed210 hero"
      className="relative isolate flex min-h-[calc(100svh-4rem)] items-center overflow-hidden py-14 pb-20 font-sans sm:py-20 md:min-h-[760px] lg:min-h-[820px]"
    >
      <div className="absolute inset-0 -z-20 overflow-hidden">
        <Image
          src={HERO_IMAGE_SRC}
          alt="Custom shed on a Texas backyard"
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          quality={60}
          className={heroMediaClassName}
          onLoad={() => setPosterReady(true)}
        />

        {shouldMountBackgroundVideo ? (
          <video
            ref={backgroundVideoRef}
            data-testid="hero-background-video"
            className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${
              videoReady ? 'opacity-100' : 'opacity-0'
            } ${heroMediaClassName}`}
            autoPlay
            muted
            loop
            playsInline
            preload="none"
            aria-hidden="true"
            disablePictureInPicture
            onPlaying={() => setVideoReady(true)}
            onError={() => {
              setVideoReady(false)
              setVideoFailed(true)
            }}
          >
            {backgroundVideoSources.map(({ src, type }) => (
              <source key={`${type}:${src}`} src={src} type={type} />
            ))}
          </video>
        ) : null}
      </div>

      <div className="absolute inset-0 -z-10 bg-black/30 md:bg-black/20" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgba(5,5,5,0.74)_0%,rgba(5,5,5,0.32)_32%,rgba(5,5,5,0.48)_66%,rgba(5,5,5,0.92)_100%)] md:bg-[linear-gradient(to_right,rgba(5,5,5,0.86)_0%,rgba(5,5,5,0.66)_43%,rgba(5,5,5,0.2)_74%,rgba(5,5,5,0.32)_100%)]" />
      <div className="pointer-events-none absolute inset-x-[-20%] top-0 -z-10 h-[42%] bg-[radial-gradient(70%_70%_at_50%_12%,rgba(0,0,0,0.62)_0%,rgba(0,0,0,0.26)_58%,rgba(0,0,0,0)_100%)] md:hidden" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[58%] bg-[radial-gradient(90%_72%_at_50%_100%,rgba(0,0,0,0.82)_0%,rgba(0,0,0,0.28)_62%,rgba(0,0,0,0)_100%)] md:hidden" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-24 sm:h-28 md:h-24"
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0), var(--background))',
        }}
      />

      <Container>
        <div className="mx-auto max-w-[42rem] text-center lg:mx-0 lg:text-left">
          <p className="motif-spec mx-auto mb-5 w-fit rounded-full border border-white/15 bg-black/25 px-4 py-2 text-[0.62rem] text-white/72 backdrop-blur-md lg:mx-0">
            San Antonio, Texas <span className="px-2 text-amber-400">/</span> Built on-site
          </p>

          <div className="relative z-0 mx-auto max-w-[24rem] sm:max-w-[42rem] lg:mx-0">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-[-2rem] inset-y-[-1.5rem] -z-10 rounded-[3rem] bg-[radial-gradient(75%_70%_at_45%_45%,rgba(0,0,0,0.56)_0%,rgba(0,0,0,0.16)_62%,rgba(0,0,0,0)_100%)] blur-xl"
            />
            <h1 className="brand-hero text-[3.15rem] leading-[0.88] text-white drop-shadow-[0_10px_28px_rgba(0,0,0,0.86)] sm:text-[4.5rem] md:text-[5.25rem]">
              <span className="block">CUSTOM SHEDS</span>
              <span className="block">BUILT ON-SITE</span>
              <span className="block">IN AS LITTLE AS</span>
              <span className="hero-accent-text brand-display block text-amber-400">
                1 DAY
              </span>
            </h1>
          </div>

          <p className="mx-auto mt-6 max-w-[30rem] text-base leading-7 text-white/86 drop-shadow-[0_4px_18px_rgba(0,0,0,0.76)] sm:text-lg lg:mx-0">
            Storage sheds, metal sheds and workshops built on your property by a local San Antonio
            shed builder. No long delays. No hassle.
          </p>

          <div
            className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center lg:justify-start"
            role="group"
            aria-label="Hero actions"
          >
            <div>
              <Link
                href="/quote"
                onClick={() => trackEvent('quote_cta_clicked', { location: 'home_hero' })}
                className="btn hero-primary-cta min-h-14 w-full gap-2 px-7 py-4 text-sm hover:-translate-y-0.5 sm:w-auto"
              >
                GET INSTANT PRICE <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>

            {fullVideoSrc ? (
              <button
                ref={watchButtonRef}
                type="button"
                onClick={openFullVideo}
                className="btn btn-outline min-h-14 w-full gap-2 px-5 py-4 text-[0.68rem] shadow-[0_14px_30px_-24px_rgba(255,255,255,0.65)] backdrop-blur-md sm:w-auto sm:text-xs"
                aria-label="Watch a shed built in one day"
              >
                <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                <span>WATCH A SHED BUILT IN ONE DAY</span>
              </button>
            ) : null}
          </div>

          <ul className="mx-auto mt-6 grid w-fit max-w-full grid-cols-2 gap-x-5 gap-y-2 text-left text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-white/76 drop-shadow-[0_3px_14px_rgba(0,0,0,0.75)] sm:gap-x-8 sm:text-[0.7rem] lg:mx-0">
            {trustItems.map((item) => (
              <li key={item.label} className="hero-trust-item flex items-center gap-2">
                {'href' in item ? (
                  <Link
                    href={item.href}
                    className="underline decoration-white/30 decoration-dotted underline-offset-4 transition-colors hover:text-white hover:decoration-amber-400"
                  >
                    {item.label}
                  </Link>
                ) : (
                  item.label
                )}
              </li>
            ))}
          </ul>

          <div className="mx-auto mt-6 max-w-[39rem] overflow-hidden rounded-3xl border border-white/10 bg-[#08090a]/58 text-white/88 shadow-[0_30px_75px_-45px_rgba(0,0,0,0.95)] backdrop-blur-xl lg:mx-0">
            <ul className="grid grid-cols-3 items-start divide-x divide-white/10 px-3 py-4 sm:items-center sm:px-5">
              <HeroGoogleReviewProof
                icon={
                  <GoogleGIcon className="h-5 w-5 shrink-0 opacity-90 saturate-[0.9]" />
                }
              />
              {proofItems.map(({ renderIcon, value, label, href }) => {
                const content = (
                  <>
                    {renderIcon()}
                    <span className="min-w-0 text-center leading-tight sm:text-left">
                      <span className="block text-sm font-semibold tracking-[0.01em] text-white/92">
                        {value}
                      </span>
                      <span className="mt-0.5 block text-[0.58rem] font-medium uppercase tracking-[0.04em] text-white/58 sm:mt-0 sm:text-[0.66rem] sm:tracking-[0.08em]">
                        {label}
                      </span>
                    </span>
                  </>
                )

                return href ? (
                  <li key={`${value} ${label}`} className="min-w-0 px-2 first:pl-0 last:pr-0">
                    <Link
                      href={href}
                      aria-label={`${value} ${label}`}
                      className={`${heroProofLinkClassName} ${heroProofItemLayoutClassName}`}
                    >
                      {content}
                    </Link>
                  </li>
                ) : (
                  <li
                    key={`${value} ${label}`}
                    aria-label={`${value} ${label}`}
                    className={`${heroProofItemLayoutClassName} px-2 first:pl-0 last:pr-0`}
                  >
                    {content}
                  </li>
                )
              })}
            </ul>

            <Link
              href="/gallery#reviews"
              className="brand-button flex items-center justify-center border-t border-white/10 px-4 py-3 text-[0.62rem] text-white/62 transition hover:bg-white/5 hover:text-white"
            >
              Read live customer reviews <span className="ml-2 text-amber-400" aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </div>
      </Container>

      {shouldMountBackgroundVideo && videoReady ? (
        <button
          type="button"
          onClick={() => setIsBackgroundVideoPaused((paused) => !paused)}
          aria-label={
            isBackgroundVideoPaused
              ? 'Play animated background'
              : 'Pause animated background'
          }
          className="absolute right-4 top-4 z-20 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 bg-black/75 px-3 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-md transition hover:border-amber-300/60 hover:text-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 sm:right-6 sm:top-6"
        >
          {isBackgroundVideoPaused ? (
            <Play className="h-4 w-4 fill-current" aria-hidden="true" />
          ) : (
            <Pause className="h-4 w-4 fill-current" aria-hidden="true" />
          )}
          <span>{isBackgroundVideoPaused ? 'Play motion' : 'Pause motion'}</span>
        </button>
      ) : null}

      {isFullVideoOpen && fullVideoSrc ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/88 p-4 sm:p-8"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) closeFullVideo()
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="hero-full-video-title"
            aria-describedby="hero-full-video-description"
            className="w-full max-w-5xl overflow-hidden rounded-2xl border border-white/15 bg-[#0c0b0a] shadow-[0_34px_120px_rgba(0,0,0,0.72)]"
          >
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-5">
              <div>
                <p className="motif-spec text-[0.62rem] text-amber-300/75">BUILD DAY / TIMELAPSE</p>
                <h2 id="hero-full-video-title" className="brand-subheading mt-1 text-base text-white sm:text-lg">
                  Watch a shed built in one day
                </h2>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeFullVideo}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition hover:border-amber-300/55 hover:text-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
                aria-label="Close full video"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="aspect-video w-full bg-black">
              <video
                data-testid="hero-full-video"
                src={fullVideoSrc}
                className="h-full w-full bg-black object-contain"
                controls
                autoPlay
                playsInline
                preload="metadata"
                poster={HERO_IMAGE_SRC}
                aria-label="Shed210 one-day shed build video"
                aria-describedby="hero-full-video-description"
              />
            </div>

            <p
              id="hero-full-video-description"
              className="px-4 pt-3 text-sm leading-6 text-white/70 sm:px-5"
            >
              This silent 39-second time-lapse shows a Shed210 crew assembling the
              floor and walls, framing the gable roof, installing the exterior
              panels and roof, and finishing the shed door.
            </p>
            <p className="px-4 pb-3 pt-2 text-xs leading-5 text-white/60 sm:px-5">
              Playback, picture-in-picture, and fullscreen controls are available in
              the video player.
              {fullVideoFallbackUrl ? (
                <>
                  {' '}
                  If it does not start,{' '}
                  <a
                    href={fullVideoFallbackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-amber-300 underline decoration-amber-300/45 underline-offset-4 transition hover:text-amber-200"
                  >
                    watch the backup on Facebook
                  </a>
                  .
                </>
              ) : null}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  )
}
