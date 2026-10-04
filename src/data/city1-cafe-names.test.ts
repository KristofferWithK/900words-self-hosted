import { describe, expect, it } from 'vitest'
import words from './words.da.json'
import connecting from './city1-connecting-words.da.json'
import cafes from './city1-cafe-names.da.json'

// The 100 default café names for Sønderborg (docs/roadmap/cafe-world.md section 5).
const byId = new Map(words.map((w) => [w.id, w]))
const connectingWords = new Set(connecting.words.map((w) => w.da))

describe("Sønderborg's café names", () => {
  it('are exactly 100, each name and id once', () => {
    expect(cafes.names).toHaveLength(100)
    expect(cafes.count).toBe(100)
    expect(new Set(cafes.names.map((c) => c.name)).size).toBe(100)
    expect(new Set(cafes.names.map((c) => c.id)).size).toBe(100)
  })

  it('are built from course words only', () => {
    for (const cafe of cafes.names) {
      expect(cafe.sourceWords.length, cafe.name).toBeGreaterThan(0)
      for (const source of cafe.sourceWords) {
        if ('wordId' in source && source.wordId) expect(byId.get(source.wordId)?.da, cafe.name).toBe(source.da)
        else if ('connecting' in source && source.connecting) expect(connectingWords.has(source.da), cafe.name).toBe(true)
        else expect(['og', 'ved', 'under'], cafe.name).toContain(source.da)
      }
    }
  })

  it('use a known form, a meaning and one signature item, and wait for a Danish check', () => {
    const forms = Object.keys(cafes.forms)
    for (const cafe of cafes.names) {
      expect(forms, cafe.name).toContain(cafe.form)
      expect(cafe.meaningEn, cafe.name).toMatch(/\S/)
      expect(cafe.signatureItem, cafe.name).toMatch(/^(a|an|one|two|three) /)
      expect(cafe.needsDanishCheck, cafe.name).toBe(true)
    }
  })

  it('put den before en-words and det before et-words', () => {
    for (const cafe of cafes.names.filter((c) => c.form === 'adjective-definite')) {
      const noun = cafe.sourceWords.at(-1)!
      const article = 'wordId' in noun ? byId.get(noun.wordId!)?.article : undefined
      expect(cafe.name.split(' ')[0]!.toLowerCase(), cafe.name).toBe(article === 'et' ? 'det' : 'den')
    }
  })

  it('end an en-word in -en and an et-word in -et in the "the" form', () => {
    for (const cafe of cafes.names.filter((c) => c.form === 'definite')) {
      const noun = cafe.sourceWords[0]!
      const article = 'wordId' in noun ? byId.get(noun.wordId!)?.article : undefined
      expect(cafe.name, cafe.name).toMatch(article === 'et' ? /et$/ : /en$/)
    }
  })
})
