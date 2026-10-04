import { describe, expect, it } from 'vitest'
import { CATALOGUES, UI_LANGUAGE_INFO, uiLanguageChoices } from './index'
import { SAME_IN_EVERY_LANGUAGE } from './same-in-every-language'
import { en, type Catalogue } from './en'
import { UI_LANGUAGES, type UiLanguage } from './types'

/**
 * GATE 1 (the type) and GATE 3 (the words).
 *
 * Gate 1 is the type system: every catalogue is declared with the type of the
 * English one, so a missing key, an extra key or a changed arity does not
 * compile. It is pinned here as a test as well, because a gate that lives only
 * in a habit is one refactor away from being gone — the `@ts-expect-error`
 * lines below FAIL THE BUILD if the constraint is ever loosened, since an
 * expectation of an error that does not happen is itself an error.
 *
 * Gate 3 is what the type cannot see: a key that compiles because it holds the
 * English string. That is the ordinary way a translation goes missing — a file
 * is copied, most of it is translated, and four lines are left behind.
 */

// ── gate 1 ────────────────────────────────────────────────────────────────

// @ts-expect-error a catalogue section missing a key does not compile. If this
// line ever stops erroring, gate 1 is gone and this file fails the build.
const missingKey: Catalogue['settings'] = { uiLanguageLabel: 'x' }
void missingKey

const extraKey: Catalogue['settings'] = {
  uiLanguageLabel: 'x',
  uiLanguageHelp: 'y',
  // @ts-expect-error a key English does not have does not compile either.
  uiLanguageWhatever: 'z',
}
void extraKey

// ── gate 3 ────────────────────────────────────────────────────────────────

type Walkable = Record<string, unknown>

interface Entry {
  path: string
  english: unknown
  translated: unknown
}

/** Every leaf of a catalogue, paired with its English counterpart. */
function entries(english: Walkable, translated: Walkable, prefix = ''): Entry[] {
  const out: Entry[] = []
  for (const key of Object.keys(english)) {
    const path = prefix ? `${prefix}.${key}` : key
    const e = english[key]
    const t = (translated ?? {})[key]
    if (e && typeof e === 'object' && !Array.isArray(e) && typeof e !== 'function') {
      out.push(...entries(e as Walkable, (t ?? {}) as Walkable, path))
    } else {
      out.push({ path, english: e, translated: t })
    }
  }
  return out
}

/**
 * Exercise function entries with representative values because plural rules
 * can differ on counts while the frame is identical, and a frame can differ
 * while the plural rule is not reached.
 */
function callBothWays(fn: (...args: never[]) => unknown, path = ''): string[] {
  const arity = fn.length
  if (path === 'game.wheelAnswerAria') {
    const wheelAnswerAria = fn as unknown as (language: string, glosses: string[]) => unknown
    const render = (value: unknown) =>
      typeof value === 'string' ? value : JSON.stringify(value) ?? String(value)
    return [
      wheelAnswerAria('Danish', ['house', 'water']),
      wheelAnswerAria('German', ['house', 'water']),
      wheelAnswerAria('Danish', ['week', 'book']),
    ].map(render)
  }
  const asNumber = Array.from({ length: arity }, () => 1) as never[]
  const asWord = Array.from({ length: arity }, () => 'x') as never[]
  const asTwo = Array.from({ length: arity }, () => 2) as never[]
  const render = (value: unknown) =>
    typeof value === 'string' ? value : JSON.stringify(value) ?? String(value)
  return [fn(...asNumber), fn(...asWord), fn(...asTwo)].map(render)
}

// Launch scope: the picker lists UI_LANGUAGES, but es, nl, nb and hu stay
// compiled — the translation gate must keep checking ALL of them, so it walks
// the CATALOGUES record rather than the trimmed picker list.
const translations = (Object.keys(CATALOGUES) as Array<Exclude<UiLanguage, 'en'> | 'en'>).filter(
  (code) => code !== 'en',
)

describe.each(translations)('gate 3: %s is actually translated', (code) => {
  const rows = entries(en as unknown as Walkable, CATALOGUES[code] as unknown as Walkable)

  it('has at least as many entries as English', () => {
    expect(rows.length).toBe(entries(en as unknown as Walkable, en as unknown as Walkable).length)
  })

  it('has no empty or whitespace-only string', () => {
    const empty = rows
      .filter((r) => typeof r.translated === 'string' && r.translated.trim() === '')
      .map((r) => r.path)
    expect(empty, 'an empty string is a missing translation wearing a valid type').toEqual([])
  })

  it('has no string left in English', () => {
    const untranslated = rows
      .filter(
        (r) =>
          typeof r.english === 'string' &&
          typeof r.translated === 'string' &&
          r.translated === r.english &&
          !SAME_IN_EVERY_LANGUAGE.has(r.path),
      )
      .map((r) => `${r.path}: ${JSON.stringify(r.english)}`)
    expect(
      untranslated,
      `these ${code} values are still the English. Translate them, or — if the ${code} word ` +
        `genuinely IS the English word — add the PATH to same-in-every-language.ts with a reason`,
    ).toEqual([])
  })

  it('has no function that dropped or gained a parameter', () => {
    const wrongArity = rows
      .filter(
        (r) =>
          typeof r.english === 'function' &&
          typeof r.translated === 'function' &&
          (r.english as (...a: never[]) => unknown).length !==
            (r.translated as (...a: never[]) => unknown).length,
      )
      .map((r) => r.path)
    expect(wrongArity).toEqual([])
  })

  it('has no function that throws, or that returns the English sentence', () => {
    const broken: string[] = []
    for (const row of rows) {
      if (typeof row.english !== 'function' || typeof row.translated !== 'function') continue
      if (SAME_IN_EVERY_LANGUAGE.has(row.path)) continue
      let englishResults: string[]
      let translatedResults: string[]
      try {
        englishResults = callBothWays(row.english as (...a: never[]) => unknown, row.path)
      } catch (e) {
        broken.push(`${row.path}: the ENGLISH threw (${String(e)})`)
        continue
      }
      try {
        translatedResults = callBothWays(row.translated as (...a: never[]) => unknown, row.path)
      } catch (e) {
        broken.push(`${row.path}: threw (${String(e)})`)
        continue
      }
      if (translatedResults.every((r, i) => r === englishResults[i])) {
        broken.push(`${row.path}: returns the English (${JSON.stringify(translatedResults[0])})`)
      }
    }
    expect(broken).toEqual([])
  })
})

describe('course-aware onboarding copy', () => {
  it('localizes the first-run tutorial for Danish and German in every UI catalogue', () => {
    for (const [code, catalogue] of Object.entries(CATALOGUES)) {
      const danish = catalogue.onboarding.courseText('da')
      const german = catalogue.onboarding.courseText('de')
      expect(german.languageName, code).not.toBe(danish.languageName)
      expect(german.countryName, code).not.toBe(danish.countryName)
      // The welcome is about every language (owner, 2026-09-27), so both
      // courses open on the same line rather than naming theirs.
      expect(german.welcome, code).toBe(danish.welcome)
      // Casey's lines before the walk name the city, whichever course.
      expect(catalogue.onboarding.introExplore('Flensburg'), code).toContain('Flensburg')
      expect(german.clueField, code).not.toBe(danish.clueField)
      expect(german.dictionary, code).not.toBe(danish.dictionary)
      expect(german.practiceIntro('Zeit', 3), code).toContain('Zeit')
      expect(german.lastGreen, code).not.toBe(danish.lastGreen)
      expect(german.yourTurn, code).not.toBe(danish.yourTurn)
    }
  })

  it('labels every remaining wheel answer in the active course language across catalogues', () => {
    for (const [code, catalogue] of Object.entries(CATALOGUES)) {
      for (const course of ['da', 'de']) {
        const language = catalogue.onboarding.courseText(course).languageName
        const placeholder = catalogue.game.wheelAnswerPlaceholder(language)
        const prompt = catalogue.game.wheelAnswerAria(language, ['house', 'water', 'week'])

        expect(placeholder, `${code}/${course} placeholder`).toContain(language)
        expect(prompt, `${code}/${course} prompt`).toContain(language)
        expect(prompt, `${code}/${course} first gloss`).toContain('house')
        expect(prompt, `${code}/${course} second gloss`).toContain('water')
        expect(prompt, `${code}/${course} third gloss`).toContain('week')
      }
    }
  })
})

describe('tutorial-visible copy punctuation', () => {
  const onboardingFields = [
    'ticketAria',
    'introTwoGames',
    'introExplore',
    'introGo',
    'walkEndFound',
    'walkEndNotFound',
    'tourLoose',
    'tourLid',
    'tourTray',
    'introGameTourKey',
    'introGameTourClueField',
    'introGameTourDictionary',
    'introGameTourStepper',
    'translationTourBoard',
    'translationTourInput',
    'translationTourWheel',
    'wheelReadyTour',
    'resultTourRewardNew',
    'resultTourRewardHeld',
    'resultTourWinTier',
    'resultTourLossTier',
    'resultTourCityPercent',
    'resultTourNoBestYet',
    'resultTourSentence',
    'resultTourNoReview',
    'homeTourSightseeing',
    'homeTourCafe',
    'homeTourStamp',
    'homeTourCollection',
    'rule1After',
    'rule2After',
    'rule3After',
    'rule4Middle',
    'practiceWon',
    'practiceRationaleRecovery',
    'guessMissMine',
    'guessMiss',
    'yourFirstClue',
    'yourClue',
    'findingAClue',
  ] as const
  const gameFields = [
    'phaseLastChance',
    'phaseTranslateWheel',
    'announceCaseyGuess',
    'practiceNote',
    'wrapCaseyKeyHint',
    'stopKeepWhatWeHave',
    'firstGuessHint',
    'wrapPlayerKeyHint',
    'wheelLede',
    'wheelRetryLine',
    'guidancePackingBody',
    'outcomeGivenUpSub',
    'reviewNothingThisRound',
  ] as const

  function renderCopy(value: unknown): string[] {
    if (typeof value === 'string') return [value]
    if (typeof value !== 'function') return []
    const args = Array.from({ length: value.length }, (_, index) =>
      index === 0 ? 'sample' : index === 1 ? 2 : 3,
    )
    try {
      return renderCopy(value(...args))
    } catch (error) {
      throw new Error(`Could not render scoped tutorial copy: ${String(error)}`)
    }
  }

  it('keeps reached onboarding and shared game prose free of dash separators in all catalogues', () => {
    const allSeparators: string[] = []
    for (const [code, catalogue] of Object.entries(CATALOGUES)) {
      const onboarding = catalogue.onboarding as unknown as Record<string, unknown>
      const game = catalogue.game as unknown as Record<string, unknown>
      const reached = [
        ...onboardingFields.flatMap((key) => renderCopy(onboarding[key]).map((text) => `${key}: ${text}`)),
        ...(['da', 'de'] as const).flatMap((course) => {
          const copy = catalogue.onboarding.courseText(course)
          return ['lastGreen', 'yourTurn'].flatMap((key) =>
            renderCopy(copy[key as keyof typeof copy]).map((text) => `courseText.${key}: ${text}`),
          )
        }),
        ...gameFields.flatMap((key) => renderCopy(game[key]).map((text) => `game.${key}: ${text}`)),
      ]
      const separators = reached.filter((entry) => /--|[—–]{2,}|(?<!\d)[—–](?!\d)/u.test(entry))
      allSeparators.push(...separators.map((entry) => `${code}: ${entry}`))
    }
    expect(allSeparators).toEqual([])
  })

  // The same rule for every line the app can say, in every catalogue (owner,
  // 2026-09-26: no em dashes anywhere in the app). An en dash between two
  // digits is a range, "13–15", and stays allowed.
  it('keeps every catalogue string, in every language, free of dash separators', () => {
    const found: string[] = []
    for (const [code, catalogue] of Object.entries(CATALOGUES)) {
      for (const row of entries(en as unknown as Walkable, catalogue as unknown as Walkable)) {
        const value = row.translated
        const texts =
          typeof value === 'string'
            ? [value]
            : Array.isArray(value)
              ? value.filter((item): item is string => typeof item === 'string')
              : typeof value === 'function'
                ? callBothWays(value as (...args: never[]) => unknown, row.path)
                : []
        for (const text of texts) {
          if (/--|[—–]{2,}|(?<!\d)[—–](?!\d)/u.test(text)) found.push(`${code}.${row.path}: ${text}`)
        }
      }
    }
    expect(found).toEqual([])
  })
})

describe('the languages themselves', () => {
  it('offers every picker language and no others in the picker', () => {
    expect([...UI_LANGUAGES].sort()).toEqual(
      Object.keys(UI_LANGUAGE_INFO).filter((c) => UI_LANGUAGES.includes(c as UiLanguage)).sort(),
    )
  })

  it('gives every language a distinct endonym and tag', () => {
    const choices = uiLanguageChoices()
    expect(new Set(choices.map((c) => c.endonym)).size).toBe(choices.length)
    expect(new Set(choices.map((c) => c.tag)).size).toBe(choices.length)
  })

  it('names each language in its own words, so a lost player can find it', () => {
    // The picker shows ONLY the endonym. A player who landed in a language
    // they cannot read finds their own by recognising the word, so not one of
    // these may be the English name of the language.
    expect(UI_LANGUAGE_INFO.de.endonym).toBe('Deutsch')
    expect(UI_LANGUAGE_INFO.es.endonym).toBe('Español')
    expect(UI_LANGUAGE_INFO.zh.endonym).toBe('中文（简体）')
    expect(UI_LANGUAGE_INFO.fr.endonym).toBe('Français')
    expect(UI_LANGUAGE_INFO.pt.endonym).toBe('Português')
    expect(UI_LANGUAGE_INFO.nl.endonym).toBe('Nederlands')
    expect(UI_LANGUAGE_INFO.pl.endonym).toBe('Polski')
    expect(UI_LANGUAGE_INFO.sv.endonym).toBe('Svenska')
    expect(UI_LANGUAGE_INFO.nb.endonym).toBe('Norsk bokmål')
    expect(UI_LANGUAGE_INFO.hu.endonym).toBe('Magyar')
  })

  it('pins the script and the variety where the bare code would not', () => {
    // 'zh' alone leaves the script to the device and can render Traditional.
    expect(UI_LANGUAGE_INFO.zh.tag).toBe('zh-Hans')
    // Bokmål, not the 'no' macrolanguage, which leaves Nynorsk ambiguous.
    expect(UI_LANGUAGE_INFO.nb.tag).toBe('nb-NO')
    // European Portuguese (UL13): the train is a comboio, not a trem.
    expect(UI_LANGUAGE_INFO.pt.tag).toBe('pt-PT')
  })

  it('lists English first, so the default needs no lookup', () => {
    expect(UI_LANGUAGES[0]).toBe('en')
  })

  it('strips the articles each language actually has', () => {
    expect('to run'.replace(UI_LANGUAGE_INFO.en.glossArticles!, '')).toBe('run')
    expect('die Mutter'.replace(UI_LANGUAGE_INFO.de.glossArticles!, '')).toBe('Mutter')
    expect('la madre'.replace(UI_LANGUAGE_INFO.es.glossArticles!, '')).toBe('madre')
    expect('la mère'.replace(UI_LANGUAGE_INFO.fr.glossArticles!, '')).toBe('mère')
    // French elides and writes it closed up, so l' cannot be listed with the
    // space-separated articles.
    expect("l'eau".replace(UI_LANGUAGE_INFO.fr.glossArticles!, '')).toBe('eau')
    expect('a mãe'.replace(UI_LANGUAGE_INFO.pt.glossArticles!, '')).toBe('mãe')
    expect('de moeder'.replace(UI_LANGUAGE_INFO.nl.glossArticles!, '')).toBe('moeder')
    expect('te fietsen'.replace(UI_LANGUAGE_INFO.nl.glossArticles!, '')).toBe('fietsen')
    // The infinitive markers, which are what English "to" is.
    expect('att springa'.replace(UI_LANGUAGE_INFO.sv.glossArticles!, '')).toBe('springa')
    expect('å sykle'.replace(UI_LANGUAGE_INFO.nb.glossArticles!, '')).toBe('sykle')
    expect('az anya'.replace(UI_LANGUAGE_INFO.hu.glossArticles!, '')).toBe('anya')
    // Chinese and Polish have none, and a rule invented for either would
    // corrupt real words: Polish "to" is a word, not an article.
    expect(UI_LANGUAGE_INFO.zh.glossArticles).toBeNull()
    expect(UI_LANGUAGE_INFO.pl.glossArticles).toBeNull()
  })

  it('leaves a word alone when it does not start with an article', () => {
    // The rule is anchored, so a noun that merely begins with those letters
    // keeps its head: Swedish "ett" must not eat "ettermiddag", and German
    // "die" must not eat "dienen".
    for (const code of UI_LANGUAGES) {
      const rule = UI_LANGUAGE_INFO[code].glossArticles
      if (!rule) continue
      for (const word of ['dienen', 'ettermiddag', 'lastbil', 'anya', 'ambos']) {
        expect(word.replace(rule, ''), `${code} ate ${word}`).toBe(word)
      }
    }
  })
})
