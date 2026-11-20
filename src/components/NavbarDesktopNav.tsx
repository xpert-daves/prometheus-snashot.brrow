'use client'

import Link from 'next/link'
import clsx from 'clsx'
import { usePathname } from 'next/navigation'
import { trackEvent } from '@/lib/analytics'
import { NAV_LINKS, isNavLinkActive } from '@/lib/navLinks'

export default function DesktopNavLinks() {
  const pathname = usePathname()

  return (
    <nav aria-label="Primary" className="brand-label hidden items-center gap-5 text-[0.7rem] text-white/78 lg:flex xl:gap-6 xl:text-[0.76rem]">
      {NAV_LINKS.map((item) => {
        const active = isNavLinkActive(pathname, item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => trackEvent('nav_link_clicked', { label: item.label })}
            aria-current={active ? 'page' : undefined}
            data-active={active ? 'true' : 'false'}
            className={clsx(
              'relative whitespace-nowrap py-2 outline-none transition',
              'focus-visible:ring-2 focus-visible:ring-amber-400/80 focus-visible:rounded',
              'active:scale-[0.98]',
              'after:absolute after:-bottom-1 after:left-0 after:h-[2px] after:w-0 after:bg-amber-400 after:transition-all',
              'hover:after:w-full',
              active && 'text-white after:w-full'
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
