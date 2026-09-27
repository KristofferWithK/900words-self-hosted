import { beforeEach, describe, expect, it, vi } from 'vitest'

/** zustand resolves storage when the module is imported, so install the node
 *  shim first — and on `window`, which is where persist looks (the same shim
 *  gameStore.test.ts installs). */
const memory = new Map<string, string>()
const storage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
}
vi.stubGlobal('window', { localStorage: storage })
vi.stubGlobal('localStorage', storage)

const { groupKey, roundGroups, useAssociations } = await import('./associationStore')
import type { GameState } from '../engine/types'

/** A finished round with the clue history the tests need; nothing else is read. */
const gameWith = (clueHistory: GameState['clueHistory']): GameState =>
  ({ clueHistory }) as unknown as GameState

const green = (wordId: string) => ({ wordId, result: 'green' as const })
const miss = (wordId: string) => ({ wordId, result: 'bystander' as const })

describe('what a round leaves in the association ledger', () => {
  beforeEach(() => useAssociations.getState().clear())

  it('reads a group from every clue that found two or more greens, and its traps', () => {
    const game = gameWith([
      { by: 'ai', text: 'x', number: 3, guesses: [green('da:uge'), green('da:måned'), miss('da:hus')] },
      { by: 'player', text: 'y', number: 1, guesses: [green('da:by')] },
      { by: 'player', text: 'z', number: 2, guesses: [green('da:hel'), green('da:halv')] },
    ])
    expect(roundGroups(game)).toEqual([
      { ids: ['da:måned', 'da:uge'], by: 'ai', traps: ['da:hus'] },
      { ids: ['da:halv', 'da:hel'], by: 'player', traps: [] },
    ])
  })

  it('counts a group each time it is found and keeps every trap it ever showed', () => {
    const store = useAssociations.getState()
    store.recordRound(gameWith([{ by: 'ai', text: 'x', number: 2, guesses: [green('da:uge'), green('da:måned'), miss('da:hus')] }]), 1)
    store.recordRound(gameWith([{ by: 'player', text: 'w', number: 2, guesses: [green('da:måned'), miss('da:år'), green('da:uge')] }]), 2)
    const key = groupKey(['da:uge', 'da:måned'])
    expect(useAssociations.getState().groups[key]).toEqual({ ids: ['da:måned', 'da:uge'], by: 'player', count: 2, lastAt: 2 })
    expect(useAssociations.getState().traps[key]).toEqual(['da:hus', 'da:år'])
  })

  it('holds word ids and counts only — no clue text', async () => {
    useAssociations.getState().recordRound(
      gameWith([{ by: 'ai', text: 'SECRET-CLUE', number: 2, guesses: [green('da:uge'), green('da:måned')] }]),
      1,
    )
    // What persist writes is what partialize returns; assert on that rather
    // than on the storage shim's timing.
    const options = useAssociations.persist.getOptions()
    const written = JSON.stringify(options.partialize!(useAssociations.getState()))
    expect(written).not.toContain('SECRET-CLUE')
    expect(written).toContain('da:uge')
    expect(options.name).toBe('cluecab-associations-v1')
  })

  it('clears', () => {
    useAssociations.getState().recordRound(gameWith([{ by: 'ai', text: 'x', number: 2, guesses: [green('a'), green('b')] }]), 1)
    useAssociations.getState().clear()
    expect(useAssociations.getState().groups).toEqual({})
    expect(useAssociations.getState().traps).toEqual({})
  })
})
