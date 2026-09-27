import { describe, expect, it } from 'vitest'
import {
  DEFAULT_UI_LANGUAGE,
  UI_LANGUAGE_KEY,
  detectDeviceLanguage,
  hasStoredUiLanguage,
  readStoredUiLanguage,
} from './active'

/**
 * The storage key, as total functions.
 *
 * Every one of these has to answer rather than throw, because they run at
 * MODULE LOAD, before anything can catch them: a throw here is a white screen
 * on a device in private mode, not a handled error. The precedent and the
 * reasoning are `src/lang/active.ts` and `save-survives.test.ts`.
 */

const reading = (value: string | null): Pick<Storage, 'getItem'> => ({ getItem: () => value })

const throwing: Pick<Storage, 'getItem'> = {
  getItem: () => {
    throw new DOMException('denied', 'SecurityError')
  },
}

describe('reading the stored UI language', () => {
  it('is English when nothing has ever been stored', () => {
    expect(readStoredUiLanguage(reading(null))).toBe('en')
    expect(DEFAULT_UI_LANGUAGE).toBe('en')
  })

  it('reads back a language that ships', () => {
    for (const code of ['en', 'de', 'sv', 'zh'] as const) {
      expect(readStoredUiLanguage(reading(code))).toBe(code)
    }
  })

  it('is English for a language that does not ship', () => {
    // A code from a newer build, then downgraded; or a hand-edited value.
    // This was 'fr' until French shipped — which is the case itself: a stored
    // code that meant nothing yesterday can mean something tomorrow, and the
    // device that stored it gets the language rather than a broken screen.
    expect(readStoredUiLanguage(reading('it'))).toBe('en')
    expect(readStoredUiLanguage(reading('zh-Hans'))).toBe('en')
    expect(readStoredUiLanguage(reading(''))).toBe('en')
    expect(readStoredUiLanguage(reading('{"state":{}}'))).toBe('en')
    // Launch scope: 'es' stays compiled but is NOT offered, so a stored 'es'
    // is rejected by isUiLanguage and falls back to English.
    expect(readStoredUiLanguage(reading('es'))).toBe('en')
  })

  it('is English when the storage itself throws', () => {
    expect(readStoredUiLanguage(throwing)).toBe('en')
  })

  it('is English when there is no storage at all', () => {
    expect(readStoredUiLanguage(undefined)).toBe('en')
  })
})

describe('whether a choice has been made', () => {
  it('tells "never chose" apart from "chose English"', () => {
    // The distinction the first-run act runs on: only the first earns a screen.
    expect(hasStoredUiLanguage(reading(null))).toBe(false)
    expect(hasStoredUiLanguage(reading('en'))).toBe(true)
  })

  it('counts an unusable value as no choice', () => {
    expect(hasStoredUiLanguage(reading('it'))).toBe(false)
  })

  it('counts a language that stays compiled but is NOT offered as no choice', () => {
    // Launch scope: the 'nb' catalogue is still compiled, but isUiLanguage
    // rejects the code, so a stored 'nb' is treated as "never chose": the
    // device falls back to English and the first-run question is asked again.
    expect(hasStoredUiLanguage(reading('nb'))).toBe(false)
    expect(readStoredUiLanguage(reading('nb'))).toBe('en')
  })

  it('is false when the storage throws — a device we cannot read is not ambushed', () => {
    expect(hasStoredUiLanguage(throwing)).toBe(false)
  })
})

describe('guessing from the device', () => {
  it('takes the first language the app actually speaks', () => {
    expect(detectDeviceLanguage(['de-AT', 'en-GB'])).toBe('de')
    // Skips past a language with no catalogue rather than stopping there.
    // Launch scope: 'es' is compiled but not offered, so an Italian/Spanish
    // phone falls through to English.
    expect(detectDeviceLanguage(['it-IT', 'es-MX', 'en'])).toBe('en')
  })

  it('reads a region and a script as the language under them', () => {
    expect(detectDeviceLanguage(['de-CH'])).toBe('de')
    expect(detectDeviceLanguage(['zh-CN'])).toBe('zh')
    expect(detectDeviceLanguage(['zh-Hans-CN'])).toBe('zh')
    // Traditional folds into the Simplified build rather than dropping to
    // English: a Traditional reader reads Simplified far more easily than
    // English, and the list is on screen if they disagree.
    expect(detectDeviceLanguage(['zh-TW'])).toBe('zh')
    expect(detectDeviceLanguage(['fr-CA'])).toBe('fr')
    // Launch scope: Dutch is compiled but not offered, so it falls to English.
    expect(detectDeviceLanguage(['nl-BE'])).toBe('en')
  })

  it('lands a Portuguese phone on the European pack, whichever Portuguese it is', () => {
    // pt-BR and pt-PT share the primary subtag, so both match. The pack is
    // European (UL13) and a Brazilian reader gets it; the picker is how they
    // leave, which is the honest trade rather than a silent wrong guess.
    expect(detectDeviceLanguage(['pt-PT'])).toBe('pt')
    expect(detectDeviceLanguage(['pt-BR'])).toBe('pt')
  })

  it('falls a Norwegian phone to English while Bokmål is unoffered at launch', () => {
    // A phone reports 'nb', 'nn' or the macrolanguage 'no'. The catalogue is
    // still compiled, but the code is not offered in the picker and there is
    // no alias, so every Norwegian code falls to English at launch.
    expect(detectDeviceLanguage(['nb-NO'])).toBe('en')
    expect(detectDeviceLanguage(['no'])).toBe('en')
    expect(detectDeviceLanguage(['nn-NO'])).toBe('en')
  })

  it('is case-insensitive, because navigator.language is not guaranteed', () => {
    expect(detectDeviceLanguage(['DE-DE'])).toBe('de')
  })

  it('is English when the device speaks nothing this app does', () => {
    expect(detectDeviceLanguage(['ja', 'it'])).toBe('en')
    expect(detectDeviceLanguage([])).toBe('en')
  })
})

describe('the key', () => {
  it('is its own key, not a field in the settings store', () => {
    // Phase 3 reads this before any store has hydrated; see the file comment.
    expect(UI_LANGUAGE_KEY).toBe('cluecab-ui-language')
  })

  it('is not the learner language key', () => {
    // Two different questions. Confusing them would have a German speaker
    // learning German.
    expect(UI_LANGUAGE_KEY).not.toBe('cluecab-language')
  })
})
