import { describe, expect, it } from 'vitest'
import { danishGrammarCourse } from './curriculum-grammar'
import { grammarBookForCity, grammarBooksForCityIndex, danishGrammarBooks } from './grammar-books'

async function sha256(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

describe('Danish grammar book cards', () => {
  it('projects nine destination cities into 18 deliberate two-page lessons', () => {
    expect(danishGrammarBooks.map((chapter) => chapter.cityId)).toEqual([
      'sonderborg', 'ribe', 'kolding', 'aarhus', 'aalborg', 'skagen', 'odense', 'roskilde', 'kobenhavn',
    ])
    expect(danishGrammarBooks.flatMap((chapter) => chapter.lessons)).toHaveLength(18)
    expect(danishGrammarBooks.every((chapter) => chapter.lessons.every((lesson) => lesson.book.pages.length === 2))).toBe(true)
    expect(danishGrammarBooks.every((chapter) => chapter.lessons.every((lesson) => lesson.book.pages.every((page) => page.context.length > 0)))).toBe(true)
    expect(danishGrammarBooks.map((city) => city.lessons.map((lesson) => lesson.id))).toEqual([
      ['sonderborg-articles'],
      ['ribe-present-clauses', 'ribe-possessives'],
      ['kolding-plurals', 'kolding-simple-negation'],
      ['aarhus-time-v2', 'aarhus-practical-recent-past'],
      ['aalborg-question-words', 'aalborg-direction-forms'],
      ['skagen-adjective-agreement', 'skagen-joining-ideas'],
      ['odense-past-events', 'odense-perfect-auxiliary'],
      ['roskilde-modals', 'roskilde-future-plans', 'roskilde-own-possessives'],
      ['kobenhavn-linkers', 'kobenhavn-ikke-placement'],
    ])
    expect(grammarBooksForCityIndex(9)).toEqual([])
  })

  it('keeps each beginner rules page structured and each continuation page translated', () => {
    for (const lesson of danishGrammarCourse.lessons) {
      expect(lesson.rules.filter((block) => block.kind === 'heading').length).toBeGreaterThanOrEqual(3)
      expect(lesson.rules.some((block) => block.kind === 'table' || block.kind === 'quote')).toBe(true)
      expect(lesson.examples.length).toBeGreaterThanOrEqual(5)
      expect(lesson.examples.every(([danish, english]) => Boolean(danish && english))).toBe(true)
    }
    expect(danishGrammarCourse.lessons.flatMap((lesson) => lesson.examples)).toHaveLength(106)
  })

  it('pins the reviewed lesson titles, order, and 106 bilingual examples', async () => {
    const target = danishGrammarBooks.flatMap((city) => city.lessons.map((lesson) => {
      const runtime = danishGrammarCourse.lessons.find((item) => item.id === lesson.id)!
      return [city.cityName, lesson.titleEn, runtime.examples]
    }))
    const fingerprint = await sha256(target)
    expect(fingerprint).toBe('6a1edaca551bdc8bb2c911bc37c0abb4470d040a406aafceef134bf81f1bdc54')
  })

  it('keeps the owner-reviewed beginner explanations visible in the app reader', () => {
    const sonderborg = grammarBookForCity('sonderborg')!
    const sonderborgCopy = JSON.stringify(sonderborg.book.pages[0]!.blocks)
    expect(sonderborg.titleEn).toBe('En, et, and “the”')
    expect(sonderborgCopy).toContain('common gender')
    expect(sonderborgCopy).toContain('neuter gender')
    expect(sonderborgCopy).toContain('en stol')
    expect(sonderborgCopy).toContain('et hus')

    const ribePossessives = grammarBookForCity('ribe', 'ribe-possessives')!
    expect(JSON.stringify(ribePossessives.book.pages[0]!.blocks)).toContain('hans / hendes / deres')
    expect(ribePossessives.book.pages[1]!.blocks).toContainEqual(expect.objectContaining({
      rows: expect.arrayContaining([['Billetterne er deres.', 'The tickets are theirs.']]),
    }))

    const koldingPlurals = grammarBookForCity('kolding', 'kolding-plurals')!
    expect(JSON.stringify(koldingPlurals.book.pages[0]!.blocks)).toContain('kopperne')
    expect(JSON.stringify(koldingPlurals.book.pages[0]!.blocks)).toContain('husene')
    expect(JSON.stringify(koldingPlurals.book.pages[0]!.blocks)).toContain('årene')
  })
})
