'use client'

import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import portfolio from '../../public/portfolio/portfolio.json'

type Item = { src: string; alt: string; caption?: string }
const items = portfolio as Item[]

export default function PortfolioCarousel() {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (items.length <= 1) return undefined

    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % items.length)
    }, 4000)

    return () => window.clearInterval(intervalId)
  }, [])

  const goToPrevious = () => {
    setActiveIndex((current) => (current - 1 + items.length) % items.length)
  }

  const goToNext = () => {
    setActiveIndex((current) => (current + 1) % items.length)
  }

  return (
    <div
      aria-label="Shed210 portfolio carousel"
      className="relative h-[320px] w-full overflow-hidden rounded-2xl ring-1 ring-white/10 md:h-[480px] lg:h-[520px]"
    >
      <div
        className="flex h-full transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${activeIndex * 100}%)` }}
      >
        {items.map(({ src, alt, caption }, i) => (
          <figure key={src} className="relative h-full w-full shrink-0 group">
            <div className="relative h-full w-full">
              <Image
                src={src}
                alt={alt}
                fill
                className="object-cover"
                quality={85}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) calc(100vw - 32px), 1100px"
                priority={i === 0}
                loading={i === 0 ? 'eager' : 'lazy'}
              />

              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/55 via-black/20 to-transparent" />
              <figcaption className="pointer-events-none absolute inset-x-3 bottom-3 sm:inset-x-4 sm:bottom-4 text-xs sm:text-sm">
                <span className="brand-label inline-block rounded-md bg-slate-900/70 px-2 py-1 text-[0.65rem] text-white backdrop-blur-sm ring-1 ring-white/15">
                  {caption || alt}
                </span>
              </figcaption>
            </div>
          </figure>
        ))}
      </div>

      {items.length > 1 && (
        <>
          <button
            type="button"
            onClick={goToPrevious}
            aria-label="Previous slide"
            className="absolute left-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-content-center rounded-full border border-white/15 bg-slate-900/70 text-amber-400 shadow transition hover:bg-slate-900/85"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={goToNext}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-content-center rounded-full border border-white/15 bg-slate-900/70 text-amber-400 shadow transition hover:bg-slate-900/85"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
    </div>
  )
}
