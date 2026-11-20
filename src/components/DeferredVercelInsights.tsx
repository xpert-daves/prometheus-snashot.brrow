'use client'

import { useEffect } from 'react'
import { loadVercelInsights } from '@/lib/vercelInsights'

const INTERACTION_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const

function deferUntilIdle(callback: () => void) {
  if (typeof window.requestIdleCallback === 'function') {
    const idleId = window.requestIdleCallback(callback, { timeout: 3500 })
    return () => window.cancelIdleCallback?.(idleId)
  }

  const timeoutId = setTimeout(callback, 2500)
  return () => clearTimeout(timeoutId)
}

export default function DeferredVercelInsights() {
  useEffect(() => {
    let cancelled = false

    const load = () => {
      if (cancelled) return
      void loadVercelInsights()
    }

    const cancelIdleLoad = deferUntilIdle(load)
    const listenerOptions = { once: true, passive: true } satisfies AddEventListenerOptions

    INTERACTION_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, load, listenerOptions)
    })

    return () => {
      cancelled = true
      cancelIdleLoad()
      INTERACTION_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, load)
      })
    }
  }, [])

  return null
}
