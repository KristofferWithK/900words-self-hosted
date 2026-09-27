import { describe, expect, it } from 'vitest'
import type { AiClueView, AiGuessView } from '../ai/projections'
import type { PlayerLanguage } from '../ai/playerLanguage'
import { buildCluePrompt, buildGuessPrompt, buildTranslatePrompt } from '../ai/prompts'
import { createDataset } from '../data/dataset'
import type { WordEntry } from '../data/types'
import { checkClueLegality } from '../engine/legality'
import { matchesAnswer } from '../engine/packing'
import type { BoardWord } from '../engine/types'
import { danish } from './da'
import { german } from './de'
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  availableLanguages,
  hasLanguageChoice,
  isLanguageCode,
  packFor,
  playableLanguages,
} from './index'
import { LANGUAGE_KEY, readStoredLanguage } from './active'
import type { LanguagePack } from './types'

/**
 * The seam's own suite.
 *
 * Its job is to fail if the seam is decorative — if the engine still behaves
 * like Danish when handed something that is not Danish. Every "the pack drives
 * this" claim below is written as a DIFFERENCE against a fake pack, because a
 * test that only ever passes the real one cannot tell a parameter from a
 * constant. That is the same trap the two vacuous suites in this repo's history
 * fell into.
 */

/**
 * A deliberately un-Danish language: ç is its distinctive letter, it folds to
 * "cx", it stems by chopping "-zz", its compounds link with "-q-", and its
 * article is "yo". Nothing about it is realistic; everything about it is
 * different, which is the point.
 */
const FAKE: LanguagePack = {
  code: 'de',
  name: 'Fake',
  endonym: 'Fake',
  readiness: 'playable',
  words: [
    {
      id: 'de:blorp',
      da: 'blorp',
      en: ['widget'],
      pos: 'noun',
      gender: 'thing',
      article: 'yo',
      exampleDa: 'yo blorp',
      exampleEn: 'a widget',
      freqRank: 1,
      curriculumRank: 1,
    },
    {
      id: 'de:frimm',
      da: 'frimm',
      en: ['gadget'],
      pos: 'noun',
      gender: 'thing',
      exampleDa: 'yo frimm',
      exampleEn: 'a gadget',
      freqRank: 2,
      curriculumRank: 2,
    },
  ] satisfies WordEntry[],
  speech: { tag: 'zz-ZZ', rate: 1, slowRate: 0.5 },
  orthography: {
    distinctive: /ç/,
    fold: (s) => s.replace(/ç/g, 'cx'),
    unfold: (s) => s.replace(/cx/g, 'ç'),
    foldsAreSpellings: false,
  },
  morphology: {
    // Umlaut-folding plus a suffix strip — the shape German actually needs and
    // Danish does not have, so a Danish stemmer left behind anywhere shows up
    // as a difference rather than as nothing.
    stem: (w) => {
      const base = w.replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u')
      for (const suf of ['er', 'zz']) {
        if (base.endsWith(suf) && base.length - suf.length >= 3) {
          return base.slice(0, base.length - suf.length)
        }
      }
      return base
    },
    inflections: ['zz'],
    linkers: ['', 'q'],
    legality: {
      compoundParts: new Set(['blorp']),
      shortInflections: new Set(['zz']),
      isDerivedForm: () => false,
      irregularPairs: [['blorp', 'blorpen']],
    },
  },
  grammar: {
    genders: { thing: { article: 'yo', short: '(th)', full: 'thing gender' } },
    isUncountable: (h) => h === 'frimm',
    answerFiller: ['yo'],
  },
  route: { ...danish.route, country: "Fakeland" },
  rosters: {},
  curriculum: danish.curriculum,
  grammarCourse: danish.grammarCourse,
  copy: {
    welcome: 'FAKE-WELCOME',
    journeyOver: 'FAKE-JOURNEY-OVER',
    answerPlaceholder: 'FAKE-PLACEHOLDER',
    tips: ['FAKE-TIP'],
  },
  prompts: {
    translateRules: 'FAKE-TRANSLATE-RULES',
    spellingRule: 'FAKE-SPELLING-RULE',
    functionWordNote: 'FAKE-FUNCTION-WORDS',
    clueExampleWord: 'FAKE-CLUE-WORD',
    compoundExample: 'FAKE-COMPOUND-EXAMPLE',
  },
}

/**
 * The other axis. Everything a prompt says about the language the player
 * SPEAKS comes from here, and the same swap test applies to it: give Casey a
 * made-up player language and nothing English may survive in the prompt.
 */
const FAKE_PLAYER: PlayerLanguage = {
  code: 'de',
  name: 'Fakish',
  homographNote: 'FAKE-HOMOGRAPHS',
  reasoningLength: 'FAKE-REASONING-LENGTH',
  rationaleExample: 'FAKE-RATIONALE-EXAMPLE',
  clueExampleRationale: 'FAKE-CLUE-RATIONALE',
  reasoningExample: 'FAKE-REASONING-EXAMPLE',
  guessExample: 'FAKE-GUESS-EXAMPLE',
  translateExamples: 'FAKE-TRANSLATE-EXAMPLES',
  joinNames: (names) => names.join('+'),
  oneIdea: (names) => `FAKE-ONE-IDEA ${names}`,
  alsoCameToMind: (base, name) => `${base} FAKE-ALSO ${name}`,
  onlyIdea: (base) => `${base} FAKE-ONLY`,
  makesMeThinkOf: (clue, name, first) => `FAKE-THINK ${clue} ${name} ${first}`,
  firstClue: (clue, names) => `FAKE-FIRST ${clue} ${names}`,
  messages: {
    noClue: 'FAKE-NO-CLUE',
    noGuess: 'FAKE-NO-GUESS',
    noWordsLeft: 'FAKE-NO-WORDS',
    badTranslation: 'FAKE-BAD-TRANSLATION',
    badPing: 'FAKE-BAD-PING',
  },
}

describe('the language registry', () => {
  it('offers Danish and German as playable courses, with Danish as the default', () => {
    expect(Object.keys(LANGUAGES)).toEqual(['da', 'de'])
    expect(DEFAULT_LANGUAGE).toBe('da')
    expect(playableLanguages()).toEqual([danish, german])
    expect(danish.readiness).toBe('playable')
    expect(playableLanguages('normal')).toEqual([danish, german])
    expect(german.readiness).toBe('playable')
  })

  it('gives German its City 1 roster, route, map and Travel Guide', () => {
    expect(german.words).toHaveLength(100)
    expect(german.rosters[0]).toHaveLength(100)
    expect(german.route.cities).toHaveLength(9)
    expect(german.route.country).toBe('Germany')
    expect(german.route.map.path.length).toBeGreaterThan(1000)
    expect(german.grammarCourse.chapters).toHaveLength(9)
    expect(german.grammarCourse.lessons).toHaveLength(20)
    // The route the chapters were authored against and the route the pack
    // ships are two files, and they must not drift.
    expect(german.grammarCourse.chapters.map((c) => c.cityId))
      .toEqual(german.route.cities.map((c) => c.id))
  })

  it('resolves both playable packs in normal and open-source builds', () => {
    expect(packFor('de', 'normal')).toBe(german)
    expect(packFor('da', 'normal')).toBe(danish)
    expect(packFor('de', 'feedback')).toBe(german)
    expect(packFor('de', 'developer')).toBe(german)
    expect(packFor('de', 'open-source')).toBe(german)
    expect(packFor('da', 'feedback')).toBe(danish)
  })

  it('reads a stored language, and survives every way it can be absent', () => {
    const store = (v: string | null) => ({ getItem: () => v })
    expect(readStoredLanguage(store('da'))).toBe('da')
    expect(readStoredLanguage(store('de'), 'normal')).toBe('de')
    expect(readStoredLanguage(store('de'), 'feedback')).toBe('de')
    expect(readStoredLanguage(store('de'), 'developer')).toBe('de')
    expect(readStoredLanguage(store('de'), 'open-source')).toBe('de')
    expect(readStoredLanguage(store(null))).toBe('da')
    expect(readStoredLanguage(store('klingon'))).toBe('da')
    expect(readStoredLanguage(undefined)).toBe('da')
    expect(
      readStoredLanguage({
        getItem: () => {
          throw new Error('private mode')
        },
      }),
    ).toBe('da')
  })

  it('keeps the language key out of the store keys it must not collide with', () => {
    expect(LANGUAGE_KEY).toBe('cluecab-language')
    for (const taken of [
      'cluecab-settings-v1',
      'cluecab-game-v1',
      'cluecab-journey-v2',
      'cluecab-srs-v1',
      'cluecab-feedback-v1',
    ]) {
      expect(LANGUAGE_KEY).not.toBe(taken)
    }
  })

  it('recognises exactly the codes the seam knows', () => {
    expect(isLanguageCode('da')).toBe(true)
    expect(isLanguageCode('de')).toBe(true)
    expect(isLanguageCode('en')).toBe(false)
    expect(isLanguageCode(null)).toBe(false)
    expect(isLanguageCode(7)).toBe(false)
  })
})

/**
 * The claim the whole store design rests on: word ids carry their language, so
 * anything keyed by word id is already partitioned and must NOT be namespaced
 * again. If this ever fails, `srsStore.stats` and `journeyStore.wrapped` are
 * no longer safe to share and the namespacing note in `index.ts` is wrong.
 */
describe('word ids are namespaced by language', () => {
  it('prefixes every shipped word with its own code', () => {
    expect(danish.words.length).toBe(900)
    const wrong = danish.words.filter((w) => !w.id.startsWith(`${danish.code}:`))
    expect(wrong.map((w) => w.id)).toEqual([])
  })

  it('cannot collide with another language, even on an identical headword', () => {
    // "Hus" is a word in both languages. The ids are not.
    expect(`da:hus`).not.toBe(`de:hus`)
    const daIds = new Set(danish.words.map((w) => w.id))
    for (const w of FAKE.words) expect(daIds.has(w.id)).toBe(false)
  })

  it('reads the audio directory out of the same prefix', () => {
    // Pinned in speak.test.ts too; repeated here because it is the second
    // thing the prefix is load-bearing for.
    expect(danish.words[0]!.id.split(':')[0]).toBe(danish.code)
  })
})

describe('the engine reads its rules off the pack', () => {
  const board: BoardWord[] = [
    { wordId: 'w1', da: 'hus', en: ['house'], pos: 'noun' },
    { wordId: 'w2', da: 'haus', en: ['house'], pos: 'noun' },
  ]

  it('applies the pack stemmer, not a Danish one', () => {
    // "huset" is an inflection of "hus" under Danish's -et rule and nothing at
    // all under the fake's. Same clue, same board, different verdict: the rule
    // is genuinely a parameter.
    expect(checkClueLegality('huset', board, danish).legal).toBe(false)
    expect(checkClueLegality('huset', board, FAKE).legal).toBe(true)
    // And the other way round, so neither result is an accident of the board.
    // "häuser" is the umlaut plural of "haus": the fake folds the vowel and
    // catches it, Danish has no such rule and lets it through. Note that
    // neither string contains the other, which is deliberate — the containment
    // guard is language-neutral and would otherwise decide this before the
    // stemmer ever ran, and an earlier draft of this test proved only that.
    expect(checkClueLegality('häuser', board, FAKE).legal).toBe(false)
    expect(checkClueLegality('häuser', board, danish).legal).toBe(true)
  })

  it('applies the pack folding, not æ/ø/å', () => {
    const oe: BoardWord[] = [{ wordId: 'w1', da: 'øl', en: ['beer'], pos: 'noun' }]
    // Danish folds ø to oe, so "oellet" is caught. The fake folds nothing of
    // the sort and lets it through.
    expect(checkClueLegality('oellet', oe, danish).legal).toBe(false)
    expect(checkClueLegality('oellet', oe, FAKE).legal).toBe(true)
  })

  it('applies the pack irregular pairs', () => {
    const mand: BoardWord[] = [{ wordId: 'w1', da: 'mand', en: ['man'], pos: 'noun' }]
    expect(checkClueLegality('mænd', mand, danish).legal).toBe(false)
    expect(checkClueLegality('mænd', mand, FAKE).legal).toBe(true)
  })

  it('applies the pack derived-form rule, which the fake does not have', () => {
    const verb: BoardWord[] = [{ wordId: 'w1', da: 'køre', en: ['drive'], pos: 'verb' }]
    // Danish's past-tense rule catches "kørte"; the fake declines every
    // derived form, and the stem and containment guards do not reach this one.
    expect(checkClueLegality('kørte', verb, danish).legal).toBe(false)
    expect(checkClueLegality('kørte', verb, FAKE).legal).toBe(true)
  })
})

describe('the packing grader reads its rules off the pack', () => {
  it('strips the pack article, not "en/et/at"', () => {
    expect(matchesAnswer('et hus', 'hus', danish)).toBe(true)
    // The fake has no "et", so the filler survives and the answer is wrong.
    expect(matchesAnswer('et hus', 'hus', FAKE)).toBe(false)
    expect(matchesAnswer('yo blorp', 'blorp', FAKE)).toBe(true)
    expect(matchesAnswer('yo blorp', 'blorp', danish)).toBe(false)
  })

  it('unfolds by the pack rule, not ae/oe/aa', () => {
    expect(matchesAnswer('oel', 'øl', danish)).toBe(true)
    expect(matchesAnswer('oel', 'øl', FAKE)).toBe(false)
  })
})

describe('the dataset indexes read their rules off the pack', () => {
  const fake = createDataset(FAKE)
  const da = createDataset(danish)

  it('classifies by the pack distinctive letters', () => {
    expect(da.classifyClue('kæledyr')).toBe('target')
    // No æ in the fake's alphabet, and "kæledyr" is not one of its two words.
    expect(fake.classifyClue('kæledyr')).toBe('unknown')
    expect(fake.classifyClue('çoo')).toBe('target')
    expect(da.classifyClue('çoo')).toBe('unknown')
  })

  it('classifies compounds by the pack linkers', () => {
    // Danish links with -e-: dyre+liv. The fake links with -q-.
    expect(da.classifyClue('morgenmad')).toBe('target')
    expect(fake.classifyClue('blorpqfrimm')).toBe('target')
    expect(fake.classifyClue('blorpzfrimm')).toBe('unknown')
  })

  it('indexes only its own words', () => {
    expect(fake.wordById('de:blorp')?.da).toBe('blorp')
    expect(fake.wordById('da:mor')).toBeUndefined()
    expect(da.wordById('da:mor')?.da).toBe('mor')
    expect(da.wordById('de:blorp')).toBeUndefined()
  })
})

describe("the prompts carry the pack's language, not Danish", () => {
  // Built as literals rather than off a real game: these views are pure data,
  // and the point here is only what the prompt does with a pack.
  const words = [
    { id: 'w1', da: 'hus', en: ['house'], pos: 'noun', reveal: { kind: 'hidden' } as const },
    { id: 'w2', da: 'kat', en: ['cat'], pos: 'noun', reveal: { kind: 'hidden' } as const },
  ]
  const clueView: AiClueView = {
    kind: 'ai-clue',
    clueLanguage: 'target',
    turnsLeft: 4,
    words: words.map((w) => ({ ...w, roleOnMyKey: 'green' as const })),
    history: [],
    flagged: [],
  }
  const guessView: AiGuessView = {
    kind: 'ai-guess',
    clueLanguage: 'target',
    turnsLeft: 4,
    words,
    currentClue: { text: 'dyr', number: 1 },
    history: [],
    flagged: [],
  }
  const clueText = (pack: LanguagePack) => JSON.stringify(buildCluePrompt(clueView, pack))

  it('names the pack in the rules and asks for a clue in it', () => {
    expect(clueText(danish)).toContain('learn Danish')
    expect(clueText(FAKE)).toContain('learn Fake')
    expect(clueText(FAKE)).not.toContain('learn Danish')
  })

  it('quotes the pack spelling rule, function words and worked example', () => {
    const fake = clueText(FAKE)
    expect(fake).toContain('FAKE-SPELLING-RULE')
    expect(fake).toContain('FAKE-FUNCTION-WORDS')
    expect(fake).toContain('FAKE-CLUE-WORD')
    // And Danish's own are gone from it, which is the half that would still
    // pass if the strings were merely appended rather than substituted.
    expect(fake).not.toContain('æ, ø and å')
    expect(fake).not.toContain('kæledyr')
    // No Danish letter anywhere in a prompt for another language.
    expect(fake).not.toMatch(/[æøå]/)
  })

  it('does the same for the guess prompt', () => {
    // Both axes swapped: the board, the rules and the clue-reading warning
    // come from the learner pack, the worked replies from the player pack, and
    // between them nothing Danish may survive.
    const fake = JSON.stringify(buildGuessPrompt(guessView, FAKE, undefined, FAKE_PLAYER))
    expect(fake).toContain('one Fake word')
    expect(fake).not.toContain('one Danish word')
    // Catches a Danish example anywhere in the prompt, including inside a rule
    // rather than in the examples block — which is where the last one was.
    expect(fake).not.toContain('æble')
    expect(fake).not.toMatch(/[æøå]/)
  })

  it('says nothing about a language in the translate prompt but the pack one', () => {
    const fake = JSON.stringify(buildTranslatePrompt('haus', FAKE, FAKE_PLAYER))
    expect(fake).toContain('FAKE-TRANSLATE-RULES')
    expect(fake).toContain('learning Fake')
    expect(fake).not.toContain('Danish')
    expect(fake).not.toContain('English')
  })

  /**
   * The player-language axis, swapped the same way. Everything Casey is told
   * to WRITE comes from the player pack, so a prompt built for a player who
   * does not speak English must name English nowhere — the bug the owner
   * reported on 2026-09-12 was exactly this string left behind.
   */
  it('takes player-facing copy from the player pack while keeping course-language clues', () => {
    const fake = JSON.stringify(buildGuessPrompt(guessView, danish, undefined, FAKE_PLAYER))
    expect(fake).toContain('FAKE-HOMOGRAPHS')
    expect(fake).toContain('FAKE-GUESS-EXAMPLE')
    expect(fake).toContain('FAKE-REASONING-EXAMPLE')
    expect(fake).toContain('FAKE-REASONING-LENGTH')
    expect(fake).toContain('IN FAKISH')
    expect(fake).toContain('dictionary lookup may start from an English word')
    expect(fake).not.toContain('is a cheek')
  })

  it('asks for the clue rationale in the player language, with its own example', () => {
    const fake = JSON.stringify(buildCluePrompt(clueView, danish, FAKE_PLAYER))
    expect(fake).toContain('IN FAKISH')
    expect(fake).toContain('FAKE-RATIONALE-EXAMPLE')
    expect(fake).toContain('FAKE-CLUE-RATIONALE')
    // The clue itself is still Danish: this axis changes what Casey writes,
    // never what she clues in.
    expect(fake).toContain('single-word clue in Danish')
    expect(fake).toContain('kæledyr')
    expect(fake).toContain('English glosses on cards do not make a clue illegal')
    expect(fake).not.toMatch(/reject[^.]{0,80}English gloss/i)
  })
})

describe('the Danish pack is complete', () => {
  it('names a gender spec for every gender the dataset uses', () => {
    const used = new Set(danish.words.filter((w) => w.gender).map((w) => w.gender!))
    expect(used.size).toBeGreaterThan(0)
    for (const g of used) expect(danish.grammar.genders[g]).toBeDefined()
  })

  it('agrees with the dataset about which nouns cannot be counted', () => {
    // The same fact the validator checks from the outside, checked here through
    // the pack, so the seam cannot drift from the data it describes.
    for (const w of danish.words) {
      if (w.pos !== 'noun') continue
      expect(w.countable === false, w.da).toBe(danish.grammar.isUncountable(w.da))
    }
  })

  it('has a route the dataset can fill', () => {
    expect(danish.route.cities.length).toBe(9)
    expect(danish.route.country).toBe('Denmark')
    expect(danish.route.map.path.length).toBeGreaterThan(1000)
  })

  it('fills every string a screen or a prompt reads', () => {
    // A pack with an empty string here does not crash, it renders a blank
    // label or drops a rule out of a prompt — which is the failure mode worth
    // catching at the seam rather than on a screenshot.
    const strings = [
      danish.name,
      danish.endonym,
      danish.speech.tag,
      danish.copy.welcome,
      danish.copy.journeyOver,
      danish.copy.answerPlaceholder,
      ...Object.values(danish.prompts),
    ]
    for (const s of strings) expect(s.trim().length).toBeGreaterThan(0)
    expect(danish.copy.tips.length).toBeGreaterThan(0)
    for (const t of danish.copy.tips) expect(t.trim().length).toBeGreaterThan(0)
  })

  it('speaks at a rate somebody chose, and a slower one below it', () => {
    expect(danish.speech.rate).toBeGreaterThan(0)
    expect(danish.speech.rate).toBeLessThanOrEqual(1)
    // The whole point of the 🐢: a slowRate at or above the ordinary rate is a
    // button that changes nothing.
    expect(danish.speech.slowRate).toBeGreaterThan(0)
    expect(danish.speech.slowRate).toBeLessThan(danish.speech.rate)
  })
})

describe('the Settings picker', () => {
  it('offers German in every normal release audience while keeping Danish the default', () => {
    expect(hasLanguageChoice('normal')).toBe(true)
    expect(availableLanguages('normal')).toEqual([danish, german])
    expect(availableLanguages('open-source')).toEqual([danish, german])
    expect(availableLanguages('feedback')).toEqual([danish, german])
    expect(availableLanguages('developer')).toEqual([danish, german])
    expect(DEFAULT_LANGUAGE).toBe('da')
  })

  it('restores a stored German selection in normal builds', () => {
    const store = { getItem: () => 'de' }
    const restored = readStoredLanguage(store, 'normal')
    expect(restored).toBe('de')
    expect(packFor(restored, 'normal')).toBe(german)
    expect(availableLanguages('normal').map((pack) => pack.code)).toEqual(['da', 'de'])
  })
})
