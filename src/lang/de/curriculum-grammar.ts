import { grammarCourseFromBrief, previewGrammarCourseFromBrief } from '../curriculum-grammar'
import type { GrammarCourse } from '../curriculum-grammar'
import { buildGrammarBookshelf } from '../grammar-books'
import type { GrammarBookCity, GrammarBookLesson, GrammarBookshelf } from '../grammar-books'
import { GERMAN_GRAMMAR_REWRITE_BRIEF } from './curriculum-grammar-brief'
import { GERMAN_ROUTE_CITY_NAMES } from './route-cities'

/**
 * German's train chapters and Travel Guide lessons.
 *
 * ── WHERE THE REVIEW GATE MOVED, AND WHY ───────────────────────────────────
 *
 * When this course was authored it could not be built at all: the brief is
 * `review-ready`, `grammarCourseFromBrief` refuses anything but `accepted`,
 * and that refusal WAS the gate. Then German became a switchable preview, and
 * a Travel Guide that cannot be opened cannot be reviewed — the person who has
 * to verify it reads TypeScript instead of the pages a learner would see.
 *
 * So the gate moved rather than disappeared, and it is worth being plain that
 * this is a real weakening:
 *
 *  - `grammarCourseFromBrief` — the path a SHIPPING pack takes — still refuses
 *    this brief, and `grammarGateHolds()` below asserts it in the test suite.
 *  - the course reaches the app only through `previewGrammarCourseFromBrief`,
 *    which only a pack with `readiness: 'preview'` may call. Such a pack
 *    cannot deal a board, and the app says the language is unverified.
 *
 * Accepting the content after the owner's native-verifier pass is still the
 * one-word change: `status: 'accepted'` in `curriculum-grammar-brief.ts`, at
 * which point both paths agree and German can become playable on its own
 * timetable.
 */
export const germanGrammarCourse = (): GrammarCourse => previewGrammarCourseFromBrief(GERMAN_GRAMMAR_REWRITE_BRIEF)

/**
 * Whether the shipping path still refuses this content. Exported so the gate
 * is asserted rather than described: it must stay true until the owner's
 * review accepts the brief.
 */
export function grammarGateHolds(): boolean {
  try {
    grammarCourseFromBrief(GERMAN_GRAMMAR_REWRITE_BRIEF)
    return false
  } catch {
    return true
  }
}

export const germanGrammarBookshelf = (): GrammarBookshelf => buildGrammarBookshelf({
  course: germanGrammarCourse(),
  cityNames: GERMAN_ROUTE_CITY_NAMES,
  languageCode: 'de',
  targetLabel: 'German',
  lessonMark: 'DE',
  cityMark: 'Ää',
})

export const germanGrammarBooks = (): readonly GrammarBookCity[] => germanGrammarBookshelf().cities

export function germanGrammarBookForCity(cityId: string, lessonId?: string): GrammarBookLesson | undefined {
  return germanGrammarBookshelf().forCity(cityId, lessonId)
}
