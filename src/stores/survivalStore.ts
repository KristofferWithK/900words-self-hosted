import { create } from 'zustand'
import { guardedPersist as persist, withEffectMarkers, type EffectMarkers } from './settlementStorage'
import { ACTIVE } from '../lang/active'
import {
  completeSurvivalExchange,
  initialSurvivalProgress,
  type SurvivalProgress,
} from '../journey/survival'

export type SurvivalProgressByLanguage = Partial<Record<string, SurvivalProgress>>

interface SurvivalStore {
  settlementEffects: EffectMarkers
  /** Milestones whose captured C1-09 availability plan has been applied. */
  settlementMilestones: Record<string, number>
  readonly byLanguage: SurvivalProgressByLanguage
  /** First completion is immutable; later calls are marked as replays. */
  complete: (targetActivityId: string, now: number) => void
  reset: () => void
}

const progressFor = (all: SurvivalProgressByLanguage, language: string): SurvivalProgress =>
  all[language] ?? initialSurvivalProgress(language)

/**
 * The Survival reader has a separate persisted ledger from the scored
 * curriculum. That makes its optional/no-evidence rule structural: nothing in
 * this store can write journey progress, route position, or assessment rows.
 */
export const useSurvival = create<SurvivalStore>()(
  persist(
    (set) => ({
      settlementEffects: {},
      settlementMilestones: {},
      byLanguage: {},
      complete: (targetActivityId, now) => set((state) => {
        const language = ACTIVE.code
        const progress = progressFor(state.byLanguage, language)
        const next = completeSurvivalExchange(progress, targetActivityId, now)
        return next === progress ? state : { byLanguage: { ...state.byLanguage, [language]: next } }
      }),
      // Keep reset and the durable lesson markers in the same history scope.
      reset: () => set({ settlementEffects: {}, settlementMilestones: {}, byLanguage: {} }),
    }),
    { name: 'cluecab-survival-v1', version: 2, migrate: migrateSurvival },
  ),
)

export function migrateSurvival(persisted: unknown, from: number): unknown {
  if (from >= 2) return persisted
  return withEffectMarkers({ ...(persisted as object), settlementMilestones: {} })
}

export function activeSurvivalProgress(): SurvivalProgress {
  return progressFor(useSurvival.getState().byLanguage, ACTIVE.code)
}
