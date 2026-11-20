"use client"

import Image from "next/image"
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react"
import clsx from "clsx"
import { portfolioProjects, type PortfolioProject } from "@/lib/portfolio"

export default function GalleryGrid({ items: itemsProp }: { items?: readonly PortfolioProject[] }) {
  const items = itemsProp ?? portfolioProjects
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  const open = useCallback((i: number) => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    setOpenIndex(i)
  }, [])
  const close = useCallback(() => setOpenIndex(null), [])
  const next = useCallback(() => {
    setOpenIndex((prev) => {
      if (prev === null) return prev
      return (prev + 1) % items.length
    })
  }, [items.length])
  const prev = useCallback(() => {
    setOpenIndex((current) => {
      if (current === null) return current
      return (current - 1 + items.length) % items.length
    })
  }, [items.length])

  return (
    <div>
      <ul
        className={clsx(
          "grid gap-3 sm:gap-4",
          "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
        )}
        aria-label="Project gallery"
        role="list"
      >
        {items.map(({ src, alt, caption, city, projectType }, i) => (
          <li key={src} className="relative">
            <button
              type="button"
              onClick={() => open(i)}
              className={clsx(
                "group relative block w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 shadow-[0_18px_42px_-32px_rgba(0,0,0,0.9)]",
                "transition duration-300 ease-out hover:-translate-y-1 hover:border-amber-400/30 active:scale-[0.98]"
              )}
              aria-label={`Open ${caption || alt}`}
            >
              <div className="relative aspect-[4/3]">
                <Image
                  src={src}
                  alt={alt}
                  fill
                  className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05] group-focus-visible:scale-[1.05]"
                  sizes="(max-width: 639px) calc((100vw - 88px) / 2), (max-width: 1023px) calc((100vw - 104px) / 3), (max-width: 1279px) calc((100vw - 116px) / 4), 269px"
                  quality={60}
                  placeholder="empty"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent opacity-0 transition-opacity duration-400 group-hover:opacity-100 group-focus-visible:opacity-100" />
                <div className="pointer-events-none absolute inset-x-2 bottom-2">
                  <span className="motif-spec inline-block translate-y-2 rounded-full bg-black/65 px-3 py-1.5 text-[0.58rem] text-white opacity-0 ring-1 ring-white/15 backdrop-blur-sm transition-all duration-400 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                    {caption || [city, projectType].filter(Boolean).join(" - ") || alt}
                  </span>
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {openIndex !== null && (
        <Lightbox
          index={openIndex}
          items={items}
          onClose={close}
          onNext={next}
          onPrev={prev}
          returnFocusRef={returnFocusRef}
        />
      )}
    </div>
  )
}

function Lightbox({
  index,
  items,
  onClose,
  onPrev,
  onNext,
  returnFocusRef,
}: {
  index: number
  items: readonly PortfolioProject[]
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  returnFocusRef: RefObject<HTMLElement | null>
}) {
  const item = useMemo(() => items[index], [items, index])
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const instructionsId = useId()

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const returnFocusTarget = returnFocusRef.current
    document.body.style.overflow = "hidden"
    const focusFrame = window.requestAnimationFrame(() =>
      closeButtonRef.current?.focus()
    )

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key === "ArrowRight") {
        event.preventDefault()
        onNext()
        return
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault()
        onPrev()
        return
      }

      if (event.key !== "Tab") return

      const dialog = dialogRef.current
      if (!dialog) return
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        )
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", onKeyDown)

    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previousOverflow
      window.requestAnimationFrame(() => returnFocusTarget?.focus())
    }
  }, [onClose, onNext, onPrev, returnFocusRef])

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={instructionsId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <p id={instructionsId} className="sr-only">
        Photo {index + 1} of {items.length}. Use the Previous and Next
        buttons or the left and right arrow keys to browse. Press Escape to
        close.
      </p>

      <figure className="relative z-10 w-full max-w-5xl">
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-black/40 ring-1 ring-white/10 sm:aspect-[16/9] lg:aspect-[16/8]">
          <Image
            src={item.src}
            alt={item.alt}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 100vw, 80vw"
            quality={75}
            priority
          />
        </div>
        <figcaption className="mx-auto mt-3 max-w-3xl text-center text-sm text-white/85">
          <h2 id={titleId} className="brand-subheading mb-0 text-base text-white">
            {item.caption || item.alt}
          </h2>
          <span className="mt-1 block">
            {[
              `${index + 1} of ${items.length}`,
              item.city,
              item.size && item.useCase ? `${item.size} for ${item.useCase}` : null,
              item.features?.length ? `Features: ${item.features.join(", ")}` : null,
            ]
              .filter(Boolean)
              .join(". ")}
          </span>
        </figcaption>
      </figure>

      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        aria-label="Close photo viewer"
        className="absolute right-3 top-3 grid h-10 w-10 place-content-center rounded-full bg-slate-900/80 ring-1 ring-white/15 backdrop-blur-md transition hover:scale-105 active:scale-95 sm:right-6 sm:top-6"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-5 w-5 text-amber-400"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <button
        type="button"
        onClick={onPrev}
        aria-label="Previous photo"
        className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-content-center rounded-full bg-slate-900/80 ring-1 ring-white/15 backdrop-blur-md transition hover:scale-105 active:scale-95 sm:left-6"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 text-amber-400" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <button
        type="button"
        onClick={onNext}
        aria-label="Next photo"
        className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-content-center rounded-full bg-slate-900/80 ring-1 ring-white/15 backdrop-blur-md transition hover:scale-105 active:scale-95 sm:right-6"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 text-amber-400" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}
