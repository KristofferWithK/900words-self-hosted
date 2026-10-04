import { describe, expect, it, vi } from 'vitest'
import { WORDS } from '../data/words'
import { cityWords, connectingWordsForCity } from '../journey/cityWords'
import type { Cafe } from '../journey/cafes'
import { createRunEngine } from './engine'
import type { RunPhoto, RunResult } from './results'
import { createProgressRunResultsSink, onCafeFound, photoMarksWord, walkFindsCafes, type ProgressSinkDeps } from './sinkSetup'
import { connectingWordsFor, runWordsForCity } from './sources'
import { connectingWordId } from './words'
import { UI_LANGUAGES } from '../i18n/types'

function spies(found: (at: number) => Cafe | null = () => null) {
  const calls = { countRun: [] as number[], photos: [] as [string, number][], cafePhotos: [] as number[], writes: 0 }
  const deps: ProgressSinkDeps = {
    countRun: (at) => void calls.countRun.push(at),
    recordPhoto: ({ wordId, at, findsCafes }) => {
      calls.writes++
      if (wordId !== null) calls.photos.push([wordId, at])
      if (!findsCafes) return null
      calls.cafePhotos.push(at)
      return found(at)
    },
  }
  return { calls, sink: createProgressRunResultsSink(deps) }
}

const photo = (at: number, patch: Partial<RunPhoto> = {}): RunPhoto =>
  ({ walk: 'words', kind: 'meaning', wordId: 'da:hus', origin: 'board', at, ...patch })
const result = (patch: Partial<RunResult> = {}): RunResult => ({
  walk: 'words', cityIndex: 0, startedAt: 1, endedAt: 2, end: 'left', photos: 0, answered: 0, forgiven: 1, total: 0, misses: [], words: [], ...patch,
})

describe('one id per connecting word, the journey\'s', () => {
  it('every run word id is a city word id', () => {
    const city = new Set(cityWords(WORDS, 0, 'da').map((w) => w.id))
    for (const w of runWordsForCity(0)) expect(city.has(w.id), w.id).toBe(true)
    for (const lang of UI_LANGUAGES) for (const w of connectingWordsFor('da', 0, lang)) expect(city.has(w.id), `${lang} ${w.id}`).toBe(true)
  })

  it('the run names all 47 connecting words exactly as the journey does, the six spelled apart in their recordings included', () => {
    expect(connectingWordsFor('da', 0, 'en').map((w) => w.id)).toEqual(connectingWordsForCity(0, 'da').map((w) => w.id))
    for (const text of ['hvornår', 'også', 'i morgen', 'i dag', 'må', 'skål']) {
      expect(connectingWordsFor('da', 0, 'en').some((w) => w.id === `connecting:da:${text}`), text).toBe(true)
    }
    expect(connectingWordId('da', { da: 'må' })).toBe('connecting:da:må')
  })
})

describe('the progress sink', () => {
  it('O6: a run left before its first answer costs nothing', () => {
    const { calls, sink } = spies()
    sink.end(result({ end: 'left', answered: 0 }))
    expect(calls.countRun).toEqual([])
    // And through the real engine: started, left at once.
    const engine = createRunEngine({ cityIndex: 0, pool: runWordsForCity(0), sink, rng: () => 0.5, now: () => 10 })
    engine.start()
    engine.step(0.1)
    engine.leave()
    expect(calls.countRun).toEqual([])
  })

  it('O6: the first answer counts the run once, right or wrong, at that answer\'s time', () => {
    const { calls, sink } = spies()
    sink.miss({ walk: 'words', kind: 'meaning', wordId: 'da:hus', origin: 'board', pickedId: 'da:mand', at: 100, ended: false })
    sink.photo(photo(200))
    sink.photo(photo(300))
    sink.end(result({ answered: 3 }))
    expect(calls.countRun).toEqual([100])
    // The next run counts again.
    sink.photo(photo(400))
    sink.end(result({ answered: 1 }))
    expect(calls.countRun).toEqual([100, 400])
  })

  it('records each photo with its own time: a 23:59 answer of a run that ends at 00:02 keeps 23:59', () => {
    const { calls, sink } = spies()
    const late = new Date(2026, 9, 4, 23, 59).getTime()
    const after = new Date(2026, 9, 5, 0, 1).getTime()
    sink.photo(photo(late, { wordId: 'connecting:da:hej', origin: 'connecting' }))
    sink.photo(photo(after, { wordId: 'da:hus' }))
    sink.end(result({ answered: 2, endedAt: new Date(2026, 9, 5, 0, 2).getTime() }))
    expect(calls.photos).toEqual([['connecting:da:hej', late], ['da:hus', after]])
    expect(calls.countRun).toEqual([late])
    expect(calls.cafePhotos).toEqual([late, after])
    // One journey write per answer: the mark and the café count together.
    expect(calls.writes).toBe(2)
  })

  it('a right article finds cafés but is not a photo of the word\'s meaning', () => {
    const { calls, sink } = spies()
    expect(photoMarksWord({ kind: 'article' })).toBe(false)
    sink.photo(photo(5, { walk: 'articles', kind: 'article' }))
    expect(calls.photos).toEqual([])
    expect(calls.cafePhotos).toEqual([5])
    expect(calls.countRun).toEqual([5])
  })

  it('only the two walks find cafés; another run (the train) does not', () => {
    expect(walkFindsCafes('words')).toBe(true)
    expect(walkFindsCafes('articles')).toBe(true)
    expect(walkFindsCafes('train')).toBe(false)
    const { calls, sink } = spies()
    sink.photo(photo(7, { walk: 'train' as never }))
    expect(calls.cafePhotos).toEqual([])
    expect(calls.photos).toEqual([['da:hus', 7]])
    expect(calls.countRun).toEqual([7])
  })

  it('tells listeners about a found café, and a failing writer never breaks the run', () => {
    const cafe = { index: 0, state: 'found', foundAt: 9 } as unknown as Cafe
    const { sink } = spies((at) => (at === 9 ? cafe : null))
    const heard: [Cafe, number][] = []
    const stop = onCafeFound((c, p) => heard.push([c, p.at]))
    const broken = onCafeFound(() => { throw new Error('listener') })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      sink.photo(photo(8))
      sink.photo(photo(9))
      expect(heard).toEqual([[cafe, 9]])
      const failing = createProgressRunResultsSink({
        countRun: () => { throw new Error('a') }, recordPhoto: () => { throw new Error('b') },
      })
      expect(() => { failing.photo(photo(1)); failing.miss({ ...photo(2), pickedId: 'x', ended: true }); failing.end(result({ answered: 2 })) }).not.toThrow()
    } finally {
      stop()
      broken()
      warn.mockRestore()
    }
  })
})
