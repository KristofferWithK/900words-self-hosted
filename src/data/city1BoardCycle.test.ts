import { describe, expect, it } from 'vitest'
import replacementCorpus from './city1-replacement-corpus.da.json'
import { wordById } from './words'
import {
  CITY1_BOARD_CYCLE,
  CITY1_BOARD_CYCLES,
  CITY1_BOARD_CYCLE_SCHEMA_VERSION,
  CITY1_BOARD_CYCLE_SOURCE_SHA256,
  city1BoardAt,
  nextCity1BoardCursor,
} from './city1BoardCycle'

// City 1 deals every ordinary round from this authored bank. The file is
// GENERATED — `node scripts/bank-to-city1-cycle.mjs <bank.json>` writes it and
// its companion clue file together from a board-engine bank — so the pins here
// are the shape the app depends on rather than a frozen list of boards: change
// the bank, re-run the converter, and these must still hold.
//
// The bank length is deliberately NOT pinned to a number, and neither is its
// order. It is persisted state's modulus (gameStore's city1BoardCursor), which
// is why growing or reordering the bank costs a persist version bump — see
// migrateGame. Nothing here may assume a particular count or a particular
// board at a particular index: a hundred boards and a hundred and fifty
// ordered easy-first have to pass the same file.
describe('the authored City 1 board cycle', () => {
  it('ships German as a separate 150-board cycle over its 100-word roster', () => {
    const germanBoards = CITY1_BOARD_CYCLES.de
    const germanWords = new Set(germanBoards.flatMap((board) => board.wordIds))
    expect(germanBoards).toHaveLength(150)
    expect(germanBoards[0]?.id).toBe('bank_001')
    expect(germanBoards.at(-1)?.id).toBe('bank_150')
    expect(new Set(germanBoards.map((board) => board.id)).size).toBe(150)
    expect(germanWords.size).toBe(100)
    expect([...germanWords].every((id) => id.startsWith('de:'))).toBe(true)
    for (const board of germanBoards) {
      expect(board.wordIds).toHaveLength(18)
      expect(board.wordIds.every((id) => germanWords.has(id))).toBe(true)
      expect(board.playerGreenIds.filter((id) => board.aiGreenIds.includes(id))).toHaveLength(board.greenOverlap)
    }
  })

  it('is a generated bank of at least the 18 boards one sitting can use', () => {
    expect(replacementCorpus.source).toEqual({
      schemaVersion: 2,
      checkpointId: 'city1-index-legality-v1',
      protocol: 'containment-meaning-v2',
      sha256: 'b27cf47eec93535d0303fb224472662b63a7da2fb58d6ce2831df36c7b72116c',
    })
    expect(CITY1_BOARD_CYCLE_SCHEMA_VERSION).toBe(1)
    // sha256 of the source bank file the converter read.
    expect(CITY1_BOARD_CYCLE_SOURCE_SHA256).toMatch(/^[0-9a-f]{64}$/)
    expect(CITY1_BOARD_CYCLE.length).toBeGreaterThanOrEqual(18)
    for (const board of CITY1_BOARD_CYCLE) {
      // Zero-padded to three by the converter, so a bank past 999 widens the
      // number rather than breaking the shape.
      expect(board.id).toMatch(/^bank_\d{3,}$/)
      expect(board.seedHex).toMatch(/^[0-9a-f]{8}$/)
      expect(['player', 'ai']).toContain(board.firstGiver)
    }
    expect(new Set(CITY1_BOARD_CYCLE.map((board) => board.id)).size).toBe(
      CITY1_BOARD_CYCLE.length,
    )
  })

  it('contains only replacement-corpus words and uses all three overlaps', () => {
    const city1 = new Set(replacementCorpus.wordIds)
    // 100 WORDS, not 100 boards: this is City 1's closed pool, which is fixed
    // at a hundred however many boards the bank draws out of it.
    expect(replacementCorpus.wordIds).toHaveLength(100)
    expect(city1.size).toBe(100)
    expect(replacementCorpus.wordIds.every((id) => wordById(id) !== undefined)).toBe(true)
    // The fixed 1,2,3,1,2,3… schedule went with the 18 authored boards: a
    // generated bank draws whatever mix its search found. What still has to
    // hold is that every overlap the config allows is actually played.
    const overlaps = new Set(CITY1_BOARD_CYCLE.map((board) => board.greenOverlap))
    expect([...overlaps].sort()).toEqual([1, 2, 3])
    for (const board of CITY1_BOARD_CYCLE) {
      expect(board.wordIds).toHaveLength(18)
      expect(new Set(board.wordIds).size).toBe(18)
      expect(board.wordIds.every((id) => city1.has(id))).toBe(true)
      expect(new Set(board.playerGreenIds).size).toBe(8)
      expect(new Set(board.aiGreenIds).size).toBe(8)
      expect(board.playerGreenIds.every((id) => board.wordIds.includes(id))).toBe(true)
      expect(board.aiGreenIds.every((id) => board.wordIds.includes(id))).toBe(true)
      // The declared overlap IS the real one: createGame validates the board
      // against config.greenOverlap, so a board whose keys disagree with its
      // own field throws at deal time rather than dealing something else.
      expect(board.playerGreenIds.filter((id) => board.aiGreenIds.includes(id))).toHaveLength(
        board.greenOverlap,
      )
    }
  })

  it('does not repeat a word layout or unordered pair of keys', () => {
    const wordLayouts = CITY1_BOARD_CYCLE.map((board) => [...board.wordIds].sort().join('|'))
    const keyPairs = CITY1_BOARD_CYCLE.map((board) =>
      [
        [...board.playerGreenIds].sort().join('|'),
        [...board.aiGreenIds].sort().join('|'),
      ]
        .sort()
        .join('::'),
    )
    expect(new Set(wordLayouts).size).toBe(CITY1_BOARD_CYCLE.length)
    expect(new Set(keyPairs).size).toBe(CITY1_BOARD_CYCLE.length)
  })

  it('wraps from the final board back to board one', () => {
    const last = CITY1_BOARD_CYCLE.length - 1
    expect(city1BoardAt(0).id).toBe(CITY1_BOARD_CYCLE[0]!.id)
    expect(city1BoardAt(last).id).toBe(CITY1_BOARD_CYCLE[last]!.id)
    expect(city1BoardAt(CITY1_BOARD_CYCLE.length).id).toBe(CITY1_BOARD_CYCLE[0]!.id)
    expect(nextCity1BoardCursor(last)).toBe(0)
    expect(nextCity1BoardCursor(0)).toBe(1)
  })
})
