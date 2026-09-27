import { describe, expect, it, vi } from 'vitest'
import type { DecisionFn } from './client'
import { AiError } from './client'
import {
  AUTHORED_ARM,
  OllamaCompanion,
  planGuessExecution,
} from './companion'
import type { AiClueView, AiGuessView } from './projections'

const settings = { baseUrl: 'https://casey.test/v1' }
const clueView: AiClueView = {
  kind: 'ai-clue',
  clueLanguage: 'target',
  turnsLeft: 5,
  words: [
    { id: 'da:hund', da: 'hund', en: ['dog'], pos: 'noun', reveal: { kind: 'hidden' }, roleOnMyKey: 'green' },
    { id: 'da:kat', da: 'kat', en: ['cat'], pos: 'noun', reveal: { kind: 'hidden' }, roleOnMyKey: 'green' },
    { id: 'da:bil', da: 'bil', en: ['car'], pos: 'noun', reveal: { kind: 'hidden' }, roleOnMyKey: 'bystander' },
  ],
  history: [],
  flagged: [],
}
const guessView: AiGuessView = {
  kind: 'ai-guess',
  clueLanguage: 'target',
  turnsLeft: 5,
  words: clueView.words.map(({ roleOnMyKey: _role, ...word }) => word),
  currentClue: { text: 'husdyr', number: 2 },
  history: [],
  flagged: [],
}

const answer = (decision: unknown, refused = false, arm = 'cluey'): DecisionFn =>
  vi.fn(async () => ({ protocol: 1 as const, decision, report: { arm, refused } }))

describe('planGuessExecution', () => {
  const guess = (wordId: string, confidence: number) => ({ wordId, confidence, reasoning: '' })

  it('sorts, caps at the number, and stops low-confidence continuations', () => {
    expect(
      planGuessExecution(
        [guess('low', 0.2), guess('first', 0.9), guess('second', 0.7), guess('third', 0.6)],
        2,
      ).map((item) => item.wordId),
    ).toEqual(['first', 'second'])
    expect(planGuessExecution([guess('first', 0.9), guess('stop', 0.2)], 2)).toHaveLength(1)
  })

  it('always takes the top-ranked word, even at zero confidence', () => {
    expect(planGuessExecution([guess('only', 0)], 3).map((item) => item.wordId)).toEqual(['only'])
  })
})

/**
 * The authored arm is what the store keys the legacy plan semantics off.
 * Its artificial post-response hold was removed on 2026-09-25; the complete
 * plan still lands as soon as the real Worker response arrives.
 */
describe('the authored arm', () => {
  it('is reported verbatim by the companion after a guess', async () => {
    const decide = answer({
      guesses: [{ wordId: 'da:hund', confidence: 1, reasoning: 'pet' }],
    }, false, AUTHORED_ARM)
    const companion = new OllamaCompanion(settings, decide)
    await companion.getGuesses(guessView)
    expect(companion.lastCall).toEqual({ arm: AUTHORED_ARM, refused: false })
  })

  it('is not confounded with model arms', async () => {
    const decide = answer({
      guesses: [{ wordId: 'da:hund', confidence: 1, reasoning: 'pet' }],
    })
    const companion = new OllamaCompanion(settings, decide)
    await companion.getGuesses(guessView)
    expect(companion.lastCall?.arm).not.toBe(AUTHORED_ARM)
  })
})

describe('the thin Casey companion', () => {
  it('sends the clue projection and accepts only a finished server decision', async () => {
    const decide = answer({
      clue: 'husdyr',
      number: 2,
      targetWordIds: ['da:hund', 'da:kat'],
      rationale: 'Both are pets; bil is unrelated.',
    }, true)
    const companion = new OllamaCompanion(settings, decide)
    await expect(companion.getClue(clueView)).resolves.toMatchObject({ clue: 'husdyr', number: 2 })
    expect(decide).toHaveBeenCalledWith(settings, { protocol: 1, operation: 'clue', view: clueView })
    expect(companion.lastCall).toEqual({ arm: 'cluey', refused: true })
  })

  it('routes German as the course language without replacing the captured player language', async () => {
    const germanView: AiClueView = {
      ...clueView,
      words: clueView.words.map((word) => ({ ...word, id: word.id.replace('da:', 'de:') })),
    }
    const germanSettings = { ...settings, playerLanguage: 'fr' as const, courseLanguage: 'de' as const }
    const decide = answer({
      clue: 'Haustier',
      number: 2,
      targetWordIds: ['de:hund', 'de:kat'],
      rationale: 'Both are pets; bil is unrelated.',
    })
    const companion = new OllamaCompanion(germanSettings, decide)

    await companion.getClue(germanView)

    expect(decide).toHaveBeenCalledWith(germanSettings, {
      protocol: 1,
      operation: 'clue',
      view: germanView,
    })
  })

  it('rejects a malformed or non-target clue even if a server is compromised', async () => {
    const bad = answer({ clue: 'road', number: 1, targetWordIds: ['da:bil'], rationale: 'x' })
    await expect(new OllamaCompanion(settings, bad).getClue(clueView)).rejects.toBeInstanceOf(AiError)
  })

  it('defensively rejects a one-target clue while the server view still has two greens', async () => {
    const bad = answer({ clue: 'pet', number: 1, targetWordIds: ['da:hund'], rationale: 'x' })
    await expect(new OllamaCompanion(settings, bad).getClue(clueView)).rejects.toBeInstanceOf(AiError)
  })

  it('allows the single-target exception only when it is the last unrevealed green', async () => {
    const oneLeft: AiClueView = {
      ...clueView,
      words: clueView.words.map((word) =>
        word.id === 'da:hund' ? word : { ...word, roleOnMyKey: 'bystander' as const },
      ),
    }
    const decide = answer({ clue: 'pet', number: 1, targetWordIds: ['da:hund'], rationale: 'x' })
    await expect(new OllamaCompanion(settings, decide).getClue(oneLeft)).resolves.toMatchObject({ number: 1 })
  })

  it('does not call a server when Casey has no target left', async () => {
    const decide = answer({})
    const spent: AiClueView = {
      ...clueView,
      words: clueView.words.map((word) => ({ ...word, roleOnMyKey: 'bystander' })),
    }
    await expect(new OllamaCompanion(settings, decide).getClue(spent)).rejects.toBeInstanceOf(AiError)
    expect(decide).not.toHaveBeenCalled()
  })

  it('filters unknown guesses and sends no key view', async () => {
    const decide = answer({
      guesses: [
        { wordId: 'invented', confidence: 1, reasoning: 'bad' },
        { wordId: 'da:hund', confidence: 0.8, reasoning: 'pet' },
      ],
    })
    await expect(new OllamaCompanion(settings, decide).getGuesses(guessView)).resolves.toEqual({
      guesses: [{ wordId: 'da:hund', confidence: 0.8, reasoning: 'pet' }],
    })
    const sent = vi.mocked(decide).mock.calls[0]![1]
    expect(JSON.stringify(sent)).not.toContain('roleOnMyKey')
  })

  it('requests top-two mode and preserves the first two distinct legal rows in model order', async () => {
    const decide = answer({
      guesses: [
        { wordId: 'invented', confidence: 1, reasoning: 'unknown' },
        { wordId: 'da:hund', confidence: 0.2, reasoning: 'first legal' },
        { wordId: 'da:hund', confidence: 0.99, reasoning: 'duplicate' },
        { wordId: 'da:kat', confidence: 0.9, reasoning: 'second legal' },
      ],
    })
    const companion = new OllamaCompanion(settings, decide)
    await expect(companion.getGuesses(guessView, { candidateMode: 'top-two' })).resolves.toEqual({
      guesses: [
        { wordId: 'da:hund', confidence: 0.2, reasoning: 'first legal' },
        { wordId: 'da:kat', confidence: 0.9, reasoning: 'second legal' },
      ],
    })
    expect(decide).toHaveBeenCalledWith(settings, {
      protocol: 1,
      operation: 'guess',
      view: guessView,
      candidateMode: 'top-two',
    })
  })

  it('preserves a finite authored plan despite the ordinary top-two request mode', async () => {
    const decision = answer({ guesses: [
      { wordId: 'da:hund', confidence: 1, reasoning: 'first authored' },
      { wordId: 'da:kat', confidence: 1, reasoning: 'second authored' },
      { wordId: 'da:bil', confidence: 1, reasoning: 'third authored' },
    ] }, false, AUTHORED_ARM)
    await expect(new OllamaCompanion(settings, decision).getGuesses(
      guessView,
      { candidateMode: 'top-two' },
    )).resolves.toEqual({ guesses: [
      { wordId: 'da:hund', confidence: 1, reasoning: 'first authored' },
      { wordId: 'da:kat', confidence: 1, reasoning: 'second authored' },
      { wordId: 'da:bil', confidence: 1, reasoning: 'third authored' },
    ] })
  })

  it('sends a translation term without any board view', async () => {
    const decide = answer({ da: 'hund', en: 'dog', article: 'en', gender: 'common', countable: true })
    await new OllamaCompanion(settings, decide).translate('dog')
    expect(decide).toHaveBeenCalledWith(settings, { protocol: 1, operation: 'translate', term: 'dog' })
  })
})
