import { ACTIVE } from '../lang/active'
import type { City } from './route'

export type { City } from './route'

/**
 * The active language's route.
 *
 * The Denmark data itself moved to `src/lang/da/route.ts` — which cities you
 * travel through is part of the language you are learning. This file stays as
 * the facade every screen already imports, so the seam cost nothing at the call
 * sites; only the source of `CITIES` changed.
 */
export const CITIES: readonly City[] = ACTIVE.route.cities

/**
 * Words each city owns — the suitcase-load to collect and wrap before moving
 * on. Shared by every language: nine cities of a hundred is what "900words"
 * means, and `scripts/validate-words.mjs` reads this constant to check a
 * dataset against its route.
 */
export const WORDS_PER_CITY = 100

/**
 * How much of the route this release has content for: City 1 only
 * (Sønderborg). The owner, 2026-09-15: "hard code that for release one — as
 * long as we're still in City 1 (at least a week), the map just completely
 * defaults to you being in Sønderborg, and the map path being not drawn".
 *
 * The journey store clamps every position to this scope (see
 * `DEVELOPED_CITY_LIMIT` in journeyStore.ts): a player stands at stop 0 and
 * the map draws no onward line, because no one can travel past it. BUMP THIS
 * when City 2 ships and raise the store clamp with it — the clamp is a
 * release scope, not a mechanic, and rehydrate is the only place that
 * rewrites a saved position.
 */
export const DEVELOPED_CITY_COUNT = 1

export const FINAL_CITY_INDEX = CITIES.length - 1

/**
 * The study phase (whole board shown with translations before the round) is a
 * beginner's scaffold. It covers the first five stops and fades at Skagen —
 * by then the player has met 500 words and should be recalling, not reading.
 *
 * The number survived Viborg's removal deliberately. It used to read "fades at
 * Aalborg", because Aalborg was the sixth stop; Aalborg is now the fifth, so
 * holding the landmark would have cut the scaffold to 400 words. The five
 * hundred is the reason and the city was only where five hundred landed, so
 * the count is what was kept and the landmark moved on to Skagen.
 *
 * Stated in stops rather than in cities, so it needs no per-language value: any
 * route of nine hundreds fades its scaffold at the same word count.
 */
export const STUDY_UNTIL_CITY = 5

export function cityAt(index: number): City {
  const city = CITIES[index]
  if (!city) throw new Error(`no city at index ${index}`)
  return city
}
