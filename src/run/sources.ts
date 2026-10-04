import { WORDS } from '../data/words'
import type { WordEntry } from '../data/types'
import connectingCity1 from '../data/city1-connecting-words.da.json'
import { UI, UI_LANGUAGE, UI_LANGUAGE_INFO } from '../i18n'
import { COMPLETE } from '../i18n/glosses'
import type { UiLanguage } from '../i18n/types'
import { wordsForCity } from '../journey/progress'
import { ACTIVE } from '../lang/active'
import type { RunWalk } from './results'
import { articleLanes, laneOfArticle } from './walks'
import {
  boardRunWords,
  cityRunWords,
  connectingRunWords,
  type ConnectingWordList,
  type RunWord,
  type RunWordSource,
} from './words'

/**
 * Where a run's words come from in the app.
 *
 * Board words: a city's hundred card words from the course data, in the
 * player's language (the gloss overlay), with the canonical English kept as
 * extra meaning keys so a wrong answer can never share a meaning in either.
 *
 * Connecting words (contract §3): the words a city teaches outside its cards.
 * Sønderborg's are in src/data/city1-connecting-words.da.json, with their own
 * kinds and their own recordings. They join only the course and city their
 * list is for, and only when their tags can be written in the language the
 * board words' tags are written in (see `connectingMeaningLanguage`).
 */

const canonical: ReadonlyMap<string, WordEntry> = new Map((ACTIVE.sourceWords ?? []).map((w) => [w.id, w]))

export const boardWordSource: RunWordSource = {
  origin: 'board',
  words: (cityIndex) =>
    boardRunWords(
      wordsForCity(WORDS, cityIndex),
      (id) => canonical.get(id),
      { playerArticles: UI_LANGUAGE_INFO[UI_LANGUAGE].glossArticles, verbPrompt: UI.sightseeing.verbPrompt },
    ),
}

/** Every connecting-words list there is. One per course and city. */
export const CONNECTING_LISTS: readonly ConnectingWordList[] = [connectingCity1 as ConnectingWordList]

/**
 * The language a player's connecting-word tags are written in: the language
 * the board words' tags are written in. English for an English player and for
 * a player whose language has no complete gloss overlay yet (their board tags
 * are English too); the player's own language otherwise. A list with no
 * meanings in that language would add no words; the Sønderborg list has
 * meanings in every language this can return (English, German, French,
 * Polish, Portuguese, Swedish and Chinese), so every player gets all of them.
 */
export function connectingMeaningLanguage(lang: UiLanguage): string {
  return lang === 'en' || !COMPLETE[lang] ? 'en' : lang
}

/** A city's connecting words for the course being played, in the player's language. */
export function connectingWordsFor(
  courseLanguage: string,
  cityIndex: number,
  lang: UiLanguage,
  lists: readonly ConnectingWordList[] = CONNECTING_LISTS,
): RunWord[] {
  return lists
    .filter((l) => l.language === courseLanguage && l.city === cityIndex)
    .flatMap((l) =>
      connectingRunWords(l, connectingMeaningLanguage(lang), { playerArticles: UI_LANGUAGE_INFO[lang].glossArticles }),
    )
}

export const connectingWordSource: RunWordSource = {
  origin: 'connecting',
  words: (cityIndex) => connectingWordsFor(ACTIVE.code, cityIndex, UI_LANGUAGE),
}

/** Every list of run words, in order: the cards, then the connecting words. */
export const RUN_WORD_SOURCES: readonly RunWordSource[] = [boardWordSource, connectingWordSource]

/** The words a city's runs draw from. */
export function runWordsForCity(cityIndex: number): RunWord[] {
  return cityRunWords(RUN_WORD_SOURCES, cityIndex)
}

/** The Articles walk's lanes for the course being played, left to right. */
export function activeArticleLanes(): string[] {
  return articleLanes(ACTIVE)
}

/** The nouns of a pool the Articles walk can ask: those whose article has a lane. */
export function articleWords(pool: readonly RunWord[], lanes: readonly string[]): RunWord[] {
  return pool.filter((w) => laneOfArticle(lanes, w.article) >= 0)
}

/** The words a walk of a city asks from. */
export function walkPool(walk: RunWalk, cityIndex: number, lanes: readonly string[] = activeArticleLanes()): RunWord[] {
  const all = runWordsForCity(cityIndex)
  return walk === 'articles' ? articleWords(all, lanes) : all
}
