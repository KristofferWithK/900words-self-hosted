import type { WordEntry } from '../data/types'
import { curriculumRank } from '../data/words'
import { ACTIVE } from '../lang/active'
import { earnedPostcards } from '../progression/facts'
import { cityKey } from '../progression/identity'
import {
  cityTier,
  PROVISIONAL_TRAVEL_THRESHOLD,
  travelStatus,
} from '../progression/rules'
import type {
  CityIdentity,
  ProgressFacts,
  RequiredBoardSet,
  Tier,
} from '../progression/types'
import type { SrsMap, WordStats } from '../srs/types'
import { CITIES, WORDS_PER_CITY } from './cities'

/**
 * The old play-route threshold to green: clued or guessed this many times.
 * The lifecycle no longer counts to three, but every migration still reads
 * this — a v1 record at LEARN_REPS correct guesses is what arrives collected.
 */
export const LEARN_REPS = 3

/**
 * The four-state life of a word on its way into the suitcase:
 * - `undiscovered` — never met
 * - `discovered`   — seen on a board
 * - `collected`    — clued once AND guessed once (one green earned each way)
 * - `wrapped`      — packed safely in a wrap-up round; add-only, like the old
 *                    exam banking
 *
 * Monotonic: the counters only rise and the wrapped ledger only grows, so the
 * collection can never regress on its own.
 */
export type WordState = 'undiscovered' | 'discovered' | 'collected' | 'wrapped'

/** Words packed safely in wrap-up rounds: wordId -> when. Add-only. */
export type WrappedWords = Readonly<Record<string, number>>

export interface JourneyState {
  cityIndex: number
  wrapped: Record<string, number>
}

/**
 * Explicit old-economy readiness facts, keyed by learner course and stable
 * city ID. C1-06 may add a fact only when an old save proves it; a wrapped-word
 * count, route index or developer jump is not itself proof here.
 */
export type HistoricalTravelEligibility = Readonly<Record<string, true>>

/** Historical readiness is city-specific and never follows the viewed board. */
export function hasHistoricalTravelEligibility(
  history: HistoricalTravelEligibility,
  city: CityIdentity,
): boolean {
  return history[cityKey(city)] === true
}

/** Canonical cumulative credits: unique component claims plus approved legacy high-water credit. */
export function cityPostcards(facts: ProgressFacts, city: CityIdentity): number {
  return earnedPostcards(facts, city)
}

/** Configurable readiness countdown. It does not read word or lesson state. */
export function postcardsToTravel(
  facts: ProgressFacts,
  city: CityIdentity,
  threshold = PROVISIONAL_TRAVEL_THRESHOLD,
): number {
  return travelStatus(cityPostcards(facts, city), threshold, false, false, false).remaining
}

/** Lowest personal-best tier over the exact frozen required membership. */
export function cityMedal(
  facts: ProgressFacts,
  required: RequiredBoardSet | null,
): { tier: Tier | null; error: ReturnType<typeof cityTier>['error'] } {
  const bests: Record<string, Tier> = Object.fromEntries(
    Object.entries(facts.boards).map(([key, progress]) => [key, progress.best]),
  )
  return cityTier(required, bests)
}

export interface CityTravelReadinessOptions {
  readonly threshold?: number
  readonly historicalEligibility: boolean
  readonly destinationAvailable: boolean
  readonly accessAllowed: boolean
}

/**
 * The journey projection used by Home/map consumers in C1-13. Readiness,
 * destination availability and access stay independent; none of them mutates
 * the facts used to derive the earned total.
 */
export function cityTravelReadiness(
  facts: ProgressFacts,
  city: CityIdentity,
  options: CityTravelReadinessOptions,
) {
  return travelStatus(
    cityPostcards(facts, city),
    options.threshold ?? PROVISIONAL_TRAVEL_THRESHOLD,
    options.historicalEligibility,
    options.destinationAvailable,
    options.accessAllowed,
  )
}

/** Inclusive journey-rank range owned by a city. City 0 holds 1..100. */
export function cityBand(cityIndex: number): [number, number] {
  return [cityIndex * WORDS_PER_CITY + 1, (cityIndex + 1) * WORDS_PER_CITY]
}

/**
 * THE ORDER THE JOURNEY SLICES INTO CITIES.
 *
 * It is `curriculumRank` with one exception, and the exception is why this
 * exists: a city with an authored roster (`ACTIVE.rosters`) owns exactly the
 * roster's hundred words, in roster order, and every other word keeps its
 * `curriculumRank` order in the ranks no roster claimed — so the bands close
 * up around the rostered city and every city still holds a hundred.
 *
 * Owner decision, 2026-09-11. City 1 had two definitions that shared 24
 * words: `curriculumRank` 1–100 (the suitcase, the wrap-up pool, the travel
 * gate) and the replacement roster the 150 authored boards, the LCSI index
 * and Casey's authored clues were built on. A player walking the authored
 * cycle could therefore pack 24 of the words it taught, and 76 City 1 words
 * were on no ordinary board at all (`wrapup-composition.test.ts` measures the
 * simulated suitcase stalling at 24 of 100). The roster is canon; the rank
 * band City 1 used to be is history, kept in the data because the curriculum
 * projection and the research validators were frozen against it.
 *
 * Computed once per word list — tests hand these functions small fake lists
 * and must get the plain rank order back, which they do: a roster id that is
 * not in the list is simply skipped.
 */
const journeyOrders = new WeakMap<readonly WordEntry[], ReadonlyMap<string, number>>()

function journeyOrder(all: readonly WordEntry[]): ReadonlyMap<string, number> {
  const cached = journeyOrders.get(all)
  if (cached) return cached
  const present = new Set(all.map((w) => w.id))
  const order = new Map<string, number>()
  const claimed = new Set<number>()
  for (const [city, ids] of Object.entries(ACTIVE.rosters)) {
    const base = Number(city) * WORDS_PER_CITY
    ids.forEach((id, i) => {
      if (!present.has(id) || order.has(id) || i >= WORDS_PER_CITY) return
      order.set(id, base + i + 1)
      claimed.add(base + i + 1)
    })
  }
  const rest = all
    .filter((w) => !order.has(w.id))
    .sort((a, b) => curriculumRank(a) - curriculumRank(b))
  let rank = 0
  for (const w of rest) {
    do rank++
    while (claimed.has(rank))
    order.set(w.id, rank)
  }
  journeyOrders.set(all, order)
  return order
}

/** Where a word sits in the journey's order over `all`: 1..all.length. */
export function journeyRank(all: readonly WordEntry[], w: WordEntry): number {
  return journeyOrder(all).get(w.id) ?? curriculumRank(w)
}

/**
 * The band of `curriculumRank` a city USED TO BE, before rosters. Not the
 * journey's city — nothing that deals, counts or packs may read this. It is
 * for the artefacts authored against that band and frozen since: the E6
 * matrix and book shards, the concept tags of the local engine research, the
 * retired travel stories. Their tests ask for the hundred they were written
 * for, and this is where that hundred is still defined.
 */
export function curriculumBand(all: readonly WordEntry[], cityIndex: number): WordEntry[] {
  const [lo, hi] = cityBand(cityIndex)
  return all
    .filter((w) => curriculumRank(w) >= lo && curriculumRank(w) <= hi)
    .sort((a, b) => curriculumRank(a) - curriculumRank(b))
}

export function wordsForCity(all: readonly WordEntry[], cityIndex: number): WordEntry[] {
  const [lo, hi] = cityBand(cityIndex)
  const order = journeyOrder(all)
  const rankOf = (w: WordEntry) => order.get(w.id)!
  return all.filter((w) => rankOf(w) >= lo && rankOf(w) <= hi).sort((a, b) => rankOf(a) - rankOf(b))
}

/** Everything the player may meet on a board: this city and all before it. */
export function unlockedWords(all: readonly WordEntry[], cityIndex: number): WordEntry[] {
  const [, hi] = cityBand(cityIndex)
  const order = journeyOrder(all)
  const rankOf = (w: WordEntry) => order.get(w.id)!
  return all.filter((w) => rankOf(w) <= hi).sort((a, b) => rankOf(a) - rankOf(b))
}

export function wordState(stats: WordStats | undefined, wrapped: boolean): WordState {
  if (wrapped) return 'wrapped'
  if (!stats) return 'undiscovered'
  return stats.greenByClue >= 1 && stats.greenByGuess >= 1 ? 'collected' : 'discovered'
}

/** Collected or better — the pool a wrap-up round deals from. */
export function isCollected(stats: WordStats | undefined, wrapped: boolean): boolean {
  const state = wordState(stats, wrapped)
  return state === 'collected' || state === 'wrapped'
}

export interface CollectionCounts {
  total: number
  discovered: number // met, but an interaction still missing
  collected: number // clued and guessed, not yet packed
  wrapped: number
  undiscovered: number
}

export function countCollection(
  words: readonly WordEntry[],
  srs: SrsMap,
  wrapped: WrappedWords,
): CollectionCounts {
  let discovered = 0
  let collected = 0
  let packed = 0
  for (const w of words) {
    const state = wordState(srs[w.id], w.id in wrapped)
    if (state === 'wrapped') packed++
    else if (state === 'collected') collected++
    else if (state === 'discovered') discovered++
  }
  return {
    total: words.length,
    discovered,
    collected,
    wrapped: packed,
    undiscovered: words.length - discovered - collected - packed,
  }
}

/**
 * Wrapped words that open the road onward — THE pacing tunable. All hundred,
 * per the design: a city is left with its whole suitcase packed. Collecting
 * needs a green each way per word and wrapping needs a wrap-up round finding
 * it, so lowering this is the one-line lever if a city runs long.
 */
export const WRAP_TO_TRAVEL = WORDS_PER_CITY

/**
 * Words still to wrap before the road out of this city opens — the number the
 * map screen prints and the train counts down. Here rather than in either
 * screen because both ask it and a second copy of `WRAP_TO_TRAVEL - n` is a
 * second place for it to drift. Legacy wrap-up presentation only: this is not
 * the City 1 readiness selector. New travel code uses `postcardsToTravel` /
 * `cityTravelReadiness` above.
 */
export function wordsToTravel(wrappedHere: number): number {
  return Math.max(0, WRAP_TO_TRAVEL - wrappedHere)
}

export function countWrapped(words: readonly WordEntry[], wrapped: WrappedWords): number {
  let n = 0
  for (const w of words) if (w.id in wrapped) n++
  return n
}

/**
 * Legacy pre-C1-10 gate retained for migration readers and old screens until
 * C1-13 rewires them. It must not be used by new travel/readiness code.
 */
export function canTravel(
  all: readonly WordEntry[],
  wrapped: WrappedWords,
  cityIndex: number,
): boolean {
  return countWrapped(wordsForCity(all, cityIndex), wrapped) >= WRAP_TO_TRAVEL
}

export function isJourneyComplete(
  all: readonly WordEntry[],
  wrapped: WrappedWords,
  cityIndex: number,
): boolean {
  return cityIndex >= CITIES.length - 1 && canTravel(all, wrapped, CITIES.length - 1)
}
