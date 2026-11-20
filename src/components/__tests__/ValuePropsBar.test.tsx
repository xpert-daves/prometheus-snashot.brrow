import { render, screen, within } from '@testing-library/react'
import ValuePropsBar from '../ValuePropsBar'

describe('ValuePropsBar', () => {
  it('names the section by its heading and keeps the #why-buy anchor', () => {
    render(<ValuePropsBar />)

    const section = screen.getByRole('region', { name: /why buy from shed210/i })
    expect(section).toHaveAttribute('id', 'why-buy')
  })

  it('lists the four build terms with their figures spoken in full', () => {
    render(<ValuePropsBar />)

    const list = screen.getByRole('list')
    const terms = within(list).getAllByRole('heading', { level: 3 })
    expect(terms.map((term) => term.textContent)).toEqual([
      '1-day On-site build',
      '$250 Deposit',
      '2-year Workmanship warranty',
      '40-year Metal warranty',
    ])
    // Each tag has its decorative icon, hidden from assistive tech.
    expect(list.querySelectorAll('li svg[aria-hidden="true"]')).toHaveLength(4)
  })

  it('keeps the "no hidden fees" promise off, since per-job costs are confirmed separately', () => {
    render(<ValuePropsBar />)

    expect(screen.queryByText(/no hidden fees/i)).toBeNull()
  })

  it('does not render the heavier testimonial card version', () => {
    render(<ValuePropsBar />)

    expect(screen.queryByRole('heading', { name: /why homeowners choose shed210/i })).toBeNull()
    expect(screen.queryByRole('heading', { name: /fast install/i })).toBeNull()
    expect(screen.queryByText(/jeanette sifuentes/i)).toBeNull()
  })
})
