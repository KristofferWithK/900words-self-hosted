import type { SurvivalGuide } from '../lang/survival'

/** One optional Survival page's durable reader state. */
export interface SurvivalExchangeProgress {
  readonly unlockedAt: number
  /** The only completion that may be considered a first visit. */
  readonly firstCompletedAt?: number
  /** Replays are visible history, never additional first-attempt evidence. */
  readonly replayedAt: readonly number[]
}

/** Route-relative, language-keyed by the persistence layer. */
export interface SurvivalProgress {
  readonly routeLanguage: string
  readonly exchanges: Readonly<Record<string, SurvivalExchangeProgress>>
}

export const initialSurvivalProgress = (routeLanguage: string): SurvivalProgress => ({
  routeLanguage,
  exchanges: {},
})

export type SurvivalState = 'locked' | 'unlocked' | 'completed'

export function survivalState(progress: SurvivalProgress, targetActivityId: string): SurvivalState {
  const entry = progress.exchanges[targetActivityId]
  if (!entry) return 'locked'
  return entry.firstCompletedAt === undefined ? 'unlocked' : 'completed'
}

/**
 * A completed wrap-up unlocks the next exchange in that city, if any. It
 * does not start, complete, score, or otherwise gate ordinary play/travel.
 */
export function unlockSurvivalAfterWrap(
  guide: SurvivalGuide,
  progress: SurvivalProgress,
  cityIndex: number,
  unlockedAt: number,
): SurvivalProgress {
  const city = guide.cities[cityIndex]
  if (!city) return progress
  const next = city.exchanges.find((exchange) => !progress.exchanges[exchange.targetActivityId])
  if (!next) return progress
  return {
    ...progress,
    exchanges: {
      ...progress.exchanges,
      [next.targetActivityId]: { unlockedAt, replayedAt: [] },
    },
  }
}

/**
 * Completing an unlocked reader page records its first completion once.
 * Calling this again is a replay: it is retained for UI history but cannot
 * create another first-attempt record or affect any evidence ledger.
 */
export function completeSurvivalExchange(
  progress: SurvivalProgress,
  targetActivityId: string,
  completedAt: number,
): SurvivalProgress {
  const entry = progress.exchanges[targetActivityId]
  if (!entry) return progress
  const next: SurvivalExchangeProgress = entry.firstCompletedAt === undefined
    ? { ...entry, firstCompletedAt: completedAt }
    : { ...entry, replayedAt: [...entry.replayedAt, completedAt] }
  return { ...progress, exchanges: { ...progress.exchanges, [targetActivityId]: next } }
}

/** City exits are deliberately independent of all optional Survival state. */
export function cityExitAvailable(wrappedWordsInCity: number, wordsRequired = 100): boolean {
  return wrappedWordsInCity >= wordsRequired
}
