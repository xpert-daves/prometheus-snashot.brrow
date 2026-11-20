'use client'
import { ReactNode } from 'react'
import { smoothEase, smoothViewport, useRevealInView } from '@/lib/motion'

export default function FadeIn({ children }: { children: ReactNode }) {
  const { ref, visible } = useRevealInView<HTMLDivElement>(smoothViewport)

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0px)' : 'translateY(24px)',
        filter: visible ? 'blur(0px)' : 'blur(8px)',
        transition: `opacity 0.85s ${smoothEase}, transform 0.85s ${smoothEase}, filter 0.85s ${smoothEase}`,
      }}
    >
      {children}
    </div>
  )
}
