import { describe, expect, it } from 'vitest'
import { checkClueLegality } from '../engine/legality'
import type { BoardWord } from '../engine/types'
import { danish } from '../lang/da'
import { CITY1_BOARD_CYCLE } from './city1BoardCycle'
import rawClues from './city1-playtest-clues.da.json'
import { wordById } from './words'

// The shipped City 1 bank comes with precomputed Casey clue groups, generated
// alongside the cycle itself by scripts/bank-to-city1-cycle.mjs. The offline
// board-engine verifier that produced them approximates clue legality; this
// test is the authority — it runs the real engine rule with the real Danish
// pack over every precomputed clue against its full board.
interface ClueGroup {
  clue: string
  clueEnglish: string
  targetWordIds: string[]
}
interface PlaytestBoard {
  id: string
  wordIds: string[]
  aiGreenIds: string[]
  caseyClueGroups: ClueGroup[]
}

const bank = rawClues as { boards: PlaytestBoard[] }

const toBoardWord = (id: string): BoardWord => {
  const w = wordById(id)
  if (!w) throw new Error(`unknown word ${id}`)
  return { wordId: w.id, da: w.da, en: w.en, pos: w.pos, article: w.article }
}

describe('the City 1 bank and its precomputed Casey clues', () => {
  it('matches the app cycle board for board', () => {
    expect(bank.boards).toHaveLength(CITY1_BOARD_CYCLE.length)
    expect(bank.boards.map((b) => b.id)).toEqual(CITY1_BOARD_CYCLE.map((b) => b.id))
    for (const [i, b] of bank.boards.entries()) {
      expect(b.wordIds).toEqual(CITY1_BOARD_CYCLE[i]!.wordIds)
      expect(b.aiGreenIds).toEqual(CITY1_BOARD_CYCLE[i]!.aiGreenIds)
    }
  })

  it('gives every precomputed Casey clue a legal form and green-only targets', () => {
    for (const board of bank.boards) {
      const words = board.wordIds.map(toBoardWord)
      expect(board.caseyClueGroups.length).toBeGreaterThanOrEqual(5)
      for (const group of board.caseyClueGroups) {
        const verdict = checkClueLegality(group.clue, words, danish)
        expect(
          verdict.legal,
          `${board.id}: "${group.clue}" — ${verdict.reason ?? ''}`,
        ).toBe(true)
        expect(group.targetWordIds.length).toBeGreaterThanOrEqual(2)
        for (const target of group.targetWordIds) {
          expect(board.aiGreenIds, `${board.id}: ${group.clue} -> ${target}`).toContain(target)
        }
      }
    }
  })

  // The English gloss is a convenience for the owner reading a board, not
  // something a player ever sees, and the research gloss file does not cover
  // every clue the generator uses. So an unglossed clue ships with an empty
  // string rather than blocking the bank — but the coverage is pinned, because
  // a converter that silently stopped reading gloss.json would look exactly
  // like a thin gloss file.
  it('glosses most Casey clues and leaves the rest an explicit empty string', () => {
    const groups = bank.boards.flatMap((board) => board.caseyClueGroups)
    for (const group of groups) expect(typeof group.clueEnglish).toBe('string')
    const glossed = groups.filter((group) => group.clueEnglish.trim().length > 0).length
    expect(glossed / groups.length).toBeGreaterThan(0.9)
  })
})
