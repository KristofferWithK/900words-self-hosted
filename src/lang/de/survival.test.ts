import { describe, expect, it } from 'vitest'
import { validateSurvivalGuide } from '../survival'
import { germanSurvivalGuide } from './survival'
import { GERMAN_ROUTE_CITY_IDS } from './route-cities'
import { germanCurriculum } from './curriculum'

const exchanges = germanSurvivalGuide.cities.flatMap((city) => city.exchanges)

describe('German Survival Guide', () => {
  it('gives all nine route cities four exchanges in route order', () => {
    expect(germanSurvivalGuide.cities.map((city) => city.cityId)).toEqual(GERMAN_ROUTE_CITY_IDS)
    expect(germanSurvivalGuide.cities.map((city) => city.cityId))
      .toEqual(germanCurriculum.cities.map((city) => city.cityId))
    expect(exchanges).toHaveLength(36)
    // The register rule is on for German and off for Danish — see
    // `SurvivalExchange.register`.
    expect(validateSurvivalGuide(germanSurvivalGuide, GERMAN_ROUTE_CITY_IDS, { registers: ['du', 'Sie'] })).toEqual([])
  })

  it('declares an address form on every page, and uses both', () => {
    for (const exchange of exchanges) {
      expect(['du', 'Sie']).toContain(exchange.register)
    }
    const sie = exchanges.filter((exchange) => exchange.register === 'Sie')
    const du = exchanges.filter((exchange) => exchange.register === 'du')
    expect(sie.length).toBeGreaterThan(0)
    expect(du.length).toBeGreaterThan(0)
    expect(sie.length + du.length).toBe(36)
  })

  it('keeps the two registers out of each other’s sentences', () => {
    for (const exchange of exchanges) {
      const spoken = exchange.dialogue.map((line) => line.da).join(' ')
      const phrases = exchange.phrases.map((phrase) => phrase.da).join(' ')
      const text = `${spoken} ${phrases}`
      if (exchange.register === 'Sie') {
        // A du-form verb or pronoun in a Sie exchange is the error this course
        // is likeliest to ship at volume, so it is asserted rather than read.
        expect(text, exchange.targetActivityId).not.toMatch(/\b(du|dich|dein|deine|deinen)\b/)
      } else {
        expect(text, exchange.targetActivityId).not.toMatch(/\b(Sie|Ihnen|Ihre|Ihren|Ihr)\b/)
      }
    }
  })

  it('writes German, not Danish, and capitalises its nouns', () => {
    const lines = exchanges.flatMap((exchange) => [
      ...exchange.dialogue.map((line) => line.da),
      ...exchange.phrases.map((phrase) => phrase.da),
    ])
    expect(lines.filter((line) => /[æøåÆØÅ]/.test(line))).toEqual([])
    expect(lines.some((line) => /[äöüßÄÖÜ]/.test(line))).toBe(true)
    for (const exchange of exchanges) {
      for (const line of exchange.dialogue) {
        expect(line.da.length, exchange.targetActivityId).toBeGreaterThan(0)
        expect(line.en.length, exchange.targetActivityId).toBeGreaterThan(0)
      }
    }
  })

  it('names each page after the city it belongs to, with unique ids', () => {
    for (const city of germanSurvivalGuide.cities) {
      for (const exchange of city.exchanges) {
        expect(exchange.targetActivityId.startsWith(`${city.cityId}-situation-`)).toBe(true)
      }
    }
    const ids = exchanges.map((exchange) => exchange.targetActivityId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('applies each city’s own grammar chapter', () => {
    const textFor = (cityIndex: number) => germanSurvivalGuide.cities[cityIndex]!.exchanges
      .flatMap((exchange) => [...exchange.dialogue.map((line) => line.da), ...exchange.phrases.map((phrase) => phrase.da)])
      .join(' ')
    // Hamburg orders, so the accusative it teaches has to appear in an order.
    expect(textFor(2)).toMatch(/einen Kaffee/)
    // Bremen's separable verbs, with the particle at the end.
    expect(textFor(3)).toMatch(/stehe um sieben auf/)
    // Nürnberg's spoken perfect and its dative.
    expect(textFor(6)).toMatch(/habe .* verpasst|habe .* verloren/)
    expect(textFor(6)).toMatch(/Ihnen/)
    // Berlin's verb-final subordinate clauses.
    expect(textFor(8)).toMatch(/weil der Dienstag nicht passt/)
    expect(textFor(8)).toMatch(/wenn ich heute absage/)
  })
})
