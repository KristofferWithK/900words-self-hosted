import { language as namesLanguage, names as cafeNames } from '../data/city1-cafe-names.da.json'
import { boards as assignedBoards, cityId as assignedCityId } from './city1-cafe-assignment.da.json'
import type { BoardIdentity } from '../progression/types'

/** One café of the Danish Sønderborg course: its stable id, its name, and the item from its name. */
export interface Cafe {
  /** The names file's id ("cafe-solen"). Stable even if a name is corrected. */
  readonly id: string
  /** The Danish proper name ("Café Solen"). Never translated. */
  readonly name: string
  /** The names file's English suggestion for the one item from the name. Not player copy. */
  readonly signatureItem: string
}

const byId = new Map<string, Cafe>(
  cafeNames.map((entry) => [entry.id, { id: entry.id, name: entry.name, signatureItem: entry.signatureItem }]),
)
const assignment: Readonly<Record<string, string>> = assignedBoards

/**
 * The café a board is (docs/roadmap/cafe-world.md section 5: "Each required
 * board is its own café"), or null for a board that is not one.
 *
 * The assignment is the frozen table in `city1-cafe-assignment.da.json`
 * (card CW-08), keyed by `authoredBoardId`. It was made once from each
 * board's place in the v2 required set's display order (board 01 is the
 * first name in `src/data/city1-cafe-names.da.json`, board 100 the
 * hundredth), which is what CW-09's interim mapping did, so no name a player
 * has seen moved. From here on the table, not the display order, is the
 * authority: a later board set that reorders the course, or a revised
 * board's new content revision, does not move a café. New boards get new
 * entries; no café id is reused.
 *
 * Only the Danish Sønderborg course has cafés. Any other course (the German
 * course's Flensburg boards included), city, or a board outside the table
 * has none, and screens fall back to the board number ("Board 07").
 */
export function cafeForBoard(board: BoardIdentity | null | undefined): Cafe | null {
  if (!board || board.courseId !== namesLanguage || board.cityId !== assignedCityId) return null
  if (!Object.prototype.hasOwnProperty.call(assignment, board.authoredBoardId)) return null
  return byId.get(assignment[board.authoredBoardId]!) ?? null
}

/**
 * The café's name for a board, or null (see `cafeForBoard`). The finish
 * screen, Home and the puzzle's header ask this, so the name a player sees is
 * the same everywhere.
 */
export function cafeNameForBoard(board: BoardIdentity | null | undefined): string | null {
  return cafeForBoard(board)?.name ?? null
}
