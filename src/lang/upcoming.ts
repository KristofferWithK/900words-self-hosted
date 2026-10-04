import type { MapArt } from './types'
import * as france from './upcoming/france-map'
import * as uk from './upcoming/uk-map'

/**
 * The courses the language ticket announces as coming soon.
 *
 * NOT language packs: no words, no route, no readiness, nothing a round could
 * be dealt from — a name and a drawing, so the ticket can show where the
 * journey goes next. `playableLanguages()` never sees these and nothing may
 * select one. When a course becomes a real pack it leaves this list and joins
 * `LANGUAGES` in `./index.ts`, and its map moves into the pack with it.
 *
 * The names are English for the same reason the playable tickets' are: the
 * ticket prints `pack.route.country` and `pack.name`, which are English in
 * every pack, so these match them rather than being the one ticket localized.
 */
export interface UpcomingCourse {
  /** The ISO 639-1 code the pack will have. A React key, nothing more yet. */
  readonly code: string
  /** English name, as the playable tickets print `pack.name`: "French". */
  readonly name: string
  /** The language's own name: "Français". */
  readonly endonym: string
  /** The country, as the playable tickets print `pack.route.country`. */
  readonly country: string
  readonly map: MapArt
}

const franceMap: MapArt = {
  width: france.MAP_WIDTH,
  height: france.MAP_HEIGHT,
  project: france.projectCity,
  path: france.FRANCE_PATH,
  sketch: france.FRANCE_SKETCH,
  hatch: france.FRANCE_HATCH,
}

const ukMap: MapArt = {
  width: uk.MAP_WIDTH,
  height: uk.MAP_HEIGHT,
  project: uk.projectCity,
  path: uk.UK_PATH,
  sketch: uk.UK_SKETCH,
  hatch: uk.UK_HATCH,
}

export const UPCOMING_COURSES: readonly UpcomingCourse[] = [
  { code: 'fr', name: 'French', endonym: 'Français', country: 'France', map: franceMap },
  // The owner's word for it on the ticket, and the only one that fits a
  // half-width card: "United Kingdom" does not.
  { code: 'en', name: 'English', endonym: 'English', country: 'UK', map: ukMap },
]
