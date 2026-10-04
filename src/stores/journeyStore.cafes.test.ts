import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyProgressFacts } from '../progression/facts'
import { cafeSetFixture } from '../progression/fixtures'
import { cityKey } from '../progression/identity'
import { useJourney } from './journeyStore'

/** The store action around `journey/cafes.ts#countCafePhoto` (card CW-04). */
const city = cafeSetFixture(3)
const KEY = cityKey(city)

describe('journeyStore café finds', () => {
  beforeEach(() => useJourney.getState().reset())

  it('start empty, count photos and find the first café at the fifth', () => {
    expect(useJourney.getState().cafes).toEqual({})
    const found = [1, 2, 3, 4, 5].map((at) => useJourney.getState().recordCafePhoto(city, city.boards, emptyProgressFacts(), at))
    expect(found.slice(0, 4)).toEqual([null, null, null, null])
    expect(found[4]).toMatchObject({ index: 0, state: 'found', foundAt: 5 })
    expect(useJourney.getState().cafes).toEqual({ [KEY]: { found: { 'cafe-0': 5 }, toward: 0 } })
  })

  it('change nothing once every café is found', () => {
    useJourney.setState({ cafes: { [KEY]: { found: { 'cafe-0': 1, 'cafe-1': 2, 'cafe-2': 3 }, toward: 0 } } })
    const before = useJourney.getState()
    expect(useJourney.getState().recordCafePhoto(city, city.boards, emptyProgressFacts(), 9)).toBeNull()
    expect(useJourney.getState()).toBe(before)
  })

  it('recordRunPhoto writes the photo mark and the café count in one store update', () => {
    let updates = 0
    const stop = useJourney.subscribe(() => { updates++ })
    try {
      for (let at = 1; at <= 5; at++) {
        useJourney.getState().recordRunPhoto({ wordId: 'da:hus', at: Date.UTC(2026, 9, at, 12), zone: 'Europe/Copenhagen',
          cafe: { city, boards: city.boards, facts: emptyProgressFacts() } })
      }
    } finally {
      stop()
    }
    expect(updates).toBe(5)
    expect(Object.keys(useJourney.getState().photos['da:hus']!)).toHaveLength(3)
    expect(useJourney.getState().cafes[KEY]!.found).toEqual({ 'cafe-0': Date.UTC(2026, 9, 5, 12) })
    // Nothing to write, nothing written: a day already past the photo row's bound and no café.
    const before = useJourney.getState()
    useJourney.getState().recordRunPhoto({ wordId: 'da:hus', at: Date.UTC(2026, 9, 9, 12), zone: 'Europe/Copenhagen' })
    expect(useJourney.getState()).toBe(before)
  })

  it('reset clears them with the rest of the journey', () => {
    useJourney.getState().recordCafePhoto(city, city.boards, emptyProgressFacts(), 1)
    useJourney.getState().reset()
    expect(useJourney.getState().cafes).toEqual({})
  })
})

describe('journeyStore café finds across a real rehydrate', () => {
  const v7 = (extra: Record<string, unknown> = {}) => ({
    version: 7,
    state: {
      cityIndex: 0, furthest: 0, arrivedAt: { 0: 1_700_000_000_000 }, wrapped: { 'da:hus': 1_700_000_000_000 },
      routeLanguage: 'da', parked: {}, historicalRoutes: {}, historicalTravelEligibility: {}, waitingForTrain: false, ...extra,
    },
  })

  async function hydrate(saved: unknown) {
    const written = new Map<string, string>([['cluecab-journey-v2', JSON.stringify(saved)]])
    const storage = {
      getItem: (k: string) => written.get(k) ?? null,
      setItem: (k: string, v: string) => void written.set(k, v),
      removeItem: (k: string) => void written.delete(k),
    }
    const before = { localStorage: Object.getOwnPropertyDescriptor(globalThis, 'localStorage'), window: Object.getOwnPropertyDescriptor(globalThis, 'window') }
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage } })
    try {
      vi.resetModules()
      const { useJourney: fresh } = await import('./journeyStore')
      await fresh.persist.rehydrate()
      return fresh
    } finally {
      for (const [key, descriptor] of Object.entries(before)) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else delete (globalThis as Record<string, unknown>)[key]
      }
      vi.resetModules()
    }
  }

  it('a v7 save written before the café world loads with cafes: {} and everything else as it was', async () => {
    const s = (await hydrate(v7())).getState()
    expect(s.cafes).toEqual({})
    expect(s.wrapped).toEqual({ 'da:hus': 1_700_000_000_000 })
    expect(s.cityIndex).toBe(0)
  })

  it('a v7 save with finds loads them as written', async () => {
    const cafes = { [KEY]: { found: { 'cafe-0': 5 }, toward: 2 } }
    expect((await hydrate(v7({ cafes }))).getState().cafes).toEqual(cafes)
  })
})
