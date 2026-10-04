import { cafeNameForBoard } from '../cafe/cafeName'
import { cafeSetFor, cafesForCity, readSettledFacts } from '../journey/cafeAccess'
import type { Cafe } from '../journey/cafes'
import type { LanguageCode } from '../lang/types'
import { ACTIVE } from '../lang/active'
import { useJourney } from '../stores/journeyStore'

/**
 * THE FIRST CAFÉ OF THE FIRST SESSION (CW-13, contract section 7).
 *
 * The first walk finds Sønderborg's first café after five photos (CW-04's
 * rule, unchanged). Two paths reach Home without that walk's find: a Skip, and
 * a first walk that ended before its fifth photo. Both still land on a Home
 * whose Café puzzle tag can be played: the first café is found for them here,
 * by counting the photos it still needs through the same journey-store call
 * a walk makes (`recordCafePhoto`, no word marks), so the find is stored the
 * way any other find is. Nothing happens once the city has a café found or
 * played: this never finds a second café and never moves a later find.
 *
 * Returns the city's first café found (or played) afterwards, or null where
 * the city has no cafés or the settled facts cannot be read.
 */
export function ensureFirstCafeFound(course: LanguageCode = ACTIVE.code, now: number = Date.now()): Cafe | null {
  const set = cafeSetFor(0, course)
  if (!set) return null
  const facts = readSettledFacts()
  if (!facts) return null
  const first = () => cafesForCity(0, facts, course)?.cafes.find((cafe) => cafe.state !== 'unfound') ?? null
  const already = first()
  if (already) return already
  const summary = cafesForCity(0, facts, course)?.summary
  const needed = Math.max(1, (summary?.needed ?? 1) - (summary?.toward ?? 0))
  const journey = useJourney.getState()
  for (let i = 0; i < needed; i++) {
    const found = journey.recordCafePhoto(set, set.boards, facts, now)
    if (found) return found
  }
  return first()
}

/** The first café found in the city, or null: the one the first session plays. */
export function firstFoundCafe(course: LanguageCode = ACTIVE.code): Cafe | null {
  return cafesForCity(0, readSettledFacts(), course)?.cafes.find((cafe) => cafe.state !== 'unfound') ?? null
}

/** Its name for Casey's lines: the Danish proper name, or null (the German course has none). */
export function firstCafeName(course: LanguageCode = ACTIVE.code): string | null {
  return cafeNameForBoard(firstFoundCafe(course)?.board)
}
