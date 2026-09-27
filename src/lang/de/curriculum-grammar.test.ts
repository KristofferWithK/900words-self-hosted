import { describe, expect, it } from 'vitest'
import { grammarCourseFromBrief } from '../curriculum-grammar'
import { buildGrammarBookshelf } from '../grammar-books'
import { GERMAN_GRAMMAR_REWRITE_BRIEF } from './curriculum-grammar-brief'
import { GERMAN_DESCRIPTOR_IDS } from './curriculum-descriptors'
import { GERMAN_ROUTE_CITY_IDS, GERMAN_ROUTE_CITY_NAMES } from './route-cities'
import { germanGrammarCourse, grammarGateHolds } from './curriculum-grammar'

/** The course as it will be the moment the owner's review accepts it. */
const accepted = grammarCourseFromBrief({ ...GERMAN_GRAMMAR_REWRITE_BRIEF, status: 'accepted' })
const shelf = buildGrammarBookshelf({
  course: accepted,
  cityNames: GERMAN_ROUTE_CITY_NAMES,
  languageCode: 'de',
  targetLabel: 'German',
  lessonMark: 'DE',
  cityMark: 'Ää',
})

describe('the German grammar course', () => {
  it('keeps the shipping path shut until the brief is accepted', () => {
    expect(GERMAN_GRAMMAR_REWRITE_BRIEF.status).toBe('review-ready')
    // The gate a shipping pack passes through still refuses this content. The
    // German pack reaches it only through the preview path, and a preview pack
    // cannot deal a board — see `LanguagePack.readiness`.
    expect(grammarGateHolds()).toBe(true)
    expect(() => grammarCourseFromBrief(GERMAN_GRAMMAR_REWRITE_BRIEF)).toThrow(/accepted/)
    // The preview path builds the same nine chapters the accepted one would.
    expect(germanGrammarCourse().chapters).toEqual(accepted.chapters)
    expect(germanGrammarCourse().lessons).toEqual(accepted.lessons)
  })

  it('owns nine destination chapters in route order with no chapter after the last city', () => {
    expect(accepted.chapters.map((chapter) => chapter.cityId)).toEqual(GERMAN_ROUTE_CITY_IDS)
    expect(accepted.chapters.map((chapter) => chapter.cityIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    expect(GERMAN_GRAMMAR_REWRITE_BRIEF.chapters).toHaveLength(GERMAN_ROUTE_CITY_IDS.length)
  })

  it('projects its twenty lessons into two Travel Guide pages each', () => {
    expect(shelf.cities.map((city) => city.lessons.map((lesson) => lesson.id))).toEqual([
      ['flensburg-articles', 'flensburg-du-sie'],
      ['luebeck-present-endings', 'luebeck-possessives'],
      ['hamburg-plurals', 'hamburg-accusative', 'hamburg-nicht-kein'],
      ['bremen-separable-verbs', 'bremen-time-first'],
      ['koeln-question-words', 'koeln-directions'],
      ['frankfurt-describing', 'frankfurt-joining-ideas'],
      ['nuernberg-perfect', 'nuernberg-haben-sein', 'nuernberg-dative-pronouns'],
      ['dresden-modals', 'dresden-plans-future'],
      ['berlin-verb-final', 'berlin-adjective-endings'],
    ])
    expect(shelf.cities.flatMap((city) => city.lessons)).toHaveLength(20)
    for (const city of shelf.cities) {
      for (const lesson of city.lessons) {
        expect(lesson.book.pages).toHaveLength(2)
        expect(lesson.book.pages.every((page) => page.context.length > 0)).toBe(true)
      }
    }
    expect(shelf.forCityIndex(9)).toEqual([])
  })

  it('keeps every rules page structured and every example translated', () => {
    for (const lesson of accepted.lessons) {
      expect(lesson.id.startsWith(GERMAN_ROUTE_CITY_IDS[lesson.cityIndex]!)).toBe(true)
      expect(lesson.rules.filter((block) => block.kind === 'heading').length).toBeGreaterThanOrEqual(3)
      expect(lesson.rules.some((block) => block.kind === 'table' || block.kind === 'quote')).toBe(true)
      expect(lesson.examples.length).toBeGreaterThanOrEqual(5)
      expect(lesson.examples.every(([german, english]) => Boolean(german && english))).toBe(true)
    }
    expect(new Set(accepted.lessons.map((lesson) => lesson.id)).size).toBe(accepted.lessons.length)
    expect(accepted.lessons.flatMap((lesson) => lesson.examples)).toHaveLength(120)
  })

  it('gives every chapter a resolvable descriptor, a boundary and a spoken performance', () => {
    for (const chapter of GERMAN_GRAMMAR_REWRITE_BRIEF.chapters) {
      expect(chapter.descriptorIds.length).toBeGreaterThan(0)
      for (const id of chapter.descriptorIds) expect(GERMAN_DESCRIPTOR_IDS.has(id)).toBe(true)
      expect(chapter.doNotClaimEn.length).toBeGreaterThanOrEqual(3)
      expect(chapter.rewriteEn.length).toBeGreaterThanOrEqual(3)
      expect(chapter.modelExamplesDa.length).toBeGreaterThanOrEqual(4)
    }
  })

  it('writes German, not Danish', () => {
    const german = accepted.lessons.flatMap((lesson) => [
      ...lesson.examples.map(([target]) => target),
      lesson.titleDa,
    ]).concat(GERMAN_GRAMMAR_REWRITE_BRIEF.chapters.flatMap((chapter) => [...chapter.modelExamplesDa, chapter.titleDa]))
    // The same test `seam.test.ts` runs on a second language's prompts: no
    // Danish letter may survive into a German string.
    expect(german.filter((line) => /[æøåÆØÅ]/.test(line))).toEqual([])
    expect(german.some((line) => /[äöüßÄÖÜ]/.test(line))).toBe(true)
    // Every German noun is capitalised, so a lower-case sentence-internal noun
    // is the error this course is most likely to make at volume.
    expect(german.join(' ')).toContain('Das ist ein Tisch.')
  })

  it('refuses the Danish claims that are false in German', () => {
    const claims = GERMAN_GRAMMAR_REWRITE_BRIEF.chapters.flatMap((chapter) => chapter.doNotClaimEn).join(' ')
    // The single most important divergence: Danish spirals a bounded/relevant-now
    // preterite-perfect contrast across four cities; German has no such contrast.
    expect(claims).toContain('Do not present a perfect/Präteritum choice as a difference in meaning')
    expect(claims).toContain('Do not present the German perfect as the English present perfect')
    expect(claims).toContain('Do not say the verb is always the second word')
    expect(claims).toContain('Do not teach du as the neutral default')
    expect(claims).toContain('Do not make attributive adjective endings a productive A1 target')
  })
})
