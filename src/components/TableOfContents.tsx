'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styles from './TableOfContents.module.css'

export interface Heading {
  id: string
  text: string
  level: number
}

export default function TableOfContents({ headings }: { headings: Heading[] }) {
  // Smarter default: open when there are many sections
  const [open, setOpen] = useState(() => (headings?.length ?? 0) >= 3 ? true : false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const ids = useMemo(() => headings.map((h) => h.id), [headings])

  useEffect(() => {
    if (!ids.length || typeof window === 'undefined') return

    const options: IntersectionObserverInit = {
      root: null,
      // Trigger when a heading enters roughly the middle of the viewport
      rootMargin: '-40% 0px -55% 0px',
      threshold: [0, 1.0],
    }
    const observer = new IntersectionObserver((entries) => {
      // Prefer the entry closest to the top that is intersecting
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => (a.boundingClientRect.top > b.boundingClientRect.top ? 1 : -1))
      if (visible[0]) setActiveId(visible[0].target.id)
    }, options)
    observerRef.current = observer

    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => {
      observer.disconnect()
      observerRef.current = null
    }
  }, [ids])

  const onJump = useCallback((id: string, e: React.MouseEvent<HTMLAnchorElement>) => {
    if (typeof window === 'undefined') return
    e.preventDefault()
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      // Keep URL tidy without page jump
      try {
        history.replaceState(null, '', `#${id}`)
      } catch {}
    }
  }, [])

  if (!headings.length) return null

  return (
    <nav
      className={`${styles.toc} interior-card mb-6 p-5`}
      aria-label="Table of Contents"
    >
      <button
        type="button"
        className={`${styles.toggle} mb-2 flex w-full items-center justify-between text-[var(--foreground)]`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="brand-subheading">Table of Contents</span>
        <span className="brand-button text-xs text-[var(--text-muted)]">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <>
          <ul className={styles.list}>
            {headings.map((h) => {
              const isActive = activeId === h.id
              const itemClassName = h.level === 3 ? `${styles.item} ${styles.level3}` : styles.item
              const linkClassName = isActive ? `${styles.link} ${styles.activeLink}` : styles.link

              return (
                <li key={h.id} className={itemClassName}>
                  <a
                    className={linkClassName}
                    href={`#${h.id}`}
                    aria-current={isActive ? 'true' : undefined}
                    onClick={(e) => onJump(h.id, e)}
                  >
                    {h.text}
                  </a>
                </li>
              )
            })}
          </ul>
          {headings.length >= 2 && (
            <div className="mt-3 border-t border-[var(--border-color)] pt-3">
              <a
                href="#top"
                onClick={(e) => {
                  if (typeof window === 'undefined') return
                  e.preventDefault()
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="brand-button text-xs text-[var(--text-muted)] hover:underline"
              >
                Back to top
              </a>
            </div>
          )}
        </>
      )}
    </nav>
  )
}
