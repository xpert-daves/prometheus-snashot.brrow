import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import HeroGoogleReviewProof from '../HeroGoogleReviewProof'

const originalFetch = global.fetch
const originalRequestIdleCallback = Object.getOwnPropertyDescriptor(
  window,
  'requestIdleCallback'
)
const originalCancelIdleCallback = Object.getOwnPropertyDescriptor(
  window,
  'cancelIdleCallback'
)

describe('HeroGoogleReviewProof', () => {
  const fetchMock = jest.fn()
  const requestIdleCallbackMock = jest.fn()
  const cancelIdleCallbackMock = jest.fn()
  let idleCallback: IdleRequestCallback | undefined

  beforeEach(() => {
    fetchMock.mockReset()
    requestIdleCallbackMock.mockReset()
    cancelIdleCallbackMock.mockReset()
    idleCallback = undefined
    global.fetch = fetchMock as typeof fetch

    requestIdleCallbackMock.mockImplementation((callback: IdleRequestCallback) => {
      idleCallback = callback
      return 23
    })
    Object.defineProperty(window, 'requestIdleCallback', {
      configurable: true,
      value: requestIdleCallbackMock,
    })
    Object.defineProperty(window, 'cancelIdleCallback', {
      configurable: true,
      value: cancelIdleCallbackMock,
    })
  })

  afterEach(() => {
    cleanup()
    global.fetch = originalFetch
    Reflect.deleteProperty(document, 'readyState')

    if (originalRequestIdleCallback) {
      Object.defineProperty(
        window,
        'requestIdleCallback',
        originalRequestIdleCallback
      )
    } else {
      Reflect.deleteProperty(window, 'requestIdleCallback')
    }
    if (originalCancelIdleCallback) {
      Object.defineProperty(
        window,
        'cancelIdleCallback',
        originalCancelIdleCallback
      )
    } else {
      Reflect.deleteProperty(window, 'cancelIdleCallback')
    }
  })

  function setReadyState(value: DocumentReadyState) {
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      value,
    })
  }

  function runIdleCallback() {
    expect(idleCallback).toBeDefined()
    act(() => {
      idleCallback?.({
        didTimeout: false,
        timeRemaining: () => 50,
      })
    })
  }

  function renderProof() {
    return render(
      <HeroGoogleReviewProof icon={<span data-testid="google-proof-icon" />} />
    )
  }

  it('waits for window load and browser idle before showing the live rating and count', async () => {
    setReadyState('loading')
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ rating: 4.8, reviewCount: 36 }),
    } as unknown as Response)

    renderProof()

    expect(screen.getByLabelText('Live Google Reviews')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(requestIdleCallbackMock).not.toHaveBeenCalled()

    window.dispatchEvent(new Event('load'))

    expect(requestIdleCallbackMock).toHaveBeenCalledWith(
      expect.any(Function),
      { timeout: 2_000 }
    )
    expect(fetchMock).not.toHaveBeenCalled()

    runIdleCallback()

    await waitFor(() => {
      expect(
        screen.getByLabelText(
          'Google rating 4.8 out of 5 stars from 36 reviews'
        )
      ).toBeInTheDocument()
    })
    expect(
      screen.getByRole('link', { name: 'Google rating 4.8 out of 5 stars from 36 reviews' })
    ).toHaveAttribute('href', '/gallery#reviews')
    expect(screen.getByText('4.8')).toBeInTheDocument()
    expect(screen.getByText('36 reviews')).toBeInTheDocument()
    expect(screen.getByTestId('hero-google-rating-star')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/google-reviews/summary',
      expect.objectContaining({
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      })
    )
  })

  it('keeps the stable fallback when the live summary request fails', async () => {
    setReadyState('complete')
    fetchMock.mockResolvedValue({ ok: false } as Response)

    renderProof()
    runIdleCallback()

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(screen.getByLabelText('Live Google Reviews')).toBeInTheDocument()
    expect(screen.queryByTestId('hero-google-rating-star')).toBeNull()
  })

  it('uses singular review copy for an exact count of one', async () => {
    setReadyState('complete')
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ rating: 5, reviewCount: 1 }),
    } as unknown as Response)

    renderProof()
    runIdleCallback()

    await waitFor(() => {
      expect(screen.getByText('1 review')).toBeInTheDocument()
    })
    expect(
      screen.getByLabelText('Google rating 5.0 out of 5 stars from 1 review')
    ).toBeInTheDocument()
  })
})
