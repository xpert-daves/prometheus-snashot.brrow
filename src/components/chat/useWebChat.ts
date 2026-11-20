'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { trackEvent } from '@/lib/analytics'
import {
  buildPageContext,
  clearStoredChatSession,
  fetchChatMessages,
  getTurnstileToken,
  readStoredChatSession,
  sendChatMessage,
  shareChatContact,
  startChat,
  WebChatError,
  writeStoredChatSession,
  type ChatContact,
  type ChatMessage,
  type ChatMessagesResult,
  type StoredChatSession,
} from '@/lib/webChatClient'

export const CHAT_POLL_VISIBLE_MS = 2_000
export const CHAT_POLL_HIDDEN_MS = 15_000
const CHAT_POLL_MAX_MS = 30_000

export type ChatErrorKind = 'closed' | 'busy' | 'check' | 'contact' | 'network'

export type DisplayMessage = ChatMessage & { pending?: boolean }

function errorKind(error: unknown): ChatErrorKind {
  if (error instanceof WebChatError) {
    if (error.code === 'closed' || error.status === 503) return 'closed'
    if (error.code === 'busy' || error.status === 429) return 'busy'
    if (error.code === 'check') return 'check'
    if (error.code === 'contact') return 'contact'
  }
  return 'network'
}

function isExpiredToken(error: unknown): boolean {
  return error instanceof WebChatError && (error.status === 401 || error.code === 'token')
}

function currentPage() {
  if (typeof window === 'undefined') return { pageUrl: '', pageTitle: '', pathname: '' }
  // Origin + path only: query strings and fragments can carry personal data.
  const { origin, pathname } = window.location
  return { pageUrl: `${origin}${pathname}`, pageTitle: document.title, pathname }
}

/** Merges server messages by id, replacing any optimistic copy. */
export function mergeChatMessages(
  previous: readonly DisplayMessage[],
  incoming: readonly ChatMessage[]
): DisplayMessage[] {
  if (incoming.length === 0) return previous as DisplayMessage[]
  const byId = new Map(previous.map((message) => [message.id, message]))
  for (const message of incoming) byId.set(message.id, message)
  return Array.from(byId.values()).sort((a, b) => {
    // Optimistic messages stay last until the server copy replaces them.
    if (a.pending !== b.pending) return a.pending ? 1 : -1
    return a.createdAt - b.createdAt
  })
}

export function useWebChat({
  active,
  turnstileRef,
}: {
  active: boolean
  turnstileRef: RefObject<HTMLElement | null>
}) {
  const [session, setSession] = useState<StoredChatSession | null>(() => readStoredChatSession())
  const [resumed] = useState(() => session !== null)
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [typing, setTyping] = useState(false)
  const [askContact, setAskContact] = useState(false)
  const [error, setError] = useState<ChatErrorKind | null>(null)
  const [sending, setSending] = useState(false)
  const sessionRef = useRef(session)
  const afterRef = useRef<number | null>(null)
  const pokeRef = useRef<() => void>(() => {})
  const localIdRef = useRef(0)

  const applySession = useCallback((next: StoredChatSession | null) => {
    sessionRef.current = next
    setSession(next)
    if (next) writeStoredChatSession(next)
    else clearStoredChatSession()
  }, [])

  const resetConversation = useCallback(() => {
    applySession(null)
    afterRef.current = null
    setMessages([])
    setTyping(false)
    setAskContact(false)
  }, [applySession])

  const applyResult = useCallback((result: ChatMessagesResult) => {
    for (const message of result.messages) {
      if (afterRef.current === null || message.createdAt > afterRef.current) {
        afterRef.current = message.createdAt
      }
    }
    setMessages((previous) => mergeChatMessages(previous, result.messages))
    setTyping(result.typing)
    setAskContact(result.askContact)
  }, [])

  // Poll while the panel is open: every 2 s when the tab is visible, slower
  // when hidden, backing off on errors. The polls double as presence.
  const token = session?.token ?? null
  useEffect(() => {
    if (!active || !token) return

    let cancelled = false
    let inFlight = false
    let failures = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    const schedule = () => {
      if (cancelled) return
      const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
      const base = hidden ? CHAT_POLL_HIDDEN_MS : CHAT_POLL_VISIBLE_MS
      timer = setTimeout(tick, Math.min(CHAT_POLL_MAX_MS, base * 2 ** failures))
    }

    async function tick() {
      if (cancelled || inFlight) return
      if (timer) clearTimeout(timer)
      timer = null
      inFlight = true
      try {
        const result = await fetchChatMessages({ token: token!, after: afterRef.current })
        if (cancelled) return
        failures = 0
        applyResult(result)
      } catch (caught) {
        if (cancelled) return
        if (isExpiredToken(caught)) {
          resetConversation()
          return
        }
        failures = Math.min(failures + 1, 4)
      } finally {
        inFlight = false
      }
      schedule()
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void tick()
    }

    pokeRef.current = () => void tick()
    document.addEventListener('visibilitychange', onVisibility)
    void tick()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      pokeRef.current = () => {}
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [active, token, applyResult, resetConversation])

  const beginSession = useCallback(async (): Promise<StoredChatSession> => {
    const { pageUrl, pageTitle } = currentPage()
    const turnstileToken = await getTurnstileToken(turnstileRef.current)
    const started = await startChat({ turnstileToken, pageUrl, pageTitle })
    const next = { token: started.token, contactShared: false }
    afterRef.current = null
    applySession(next)
    return next
  }, [applySession, turnstileRef])

  const send = useCallback(
    async (text: string): Promise<boolean> => {
      const body = text.trim()
      if (!body || sending) return false

      setSending(true)
      setError(null)
      localIdRef.current += 1
      const localId = `local-${localIdRef.current}`
      setMessages((previous) => [
        ...previous,
        { id: localId, author: 'visitor', body, createdAt: Date.now(), pending: true },
      ])

      const { pageUrl, pageTitle, pathname } = currentPage()
      const deliver = (current: StoredChatSession) =>
        sendChatMessage({
          token: current.token,
          body,
          pageUrl,
          pageTitle,
          pageContext: buildPageContext(pathname, pageTitle),
        })

      try {
        let current = sessionRef.current ?? (await beginSession())
        let result: { messageId: string }
        try {
          result = await deliver(current)
        } catch (caught) {
          if (!isExpiredToken(caught)) throw caught
          // The stored chat expired on the CRM: start a fresh one once.
          current = await beginSession()
          result = await deliver(current)
        }

        setMessages((previous) => {
          if (!result.messageId || previous.some((message) => message.id === result.messageId)) {
            return previous.filter((message) => message.id !== localId)
          }
          return previous.map((message) =>
            message.id === localId ? { ...message, id: result.messageId, pending: false } : message
          )
        })
        trackEvent('chat_message_sent', { location: 'chat_panel' })
        pokeRef.current()
        return true
      } catch (caught) {
        setMessages((previous) => previous.filter((message) => message.id !== localId))
        setError(errorKind(caught))
        return false
      } finally {
        setSending(false)
      }
    },
    [beginSession, sending]
  )

  const shareContact = useCallback(
    async (contact: ChatContact): Promise<boolean> => {
      const current = sessionRef.current
      if (!current) return false
      setError(null)
      try {
        await shareChatContact({ ...contact, token: current.token, pageUrl: currentPage().pageUrl })
      } catch (caught) {
        if (isExpiredToken(caught)) resetConversation()
        setError(errorKind(caught))
        return false
      }
      applySession({ ...current, contactShared: true })
      setAskContact(false)
      trackEvent('chat_contact_shared', {
        location: 'chat_panel',
        category: contact.smsConsent ? 'sms_consent' : 'no_sms_consent',
      })
      pokeRef.current()
      return true
    },
    [applySession, resetConversation]
  )

  return {
    hasSession: session !== null,
    contactShared: session?.contactShared ?? false,
    resumed,
    messages,
    typing,
    askContact,
    error,
    sending,
    send,
    shareContact,
    startOver: resetConversation,
    clearError: () => setError(null),
  }
}
