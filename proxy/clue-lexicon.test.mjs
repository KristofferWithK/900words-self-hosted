import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  allSources,
  authoredTerms,
  deriveLexicon,
  measureLexicon,
  readBanks,
  readBooks,
  renderedLexicon,
} from '../scripts/generate-clue-lexicon.mjs'

const normalize = (value) => value.normalize('NFC').trim().toLowerCase()
const taught = new Set(JSON.parse(readFileSync('src/data/words.da.json', 'utf8')).map((word) => normalize(word.da)))
const generated = JSON.parse(readFileSync('src/data/clue-lexicon.da.json', 'utf8'))

describe('L1 authored clue lexicon', () => {
  it('is byte-stable and is exactly the checked-in generated output', () => {
    const checkedIn = readFileSync('src/data/clue-lexicon.da.json', 'utf8').replace(/\r\n/g, '\n')
    expect(renderedLexicon()).toBe(checkedIn)
    expect(measureLexicon()).toEqual({ rawBytes: 80950, gzipBytes: 20379 })
  })

  it('covers every unique authored clue term together with the existing taught lookup', () => {
    const reachable = new Set([...taught, ...generated.map((entry) => normalize(entry.da))])
    expect(authoredTerms(readBooks()).map((entry) => normalize(entry.da)).filter((term) => !reachable.has(term))).toEqual([])
    expect(generated).toHaveLength(2600)
    expect(authoredTerms(readBooks())).toHaveLength(3225)
    expect(authoredTerms(allSources())).toHaveLength(3403)
  })

  it('answers every clue Casey gives from the City 1 bank offline, «forrige» included', () => {
    // 174 of the bank's clue words were in no book: a lookup of Casey's own
    // opening clue on bank_001 went to the model as if it were English.
    const reachable = new Set([...taught, ...generated.map((entry) => normalize(entry.da))])
    const bankClues = authoredTerms(readBanks()).map((entry) => normalize(entry.da))
    expect(bankClues.length).toBeGreaterThan(400)
    expect(bankClues.filter((term) => !reachable.has(term))).toEqual([])
    expect(generated).toContainEqual({ da: 'forrige', en: 'previous' })
  })

  it('takes nothing from the bank but the clue word and its English', () => {
    const [bank] = readBanks()
    const entries = bank.book.words.bank.assoc
    for (const entry of entries) expect(Object.keys(entry).sort()).toEqual(['da', 'en'])
    const text = JSON.stringify(bank.book)
    for (const privateField of ['targetWordIds', 'aiGreenIds', 'wordIds', 'bank_001']) expect(text).not.toContain(privateField)
  })

  it('keeps pair clues as anonymous terms while retaining no private book field', () => {
    expect(generated).toContainEqual({ da: 'barnevogn', en: 'pram' })
    for (const entry of generated) {
      expect(Object.keys(entry).sort()).toEqual(['da', 'en'])
      expect(entry).not.toHaveProperty('why')
      expect(entry).not.toHaveProperty('s')
      expect(entry).not.toHaveProperty('v')
    }
  })

  it('changes when an authored term changes — the generator cannot pass vacuously', () => {
    const sources = structuredClone(readBooks())
    sources[0].book.words['da:mor'].assoc[0].da = 'l1 mutation term'
    const mutated = deriveLexicon(sources)
    expect(mutated).toContainEqual(expect.objectContaining({ da: 'l1 mutation term' }))
    expect(mutated).not.toEqual(generated)
  })
})
