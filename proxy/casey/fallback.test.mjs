import { describe, expect, it, vi } from 'vitest'
import words from '../../src/data/words.da.json'
import bank from '../data/authored-clues.da.1.json'
import { indexedWordIdsFor } from './association-index.js'
import { authoredClueCandidates } from './authored-clues.js'
import { CaseyServiceError, decide, parseDecisionRequest } from './orchestrator.js'
import { privateAdviceMentioned } from './voice.js'

/**
 * Casey always plays (owner, 2026-09-07): when the model gives up or cannot
 * be reached, the Worker gives the best clue its own data stands behind, or
 * guesses from the index, and the ledger arm says so.
 */
const byId = new Map(words.map((word) => [word.id, word]))
const board1 = bank.boards[0]
const clueView = (board = board1) => ({
  kind: 'ai-clue',
  clueLanguage: 'target',
  turnsLeft: 8,
  words: board.wordIds.map((id) => {
    const entry = byId.get(id)
    return {
      id,
      da: entry.da,
      en: entry.en,
      pos: entry.pos,
      reveal: { kind: 'hidden' },
      roleOnMyKey: board.aiGreenIds.includes(id) ? 'green' : 'bystander',
    }
  }),
  history: [],
  flagged: [],
  boardId: board.id,
})
const guessView = (view, text, number) => ({
  kind: 'ai-guess',
  clueLanguage: 'target',
  turnsLeft: view.turnsLeft,
  words: view.words.map(({ roleOnMyKey: _role, ...word }) => word),
  currentClue: { text, number },
  history: [],
  flagged: [],
  boardId: view.boardId,
})
const request = (operation, view) => parseDecisionRequest({ protocol: 1, operation, view })
const garbage = () => vi.fn(async () => 'this is not json')
const unreachable = () =>
  vi.fn(async () => {
    throw new CaseyServiceError('upstream_unavailable', 'Casey’s model could not be reached.', 502)
  })

describe('Casey always gives a clue', () => {
  it('gives the bank’s first-choice group when the model never answers validly', async () => {
    // Mid-round, not the opening: the opening never reaches the model at all
    // (owner, 2026-09-17 — it is served from the bank before any prompt).
    const view = { ...clueView(), history: [{ by: 'ai', text: 'opstilling', number: 2, guesses: [] }] }
    const first = authoredClueCandidates(view)[0]
    const askModel = garbage()

    const result = await decide(request('clue', view), askModel, 'cluey')

    expect(askModel).toHaveBeenCalledTimes(4) // the reply and three corrections
    expect(result.decision.clue).toBe(first.clue)
    expect(result.decision.targetWordIds).toEqual(first.targetWordIds)
    expect(result.decision.number).toBe(first.targetWordIds.length)
    expect(result.report).toEqual({ arm: 'cluey+fallback-bank', refused: true })
    // What the player reads: the words, in a player's voice, nothing private.
    for (const id of first.targetWordIds) expect(result.decision.rationale).toContain(byId.get(id).da)
    expect(privateAdviceMentioned(result.decision.rationale)).toBeNull()
  })

  it('gives it when the model cannot be reached at all, in one attempt', async () => {
    const view = {
      ...clueView(bank.boards[3]),
      history: [{ by: 'player', text: 'huskeliste', number: 2, guesses: [] }],
    }
    const askModel = unreachable()
    const result = await decide(request('clue', view), askModel, 'cluey')
    expect(askModel).toHaveBeenCalledOnce()
    expect(result.decision.clue).toBe(authoredClueCandidates(view)[0].clue)
    expect(result.report.arm).toBe('cluey+fallback-bank')
  })

  it('does not paper over a misconfigured server or a quota stop', async () => {
    const askModel = vi.fn(async () => {
      throw new CaseyServiceError('server_not_configured', 'missing secret', 503)
    })
    // Mid-round again: an authored OPENING never reaches a model (owner,
    // 2026-09-17), so the misconfiguration surfaces only on later clues.
    const view = { ...clueView(), history: [{ by: 'ai', text: 'opstilling', number: 2, guesses: [] }] }
    await expect(decide(request('clue', view), askModel, 'cluey')).rejects.toMatchObject({ code: 'server_not_configured' })
  })

  it('still fails, and says so, on a board none of its data covers', async () => {
    const city3 = words.filter((word) => word.curriculumRank >= 201 && word.curriculumRank <= 300)
    const view = {
      kind: 'ai-clue',
      clueLanguage: 'target',
      turnsLeft: 5,
      words: [city3[0], city3[1], city3[2]].map((word, i) => ({
        id: word.id,
        da: word.da,
        en: word.en,
        pos: word.pos,
        reveal: { kind: 'hidden' },
        roleOnMyKey: i < 2 ? 'green' : 'bystander',
      })),
      history: [],
      flagged: [],
    }
    await expect(decide(request('clue', view), garbage(), 'cluey')).rejects.toMatchObject({ code: 'invalid_model_reply' })
  })

  it('names where a clue the model DID give came from: bank, index or its own', async () => {
    // Mid-round: the opening is the bank's before the model is ever asked.
    const view = { ...clueView(), history: [{ by: 'player', text: 'huskeliste', number: 2, guesses: [] }] }
    const first = authoredClueCandidates(view)[0]
    const askModel = vi.fn(async () =>
      JSON.stringify({
        clue: first.clue,
        number: first.targetWordIds.length,
        targetWordIds: first.targetWordIds,
        rationale: 'These three sit in the same stretch of the calendar for me.',
      }),
    )
    const result = await decide(request('clue', view), askModel, 'cluey')
    expect(result.report).toEqual({ arm: 'cluey+bank', refused: false })
  })
})

describe('Casey always guesses', () => {
  it('guesses from the index when the model gives up on a clue the index knows', async () => {
    const view = clueView()
    // Casey's own bank clue, given by the player: indexed, not made for the
    // player's key, so it goes to the model — which never answers validly.
    const clue = authoredClueCandidates(view)[0].clue
    const linked = indexedWordIdsFor(clue)
    expect(linked).not.toBeNull()
    const askModel = garbage()

    const result = await decide(request('guess', guessView(view, clue, 3)), askModel, 'cluey')

    expect(askModel).toHaveBeenCalledTimes(4)
    expect(result.decision.guesses.length).toBeGreaterThan(0)
    expect(result.decision.guesses.length).toBeLessThanOrEqual(3)
    for (const guess of result.decision.guesses) {
      expect(linked).toContain(guess.wordId)
      expect(privateAdviceMentioned(guess.reasoning)).toBeNull()
    }
    expect(result.report).toEqual({ arm: 'cluey+fallback-index', refused: true })
  })

  it('bounds index fallback to top-two alternatives in assisted mode', async () => {
    const view = clueView()
    const clue = authoredClueCandidates(view)[0].clue
    const assisted = parseDecisionRequest({
      protocol: 1,
      operation: 'guess',
      view: guessView(view, clue, 4),
      candidateMode: 'top-two',
    })
    const result = await decide(assisted, garbage(), 'cluey')
    expect(result.decision.guesses.length).toBeGreaterThan(0)
    expect(result.decision.guesses.length).toBeLessThanOrEqual(2)
    expect(result.report.arm).toBe('cluey+fallback-index')
  })

  it('chooses assisted fallback capacity before a clue-one truncation', async () => {
    const view = clueView()
    const clue = authoredClueCandidates(view)[0].clue
    const assisted = parseDecisionRequest({
      protocol: 1,
      operation: 'guess',
      view: guessView(view, clue, 1),
      candidateMode: 'top-two',
    })
    const result = await decide(assisted, garbage(), 'cluey')
    expect(result.decision.guesses).toHaveLength(2)

    const [kept, ...removed] = result.decision.guesses.map((guess) => guess.wordId)
    const singletonView = guessView(view, clue, 1)
    singletonView.words = singletonView.words.map((word) => ({
      ...word,
      reveal: removed.includes(word.id) ? { kind: 'green' } : word.reveal,
    }))
    const singleton = await decide(parseDecisionRequest({
      protocol: 1,
      operation: 'guess',
      view: singletonView,
      candidateMode: 'top-two',
    }), garbage(), 'cluey')
    expect(singleton.decision.guesses[0].wordId).toBe(kept)
    expect(singleton.decision.guesses.length).toBeGreaterThanOrEqual(1)
  })

  it('has nothing to offer for a clue the index does not know, and says so', async () => {
    const view = clueView()
    await expect(
      decide(request('guess', guessView(view, 'zzzunknownclue', 2)), garbage(), 'cluey'),
    ).rejects.toMatchObject({ code: 'invalid_model_reply' })
  })
})
