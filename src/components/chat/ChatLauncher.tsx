'use client'

import { MessageCircle } from 'lucide-react'

/**
 * Desktop-only chat pill in the free bottom-right corner (FloatingCTA owns
 * bottom-left). Phones open chat from MobileActionBar instead.
 */
export default function ChatLauncher({
  resumable,
  onOpen,
}: {
  resumable: boolean
  onOpen: () => void
}) {
  return (
    <div data-site-chrome="site" className="fixed bottom-6 right-6 z-50 hidden md:block">
      <button
        type="button"
        onClick={onOpen}
        className="btn btn-primary btn-md gap-2 rounded-full shadow-[0_14px_36px_rgba(0,0,0,0.45)] transition-transform hover:scale-[1.03] active:scale-[0.98] motion-reduce:transition-none"
      >
        <MessageCircle size={18} aria-hidden="true" />
        <span>{resumable ? 'Continue chat' : 'Chat with us'}</span>
      </button>
    </div>
  )
}
