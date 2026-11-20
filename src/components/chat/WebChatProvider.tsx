'use client'

import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { trackEvent } from '@/lib/analytics'
import {
  fetchChatConfig,
  getChatBaseUrl,
  readStoredChatSession,
  type ChatConfig,
} from '@/lib/webChatClient'
import ChatLauncher from './ChatLauncher'

const ChatPanel = lazy(() => import('./ChatPanel'))

/** Config is fetched after the page settles so chat never competes with LCP. */
const DEFAULT_CONFIG_DELAY_MS = 1200
const CONFIG_CACHE_MS = 5 * 60_000

type WebChatContextValue = {
  /** True only when the CRM says chat is on and answered `/config`. */
  available: boolean
  /** True when this browser has an earlier chat it can resume. */
  resumable: boolean
  openChat: (location: string) => void
}

const WebChatContext = createContext<WebChatContextValue>({
  available: false,
  resumable: false,
  openChat: () => {},
})

/** Outside the provider (or with chat off) callers keep their non-chat fallback. */
export function useWebChatAvailability(): WebChatContextValue {
  return useContext(WebChatContext)
}

let cachedConfig: { config: ChatConfig; at: number } | null = null

/** Test hook: forget the module-level config cache. */
export function resetWebChatConfigCache() {
  cachedConfig = null
}

export default function WebChatProvider({
  children,
  configDelayMs = DEFAULT_CONFIG_DELAY_MS,
}: {
  children: ReactNode
  configDelayMs?: number
}) {
  const [config, setConfig] = useState<ChatConfig | null>(null)
  const [open, setOpen] = useState(false)
  const [resumable, setResumable] = useState(false)

  useEffect(() => {
    if (!getChatBaseUrl()) return
    setResumable(readStoredChatSession() !== null)

    if (cachedConfig && Date.now() - cachedConfig.at < CONFIG_CACHE_MS) {
      setConfig(cachedConfig.config)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      fetchChatConfig()
        .then((result) => {
          cachedConfig = { config: result, at: Date.now() }
          if (!cancelled) setConfig(result)
        })
        .catch(() => {
          // Unreachable CRM: chat stays hidden and the Text button stays.
        })
    }, configDelayMs)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [configDelayMs])

  const available = Boolean(config?.enabled)

  const openChat = useCallback(
    (location: string) => {
      if (!available) return
      trackEvent('chat_opened', { location })
      setOpen(true)
    },
    [available]
  )

  const closeChat = useCallback(() => {
    setOpen(false)
    setResumable(readStoredChatSession() !== null)
  }, [])

  const value = useMemo(
    () => ({ available, resumable, openChat }),
    [available, resumable, openChat]
  )

  return (
    <WebChatContext.Provider value={value}>
      {children}
      {/* Stays mounted under the open panel so focus can return to it on close. */}
      {available ? (
        <ChatLauncher
          resumable={resumable}
          onOpen={() => openChat('desktop_launcher')}
        />
      ) : null}
      {available && open && config ? (
        <Suspense fallback={null}>
          <ChatPanel config={config} onClose={closeChat} />
        </Suspense>
      ) : null}
    </WebChatContext.Provider>
  )
}
