'use client'

import { useEffect, useState } from 'react'
import { rafThrottle } from './rafThrottle'

/** True once the page is scrolled past the hero and before the footer. */
export function useScrollReveal(): boolean {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const toggle = () => {
      const scrolledPast = window.scrollY > 200
      const nearBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 50
      setVisible(scrolledPast && !nearBottom)
    }
    const throttled = rafThrottle(toggle)
    window.addEventListener('scroll', throttled)
    throttled()
    return () => {
      window.removeEventListener('scroll', throttled)
      throttled.cancel()
    }
  }, [])

  return visible
}
