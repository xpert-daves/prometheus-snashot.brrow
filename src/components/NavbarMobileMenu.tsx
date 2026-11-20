'use client'

import Link from 'next/link'
import clsx from 'clsx'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { resumeQuoteFromLink } from '@/lib/quoteNavigation'
import { ChevronRight, Menu, MessageSquareText, Phone, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { PHONE_DISPLAY, PHONE_NUMBER } from '@/lib/contact'
import { trackEvent } from '@/lib/analytics'
import { NAV_LINKS, isNavLinkActive } from '@/lib/navLinks'

export default function MobileMenu() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const firstMobileLinkRef = useRef<HTMLAnchorElement | null>(null)
  const toggleButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    const { style } = document.body
    let focusTimeoutId: ReturnType<typeof setTimeout> | undefined

    if (open) {
      style.overflow = 'hidden'
      focusTimeoutId = setTimeout(() => firstMobileLinkRef.current?.focus(), 0)
    } else {
      style.overflow = ''
    }

    return () => {
      if (focusTimeoutId !== undefined) {
        clearTimeout(focusTimeoutId)
      }
      style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        toggleButtonRef.current?.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const handleMobileLinkClick = (label: string) => {
    trackEvent('nav_link_clicked', { label })
    setOpen(false)
  }

  const handleMobileQuoteClick = (event: MouseEvent<HTMLAnchorElement>, location: 'mobile_header' | 'mobile_menu') => {
    trackEvent('quote_cta_clicked', { location })
    resumeQuoteFromLink(event, '/quote')
    setOpen(false)
  }

  return (
    <>
      <Link
        href="/quote"
        onClick={(event) => handleMobileQuoteClick(event, 'mobile_header')}
        className="brand-label inline-flex h-9 items-center whitespace-nowrap rounded-full bg-amber-500 px-3.5 text-[0.68rem] text-black shadow-[0_10px_24px_-18px_rgba(255,122,26,0.9)] outline-none transition hover:bg-amber-400 focus-visible:ring-2 focus-visible:ring-amber-400/80 lg:hidden"
        aria-label="Get Instant Price"
      >
        Instant Price
      </Link>

      <button
        ref={toggleButtonRef}
        type="button"
        className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-white/95 outline-none transition hover:bg-white/5 active:scale-95 focus-visible:ring-2 focus-visible:ring-amber-400/80 lg:hidden"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Close mobile menu' : 'Open mobile menu'}
        aria-expanded={open}
        aria-controls="mobile-nav"
      >
        {open ? (
          <X size={20} aria-hidden="true" />
        ) : (
          <Menu size={20} aria-hidden="true" />
        )}
      </button>

      {/* Solid, full-height panel so page content never shows through the menu. */}
      <nav
        id="mobile-nav"
        aria-label="Mobile navigation"
        hidden={!open}
        data-state={open ? 'open' : 'closed'}
        className="mobile-nav-panel absolute inset-x-0 top-full h-[calc(100dvh-60px)] overflow-y-auto overscroll-contain border-t border-white/10 bg-[#0a0b0c] text-white md:h-[calc(100dvh-64px)] lg:hidden"
      >
        <div className="mx-auto flex min-h-full max-w-xl flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">
          <ul className="divide-y divide-white/10">
            {NAV_LINKS.map((item, index) => {
              const active = isNavLinkActive(pathname, item.href)

              return (
                <li key={item.href}>
                  <Link
                    ref={index === 0 ? firstMobileLinkRef : null}
                    href={item.href}
                    onClick={() => handleMobileLinkClick(item.label)}
                    aria-current={active ? 'page' : undefined}
                    className={clsx(
                      'brand-label flex items-center justify-between py-4 text-[0.95rem] outline-none transition',
                      'focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-amber-400/80',
                      active ? 'text-amber-300' : 'text-white/90 hover:text-amber-400'
                    )}
                  >
                    {item.label}
                    <ChevronRight
                      size={18}
                      aria-hidden="true"
                      className={active ? 'text-amber-300' : 'text-white/35'}
                    />
                  </Link>
                </li>
              )
            })}
          </ul>

          <div className="mt-6 space-y-3">
            <Link
              href="/quote"
              onClick={(event) => handleMobileQuoteClick(event, 'mobile_menu')}
              className="btn btn-primary btn-md w-full"
            >
              <span>Get Instant Price</span>
            </Link>
            <div className="grid grid-cols-2 gap-3">
              <a
                href={`tel:${PHONE_NUMBER}`}
                aria-label={`Call ${PHONE_DISPLAY}`}
                onClick={() => {
                  trackEvent('phone_click', { location: 'mobile_menu' })
                  setOpen(false)
                }}
                className="btn btn-outline btn-md w-full gap-2"
              >
                <Phone size={18} aria-hidden="true" />
                <span>Call</span>
              </a>
              <a
                href={`sms:${PHONE_NUMBER}`}
                aria-label={`Text ${PHONE_DISPLAY}`}
                onClick={() => {
                  trackEvent('text_click', { location: 'mobile_menu' })
                  setOpen(false)
                }}
                className="btn btn-outline btn-md w-full gap-2"
              >
                <MessageSquareText size={18} aria-hidden="true" />
                <span>Text</span>
              </a>
            </div>
            <p className="pt-1 text-center text-xs tabular-nums text-white/50">{PHONE_DISPLAY}</p>
          </div>
        </div>
      </nav>
    </>
  )
}
