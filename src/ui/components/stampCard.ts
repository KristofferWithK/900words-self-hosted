import { cafeNameForBoard } from '../../cafe/cafeName'
import type { Cafe } from '../../journey/cafes'
import { cityStampCard } from '../../journey/progress'
import { boardKey } from '../../progression/identity'
import { cafeStamp, MEDAL_LEVELS, medalForPoints } from '../../progression/rules'
import type { BoardIdentity, ProgressFacts, RequiredBoardSet, Tier } from '../../progression/types'
import { displayCityPercent } from './finishStamp'

/**
 * The city's stamp card (docs/roadmap/cafe-world.md section 6, card CW-11):
 * the board collection, one cell per café, read from what the board game and
 * the walks already wrote. It decides nothing: stamps are `cafeStamp` over
 * the saved facts (a won round's best, or Bronze for a café only ever lost),
 * found/played is CW-04's `cafesForCity`, and the replay rule is the
 * collection's old one, unchanged.
 *
 * A cell is one of:
 * - `stamped`: the café's stamp, in that tier's ink. A café only ever lost is
 *   Bronze (owner, 4 October 2026: a completed loss earns a Bronze stamp).
 * - `found`: found on a walk, not played yet. A dashed circle.
 * - `unfound`: not found yet. "?".
 *
 * There is no "played, no stamp" cell any more: every completed round leaves
 * a best or a completed loss, and either is a stamp. The one record that
 * counts as played without either (a first primary completion, which
 * settlement only ever writes beside a best) would read as `found`.
 */
export type StampCellState = 'stamped' | 'found' | 'unfound'

export interface StampCell {
  /** Place in the city's required order, from 1. */
  readonly displayNumber: number
  readonly stableId: string
  readonly board: BoardIdentity
  /** The café's name; null where the board has none yet (`cafeNameForBoard`). */
  readonly name: string | null
  readonly state: StampCellState
  /** The stamp; null for every state but `stamped`. */
  readonly tier: Tier | null
  /**
   * Opens the replay detail. The collection's rule from before CW-11, kept
   * as it was: a board with a best, or a completed loss on record.
   */
  readonly replayable: boolean
}

export function stampCells(required: RequiredBoardSet, facts: ProgressFacts, cafes: readonly Cafe[] | null): StampCell[] {
  return required.boards.map((board, index) => {
    const key = boardKey(board)
    const best = facts.boards[key]?.best ?? null
    const lost = Object.hasOwn(facts.completedLosses, key)
    const tier = cafeStamp(best, lost)
    const cafe = cafes?.find((c) => c.board.authoredBoardId === board.authoredBoardId)
    const state: StampCellState = tier ? 'stamped' : cafe && cafe.state !== 'unfound' ? 'found' : 'unfound'
    return {
      displayNumber: index + 1,
      stableId: board.authoredBoardId,
      board,
      name: cafeNameForBoard(board),
      state,
      tier,
      replayable: best !== null || lost,
    }
  })
}

export interface StampCardSummary {
  /** Floored, as the finish screen and Home show it. */
  readonly percent: number
  readonly medal: Tier | null
  /** The next medal and its level, or null at Platinum. */
  readonly next: { readonly tier: Tier; readonly percent: number } | null
  readonly stamped: number
  readonly cafes: number
}

export function stampCardSummary(facts: ProgressFacts, required: RequiredBoardSet | null): StampCardSummary {
  const card = cityStampCard(facts, required)
  if (card.error) return { percent: 0, medal: null, next: MEDAL_LEVELS[0]!, stamped: 0, cafes: 0 }
  const next = MEDAL_LEVELS.find((level) => card.points * 100 < level.percent * card.maximum) ?? null
  return {
    percent: displayCityPercent(card.points, card.maximum),
    medal: medalForPoints(card.points, card.maximum),
    next,
    stamped: card.stamped,
    cafes: card.cafes,
  }
}

export interface StampCardCopy {
  readonly cafeNumber: (number: number) => string
  readonly cellStamped: (cafe: string, stamp: string) => string
  readonly cellFound: (cafe: string) => string
  readonly cellNotFound: (number: number) => string
}

/** The café's name for the screen reader, never "?": a café with no name yet is "Café 12". */
export const cellName = (cell: Pick<StampCell, 'name' | 'displayNumber'>, copy: Pick<StampCardCopy, 'cafeNumber'>): string =>
  cell.name ?? copy.cafeNumber(cell.displayNumber)

/** A cell's accessible name: the café and its state, e.g. "Café Solen: Gold stamp". */
export function cellAria(cell: StampCell, copy: StampCardCopy, stampWord: (tier: Tier) => string): string {
  switch (cell.state) {
    case 'stamped': return copy.cellStamped(cellName(cell, copy), stampWord(cell.tier!))
    case 'found': return copy.cellFound(cellName(cell, copy))
    case 'unfound': return copy.cellNotFound(cell.displayNumber)
  }
}
