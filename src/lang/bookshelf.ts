import { ACTIVE } from './active'
import { danishGrammarBookshelf } from './da/grammar-books'
import { danishSurvivalGuide } from './da/survival'
import { survivalAudioLineId, survivalAudioSourceFor } from './da/survival-audio'
import { germanSurvivalGuide } from './de/survival'
import { germanGrammarBookshelf } from './de/curriculum-grammar'
import type { GrammarBookCity, GrammarBookLesson, GrammarBookshelf } from './grammar-books'
import type { SurvivalGuide } from './survival'

/**
 * THE ACTIVE TRAVEL GUIDE.
 *
 * The Guide's four surfaces — the book, the reader, the train ride and the
 * wrap-up's choices — imported `danishGrammarBooks` and `danishSurvivalGuide`
 * directly, which was the one hole left in the language seam: switching
 * language changed the words, the route and the map, and left the Guide
 * speaking Danish. This is the patch, in the shape `lang/active.ts` already
 * uses: resolved once at module load, constant for the life of the page.
 *
 * Why a registry here rather than a field on `LanguagePack`: the projection
 * needs city NAMES and cover marks, which the route already owns, and putting a
 * built bookshelf on the pack would make every pack import the reader's types
 * to be constructed. A language adds one line here, the same way it adds one to
 * `LANGUAGES`.
 */
const SHELVES: Record<string, GrammarBookshelf> = {
  da: danishGrammarBookshelf,
  // Built on demand rather than at module load, because German's course is
  // still review-ready: see `previewGrammarCourseFromBrief`.
  de: germanGrammarBookshelf(),
}

const shelf: GrammarBookshelf = SHELVES[ACTIVE.code] ?? danishGrammarBookshelf

export const activeGrammarBooks: readonly GrammarBookCity[] = shelf.cities

export const grammarBookForActiveCity = (cityId: string, lessonId?: string): GrammarBookLesson | undefined =>
  shelf.forCity(cityId, lessonId)

export const grammarBooksForActiveCityIndex = (cityIndex: number): readonly GrammarBookLesson[] =>
  shelf.forCityIndex(cityIndex)

/**
 * The Survival book for the active language.
 *
 * A language with no authored exchanges gets an EMPTY guide rather than null:
 * every call site already handles a city that is not there (`?.exchanges[i]`),
 * and an empty `cities` array makes the Survival index render its own empty
 * state instead of forcing a null check into four components.
 */
const EMPTY_GUIDE: SurvivalGuide = { cities: [] }

const SURVIVAL: Record<string, SurvivalGuide> = {
  da: danishSurvivalGuide,
  de: germanSurvivalGuide,
}

export const activeSurvivalGuide: SurvivalGuide = SURVIVAL[ACTIVE.code] ?? EMPTY_GUIDE

/**
 * How to name a dialogue turn's baked clip — or NULL when this language has no
 * bake at all.
 *
 * Danish's 144 turns are frozen under `audio/da/survival/` and committed.
 * German's City 1 turns are baked in Leda under `audio/de/survival/` (owner,
 * 2026-09-26); its later cities have no recording, so a turn is named only
 * when its source row exists and the reader greys the rest out rather than
 * offering a button that plays nothing. That is the same distinction the app
 * already draws between a clip that fails to load and a clip that was never
 * made — there is no device-voice fallback anywhere (owner, 2026-09-05).
 */
type SurvivalAudioLineId = (activityId: string, lineIndex: number) => string | undefined
const recordedGermanLine: SurvivalAudioLineId = (activityId, lineIndex) => {
  const id = survivalAudioLineId(activityId, lineIndex)
  return survivalAudioSourceFor(id, 'de') ? id : undefined
}
const SURVIVAL_AUDIO: Record<string, SurvivalAudioLineId> = {
  da: survivalAudioLineId,
  de: recordedGermanLine,
}

export const activeSurvivalAudioLineId: SurvivalAudioLineId | null =
  SURVIVAL_AUDIO[ACTIVE.code] ?? null
