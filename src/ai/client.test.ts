import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AiError,
  CASEY_PROTOCOL,
  caseyReachable,
  installId,
  requestDecision,
  type AiSettings,
} from './client'

const settings: AiSettings = { baseUrl: 'https://casey.example/v1' }
const envelope = (decision: unknown) =>
  new Response(
    JSON.stringify({ protocol: CASEY_PROTOCOL, decision, report: { arm: 'cluey', refused: false } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )

afterEach(() => vi.unstubAllGlobals())

async function catchError(promise: Promise<unknown>): Promise<AiError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof AiError) return error
    throw error
  }
  throw new Error('expected an AiError')
}

describe('the Casey decision transport', () => {
  it('a resumed attempt keeps its captured prompt language instead of the current UI language', async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    await requestDecision({ ...settings, playerLanguage: 'de' }, { protocol: CASEY_PROTOCOL, operation: 'ping' })
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).playerLanguage).toBe('de')
  })
  it('keeps course language separate from player language on the wire', async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    await requestDecision(
      { ...settings, playerLanguage: 'fr', courseLanguage: 'de' },
      { protocol: CASEY_PROTOCOL, operation: 'ping' },
    )
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({
      protocol: 1, operation: 'ping', language: 'de', playerLanguage: 'fr',
    })
  })
  it('sends a typed operation and install id, with no prompt, model, or credential', async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    await requestDecision(settings, { protocol: CASEY_PROTOCOL, operation: 'ping' })

    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toBe('https://casey.example/v1/casey/decision')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBeUndefined()
    expect(init.headers['X-Install-Id']).toMatch(/\S{8}/)
    expect(JSON.parse(init.body).language).toBeUndefined()
    const body = JSON.parse(init.body)
    expect(body).toEqual({ protocol: 1, operation: 'ping', playerLanguage: 'en' })
    expect(JSON.stringify({ headers: init.headers, body })).not.toMatch(/api[_-]?key|messages|model/i)
  })

  it('retries a dropped connection once, silently, before reporting it', async () => {
    vi.useFakeTimers()
    try {
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new TypeError('Load failed'))
        .mockResolvedValueOnce(envelope({ ok: true }))
      vi.stubGlobal('fetch', fetchMock)
      const pending = requestDecision(settings, { protocol: CASEY_PROTOCOL, operation: 'ping' })
      await vi.advanceTimersByTimeAsync(1_500)
      expect((await pending).decision).toEqual({ ok: true })
      expect(fetchMock).toHaveBeenCalledTimes(2)

      const dead = vi.fn().mockRejectedValue(new TypeError('Load failed'))
      vi.stubGlobal('fetch', dead)
      const failing = catchError(requestDecision(settings, { protocol: CASEY_PROTOCOL, operation: 'ping' }))
      await vi.advanceTimersByTimeAsync(1_500)
      expect((await failing).kind).toBe('cors')
      expect(dead).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not retry a timeout: that attempt already waited the whole budget', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new DOMException('timed out', 'TimeoutError'))
    vi.stubGlobal('fetch', fetchMock)
    const error = await catchError(requestDecision(settings, { protocol: CASEY_PROTOCOL, operation: 'ping' }))
    expect(error.kind).toBe('network')
    expect(error.message).toContain('90 seconds')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects an unknown server envelope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }))))
    await expect(requestDecision(settings, { protocol: 1, operation: 'ping' })).rejects.toMatchObject({
      kind: 'invalid-response',
    })
  })

  it('distinguishes the daily cap from a transient upstream rate limit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: { code: 'cluecabulary_daily_cap', message: 'spent' } }),
          { status: 429 },
        ),
      ),
    )
    const spent = await catchError(requestDecision(settings, { protocol: 1, operation: 'ping' }))
    expect(spent.message).toMatch(/midnight UTC/)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 429 })))
    const busy = await catchError(requestDecision(settings, { protocol: 1, operation: 'ping' }))
    expect(busy.message).toMatch(/wait a moment/i)
    expect(busy.message).not.toMatch(/midnight/i)
  })

  it('shows the server-authored operation fallback without exposing validator diagnostics', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'invalid_model_reply',
              message: 'Casey could not settle on a clue for the words she is holding.',
            },
          }),
          { status: 502 },
        ),
      ),
    )
    const error = await catchError(requestDecision(settings, { protocol: 1, operation: 'ping' }))
    expect(error.message).toBe('Casey could not settle on a clue for the words she is holding.')
    expect(error.message).not.toMatch(/JSON|schema|wordId|GREEN/)
  })

  it('keeps one opaque install id across cold starts and survives denied storage', async () => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    })
    vi.resetModules()
    const first = (await import('./client')).installId()
    vi.resetModules()
    expect((await import('./client')).installId()).toBe(first)

    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
    })
    vi.resetModules()
    expect((await import('./client')).installId()).toMatch(/\S{8}/)
    expect(installId()).toMatch(/\S{8}/)
  })
})

describe('the reachability check an offline round uses', () => {
  it('asks the decision route with a bare OPTIONS: no install id, no body, no game', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(caseyReachable(settings.baseUrl)).resolves.toBe(true)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toBe('https://casey.example/v1/casey/decision')
    expect(init.method).toBe('OPTIONS')
    expect(init.headers).toBeUndefined()
    expect(init.body).toBeUndefined()
  })

  it('says unreachable for a failed request, a refusal, or an unusable address', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Load failed')))
    await expect(caseyReachable(settings.baseUrl)).resolves.toBe(false)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('no', { status: 403 })))
    await expect(caseyReachable(settings.baseUrl)).resolves.toBe(false)
    await expect(caseyReachable('not a url')).resolves.toBe(false)
  })
})
