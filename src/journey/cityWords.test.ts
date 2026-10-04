import { describe, expect, it } from 'vitest'
import list from '../data/city1-connecting-words.da.json'
import { WORDS } from '../data/words'
import { WORDS_PER_CITY } from './cities'
import { cityWords, connectingWordId, connectingWordsForCity, isConnectingWordId } from './cityWords'
import { wordsForCity } from './progress'

describe("Sønderborg's connecting words as word identities", () => {
  const connecting = connectingWordsForCity(0, 'da')

  it('are the 47 of the one list, in its order, with their recordings', () => {
    expect(connecting).toHaveLength(47)
    expect(connecting.map((w) => w.text)).toEqual(list.words.map((w) => w.da))
    expect(connecting.map((w) => w.audio.key)).toEqual(list.words.map((w) => w.audio.key))
    for (const w of connecting) {
      expect(w.kind).toBe('connecting')
      expect(w.course).toBe('da')
      expect(w.cityIndex).toBe(0)
      expect(w.audio.key).toMatch(/^connecting\//)
      expect(w.en.keys).toContain(w.en.shown.toLowerCase())
    }
  })

  it('have ids in their own namespace that no board word can collide with', () => {
    const ids = connecting.map((w) => w.id)
    expect(new Set(ids).size).toBe(47)
    expect(ids[0]).toBe('connecting:da:hej')
    expect(connectingWordId('da', 'i morgen')).toBe('connecting:da:i morgen')
    const boardIds = new Set(WORDS.map((w) => w.id))
    for (const id of ids) {
      expect(isConnectingWordId(id)).toBe(true)
      expect(boardIds.has(id)).toBe(false)
    }
    expect(isConnectingWordId('da:hus')).toBe(false)
  })

  it('exist for no other city and no other course until a list is written', () => {
    expect(connectingWordsForCity(1, 'da')).toEqual([])
    expect(connectingWordsForCity(0, 'de')).toEqual([])
  })

  it('are computed once per city and course', () => {
    expect(connectingWordsForCity(0, 'da')).toBe(connecting)
  })
})

describe('a city\'s words', () => {
  it('are its board words in journey order, then its connecting words: 147 in Sønderborg', () => {
    const words = cityWords(WORDS, 0, 'da')
    expect(words).toHaveLength(WORDS_PER_CITY + 47)
    expect(words.slice(0, WORDS_PER_CITY).map((w) => w.id)).toEqual(wordsForCity(WORDS, 0).map((w) => w.id))
    expect(words.slice(0, WORDS_PER_CITY).every((w) => w.kind === 'board')).toBe(true)
    expect(words.slice(WORDS_PER_CITY).every((w) => w.kind === 'connecting')).toBe(true)
    expect(new Set(words.map((w) => w.id)).size).toBe(words.length)
  })

  it('are only board words where no connecting list exists', () => {
    expect(cityWords(WORDS, 1, 'da')).toHaveLength(WORDS_PER_CITY)
  })
})
