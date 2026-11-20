import { render, screen, within } from '@testing-library/react'
import HomeBuildingPicker from '../HomeBuildingPicker'
import { BUILDING_CATALOG } from '../../lib/buildingCatalog'
import { getRequestedQuoteStructureType } from '../../lib/quoteNavigation'

jest.mock('../../lib/analytics', () => ({
  trackEvent: jest.fn(),
}))

describe('HomeBuildingPicker', () => {
  it('opens the quote with each building already selected', () => {
    render(<HomeBuildingPicker />)

    const list = screen.getByRole('list')
    for (const building of BUILDING_CATALOG) {
      const link = within(list).getByRole('link', { name: `Price ${building.quoteLabel}` })
      const href = link.getAttribute('href') ?? ''

      expect(href.startsWith('/quote?')).toBe(true)
      // The quote page reads the building back out of this same query string.
      expect(getRequestedQuoteStructureType(href.slice(href.indexOf('?')))).toBe(building.value)
      expect(link).toHaveTextContent(building.title)
    }
  })

  it('keeps the comparison page one tap away for visitors who are not sure yet', () => {
    render(<HomeBuildingPicker />)

    expect(screen.getByRole('heading', { level: 2, name: /what are you building/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Compare Buildings' })).toHaveAttribute('href', '/buildings')
  })
})
