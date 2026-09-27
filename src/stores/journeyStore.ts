import { create } from 'zustand'
import { guardedPersist as persist } from './settlementStorage'
import { track } from '../analytics/stats'
import { CITIES, DEVELOPED_CITY_COUNT, FINAL_CITY_INDEX } from '../journey/cities'
import { ACTIVE } from '../lang/active'
import { DEFAULT_LANGUAGE } from '../lang/index'
import type { LanguageCode } from '../lang/types'
import { cityKey } from '../progression/identity'
import type { CityIdentity } from '../progression/types'
import type { HistoricalTravelEligibility, JourneyState } from '../journey/progress'
import { mergeRouteHistory } from '../backup/journey'
import {
  alreadyRescued,
  markRescued,
  planRescue,
  readV1,
  type RescueResult,
} from '../journey/rescue'

/** Where a traveller stands on one language's route. */
export interface RoutePosition {
  cityIndex: number
  /** cityIndex -> arrival timestamp, for the travel log on the map. */
  arrivedAt: Record<number, number>
  /** See `JourneyStore.furthest`. Optional here because parked positions
   *  written before it existed have none, and `reachedIndex` reads a missing
   *  one as "no further than where you stand". */
  furthest?: number
}

/**
 * The stop a traveller has reached on this route, which since Travel back is
 * not always the stop they are standing at. `furthest` is only ever written
 * by a move BACK (or a forward move that overtakes it), so on every save that
 * has never travelled back it is 0 and the max is `cityIndex` — which is why
 * this field needed no persist version bump and no migrate step: the old
 * value and the missing value mean the same thing.
 */
export function reachedIndex(s: { cityIndex: number; furthest?: number }): number {
  return Math.max(s.cityIndex, s.furthest ?? 0)
}

/** Whether stop `index` is one the traveller has stood at. */
export function hasReached(s: { cityIndex: number; furthest?: number }, index: number): boolean {
  return index <= reachedIndex(s)
}

interface JourneyStore extends JourneyState {
  /** cityIndex -> arrival timestamp, for the travel log on the map. */
  arrivedAt: Record<number, number>
  /**
   * The furthest stop reached, kept when `cityIndex` moves back down the
   * route. Read through `reachedIndex`, never directly — see it for why the
   * initial 0 is not a default that needed migrating.
   */
  furthest: number
  /**
   * Which language's route `cityIndex` and `arrivedAt` above describe.
   *
   * A city index means nothing without the route it indexes: stop 4 is Aalborg
   * in Denmark and would be somewhere else entirely in Germany. So the position
   * is stamped, and a stamp that disagrees with the active language means the
   * save was written while playing something else.
   */
  routeLanguage: LanguageCode
  /**
   * Positions on the routes not currently being travelled. Swapped with the
   * live one on rehydrate when the language has changed, so a player who goes
   * to German and comes back finds Denmark exactly where they left it.
   *
   * `wrapped` is deliberately NOT in here. It is keyed by word id, every word
   * id carries its own language (`da:mor`, `de:Mutter`), so one ledger holds
   * both collections with no possibility of collision — proven in
   * src/lang/seam.test.ts. Splitting it would move real progress between
   * storage keys to buy nothing, and moving progress between storage keys is
   * the one mistake here that has actually cost a player their collection
   * (src/journey/rescue.ts is the apology).
   */
  parked: Partial<Record<LanguageCode, RoutePosition>>
  /** Preserved route facts, never a navigation or developer-access grant. */
  historicalRoutes: Partial<Record<LanguageCode, RoutePosition>>
  /**
   * The player packed the suitcase and found the line closed for maintenance
   * (`journey/trainService.ts`), so the app owes them a word when it reopens.
   * Set by the notice, cleared by boarding. A new persisted field, no version
   * bump: every save without it reads `false`, which is the truth for a
   * player who never met the closed line.
   */
  waitingForTrain: boolean
  /**
   * Explicit old-economy eligibility facts. They can satisfy readiness for the
   * named course/city, but availability and access are checked separately.
   * Old route position and developer jumps never populate this map.
   */
  historicalTravelEligibility: HistoricalTravelEligibility
  /** C1-06 migration seam: add-only, city-specific, and never mints postcards. */
  preserveHistoricalTravelEligibility: (city: CityIdentity) => void
  /** Pack words safely: add-only, first timestamp wins — like the old banking. */
  wrapWords: (wordIds: string[], now: number) => void
  /** The closed-line notice was shown with the suitcase packed. */
  noteTrainClosed: () => void
  travel: (now: number) => void
  /**
   * Go back to a stop already reached — or forward again to one, after going
   * back. Refuses any stop past `reachedIndex`, so it can never unlock a city:
   * new ground is only ever taken one stop at a time through `travel`, behind
   * the packing gate and the ticket. Writes no arrival: a return is not a
   * first arrival, and the log keeps the date the city was actually reached.
   */
  travelTo: (cityIndex: number) => void
  /** TestFlight/local only at the caller: visit any valid city without packing it. */
  playtestTravelTo: (cityIndex: number, now: number) => void
  reset: () => void
}

const initial = {
  cityIndex: 0,
  furthest: 0,
  wrapped: {} as Record<string, number>,
  arrivedAt: {} as Record<number, number>,
  routeLanguage: ACTIVE.code,
  parked: {} as Partial<Record<LanguageCode, RoutePosition>>,
  historicalRoutes: {} as Partial<Record<LanguageCode, RoutePosition>>,
  waitingForTrain: false,
  historicalTravelEligibility: {} as HistoricalTravelEligibility,
}

/**
 * Where Viborg stood: the fifth stop, index 4, between Aarhus and Aalborg.
 * Everything from here on shifted down one when it left the route.
 */
const VIBORG_INDEX = 4

/** A stop on the old ten-city route, placed on the nine-city one. */
function shiftPastViborg(index: number): number {
  if (!Number.isInteger(index) || index < 0) return 0
  // Viborg itself goes BACKWARD, to Aarhus. Never forward: forward would be a
  // stop whose hundred words this player may never have been shown, and the
  // road onward is gated on wrapping them. Backward cannot cost anything —
  // reaching stop i means every word before it is already wrapped, so the
  // stop they land on is one they have finished and travel is open at once.
  const shifted = index >= VIBORG_INDEX ? index - 1 : index
  return Math.min(shifted, FINAL_CITY_INDEX)
}

/**
 * The release-scope position clamp (owner, 2026-09-15): "hard code that for
 * release one — as long as we're still in City 1 (at least a week), the map
 * just completely defaults to you being in Sønderborg, and the map path being
 * not drawn — just that you're in Sønderborg, no line that goes to Aarhus,
 * because no one can travel past it."
 *
 * DEVELOPED_CITY_COUNT is 1, so the highest stop a player may stand at or have
 * reached is `DEVELOPED_CITY_COUNT - 1` — stop 0, Sønderborg. Three places
 * enforce it and they must move together when City 2 ships (raise the
 * constant in cities.ts and relax each of these three):
 *
 *  1. `clampToDevelopedRoute` runs on REHYDRATE — a save written by a build
 *     with a longer open route comes back to the scope this one serves. It
 *     keeps `wrapped` (word knowledge is not travel history) and prunes
 *     `arrivedAt` to the developed stops (the owner wants the travel log gone
 *     with the road).
 *  2. `travel` refuses to leave the developed stops — the packing gate and
 *     the closed train line (trainService OPEN_ROUTE_END) hold too, but this
 *     is the scope's own floor.
 *  3. `travelTo` (Travel back) can only move between developed stops.
 *
 * `playtestTravelTo` is deliberately NOT clamped: the developer jumper exists
 * to see the whole route, and clamping it would blind the route tooling.
 */
const DEVELOPED_CITY_LIMIT = DEVELOPED_CITY_COUNT - 1

/**
 * Position fields clamped to the developed route, with the travel log pruned
 * to the stops that exist in it. `wrapped`, `routeLanguage` and `parked` are
 * passed through untouched by the caller that spreads this in — the clamp is
 * about where you STAND, not what you know.
 */
function clampToDevelopedScope<
  T extends { cityIndex: number; furthest?: number; arrivedAt: Record<number, number>;
    routeLanguage?: LanguageCode; historicalRoutes?: Partial<Record<LanguageCode, RoutePosition>> },
>(state: T): T {
  if (state.cityIndex <= DEVELOPED_CITY_LIMIT && (state.furthest ?? 0) <= DEVELOPED_CITY_LIMIT) {
    return state
  }
  const arrivedAt: Record<number, number> = {}
  for (const key of Object.keys(state.arrivedAt).map(Number)) {
    if (key <= DEVELOPED_CITY_LIMIT && Number.isInteger(key) && key >= 0) {
      arrivedAt[key] = state.arrivedAt[key]!
    }
  }
  return {
    ...state,
    historicalRoutes: mergeRouteHistory(state.historicalRoutes ?? {}, { [state.routeLanguage ?? ACTIVE.code]: {
      cityIndex: state.cityIndex, furthest: state.furthest, arrivedAt: state.arrivedAt,
    } }),
    cityIndex: Math.min(Math.max(state.cityIndex, 0), DEVELOPED_CITY_LIMIT),
    furthest: Math.min(state.furthest ?? 0, DEVELOPED_CITY_LIMIT),
    arrivedAt,
  }
}

/**
 * v2 -> v3: the exam economy ceased to be. `banked` becomes `wrapped` with
 * every timestamp intact — a word banked by a passed rejseprøve was packed by
 * the only route that existed, so it stays packed. Stamps, spent attempts and
 * any open paper have nothing to become and are dropped.
 *
 * v3 -> v4: Viborg left the route and the dataset came down to nine hundred
 * words. A stop is stored as an index, so every index from Viborg's on now
 * names a different city and has to move. The `wrapped` ledger is keyed by
 * wordId and is left exactly as it is: the hundred words that went with the
 * tenth city simply stop being counted by anything, and every other wrap still
 * counts for the same word. Nothing is deleted from it — an add-only ledger
 * that starts subtracting is a bug waiting for the dataset to grow back.
 *
 * `arrivedAt` is keyed by index too, so it moves with the same rule, ascending
 * and first-write-wins. Viborg's own arrival lands on Aarhus, which normally
 * already has one and keeps it: a real arrival is never overwritten by the
 * arrival at a city that no longer exists.
 *
 * The STORAGE KEY does not change. The last time this store moved keys it
 * shipped without a migration and silently wiped every traveller's progress
 * (src/journey/rescue.ts is the apology); versions move, keys do not.
 *
 * Exported so it can be tested directly: under vitest there is no
 * localStorage, persist quietly becomes a passthrough, and a test reaching
 * through the middleware would be testing nothing.
 */
export function migrateJourney(persisted: unknown, from: number): unknown {
  if (from >= 7) return persisted
  const state = migrateJourneyBeforeHistory(persisted, from) as Partial<JourneyStore>
  const route = state.routeLanguage ?? DEFAULT_LANGUAGE
  return { ...state, historicalRoutes: { ...state.parked, ...state.historicalRoutes,
    [route]: { cityIndex: state.cityIndex ?? 0, arrivedAt: state.arrivedAt ?? {}, furthest: state.furthest ?? 0 } } }
}

function migrateJourneyBeforeHistory(persisted: unknown, from: number): unknown {
  if (from >= 6) return persisted
  if (from === 5) return withHistoricalTravelEligibility(persisted)
  if (from === 4) return withHistoricalTravelEligibility(stampRoute(persisted, DEFAULT_LANGUAGE))
  let state = persisted
  if (from < 3) {
    const { banked, stamps, trialsSpent, activeExam, lastPaper, ...rest } = (persisted ?? {}) as {
      banked?: Record<string, number>
      stamps?: unknown
      trialsSpent?: unknown
      activeExam?: unknown
      lastPaper?: unknown
    } & Record<string, unknown>
    void stamps, trialsSpent, activeExam, lastPaper
    state = { ...rest, wrapped: banked ?? {} }
  }

  const { cityIndex, arrivedAt, ...rest } = (state ?? {}) as {
    cityIndex?: number
    arrivedAt?: Record<string, number>
  } & Record<string, unknown>

  const moved: Record<number, number> = {}
  for (const key of Object.keys(arrivedAt ?? {})
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0)
    .sort((a, b) => a - b)) {
    const to = shiftPastViborg(key)
    if (!(to in moved)) moved[to] = arrivedAt![key]!
  }

  return withHistoricalTravelEligibility(stampRoute(
    {
      ...rest,
      cityIndex: shiftPastViborg(cityIndex ?? 0),
      arrivedAt: moved,
    },
    DEFAULT_LANGUAGE,
  ))
}

/**
 * v5 -> v6: create an explicit home for historical readiness. Deliberately do
 * not infer it from wrapped words, route position, arrivals or the developer
 * jumper; C1-06 may add only facts its legacy fixture can actually prove.
 */
function withHistoricalTravelEligibility(persisted: unknown): unknown {
  const state = (persisted ?? {}) as Record<string, unknown>
  const raw = state.historicalTravelEligibility
  const historicalTravelEligibility = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? Object.fromEntries(Object.entries(raw).filter(([, value]) => value === true))
    : {}
  return { ...state, historicalTravelEligibility }
}

/**
 * v4 -> v5: the journey position learns which route it is a position ON.
 *
 * The whole migration is two fields added. `cityIndex`, `arrivedAt` and above
 * all `wrapped` are copied through untouched — and that is the point rather
 * than an economy. Every save in existence is Danish, so folding it into the
 * `da` namespace is exactly "say it is Danish and change nothing", and a
 * migration that names no existing field cannot lose one. A player's wrapped
 * words are safe here by construction, not by care.
 *
 * The obvious alternative was to nest the position under a
 * `routes: { da: {...} }` map. It reads tidier and it would have rewritten
 * every save to get there, for a save shape no second language needs: only one
 * route is ever live, and the others are parked.
 */
function stampRoute(persisted: unknown, code: LanguageCode): unknown {
  return { ...((persisted ?? {}) as Record<string, unknown>), routeLanguage: code, parked: {} }
}

/**
 * Park the position on the route being left and pick up the one on the route
 * being joined — or start that route at its first stop if it has never been
 * travelled.
 *
 * Pure and exported so it can be tested against a second language, which is
 * the only way to test it at all while Danish is the only pack that ships. A
 * seam that only Danish ever exercises is a seam that will not fit German.
 */
/** The shape `switchRoute` needs: a live position, its stamp, and the parked ones. */
type Travelling = RoutePosition & {
  furthest?: number
  routeLanguage: LanguageCode
  parked: Partial<Record<LanguageCode, RoutePosition>>
}

export function switchRoute<T extends Travelling>(state: T, to: LanguageCode): T {
  if (state.routeLanguage === to) return state
  const resumed = state.parked[to] ?? { cityIndex: 0, arrivedAt: {} }
  const parked = { ...state.parked }
  delete parked[to]
  // `furthest` is parked only when it says something — a position that never
  // travelled back parks in exactly the shape it always did.
  parked[state.routeLanguage] = {
    cityIndex: state.cityIndex,
    arrivedAt: state.arrivedAt,
    ...(state.furthest !== undefined && state.furthest > state.cityIndex ? { furthest: state.furthest } : {}),
  }
  return {
    ...state,
    cityIndex: resumed.cityIndex,
    arrivedAt: resumed.arrivedAt,
    // A parked position from before Travel back has none; 0 reads as
    // "no further than cityIndex" (see reachedIndex).
    furthest: resumed.furthest ?? 0,
    routeLanguage: to,
    parked,
  }
}

export const useJourney = create<JourneyStore>()(
  persist(
    (set, get) => ({
      ...initial,
      wrapWords: (wordIds, now) =>
        set((s) => {
          const wrapped = { ...s.wrapped }
          for (const id of wordIds) if (!(id in wrapped)) wrapped[id] = now
          return { wrapped }
        }),
      noteTrainClosed: () => {
        track({ name: 'train_closed', city: get().cityIndex })
        set({ waitingForTrain: true })
      },
      preserveHistoricalTravelEligibility: (city) =>
        set((s) => {
          const key = cityKey(city)
          if (s.historicalTravelEligibility[key] === true) return s
          return { historicalTravelEligibility: { ...s.historicalTravelEligibility, [key]: true } }
        }),
      travel: (now) =>
        set((s) => {
          const next = s.cityIndex + 1
          // The map only offers travel where a next city exists; refusing here
          // too keeps a stray call from walking off the route.
          if (next >= CITIES.length) return s
          // Release scope (DEVELOPED_CITY_LIMIT): no one travels past the last
          // developed stop, whatever the packing gate would allow once City 2
          // content exists behind the same route.
          if (next > DEVELOPED_CITY_LIMIT) return s
          // First arrival wins, like `wrapWords`: travelling on again after a
          // Travel back passes through cities already in the log, and the
          // date worth keeping is the one the city was first reached.
          return {
            cityIndex: next,
            furthest: Math.max(reachedIndex(s), next),
            arrivedAt: s.arrivedAt[next] ? s.arrivedAt : { ...s.arrivedAt, [next]: now },
            // Boarding is the word the notice promised; nothing is owed now.
            waitingForTrain: false,
          }
        }),
      travelTo: (cityIndex) =>
        set((s) => {
          if (!Number.isInteger(cityIndex) || cityIndex < 0 || cityIndex >= CITIES.length) return s
          if (cityIndex === s.cityIndex || !hasReached(s, cityIndex)) return s
          // Release scope (DEVELOPED_CITY_LIMIT): Travel back stays inside the
          // developed stops, exactly like travel forward.
          if (cityIndex > DEVELOPED_CITY_LIMIT) return s
          return { cityIndex, furthest: reachedIndex(s) }
        }),
      playtestTravelTo: (cityIndex, now) =>
        set((s) => {
          if (!Number.isInteger(cityIndex) || cityIndex < 0 || cityIndex >= CITIES.length) return s
          // Keep the arrival log truthful without inventing wrapped words.
          // The setting that calls this is compiled only into local/TestFlight
          // builds, and turning it off restores the ordinary packing gate.
          return {
            cityIndex,
            furthest: Math.max(reachedIndex(s), cityIndex),
            arrivedAt: s.arrivedAt[cityIndex] ? s.arrivedAt : { ...s.arrivedAt, [cityIndex]: now },
          }
        }),
      reset: () => set({ ...initial }),
    }),
    {
      name: 'cluecab-journey-v2',
      version: 7,
      migrate: migrateJourney,
      /**
       * The language may have changed since this save was written — the picker
       * reloads the app, so by the time we get here `ACTIVE` is already the new
       * one. Swapping at rehydrate rather than at the moment of the tap means
       * there is exactly one place the two positions ever trade, and it runs
       * before any screen has read the store.
       */
      onRehydrateStorage: () => (state) => {
        if (state && state.routeLanguage !== ACTIVE.code) {
          useJourney.setState(switchRoute(state, ACTIVE.code))
        }
        // Release scope (DEVELOPED_CITY_LIMIT): a save written beyond the
        // developed stops — an earlier build's save on an updated phone, or a
        // playtest jumper's — rehydrates standing at Sønderborg with the
        // travel log pruned to it. `wrapped` survives untouched: word
        // knowledge is not travel history, and canTravel() recomputes the
        // road from it. THIS CLAMP MOVES WITH THE SCOPE: raise
        // DEVELOPED_CITY_COUNT in src/journey/cities.ts when City 2 ships and
        // the clamp lets those saves come back.
        if (state) useJourney.setState(clampToDevelopedScope(state))
      },
    },
  ),
)

/**
 * Recover progress stranded by the v1 -> v2 key rename. Runs once per device,
 * after the store has rehydrated, and merges rather than replaces so it can
 * only ever add. See src/journey/rescue.ts for why this is needed at all.
 */
export function rescueStrandedJourney(): RescueResult {
  if (typeof localStorage === 'undefined') return { outcome: 'nothing-to-rescue' }
  if (alreadyRescued(localStorage)) return { outcome: 'already-done' }
  const s = useJourney.getState()
  const result = planRescue(readV1(localStorage), {
    cityIndex: s.cityIndex,
    wrapped: s.wrapped,
    arrivedAt: s.arrivedAt,
  })
  markRescued(localStorage)
  if (result.outcome !== 'rescued' || !result.journey) return result
  const j = result.journey
  const numeric = (r: Record<string, number>): Record<number, number> =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [Number(k), v]))
  // The City-1 clamp is absolute (owner, 2026-09-15): it runs on rehydrate and
  // it must survive the rescue that runs after it. A v1 save clamps its index
  // only to the FULL route (rescue.ts, CITIES.length - 1), so merging it in
  // raw reintroduced a position past the developed stops AFTER the rehydrate
  // clamp had removed one — the TestFlight 82/83 white screen: JourneyMap
  // draws only the developed stops, then reads points[cityIndex] and finds
  // nothing there. The same clamp as rehydrate, same math, one scope: the
  // position lands at Sønderborg while the recovered words survive.
  const clamped = clampToDevelopedScope({
    cityIndex: j.cityIndex,
    furthest: j.furthest,
    arrivedAt: numeric(j.arrivedAt as unknown as Record<string, number>),
  })
  useJourney.setState({
    cityIndex: clamped.cityIndex,
    furthest: clamped.furthest,
    wrapped: j.wrapped,
    arrivedAt: clamped.arrivedAt,
  })
  return result
}
