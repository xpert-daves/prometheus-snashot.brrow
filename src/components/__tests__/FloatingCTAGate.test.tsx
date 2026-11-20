import { render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import FloatingCTAGate from '../FloatingCTAGate'

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}))

// The gate declares FloatingCTA first and MobileActionBar second.
jest.mock('next/dynamic', () => {
  let calls = 0
  return {
    __esModule: true,
    default: () => {
      calls += 1
      if (calls % 2 === 1) {
        return function MockDynamicFloatingCTA() {
          return <a href="/quote">Get Instant Price</a>
        }
      }
      return function MockDynamicMobileActionBar() {
        return <nav aria-label="Contact Shed210" />
      }
    },
  }
})

const mockUsePathname = usePathname as jest.Mock

describe('FloatingCTAGate', () => {
  it('shows only the phone action bar on the homepage', () => {
    mockUsePathname.mockReturnValue('/')
    render(<FloatingCTAGate />)
    expect(screen.queryByRole('link', { name: /get instant price/i })).toBeNull()
    expect(screen.getByRole('navigation', { name: 'Contact Shed210' })).toBeInTheDocument()
  })

  it('renders the floating CTA and the phone action bar on non-home routes', () => {
    mockUsePathname.mockReturnValue('/contact')
    render(<FloatingCTAGate />)
    expect(screen.getByRole('link', { name: /get instant price/i })).toHaveAttribute('href', '/quote')
    expect(screen.getByRole('navigation', { name: 'Contact Shed210' })).toBeInTheDocument()
  })

  it.each(['/quote', '/admin/leads', '/review', '/review/abc123'])(
    'renders nothing on %s',
    (pathname) => {
      mockUsePathname.mockReturnValue(pathname)
      const { container } = render(<FloatingCTAGate />)
      expect(container).toBeEmptyDOMElement()
    }
  )
})
