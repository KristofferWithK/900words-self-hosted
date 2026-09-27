import { describe, expect, it } from 'vitest'
import { CITY1_BOARD_CYCLE, CITY1_BOARD_CYCLE_SOURCE_SHA256 } from './city1BoardCycle'
import raw from './city1-clue-groups.da.json'
import germanRaw from './city1-clue-groups.de.json'
import { CITY1_BOARD_CYCLES } from './city1BoardCycle'
import { CITY1_CLUE_GROUPS, CITY1_CLUE_GROUPS_SOURCE_SHA256, city1ClueGroupsMatchCycle } from './city1ClueGroups'

// GENERATED with the cycle by `node scripts/bank-to-city1-cycle.mjs`; these
// pins are the shape the composer depends on, not a frozen list of groups.
describe('the City 1 clue-group membership', () => {
  it('keeps German clue groups aligned to its own authored cycle without importing clue text', () => {
    expect(germanRaw.sourceSha256).toBe('00fbbe7ba545c0632c70464036ca6ad49dcd9c82b468aeed98e6cabc04beefef')
    expect(germanRaw.boards.map((board) => board.id)).toEqual(CITY1_BOARD_CYCLES.de.map((board) => board.id))
    expect(JSON.stringify(germanRaw)).not.toMatch(/"clue"/)
    const boards = new Map(CITY1_BOARD_CYCLES.de.map((board) => [board.id, board]))
    for (const entry of germanRaw.boards) {
      const board = boards.get(entry.id)!
      expect(entry.player).toEqual([])
      for (const cell of entry.casey) {
        const indexes = cell.split('.').map(Number)
        expect(indexes.length).toBeGreaterThanOrEqual(2)
        expect(indexes.length).toBeLessThanOrEqual(3)
        expect(indexes.every((index) => Number.isInteger(index) && index >= 0 && index < board.wordIds.length)).toBe(true)
      }
    }
  })

  it('is written from the same bank as the cycle, board for board', () => {
    expect(raw.schemaVersion).toBe(1)
    expect(CITY1_CLUE_GROUPS_SOURCE_SHA256).toBe(CITY1_BOARD_CYCLE_SOURCE_SHA256)
    expect(city1ClueGroupsMatchCycle()).toBe(true)
    expect(raw.boards.map((b) => b.id)).toEqual(CITY1_BOARD_CYCLE.map((b) => b.id))
  })

  it('names two or three greens of the right key, once each, and never a clue', () => {
    const byBoard = new Map(CITY1_BOARD_CYCLE.map((b) => [b.id, b]))
    for (const group of CITY1_CLUE_GROUPS) {
      const board = byBoard.get(group.boardId)!
      const key = new Set(group.side === 'player' ? board.playerGreenIds : board.aiGreenIds)
      expect(group.ids.length).toBeGreaterThanOrEqual(2)
      expect(group.ids.length).toBeLessThanOrEqual(3)
      expect(new Set(group.ids).size).toBe(group.ids.length)
      for (const id of group.ids) expect(key.has(id)).toBe(true)
      // Off the key, on the board: judged safe against this group's clue.
      expect(group.safeBeside.size).toBe(board.wordIds.length - key.size)
      for (const id of group.safeBeside) expect(key.has(id)).toBe(false)
    }
    for (const entry of raw.boards) {
      expect(new Set(entry.player).size).toBe(entry.player.length)
      expect(new Set(entry.casey).size).toBe(entry.casey.length)
      for (const cell of [...entry.player, ...entry.casey]) expect(cell).toMatch(/^\d+(\.\d+){1,2}$/)
    }
    expect(JSON.stringify(raw)).not.toMatch(/"clue"/)
  })

  it('every green of every player key is in a group; Casey keeps at least five of eight', () => {
    // The player graph is the bank's full graph; Casey's was trimmed to the
    // largest groups (`trim-graph.mjs`, a known defect recorded in the
    // board-bank skill), so a Casey green can be reachable by a single clue
    // only. Measured: 150 of 150 player keys fully grouped, 106 of 150 Casey
    // keys, never fewer than five greens.
    for (const board of CITY1_BOARD_CYCLE) {
      const groups = CITY1_CLUE_GROUPS.filter((g) => g.boardId === board.id)
      const grouped = (side: 'player' | 'ai') =>
        new Set(groups.filter((g) => g.side === side).flatMap((g) => [...g.ids])).size
      expect(grouped('player')).toBe(board.playerGreenIds.length)
      expect(grouped('ai')).toBeGreaterThanOrEqual(5)
    }
  })
})
