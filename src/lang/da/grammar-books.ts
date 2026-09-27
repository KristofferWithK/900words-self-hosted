import { danishGrammarCourse } from './curriculum-grammar'
import type { GrammarLesson } from '../curriculum-grammar'
import { buildGrammarBookshelf } from '../grammar-books'
import type { GrammarBookCity, GrammarBookLesson } from '../grammar-books'

/**
 * The reader-facing projection of the reviewed Danish grammar course.
 *
 * The projection logic itself now lives in `src/lang/grammar-books.ts` so a
 * second language gets the same two-page cards from its own course. Only the
 * Danish inputs are here: the route's city names, the cover marks, and the two
 * legacy page ids that shipped before lesson ids were namespaced.
 */
export type {
  GrammarBook,
  GrammarBookBlock,
  GrammarBookPage,
} from '../grammar-books'

export type DanishGrammarBookChapter = GrammarBookCity

const CITY_NAMES = ['Sønderborg', 'Ribe', 'Kolding', 'Aarhus', 'Aalborg', 'Skagen', 'Odense', 'Roskilde', 'København'] as const

/** `sonderborg-articles` shipped as `articles`; a stored page id must keep working. */
function legacyPageId(lesson: GrammarLesson, page: 'rules' | 'examples'): string | undefined {
  if (lesson.id !== 'sonderborg-articles') return undefined
  return page === 'rules' ? 'articles' : 'articles-examples'
}

/** The whole shelf, for the active-language registry in `src/lang/bookshelf.ts`. */
export const danishGrammarBookshelf = buildGrammarBookshelf({
  course: danishGrammarCourse,
  cityNames: CITY_NAMES,
  languageCode: 'da',
  targetLabel: 'Danish',
  lessonMark: 'DK',
  cityMark: 'Aa',
  pageId: legacyPageId,
})

/** Nine Guide city entries; the course owns their 18 fixed two-page lessons. */
export const danishGrammarBooks: readonly GrammarBookCity[] = danishGrammarBookshelf.cities

export function grammarBookForCity(cityId: string, lessonId?: string): GrammarBookLesson | undefined {
  return danishGrammarBookshelf.forCity(cityId, lessonId)
}

export function grammarBooksForCityIndex(cityIndex: number): readonly GrammarBookLesson[] {
  return danishGrammarBookshelf.forCityIndex(cityIndex)
}
