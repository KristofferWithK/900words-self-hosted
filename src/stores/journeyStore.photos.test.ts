import { beforeEach, describe, expect, it, vi } from 'vitest'
import { connectingWordMarks, boardWordMarks } from '../journey/wordMarks'
import { useJourney } from './journeyStore'

/** The store action around `journey/wordMarks.ts#recordPhotos` (card CW-02). */
const T = (iso: string) => Date.parse(iso)
const CPH = 'Europe/Copenhagen'
const realResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions

describe('journeyStore photo marks', () => {
  beforeEach(() => useJourney.getState().reset())

  it('start empty', () => {
    expect(useJourney.getState().photos).toEqual({})
  })

  it('record a run of right answers under the local day of the zone given', () => {
    useJourney.getState().recordPhotos(['da:hus', 'connecting:da:hej'], T('2026-10-04T22:10:00Z'), CPH)
    expect(useJourney.getState().photos).toEqual({
      'da:hus': { '2026-10-05': T('2026-10-04T22:10:00Z') },
      'connecting:da:hej': { '2026-10-05': T('2026-10-04T22:10:00Z') },
    })
    expect(boardWordMarks('da:hus', undefined, useJourney.getState().photos).photo).toBe(true)
  })

  it('are add-only: a second photo the same day keeps the first, a new day is added', () => {
    const s = useJourney.getState()
    s.recordPhotos(['connecting:da:hej'], T('2026-10-04T12:00:00Z'), CPH)
    const first = useJourney.getState().photos
    s.recordPhotos(['connecting:da:hej'], T('2026-10-04T18:00:00Z'), CPH)
    expect(useJourney.getState().photos).toBe(first)
    s.recordPhotos(['connecting:da:hej'], T('2026-10-05T12:00:00Z'), CPH)
    s.recordPhotos(['connecting:da:hej'], T('2026-10-06T12:00:00Z'), CPH)
    expect(connectingWordMarks('connecting:da:hej', useJourney.getState().photos).collected).toBe(true)
  })

  it('use the device zone when none is given', () => {
    useJourney.getState().recordPhotos(['da:hus'], T('2026-10-04T12:00:00Z'))
    expect(Object.keys(useJourney.getState().photos['da:hus']!)).toHaveLength(1)
  })

  it('never drop a run because of the zone: an unusable one falls back to the engine default', () => {
    // ICU's Etc/Unknown (host zone undeterminable) cannot be formatted in; a
    // throw inside `set` would lose every photo of the run.
    expect(() => useJourney.getState().recordPhotos(['da:hus', 'connecting:da:hej'], T('2026-10-04T12:00:00Z'), 'Etc/Unknown')).not.toThrow()
    expect(Object.keys(useJourney.getState().photos)).toEqual(['da:hus', 'connecting:da:hej'])
    useJourney.getState().reset()
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (this: Intl.DateTimeFormat) {
      return { ...realResolvedOptions.call(this), timeZone: 'Etc/Unknown' }
    })
    try {
      expect(() => useJourney.getState().recordPhotos(['da:hus'], T('2026-10-04T12:00:00Z'))).not.toThrow()
      expect(Object.keys(useJourney.getState().photos['da:hus']!)).toHaveLength(1)
    } finally {
      vi.restoreAllMocks()
    }
  })

  it('floor a fractional answer time, so the save stays one the schemas accept', () => {
    useJourney.getState().recordPhotos(['da:hus'], T('2026-10-04T12:00:00Z') + 0.75, CPH)
    expect(useJourney.getState().photos['da:hus']).toEqual({ '2026-10-04': T('2026-10-04T12:00:00Z') })
  })

  it('reset clears them with the rest of the journey', () => {
    useJourney.getState().recordPhotos(['da:hus'], T('2026-10-04T12:00:00Z'), CPH)
    useJourney.getState().reset()
    expect(useJourney.getState().photos).toEqual({})
  })
})

describe('journeyStore photo marks across a real rehydrate', () => {
  // Under vitest there is no localStorage and persist is a passthrough, so
  // seed a storage and import a fresh store born with it, the way
  // journeyStore.test.ts drives the release-scope clamp.
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

  it('a v7 save written before photos existed loads with photos: {}', async () => {
    const store = await hydrate(v7())
    const s = store.getState()
    expect(s.photos).toEqual({})
    expect(s.wrapped).toEqual({ 'da:hus': 1_700_000_000_000 })
    // And the action works on it straight away.
    s.recordPhotos(['da:hus'], T('2026-10-04T12:00:00Z'), CPH)
    expect(store.getState().photos).toEqual({ 'da:hus': { '2026-10-04': T('2026-10-04T12:00:00Z') } })
  })

  it('a v7 save with photos loads them as written', async () => {
    const photos = { 'connecting:da:hej': { '2026-10-04': T('2026-10-04T12:00:00Z') } }
    expect((await hydrate(v7({ photos }))).getState().photos).toEqual(photos)
  })
})
