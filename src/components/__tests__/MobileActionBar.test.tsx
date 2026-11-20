import { act, fireEvent, render, screen } from '@testing-library/react'
import MobileActionBar from '../MobileActionBar'

function scrollTo(scrollY: number) {
  Object.defineProperty(window, 'scrollY', { value: scrollY, writable: true })
  Object.defineProperty(window, 'innerHeight', { value: 600, writable: true })
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    get: () => 3000,
    configurable: true,
  })
}

describe('MobileActionBar', () => {
  beforeEach(() => jest.useFakeTimers())

  afterEach(() => {
    jest.useRealTimers()
    delete (document.documentElement as { scrollHeight?: unknown }).scrollHeight
  })

  it('links Call, Text and the instant price once the page is scrolled', () => {
    scrollTo(400)
    render(<MobileActionBar />)
    act(() => {
      fireEvent.scroll(window)
      jest.runAllTimers()
    })

    const nav = screen.getByRole('navigation', { name: 'Contact Shed210' })
    expect(nav.parentElement).not.toHaveAttribute('inert')
    expect(screen.getByRole('link', { name: 'Call (855) 578-0944' })).toHaveAttribute(
      'href',
      'tel:+18555780944'
    )
    expect(screen.getByRole('link', { name: 'Text (855) 578-0944' })).toHaveAttribute(
      'href',
      'sms:+18555780944'
    )
    expect(screen.getByRole('link', { name: 'Instant Price' })).toHaveAttribute('href', '/quote')
  })

  it('keeps the Text link when rendered without website chat', () => {
    scrollTo(400)
    render(<MobileActionBar />)
    expect(screen.queryByRole('button', { name: 'Chat with Shed210' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Text (855) 578-0944' })).toBeInTheDocument()
  })

  it('stays inert over the hero so it cannot take taps meant for the page', () => {
    scrollTo(0)
    const { container } = render(<MobileActionBar />)
    act(() => {
      jest.runAllTimers()
    })

    const bar = container.firstElementChild
    expect(bar).toHaveAttribute('inert')
    expect(bar).toHaveClass('pointer-events-none')
  })
})
