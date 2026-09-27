import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AiError, type CaseyRequest } from '../client'
import type { AiClueView, AiGuessView } from '../projections'
import { UI } from '../../i18n'
import { CITY1_BOARD_CYCLE } from '../../data/city1BoardCycle'
import playtestBank from '../../data/city1-playtest-clues.da.json'
import { wordById } from '../../data/words'
import { browserRequestUrl, ownModelEndpoint, useOwnModel } from './store'
import { requestOwnKeyDecision, testOwnKeyConnection } from './decision'

/**
 * The open-source build's "your own AI key": Casey's logic in the app, with
 * the player's OpenAI-compatible service as its model and no Worker at all.
 */

const settings = { baseUrl: '' }
const KEY = 'sk-test-0123456789'

const calls: { url: string; init: RequestInit }[] = []
let answer: (body: { messages: unknown[] }) => Response | Promise<Response>
const previousFetch = globalThis.fetch

const reply = (content: string, status = 200) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

beforeEach(() => {
  calls.length = 0
  useOwnModel.setState({ baseUrl: 'https://ai.example/v1', model: 'test-model', apiKey: KEY })
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return answer(JSON.parse(String(init.body)))
  }) as typeof fetch
})

afterEach(() => {
  globalThis.fetch = previousFetch
  vi.unstubAllGlobals()
})

// Words outside every authored shard: the reply stands or falls on the validator.
const smallGuessView: AiGuessView = {
  kind: 'ai-guess',
  clueLanguage: 'target',
  turnsLeft: 5,
  words: [
    { id: 'da:kop', da: 'kop', en: ['cup'], pos: 'noun', reveal: { kind: 'hidden' } },
    { id: 'da:glas', da: 'glas', en: ['glass'], pos: 'noun', reveal: { kind: 'hidden' } },
    { id: 'da:sofa', da: 'sofa', en: ['sofa', 'couch'], pos: 'noun', reveal: { kind: 'hidden' } },
  ],
  currentClue: { text: 'opvask', number: 2 },
  history: [],
  flagged: [],
}
const guess = (view: AiGuessView = smallGuessView): CaseyRequest => ({ protocol: 1, operation: 'guess', view })
const guessJson = '{"guesses":[{"wordId":"da:kop","confidence":0.8,"reasoning":"You wash a cup, not a sofa."}]}'

const board = CITY1_BOARD_CYCLE[0]!
const openingView: AiClueView = {
  kind: 'ai-clue',
  clueLanguage: 'target',
  turnsLeft: 8,
  words: board.wordIds.map((id) => {
    const entry = wordById(id)!
    return {
      id,
      da: entry.da,
      en: entry.en,
      pos: entry.pos,
      reveal: { kind: 'hidden' as const },
      roleOnMyKey: board.aiGreenIds.includes(id) ? ('green' as const) : ('bystander' as const),
    }
  }),
  history: [],
  flagged: [],
  boardId: board.id,
}

const indexedBoard = playtestBank.boards[0]!
const indexedGuessView: AiGuessView = {
  kind: 'ai-guess',
  clueLanguage: 'target',
  turnsLeft: 8,
  words: indexedBoard.wordIds.map((id) => {
    const entry = wordById(id)!
    return { id, da: entry.da, en: entry.en, pos: entry.pos, reveal: { kind: 'hidden' as const } }
  }),
  currentClue: { text: indexedBoard.caseyClueGroups[0]!.clue, number: 3 },
  history: [],
  flagged: [],
}

describe('Casey with the player’s own AI key', () => {
  it('asks the player’s service, with their key and model, in JSON mode', async () => {
    answer = () => reply(guessJson)
    const result = await requestOwnKeyDecision(settings, guess())
    expect(result.report.arm.startsWith('own-key')).toBe(true)
    expect(result.decision).toMatchObject({ guesses: [{ wordId: 'da:kop' }] })
    expect(calls).toHaveLength(1)
    const { url, init } = calls[0]!
    expect(url).toBe('https://ai.example/v1/chat/completions')
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`)
    const body = JSON.parse(String(init.body)) as { model: string; response_format: unknown; messages: unknown[] }
    expect(body.model).toBe('test-model')
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(body.messages.length).toBeGreaterThan(0)
  })

  it('never puts the key in what the model reads', async () => {
    answer = () => reply(guessJson)
    await requestOwnKeyDecision(settings, guess())
    expect(JSON.stringify(JSON.parse(String(calls[0]!.init.body)).messages)).not.toContain(KEY)
  })

  it('opens an authored City 1 board from the bank without calling the service', async () => {
    answer = () => reply('{}')
    const result = await requestOwnKeyDecision(settings, { protocol: 1, operation: 'clue', view: openingView })
    expect(result.report.arm).toBe('authored')
    expect(calls).toHaveLength(0)
  })

  it('reports a refused key instead of quietly playing without it', async () => {
    answer = () => new Response('{"error":"bad key"}', { status: 401 })
    await expect(requestOwnKeyDecision(settings, guess(indexedGuessView))).rejects.toMatchObject({
      kind: 'auth',
      message: UI.system.ownKeyRefused,
    })
  })

  it('reports a request the service refuses, such as a wrong model name', async () => {
    answer = () => new Response('{"error":"no such model"}', { status: 404 })
    await expect(requestOwnKeyDecision(settings, guess(indexedGuessView))).rejects.toMatchObject({
      kind: 'invalid-response',
      message: UI.system.ownKeyBadRequest,
    })
  })

  it('treats no answer at all as no internet, so the round can offer offline Casey', async () => {
    answer = () => {
      throw new TypeError('Load failed')
    }
    vi.stubGlobal('navigator', { onLine: false })
    const refusal = requestOwnKeyDecision(settings, guess(indexedGuessView))
    await expect(refusal).rejects.toBeInstanceOf(AiError)
    await expect(refusal).rejects.toMatchObject({ kind: 'network', message: UI.system.offline })
  })

  it('keeps Casey playing from the index when the service is up but failing, as on the Worker', async () => {
    answer = () => new Response('{"error":"overloaded"}', { status: 503 })
    const result = await requestOwnKeyDecision(settings, guess(indexedGuessView))
    expect(result.report.arm).toBe('own-key+fallback-index')
  })

  it('asks for set-up rather than calling anything when a field is empty', async () => {
    useOwnModel.setState({ apiKey: '' })
    answer = () => reply(guessJson)
    await expect(requestOwnKeyDecision(settings, guess())).rejects.toMatchObject({
      kind: 'auth',
      message: UI.system.selfHostedCaseyRequired,
    })
    expect(calls).toHaveLength(0)
  })

  it('sends Ollama Cloud requests from a page on this machine through its own server', async () => {
    useOwnModel.setState({ baseUrl: 'https://ollama.com/v1' })
    vi.stubGlobal('location', { hostname: 'localhost', origin: 'http://localhost:5173' })
    answer = () => reply(guessJson)
    await requestOwnKeyDecision(settings, guess())
    expect(calls[0]!.url).toBe('http://localhost:5173/ollama-cloud/v1/chat/completions')
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`)
  })

  it('checks the service itself on the connection test', async () => {
    answer = () => reply('{"ok": true}')
    await expect(testOwnKeyConnection()).resolves.toBeUndefined()
    expect(calls).toHaveLength(1)
  })
})

describe('the own-AI-service address', () => {
  it('accepts https, and plain http only to this machine', () => {
    expect(ownModelEndpoint('https://api.openai.com/v1/')).toBe('https://api.openai.com/v1/chat/completions')
    expect(ownModelEndpoint('http://localhost:11434/v1')).toBe('http://localhost:11434/v1/chat/completions')
    expect(() => ownModelEndpoint('http://ai.example/v1')).toThrow(AiError)
  })

  it('passes only ollama.com through, and only for a page on this machine', () => {
    const local = { hostname: 'localhost', origin: 'http://localhost:4173' }
    expect(browserRequestUrl('https://ollama.com/v1/chat/completions', local)).toBe(
      'http://localhost:4173/ollama-cloud/v1/chat/completions',
    )
    expect(browserRequestUrl('https://ollama.com/v1/chat/completions', { hostname: '127.0.0.1', origin: 'http://127.0.0.1:5173' })).toBe(
      'http://127.0.0.1:5173/ollama-cloud/v1/chat/completions',
    )
    // Another service, or a page served from anywhere else, goes direct.
    expect(browserRequestUrl('https://api.openai.com/v1/chat/completions', local)).toBe('https://api.openai.com/v1/chat/completions')
    expect(browserRequestUrl('https://ollama.com.evil.example/v1/chat/completions', local)).toBe(
      'https://ollama.com.evil.example/v1/chat/completions',
    )
    expect(browserRequestUrl('https://ollama.com/v1/chat/completions', { hostname: 'words.example', origin: 'https://words.example' })).toBe(
      'https://ollama.com/v1/chat/completions',
    )
  })

  it('refuses an address that could carry a secret into a log', () => {
    expect(() => ownModelEndpoint('https://user:pass@ai.example/v1')).toThrow(AiError)
    expect(() => ownModelEndpoint('https://ai.example/v1?key=abc')).toThrow(AiError)
  })
})
