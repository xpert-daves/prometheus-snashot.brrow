'use client'

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import WebChatProvider from './chat/WebChatProvider'

const FloatingCTA = dynamic(() => import('./FloatingCTA'), {
  ssr: false,
  loading: () => null,
})

const MobileActionBar = dynamic(() => import('./MobileActionBar'), {
  ssr: false,
  loading: () => null,
})

export default function FloatingCTAGate() {
  const pathname = usePathname()

  if (pathname === '/quote' || pathname.startsWith('/admin') || pathname.startsWith('/review')) {
    return null
  }

  return (
    // Chat shows only when the CRM says it is on; MobileActionBar swaps its
    // Text button for Chat through the provider's context.
    <WebChatProvider>
      {/* The desktop hero already carries the price CTA; phones need Call/Text everywhere. */}
      {pathname !== '/' && <FloatingCTA />}
      <MobileActionBar />
    </WebChatProvider>
  )
}
