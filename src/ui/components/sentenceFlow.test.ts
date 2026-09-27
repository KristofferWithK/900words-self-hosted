import { describe, expect, it } from 'vitest'
import { danishCurriculum } from '../../lang/da/curriculum'
import { WORDS } from '../../data/words'
import { flowWordsAtCity, markSentence, supportTermsByCity } from './sentenceFlow'

const ITEMS = danishCurriculum.supportItems
const MOR = { da: 'mor', pos: 'noun' } as const
const ANNA = '“Hej, jeg hedder Anna,” siger min mor.'

describe('flowWordsAtCity', () => {
  it('marks only what the course has introduced by the city', () => {
    // «hej» and «jeg» are Sønderborg's; «min» is first taught in Ribe.
    const terms = (city: number) => flowWordsAtCity(ANNA, city, ITEMS).map((f) => f.term)
    expect(terms(0)).toContain('hej')
    expect(terms(0)).toContain('jeg')
    expect(terms(0)).not.toContain('min')
    expect(terms(1)).toContain('min')
  })

  it('keeps sentence order and names each term once', () => {
    const terms = flowWordsAtCity('Jeg er her, og jeg er ikke der.', 8, ITEMS).map((f) => f.term)
    expect(terms.indexOf('jeg')).toBeLessThan(terms.indexOf('er'))
    expect(terms.filter((t) => t === 'jeg')).toHaveLength(1)
    expect(terms).toContain('ikke')
  })

  it('leaves a later leg’s conjunction plain for an earlier city', () => {
    const sentence = 'Jeg bliver hjemme, fordi det regner.'
    expect(flowWordsAtCity(sentence, 2, ITEMS).map((f) => f.term)).not.toContain('fordi')
    expect(flowWordsAtCity(sentence, 8, ITEMS).map((f) => f.term)).toContain('fordi')
  })

  it('carries the support item’s label as the nearest thing to a gloss', () => {
    const hej = flowWordsAtCity(ANNA, 0, ITEMS).find((f) => f.term === 'hej')
    expect(hej?.label).toMatch(/greeting/i)
    expect(hej?.firstCity).toBe(0)
  })

  it('reads the earliest city a term is taught in', () => {
    // «ikke» appears in several items; the map keeps the first city.
    const byCity = supportTermsByCity(ITEMS, 8)
    const ikke = byCity.get('ikke')
    expect(ikke).toBeDefined()
    expect(ikke!.firstCity).toBe(Math.min(...ITEMS.filter((i) => i.ledgerTerms.includes('ikke')).map((i) => i.firstCity)))
  })
})

describe('markSentence', () => {
  const joined = (sentence: string, segs: ReturnType<typeof markSentence>) => {
    expect(segs.map((s) => s.text).join('')).toBe(sentence)
  }

  it('marks the green word and the flow words, and loses no character', () => {
    const segs = markSentence(ANNA, MOR, ['hej', 'jeg', 'min'])
    joined(ANNA, segs)
    expect(segs.filter((s) => s.kind === 'green').map((s) => s.text)).toEqual(['mor'])
    expect(segs.filter((s) => s.kind === 'flow').map((s) => s.text)).toEqual(['Hej', 'jeg', 'min'])
  })

  it('does not mark «godmorgen» green for «mor» — the strict pass wins', () => {
    const sentence = 'Godmorgen, mor!'
    const segs = markSentence(sentence, MOR, [])
    joined(sentence, segs)
    expect(segs.filter((s) => s.kind === 'green').map((s) => s.text)).toEqual(['mor'])
  })

  it('reaches an irregular plural and a definite form', () => {
    expect(markSentence('To mænd står her.', { da: 'mand', pos: 'noun' }, []).filter((s) => s.kind === 'green').map((s) => s.text)).toEqual(['mænd'])
    expect(markSentence('Katten sover.', { da: 'kat', pos: 'noun' }, []).filter((s) => s.kind === 'green').map((s) => s.text)).toEqual(['Katten'])
  })

  it('every word in the dataset marks at least one token of its own example', () => {
    const unmarked = WORDS.filter((w) => !markSentence(w.exampleDa, w, []).some((s) => s.kind === 'green'))
    expect(unmarked.map((w) => `${w.da}: ${w.exampleDa}`)).toEqual([])
  })
})
