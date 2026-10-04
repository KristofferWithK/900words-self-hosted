import danish from './city1-board-cycle.da.json'
import danishAppendix from './city1-board-cycle-appendix.da.json'
import german from './city1-board-cycle.de.json'
import germanAppendix from './city1-board-cycle-appendix.de.json'
import { ACTIVE } from '../lang/active'
import type { Side } from '../engine/types'

export interface City1AuthoredBoard {
  id: string
  seedHex: string
  firstGiver: Side
  greenOverlap: 1 | 2 | 3
  wordIds: string[]
  playerGreenIds: string[]
  aiGreenIds: string[]
}

/**
 * Danish deals from the 150-board archive and then the verified boards appended
 * after it (bank_151 onward, scripts/bank-to-city1-cycle.mjs). The two files stay
 * separate because the archive's bytes are pinned by the frozen City 1 review
 * evidence; an id is still one board, wherever it is read from. German is the
 * same boards card for card, appended the same way
 * (scripts/german-city1-course.mjs).
 */
export const CITY1_BOARD_CYCLES = {
  da: [...danish.boards, ...danishAppendix.boards] as City1AuthoredBoard[],
  de: [...german.boards, ...germanAppendix.boards] as City1AuthoredBoard[],
} as const
const raw = ACTIVE.code === 'de' ? german : danish

export const CITY1_BOARD_CYCLE_SCHEMA_VERSION = raw.schemaVersion
export const CITY1_BOARD_CYCLE_SOURCE_SHA256 = raw.sourceSha256
export const CITY1_BOARD_CYCLE = CITY1_BOARD_CYCLES[ACTIVE.code]

export function city1BoardAt(cursor: number): City1AuthoredBoard {
  const normalized = ((Math.trunc(cursor) % CITY1_BOARD_CYCLE.length) + CITY1_BOARD_CYCLE.length) % CITY1_BOARD_CYCLE.length
  return CITY1_BOARD_CYCLE[normalized]!
}

export function nextCity1BoardCursor(cursor: number): number {
  return (Math.trunc(cursor) + 1) % CITY1_BOARD_CYCLE.length
}
