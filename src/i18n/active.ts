import { isUiLanguage, UI_LANGUAGES, type UiLanguage } from './types'

/**
 * Which language the app is SPEAKING this session.
 *
 * ── WHY ITS OWN KEY AND NOT A `settingsStore` FIELD ────────────────────────
 *
 * The same two reasons `src/lang/active.ts` gives for the learner language,
 * and the first is fatal on its own.
 *
 * 1. **Phase 3 needs it at MODULE SCOPE.** The word meanings a player reads
 *    follow this setting, and they are applied where the dataset is built —
 *    `src/data/lookup.ts` and `src/data/words.ts` build seven indexes in their
 *    top-level bodies. Route that question through a store and the graph is
 *    `data/words -> lang/active -> i18n -> stores/settingsStore ->
 *    journey/progress -> data/words`: a half-initialised module and an empty
 *    dataset, intermittently, depending on which screen imported first.
 * 2. **A rehydrated store is not available early enough to be trusted.**
 *    persist() rehydrates when its module is first evaluated, and nothing
 *    orders that before the indexes are built. localStorage is the same data
 *    one step earlier with no ordering to get wrong.
 *
 * So it is one key, read once, exactly like `cluecab-language`. The cost is
 * that **switching the UI language reloads the app**, which is the honest
 * behaviour anyway: from Phase 3 the meaning of every card changes at once.
 *
 * The chrome alone could have lived in the store. Putting it there now and
 * moving it in Phase 3 would be a migration of a stored player choice for no
 * behaviour change, which is the one thing this repo has actually lost
 * progress to (`src/journey/rescue.ts`). It starts where it ends up.
 */

/**
 * Not versioned, for the same reason `cluecab-language` is not: the value is
 * one of a closed set of two-letter codes, an unreadable one falls back to
 * English, and there is nothing a migration could ever need to reshape.
 */
export const UI_LANGUAGE_KEY = 'cluecab-ui-language'

/**
 * What a device with nothing stored speaks. English, so that no phone already
 * playing wakes up in another language (UL3).
 */
export const DEFAULT_UI_LANGUAGE: UiLanguage = 'en'

const local = (): Storage | undefined =>
  typeof localStorage === 'undefined' ? undefined : localStorage

/**
 * Read the stored code, defaulting to English. Total: a device that has never
 * chosen, a corrupt value, a language dropped from the build, and a storage
 * that throws in private mode all land on the same answer.
 */
export function readStoredUiLanguage(
  storage: Pick<Storage, 'getItem'> | undefined = local(),
): UiLanguage {
  try {
    const raw = storage?.getItem(UI_LANGUAGE_KEY)
    return isUiLanguage(raw) ? raw : DEFAULT_UI_LANGUAGE
  } catch {
    return DEFAULT_UI_LANGUAGE
  }
}

/**
 * Whether a choice has ever been made on this device. The first-run act asks
 * this rather than comparing against English, because "never chose" and "chose
 * English" are different states and only the first one earns a question.
 *
 * A storage that throws answers false: a device we cannot read is a device we
 * do not ambush, the same tie-break `decideOnboarding` takes.
 */
export function hasStoredUiLanguage(
  storage: Pick<Storage, 'getItem'> | undefined = local(),
): boolean {
  try {
    return isUiLanguage(storage?.getItem(UI_LANGUAGE_KEY))
  } catch {
    return false
  }
}

/**
 * THE ACTIVE UI LANGUAGE. Resolved once, at module load, and constant for the
 * life of the page — which is what lets `UI` in `./index` be a plain constant
 * rather than a context, a hook or a re-render.
 */
export const UI_LANGUAGE: UiLanguage = readStoredUiLanguage()

/**
 * Change the language and reload, which is the only way to change it. Writing
 * the key before reloading is the whole mechanism; `UI_LANGUAGE` is resolved
 * from it on the way back up.
 *
 * Nothing else is touched. Progress, the journey, the suitcase and every
 * setting are opinions about the game rather than about a language.
 */
export function setUiLanguage(code: UiLanguage): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(UI_LANGUAGE_KEY, code)
  } catch {
    // Private mode, or a full quota. Nothing useful to do: the picker simply
    // comes back showing the language that is still active.
    return
  }
  location.reload()
}

/**
 * The best guess for a device that has never chosen — used to ORDER and
 * PRESELECT the first-run list, never to apply a language silently (UL3).
 *
 * Matches on the primary subtag, so 'de-AT', 'de' and 'de-CH' all read as
 * German and 'zh-CN', 'zh-Hans' and 'zh-TW' all read as Chinese. Traditional
 * script is deliberately folded into the Simplified build rather than dropped
 * to English: a Traditional reader reads Simplified with far less effort than
 * they read English, and the list is right there if they disagree.
 *
 * Two notes on primary subtags at launch:

 * - **Norwegian.** A phone reports 'nb', 'nn' or the macrolanguage 'no'. The
 *   Bokmål catalogue is still compiled but NOT offered at the iOS 1.0 launch,
 *   and there is no alias: 'nb', 'no' and 'nn' all fall to English until
 *   Norwegian returns to the picker.
 * - **Portuguese.** 'pt-BR' and 'pt-PT' share the primary subtag, so both
 *   already match; the pack is European Portuguese (UL13) and a Brazilian
 *   reader lands on it. That is a real difference — *comboio* for the train
 *   they ride all game — and it is the picker's job to let them leave.
 */
export function detectDeviceLanguage(languages: readonly string[]): UiLanguage {
  for (const tag of languages) {
    const primary = String(tag).toLowerCase().split('-')[0]
    const match = UI_LANGUAGES.find((code) => code === primary)
    if (match) return match
  }
  return DEFAULT_UI_LANGUAGE
}

/** The device's own list, guarded for the environments that have none. */
export function deviceLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return []
  return navigator.languages ?? (navigator.language ? [navigator.language] : [])
}
