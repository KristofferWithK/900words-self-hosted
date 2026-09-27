import { describe, expect, it } from 'vitest'
import type { UiLanguage } from '../../i18n/types'
import { germanGrammarBookForCity } from './curriculum-grammar'
import { germanGuideEnglishOnlyForCity, germanGuideSourceLines, GERMAN_FLENSBURG_EXCHANGE_IDS, GERMAN_FLENSBURG_GUIDE_SIDECARS, GERMAN_FLENSBURG_LESSON_IDS, localizeGermanFlensburgGrammarBook, localizeGermanFlensburgSurvivalCity } from './guide-sidecars'
import { germanSurvivalGuide } from './survival'

const ALL_UI_LANGUAGES: readonly UiLanguage[] = [
  'en', 'de', 'es', 'zh', 'fr', 'pt', 'pl', 'hu', 'sv', 'nb', 'nl',
]

describe('German Flensburg Guide sidecars', () => {
  it('covers all eleven catalogues', () => {
    expect(Object.keys(GERMAN_FLENSBURG_GUIDE_SIDECARS).sort()).toEqual([...ALL_UI_LANGUAGES].sort())
  })

  it.each(ALL_UI_LANGUAGES)('%s has exact coverage for the requested source lines', (language) => {
    const sidecar = GERMAN_FLENSBURG_GUIDE_SIDECARS[language]
    const source = germanGuideSourceLines()

    expect(Object.keys(sidecar.grammar).sort()).toEqual([...GERMAN_FLENSBURG_LESSON_IDS].sort())
    expect(Object.keys(sidecar.survival).sort()).toEqual([...GERMAN_FLENSBURG_EXCHANGE_IDS].sort())

    for (const id of GERMAN_FLENSBURG_LESSON_IDS) {
      expect(new Set(Object.keys(sidecar.grammar[id])), `${language} ${id}`).toEqual(new Set(source.grammar[id]))
      for (const line of source.grammar[id]) {
        expect(sidecar.grammar[id][line], `${language} ${id}: ${line}`).toBeTruthy()
      }
    }
    for (const id of GERMAN_FLENSBURG_EXCHANGE_IDS) {
      expect(new Set(Object.keys(sidecar.survival[id])), `${language} ${id}`).toEqual(new Set(source.survival[id]))
      for (const line of source.survival[id]) {
        expect(sidecar.survival[id][line], `${language} ${id}: ${line}`).toBeTruthy()
      }
    }
  })

  it.each(ALL_UI_LANGUAGES)('selects %s copy in the Grammar and Survival reader projections', (language) => {
    const sourceLesson = germanGrammarBookForCity('flensburg', 'flensburg-articles')!
    const sourceCity = germanSurvivalGuide.cities[0]!
    const sourceExchange = sourceCity.exchanges[0]!
    const sourceGermanExamples = sourceLesson.book.pages.find((page) => page.id === 'flensburg-articles-examples')!
    const sourceGermanExamplesBlocks = structuredClone(sourceGermanExamples.blocks)

    const grammar = localizeGermanFlensburgGrammarBook(sourceLesson.book, language)
    const examples = grammar.pages.find((page) => page.id === 'flensburg-articles-examples')!
    const expectedSupport = GERMAN_FLENSBURG_GUIDE_SIDECARS[language].grammar['flensburg-articles']['That is a table.']

    expect(examples.title).toBe(GERMAN_FLENSBURG_GUIDE_SIDECARS[language].grammar['flensburg-articles']['Examples in context'])
    expect(JSON.stringify(examples.blocks)).toContain(expectedSupport)
    expect(JSON.stringify(examples.blocks)).toContain('Das ist ein Tisch.')

    const survival = localizeGermanFlensburgSurvivalCity(sourceCity, language)
    const exchange = survival.exchanges[0]!
    expect(exchange.targetActivityId).toBe(sourceExchange.targetActivityId)
    expect(exchange.register).toBe(sourceExchange.register)
    expect(exchange.phrases.map((phrase) => phrase.da)).toEqual(sourceExchange.phrases.map((phrase) => phrase.da))
    expect(exchange.dialogue.map((line) => line.da)).toEqual(sourceExchange.dialogue.map((line) => line.da))
    expect(exchange.dialogue[0]!.en).toBe(GERMAN_FLENSBURG_GUIDE_SIDECARS[language].survival['flensburg-situation-1']['Hello! Welcome to Flensburg.'])

    // The adapter projects copies: the source grammar page and German source
    // exchange keep their original reader text and stable audio/activity key.
    expect(sourceGermanExamples.blocks).toEqual(sourceGermanExamplesBlocks)
    expect(sourceExchange.dialogue[0]!.en).toBe('Hello! Welcome to Flensburg.')
    expect(exchange.targetActivityId).toBe('flensburg-situation-1')
  })

  it('marks the later German-route cities as English-only for non-English UI readers', () => {
    for (const language of ALL_UI_LANGUAGES) {
      expect(germanGuideEnglishOnlyForCity(0, language)).toBe(false)
      expect(germanGuideEnglishOnlyForCity(1, language)).toBe(language !== 'en')
    }
    const laterCity = germanSurvivalGuide.cities[1]!
    expect(localizeGermanFlensburgSurvivalCity(laterCity, 'fr')).toBe(laterCity)
  })
})
