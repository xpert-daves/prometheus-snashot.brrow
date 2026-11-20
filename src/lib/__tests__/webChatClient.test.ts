import {
  CHAT_SESSION_STORAGE_KEY,
  buildPageContext,
  fetchChatConfig,
  getChatBaseUrl,
  readStoredChatSession,
  WebChatError,
  writeStoredChatSession,
} from '../webChatClient'

describe('getChatBaseUrl', () => {
  it('accepts only an https convex.site origin', () => {
    expect(getChatBaseUrl('https://youthful-horse-290.convex.site/')).toBe(
      'https://youthful-horse-290.convex.site'
    )
    expect(getChatBaseUrl('http://youthful-horse-290.convex.site')).toBeNull()
    expect(getChatBaseUrl('https://youthful-horse-290.convex.cloud')).toBeNull()
    expect(getChatBaseUrl('https://attacker.example')).toBeNull()
    expect(getChatBaseUrl('')).toBeNull()
    expect(getChatBaseUrl(undefined)).toBeNull()
  })
})

describe('web chat requests', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_CRM_CHAT_URL = 'https://youthful-horse-290.convex.site'
  })
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_CRM_CHAT_URL
  })

  it('posts JSON without cookies and surfaces the short error code', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({ error: 'busy' }),
    })) as jest.Mock

    await expect(fetchChatConfig()).rejects.toMatchObject({ status: 429, code: 'busy' })
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe('https://youthful-horse-290.convex.site/api/web-chat/config')
    expect(init).toMatchObject({ method: 'POST', credentials: 'omit', body: '{}' })
  })

  it('refuses to call anything when the chat URL is not configured', async () => {
    delete process.env.NEXT_PUBLIC_CRM_CHAT_URL
    global.fetch = jest.fn() as jest.Mock
    await expect(fetchChatConfig()).rejects.toBeInstanceOf(WebChatError)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

describe('stored chat session', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips and ignores unreadable values', () => {
    expect(readStoredChatSession()).toBeNull()
    writeStoredChatSession({ token: 'abc', contactShared: true })
    expect(readStoredChatSession()).toEqual({ token: 'abc', contactShared: true })
    localStorage.setItem(CHAT_SESSION_STORAGE_KEY, 'not json')
    expect(readStoredChatSession()).toBeNull()
  })

  it('survives storage that throws', () => {
    const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    expect(readStoredChatSession()).toBeNull()
    getItem.mockRestore()
  })
})

describe('buildPageContext', () => {
  beforeEach(() => localStorage.clear())

  it('summarizes only the saved structure type and size', () => {
    localStorage.setItem(
      'quote-params',
      JSON.stringify({ structureType: 'portable_garage', length: 24, width: 12, email: 'a@b.co' })
    )
    expect(buildPageContext('/buildings', 'Buildings | Shed210')).toBe(
      'Page: /buildings | Title: Buildings | Shed210 | Saved quote: portable garage 24x12 ft'
    )
  })

  it('drops unexpected draft values and caps the length', () => {
    localStorage.setItem('quote-params', JSON.stringify({ structureType: '<script>' }))
    expect(buildPageContext('/', '')).toBe('Page: /')
    expect(buildPageContext('/', 'x'.repeat(500))).toHaveLength(300)
  })
})
