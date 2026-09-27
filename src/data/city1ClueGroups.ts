import danish from './city1-clue-groups.da.json'
import german from './city1-clue-groups.de.json'
import { ACTIVE } from '../lang/active'
import { CITY1_BOARD_CYCLE, CITY1_BOARD_CYCLE_SOURCE_SHA256 } from './city1BoardCycle'
import type { Side } from '../engine/types'

/**
 * A group of two or three greens the bank found a gated clue for, on one
 * side of one authored board. No clue text: membership and provenance are
 * all the wrap-up composer needs, and the phone already holds both keys of
 * every authored board, so this adds no key information to the bundle.
 *
 * `safeBeside` is the board's other ten cards — everything off this side's
 * key — which the bank judged safe against the group's clue with a two-rung
 * margin. That judgement is what makes an authored bystander worth reusing
 * next to the same group on a composed board.
 */
export interface AuthoredGroup {
  boardId: string
  side: Side
  ids: readonly string[]
  safeBeside: ReadonlySet<string>
}

const raw = ACTIVE.code === 'de' ? german : danish

export const CITY1_CLUE_GROUPS_SOURCE_SHA256 = raw.sourceSha256

/**
 * Decoded against the cycle by position: the two files are written together
 * by `scripts/bank-to-city1-cycle.mjs` and `city1ClueGroups.test.ts` pins
 * them to each other, so a board that does not line up is skipped rather
 * than trusted.
 */
export const CITY1_CLUE_GROUPS: readonly AuthoredGroup[] = raw.boards.flatMap((entry, index) => {
  const board = CITY1_BOARD_CYCLE[index]
  if (!board || board.id !== entry.id) return []
  const decode = (side: Side, cells: readonly string[], key: readonly string[]) => {
    const keySet = new Set(key)
    const safeBeside = new Set(board.wordIds.filter((id) => !keySet.has(id)))
    return cells.flatMap((cell) => {
      const ids = cell.split('.').map((i) => board.wordIds[Number(i)])
      if (ids.some((id) => id === undefined || !keySet.has(id))) return []
      return [{ boardId: board.id, side, ids: ids as string[], safeBeside }]
    })
  }
  return [...decode('player', entry.player, board.playerGreenIds), ...decode('ai', entry.casey, board.aiGreenIds)]
})

/** The bank and the membership file must be the same bank. */
export const city1ClueGroupsMatchCycle = (): boolean =>
  CITY1_CLUE_GROUPS_SOURCE_SHA256 === CITY1_BOARD_CYCLE_SOURCE_SHA256
