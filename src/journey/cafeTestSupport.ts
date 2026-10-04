import type { LanguageCode } from '../lang/types'
import { cityKey } from '../progression/identity'
import { requiredSetForCourse } from '../session/courseRuntime'
import { useJourney } from '../stores/journeyStore'
import type { CafeFindsByCity } from './cafes'

/**
 * TESTS ONLY. Every café of City 1 found, on both courses, as if walks had
 * found them all: for the board game's own tests, which deal required boards
 * and are not about the café gate (journey/cafes.ts, CW-04). Imported by no
 * app module, so it never reaches a bundle.
 */
export function everyCafeFound(at = 0, courses: readonly LanguageCode[] = ['da', 'de']): CafeFindsByCity {
  const out: Record<string, { found: Record<string, number>; toward: number }> = {}
  for (const course of courses) {
    const set = requiredSetForCourse(course)
    out[cityKey(set)] = { found: Object.fromEntries(set.boards.map((b) => [b.authoredBoardId, at])), toward: 0 }
  }
  return out
}

/** Put `everyCafeFound()` into the live journey store. */
export function findEveryCafe(at = 0): void {
  useJourney.setState({ cafes: everyCafeFound(at) })
}
