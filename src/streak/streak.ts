import { create } from 'zustand'
import { guardedPersist as persist, withEffectMarkers, type EffectMarkers } from '../stores/settlementStorage'

/** The promise Casey makes on Home; reminders use the same number. */
export const DAILY_GAMES_GOAL = 3
export const KNOWN_WORDS_GOAL = 900

export type CompletedDays = Record<string, number>

/** A local calendar day, deliberately not UTC: a midnight game counts tonight. */
export function dayKey(now: number | Date): string {
  const date = typeof now === 'number' ? new Date(now) : now
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function previousDay(key: string): string {
  const [year, month, day] = key.split('-').map(Number)
  return dayKey(new Date(year!, month! - 1, day! - 1, 12))
}

/**
 * Consecutive local days ending on today — or on yesterday, while today has
 * no finished game yet. A day needs one finished real game.
 *
 * Counting from today alone read 0 every morning: a ten-day run showed as
 * nothing on Home until the first game of the day, and the 18:00 reminder
 * offered to "begin a streak" to the player whose streak was about to end at
 * midnight. A streak is not broken until the day it was not played is over,
 * so an unplayed today is skipped and the count starts from yesterday.
 */
export function currentStreak(days: CompletedDays, now: number | Date): number {
  const today = dayKey(now)
  let key = (days[today] ?? 0) > 0 ? today : previousDay(today)
  let streak = 0
  while ((days[key] ?? 0) > 0) {
    streak += 1
    key = previousDay(key)
  }
  return streak
}

/** Fixed routine countdown; wrapped words remain part of progress. */
export function daysToKnownWords(collected: number, wrapped = 0, _legacyGamesPerDay?: number): number {
  const progress = Math.min(KNOWN_WORDS_GOAL, Math.max(0, collected + wrapped))
  return Math.ceil((KNOWN_WORDS_GOAL - progress) / 10)
}

interface StreakState {
  settlementEffects: EffectMarkers
  completedDays: CompletedDays
  recordCompletedGame: (now: number) => void
  reset: () => void
}

/**
 * This is intentionally a separate, small persisted ledger. It answers only
 * "was a real game finished on this local day?"; it never stores a device
 * token, notification permission, or a claim that opening Home is practice.
 */
export const useStreak = create<StreakState>()(
  persist(
    (set) => ({
      settlementEffects: {},
      completedDays: {},
      recordCompletedGame: (now) => set((state) => {
        const key = dayKey(now)
        return { completedDays: { ...state.completedDays, [key]: (state.completedDays[key] ?? 0) + 1 } }
      }),
      reset: () => set({ completedDays: {} }),
    }),
    { name: 'cluecab-streak-v1', version: 2, migrate: withEffectMarkers },
  ),
)
