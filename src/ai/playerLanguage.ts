import type { UiLanguage } from '../i18n/types'

/**
 * The player's own language, as Casey needs it.
 *
 * ── WHY THIS FILE HOLDS NO COPY ────────────────────────────────────────────
 *
 * `src/ai/prompts.ts` duplicates the Worker's prompt BUILDERS on purpose: the
 * structure of a prompt is a thing worth specifying twice and comparing, and
 * the parity test in `proxy/casey/orchestrator.test.mjs` does exactly that.
 * The player-language STRINGS are a different animal. They are ordinary
 * translated copy, there are fifteen of them per language and eleven
 * languages, and a second hand-maintained copy of 165 sentences buys nothing a
 * test can check that the first copy does not already assert — it only adds a
 * place for a typo fix to be applied once and missed once.
 *
 * So the Worker owns them outright and this module re-exports them. The
 * security boundary is untouched: the browser sends a CODE and never copy, and
 * nothing in `src/ai/prompts.ts` reaches the shipped bundle (SEC3 checks it).
 *
 * Two languages meet in every Casey prompt and they are not the same axis.
 * `src/lang/` holds the language being LEARNED — Danish: how it spells, what a
 * compound looks like in it, which of its words are grammatical. This holds the
 * language the player already SPEAKS, which is the language Casey has to write
 * in. A German player learning Danish gets a Danish board and a German
 * rationale.
 *
 * The prompts themselves stay in English — that is the language the models
 * were steered in, and rewriting the rules into eleven languages would trade a
 * known prompt for ten unmeasured ones. What changes is what Casey is told to
 * write, and the worked examples that show her the register.
 */
export type { PlayerLanguage } from '../../proxy/casey/player-language'
export {
  PLAYER_LANGUAGES,
  DEFAULT_PLAYER_LANGUAGE,
  isPlayerLanguage,
  playerLanguageFor,
} from '../../proxy/casey/player-language.js'

/**
 * The two axes are separate types with the same members, and this line is what
 * keeps them from drifting apart: a UI language with no Casey pack, or a Casey
 * pack for a language the app does not offer, stops compiling here.
 */
import type { PlayerLanguageCode } from '../../proxy/casey/player-language'
type AssertExtends<A extends B, B> = A
export type EveryUiLanguageHasAPack = AssertExtends<UiLanguage, PlayerLanguageCode>
export type EveryPackIsAUiLanguage = AssertExtends<PlayerLanguageCode, UiLanguage>
