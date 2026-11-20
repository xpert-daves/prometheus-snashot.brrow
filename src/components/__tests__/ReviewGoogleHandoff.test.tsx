import { render, screen } from '@testing-library/react'
import ReviewGoogleHandoff from '../review/ReviewGoogleHandoff'
import { GOOGLE_MAPS_APP_URL, GOOGLE_REVIEW_URL } from '@/lib/reviewPage'

const CODE = '7KQ2M9XA'
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'
const originalFetch = global.fetch
const originalUserAgent = navigator.userAgent
const fetchMock = jest.fn()
const navigate = jest.fn()

function setUserAgent(value: string) {
  Object.defineProperty(navigator, 'userAgent', { value, configurable: true })
}
function sentBodies() {
  return fetchMock.mock.calls
    .filter(([url]) => url === '/api/review-feedback')
    .map(([, init]) => ({ body: JSON.parse(init.body as string), keepalive: init.keepalive }))
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true })
  navigate.mockReset()
  global.fetch = fetchMock as typeof fetch
})

afterEach(() => {
  global.fetch = originalFetch
  setUserAgent(originalUserAgent)
})

it('records the open and goes straight to Google on Android', () => {
  setUserAgent(ANDROID_UA)
  render(<ReviewGoogleHandoff code={CODE} navigate={navigate} />)

  expect(sentBodies()).toEqual([
    { body: { code: CODE, event: 'opened', device: 'android' }, keepalive: true },
  ])
  expect(navigate).toHaveBeenCalledTimes(1)
  expect(navigate).toHaveBeenCalledWith(GOOGLE_REVIEW_URL)
  expect(screen.getByRole('link', { name: /Review us on Google/ })).toHaveAttribute(
    'href',
    GOOGLE_REVIEW_URL,
  )
  // No stars and no private feedback box: every customer gets the same Google link.
  expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
})

it('offers the Google Maps app on iPhone instead of redirecting', () => {
  setUserAgent(IPHONE_UA)
  render(<ReviewGoogleHandoff code={CODE} navigate={navigate} />)

  expect(sentBodies()).toEqual([
    { body: { code: CODE, event: 'opened', device: 'iphone' }, keepalive: true },
  ])
  expect(navigate).not.toHaveBeenCalled()
  expect(screen.getByRole('link', { name: /Open Google Maps to review/ })).toHaveAttribute(
    'href',
    GOOGLE_MAPS_APP_URL,
  )
  expect(screen.getByRole('link', { name: 'Review in your browser' })).toHaveAttribute(
    'href',
    GOOGLE_REVIEW_URL,
  )
})

it('still goes to Google without recording anything for a mistyped code', () => {
  setUserAgent(ANDROID_UA)
  render(<ReviewGoogleHandoff code={null} navigate={navigate} />)

  expect(sentBodies()).toEqual([])
  expect(navigate).toHaveBeenCalledWith(GOOGLE_REVIEW_URL)
})
