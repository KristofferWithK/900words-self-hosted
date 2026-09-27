import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import worker from './worker.js'
import { CITY1_BOARD_CYCLE } from '../src/data/city1BoardCycle.ts'
import { WORDS } from '../src/data/words.ts'
import { requestOwnKeyDecision } from '../src/ai/ownKey/decision.ts'
import { DEFAULT_OWN_MODEL, DEFAULT_OWN_MODEL_BASE_URL, useOwnModel } from '../src/ai/ownKey/store.ts'

/**
 * A self-built 900words with the player's own gpt-oss 120B key must play the
 * same Casey as the App Store build (owner, 2026-09-27). Both run the same
 * orchestrator; this pins the other half: for the same decision and the same
 * model replies, the self-build sends the model exactly the requests the App
 * Store's Worker sends, in the same order, and reaches the same decision.
 *
 * The Worker is configured as production is: MODEL_ALIASES read from
 * proxy/wrangler.toml, the default upstream (ollama.com).
 */

const production = readFileSync(resolve('proxy/wrangler.toml'), 'utf8')
const aliases = JSON.parse(/MODEL_ALIASES = '''([\s\S]*?)'''/.exec(production)[1])
const ORIGIN = 'https://app.example'
const env = { ALLOWED_ORIGIN: ORIGIN, OLLAMA_API_KEY: 'the-same-key', MODEL_ALIASES: JSON.stringify(aliases) }

const byId = new Map(WORDS.map((w) => [w.id, w]))
const board = CITY1_BOARD_CYCLE[3]
const word = (id) => {
  const w = byId.get(id)
  return { id, da: w.da, en: w.en, pos: w.pos, reveal: { kind: 'hidden' } }
}
const clueView = {
  kind: 'ai-clue',
  clueLanguage: 'target',
  turnsLeft: 6,
  words: board.wordIds.map((id) => ({ ...word(id), roleOnMyKey: board.aiGreenIds.includes(id) ? 'green' : 'bystander' })),
  history: [{ by: 'ai', text: 'zzopening', number: 2, guesses: [] }],
  flagged: [],
  boardId: board.id,
}
const guessView = {
  kind: 'ai-guess',
  clueLanguage: 'target',
  turnsLeft: 6,
  words: board.wordIds.map(word),
  currentClue: { text: 'hverdag', number: 2 },
  history: [],
  flagged: [],
}

const modelReply = (content, status = 200) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

/** Every upstream call either side makes, answered from the same script. */
function upstream(script) {
  const calls = []
  let next = 0
  vi.stubGlobal('fetch', async (url, init) => {
    calls.push({ url: String(url), auth: new Headers(init.headers).get('Authorization'), body: JSON.parse(init.body) })
    const step = script[Math.min(next++, script.length - 1)]
    return typeof step === 'number' ? new Response('{"error":"down"}', { status: step }) : modelReply(step)
  })
  return calls
}

async function viaWorker(request, script) {
  const calls = upstream(script)
  const response = await worker.fetch(
    new Request('https://casey.example/v1/casey/decision', {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'X-Install-Id': 'install-12345678' },
      body: JSON.stringify({ ...request, playerLanguage: 'en' }),
    }),
    env,
  )
  vi.unstubAllGlobals()
  return { calls, result: await response.json() }
}

async function viaSelfBuild(request, script) {
  const calls = upstream(script)
  const result = await requestOwnKeyDecision({ baseUrl: '', playerLanguage: 'en' }, request)
  vi.unstubAllGlobals()
  return { calls, result }
}

async function compare(request, script) {
  const store = await viaWorker(request, script)
  const self = await viaSelfBuild(request, script)
  expect(store.calls.length).toBeGreaterThan(0)
  expect(self.calls.map((c) => c.url)).toEqual(store.calls.map((c) => c.url))
  expect(self.calls.map((c) => c.body)).toEqual(store.calls.map((c) => c.body))
  expect(self.calls.map((c) => c.auth)).toEqual(store.calls.map((c) => c.auth))
  expect(self.result.decision).toEqual(store.result.decision)
  return { store, self }
}

describe('a self-build with gpt-oss 120B plays the App Store’s Casey', () => {
  beforeEach(() => {
    useOwnModel.setState({ baseUrl: DEFAULT_OWN_MODEL_BASE_URL, model: DEFAULT_OWN_MODEL, apiKey: 'the-same-key' })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('defaults to the App Store’s model and service', () => {
    expect(aliases.cluey.model).toBe(DEFAULT_OWN_MODEL)
    expect(DEFAULT_OWN_MODEL_BASE_URL).toBe('https://ollama.com/v1')
  })

  it('asks for a clue with the same request, corrections included', async () => {
    const { store } = await compare({ protocol: 1, operation: 'clue', view: clueView }, [
      'not json',
      JSON.stringify({ clue: 'zzq', number: 1, targetWordIds: [board.aiGreenIds[0]], rationale: 'r' }),
      JSON.stringify({ clue: 'zzq', number: 1, targetWordIds: [board.aiGreenIds[0]], rationale: 'r' }),
    ])
    expect(store.calls[0].url).toBe('https://ollama.com/v1/chat/completions')
    expect(store.calls[0].body.model).toBe('gpt-oss:120b')
  })

  it('guesses under the player’s clue with the same request (top-two assistance)', async () => {
    await compare({ protocol: 1, operation: 'guess', view: guessView, candidateMode: 'top-two' }, [
      JSON.stringify({ guesses: guessView.words.slice(0, 2).map((w) => ({ wordId: w.id, confidence: 0.7, reasoning: 'r' })) }),
    ])
  })

  it('looks a word up with the same dictionary request (low reasoning, no tools, 160 tokens)', async () => {
    const { self } = await compare({ protocol: 1, operation: 'translate', term: 'helikopter' }, [
      JSON.stringify({ da: 'helikopter', en: 'helicopter', article: 'en', gender: 'common', countable: true }),
    ])
    expect(self.calls[0].body).toMatchObject({ max_tokens: 160, reasoning_effort: 'low', tools: [] })
  })

  it('retries a failing service once, as the Worker does', async () => {
    const { self } = await compare({ protocol: 1, operation: 'guess', view: guessView }, [
      503,
      JSON.stringify({ guesses: [{ wordId: guessView.words[0].id, confidence: 0.7, reasoning: 'r' }] }),
    ])
    expect(self.calls.length).toBe(2)
  })
})
