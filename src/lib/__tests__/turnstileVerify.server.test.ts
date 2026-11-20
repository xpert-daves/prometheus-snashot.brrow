/**
 * @jest-environment node
 */

import { isTurnstileVerificationConfigured, verifyTurnstileToken } from '../turnstileVerify.server'

const cloudflareSays = (body: unknown, status = 200) =>
  jest.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch

describe('verifyTurnstileToken', () => {
  const originalSecret = process.env.TURNSTILE_SECRET_KEY

  beforeEach(() => {
    process.env.TURNSTILE_SECRET_KEY = 'test-turnstile-secret'
  })

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY
    else process.env.TURNSTILE_SECRET_KEY = originalSecret
  })

  it('checks nothing without TURNSTILE_SECRET_KEY', async () => {
    delete process.env.TURNSTILE_SECRET_KEY
    const fetchImpl = cloudflareSays({ success: true, action: 'quote_submit' })

    expect(isTurnstileVerificationConfigured()).toBe(false)
    await expect(
      verifyTurnstileToken({ token: 'token', action: 'quote_submit', fetchImpl })
    ).resolves.toBe('unconfigured')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('fails a missing, blank or oversized token without asking Cloudflare', async () => {
    const fetchImpl = cloudflareSays({ success: true, action: 'quote_submit' })

    for (const token of [undefined, '', '   ', 'x'.repeat(2_049)]) {
      await expect(
        verifyTurnstileToken({ token, action: 'quote_submit', fetchImpl })
      ).resolves.toBe('failed')
    }
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('passes a token Cloudflare accepts for this action, sending the secret, token and address', async () => {
    const fetchImpl = cloudflareSays({ success: true, action: 'quote_submit' })

    await expect(
      verifyTurnstileToken({
        token: ' token-from-the-browser ',
        action: 'quote_submit',
        remoteIp: '203.0.113.10',
        fetchImpl,
      })
    ).resolves.toBe('passed')

    const [url, init] = (fetchImpl as unknown as jest.Mock).mock.calls[0]
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
    expect(init.method).toBe('POST')
    expect(Object.fromEntries(init.body as URLSearchParams)).toEqual({
      secret: 'test-turnstile-secret',
      response: 'token-from-the-browser',
      remoteip: '203.0.113.10',
    })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('fails a token Cloudflare refuses, such as one already spent', async () => {
    const fetchImpl = cloudflareSays({ success: false, 'error-codes': ['timeout-or-duplicate'] })

    await expect(
      verifyTurnstileToken({ token: 'token', action: 'quote_submit', fetchImpl })
    ).resolves.toBe('failed')
  })

  it('passes an accepted token whose answer names no action, as the test keys do', async () => {
    // What challenges.cloudflare.com returned for its always-pass test secret
    // on 2026-11-18.
    const fetchImpl = cloudflareSays({
      challenge_ts: '2026-11-18T23:08:37.845Z',
      'error-codes': [],
      hostname: 'example.com',
      metadata: { result_with_testing_key: true },
      success: true,
    })

    await expect(
      verifyTurnstileToken({ token: 'XXXX.DUMMY.TOKEN.XXXX', action: 'quote_submit', fetchImpl })
    ).resolves.toBe('passed')
  })

  it('fails a token solved for another action, such as a chat start', async () => {
    const fetchImpl = cloudflareSays({ success: true, action: 'web_chat_start' })

    await expect(
      verifyTurnstileToken({ token: 'token', action: 'quote_submit', fetchImpl })
    ).resolves.toBe('failed')
  })

  it('is unavailable, not failed, when Cloudflare cannot be asked', async () => {
    const down = jest.fn(async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch

    await expect(
      verifyTurnstileToken({ token: 'token', action: 'quote_submit', fetchImpl: down })
    ).resolves.toBe('unavailable')
    await expect(
      verifyTurnstileToken({
        token: 'token',
        action: 'quote_submit',
        fetchImpl: cloudflareSays({ success: true }, 503),
      })
    ).resolves.toBe('unavailable')
    await expect(
      verifyTurnstileToken({
        token: 'token',
        action: 'quote_submit',
        fetchImpl: cloudflareSays('not an object'),
      })
    ).resolves.toBe('unavailable')
  })
})
