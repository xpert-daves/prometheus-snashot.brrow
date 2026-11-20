import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import Hero, { type HeroVideoSource } from '../hero'

jest.mock('../HeroGoogleReviewProof', () => ({
  __esModule: true,
  heroProofLinkClassName: 'hero-proof-link',
  default: ({ icon }: { icon: ReactNode }) => (
    <li aria-label="Live Google Reviews">
      {icon}
      <span>Live Google Reviews</span>
    </li>
  ),
}))

const backgroundVideoSources: readonly HeroVideoSource[] = [
  { src: '/hero-background.webm', type: 'video/webm' },
  { src: '/hero-background.mp4', type: 'video/mp4' },
]
const fullVideoSrc = '/shed-build-day.mp4'
const fullVideoFallbackUrl =
  'https://www.facebook.com/shed210/videos/1582687942854176/'

describe('Hero', () => {
  let reducedMotion = false
  let desktopPointer = true
  let motionChangeListener: ((event: MediaQueryListEvent) => void) | undefined
  let desktopChangeListener: ((event: MediaQueryListEvent) => void) | undefined
  let intersectionCallbacks: IntersectionObserverCallback[] = []
  let idleCallback: IdleRequestCallback | undefined
  let playMock: jest.SpyInstance<Promise<void>, []>
  let pauseMock: jest.SpyInstance<void, []>
  const observeMock = jest.fn()
  const disconnectMock = jest.fn()
  const requestIdleCallbackMock = jest.fn(
    (callback: IdleRequestCallback) => {
      idleCallback = callback
      return 17
    }
  )

  beforeEach(() => {
    reducedMotion = false
    desktopPointer = true
    motionChangeListener = undefined
    desktopChangeListener = undefined
    intersectionCallbacks = []
    idleCallback = undefined
    observeMock.mockClear()
    disconnectMock.mockClear()
    requestIdleCallbackMock.mockClear()

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        get matches() {
          return query.includes('prefers-reduced-motion') ? reducedMotion : desktopPointer
        },
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: (
          eventName: string,
          listener: (event: MediaQueryListEvent) => void
        ) => {
          if (eventName !== 'change') return
          if (query.includes('prefers-reduced-motion')) motionChangeListener = listener
          else desktopChangeListener = listener
        },
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    })

    class ControlledIntersectionObserver {
      readonly root = null
      readonly rootMargin = ''
      readonly thresholds = [0.08]

      constructor(callback: IntersectionObserverCallback) {
        intersectionCallbacks.push(callback)
      }

      observe = observeMock
      unobserve = jest.fn()
      disconnect = disconnectMock
      takeRecords = jest.fn(() => [])
    }

    Object.defineProperty(globalThis, 'IntersectionObserver', {
      configurable: true,
      writable: true,
      value: ControlledIntersectionObserver,
    })
    Object.defineProperty(window, 'requestIdleCallback', {
      configurable: true,
      value: requestIdleCallbackMock,
    })
    Object.defineProperty(window, 'cancelIdleCallback', {
      configurable: true,
      value: jest.fn(),
    })

    jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0)
        return 1
      })
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
    playMock = jest
      .spyOn(window.HTMLMediaElement.prototype, 'play')
      .mockResolvedValue(undefined)
    pauseMock = jest
      .spyOn(window.HTMLMediaElement.prototype, 'pause')
      .mockImplementation(() => undefined)
  })

  afterEach(() => {
    cleanup()
    jest.restoreAllMocks()
    Reflect.deleteProperty(window, 'matchMedia')
    Reflect.deleteProperty(window, 'requestIdleCallback')
    Reflect.deleteProperty(window, 'cancelIdleCallback')
    Reflect.deleteProperty(window.navigator, 'connection')
    document.body.style.overflow = ''
  })

  async function markHeroPosterLoaded() {
    await act(async () => {
      fireEvent.load(screen.getByAltText('Custom shed on a Texas backyard'))
      window.dispatchEvent(new Event('load'))
      await Promise.resolve()
    })
  }

  async function startDeferredBackgroundVideo() {
    await markHeroPosterLoaded()

    await waitFor(() => expect(requestIdleCallbackMock).toHaveBeenCalledTimes(1))
    await act(async () => {
      idleCallback?.({
        didTimeout: false,
        timeRemaining: () => 50,
      })
      await Promise.resolve()
    })

    return screen.getByTestId('hero-background-video') as HTMLVideoElement
  }

  it('renders the conversion-focused hero copy with the one-day emphasis', () => {
    render(<Hero />)

    expect(
      screen.getByRole('heading', {
        name: /custom sheds built on-site in as little as 1 day/i,
      })
    ).toBeInTheDocument()
    expect(screen.getByText('1 DAY')).toHaveClass('text-amber-400')
    expect(
      screen.getByText(
        /Storage sheds, metal sheds and workshops built on your property by a local San Antonio shed builder\. No long delays\. No hassle\./i
      )
    ).toBeInTheDocument()
    expect(screen.getByText('No Distance Fee Within 35 Miles')).toBeInTheDocument()
    expect(screen.queryByText(/free delivery/i)).not.toBeInTheDocument()
  })

  it('renders live Google review proof and count-free local project details', () => {
    render(<Hero />)

    const reviewsProof = screen.getByLabelText(/Live Google Reviews/i)
    const projectsProof = screen.getByLabelText(/Local Projects Photos & Build Details/i)
    const localProof = screen.getByLabelText(/Locally Owned & Operated/i)

    expect(reviewsProof).toBeInTheDocument()
    expect(projectsProof).toBeInTheDocument()
    expect(localProof).toBeInTheDocument()
    expect(reviewsProof.querySelector('[data-testid="google-g-icon"]')).toBeInTheDocument()
    expect(screen.queryByLabelText(/4\.8 Google Rating/i)).toBeNull()
    expect(screen.queryByLabelText(/4\.9 Google Rating/i)).toBeNull()
    expect(screen.queryByLabelText(/500\+ Projects Completed/i)).toBeNull()
    expect(screen.queryByLabelText(/100\+ Projects Completed/i)).toBeNull()
  })

  it('links the proof and financing items people tap', () => {
    render(<Hero />)

    expect(
      screen.getByRole('link', { name: 'Local Projects Photos & Build Details' })
    ).toHaveAttribute('href', '/gallery')
    expect(screen.getByRole('link', { name: 'Financing Available' })).toHaveAttribute(
      'href',
      '/contact'
    )
    expect(screen.queryByRole('link', { name: /Locally Owned/i })).toBeNull()
  })

  it('keeps only price and video in the primary action group without a small text link', () => {
    render(<Hero fullVideoSrc={fullVideoSrc} />)

    const actionGroup = screen.getByRole('group', { name: /hero actions/i })
    const quoteLink = within(actionGroup).getByRole('link', { name: /get instant price/i })
    const watchButton = within(actionGroup).getByRole('button', {
      name: /watch a shed built in one day/i,
    })

    expect(quoteLink).toHaveAttribute('href', '/quote')
    expect(watchButton).toHaveTextContent(/WATCH A SHED BUILT IN ONE DAY/i)
    expect(within(actionGroup).queryByRole('link', { name: /text/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /text/i })).toBeNull()
  })

  it('links to the on-site live reviews without an unattributed review quote', () => {
    render(<Hero />)

    const googleReviewsLink = screen.getByRole('link', {
      name: /read live customer reviews/i,
    })

    expect(googleReviewsLink).toHaveAttribute('href', '/gallery#reviews')
    expect(googleReviewsLink).not.toHaveAttribute('target')
    expect(
      screen.queryByRole('link', { name: /read current customer reviews on google/i })
    ).toBeNull()
    expect(screen.queryByText(/Built in one day, crew was professional/i)).toBeNull()
    expect(screen.queryByText(/Verified Google Review/i)).toBeNull()
  })

  it('defers the background video and then renders silent WebM and MP4 sources in fallback order', async () => {
    render(
      <Hero
        backgroundVideoSources={backgroundVideoSources}
        fullVideoSrc={fullVideoSrc}
      />
    )

    expect(screen.queryByTestId('hero-background-video')).toBeNull()
    expect(playMock).not.toHaveBeenCalled()

    const video = await startDeferredBackgroundVideo()
    const sources = Array.from(video.querySelectorAll('source'))

    expect(video.autoplay).toBe(true)
    expect(video.muted).toBe(true)
    expect(video.loop).toBe(true)
    expect(video.playsInline).toBe(true)
    expect(video.controls).toBe(false)
    expect(video).toHaveAttribute('preload', 'none')
    // The optimized Image underneath remains visible until playback starts.
    expect(video).not.toHaveAttribute('poster')
    expect(video).toHaveClass('object-[70%_center]', 'md:object-center')
    expect(sources).toHaveLength(2)
    expect(sources[0]).toHaveAttribute('src', '/hero-background.webm')
    expect(sources[0]).toHaveAttribute('type', 'video/webm')
    expect(sources[1]).toHaveAttribute('src', '/hero-background.mp4')
    expect(sources[1]).toHaveAttribute('type', 'video/mp4')
    expect(playMock).toHaveBeenCalled()
  })

  it('keeps the static poster for reduced motion while preserving the user-invoked full video', async () => {
    reducedMotion = true
    const user = userEvent.setup()

    render(
      <Hero
        backgroundVideoSources={backgroundVideoSources}
        fullVideoSrc={fullVideoSrc}
      />
    )

    await markHeroPosterLoaded()

    expect(screen.queryByTestId('hero-background-video')).toBeNull()
    expect(requestIdleCallbackMock).not.toHaveBeenCalled()

    await user.click(
      screen.getByRole('button', { name: /watch a shed built in one day/i })
    )
    expect(screen.getByRole('dialog', { name: /watch a shed built in one day/i })).toBeInTheDocument()
    expect(screen.getByTestId('hero-full-video')).toBeInTheDocument()
  })

  it('keeps mobile loads free of decorative video while allowing the full video on request', async () => {
    desktopPointer = false
    const user = userEvent.setup()
    const { container } = render(
      <Hero backgroundVideoSources={backgroundVideoSources} fullVideoSrc={fullVideoSrc} />
    )
    await markHeroPosterLoaded()
    expect(container.querySelector('video')).toBeNull()
    expect(container.querySelector('source')).toBeNull()
    expect(requestIdleCallbackMock).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /watch a shed built in one day/i }))
    expect(screen.getByTestId('hero-full-video')).toHaveAttribute('src', fullVideoSrc)
  })

  it('unmounts the decorative video when the viewport stops matching desktop', async () => {
    render(<Hero backgroundVideoSources={backgroundVideoSources} />)
    await startDeferredBackgroundVideo()
    desktopPointer = false
    act(() => desktopChangeListener?.(new Event('change') as MediaQueryListEvent))
    expect(screen.queryByTestId('hero-background-video')).toBeNull()
    expect(pauseMock).toHaveBeenCalled()
  })

  it.each(['slow-2g', '2g', '3g'])('avoids decorative video on a %s connection', async (effectiveType) => {
    Object.defineProperty(window.navigator, 'connection', {
      configurable: true,
      value: { effectiveType },
    })
    render(<Hero backgroundVideoSources={backgroundVideoSources} />)
    await markHeroPosterLoaded()
    expect(screen.queryByTestId('hero-background-video')).toBeNull()
    expect(requestIdleCallbackMock).not.toHaveBeenCalled()
  })

  it('stops attaching background video when the motion preference changes to reduce', async () => {
    render(<Hero backgroundVideoSources={backgroundVideoSources} />)
    await startDeferredBackgroundVideo()

    reducedMotion = true
    act(() => motionChangeListener?.(new Event('change') as MediaQueryListEvent))

    expect(screen.queryByTestId('hero-background-video')).toBeNull()
    expect(pauseMock).toHaveBeenCalled()
  })

  it('keeps the poster on data saver without hiding the full-video action', async () => {
    Object.defineProperty(window.navigator, 'connection', {
      configurable: true,
      value: { saveData: true, effectiveType: '4g' },
    })

    render(
      <Hero
        backgroundVideoSources={backgroundVideoSources}
        fullVideoSrc={fullVideoSrc}
      />
    )

    await markHeroPosterLoaded()

    expect(screen.queryByTestId('hero-background-video')).toBeNull()
    expect(screen.getByRole('button', { name: /watch a shed built in one day/i })).toBeInTheDocument()
  })

  it('lets visitors pause and restart the animated background', async () => {
    const user = userEvent.setup()
    render(<Hero backgroundVideoSources={backgroundVideoSources} />)

    const video = await startDeferredBackgroundVideo()
    fireEvent.playing(video)

    const pauseButton = screen.getByRole('button', {
      name: /pause animated background/i,
    })
    await user.click(pauseButton)

    expect(pauseMock).toHaveBeenCalled()
    const playButton = screen.getByRole('button', {
      name: /play animated background/i,
    })

    const playCountBeforeRestart = playMock.mock.calls.length
    await user.click(playButton)
    await waitFor(() =>
      expect(playMock.mock.calls.length).toBeGreaterThan(playCountBeforeRestart)
    )
  })

  it('pauses out of view and resumes when the hero intersects again', async () => {
    render(<Hero backgroundVideoSources={backgroundVideoSources} />)
    await startDeferredBackgroundVideo()
    const playCountBeforeScroll = playMock.mock.calls.length

    act(() => {
      intersectionCallbacks.forEach((callback) =>
        callback(
          [{ isIntersecting: false } as IntersectionObserverEntry],
          {} as IntersectionObserver
        )
      )
    })
    expect(pauseMock).toHaveBeenCalled()

    act(() => {
      intersectionCallbacks.forEach((callback) =>
        callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver
        )
      )
    })
    await waitFor(() => expect(playMock.mock.calls.length).toBeGreaterThan(playCountBeforeScroll))
  })

  it('opens an iPhone-friendly native video lightbox, closes with Escape, and restores focus', async () => {
    const user = userEvent.setup()
    render(
      <Hero
        fullVideoSrc={fullVideoSrc}
        fullVideoFallbackUrl={fullVideoFallbackUrl}
      />
    )

    const watchButton = screen.getByRole('button', {
      name: /watch a shed built in one day/i,
    })
    expect(screen.queryByTestId('hero-full-video')).toBeNull()

    await user.click(watchButton)

    const dialog = screen.getByRole('dialog', { name: /watch a shed built in one day/i })
    const closeButton = within(dialog).getByRole('button', { name: /close full video/i })
    const fullVideo = screen.getByTestId('hero-full-video')

    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(closeButton).toHaveFocus()
    expect(fullVideo.tagName).toBe('VIDEO')
    expect(fullVideo).toHaveAttribute('src', fullVideoSrc)
    expect(fullVideo).toHaveAttribute('controls')
    expect(fullVideo).toHaveAttribute('autoplay')
    expect(fullVideo).toHaveAttribute('playsinline')
    expect(fullVideo).toHaveAttribute('preload', 'metadata')
    expect(fullVideo).toHaveAttribute('poster', '/herobackground.webp')
    expect(dialog).toHaveAccessibleDescription(
      /silent 39-second time-lapse shows a Shed210 crew/i
    )
    expect(
      within(dialog).getByRole('link', { name: /watch the backup on facebook/i })
    ).toHaveAttribute('href', fullVideoFallbackUrl)
    expect(document.body.style.overflow).toBe('hidden')

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.body.style.overflow).toBe('')
    expect(watchButton).toHaveFocus()
  })

  it('pauses the decorative background while the full video is open', async () => {
    const user = userEvent.setup()
    render(
      <Hero
        backgroundVideoSources={backgroundVideoSources}
        fullVideoSrc={fullVideoSrc}
      />
    )
    await startDeferredBackgroundVideo()
    pauseMock.mockClear()

    await user.click(
      screen.getByRole('button', { name: /watch a shed built in one day/i })
    )

    expect(pauseMock).toHaveBeenCalled()
  })

  it('falls back to the poster if the decorative video fails', async () => {
    const user = userEvent.setup()
    render(
      <Hero
        backgroundVideoSources={backgroundVideoSources}
        fullVideoSrc={fullVideoSrc}
      />
    )
    const video = await startDeferredBackgroundVideo()

    fireEvent.error(video)

    expect(screen.queryByTestId('hero-background-video')).toBeNull()
    expect(screen.getByAltText('Custom shed on a Texas backyard')).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: /watch a shed built in one day/i })
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('disconnects the hero visibility observer on unmount', () => {
    const { unmount } = render(<Hero backgroundVideoSources={backgroundVideoSources} />)
    expect(observeMock).toHaveBeenCalled()
    const disconnectCountBeforeUnmount = disconnectMock.mock.calls.length

    unmount()
    expect(disconnectMock.mock.calls.length).toBeGreaterThan(disconnectCountBeforeUnmount)
  })
})
