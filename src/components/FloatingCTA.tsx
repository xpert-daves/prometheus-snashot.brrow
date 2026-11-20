'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { trackEvent } from '@/lib/analytics'
import { useScrollReveal } from '@/lib/useScrollReveal'

export default function FloatingCTA() {
  const pathname = usePathname()
  const visible = useScrollReveal()

  if (pathname === '/quote' || pathname === '/') return null

  return (
    // While hidden the button is only faded out, so the fixed wrapper must stop
    // taking clicks and focus itself; disabling just the inner div would leave a
    // transparent box that swallows clicks meant for the page underneath.
    <div
      inert={!visible}
      className={`hidden md:block fixed bottom-12 left-6 md:bottom-16 md:left-12 z-50 ${visible ? '' : 'pointer-events-none'}`}
    >
      <div
        style={{
          opacity: visible ? 1 : 0,
          transform: `translateY(${visible ? 0 : 20}px) scale(${visible ? 1 : 0.95})`,
          transition: 'opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="transition-transform hover:scale-[1.03] active:scale-[0.98]"
      >
        <Link
          href="/quote"
          onClick={() => trackEvent('quote_cta_clicked', { location: 'floating_cta' })}
          className="btn btn-primary btn-md shadow-lg"
        >
          Get Instant Price
        </Link>
      </div>
    </div>
  )
}
