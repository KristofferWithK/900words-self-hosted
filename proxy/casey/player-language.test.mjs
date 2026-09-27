import { describe, expect, it } from 'vitest'
import { CATALOGUES } from '../../src/i18n/index.ts'
import {
  DEFAULT_PLAYER_LANGUAGE,
  PLAYER_LANGUAGES,
  isPlayerLanguage,
  playerLanguageFor,
} from './player-language.js'

/**
 * The pack ships from here and `src/ai/playerLanguage.ts` re-exports it, so
 * there is no second copy to hold it against. What is worth pinning is what a
 * reader cannot check by eye across eleven languages: that every language the
 * app offers has a pack, that every fragment composes into a sentence rather
 * than throwing or returning a fragment, and that no language quietly kept the
 * English worked examples it was copied from.
 */
const FIELDS = [
  'code',
  'name',
  'homographNote',
  'reasoningLength',
  'rationaleExample',
  'clueExampleRationale',
  'reasoningExample',
  'guessExample',
  'translateExamples',
]

const MESSAGES = ['noClue', 'noGuess', 'noWordsLeft', 'badTranslation', 'badPing']

/** Every sentence the pack can produce, with arguments that reach both branches. */
const rendered = (pack) => ({
  joinOne: pack.joinNames(['hund']),
  joinThree: pack.joinNames(['hund', 'kat', 'hest']),
  oneIdea: pack.oneIdea(pack.joinNames(['hund', 'kat'])),
  alsoCameToMind: pack.alsoCameToMind(pack.oneIdea(pack.joinNames(['hund', 'kat'])), 'hest'),
  onlyIdea: pack.onlyIdea(pack.oneIdea(pack.joinNames(['hund']))),
  thinkFirst: pack.makesMeThinkOf('dyr', 'hund', true),
  thinkAgain: pack.makesMeThinkOf('dyr', 'hund', false),
})

const translated = Object.keys(CATALOGUES).filter((code) => code !== 'en')

describe('the player language pack', () => {
  it('covers every compiled UI catalogue, and nothing else', () => {
    // The picker is trimmed to seven at the iOS 1.0 launch, but a client built
    // before the trim can still send one of the four unlisted codes, so the
    // pack must answer all of CATALOGUES, not just the picker's list.
    expect(Object.keys(PLAYER_LANGUAGES).sort()).toEqual(Object.keys(CATALOGUES).sort())
  })

  it('answers with English for a code no pack knows, as it must for a client built before Phase 4', () => {
    expect(isPlayerLanguage('klingon')).toBe(false)
    expect(playerLanguageFor('klingon')).toBe(DEFAULT_PLAYER_LANGUAGE)
    expect(DEFAULT_PLAYER_LANGUAGE.code).toBe('en')
  })

  it.each(Object.keys(CATALOGUES))('gives %s every field, non-empty, with its own code', (code) => {
    const pack = PLAYER_LANGUAGES[code]
    expect(pack.code).toBe(code)
    for (const field of FIELDS) {
      expect(typeof pack[field], `${code}.${field}`).toBe('string')
      expect(pack[field].trim(), `${code}.${field} is empty`).not.toBe('')
    }
    for (const message of MESSAGES) {
      expect(pack.messages[message].trim(), `${code}.messages.${message}`).not.toBe('')
    }
  })

  it.each(Object.keys(CATALOGUES))('composes every %s fragment into a whole sentence', (code) => {
    const out = rendered(PLAYER_LANGUAGES[code])
    for (const [name, sentence] of Object.entries(out)) {
      expect(typeof sentence, `${code}.${name}`).toBe('string')
      expect(sentence.trim(), `${code}.${name} is empty`).not.toBe('')
      // Every name reaches the sentence, however this language quotes it.
      if (name.startsWith('join') || name === 'oneIdea') expect(sentence).toContain('hund')
    }
    expect(out.joinThree).toContain('hest')
    expect(out.alsoCameToMind).toContain('hest')
    expect(out.thinkFirst).not.toBe(out.thinkAgain)
  })

  it('completes the sentence the guess prompt starts, so the homograph note ends in a stop', () => {
    // prompts.js appends " Say in your top pick's reasoning which reading you
    // took." straight after it.
    for (const code of Object.keys(CATALOGUES)) {
      expect(PLAYER_LANGUAGES[code].homographNote.trim(), code).toMatch(/[.。]$/)
    }
  })

  it.each(translated)('leaves no English worked example behind in the %s pack', (code) => {
    const pack = PLAYER_LANGUAGES[code]
    // homographNote is exempt: it names the player's own language in English
    // on purpose, because it is an instruction to the model, not player copy.
    for (const field of ['reasoningExample', 'guessExample', 'translateExamples']) {
      expect(pack[field], `${code}.${field}`).not.toMatch(
        /\b(?:apple|pear|tree|sweet|bicycle|traffic|afternoon)\b/,
      )
    }
    for (const message of MESSAGES) {
      expect(pack.messages[message], `${code}.messages.${message}`).not.toMatch(
        /\b(?:could not|the app|expected form|no words left)\b/,
      )
    }
    for (const [name, sentence] of Object.entries(rendered(pack))) {
      expect(sentence, `${code}.${name}`).not.toMatch(/\b(?:as one idea|came to mind|makes me think)\b/)
    }
  })

  it('keeps each language distinguishable, so no pack was copied and left unedited', () => {
    const seen = new Map()
    for (const code of Object.keys(CATALOGUES)) {
      const fingerprint = JSON.stringify([
        PLAYER_LANGUAGES[code].reasoningExample,
        rendered(PLAYER_LANGUAGES[code]).oneIdea,
      ])
      expect(seen.get(fingerprint), `${code} is identical to ${seen.get(fingerprint)}`).toBeUndefined()
      seen.set(fingerprint, code)
    }
  })
})
