import { describe, expect, it } from 'vitest'
import words from '../../src/data/words.da.json'
import { cityOfWord, evaluatorForBoard, loadedCities } from './evaluator.js'

/**
 * The city books are parsed on the first request that needs that city, not
 * at start-up (2026-09-07): all three at import were most of the Worker's
 * measured start-up CPU, for shards a City 1 round never reads.
 */
const view = (ids) => ({
  words: ids.map((id) => {
    const word = words.find((w) => w.id === id)
    return { id, da: word.da, en: word.en, pos: word.pos, reveal: { kind: 'hidden' }, roleOnMyKey: 'green' }
  }),
})

describe('city shards load on first use', () => {
  it('knows every word’s city from the matrices without parsing a book', () => {
    expect(loadedCities()).toEqual([])
    expect(cityOfWord('da:by')).toBe(1)
    expect(cityOfWord('da:no-such-word')).toBeNull()
    expect(loadedCities()).toEqual([])
  })

  it('parses only the city a board is in, and nothing for a mixed board', () => {
    const city2 = words.filter((word) => cityOfWord(word.id) === 2).slice(0, 3)
    expect(evaluatorForBoard(view([...city2.map((w) => w.id), 'da:by']))).toBeNull()
    expect(loadedCities()).toEqual([])
    const evaluator = evaluatorForBoard(view(city2.map((w) => w.id)))
    expect(evaluator?.city).toBe(2)
    expect(loadedCities()).toEqual([2])
  })
})
