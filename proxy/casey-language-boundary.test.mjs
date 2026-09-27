import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from './worker.js'

const URL = 'https://casey.example.workers.dev/v1/casey/decision'
const ORIGIN = 'https://app.example'
const env = {
  ALLOWED_ORIGIN: ORIGIN,
  OLLAMA_API_KEY: 'worker-only-secret',
  MODEL_ALIASES: JSON.stringify({ cluey: { model: 'casey-test-model' } }),
}

const guessView = (clue) => ({
  kind: 'ai-guess',
  clueLanguage: 'target',
  turnsLeft: 4,
  words: [
    { id: 'da:told', da: 'told', en: ['customs duty', 'toll'], pos: 'noun', reveal: { kind: 'hidden' } },
    { id: 'da:mand', da: 'mand', en: ['man'], pos: 'noun', reveal: { kind: 'hidden' } },
    { id: 'da:vind', da: 'vind', en: ['wind'], pos: 'noun', reveal: { kind: 'hidden' } },
  ],
  currentClue: { text: clue, number: 1 },
  history: [],
  flagged: [],
})

const request = (view, playerLanguage) =>
  new Request(URL, {
    method: 'POST',
    headers: {
      Origin: ORIGIN,
      'Content-Type': 'application/json',
      'X-Install-Id': 'install-12345678',
    },
    body: JSON.stringify({ protocol: 1, operation: 'guess', playerLanguage, view }),
  })

const upstream = () =>
  new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ guesses: [{ wordId: 'da:told', confidence: 0.9, reasoning: 'Det er en dansk told.' }] }) } }],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Danish clue contract through the live Worker decision route', () => {
  it.each(['en', 'de', 'fr'])('keeps the Danish meaning of told independent of UI language (%s)', async (playerLanguage) => {
    const fetchSpy = vi.fn(async () => upstream())
    vi.stubGlobal('fetch', fetchSpy)

    const response = await worker.fetch(request(guessView('told'), playerLanguage), env)
    const answer = await response.json()
    const messages = JSON.parse(fetchSpy.mock.calls[0][1].body).messages
    const prompt = messages.map((message) => message.content).join('\n')

    expect(response.status).toBe(200)
    expect(answer.decision.guesses[0].wordId).toBe('da:told')
    expect(prompt).toContain('THE CLUE IS IN DANISH')
    expect(prompt).toContain('regardless of the player\'s interface language')
    expect(prompt).toContain('A dictionary lookup may start from an English word')
    expect(prompt).not.toContain('THE CLUE MAY BE IN EITHER LANGUAGE')
  })

  it('uses the same Danish contract for an existing-data homograph contrast', async () => {
    const fetchSpy = vi.fn(async () => upstream())
    vi.stubGlobal('fetch', fetchSpy)

    const response = await worker.fetch(request(guessView('mand'), 'nl'), env)
    expect(response.status).toBe(200)
    const prompt = JSON.parse(fetchSpy.mock.calls[0][1].body).messages.map((message) => message.content).join('\n')
    expect(prompt).toContain('THE CLUE IS IN DANISH')
    expect(prompt).toContain('Danish "mand" is a man, Dutch "mand" is a basket')
    expect(prompt).not.toContain('THE CLUE MAY BE IN EITHER LANGUAGE')
  })
})
