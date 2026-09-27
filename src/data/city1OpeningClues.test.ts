import { describe, expect, it } from 'vitest'
import { checkClueLegality } from '../engine/legality'
import type { BoardWord } from '../engine/types'
import { danish } from '../lang/da'
import { CITY1_BOARD_CYCLE, CITY1_BOARD_CYCLE_SOURCE_SHA256 } from './city1BoardCycle'
import rawOpening from './city1-opening-clues.da.json'
import { authoredFirstClue } from '../../proxy/casey/authored-clues.js'
import { wordById } from './words'

/**
 * The baked OPENING clue is the authority the client reads before any network
 * (owner decision 2026-09-18: the first clue is IN the app). This test is its
 * drift alarm: it rebuilds the same canonical opening view the bake script
 * built and asserts the file still says EXACTLY what the real
 * `authoredFirstClue` — the Worker's own code — answers today. A regenerated
 * bank without a re-bake fails here rather than at play.
 *
 * It imports `proxy/casey/authored-clues.js` the way `orchestrator.test.mjs`
 * imports proxy modules: vitest resolves the JSON import fine. Only the FIRST
 * path step crosses into the client — the baked file carries four fields and
 * nothing else from the bank.
 */
interface BakedOpening {
  id: string
  clue: string
  clueEnglish: string
  targetWordIds: string[]
}

const bank = rawOpening as { schemaVersion: number; sourceSha256: string; boards: BakedOpening[] }

/** The same canonical opening view scripts/bake-opening-clues.mjs builds. */
const openingView = (board: (typeof CITY1_BOARD_CYCLE)[number]) => ({
  kind: 'ai-clue' as const,
  clueLanguage: 'target' as const,
  turnsLeft: 8,
  words: board.wordIds.map((id) => {
    const entry = wordById(id)
    if (!entry) throw new Error(`authored board ${board.id} names an unknown word: ${id}`)
    return {
      id,
      da: entry.da,
      en: entry.en,
      pos: entry.pos,
      reveal: { kind: 'hidden' } as const,
      roleOnMyKey: (board.aiGreenIds.includes(id) ? 'green' : 'bystander') as 'green' | 'bystander',
    }
  }),
  history: [],
  flagged: [],
  boardId: board.id,
})

const toBoardWord = (id: string): BoardWord => {
  const w = wordById(id)
  if (!w) throw new Error(`unknown word ${id}`)
  return { wordId: w.id, da: w.da, en: w.en, pos: w.pos, article: w.article }
}

describe('the baked opening clues', () => {
  it('carries one entry per authored board, sorted by id, pinned to the cycle', () => {
    expect(bank.schemaVersion).toBe(1)
    expect(bank.sourceSha256).toBe(CITY1_BOARD_CYCLE_SOURCE_SHA256)
    expect(bank.boards).toHaveLength(CITY1_BOARD_CYCLE.length)
    expect(bank.boards.map((b) => b.id)).toEqual(CITY1_BOARD_CYCLE.map((b) => b.id))
    const sorted = [...bank.boards].map((b) => b.id).sort()
    expect(bank.boards.map((b) => b.id)).toEqual(sorted)
  })

  it('says EXACTLY what the real authoredFirstClue answers for a canonical fresh view', () => {
    for (const [index, board] of CITY1_BOARD_CYCLE.entries()) {
      const baked = bank.boards[index]!
      const opening = authoredFirstClue(openingView(board))
      expect(opening, `${board.id}: the bank answers no opening`).not.toBeNull()
      expect(baked.clue, `${board.id}: clue`).toBe(opening!.clue)
      expect(baked.clueEnglish, `${board.id}: clueEnglish`).toBe(opening!.clueEnglish)
      expect(baked.targetWordIds, `${board.id}: targetWordIds`).toEqual(opening!.targetWordIds)
    }
  })

  it('targets only words on Casey\'s key and keeps a legal clue against the full board', () => {
    for (const [index, board] of CITY1_BOARD_CYCLE.entries()) {
      const baked = bank.boards[index]!
      expect(baked.targetWordIds.length).toBeGreaterThanOrEqual(2)
      for (const id of baked.targetWordIds) {
        expect(board.aiGreenIds, `${board.id}: ${baked.clue} -> ${id}`).toContain(id)
      }
      const words = board.wordIds.map(toBoardWord)
      const verdict = checkClueLegality(baked.clue, words, danish)
      expect(verdict.legal, `${board.id}: «${baked.clue}» — ${verdict.reason ?? ''}`).toBe(true)
    }
  })

  it('carries nothing beyond the four opening fields', () => {
    for (const entry of bank.boards) {
      expect(Object.keys(entry).sort()).toEqual(['clue', 'clueEnglish', 'id', 'targetWordIds'])
    }
  })
})