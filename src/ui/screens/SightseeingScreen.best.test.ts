import { describe, expect, it } from 'vitest'
import { readWalkBest } from './SightseeingScreen'

/**
 * ONE BEST (owner, 2026-10-05: the Articles walk merged into Sightseeing).
 * The walk kept `{ words, articles }` under one key, a best per walk. A save
 * from then loads without errors, and its best is the higher of the two.
 */
describe('the walk\'s best photo count', () => {
  it('is the higher of the two old walks\' bests in a save from the time of two walks', () => {
    expect(readWalkBest(JSON.stringify({ words: 12, articles: 31 }))).toBe(31)
    expect(readWalkBest(JSON.stringify({ words: 40, articles: 31 }))).toBe(40)
    expect(readWalkBest(JSON.stringify({ articles: 7 }))).toBe(7)
  })

  it('is the one best stored since', () => {
    expect(readWalkBest(JSON.stringify({ words: 18 }))).toBe(18)
  })

  it('is none when nothing, or nothing readable, is stored', () => {
    expect(readWalkBest(null)).toBe(0)
    expect(readWalkBest('not json')).toBe(0)
    expect(readWalkBest('null')).toBe(0)
    expect(readWalkBest('7')).toBe(0)
    expect(readWalkBest(JSON.stringify({ words: 'x', articles: -3 }))).toBe(0)
    expect(readWalkBest(JSON.stringify({ words: 9.7, train: 99 }))).toBe(9)
  })
})
