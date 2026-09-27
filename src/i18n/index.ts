import { UI_LANGUAGE } from './active'
import { de } from './de'
import { en, type Catalogue } from './en'
import { es } from './es'
import { fr } from './fr'
import { hu } from './hu'
import { nb } from './nb'
import { nl } from './nl'
import { pl } from './pl'
import { pt } from './pt'
import { sv } from './sv'
import { zh } from './zh'
import { UI_LANGUAGES, type UiLanguage, type UiLanguageInfo } from './types'

export type { Catalogue } from './en'
export type { UiLanguage, UiLanguageInfo } from './types'
export { UI_LANGUAGES, isUiLanguage } from './types'
export {
  UI_LANGUAGE,
  UI_LANGUAGE_KEY,
  DEFAULT_UI_LANGUAGE,
  setUiLanguage,
  readStoredUiLanguage,
  hasStoredUiLanguage,
  detectDeviceLanguage,
  deviceLanguages,
} from './active'

/** Every catalogue, so a test — or the first-run act — can read one that is not active. */
export const CATALOGUES: Record<UiLanguage, Catalogue> = {
  en,
  de,
  es,
  zh,
  fr,
  pt,
  nl,
  pl,
  sv,
  nb,
  hu,
}

/**
 * THE ACTIVE CATALOGUE. A constant, resolved at module load from a key read at
 * module load, which is why a screen reads `UI.settings.title` directly and
 * needs no provider, no hook and no re-render. Under vitest there is no
 * localStorage, so this is English and a test that wants another language
 * imports `CATALOGUES.de`.
 */
export const UI: Catalogue = CATALOGUES[UI_LANGUAGE]

export const UI_LANGUAGE_INFO: Record<UiLanguage, UiLanguageInfo> = {
  en: {
    code: 'en', endonym: 'English', tag: 'en', glossArticles: /^(to|a|an|the) /,
    sentenceLayout: {
      // Measured in the browser at the tight 360×640 phone with this language's
      // own gloss text (e2e/measure-sentence-layout.mjs, 2026-09-15).
      charsPerLine: { da: 27, daLong: 31, en: 40, enLong: 44 },
      linePx: { da: 23.2, daLong: 20.6, en: 18.2, enLong: 16.4 },
    },
  },
  de: {
    code: 'de', endonym: 'Deutsch', tag: 'de', glossArticles: /^(der|die|das|ein|eine|zu) /,
    sentenceLayout: {
      // Measured in the browser at the tight 360×640 phone with this language's
      // own gloss text (e2e/measure-sentence-layout.mjs, 2026-09-15).
      charsPerLine: { da: 27, daLong: 31, en: 38, enLong: 36 },
      linePx: { da: 23.2, daLong: 20.6, en: 18.2, enLong: 16.4 },
    },
  },
  es: {
    code: 'es', endonym: 'Español', tag: 'es', glossArticles: /^(el|la|los|las|un|una) /,
    // Not a Phase 3 launch language: its glosses stay English, so its
    // sentenceLayout carries the English measured numbers.
    sentenceLayout: {
      charsPerLine: { da: 27, daLong: 31, en: 40, enLong: 44 },
      linePx: { da: 23.2, daLong: 20.6, en: 18.2, enLong: 16.4 },
    },
  },
  // Simplified: 'zh' alone leaves the script to the device and can render
  // Traditional glyphs. Chinese has no article to strip.
  zh: {
    code: 'zh', endonym: '中文（简体）', tag: 'zh-Hans', glossArticles: null,
    sentenceLayout: {
      // Measured in the browser at the tight 360×640 phone with this language's
      // own gloss text (e2e/measure-sentence-layout.mjs, 2026-09-15).
      charsPerLine: { da: 27, daLong: 31, en: 17, enLong: 26 },
      linePx: { da: 23.2, daLong: 20.6, en: 18.2, enLong: 16.4 },
    },
  },
  // French elides before a vowel and writes it closed up, so l' carries no
  // space and cannot be listed with the others.
  fr: {
    code: 'fr', endonym: 'Français', tag: 'fr', glossArticles: /^((le|la|les|un|une|des) |l')/,
    sentenceLayout: {
      // Measured in the browser at the tight 360×640 phone with this language's
      // own gloss text (e2e/measure-sentence-layout.mjs, 2026-09-15).
      charsPerLine: { da: 27, daLong: 31, en: 36, enLong: 46 },
      linePx: { da: 23.2, daLong: 20.6, en: 18.2, enLong: 16.4 },
    },
  },
  pt: {
    code: 'pt', endonym: 'Português', tag: 'pt-PT', glossArticles: /^(o|a|os|as|um|uma) /,
    sentenceLayout: {
      // Measured in the browser at the tight 360×640 phone with this language's
      // own gloss text (e2e/measure-sentence-layout.mjs, 2026-09-15).
      charsPerLine: { da: 27, daLong: 31, en: 37, enLong: 39 },
      linePx: { da: 23.2, daLong: 20.6, en: 18.2, enLong: 16.4 },
    },
  },
  nl: {
    code: 'nl', endonym: 'Nederlands', tag: 'nl', glossArticles: /^(de|het|een|te) /,
    // Not a Phase 3 launch language: its glosses stay English, so its
    // sentenceLayout carries the English measured numbers.
    sentenceLayout: {
      charsPerLine: { da: 27, daLong: 31, en: 40, enLong: 44 },
      linePx: { da: 23.2, daLong: 20.6, en: 18.2, enLong: 16.4 },
    },
  },
  // Polish has no articles at all. A rule invented for it would eat real
  // words, the same reason Chinese has none.
  pl: {
    code: 'pl', endonym: 'Polski', tag: 'pl', glossArticles: null,
    sentenceLayout: {
      // Measured in the browser at the tight 360×640 phone with this language's
      // own gloss text (e2e/measure-sentence-layout.mjs, 2026-09-15).
      charsPerLine: { da: 27, daLong: 31, en: 27, enLong: 38 },
      linePx: { da: 23.2, daLong: 20.6, en: 18.2, enLong: 16.4 },
    },
  },
  // "att" and "å" are the infinitive markers, the counterpart of English "to".
  sv: {
    code: 'sv', endonym: 'Svenska', tag: 'sv', glossArticles: /^(en|ett|att) /,
    sentenceLayout: {
      // Measured in the browser at the tight 360×640 phone with this language's
      // own gloss text (e2e/measure-sentence-layout.mjs, 2026-09-15).
      charsPerLine: { da: 27, daLong: 31, en: 38, enLong: 46 },
      linePx: { da: 23.2, daLong: 20.6, en: 18.2, enLong: 16.4 },
    },
  },
  // Bokmål, the written standard most Norwegians use. 'nb' rather than 'no':
  // 'no' is the macrolanguage and leaves Nynorsk ambiguous.
  nb: {
    code: 'nb', endonym: 'Norsk bokmål', tag: 'nb-NO', glossArticles: /^(en|ei|et|å) /,
    // Not a Phase 3 launch language: its glosses stay English, so its
    // sentenceLayout carries the English measured numbers.
    sentenceLayout: {
      charsPerLine: { da: 27, daLong: 31, en: 40, enLong: 44 },
      linePx: { da: 23.2, daLong: 20.6, en: 18.2, enLong: 16.4 },
    },
  },
  hu: {
    code: 'hu', endonym: 'Magyar', tag: 'hu', glossArticles: /^(a|az|egy) /,
    // Not a Phase 3 launch language: its glosses stay English, so its
    // sentenceLayout carries the English measured numbers.
    sentenceLayout: {
      charsPerLine: { da: 27, daLong: 31, en: 40, enLong: 44 },
      linePx: { da: 23.2, daLong: 20.6, en: 18.2, enLong: 16.4 },
    },
  },
}

/** The languages, in the order a picker lists them, with what a picker shows. */
export const uiLanguageChoices = (): readonly UiLanguageInfo[] =>
  UI_LANGUAGES.map((code) => UI_LANGUAGE_INFO[code])
