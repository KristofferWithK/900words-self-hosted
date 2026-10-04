import { describe, expect, it } from 'vitest'
import { CATALOGUES } from '../../i18n'
import type { Cafe } from '../../journey/cafes'
import { emptyProgressFacts } from '../../progression/facts'
import { boardKey } from '../../progression/identity'
import type { Tier } from '../../progression/types'
import { CITY1_REQUIRED_SET } from '../../session/courseRuntime'
import { cellAria, stampCardSummary, stampCells, type StampCardCopy } from './stampCard'

const boards = CITY1_REQUIRED_SET.boards.slice(0, 4)
const set = { ...CITY1_REQUIRED_SET, boards }
const cafes = (states: Cafe['state'][]): Cafe[] => boards.map((board, index) => ({ board, index, state: states[index]!, foundAt: null }))

const copyOf = (code: 'en' | 'de'): StampCardCopy => {
  const home = CATALOGUES[code].home
  return { cafeNumber: home.stampCafeNumber, cellStamped: home.stampCellStamped, cellFound: home.stampCellFound, cellNotFound: home.stampCellNotFound }
}
const stampWord = (tier: Tier) => `${tier} stamp`

describe('stamp card cells', () => {
  it('reads each café as stamped, found or not found; a café only ever lost is Bronze (CW-03b)', () => {
    const facts = {
      ...emptyProgressFacts(),
      boards: { [boardKey(boards[0]!)]: { board: boards[0]!, best: 'silver' as const, claims: [] as const } },
      completedLosses: { [boardKey(boards[1]!)]: { board: boards[1]!, firstPrimary: true } },
    }
    const cells = stampCells(set, facts, cafes(['played', 'played', 'found', 'unfound']))
    expect(cells.map((cell) => [cell.state, cell.tier, cell.replayable])).toEqual([
      ['stamped', 'silver', true],
      ['stamped', 'bronze', true],
      ['found', null, false],
      ['unfound', null, false],
    ])
  })

  it('reads a loss as Bronze even with no café record to read, and never lowers a better stamp', () => {
    const lost = { ...emptyProgressFacts(), completedLosses: { [boardKey(boards[0]!)]: { board: boards[0]!, firstPrimary: false } } }
    expect(stampCells(set, lost, null)[0]).toMatchObject({ state: 'stamped', tier: 'bronze', replayable: true })
    const goldThenLost = { ...lost, boards: { [boardKey(boards[0]!)]: { board: boards[0]!, best: 'gold' as const, claims: ['solved' as const] } } }
    expect(stampCells(set, goldThenLost, null)[0]).toMatchObject({ state: 'stamped', tier: 'gold', replayable: true })
  })

  it('has no stampless played cell: a played record with neither a best nor a loss reads as found, not as a stamp', () => {
    // Settlement writes a first completion only beside a best, so this record is never written; the card still invents nothing.
    const cells = stampCells(set, emptyProgressFacts(), cafes(['played', 'unfound', 'unfound', 'unfound']))
    expect(cells[0]).toMatchObject({ state: 'found', tier: null, replayable: false })
  })

  it('says each state to the screen reader, in the player language', () => {
    const facts = {
      ...emptyProgressFacts(),
      boards: { [boardKey(boards[0]!)]: { board: boards[0]!, best: 'gold' as const, claims: [] as const } },
      completedLosses: { [boardKey(boards[1]!)]: { board: boards[1]!, firstPrimary: true } },
    }
    const cells = stampCells(set, facts, cafes(['played', 'played', 'found', 'unfound']))
    const named = cells.map((cell) => ({ ...cell, name: `Café ${cell.displayNumber}x` }))
    expect(named.map((cell) => cellAria(cell, copyOf('en'), stampWord))).toEqual([
      'Café 1x: gold stamp', 'Café 2x: bronze stamp', 'Café 3x: found, not played yet', 'Café 4: not found yet',
    ])
    expect(named.map((cell) => cellAria(cell, copyOf('de'), stampWord))).toEqual([
      'Café 1x: gold stamp', 'Café 2x: bronze stamp', 'Café 3x: gefunden, noch nicht gespielt', 'Café 4: noch nicht gefunden',
    ])
    // A café with no name yet is named by its place, never "?".
    expect(cellAria({ ...named[2]!, name: null }, copyOf('en'), stampWord)).toBe('Café 3: found, not played yet')
  })

  it('summarises the card: floored percent, medal, next medal and the stamped count', () => {
    const facts = { ...emptyProgressFacts(), boards: Object.fromEntries(boards.slice(0, 1).map((board) => [boardKey(board), { board, best: 'platinum' as const, claims: [] as const }])) }
    expect(stampCardSummary(facts, set)).toEqual({ percent: 25, medal: 'bronze', next: { tier: 'silver', percent: 50 }, stamped: 1, cafes: 4 })
    expect(stampCardSummary(emptyProgressFacts(), null)).toMatchObject({ percent: 0, medal: null, stamped: 0, cafes: 0 })
    // A lost-only café counts 1 point: Platinum + Bronze is 5 of 16, 31%.
    const withLoss = { ...facts, completedLosses: { [boardKey(boards[1]!)]: { board: boards[1]!, firstPrimary: true } } }
    expect(stampCardSummary(withLoss, set)).toEqual({ percent: 31, medal: 'bronze', next: { tier: 'silver', percent: 50 }, stamped: 2, cafes: 4 })
  })
})
