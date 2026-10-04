import type { WordEntry } from '../data/types'
import { spokenArticle } from '../data/gender'
import type { RunWalk } from './results'
import type { RunWord } from './words'

/**
 * THE TWO WALKS (contract §2): Words asks what a word means; Articles asks a
 * noun's article. "Articles walk: the noun is on the tag and there are two
 * lanes, `en` always left and `et` always right. German has three lanes for
 * der, die, das."
 *
 * Nothing here knows Danish or German. The lanes come from the course data:
 * the articles its nouns carry, in the order of its gender table.
 */

/** What `articleLanes` and `walksForCourse` read of a course. A LanguagePack fits. */
export interface CourseArticles {
  readonly words: readonly Pick<WordEntry, 'pos' | 'article' | 'gender' | 'countable'>[]
  readonly grammar: { readonly genders: Readonly<Record<string, unknown>> }
}

/**
 * The lanes of the Articles walk, left to right: every article the course
 * prints and says in front of a noun (src/data/gender.ts), in the order of the
 * course's gender table. Danish gives en, et (common, neuter); German der,
 * die, das (masculine, feminine, neuter). Fixed for the course, so an article
 * always has the same lane. Two genders that share an article share its lane.
 * A course whose nouns carry no article gives none.
 */
export function articleLanes(course: CourseArticles): string[] {
  const genderOrder = Object.keys(course.grammar.genders)
  const rank = new Map<string, number>()
  const firstSeen = new Map<string, number>()
  course.words.forEach((w, i) => {
    const article = spokenArticle(w)
    if (!article) return
    if (!firstSeen.has(article)) firstSeen.set(article, i)
    const g = w.gender === undefined ? -1 : genderOrder.indexOf(w.gender)
    const r = g < 0 ? genderOrder.length : g
    rank.set(article, Math.min(rank.get(article) ?? Infinity, r))
  })
  return [...rank.keys()].sort((a, b) => rank.get(a)! - rank.get(b)! || firstSeen.get(a)! - firstSeen.get(b)!)
}

/**
 * The walks a course offers. Words always; Articles only when the course's
 * nouns have at least two articles to choose between. Home's "Words /
 * Articles" question (CW-10) reads this: a course without articles shows no
 * Articles choice.
 */
export function walksForCourse(course: CourseArticles): RunWalk[] {
  return articleLanes(course).length >= 2 ? ['words', 'articles'] : ['words']
}

/**
 * A lane of the Articles walk, as the run's suitcase: the article itself. Its
 * `group` is no word's group, so it is never asked or offered in the Words walk.
 */
export function articleLaneWord(article: string): RunWord {
  return {
    id: `article:${article}`,
    origin: 'board',
    target: article,
    prompt: article,
    group: 'article-lane',
    keys: [],
    audio: null,
  }
}

/** The lane of an article, or -1 when the walk has no lane for it. */
export function laneOfArticle(lanes: readonly string[], article: string | undefined): number {
  return article === undefined ? -1 : lanes.indexOf(article)
}

// ── which walk the Sightseeing screen opens ────────────────────────────────

let chosen: RunWalk = 'words'

/**
 * Say which walk the Sightseeing screen opens next. Home's question (CW-10)
 * and the `?sightseeing=` dev switch call this before going to the screen.
 * Kept here, outside any store: it is a one-shot choice, never saved.
 */
export function chooseWalk(walk: RunWalk): void {
  chosen = walk
}

/** The walk chosen last; Words until one is chosen. */
export function chosenWalk(): RunWalk {
  return chosen
}
