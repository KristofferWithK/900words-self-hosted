import { describe, expect, it } from 'vitest'
import { articleLabel, spokenArticle } from '../../data/gender'
import { german } from './index'

describe('German City 1 article teaching', () => {
  it('shows and speaks each noun with its definite article, including mass nouns', () => {
    const nouns = german.words.filter((word) => word.pos === 'noun')
    expect(nouns.length).toBeGreaterThan(0)
    expect(new Set(nouns.map((word) => word.article))).toEqual(new Set(['der', 'die', 'das']))
    for (const word of nouns) {
      expect(articleLabel(word), word.da).toBe(word.article)
      expect(spokenArticle(word), word.da).toBe(word.article)
    }
  })

  it('covers German mass nouns without changing Danish article behavior', () => {
    for (const name of ['Geld', 'Zeit', 'Musik']) {
      const word = german.words.find((entry) => entry.da === name)!
      expect(word.countable).toBe(false)
      expect(articleLabel(word)).toBe(word.article)
      expect(spokenArticle(word)).toBe(word.article)
    }
    expect(articleLabel({ pos: 'noun', article: 'en', gender: 'common', countable: false })).toBe('(com)')
    expect(spokenArticle({ pos: 'noun', article: 'en', gender: 'common', countable: false })).toBeNull()
  })
})
