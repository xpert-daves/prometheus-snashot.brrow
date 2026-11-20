'use client'

import { MessageCircle, MessageSquareText, Phone } from 'lucide-react'
import { PHONE_DISPLAY, PHONE_NUMBER } from '@/lib/contact'
import { useScrollReveal } from '@/lib/useScrollReveal'
import TrackedActionLink from './TrackedActionLink'
import { useWebChatAvailability } from './chat/WebChatProvider'

/**
 * Phone-only bottom bar so Call, Text and the quote are one thumb tap away on
 * every page; the header keeps the number in the menu below xl widths.
 * When website chat is on, Chat takes the Text slot; it falls back to Text
 * whenever the CRM says chat is off or cannot be reached.
 */
export default function MobileActionBar() {
  const visible = useScrollReveal()
  const chat = useWebChatAvailability()

  return (
    // Same rule as FloatingCTA: the hidden bar must not take taps meant for the page.
    <div
      inert={!visible}
      data-site-chrome="site"
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0a0b0c]/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-18px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-[transform,opacity] duration-300 ease-out supports-[backdrop-filter]:bg-[#0a0b0c]/85 md:hidden ${visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0'}`}
    >
      <nav aria-label="Contact Shed210" className="mx-auto grid max-w-md grid-cols-[1fr_1fr_1.5fr] gap-2">
        <TrackedActionLink
          href={`tel:${PHONE_NUMBER}`}
          eventName="phone_click"
          eventProperties={{ location: 'mobile_action_bar' }}
          aria-label={`Call ${PHONE_DISPLAY}`}
          className="btn btn-outline btn-sm h-11 gap-1.5"
        >
          <Phone size={16} aria-hidden="true" />
          <span>Call</span>
        </TrackedActionLink>
        {chat.available ? (
          <button
            type="button"
            onClick={() => chat.openChat('mobile_action_bar')}
            aria-label="Chat with Shed210"
            className="btn btn-outline btn-sm h-11 gap-1.5"
          >
            <MessageCircle size={16} aria-hidden="true" />
            <span>Chat</span>
          </button>
        ) : (
          <TrackedActionLink
            href={`sms:${PHONE_NUMBER}`}
            eventName="text_click"
            eventProperties={{ location: 'mobile_action_bar' }}
            aria-label={`Text ${PHONE_DISPLAY}`}
            className="btn btn-outline btn-sm h-11 gap-1.5"
          >
            <MessageSquareText size={16} aria-hidden="true" />
            <span>Text</span>
          </TrackedActionLink>
        )}
        <TrackedActionLink
          href="/quote"
          eventName="quote_cta_clicked"
          eventProperties={{ location: 'mobile_action_bar' }}
          className="btn btn-primary btn-sm h-11 whitespace-nowrap"
        >
          Instant Price
        </TrackedActionLink>
      </nav>
    </div>
  )
}
