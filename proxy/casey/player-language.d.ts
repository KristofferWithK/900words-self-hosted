/**
 * Types for the Worker's player-language pack, so `src/` can name it.
 *
 * The pack itself is plain JavaScript and lives with the Worker, which is the
 * copy that ships. This file exists only so the parity spec in
 * `src/ai/prompts.ts` and the tests can import it under `tsc -b`; it declares
 * no strings of its own, and nothing here reaches the browser bundle.
 */

/** Every UI language the app offers. Mirrors `UiLanguage` in `src/i18n/types.ts`. */
export type PlayerLanguageCode =
  | 'en' | 'de' | 'es' | 'zh' | 'fr' | 'pt' | 'nl' | 'pl' | 'sv' | 'nb' | 'hu'

export interface PlayerLanguage {
  readonly code: PlayerLanguageCode
  /** The language's name in English, for the prompt that asks Casey to write in it. */
  readonly name: string
  /**
   * Words that are a Danish word AND a word of the player's language with an
   * unrelated sense. Completes "…especially if it is a Danish/German homograph
   * with unrelated senses — ", so it ends in a full stop.
   */
  readonly homographNote: string
  /** How long one reasoning may be: words for alphabetic languages, characters for Chinese. */
  readonly reasoningLength: string
  /** The short quoted rationale inside the clue prompt's JSON spec. */
  readonly rationaleExample: string
  /** The rationale of the clue prompt's full worked example reply. */
  readonly clueExampleRationale: string
  /** One quoted sentence showing the shape of a good reasoning. */
  readonly reasoningExample: string
  /**
   * The guess prompt's worked example: a whole `{"guesses": [...]}` reply on an
   * imaginary board, showing the confidence bands used honestly. It is long and
   * near the end, so it is the strongest thing in the prompt about what a reply
   * looks like — which is exactly why it has to be in the player's language.
   */
  readonly guessExample: string
  /** The translate prompt's worked examples; their gloss side is what the player reads. */
  readonly translateExamples: string
  /**
   * Board words joined into a list, INCLUDING whatever marks this language
   * quotes them with. The caller passes bare Danish words: a language that
   * writes 「」 or nothing at all must not have « » forced on it from outside.
   */
  readonly joinNames: (names: readonly string[]) => string
  /** The server-authored fallback rationale, in three pieces. */
  readonly oneIdea: (names: string) => string
  readonly alsoCameToMind: (base: string, name: string) => string
  readonly onlyIdea: (base: string) => string
  /** The server-authored fallback reasoning. */
  readonly makesMeThinkOf: (clue: string, name: string, first: boolean) => string
  /**
   * The bank's OPENING clue's rationale (orchestrator.js firstClueRationale):
   * the clue quoted, then the joined target names. The client's baked-opening
   * path calls the SAME template — the pack already ships in the bundle — so
   * the two delivery routes say the opening in one voice.
   */
  readonly firstClue: (clue: string, names: string) => string
  /** What the player is shown when Casey cannot answer at all. */
  readonly messages: {
    readonly noClue: string
    readonly noGuess: string
    readonly noWordsLeft: string
    readonly badTranslation: string
    readonly badPing: string
  }
}

export declare const PLAYER_LANGUAGES: Record<PlayerLanguageCode, PlayerLanguage>
export declare const DEFAULT_PLAYER_LANGUAGE: PlayerLanguage
export declare function isPlayerLanguage(code: string): code is PlayerLanguageCode
export declare function playerLanguageFor(code: string): PlayerLanguage
