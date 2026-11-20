import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MobileActionBar from '../../MobileActionBar'
import WebChatProvider, { resetWebChatConfigCache } from '../WebChatProvider'
import {
  SMS_CHAT_CONSENT_TEXT,
  SMS_CHAT_CONSENT_TEXT_VERSION,
} from '@/lib/smsConsent'
import { CHAT_SESSION_STORAGE_KEY } from '@/lib/webChatClient'

const CHAT_URL = 'https://youthful-horse-290.convex.site'

type Reply = { status?: number; body: unknown }
type Handler = (body: Record<string, unknown>) => Reply | Promise<Reply>

let routes: Record<string, Handler>
let calls: Array<{ path: string; body: Record<string, unknown> }>

function installFetch() {
  calls = []
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
    calls.push({ path: url.pathname, body })
    const handler = routes[url.pathname]
    if (!handler) throw new Error(`unexpected fetch ${url.pathname}`)
    const reply = await handler(body)
    const status = reply.status ?? 200
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => reply.body,
    } as Response
  }) as jest.Mock
}

function callsTo(path: string) {
  return calls.filter((call) => call.path === `/api/web-chat/${path}`)
}

function enabledConfig(): Handler {
  return () => ({ body: { enabled: true, greeting: 'Howdy! What are you building?', businessName: 'Shed210' } })
}

function renderSite() {
  return render(
    <WebChatProvider configDelayMs={0}>
      <MobileActionBar />
    </WebChatProvider>
  )
}

async function openFromLauncher(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Chat with us' }))
  return screen.findByRole('dialog', { name: 'Chat with Shed210' })
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_CRM_CHAT_URL = CHAT_URL
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  resetWebChatConfigCache()
  localStorage.clear()
  routes = {}
  installFetch()
})

afterEach(() => {
  delete process.env.NEXT_PUBLIC_CRM_CHAT_URL
})

describe('website chat availability', () => {
  it('stays hidden and keeps the Text button when chat is not configured', async () => {
    delete process.env.NEXT_PUBLIC_CRM_CHAT_URL
    renderSite()
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
    expect(global.fetch).not.toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Text (855) 578-0944' })).toHaveAttribute(
      'href',
      'sms:+18555780944'
    )
    expect(screen.queryByRole('button', { name: /chat/i })).toBeNull()
  })

  it('stays hidden and keeps Text when the CRM says chat is off', async () => {
    routes['/api/web-chat/config'] = () => ({ body: { enabled: false, greeting: '', businessName: 'Shed210' } })
    renderSite()
    await waitFor(() => expect(callsTo('config')).toHaveLength(1))
    expect(screen.getByRole('link', { name: 'Text (855) 578-0944' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Chat with us' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Chat with Shed210' })).toBeNull()
  })

  it('stays hidden and keeps Text when the CRM cannot be reached', async () => {
    routes['/api/web-chat/config'] = () => {
      throw new Error('offline')
    }
    renderSite()
    await waitFor(() => expect(callsTo('config')).toHaveLength(1))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
    expect(screen.getByRole('link', { name: 'Text (855) 578-0944' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Chat with us' })).toBeNull()
  })

  it('swaps Text for Chat on the phone bar and shows the desktop launcher when on', async () => {
    routes['/api/web-chat/config'] = enabledConfig()
    const user = userEvent.setup()
    renderSite()

    const chatButton = await screen.findByRole('button', { name: 'Chat with Shed210' })
    expect(screen.queryByRole('link', { name: 'Text (855) 578-0944' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Chat with us' })).toBeInTheDocument()

    await user.click(chatButton)
    const dialog = await screen.findByRole('dialog', { name: 'Chat with Shed210' })
    expect(within(dialog).getByText('Howdy! What are you building?')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(chatButton).toHaveFocus()
  })
})

describe('website chat conversation', () => {
  beforeEach(() => {
    routes['/api/web-chat/config'] = enabledConfig()
    routes['/api/web-chat/start'] = () => ({ body: { token: 'tok-1', greeting: 'Howdy!' } })
    routes['/api/web-chat/send'] = () => ({ body: { ok: true, messageId: 'm1' } })
  })

  it('starts a session on the first message, sends it, and shows the reply from polling', async () => {
    let pollCount = 0
    routes['/api/web-chat/messages'] = () => {
      pollCount += 1
      if (pollCount === 1) return { body: { messages: [], typing: true, askContact: false } }
      return {
        body: {
          messages: [
            { id: 'm1', author: 'visitor', body: 'Do you deliver to Boerne?', createdAt: 1000 },
            { id: 'm2', author: 'assistant', body: 'We do! See https://shed210.com/quote.', createdAt: 2000 },
          ],
          typing: false,
          askContact: false,
        },
      }
    }

    const user = userEvent.setup()
    renderSite()
    const dialog = await openFromLauncher(user)
    await user.type(within(dialog).getByLabelText('Message'), 'Do you deliver to Boerne?{Enter}')

    await waitFor(() => expect(callsTo('send')).toHaveLength(1))
    expect(callsTo('start')[0].body).toEqual({
      turnstileToken: '',
      website: '',
      pageUrl: 'http://localhost/',
      pageTitle: '',
    })
    expect(callsTo('send')[0].body).toMatchObject({
      token: 'tok-1',
      body: 'Do you deliver to Boerne?',
      pageUrl: 'http://localhost/',
      pageContext: 'Page: /',
    })
    expect(JSON.parse(localStorage.getItem(CHAT_SESSION_STORAGE_KEY)!)).toEqual({
      token: 'tok-1',
      contactShared: false,
    })

    expect(await within(dialog).findByLabelText('Shed210 is typing')).toBeInTheDocument()
    expect(await within(dialog).findByText(/We do!/, {}, { timeout: 4000 })).toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Shed210 is typing')).toBeNull()
    expect(within(dialog).getAllByText('Do you deliver to Boerne?')).toHaveLength(1)
    expect(within(dialog).getByRole('link', { name: 'https://shed210.com/quote' })).toHaveAttribute(
      'href',
      'https://shed210.com/quote'
    )
    // Later polls ask only for messages newer than the last one seen.
    await waitFor(() => expect(callsTo('messages').length).toBeGreaterThanOrEqual(3), { timeout: 4000 })
    expect(callsTo('messages').at(-1)!.body).toEqual({ token: 'tok-1', after: 2000 })
  })

  it('includes the saved quote draft in the page context', async () => {
    localStorage.setItem(
      'quote-params',
      JSON.stringify({ structureType: 'storage_shed', length: '16', width: '12', name: 'Pat' })
    )
    routes['/api/web-chat/messages'] = () => ({ body: { messages: [], typing: false, askContact: false } })
    const user = userEvent.setup()
    renderSite()
    const dialog = await openFromLauncher(user)
    await user.type(within(dialog).getByLabelText('Message'), 'Hi{Enter}')
    await waitFor(() => expect(callsTo('send')).toHaveLength(1))
    expect(callsTo('send')[0].body.pageContext).toBe('Page: / | Saved quote: storage shed 16x12 ft')
  })

  it('tells the visitor when chat closed mid-visit and keeps their draft', async () => {
    routes['/api/web-chat/start'] = () => ({ status: 503, body: { error: 'closed' } })
    const user = userEvent.setup()
    renderSite()
    const dialog = await openFromLauncher(user)
    await user.type(within(dialog).getByLabelText('Message'), 'Hello?{Enter}')
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/Chat is closed right now/)
    expect(within(dialog).getByLabelText('Message')).toHaveValue('Hello?')
    expect(callsTo('send')).toHaveLength(0)
  })
})

describe('website chat contact card', () => {
  beforeEach(() => {
    localStorage.setItem(CHAT_SESSION_STORAGE_KEY, JSON.stringify({ token: 'tok-9', contactShared: false }))
    routes['/api/web-chat/config'] = enabledConfig()
    routes['/api/web-chat/messages'] = () => ({
      body: {
        messages: [{ id: 'a1', author: 'assistant', body: 'What is a good number to reach you?', createdAt: 5 }],
        typing: false,
        askContact: true,
      },
    })
    routes['/api/web-chat/contact'] = () => ({ body: { ok: true } })
  })

  it('shows the card when the CRM asks and sends no consent while the box is unticked', async () => {
    const user = userEvent.setup()
    renderSite()
    await user.click(await screen.findByRole('button', { name: 'Continue chat' }))
    const card = await screen.findByRole('form', { name: 'Share your contact info' })
    const consent = within(card).getByRole('checkbox')
    expect(consent).not.toBeChecked()

    await user.type(within(card).getByLabelText('Name'), 'Pat Rivera')
    await user.type(within(card).getByLabelText('Phone'), '2105550142')
    await user.click(within(card).getByRole('button', { name: 'Share' }))

    await waitFor(() => expect(callsTo('contact')).toHaveLength(1))
    expect(callsTo('contact')[0].body).toEqual({
      token: 'tok-9',
      pageUrl: 'http://localhost/',
      name: 'Pat Rivera',
      phone: '+12105550142',
    })
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Share your contact info' })).toBeNull())
    expect(JSON.parse(localStorage.getItem(CHAT_SESSION_STORAGE_KEY)!).contactShared).toBe(true)
  })

  it('sends the exact displayed consent text and version only when ticked', async () => {
    const user = userEvent.setup()
    renderSite()
    await user.click(await screen.findByRole('button', { name: 'Continue chat' }))
    const card = await screen.findByRole('form', { name: 'Share your contact info' })
    const consent = within(card).getByRole('checkbox')
    const label = document.getElementById(consent.getAttribute('aria-describedby')!)!
    expect(label.textContent).toBe(SMS_CHAT_CONSENT_TEXT)

    await user.type(within(card).getByLabelText('Name'), 'Pat')
    await user.type(within(card).getByLabelText('Phone'), '(210) 555-0142')
    await user.type(within(card).getByLabelText('Email'), 'pat@example.com')
    await user.click(consent)
    await user.click(within(card).getByRole('button', { name: 'Share' }))

    await waitFor(() => expect(callsTo('contact')).toHaveLength(1))
    expect(callsTo('contact')[0].body).toEqual({
      token: 'tok-9',
      pageUrl: 'http://localhost/',
      name: 'Pat',
      phone: '+12105550142',
      email: 'pat@example.com',
      smsConsent: { text: SMS_CHAT_CONSENT_TEXT, version: SMS_CHAT_CONSENT_TEXT_VERSION },
    })
  })

  it('requires a phone number before accepting the SMS box', async () => {
    const user = userEvent.setup()
    renderSite()
    await user.click(await screen.findByRole('button', { name: 'Continue chat' }))
    const card = await screen.findByRole('form', { name: 'Share your contact info' })
    await user.type(within(card).getByLabelText('Name'), 'Pat')
    await user.type(within(card).getByLabelText('Email'), 'pat@example.com')
    await user.click(within(card).getByRole('checkbox'))
    await user.click(within(card).getByRole('button', { name: 'Share' }))
    expect(within(card).getByRole('alert')).toHaveTextContent('Add a phone number to get texts.')
    expect(callsTo('contact')).toHaveLength(0)
  })
})

describe('website chat resume', () => {
  beforeEach(() => {
    routes['/api/web-chat/config'] = enabledConfig()
  })

  it('reloads the earlier conversation from the stored token', async () => {
    localStorage.setItem(CHAT_SESSION_STORAGE_KEY, JSON.stringify({ token: 'tok-old', contactShared: true }))
    routes['/api/web-chat/messages'] = () => ({
      body: {
        messages: [
          { id: 'v1', author: 'visitor', body: 'Is a 10x12 in stock?', createdAt: 10 },
          { id: 's1', author: 'staff', body: 'Yes, we have two.', createdAt: 20 },
        ],
        typing: false,
        askContact: false,
      },
    })
    const user = userEvent.setup()
    renderSite()
    await user.click(await screen.findByRole('button', { name: 'Continue chat' }))
    const dialog = await screen.findByRole('dialog', { name: 'Chat with Shed210' })

    expect(await within(dialog).findByText('Yes, we have two.')).toBeInTheDocument()
    expect(within(dialog).getByText('Is a 10x12 in stock?')).toBeInTheDocument()
    expect(within(dialog).getByText('Picking up where you left off')).toBeInTheDocument()
    expect(callsTo('messages')[0].body).toEqual({ token: 'tok-old', after: null })
    expect(callsTo('start')).toHaveLength(0)
    // Contact was already shared on the earlier visit.
    expect(within(dialog).queryByRole('button', { name: 'Leave your number or email' })).toBeNull()
  })

  it('forgets an expired token so the next message starts a new chat', async () => {
    localStorage.setItem(CHAT_SESSION_STORAGE_KEY, JSON.stringify({ token: 'tok-gone', contactShared: false }))
    routes['/api/web-chat/messages'] = (body) =>
      body.token === 'tok-gone'
        ? { status: 401, body: { error: 'token' } }
        : { body: { messages: [], typing: false, askContact: false } }
    routes['/api/web-chat/start'] = () => ({ body: { token: 'tok-new', greeting: '' } })
    routes['/api/web-chat/send'] = () => ({ body: { ok: true, messageId: 'n1' } })

    const user = userEvent.setup()
    renderSite()
    await user.click(await screen.findByRole('button', { name: 'Continue chat' }))
    const dialog = await screen.findByRole('dialog', { name: 'Chat with Shed210' })
    await waitFor(() => expect(localStorage.getItem(CHAT_SESSION_STORAGE_KEY)).toBeNull())

    await user.type(within(dialog).getByLabelText('Message'), 'Hello again{Enter}')
    await waitFor(() => expect(callsTo('send')).toHaveLength(1))
    expect(callsTo('send')[0].body.token).toBe('tok-new')
  })
})
