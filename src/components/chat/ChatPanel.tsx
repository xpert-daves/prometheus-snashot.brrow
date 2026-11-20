'use client'

import Link from 'next/link'
import { RotateCcw, SendHorizontal, X } from 'lucide-react'
import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { PHONE_DISPLAY, PHONE_NUMBER } from '@/lib/contact'
import { CHAT_MESSAGE_MAX_LENGTH, loadTurnstile, type ChatConfig } from '@/lib/webChatClient'
import ContactCard from './ContactCard'
import { useWebChat, type ChatErrorKind, type DisplayMessage } from './useWebChat'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

const ERROR_COPY: Record<ChatErrorKind, string> = {
  closed: `Chat is closed right now. Call or text ${PHONE_DISPLAY} and we will help.`,
  busy: 'Lots of chats right now. Give it a minute and try again.',
  check: 'We could not verify this browser. Try again, or call us.',
  contact: 'Check your name, phone and email, then try again.',
  network: 'Message not sent. Check your connection and try again.',
}

const URL_PATTERN = /(https?:\/\/[^\s<>"')]+)/g

/** Renders plain text with http(s) links made clickable; nothing else is parsed. */
function linkify(body: string): ReactNode[] {
  return body.split(URL_PATTERN).map((part, index) => {
    if (index % 2 === 0) return <Fragment key={index}>{part}</Fragment>
    const trailing = part.match(/[.,!?;:]+$/)?.[0] ?? ''
    const href = trailing ? part.slice(0, -trailing.length) : part
    let sameSite = false
    try {
      sameSite = new URL(href).host === window.location.host
    } catch {
      return <Fragment key={index}>{part}</Fragment>
    }
    return (
      <Fragment key={index}>
        <a
          href={href}
          {...(sameSite ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
          className="underline underline-offset-2 [overflow-wrap:anywhere]"
        >
          {href}
        </a>
        {trailing}
      </Fragment>
    )
  })
}

function MessageBubble({ message, businessName }: { message: DisplayMessage; businessName: string }) {
  if (message.author === 'system') {
    return (
      <li className="mx-auto max-w-[90%] text-center text-xs leading-snug text-white/50">
        {message.body}
      </li>
    )
  }
  const mine = message.author === 'visitor'
  return (
    <li className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
      <span className="sr-only">{mine ? 'You' : businessName}: </span>
      <p
        className={`m-0 max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[15px] leading-snug md:text-sm ${
          mine
            ? 'rounded-br-md bg-[var(--accent)] text-[var(--accent-contrast)]'
            : 'rounded-bl-md border border-white/8 bg-[#1b1c1f] text-white/90'
        } ${message.pending ? 'opacity-70' : ''}`}
      >
        {mine ? message.body : linkify(message.body)}
      </p>
    </li>
  )
}

function TypingIndicator({ businessName }: { businessName: string }) {
  return (
    <li className="flex items-start" aria-label={`${businessName} is typing`}>
      <span className="flex gap-1 rounded-2xl rounded-bl-md border border-white/8 bg-[#1b1c1f] px-3.5 py-3">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            aria-hidden="true"
            style={{ animationDelay: `${delay}ms` }}
            className="size-1.5 animate-bounce rounded-full bg-white/60 motion-reduce:animate-none"
          />
        ))}
      </span>
    </li>
  )
}

/**
 * The chat dialog: a full-screen sheet on phones and a 380×600 card in the
 * bottom-right corner from md up. Portal + focus trap + Escape follow
 * QuoteActionSheet; focus returns to whatever opened it.
 */
export default function ChatPanel({ config, onClose }: { config: ChatConfig; onClose: () => void }) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const turnstileRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState('')
  const [contactDismissed, setContactDismissed] = useState(false)
  const [contactRequested, setContactRequested] = useState(false)
  const chat = useWebChat({ active: true, turnstileRef })

  const businessName = config.businessName || 'Shed210'
  const greeting = config.greeting.trim() || `Hi! Ask us anything about sheds, sizes, pricing or delivery.`
  const greetingFromServer = chat.messages.some(
    (message) => message.author === 'assistant' && message.body.trim() === greeting
  )
  const showContactCard =
    chat.hasSession &&
    !chat.contactShared &&
    (contactRequested || (chat.askContact && !contactDismissed))

  // Focus, scroll lock on phones, focus return, and warming Turnstile up.
  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    inputRef.current?.focus({ preventScroll: true })
    void loadTurnstile()

    const phone =
      typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 767px)').matches
    const previousOverflow = document.body.style.overflow
    if (phone) document.body.style.overflow = 'hidden'

    return () => {
      if (phone) document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])

  // A new askContact turn re-shows a card the visitor dismissed earlier.
  useEffect(() => {
    if (!chat.askContact) setContactDismissed(false)
  }, [chat.askContact])

  // Keep the newest message in view.
  const messageCount = chat.messages.length
  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messageCount, chat.typing, showContactCard])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!first || !last) return
    const active = document.activeElement
    if (event.shiftKey && (active === first || active === panelRef.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const submit = async () => {
    const text = draft.trim()
    if (!text || chat.sending) return
    setDraft('')
    const ok = await chat.send(text)
    if (!ok) setDraft(text)
    inputRef.current?.focus({ preventScroll: true })
  }

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void submit()
    }
  }

  const panel = (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      data-site-chrome="site"
      className="fixed inset-0 z-[65] flex h-[100dvh] flex-col bg-[#0b0c0d] text-white outline-none motion-safe:animate-[chat-in_0.22s_ease-out_both] md:inset-auto md:bottom-6 md:right-6 md:h-[600px] md:max-h-[calc(100dvh-3rem)] md:w-[380px] md:overflow-hidden md:rounded-2xl md:border md:border-white/10 md:shadow-[0_28px_70px_rgba(0,0,0,0.6)]"
    >
      <header className="flex items-center gap-3 border-b border-white/10 bg-[#111214] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:pt-3">
        <span aria-hidden="true" className="relative flex size-2.5">
          <span className="absolute inset-0 rounded-full bg-emerald-400/60 motion-safe:animate-ping" />
          <span className="relative size-2.5 rounded-full bg-emerald-400" />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id={titleId}
            className="m-0 truncate font-[family-name:var(--font-heading)] text-lg uppercase leading-tight tracking-wide"
          >
            Chat with {businessName}
          </h2>
          <p className="m-0 truncate text-xs text-white/55">Sizes, pricing, delivery and more</p>
        </div>
        {chat.hasSession ? (
          <button
            type="button"
            onClick={() => {
              chat.startOver()
              setContactRequested(false)
            }}
            aria-label="Start a new chat"
            title="Start a new chat"
            className="flex size-10 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/8 hover:text-white"
          >
            <RotateCcw size={17} aria-hidden="true" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="flex size-10 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/8 hover:text-white"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <ol role="log" aria-live="polite" aria-label="Chat messages" className="m-0 flex list-none flex-col gap-2.5 p-0">
          {greetingFromServer ? null : (
            <MessageBubble
              businessName={businessName}
              message={{ id: 'greeting', author: 'assistant', body: greeting, createdAt: 0 }}
            />
          )}
          {chat.resumed && chat.messages.length > 0 ? (
            <li className="text-center text-[11px] uppercase tracking-[0.14em] text-white/40">
              Picking up where you left off
            </li>
          ) : null}
          {chat.messages.map((message) => (
            <MessageBubble key={message.id} message={message} businessName={businessName} />
          ))}
          {chat.typing ? <TypingIndicator businessName={businessName} /> : null}
        </ol>
        {showContactCard ? (
          <div className="mt-3">
            <ContactCard
              onSubmit={async (contact) => {
                const ok = await chat.shareContact(contact)
                if (ok) setContactRequested(false)
                return ok
              }}
              onDismiss={() => {
                setContactDismissed(true)
                setContactRequested(false)
              }}
            />
          </div>
        ) : null}
        {chat.hasSession && !chat.contactShared && !showContactCard ? (
          <button
            type="button"
            onClick={() => setContactRequested(true)}
            className="mt-3 block w-full text-center text-xs text-[var(--accent-light)] underline underline-offset-2"
          >
            Leave your number or email
          </button>
        ) : null}
      </div>

      <div className="border-t border-white/10 bg-[#111214] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5">
        <div ref={turnstileRef} className="empty:hidden mb-2 flex justify-center" />
        {chat.error ? (
          <p role="alert" className="m-0 mb-2 text-xs leading-snug text-[#ff9b8a]">
            {ERROR_COPY[chat.error]}
            {chat.error === 'closed' ? (
              <>
                {' '}
                <a href={`tel:${PHONE_NUMBER}`} className="underline underline-offset-2">
                  Call
                </a>{' '}
                or{' '}
                <a href={`sms:${PHONE_NUMBER}`} className="underline underline-offset-2">
                  text
                </a>
              </>
            ) : null}
          </p>
        ) : null}
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
          className="flex items-end gap-2"
        >
          <label className="sr-only" htmlFor={`${titleId}-input`}>
            Message
          </label>
          <textarea
            id={`${titleId}-input`}
            ref={inputRef}
            rows={1}
            value={draft}
            maxLength={CHAT_MESSAGE_MAX_LENGTH}
            placeholder="Type a message…"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-white/12 bg-[#0d0e10] px-3.5 py-2.5 text-base text-white placeholder:text-white/35 outline-none [field-sizing:content] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/30 md:text-sm"
          />
          <button
            type="submit"
            disabled={!draft.trim() || chat.sending}
            aria-label="Send message"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] transition-[opacity,background-color] hover:bg-[var(--accent-hover)] disabled:opacity-40"
          >
            <SendHorizontal size={18} aria-hidden="true" />
          </button>
        </form>
        <p className="m-0 mt-2 text-center text-[10.5px] leading-snug text-white/40">
          Replies may come from our AI assistant or the {businessName} team.{' '}
          <Link href="/privacy-policy" className="underline underline-offset-2 hover:text-white/70">
            Privacy
          </Link>
        </p>
      </div>
    </div>
  )

  return typeof document === 'undefined' ? panel : createPortal(panel, document.body)
}
