import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AiError,
  CASEY_PROTOCOL,
  requestDecision,
  setDecisionAuth,
  setRestingHandler,
  type AiSettings,
} from './client'
import { UI } from '../i18n'

const settings: AiSettings = { baseUrl: 'https://casey.example/v1' }
const envelope = () =>
  new Response(JSON.stringify({ protocol: CASEY_PROTOCOL, decision: { ok: true }, report: { arm: 'cluey', refused: false } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
const error = (status: number, code: string) =>
  new Response(JSON.stringify({ error: { code, message: code } }), { status, headers: { 'Content-Type': 'application/json' } })
const headersOf = (call: unknown[]) => (call[1] as RequestInit).headers as Record<string, string>

afterEach(() => {
  setDecisionAuth(null)
  setRestingHandler(null)
  vi.unstubAllGlobals()
})

describe('a Casey that needs a session (the website demo)', () => {
  it('the app sends no session header: none is installed', async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope())
    vi.stubGlobal('fetch', fetchMock)
    await requestDecision(settings, { protocol: CASEY_PROTOCOL, operation: 'ping' })
    expect(Object.keys(headersOf(fetchMock.mock.calls[0]!))).toEqual(['Content-Type', 'X-Install-Id'])
  })

  it('adds the session header to every decision request', async () => {
    setDecisionAuth({ headers: async () => ({ 'X-Casey-Session': 'tok-1' }), invalidate: () => {} })
    const fetchMock = vi.fn().mockResolvedValue(envelope())
    vi.stubGlobal('fetch', fetchMock)
    await requestDecision(settings, { protocol: CASEY_PROTOCOL, operation: 'ping' })
    expect(headersOf(fetchMock.mock.calls[0]!)['X-Casey-Session']).toBe('tok-1')
  })

  it('starts a new session and asks once more when the Worker says the session expired', async () => {
    let token = 'old'
    const invalidate = vi.fn(() => {
      token = 'new'
    })
    setDecisionAuth({ headers: async () => ({ 'X-Casey-Session': token }), invalidate })
    const fetchMock = vi.fn().mockResolvedValueOnce(error(401, 'session_expired')).mockResolvedValueOnce(envelope())
    vi.stubGlobal('fetch', fetchMock)
    const response = await requestDecision(settings, { protocol: CASEY_PROTOCOL, operation: 'ping' })
    expect(response.decision).toEqual({ ok: true })
    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(headersOf(fetchMock.mock.calls[1]!)['X-Casey-Session']).toBe('new')
  })

  it('does not retry any other 401', async () => {
    setDecisionAuth({ headers: async () => ({ 'X-Casey-Session': 't' }), invalidate: vi.fn() })
    const fetchMock = vi.fn().mockResolvedValue(error(401, 'forbidden'))
    vi.stubGlobal('fetch', fetchMock)
    const failure = await requestDecision(settings, { protocol: CASEY_PROTOCOL, operation: 'ping' }).catch((e) => e)
    expect(failure).toBeInstanceOf(AiError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('tells the demo when Casey is resting, and reports it as a rate limit', async () => {
    const resting = vi.fn()
    setRestingHandler(resting)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(error(429, 'casey_resting')))
    const failure = (await requestDecision(settings, { protocol: CASEY_PROTOCOL, operation: 'ping' }).catch((e) => e)) as AiError
    expect(resting).toHaveBeenCalledTimes(1)
    expect(failure.kind).toBe('rate-limit')
  })

  it('rests Casey when this visit or network has used its share, instead of "busy, retry"', async () => {
    for (const code of ['session_budget', 'network_budget']) {
      const resting = vi.fn()
      setRestingHandler(resting)
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(error(429, code)))
      const failure = (await requestDecision(settings, { protocol: CASEY_PROTOCOL, operation: 'ping' }).catch((e) => e)) as AiError
      expect(resting).toHaveBeenCalledTimes(1)
      expect(failure.message).toBe(UI.onboarding.demoRestingBody)
    }
  })

  it('says the dictionary allowance is spent in one short line, without resting Casey', async () => {
    const resting = vi.fn()
    setRestingHandler(resting)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(error(429, 'translate_budget')))
    const failure = (await requestDecision(settings, { protocol: CASEY_PROTOCOL, operation: 'ping' }).catch((e) => e)) as AiError
    expect(resting).not.toHaveBeenCalled()
    expect(failure.message).toBe(UI.game.lookupsUsed)
  })
})
