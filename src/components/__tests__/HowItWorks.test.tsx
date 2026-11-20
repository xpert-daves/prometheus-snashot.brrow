import { render, screen, within } from '@testing-library/react'
import HowItWorks from '../HowItWorks'

jest.mock('../../lib/analytics', () => ({
  trackEvent: jest.fn(),
}))

describe('HowItWorks', () => {
  it('lists the three steps in the order jobs actually run', () => {
    render(<HowItWorks />)

    expect(screen.getByRole('heading', { level: 2, name: /from first text to build day/i })).toBeInTheDocument()

    const steps = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(steps).toHaveLength(3)
    expect(within(steps[0]).getByRole('heading', { level: 3 })).toHaveTextContent(/step 1: get your price/i)
    expect(within(steps[1]).getByRole('heading', { level: 3 })).toHaveTextContent(/step 2: pick colors, book a day/i)
    expect(within(steps[2]).getByRole('heading', { level: 3 })).toHaveTextContent(/step 3: build day/i)
  })

  it('splits each step into what the customer does and what David does', () => {
    render(<HowItWorks />)

    const [price, booking, buildDay] = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(within(price).getByText(/confirms the exact price/i)).toBeInTheDocument()
    expect(within(price).getByText(/travel past 35 miles/i)).toBeInTheDocument()
    expect(within(booking).getByText(/main, trim, and roof colors/i)).toBeInTheDocument()
    expect(within(booking).getByText(/clear the spot before build day/i)).toBeInTheDocument()
    expect(within(buildDay).getByText(/most sheds are done in a day/i)).toBeInTheDocument()
    expect(within(booking).getByText(/a \$250 deposit holds your build day and comes off the total/i)).toBeInTheDocument()
    expect(within(buildDay).getByText(/pay the balance once it's built, by cash or check/i)).toBeInTheDocument()
    expect(screen.queryByText(/nothing is due upfront/i)).toBeNull()
  })

  it('drops the "no hidden fees" promise, since per-job costs are confirmed separately', () => {
    render(<HowItWorks />)

    expect(screen.queryByText(/no hidden fees/i)).toBeNull()
    expect(screen.queryByText(/what you see is what you pay/i)).toBeNull()
  })

  it('keeps the quote and text calls to action', () => {
    render(<HowItWorks />)

    expect(screen.getByRole('link', { name: /get instant price/i })).toHaveAttribute('href', '/quote')
    expect(screen.getByRole('link', { name: /text david/i }).getAttribute('href')).toMatch(/^sms:/)
    expect(screen.getByRole('link', { name: /san antonio permit guide/i })).toHaveAttribute(
      'href',
      '/news/sanantonio_shed_guide'
    )
  })
})
