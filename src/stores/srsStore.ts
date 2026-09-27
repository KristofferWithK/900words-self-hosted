import { create } from 'zustand'
import { guardedPersist as persist, withEffectMarkers, type EffectMarkers } from './settlementStorage'
import type { Outcome } from '../engine/types'
import { LEARN_REPS } from '../journey/progress'
import type { RoundMode } from '../journey/wrapup'
import { applyRoundResults } from '../srs/scheduler'
import type { RoundWordResult, SrsMap, WordStats } from '../srs/types'

export interface GamesTally {
  played: number
  won: number
  /**
   * Frozen at whatever it reached. Winning by translating the whole board back
   * — the last chance after a forbidden word — is retired, so nothing adds to
   * this. Kept rather than dropped because it is persisted and part of the
   * backup format, and because it counts rounds that really happened.
   */
  redeemed: number
  lost: number
}

const EMPTY_TALLY: GamesTally = { played: 0, won: 0, redeemed: 0, lost: 0 }

interface SrsState {
  settlementEffects: EffectMarkers
  stats: SrsMap
  games: GamesTally
  /** Unspent translation postcards. A normal win earns exactly one, with no cap. */
  translationPostcards: number
  recordRound: (results: RoundWordResult[], now: number) => void
  /** `mode` keeps wrap-up and tutorial wins from earning translation help. */
  recordGame: (outcome: Outcome, mode?: RoundMode, perfect?: boolean) => void
  /** Spend one postcard, if there is one. */
  spendPostcard: () => boolean
  reset: () => void
}

/**
 * v1 -> v2: `greenByClue` / `greenByGuess` did not exist. They cannot be
 * reconstructed — a v1 save only knows a word ended rounds green, not whose
 * work earned it — so the seed is the fairest monotonic reading: a word the
 * old model called learned (correctGuesses >= LEARN_REPS) is credited one
 * green each way and arrives *collected*; anything short of that arrives with
 * zeroes and must earn both interactions in play. Nothing can regress: the
 * old states map to equal-or-better new ones.
 *
 * v2 -> v3: wrap-up rounds have to be earned now, and every save written
 * before this build holds none. Seeding zero would take something away from a
 * player mid-journey — they could open a wrap-up yesterday and could not
 * today — so the bank is seeded from the wins they already have: the bank
 * they WOULD hold if the rule had always existed and they had never spent
 * one, which is the most generous reading that is still earned. Every token
 * handed out here is a win that really happened. A player who has never won
 * arrives at zero and meets the unlock as the tutorial beat it is meant to be,
 * which is the same place a fresh install starts.
 *
 * v4 -> v5 replaces the retired wrap-up bank with translation jokers. The
 * migration preserves wins represented by the old economy: v4 tokens count
 * as three wins plus partial progress, v3 tokens count as one, and older
 * saves seed from their recorded wins.
 *
 * v5 -> v6 renames the currency: the joker becomes the postcard. The economy
 * spine is untouched — the same number arrives under the new name, 1:1, for
 * every save. v5 and older are first read under their
 * own name and then re-keyed, so no balance moves and no win is re-minted.
 * The rename is what keeps the retired word out of the data: state that still
 * carried "joker" would leak it back into the copy on the next refactor.
 *
 * v6 -> v7 adds settlement effect markers beside the existing data. Neither
 * the old balance nor counters are changed; the new adapter awards only the
 * separate progression ledger's unique claims.
 *
 * Exported so it can be tested directly: under vitest there is no
 * localStorage, persist quietly becomes a passthrough, and a test reaching
 * through the middleware would be testing nothing.
 */
export function migrateSrs(persisted: unknown, from: number): unknown {
  const p = (persisted ?? {}) as {
    stats?: Record<string, Omit<WordStats, 'greenByClue' | 'greenByGuess'>>
    games?: Partial<GamesTally>
    wrapUpsBanked?: number
    winsTowardWrapUp?: number
    translationJokers?: number
    translationPostcards?: number
  }
  // Current saves pass through; v6 adds only the new durable marker default.
  if (from >= 7) return persisted
  if (from === 6) return withEffectMarkers(persisted)
  if (from < 2) {
    const seeded = Object.fromEntries(
      Object.entries(p.stats ?? {}).map(([id, s]) => [
        id,
        {
          ...s,
          greenByClue: s.correctGuesses >= LEARN_REPS ? 1 : 0,
          greenByGuess: s.correctGuesses >= LEARN_REPS ? 1 : 0,
        },
      ]),
    )
    p.stats = seeded
  }
  // v5 and older: read the balance under its old name, then hand it back
  // under the new one. The retired key is dropped here, so a migrated save
  // carries no "joker" field for a later refactor to leak back into copy.
  const { translationJokers: _retired, ...cleaned } = p
  const won = cleaned.games?.won ?? 0
  const translationPostcards = from >= 5
    ? p.translationJokers ?? 0
    : from >= 4
      ? (p.wrapUpsBanked ?? 0) * 3 + (p.winsTowardWrapUp ?? 0)
      : from === 3
        ? p.wrapUpsBanked ?? 0
        : won
  return withEffectMarkers({ ...cleaned, translationPostcards })
}

export const useSrs = create<SrsState>()(
  persist(
    (set, get) => ({
      settlementEffects: {},
      stats: {},
      games: EMPTY_TALLY,
      translationPostcards: 0,
      recordRound: (results, now) =>
        set((s) => ({ stats: applyRoundResults(s.stats, results, now) })),
      recordGame: (outcome, mode = 'normal', perfect = false) =>
        set((s) => {
          return {
            games: {
              played: s.games.played + 1,
              won: s.games.won + (outcome.result === 'won' ? 1 : 0),
              redeemed: s.games.redeemed,
              lost: s.games.lost + (outcome.result === 'lost' ? 1 : 0),
            },
            translationPostcards:
              s.translationPostcards +
              (mode === 'normal' && outcome.result === 'won' ? (perfect ? 2 : 1) : 0),
          }
        }),
      spendPostcard: () => {
        if (get().translationPostcards <= 0) return false
        set((s) => ({ translationPostcards: s.translationPostcards - 1 }))
        return true
      },
      reset: () =>
        set({ stats: {}, games: EMPTY_TALLY, translationPostcards: 0, settlementEffects: {} }),
    }),
    { name: 'cluecab-srs-v1', version: 7, migrate: migrateSrs },
  ),
)
