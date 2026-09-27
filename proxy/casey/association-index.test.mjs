import { describe, expect, it, vi } from 'vitest'
import boardsRaw from '../../src/data/city1-board-cycle.da.json'
import replacementRaw from '../../src/data/city1-replacement-corpus.da.json'
import wordsRaw from '../../src/data/words.da.json'
import { checkClueLegality, normalize } from './language.js'
import {
  associationIndexInfo,
  buildClueAssociationContext,
  buildGuessAssociationContext,
  clueAssociationCandidates,
  computeLegalIndexKeys,
  guessAssociationLookup,
  legalWordCacheHitCount,
  legalWordCacheSize,
  supportsAssociationBoard,
} from './association-index.js'
import { decide, parseDecisionRequest } from './orchestrator.js'

const boards = typeof boardsRaw === 'string' ? JSON.parse(boardsRaw) : boardsRaw
const replacement = typeof replacementRaw === 'string' ? JSON.parse(replacementRaw) : replacementRaw
const words = typeof wordsRaw === 'string' ? JSON.parse(wordsRaw) : wordsRaw
const byId = new Map(words.map((word) => [word.id, word]))

const publicWord = (id, roleOnMyKey) => {
  const word = byId.get(id)
  if (!word) throw new Error(`missing fixture word ${id}`)
  return { id, da: word.da, en: word.en, pos: word.pos, reveal: { kind: 'hidden' }, roleOnMyKey }
}

function clueView(board = boards.boards[0]) {
  const greens = new Set(board.aiGreenIds)
  return {
    kind: 'ai-clue',
    clueLanguage: 'target',
    turnsLeft: 8,
    words: board.wordIds.map((id) => publicWord(id, greens.has(id) ? 'green' : 'bystander')),
    history: [],
    flagged: [],
  }
}

function guessView(view, clue, number) {
  return {
    kind: 'ai-guess',
    clueLanguage: 'target',
    turnsLeft: view.turnsLeft,
    words: view.words.map(({ roleOnMyKey: _role, ...word }) => word),
    currentClue: { text: clue, number },
    history: view.history,
    flagged: view.flagged,
  }
}

describe('the replacement City 1 private association index', () => {
  it('pins the exact forward-source metrics and activates only on covered boards', () => {
    expect(associationIndexInfo).toEqual({
      wordCount: 100,
      edgeCount: 51_213,
      clueCount: 7_595,
      minDegree: 2,
      maxDegree: 74,
      sourceSha256: '6a6e669768db0d0ded6d73cae1d649af4db26f9c67c3dda8c7fb005debd12289',
      scope: 'replacement-city1-first-100',
    })
    const view = clueView()
    expect(supportsAssociationBoard(view)).toBe(true)

    const roster = new Set(replacement.wordIds)
    const outside = words.find((word) => !roster.has(word.id))
    expect(outside).toBeDefined()
    expect(supportsAssociationBoard({ ...view, words: [...view.words.slice(0, -1), publicWord(outside.id, 'bystander')] })).toBe(false)
  })

  it('offers legal, diverse multi-target starts while exposing other indexed board pulls', () => {
    const view = clueView()
    const candidates = clueAssociationCandidates(view)
    const greenIds = new Set(view.words.filter((word) => word.roleOnMyKey === 'green').map((word) => word.id))
    const board = view.words.map(({ da, en, pos }) => ({ da, en, pos }))

    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates.length).toBeLessThanOrEqual(12)
    for (const candidate of candidates) {
      expect(candidate.targetWordIds.length).toBeGreaterThanOrEqual(2)
      expect(candidate.targetWordIds.length).toBeLessThanOrEqual(4)
      expect(candidate.targetWordIds.every((id) => greenIds.has(id))).toBe(true)
      expect(candidate.otherBoardWordIds.every((id) => !candidate.targetWordIds.includes(id))).toBe(true)
      expect(checkClueLegality(candidate.clue, board).legal).toBe(true)
    }
    expect(new Set(candidates.map((candidate) => candidate.targetWordIds.join('|'))).size).toBeGreaterThan(1)
    const context = buildClueAssociationContext(view)
    expect(context).toContain('PRIVATE ASSOCIATION INDEX — FIRST PATH')
    expect(context).toContain('missing link means unknown')
    expect(context).toContain('other live board pulls')
    expect(context).toContain('Reject them all')
  })

  it('reuses bounded singleton legality across nonauthored boards sharing words', () => {
    const base = clueView()
    const baseIds = new Set(base.words.map((word) => word.id))
    const replacementA = boards.boards[1].wordIds.find((id) => !baseIds.has(id))
    const replacementB = boards.boards[2].wordIds.find((id) => !baseIds.has(id) && id !== replacementA)
    expect(replacementA).toBeDefined()
    expect(replacementB).toBeDefined()

    const withReplacement = (id) => ({
      ...base,
      words: [...base.words.slice(0, -1), publicWord(id, 'bystander')],
    })
    const initialHits = legalWordCacheHitCount()
    const first = withReplacement(replacementA)
    const firstCandidates = clueAssociationCandidates(first)
    expect(firstCandidates.length).toBeLessThanOrEqual(12)
    const firstCacheSize = legalWordCacheSize()
    expect(firstCacheSize).toBeLessThanOrEqual(associationIndexInfo.wordCount)
    expect(legalWordCacheHitCount() - initialHits).toBeGreaterThanOrEqual(first.words.length)

    const second = withReplacement(replacementB)
    const beforeSecond = legalWordCacheSize()
    const hitsBeforeSecond = legalWordCacheHitCount()
    const secondCandidates = clueAssociationCandidates(second)
    expect(secondCandidates.length).toBeLessThanOrEqual(12)
    expect(legalWordCacheSize() - beforeSecond).toBeLessThanOrEqual(1)
    expect(legalWordCacheHitCount() - hitsBeforeSecond).toBeGreaterThanOrEqual(second.words.length)
    const liveBoard = second.words
      .filter((word) => word.reveal?.kind !== 'green')
      .map(({ da, en, pos }) => ({ da, en, pos }))
    for (const candidate of secondCandidates) expect(checkClueLegality(candidate.clue, liveBoard).legal).toBe(true)
  })

  it('omits found green words from legality but keeps neutral words restrictive', () => {
    const clue = clueAssociationCandidates(clueView())[0].clue
    const board = (reveal) => ({
      words: [{
        id: 'da:fixture',
        da: clue,
        en: [],
        pos: 'noun',
        reveal,
      }],
    })

    expect(computeLegalIndexKeys(board({ kind: 'green' }))).toContain(normalize(clue))
    expect(computeLegalIndexKeys(board({ kind: 'bystander', against: ['ai'] }))).not.toContain(normalize(clue))
  })

  it('uses exact clue lookup for guessing and derives no hidden key information', () => {
    const original = clueView()
    const candidate = clueAssociationCandidates(original)[0]
    const view = guessView(original, candidate.clue.toUpperCase(), candidate.targetWordIds.length)
    const lookup = guessAssociationLookup(view)

    expect(lookup.matched).toBe(true)
    expect(lookup.wordIds).toEqual(expect.arrayContaining(candidate.targetWordIds))
    const context = buildGuessAssociationContext(view)
    expect(context).toContain('currently guessable board words')
    expect(context).toContain('no key information')
    expect(context).not.toMatch(/roleOnMyKey|my key:|proposed targets/i)

    const permuted = {
      ...original,
      words: original.words.map((word) => ({
        ...word,
        roleOnMyKey: word.roleOnMyKey === 'green' ? 'bystander' : 'green',
      })),
    }
    expect(buildGuessAssociationContext(guessView(permuted, candidate.clue, candidate.targetWordIds.length))).toBe(
      buildGuessAssociationContext(guessView(original, candidate.clue, candidate.targetWordIds.length)),
    )

    const loose = guessView(original, `${candidate.clue}x`, candidate.targetWordIds.length)
    expect(guessAssociationLookup(loose)).toMatchObject({ matched: false, wordIds: [] })
    expect(buildGuessAssociationContext(loose)).toContain('no exact normalized entry')
  })

  it('actually places the compact packet in Casey’s first model call and never returns it to the app', async () => {
    const view = clueView()
    const candidate = clueAssociationCandidates(view)[0]
    const askModel = vi.fn(async () =>
      JSON.stringify({
        clue: candidate.clue,
        number: candidate.targetWordIds.length,
        targetWordIds: candidate.targetWordIds,
        // A player's sentence: the voice guard (voice.js) would send back a
        // rationale that named the index, and this test is about the packet
        // reaching the model, not about the guard.
        rationale: 'These two belong to the same everyday idea; the nearest other word is about something else.',
      }),
    )
    const request = parseDecisionRequest({ protocol: 1, operation: 'clue', view })

    const result = await decide(request, askModel, 'cluey')

    expect(askModel).toHaveBeenCalledOnce()
    const prompt = JSON.stringify(askModel.mock.calls[0][0])
    expect(prompt).toContain('PRIVATE ASSOCIATION INDEX — FIRST PATH')
    expect(prompt).toContain(candidate.clue)
    expect(result.decision.clue).toBe(candidate.clue)
    expect(result).not.toHaveProperty('associationIndex')
    expect(JSON.stringify(result)).not.toContain('sourceSha256')
  })

  it('leaves mixed and other-city boards on the existing model prompt', async () => {
    const city3 = words.filter((word) => word.curriculumRank >= 201 && word.curriculumRank <= 300)
    const view = {
      kind: 'ai-clue',
      clueLanguage: 'target',
      turnsLeft: 5,
      words: [publicWord(city3[0].id, 'green'), publicWord(city3[1].id, 'bystander')],
      history: [],
      flagged: [],
    }
    const askModel = vi.fn(async () =>
      JSON.stringify({ clue: 'prøveclue', number: 1, targetWordIds: [city3[0].id], rationale: 'Normal fallback.' }),
    )

    await decide(parseDecisionRequest({ protocol: 1, operation: 'clue', view }), askModel, 'cluey')

    expect(JSON.stringify(askModel.mock.calls[0][0])).not.toContain('PRIVATE ASSOCIATION INDEX')
  })
})
