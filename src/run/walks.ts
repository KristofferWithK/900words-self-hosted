import type { WordEntry } from '../data/types'
import { spokenArticle } from '../data/gender'
import type { RunWalk } from './results'
import type { RunWord } from './words'

/**
 * ARTICLE GATES (contract §2; owner, 2026-10-05: "Let's merge the article run
 * into Sightseeing"). There is one Sightseeing walk. Where the course's nouns
 * carry two or three articles, the walk mixes in article gates: the noun is on
 * the tag and the lanes are its possible articles, each always in its own
 * lane. An article gate has a longer run-up (engine.ts `ARTICLE_RUN_UP`).
 *
 * The articles come from the course data: the ones its nouns carry, in the
 * order of its gender table (`articleLanes`). Danish is the one course whose
 * lane order the owner set by hand (`OWNER_LANE_ORDER`): et left, en right,
 * and a brick wall in the middle lane.
 */

/** What `articleLanes` and `articleGateLanes` read of a course. A LanguagePack fits. */
export interface CourseArticles {
  /** The course's language code: only for an owner-set lane order (`OWNER_LANE_ORDER`). */
  readonly code?: string
  readonly words: readonly Pick<WordEntry, 'pos' | 'article' | 'gender' | 'countable'>[]
  readonly grammar: { readonly genders: Readonly<Record<string, unknown>> }
}

/**
 * Every article the course prints and says in front of a noun
 * (src/data/gender.ts), in the order of the course's gender table. Danish
 * gives en, et (common, neuter); German der, die, das (masculine, feminine,
 * neuter). Two genders that share an article share it once. A course whose
 * nouns carry no article gives none.
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
 * Lane orders the owner set for a course, left to right, where they differ
 * from the gender table's. Danish: "et" on the left, "en" on the right (owner,
 * 2026-10-05; the old Articles walk had en left).
 */
export const OWNER_LANE_ORDER: Readonly<Record<string, readonly string[]>> = { da: ['et', 'en'] }

/** The road's lanes. An article gate fills all three. */
const ROAD_LANES = 3

/**
 * THE LANES OF AN ARTICLE GATE, left to right across the walk's three lanes:
 * an article per lane, or null for the brick wall. Three articles fill the
 * three lanes (German: der, die, das). Two articles take the outer lanes and
 * the middle lane is a brick wall (Danish: et, wall, en). Null when the course
 * has no article gates: fewer than two articles, or more than the road's three
 * lanes hold.
 */
export function articleGateLanes(course: CourseArticles): (string | null)[] | null {
  const found = articleLanes(course)
  const owner = course.code ? OWNER_LANE_ORDER[course.code] : undefined
  const order = owner && owner.length === found.length && found.every((a) => owner.includes(a)) ? [...owner] : found
  if (order.length === 2) return [order[0], null, order[1]]
  if (order.length === ROAD_LANES) return order
  return null
}

/** Whether a course's walk has article gates. */
export function hasArticleGates(course: CourseArticles): boolean {
  return articleGateLanes(course) !== null
}

/**
 * A lane of an article gate, as the run's suitcase: the article itself. Its
 * `group` is no word's group, so it is never asked or offered as a meaning.
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

/** The id of the brick wall's lane: nothing to answer, nothing said. */
export const WALL_ID = 'article:wall'

/** The brick wall's lane of a two-article gate. It says nothing: no article is drawn on it. */
export const WALL_LANE: RunWord = {
  id: WALL_ID,
  origin: 'board',
  target: '',
  prompt: '',
  group: 'article-lane',
  keys: [],
  audio: null,
}

/** The lane of an article, or -1 when the gate has no lane for it (the wall is no article's lane). */
export function laneOfArticle(lanes: readonly (string | null)[], article: string | undefined): number {
  return article === undefined ? -1 : lanes.indexOf(article)
}

// ── which run the Sightseeing screen opens ─────────────────────────────────

let chosen: RunWalk = 'words'
let startsNow = false

/**
 * Say which run the Sightseeing screen opens next: the walk, or the train
 * run. Home's Sightseeing tag, the train sheet and the `?sightseeing=` dev
 * switch call this before going to the screen. Kept here, outside any store:
 * it is a one-shot choice, never saved.
 *
 * `startNow`: the walk starts as the screen opens, with no ready panel to tap
 * through (owner, after build 123: "it should go straight into the game, not
 * another screen where you first have to tap OK again"). Home's Sightseeing
 * tag says so; the dev switch and the train run do not.
 */
export function chooseWalk(walk: RunWalk, { startNow = false }: { startNow?: boolean } = {}): void {
  chosen = walk
  startsNow = startNow
}

/** The run chosen last; the walk until one is chosen. */
export function chosenWalk(): RunWalk {
  return chosen
}

/**
 * Whether the run chosen last starts at once, read once: the screen that
 * opens it takes it, so a later visit (or a reload, which forgets it) opens
 * on the ready panel.
 */
export function takeWalkStartNow(): boolean {
  const now = startsNow
  startsNow = false
  return now
}
