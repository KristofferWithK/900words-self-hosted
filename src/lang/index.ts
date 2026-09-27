import {
  audienceAllowsLearnerPreview,
  buildAudience,
  type BuildAudience,
} from '../build/audience'
import { danish } from './da'
import { german } from './de'
import type { LanguageCode, LanguagePack } from './types'

export type { LanguageCode, LanguagePack } from './types'

/**
 * The languages that actually ship.
 *
 * Danish remains the fresh-install default. German is available as a normal
 * course; namespaced word ids keep both languages' progress side by side.
 */
export const LANGUAGES: Partial<Record<LanguageCode, LanguagePack>> = {
  da: danish,
  de: german,
}

/** Packs a player can actually play a round in. */
export const playableLanguages = (
  audience: BuildAudience = buildAudience,
): LanguagePack[] => availableLanguages(audience).filter((pack) => pack.readiness === 'playable')

/**
 * What a device with nothing stored plays, and what an unknown stored code
 * falls back to. Danish remains the fresh-install default.
 */
export const DEFAULT_LANGUAGE: LanguageCode = 'da'

export const packFor = (
  code: LanguageCode,
  audience: BuildAudience = buildAudience,
): LanguagePack => {
  const pack = LANGUAGES[code]
  if (!pack || !languageAvailable(code, audience)) {
    return LANGUAGES[DEFAULT_LANGUAGE]!
  }
  return pack
}

export function languageAvailable(code: LanguageCode, audience: BuildAudience = buildAudience): boolean {
  const pack = LANGUAGES[code]
  return !!pack &&
    (pack.readiness !== 'preview' || audienceAllowsLearnerPreview(audience))
}

/** The playable packs, in the order the picker should list them. */
export const availableLanguages = (
  audience: BuildAudience = buildAudience,
): LanguagePack[] => Object.values(LANGUAGES).filter((pack) => languageAvailable(pack.code, audience))

/**
 * Whether Settings should show a language picker at all.
 *
 * The picker is hidden while only one language is available, rather than shown
 * as a one-entry list. A control whose only option is the one already selected
 * is worse than no control — it invites a tap, does nothing, and spends a row.
 *
 * Reverse it by returning true unconditionally, if a visible "Danish, more
 * coming" row turns out to be worth the row.
 */
export const hasLanguageChoice = (
  audience: BuildAudience = buildAudience,
): boolean => availableLanguages(audience).length > 1

export const isLanguageCode = (v: unknown): v is LanguageCode => v === 'da' || v === 'de'

/**
 * ── STORE NAMESPACING: what is per-language and what is not ────────────────
 *
 * This is the part of the seam most likely to be got wrong, so the reasoning is
 * written down rather than left to be inferred from five persist() calls.
 *
 * **Already namespaced, and must not be namespaced again.** Every word id
 * carries its language: `da:mor`, and a German one would be `de:Mutter`. So
 * anything keyed by word id is partitioned by construction —
 *
 *   - `srsStore.stats`      (wordId -> WordStats)
 *   - `journeyStore.wrapped` (wordId -> when it was packed)
 * — and both stay in ONE store under their existing keys. Splitting them per
 * language would move real progress between storage keys for no gain, and
 * renaming a stored key is the one mistake in this repo that has actually wiped
 * a player's collection (`src/journey/rescue.ts` is the apology). The
 * partitioning is asserted directly by `src/lang/seam.test.ts` rather than
 * trusted.
 *
 * **Route-relative, so genuinely per-language.** A city index means nothing
 * without the route it indexes, and Denmark's route is not Germany's:
 *
 *   - `journeyStore.cityIndex`
 *   - `journeyStore.arrivedAt` (keyed by city index)
 *
 * These are stamped with `routeLanguage` and parked under `parked` when the
 * language changes. Journey v5 adds those two fields and touches nothing else,
 * which is why the wrapped ledger provably cannot be harmed by it.
 *
 * **Deliberately shared, and this is a choice rather than an oversight.**
 *
 *   - `srsStore.games` — a round you played is a round you played.
 *   - `srsStore.translationPostcards` — a normal-round win earns one. A
 *     postcard is usable while packing any language's wrap-up board, so
 *     keeping the count shared avoids stranding help in a language the
 *     learner has stopped using.
 *   - everything in `settingsStore` — Base URL, model, sound, grid size and the
 *     study phase are opinions about the app, not about a language.
 *
 * **Discarded on a language change.** `gameStore`'s in-flight game holds a
 * board of one language's words; it is stamped with its language and dropped
 * when that does not match. One abandoned mid-round on a switch is the same
 * cost A1 already accepted for a mid-round update.
 *
 * **Kept, but filtered.** `feedbackStore.flags` hold a clue word and a board
 * word, and they are shown back to Casey verbatim in a later prompt. They stay
 * in one store — they are a record of what the player thought — but
 * `flagsFor` hands the prompt only the ones from the language being played. A
 * flag with no language on it was written before the seam and is Danish.
 *
 * **Recorded, so a restore can be careful.** A backup file carries the
 * language its journey position belongs to (`backup.ts`). Words merge across
 * languages; a city index does not.
 */
