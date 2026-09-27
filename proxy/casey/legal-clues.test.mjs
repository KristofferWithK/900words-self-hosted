import { describe, expect, it } from 'vitest'
import words from '../../src/data/words.da.json'
import indexRaw from '../data/association-index.da.1.json'
import bank from '../data/authored-clues.da.1.json'
import legal from '../data/legal-index-clues.da.1.json'
import { deriveLegalIndexClues, illegalPositionsFor } from '../../scripts/generate-legal-index-clues.mjs'
import {
  associationIndexInfo,
  clueAssociationCandidates,
  computeLegalIndexKeys,
  legalityPrecomputedFor,
} from './association-index.js'
import { checkClueLegality, normalize } from './language.js'

/**
 * Which index clues are legal on an authored board is precomputed
 * (scripts/generate-legal-index-clues.mjs), because computing it cost about a
 * second of CPU per new board in the real Worker bundle (2026-09-07). These
 * pin that the file covers the bank, says what computing would say, and that
 * a board it does not know still gets an answer.
 */
const index = typeof indexRaw === 'string' ? JSON.parse(indexRaw) : indexRaw
const byId = new Map(words.map((word) => [word.id, word]))
const viewFor = (board, wordIds = board.wordIds) => ({
  kind: 'ai-clue',
  clueLanguage: 'target',
  turnsLeft: 8,
  words: wordIds.map((id) => {
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
const fileKeysFor = (board) => {
  const row = legal.boards.find((entry) => entry.board === board.id)
  const skip = new Set(row.illegal)
  return index.clues.map(([clue]) => normalize(clue)).filter((_, position) => !skip.has(position))
}

describe('the precomputed legal index clues', () => {
  it('cover every authored board and pin the index they were derived from', () => {
    expect(legal.protocol).toBe(1)
    expect(legal.source.associationIndexSha256).toBe(associationIndexInfo.sourceSha256)
    expect(legal.clueCount).toBe(associationIndexInfo.clueCount)
    expect(legal.boards).toHaveLength(bank.boards.length)
    for (const board of bank.boards) expect(legalityPrecomputedFor(viewFor(board))).toBe(true)
    // Few clues are illegal on any board: a board word, a form, a compound or a translation of one.
    for (const row of legal.boards) expect(row.illegal.length).toBeLessThan(legal.clueCount / 10)
  })

  it('say exactly what computing legality says, and re-derive from the sources', () => {
    for (const board of [bank.boards[0], bank.boards[77]]) {
      expect(fileKeysFor(board)).toEqual(computeLegalIndexKeys(viewFor(board)))
    }
    const sampleIndex = { ...index, clues: index.clues.slice(0, 64) }
    const derived = deriveLegalIndexClues({ index: sampleIndex, bank, words }, new Set([bank.boards[149].id]))
    const stored = legal.boards.find((row) => row.board === bank.boards[149].id)
    expect(derived.boards[0]).toMatchObject({ board: stored.board, wordKey: stored.wordKey })
    expect(derived.boards[0].illegal).toEqual(stored.illegal.filter((position) => position < sampleIndex.clues.length))
  })

  it('unions singleton legality once per unique board word and matches direct checks', () => {
    const fixtureIndex = {
      source: { sha256: 'fixture' },
      clues: [['tid', {}], ['tiden', {}], ['hund', {}], ['hånd', {}], ['huset', {}], ['time', {}]],
    }
    const fixtureWords = [
      { id: 'da:tid', da: 'tid', en: ['time'], pos: 'noun' },
      { id: 'da:hund', da: 'hund', en: ['dog'], pos: 'noun' },
      { id: 'da:hus', da: 'hus', en: ['house'], pos: 'noun' },
    ]
    const fixtureBank = {
      boards: [
        { id: 'bank_a', wordIds: ['da:tid', 'da:hund'] },
        { id: 'bank_b', wordIds: ['da:tid', 'da:hus'] },
      ],
    }
    let calls = 0
    const checkedWordCounts = new Set()
    const countedCheck = (clue, boardWords) => {
      calls++
      checkedWordCounts.add(boardWords.length)
      return checkClueLegality(clue, boardWords)
    }

    const derived = deriveLegalIndexClues(
      { index: fixtureIndex, bank: fixtureBank, words: fixtureWords },
      null,
      countedCheck,
    )

    expect(calls).toBe(fixtureIndex.clues.length * fixtureWords.length)
    expect(checkedWordCounts).toEqual(new Set([1]))
    expect(derived.boards.map((row) => row.board)).toEqual(['bank_a', 'bank_b'])
    for (const [row, board] of derived.boards.map((row, index) => [row, fixtureBank.boards[index]])) {
      const boardWords = board.wordIds.map((id) => {
        const word = fixtureWords.find((entry) => entry.id === id)
        return { da: word.da, en: word.en, pos: word.pos }
      })
      expect(row.illegal).toEqual(illegalPositionsFor(fixtureIndex, boardWords))
    }
  })

  it('matches direct checking on representative authored boards', () => {
    const representativeBoards = [bank.boards[0], bank.boards[77]]
    const boardWordSpellings = new Set(
      representativeBoards.flatMap((board) =>
        board.wordIds.map((id) => normalize(byId.get(id).da)),
      ),
    )
    const sampleIndex = {
      ...index,
      clues: index.clues.filter(([clue], position) => position < 20 || boardWordSpellings.has(normalize(clue))),
    }
    const sampleBank = { boards: representativeBoards }
    const derived = deriveLegalIndexClues({ index: sampleIndex, bank: sampleBank, words })

    for (const [row, board] of derived.boards.map((row, i) => [row, representativeBoards[i]])) {
      const boardWords = board.wordIds.map((id) => {
        const word = byId.get(id)
        return { da: word.da, en: word.en, pos: word.pos }
      })
      expect(row.illegal).toEqual(illegalPositionsFor(sampleIndex, boardWords))
    }
  })

  it('answer a fresh authored board in milliseconds, not the second computing it costs', () => {
    const t = performance.now()
    const candidates = clueAssociationCandidates(viewFor(bank.boards[5]))
    expect(performance.now() - t).toBeLessThan(150)
    expect(candidates.length).toBeGreaterThan(0)
  })

  it('still compute a board the file does not know', () => {
    const board = bank.boards[0]
    const replacement = bank.boards[1].wordIds.find((id) => !board.wordIds.includes(id))
    const view = viewFor(board, [...board.wordIds.slice(0, -1), replacement])
    expect(legalityPrecomputedFor(view)).toBe(false)
    const candidates = clueAssociationCandidates(view)
    expect(candidates.length).toBeGreaterThan(0)
    const legalKeys = new Set(computeLegalIndexKeys(view))
    for (const candidate of candidates) expect(legalKeys.has(normalize(candidate.clue))).toBe(true)
  })
})
