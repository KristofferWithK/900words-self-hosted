import { beforeEach, describe, expect, it } from 'vitest'
import { migrateSrs, useSrs } from './srsStore'

const won = { result: 'won', reason: 'all-greens' } as const
const lost = { result: 'lost', reason: 'sudden-death' } as const

describe('postcard currency', () => {
  beforeEach(() => useSrs.getState().reset())

  it('awards exactly one for every normal win, including an unbounded run', () => {
    for (let i = 0; i < 20; i++) useSrs.getState().recordGame(won)
    expect(useSrs.getState().translationPostcards).toBe(20)
    expect(useSrs.getState().games.won).toBe(20)
  })

  it('does not award one for losses, wrap-ups, or tutorials', () => {
    useSrs.getState().recordGame(lost)
    useSrs.getState().recordGame(won, 'wrapup')
    useSrs.getState().recordGame(won, 'tutorial')
    expect(useSrs.getState().translationPostcards).toBe(0)
  })

  it('spends only an available postcard and never goes negative', () => {
    expect(useSrs.getState().spendPostcard()).toBe(false)
    expect(useSrs.getState().translationPostcards).toBe(0)
    useSrs.getState().recordGame(won)
    expect(useSrs.getState().spendPostcard()).toBe(true)
    expect(useSrs.getState().spendPostcard()).toBe(false)
    expect(useSrs.getState().translationPostcards).toBe(0)
  })
})

describe('migrateSrs v6', () => {
  it('renames a v5 joker balance 1:1, with nothing added or taken', () => {
    expect(migrateSrs({ games: { won: 9 }, translationJokers: 12 }, 5))
      .toMatchObject({ translationPostcards: 12 })
  })

  it('carries a zero v5 balance through as zero', () => {
    expect(migrateSrs({ games: { won: 0 }, translationJokers: 0 }, 5))
      .toMatchObject({ translationPostcards: 0 })
  })

  it('still seeds older saves on the way up to v6', () => {
    // v4 tokens at three wins plus partial progress...
    expect(migrateSrs({ wrapUpsBanked: 2, winsTowardWrapUp: 1, games: { won: 8 } }, 4))
      .toMatchObject({ translationPostcards: 7 })
    // ...v3 tokens at one win...
    expect(migrateSrs({ wrapUpsBanked: 2, games: { won: 9 } }, 3))
      .toMatchObject({ translationPostcards: 2 })
    // ...and pre-v3 saves from their recorded wins.
    expect(migrateSrs({ games: { won: 9 } }, 2)).toMatchObject({ translationPostcards: 9 })
  })

  it('leaves no joker key on a migrated save', () => {
    const out = migrateSrs({ games: { won: 9 }, translationJokers: 12 }, 5) as Record<string, unknown>
    expect(out).not.toHaveProperty('translationJokers')
  })

  it('v6 to v7 preserves the entire old economy and adds only destination markers', () => {
    const blob = { games: { won: 3 }, translationPostcards: 3 }
    expect(migrateSrs(blob, 6)).toEqual({ ...blob, settlementEffects: {} })
    expect(blob).toEqual({ games: { won: 3 }, translationPostcards: 3 })
    const current = { ...blob, settlementEffects: {} }
    expect(migrateSrs(current, 7)).toBe(current)
  })
})
