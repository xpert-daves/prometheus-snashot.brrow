import fs from 'node:fs'
import path from 'node:path'
import * as Sentry from '@sentry/nextjs'
import { fireEvent, render, screen } from '@testing-library/react'
import ErrorPage from '../error'
import { PHONE_DISPLAY, PHONE_NUMBER } from '@/lib/contact'

jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

describe('app error boundary', () => {
  beforeEach(() => (Sentry.captureException as jest.Mock).mockClear())

  it('reports the error and offers retry, call, and text', () => {
    const error = new Error('Access is denied for this document.')
    const retry = jest.fn()

    render(<ErrorPage error={error} retry={retry} />)

    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    expect(Sentry.captureException).toHaveBeenCalledWith(error)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("This page didn't load")
    expect(screen.getByRole('link', { name: `Call ${PHONE_DISPLAY}` })).toHaveAttribute('href', `tel:${PHONE_NUMBER}`)
    expect(screen.getByRole('link', { name: `Text ${PHONE_DISPLAY}` })).toHaveAttribute('href', `sms:${PHONE_NUMBER}`)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('renders inside the root layout so the navbar and footer phone stay on screen', () => {
    // Unlike global-error.tsx, a segment boundary must not render its own document.
    expect(readSource('src/app/error.tsx')).not.toMatch(/<(html|body)\b/)

    const layout = readSource('src/app/layout.tsx')
    const header = layout.indexOf('<Header />')
    const children = layout.indexOf('{children}')
    const footer = layout.indexOf('<Footer />')
    expect(header).toBeGreaterThan(-1)
    expect(children).toBeGreaterThan(header)
    expect(footer).toBeGreaterThan(children)
  })
})
