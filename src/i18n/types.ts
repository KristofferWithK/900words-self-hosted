/**
 * The language the APP SPEAKS TO THE PLAYER — not the language being learned.
 *
 * Two different languages are in play at once and the code keeps them apart on
 * purpose. `LanguageCode` in `src/lang/types.ts` is the language you are
 * LEARNING (Danish today, German one day): its words, its route, its audio,
 * its grammar. `UiLanguage` here is the language you already SPEAK: the menus,
 * Casey's explanations, the Travel Guide's prose, and — from Phase 3 — what
 * each Danish word MEANS.
 *
 * A German speaker learning Danish sets `UiLanguage` to 'de' and leaves the
 * learner language on Danish. Nothing about Danish changes.
 *
 * See docs/ui-language-plan.md for the phases and the decisions (UL1-UL12).
 */
export type UiLanguage =
  | 'en'
  | 'de'
  | 'es'
  | 'zh'
  | 'fr'
  | 'pt'
  | 'pl'
  | 'hu'
  | 'sv'
  | 'nb'
  | 'nl'

/**
 * Every UI language that ships, in the order the pickers list them: English
 * first because it is the default, then the rest by the size of the audience
 * they open the app to.
 *
 * Swedish is here for a reason worth knowing when you read its copy: its
 * speakers can already half-read Danish, so its false friends are the dangerous
 * kind (`proxy/casey/player-language.js`), and its translation must NOT quietly
 * become Danish. (Norwegian and Dutch were here before the launch scope
 * trimmed the picker to seven.)
 */
export const UI_LANGUAGES: readonly UiLanguage[] = [
  'en',
  'de',
  'sv',
  'pl',
  'pt',
  'zh',
  'fr',
]
/**
 * At the iOS 1.0 launch the picker offers seven languages; the es, nl, nb and
 * hu catalogue files below stay compiled and typechecked, but they are NOT
 * offered in the picker, NOT auto-detected, and `isUiLanguage` rejects their
 * codes: a device with a stored value for one of them falls back to English in
 * `readStoredUiLanguage`, and `hasStoredUiLanguage` returns false, so the
 * first-run question is asked again.
 */

const CODES: ReadonlySet<string> = new Set<string>(UI_LANGUAGES)

export const isUiLanguage = (v: unknown): v is UiLanguage =>
  typeof v === 'string' && CODES.has(v)

export interface UiLanguageInfo {
  readonly code: UiLanguage
  /**
   * The language's own name for itself. The pickers show ONLY this: a player
   * who landed in a language they cannot read has to be able to find their own
   * in the list, and "German" is no help to someone looking for "Deutsch".
   */
  readonly endonym: string
  /**
   * BCP-47, for `<html lang>` and every `toLocale*` call (UL11). Not always the
   * code: Simplified Chinese is 'zh-Hans', because 'zh' alone leaves the script
   * to the device and can render Traditional glyphs.
   */
  readonly tag: string
  /**
   * Leading words stripped before two glosses are compared — English "to run"
   * and "run" are the same answer. Phase 3 hands this to `createDataset` so the
   * rule follows the player's language instead of assuming English. Null where
   * the language has no such words (Chinese).
   */
  readonly glossArticles: RegExp | null
  /**
   * The sentence band's layout constants, measured in the browser at the tight
   * 360×640 phone for THIS language's gloss text (§9.3 step 5). `charsPerLine`
   * is how many characters one rendered line holds in `.sentence-da` /
   * `.sentence-en` (the `Long` variants once the text is past LONG_DA/LONG_EN
   * and drops a size); `linePx` is the pixels one drawn line costs. The
   * estimator in `RoundSentences.tsx` reads these instead of guessing, and
   * endgame-drive re-measures the real render against them, so a value that
   * flatters the phone fails the drive instead of clipping a row.
   *
   * The Danish side is the same text for every player, but the column width,
   * font stack and measurement are what they are: each language records its own
   * numbers from a real render rather than borrowing a neighbour's.
   */
  readonly sentenceLayout: {
    readonly charsPerLine: Readonly<{ da: number; daLong: number; en: number; enLong: number }>
    readonly linePx: Readonly<{ da: number; daLong: number; en: number; enLong: number }>
  }
}
