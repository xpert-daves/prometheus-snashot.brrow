import Link from 'next/link'
import Image from 'next/image'
import { MessageSquareText, Phone } from 'lucide-react'
import { PHONE_DISPLAY, PHONE_NUMBER } from '@/lib/contact'
import DesktopNavLinks from './NavbarDesktopNav'
import MobileMenu from './NavbarMobileMenu'
import TrackedActionLink from './TrackedActionLink'

export default function Navbar() {
  return (
    <header
      data-site-chrome="site"
      className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0b0c]/95 font-sans shadow-[0_18px_45px_-30px_rgba(0,0,0,0.95)] backdrop-blur-xl supports-[backdrop-filter]:bg-[#0a0b0c]/85"
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:inset-x-0 focus:top-0 focus:z-[60] focus:m-2 focus:rounded-lg focus:bg-amber-500 focus:px-4 focus:py-2 focus:text-black"
      >
        Skip to content
      </a>

      <div className="relative">
        <div className="mx-auto flex h-[60px] max-w-[1200px] items-center justify-between gap-3 px-4 md:h-16">
          <div className="flex min-w-0 items-center gap-7 xl:gap-10">
            <Link href="/" aria-label="Shed210 Home" className="flex min-w-0 items-center gap-2">
              <Image
                src="/logos/nav-logo-shed210-horizontal-transparent.png"
                alt="Shed210"
                width={640}
                height={113}
                priority
                className="h-auto w-[min(40vw,9.5rem)] max-w-full select-none object-contain md:w-40 xl:w-44"
              />
            </Link>

            <DesktopNavLinks />
          </div>

          <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
            <div className="hidden h-10 items-center rounded-full border border-white/15 bg-white/[0.03] text-[0.72rem] text-white/80 xl:flex">
              <TrackedActionLink
                href={`tel:${PHONE_NUMBER}`}
                eventName="phone_click"
                eventProperties={{ location: 'site_header' }}
                aria-label={`Call ${PHONE_DISPLAY}`}
                className="brand-label flex h-full items-center gap-2 whitespace-nowrap rounded-l-full pl-4 pr-3 outline-none transition hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400/80"
              >
                <Phone size={14} aria-hidden="true" className="text-amber-400" />
                <span className="tabular-nums">{PHONE_DISPLAY}</span>
              </TrackedActionLink>
              <span className="h-4 w-px bg-white/15" aria-hidden="true" />
              <TrackedActionLink
                href={`sms:${PHONE_NUMBER}`}
                eventName="text_click"
                eventProperties={{ location: 'site_header' }}
                aria-label={`Text ${PHONE_DISPLAY}`}
                className="brand-label flex h-full items-center gap-2 whitespace-nowrap rounded-r-full pl-3 pr-4 outline-none transition hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400/80"
              >
                <MessageSquareText size={14} aria-hidden="true" className="text-amber-400" />
                Text
              </TrackedActionLink>
            </div>

            <TrackedActionLink
              href="/quote"
              eventName="quote_cta_clicked"
              eventProperties={{ location: 'site_header' }}
              className="brand-label hidden h-10 items-center gap-2 whitespace-nowrap rounded-full bg-amber-500 px-5 text-[0.72rem] text-black shadow-[0_14px_30px_-20px_rgba(255,122,26,0.9)] outline-none transition hover:bg-amber-400 focus-visible:ring-2 focus-visible:ring-amber-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black lg:inline-flex xl:text-[0.76rem]"
            >
              Get Instant Price
            </TrackedActionLink>

            <MobileMenu />
          </div>
        </div>
      </div>
    </header>
  )
}
