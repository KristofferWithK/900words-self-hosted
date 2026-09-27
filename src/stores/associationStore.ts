import { create } from 'zustand'
import { guardedPersist as persist, withEffectMarkers, type EffectMarkers } from './settlementStorage'
import type { GameState, Side } from '../engine/types'

/**
 * WHAT THE PLAYER HAS FOUND TOGETHER (owner, 2026-09-11: "authored groups
 * layered with the player's data").
 *
 * One row per set of greens that ended up found under ONE clue: under the
 * player's clue, the words Casey found — a group this player can clue; under
 * Casey's clue, the words the player named — a group this player recognises.
 * Beside it, the trap evidence a round leaves for free: a wrong guess under
 * that clue is a card the clue pulled toward that was not meant, which is
 * exactly the judgement the bank had to buy from a model for its own boards.
 *
 * The wrap-up composer (`src/journey/wrapup.ts`) reads this as evidence of
 * the same kind as the bank's authored groups — which greens go together,
 * which cards must not sit beside them — and prefers it, because it is
 * evidence about THIS player rather than about a judge.
 *
 * WHAT IT DELIBERATELY DOES NOT HOLD. No clue text: the owner declined a
 * clue ledger shaped like training data (`ledgerStore.ts`), and a set of
 * word ids with a count is a fact about the player's memory, not a corpus.
 * Nothing leaves the phone: it is not in the backup file either — a restore
 * simply starts the ledger again, and the authored groups carry the composer
 * until it regrows. Word ids carry their language prefix, so a German save
 * cannot collide with a Danish one.
 *
 * v2 adds destination settlement markers; v1 history remains unchanged.
 */

/** A set of greens found under one clue, and how often. */
export interface FoundGroup {
  /** Sorted, two to four ids — a clue of N can find N. */
  ids: string[]
  /** Who gave the clue the last time this group was found. */
  by: Side
  count: number
  lastAt: number
}

export interface AssociationStore {
  settlementEffects: EffectMarkers
  /** key = the sorted ids joined with '|'. */
  groups: Record<string, FoundGroup>
  /** key = a group key; the ids guessed wrongly under a clue that found it. */
  traps: Record<string, string[]>
  /** Read a finished round's clue history into the ledger. */
  recordRound: (game: GameState, at: number) => void
  clear: () => void
}

export const groupKey = (ids: readonly string[]): string => [...ids].sort().join('|')

/** The groups and traps one finished round leaves behind, pure and testable. */
export function roundGroups(game: GameState): { ids: string[]; by: Side; traps: string[] }[] {
  const out: { ids: string[]; by: Side; traps: string[] }[] = []
  for (const clue of game.clueHistory) {
    const found = clue.guesses.filter((g) => g.result === 'green').map((g) => g.wordId)
    if (found.length < 2) continue
    const traps = clue.guesses.filter((g) => g.result !== 'green').map((g) => g.wordId)
    out.push({ ids: [...new Set(found)].sort().slice(0, 4), by: clue.by, traps: [...new Set(traps)] })
  }
  return out
}

export const useAssociations = create<AssociationStore>()(
  persist(
    (set) => ({
      settlementEffects: {},
      groups: {},
      traps: {},
      recordRound: (game, at) =>
        set((s) => {
          const groups = { ...s.groups }
          const traps = { ...s.traps }
          for (const found of roundGroups(game)) {
            const key = groupKey(found.ids)
            const prior = groups[key]
            groups[key] = { ids: found.ids, by: found.by, count: (prior?.count ?? 0) + 1, lastAt: at }
            if (found.traps.length > 0) {
              traps[key] = [...new Set([...(traps[key] ?? []), ...found.traps])]
            }
          }
          return { groups, traps }
        }),
      clear: () => set({ groups: {}, traps: {} }),
    }),
    {
      name: 'cluecab-associations-v1',
      version: 2,
      migrate: withEffectMarkers,
      partialize: (s) => ({ groups: s.groups, traps: s.traps, settlementEffects: s.settlementEffects }),
    },
  ),
)
