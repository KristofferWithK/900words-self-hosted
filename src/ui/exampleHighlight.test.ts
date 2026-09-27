import { describe, expect, it } from 'vitest'
import { WORDS } from '../data/words'
import { markDanish, markEnglish, type Segment } from './exampleHighlight'

const hits = (segments: Segment[]) => segments.filter((s) => s.hit).map((s) => s.text)
const joined = (segments: Segment[]) => segments.map((s) => s.text).join('')

describe('marking the headword in its Danish sentence', () => {
  it('finds the word as it stands', () => {
    expect(hits(markDanish('“Velkommen! Der er et hus her.”', 'hus'))).toEqual(['hus'])
  })

  it('finds an inflected form by stem', () => {
    expect(hits(markDanish('Huset er stort.', 'hus'))).toEqual(['Huset'])
    expect(hits(markDanish('I dag arbejder jeg hjemme.', 'arbejde'))).toEqual(['arbejder'])
    expect(hits(markDanish('Min far bruger goddag, når han møder en fremmed.', 'far'))).toEqual(['far'])
  })

  it('does not mark a word that merely starts the same way', () => {
    // «hus» must not light «husk» through a loose prefix rule beyond the
    // stemmer's own reach, and «se» must not light «sent».
    expect(hits(markDanish('Jeg kan ikke se det, det er sent.', 'se'))).toEqual(['se'])
  })

  it('loses nothing of the sentence', () => {
    const sentence = '“Hej, jeg hedder Anna,” siger min mor.'
    expect(joined(markDanish(sentence, 'mor'))).toBe(sentence)
  })

  it('uses the last word of a multi-word headword', () => {
    expect(hits(markDanish('Vi står op klokken syv.', 'stå op'))).toEqual(['op'])
  })
})

describe('marking the gloss in the English sentence', () => {
  it('finds the gloss and its beginner inflections', () => {
    expect(hits(markEnglish('“Welcome! There is a house here.”', ['house'], 'hus'))).toEqual(['house'])
    expect(hits(markEnglish('Today I am working from home.', ['work', 'job'], 'arbejde'))).toEqual(['working'])
    expect(hits(markEnglish('She carries the bags.', ['carry'], 'bære'))).toEqual(['carries'])
    expect(hits(markEnglish('We stopped at the station.', ['stop'], 'stoppe'))).toEqual(['stopped'])
  })

  it('finds the Danish word when the English quotes it', () => {
    expect(hits(markEnglish('“What does købe mean?” asks the child.', ['buy'], 'købe'))).toEqual(['købe'])
  })

  it('matches a phrase gloss as a phrase, dropping a leading "to"', () => {
    expect(hits(markEnglish('I get up at seven.', ['to get up'], 'stå op'))).toEqual(['get up'])
  })

  it('marks nothing rather than something wrong', () => {
    expect(hits(markEnglish('The weather is fine today.', ['house'], 'hus'))).toEqual([])
  })

  it('loses nothing of the sentence', () => {
    const sentence = '“Welcome! There is a house here.”'
    expect(joined(markEnglish(sentence, ['house'], 'hus'))).toBe(sentence)
  })
})

/**
 * Over the whole dataset: every sentence survives intact, and a clear majority
 * of them get a mark in each language. The number is printed rather than
 * pinned tightly — a sentence with no findable form is allowed, since a
 * missing mark is the design — but a drop below the floor means a rule broke.
 */
describe('across the nine hundred', () => {
  it('keeps every sentence whole and marks most of them', () => {
    let da = 0
    let en = 0
    for (const w of WORDS) {
      const d = markDanish(w.exampleDa, w.da)
      const e = markEnglish(w.exampleEn, w.en, w.da)
      expect(joined(d)).toBe(w.exampleDa)
      expect(joined(e)).toBe(w.exampleEn)
      if (d.some((s) => s.hit)) da++
      if (e.some((s) => s.hit)) en++
    }
    console.log(`highlight coverage: Danish ${da}/${WORDS.length}, English ${en}/${WORDS.length}`)
    // Measured 2026-09-05: Danish 889/900, English 870/900. What is left is
    // irregular («øjnene», «stjålet», «kurset») or a sentence that does not
    // use the gloss at all ("a smile on her lips" for «mund»), and both are
    // right to leave unmarked.
    expect(da / WORDS.length).toBeGreaterThan(0.97)
    expect(en / WORDS.length).toBeGreaterThan(0.95)
  })
})
