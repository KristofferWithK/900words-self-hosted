import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { CITIES } from '../journey/cities'
import { WORDS } from '../data/words'
import { canTravel, cityPostcards, hasHistoricalTravelEligibility, wordsForCity } from '../journey/progress'
import { RESCUE_KEY, V1_KEY } from '../journey/rescue'
import { emptyProgressFacts } from '../progression/facts'
import { hasReached, migrateJourney, reachedIndex, rescueStrandedJourney, switchRoute, useJourney } from './journeyStore'

const NOW = 1_700_000_000_000
const DAY = 86_400_000

describe('journeyStore', () => {
  beforeEach(() => useJourney.getState().reset())

  describe('wrapping words', () => {
    it('packs them with a timestamp', () => {
      useJourney.getState().wrapWords(['a', 'b'], NOW)
      expect(useJourney.getState().wrapped).toEqual({ a: NOW, b: NOW })
    })

    it('is add-only: a re-wrap keeps the first time', () => {
      useJourney.getState().wrapWords(['a'], NOW)
      useJourney.getState().wrapWords(['a', 'b'], NOW + 5000)
      expect(useJourney.getState().wrapped).toEqual({ a: NOW, b: NOW + 5000 })
    })
  })

  /**
   * The release scope (DEVELOPED_CITY_COUNT, cities.ts) pins the LIVE route to
   * one stop: the store refuses travel past it, and the rehydrate clamp
   * rewrites any save beyond it (the describe after this one pins both). The
   * travel MACHINERY underneath is still the full-route logic City 2 will
   * inherit, so this describe raises the scope with `vi.mock` and pins the
   * machinery exactly as the suite always did — one edit undoes it when the
   * real constant grows.
   */

  let raisedJourney: typeof useJourney
  beforeEach(() => raisedJourney?.getState().reset())
  beforeAll(async () => {
    // Not hoisted: the mock below applies ONLY to the store re-imported here,
    // so the release-scope describe further down keeps the real constant.
    vi.doMock('../journey/cities', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../journey/cities')>()
      return { ...actual, DEVELOPED_CITY_COUNT: actual.CITIES.length }
    })
    // resetModules first: the store was already imported (and cached) at the
    // top of this file bound to the REAL constant, and a mocked dependency
    // alone does not re-evaluate its importers.
    vi.resetModules()
    ;({ useJourney: raisedJourney } = await import('./journeyStore'))
    vi.doUnmock('../journey/cities')
  })

  describe('travel', () => {
    it('owes the player a word after a closed line, until they board', () => {
      expect(raisedJourney.getState().waitingForTrain).toBe(false)
      raisedJourney.getState().noteTrainClosed()
      expect(raisedJourney.getState().waitingForTrain).toBe(true)
      raisedJourney.getState().travel(NOW)
      expect(raisedJourney.getState().waitingForTrain).toBe(false)
    })

    it('moves one stop and records the arrival', () => {
      raisedJourney.getState().travel(NOW)
      const s = raisedJourney.getState()
      expect(s.cityIndex).toBe(1)
      expect(s.arrivedAt[1]).toBe(NOW)
    })

    it('stops at the end of the road', () => {
      for (let i = 0; i < 20; i++) raisedJourney.getState().travel(NOW + i)
      expect(raisedJourney.getState().cityIndex).toBe(CITIES.length - 1)
    })

    it('can visit a valid stop for TestFlight playtesting without packing words', () => {
      raisedJourney.getState().playtestTravelTo(4, NOW)
      const s = raisedJourney.getState()
      expect(s.cityIndex).toBe(4)
      expect(s.arrivedAt[4]).toBe(NOW)
      expect(s.wrapped).toEqual({})
    })

    it('refuses an invalid TestFlight stop', () => {
      raisedJourney.getState().playtestTravelTo(-1, NOW)
      raisedJourney.getState().playtestTravelTo(CITIES.length, NOW)
      expect(raisedJourney.getState().cityIndex).toBe(0)
      expect(raisedJourney.getState().arrivedAt).toEqual({})
    })

    it('AC18 boarding and attempted boarding never spend canonical postcards', () => {
      const facts = {
        ...emptyProgressFacts(),
        legacyCredit: { identity: 'danish-city1-legacy-v1' as const, amount: 100 },
      }
      const city = { courseId: 'da', cityId: 'sonderborg' } as const
      const before = cityPostcards(facts, city)
      raisedJourney.getState().travel(NOW)
      raisedJourney.getState().travel(NOW + DAY)
      raisedJourney.getState().travelTo(0)
      expect(cityPostcards(facts, city)).toBe(before)
      expect(before).toBe(100)
    })
  })

  describe('historical readiness migration seam', () => {
    const city = { courseId: 'da', cityId: 'sonderborg' } as const
    const other = { courseId: 'da', cityId: 'ribe' } as const

    it('is add-only and names one course/city without minting a postcard balance', () => {
      useJourney.getState().preserveHistoricalTravelEligibility(city)
      const first = useJourney.getState().historicalTravelEligibility
      useJourney.getState().preserveHistoricalTravelEligibility(city)
      expect(useJourney.getState().historicalTravelEligibility).toBe(first)
      expect(hasHistoricalTravelEligibility(first, city)).toBe(true)
      expect(hasHistoricalTravelEligibility(first, other)).toBe(false)
      expect(cityPostcards(emptyProgressFacts(), city)).toBe(0)
    })

    it('does not infer normal-audience eligibility from old developer travel data', () => {
      const out = migrateJourney({
        cityIndex: 4,
        furthest: 4,
        arrivedAt: { 4: NOW },
        wrapped: { 'da:hus': NOW },
        routeLanguage: 'da',
        parked: {},
      }, 5) as { historicalTravelEligibility: Record<string, true> }
      expect(out.historicalTravelEligibility).toEqual({})
    })
  })

  /**
   * Travel back. `travelTo` may move the traveller to any stop already reached
   * and to no other — new ground is `travel`'s alone, one stop at a time
   * behind the packing gate. Mutation-checked: dropping the `hasReached` guard
   * fails 'never a stop not yet reached', and dropping `furthest` from
   * `travelTo`'s return value fails 'an old save going back for the first
   * time' (the ordinary cases survive that one, because `travel` has already
   * written the field by the time they go back — which is the trap).
   */
  describe('travelling back', () => {
    const atStop = (n: number) => {
      for (let i = 0; i < n; i++) raisedJourney.getState().travel(NOW + i * DAY)
    }

    it('goes back to a stop already reached and keeps the arrival log', () => {
      atStop(3)
      const log = raisedJourney.getState().arrivedAt
      raisedJourney.getState().travelTo(1)
      const s = raisedJourney.getState()
      expect(s.cityIndex).toBe(1)
      expect(s.arrivedAt).toEqual(log)
      expect(reachedIndex(s)).toBe(3)
    })

    it('and on again to where it had got to', () => {
      atStop(3)
      raisedJourney.getState().travelTo(0)
      raisedJourney.getState().travelTo(3)
      expect(raisedJourney.getState().cityIndex).toBe(3)
      expect(reachedIndex(raisedJourney.getState())).toBe(3)
    })

    it('an old save going back for the first time remembers how far it had got', () => {
      // A save from before `furthest` existed: standing at stop 3 with the
      // field at its rehydrated 0. `travel` never wrote it, so the move back
      // is the first and only thing that can — drop that write and stop 3
      // becomes unreachable the moment the traveller leaves it.
      raisedJourney.setState({ cityIndex: 3, furthest: 0 })
      raisedJourney.getState().travelTo(1)
      expect(raisedJourney.getState().cityIndex).toBe(1)
      expect(reachedIndex(raisedJourney.getState())).toBe(3)
      raisedJourney.getState().travelTo(3)
      expect(raisedJourney.getState().cityIndex).toBe(3)
    })

    it('never a stop not yet reached', () => {
      atStop(2)
      raisedJourney.getState().travelTo(5)
      expect(raisedJourney.getState().cityIndex).toBe(2)
      raisedJourney.getState().travelTo(0)
      raisedJourney.getState().travelTo(3)
      expect(raisedJourney.getState().cityIndex).toBe(0)
    })

    it('refuses an invalid stop and a no-op move', () => {
      atStop(2)
      const before = raisedJourney.getState()
      raisedJourney.getState().travelTo(-1)
      raisedJourney.getState().travelTo(2.5)
      raisedJourney.getState().travelTo(CITIES.length)
      raisedJourney.getState().travelTo(2)
      expect(raisedJourney.getState()).toBe(before)
    })

    it('travelling on again after going back keeps the first arrival date', () => {
      atStop(2)
      const first = raisedJourney.getState().arrivedAt[2]
      raisedJourney.getState().travelTo(1)
      raisedJourney.getState().travel(NOW + 30 * DAY)
      expect(raisedJourney.getState().cityIndex).toBe(2)
      expect(raisedJourney.getState().arrivedAt[2]).toBe(first)
    })

    it('a save that never travelled back reaches exactly as far as it stands', () => {
      // Every save written before `furthest` existed rehydrates with 0 in it,
      // and that must read as "no further than cityIndex" — the reason the
      // field needed no migration.
      expect(reachedIndex({ cityIndex: 4, furthest: 0 })).toBe(4)
      expect(reachedIndex({ cityIndex: 4 })).toBe(4)
      expect(hasReached({ cityIndex: 4 }, 4)).toBe(true)
      expect(hasReached({ cityIndex: 4 }, 5)).toBe(false)
      expect(hasReached({ cityIndex: 1, furthest: 4 }, 4)).toBe(true)
    })

    it('is parked and resumed with the route', () => {
      atStop(4)
      raisedJourney.getState().travelTo(1)
      const away = switchRoute(raisedJourney.getState(), 'de')
      expect(away.parked.da?.furthest).toBe(4)
      const back = switchRoute(away, 'da')
      expect(back.cityIndex).toBe(1)
      expect(reachedIndex(back)).toBe(4)
    })
  })

  /**
   * The release scope itself, against the REAL DEVELOPED_CITY_COUNT (1):
   * travel and Travel back refuse to leave Sønderborg, a save written beyond
   * the scope rehydrates clamped with its travel log pruned, and the wrapped
   * ledger survives — word knowledge is not travel history. Mutation-checked:
   * removing the rehydrate clamp fails the first test; removing the travel
   * guard fails the second.
   */
  describe('the release-scope clamp (DEVELOPED_CITY_COUNT = 1)', () => {
    beforeEach(() => useJourney.getState().reset())

    it('a save beyond the scope rehydrates standing at Sønderborg, wrapped words kept', async () => {
      // The clamp runs in onRehydrateStorage, so the honest test drives a real
      // rehydrate: seed the persisted key the way a longer-route build (or the
      // playtest jumper) would have written it — standing at Aarhus with the
      // whole travel log and a packed suitcase — and let the store hydrate it.
      const saved = {
        state: {
          cityIndex: 2,
          furthest: 2,
          arrivedAt: { 0: NOW, 1: NOW + DAY, 2: NOW + 2 * DAY },
          wrapped: { 'da:hus': NOW, 'da:kat': NOW + DAY },
          routeLanguage: 'da',
          parked: {},
          waitingForTrain: false,
        },
        version: 5,
      }
      const written = new Map<string, string>([['cluecab-journey-v2', JSON.stringify(saved)]])
      const storage = {
        getItem: (k: string) => written.get(k) ?? null,
        setItem: (k: string, v: string) => void written.set(k, v),
        removeItem: (k: string) => void written.delete(k),
      }
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: { localStorage: storage },
      })
      // The store must be BORN with storage present: zustand's persist attaches
      // its `.persist` API (and its rehydrate) only when the storage it is
      // handed exists, so a store created before the stub — including the
      // beforeAll re-import above, which ran with localStorage still absent —
      // is a passthrough here (its `.persist` is undefined). Reset the module
      // registry and re-import so this evaluates a fresh store, now that the
      // stub is in place.
      vi.resetModules()
      const { useJourney: scopedJourney } = await import('./journeyStore')
      await scopedJourney.persist.rehydrate()
      const s = scopedJourney.getState()
      // The position and the travel log are back to Sønderborg — the map
      // defaults to the first stop, nothing beyond it (owner, 2026-09-15).
      expect(s.cityIndex).toBe(0)
      expect(reachedIndex(s)).toBe(0)
      expect(s.arrivedAt).toEqual({ 0: NOW })
      // Word knowledge is NOT travel history: the packed suitcase survives.
      expect(s.wrapped).toEqual({ 'da:hus': NOW, 'da:kat': NOW + DAY })
      expect(s.historicalTravelEligibility).toEqual({})
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: undefined })
      Object.defineProperty(globalThis, 'window', { configurable: true, value: {} })
    })

    it('travel refuses to leave the developed stop, playtestTravelTo still jumps', () => {
      useJourney.getState().travel(NOW)
      expect(useJourney.getState().cityIndex).toBe(0)
      expect(useJourney.getState().arrivedAt).toEqual({})
      // The jumper is dev tooling for the whole route: never clamped.
      useJourney.getState().playtestTravelTo(4, NOW)
      expect(useJourney.getState().cityIndex).toBe(4)
      expect(useJourney.getState().arrivedAt[4]).toBe(NOW)
    })

    it('travelTo refuses a destination beyond the scope', () => {
      useJourney.setState({ cityIndex: 0, furthest: 3, arrivedAt: { 0: NOW, 3: NOW + DAY } })
      useJourney.getState().travelTo(3)
      expect(useJourney.getState().cityIndex).toBe(0)
      // Within the scope it still works: back to where the traveller stands
      // is a no-op, and the clamp leaves the refusals' identity intact.
      useJourney.getState().travelTo(0)
      expect(useJourney.getState().cityIndex).toBe(0)
    })

    it('canTravel recomputes from the kept wrapped ledger — Sønderborg packed means the road is open', () => {
      const city = wordsForCity(WORDS, 0)
      const wrapped = Object.fromEntries(city.slice(0, 100).map((w) => [w.id, NOW]))
      useJourney.setState({ cityIndex: 0, furthest: 0, arrivedAt: {}, wrapped })
      expect(canTravel(WORDS, useJourney.getState().wrapped, 0)).toBe(true)
      // The gate recomputes from wrapped + cityIndex: at stop 0 with only ten
      // packed it is shut.
      useJourney.setState({ wrapped: Object.fromEntries(city.slice(0, 10).map((w) => [w.id, NOW])) })
      expect(canTravel(WORDS, useJourney.getState().wrapped, 0)).toBe(false)
    })
  })

  /**
   * The v1 rescue (src/journey/rescue.ts) merges an abandoned save back in
   * AFTER the rehydrate clamp has run. A v1 blob predates the scope, so its
   * cityIndex is clamped only to the FULL route (CITIES.length - 1) — merging
   * it in raw reintroduced a position past the developed stops after the
   * clamp had removed one, and the map drew one stop while the player stood
   * nowhere on it. TestFlight 82/83: white screen for anyone with the old
   * key. Mutation-checked: removing the clamp in rescueStrandedJourney fails
   * the first test here.
   */
  describe('the v1 rescue stays inside the developed scope', () => {
    it('a v1 save at stop 3 lands at Sønderborg with its words and nothing past the scope', () => {
      useJourney.setState({ cityIndex: 0, furthest: 0, arrivedAt: {}, wrapped: {} })
      const raw = JSON.stringify({
        state: {
          cityIndex: 3,
          banked: { hus: NOW, kat: NOW + DAY },
          stamps: {},
          trialsSpent: {},
          arrivedAt: { 0: NOW, 1: NOW + DAY, 2: NOW + 2 * DAY, 3: NOW + 3 * DAY },
        },
      })
      const written = new Map<string, string>([
        [V1_KEY, raw],
        // The rescue runs once per device; this device has not run it yet.
        ['cluecab-journey-v2', JSON.stringify({ state: { cityIndex: 0, wrapped: {}, arrivedAt: {} }, version: 5 })],
      ])
      const storage = {
        getItem: (k: string) => written.get(k) ?? null,
        setItem: (k: string, v: string) => void written.set(k, v),
        removeItem: (k: string) => void written.delete(k),
      }
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
      try {
        const result = rescueStrandedJourney()
        expect(result.outcome).toBe('rescued')
        const s = useJourney.getState()
        // The City-1 clamp is absolute: the rescued position cannot stand
        // past the developed stops, however far the v1 blob had travelled.
        expect(s.cityIndex).toBe(0)
        expect(reachedIndex(s)).toBe(0)
        // The travel log is pruned to the developed stops with the position.
        expect(s.arrivedAt).toEqual({ 0: NOW })
        // Word knowledge is not travel history: the recovered words survive.
        expect(s.wrapped).toEqual({ hus: NOW, kat: NOW + DAY })
        expect(storage.getItem(RESCUE_KEY)).not.toBeNull()
      } finally {
        Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: undefined })
      }
    })

    it('a v1 save inside the scope is rescued exactly as it stands', () => {
      useJourney.setState({ cityIndex: 0, furthest: 0, arrivedAt: {}, wrapped: {} })
      const raw = JSON.stringify({
        state: { cityIndex: 0, banked: { hus: NOW }, stamps: {}, trialsSpent: {}, arrivedAt: { 0: NOW } },
      })
      const storage = {
        getItem: (k: string) => (k === V1_KEY ? raw : null),
        setItem: () => undefined,
        removeItem: () => undefined,
      }
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
      try {
        const result = rescueStrandedJourney()
        expect(result.outcome).toBe('rescued')
        const s = useJourney.getState()
        expect(s.cityIndex).toBe(0)
        expect(s.arrivedAt).toEqual({ 0: NOW })
        expect(s.wrapped).toEqual({ hus: NOW })
      } finally {
        Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: undefined })
      }
    })
  })

})

/**
 * v2 -> v3 is the exam economy ceasing to be, and it runs against real saved
 * blobs on real phones. The fixture below is the v2 shape byte-for-byte: every
 * field the store persisted, exactly as `persist` stored it. Mutation-checked:
 * dropping the `wrapped: banked` line in migrateJourney fails the first test.
 *
 * A v2 blob now runs the whole chain to v4. This fixture sits at stop 2, ahead
 * of the stop that left, so the second step is a no-op on it and these
 * assertions still say what they said.
 */
describe('migrateJourney (v2 -> current)', () => {
  const v2Blob = () => ({
    cityIndex: 2,
    stamps: { 0: 5, 1: 5, 2: 1 },
    banked: { hus: NOW - DAY, kat: NOW },
    trialsSpent: { 2: 3 },
    arrivedAt: { 1: NOW - 5 * DAY, 2: NOW - DAY },
    activeExam: { cityIndex: 2, wordIds: ['hus'], answers: { hus: 'house' } },
    lastPaper: ['hus'],
  })

  it('banked words become wrapped, timestamps intact', () => {
    const out = migrateJourney(v2Blob(), 2) as { wrapped: Record<string, number> }
    expect(out.wrapped).toEqual({ hus: NOW - DAY, kat: NOW })
  })

  it('keeps the city and the travel log', () => {
    const out = migrateJourney(v2Blob(), 2) as Record<string, unknown>
    expect(out.cityIndex).toBe(2)
    expect(out.arrivedAt).toEqual({ 1: NOW - 5 * DAY, 2: NOW - DAY })
  })

  it('the exam economy has nothing to become, and is gone', () => {
    const out = migrateJourney(v2Blob(), 2) as Record<string, unknown>
    for (const dead of ['stamps', 'banked', 'trialsSpent', 'activeExam', 'lastPaper']) {
      expect(out).not.toHaveProperty(dead)
    }
  })

  it('v5 adds an empty historical-readiness ledger without inferring from position', () => {
    const blob = {
      cityIndex: 1,
      wrapped: { hus: NOW },
      arrivedAt: {},
      routeLanguage: 'da',
      parked: {},
    }
    // v7 successor: the old route facts survive separately from readiness.
    expect(migrateJourney(blob, 5)).toEqual({ ...blob, historicalTravelEligibility: {},
      historicalRoutes: { da: { cityIndex: 1, arrivedAt: {}, furthest: 0 } } })
  })

  it('v7 preserves every v6 field and archives its route without granting readiness', () => {
    const blob = {
      cityIndex: 0,
      wrapped: {},
      arrivedAt: {},
      routeLanguage: 'da',
      parked: {},
      historicalTravelEligibility: { '["da","sonderborg"]': true },
    }
    const migrated = { ...blob, historicalRoutes: { da: { cityIndex: 0, arrivedAt: {}, furthest: 0 } } }
    expect(migrateJourney(blob, 6)).toEqual(migrated)
    expect(migrateJourney(migrated, 7)).toBe(migrated)
  })

  it('survives an empty or absent state', () => {
    const empty = { wrapped: {}, cityIndex: 0, arrivedAt: {}, routeLanguage: 'da', parked: {}, historicalTravelEligibility: {},
      historicalRoutes: { da: { cityIndex: 0, arrivedAt: {}, furthest: 0 } } }
    expect(migrateJourney(undefined, 2)).toEqual(empty)
    expect(migrateJourney({}, 2)).toEqual(empty)
  })
})

/**
 * v3 -> v4 is Viborg leaving the route, and it is the migration with a person
 * standing in it. A stop is a stored index, so removing the fifth city renames
 * every index from four up, and a save written yesterday points at the wrong
 * town today.
 *
 * The rule is: at Viborg or past it, go back one. Backward is the direction
 * that cannot cost anything, and the last test here is the reason — a stop is
 * only reachable by wrapping every word before it, so the stop a shifted
 * player lands on is always one they have already finished, and the road on is
 * open the moment they look at it.
 *
 * Mutation-checked, both halves: making the shift `index > VIBORG_INDEX`
 * (leaving Viborg where it stands) fails 'Viborg itself falls back to Aarhus',
 * and dropping the `Math.min(shifted, FINAL_CITY_INDEX)` clamp fails 'the old
 * final stop lands on the new one'.
 */
describe('migrateJourney (v3 -> v4): Viborg leaves the route', () => {
  const v3 = (over: Record<string, unknown> = {}) => ({
    cityIndex: 0,
    wrapped: {},
    arrivedAt: {},
    ...over,
  })
  const shift = (cityIndex: number) =>
    (migrateJourney(v3({ cityIndex }), 3) as { cityIndex: number }).cityIndex

  it('leaves the stops before Viborg exactly where they were', () => {
    for (const i of [0, 1, 2, 3]) expect(shift(i)).toBe(i)
  })

  it('Viborg itself falls back to Aarhus, never on to Aalborg', () => {
    expect(shift(4)).toBe(3)
    expect(CITIES[3]!.name).toBe('Aarhus')
  })

  it('every stop after Viborg keeps its city under a new number', () => {
    // The old route, from Viborg's neighbour to the capital.
    const after = ['Aalborg', 'Skagen', 'Odense', 'Roskilde', 'København']
    for (const [n, name] of after.entries()) {
      expect(CITIES[shift(5 + n)]!.name).toBe(name)
    }
  })

  it('the old final stop lands on the new one', () => {
    expect(shift(9)).toBe(CITIES.length - 1)
    expect(shift(99)).toBe(CITIES.length - 1)
  })

  it('the wrapped ledger is not rewritten — it is keyed by word, not by city', () => {
    const wrapped = { 'da:hus': NOW, 'da:appelsin': NOW - DAY }
    const out = migrateJourney(v3({ cityIndex: 7, wrapped }), 3) as {
      wrapped: Record<string, number>
    }
    // 'appelsin' was trimmed with the tenth city's hundred. It stops counting
    // toward anything and it is still left alone, because a ledger that starts
    // deleting is one the dataset can never grow back into.
    expect(out.wrapped).toEqual(wrapped)
  })

  it('the travel log follows the cities it describes', () => {
    const out = migrateJourney(
      v3({ cityIndex: 6, arrivedAt: { 1: 101, 2: 102, 3: 103, 5: 105, 6: 106 } }),
      3,
    ) as { arrivedAt: Record<number, number> }
    expect(out.arrivedAt).toEqual({ 1: 101, 2: 102, 3: 103, 4: 105, 5: 106 })
  })

  it('an arrival at Viborg never overwrites the real arrival at Aarhus', () => {
    const out = migrateJourney(v3({ cityIndex: 4, arrivedAt: { 3: 103, 4: 104 } }), 3) as {
      arrivedAt: Record<number, number>
    }
    expect(out.arrivedAt).toEqual({ 3: 103 })
  })

  /**
   * The one that matters. Two travellers, both standing in Viborg: one who had
   * packed its whole hundred, one who was halfway through. Neither may end up
   * stuck behind a gate, and neither may be carried past words they have not
   * been shown.
   */
  describe('a traveller who was standing in Viborg', () => {
    const bandIds = (city: number) => wordsForCity(WORDS, city).map((w) => w.id)
    /** Everything up to and including the old Viborg band, or part of it. */
    const packed = (throughOldViborg: number) => {
      const ids = [0, 1, 2, 3].flatMap(bandIds).concat(bandIds(4).slice(0, throughOldViborg))
      return Object.fromEntries(ids.map((id) => [id, NOW]))
    }

    it('having packed all hundred, walks out in two taps and skips nothing', () => {
      const wrapped = packed(100)
      const out = migrateJourney(v3({ cityIndex: 4, wrapped }), 3) as { cityIndex: number }
      expect(out.cityIndex).toBe(3)
      // Aarhus: finished long ago, so the road is open the moment they arrive.
      expect(canTravel(WORDS, wrapped, 3)).toBe(true)
      // Aalborg now owns the hundred Viborg owned, and they are packed too.
      expect(canTravel(WORDS, wrapped, 4)).toBe(true)
      // Skagen is where the new words start. Nobody was carried past them.
      expect(canTravel(WORDS, wrapped, 5)).toBe(false)
    })

    it('having packed half of them, resumes on exactly those words', () => {
      const wrapped = packed(50)
      const out = migrateJourney(v3({ cityIndex: 4, wrapped }), 3) as { cityIndex: number }
      expect(out.cityIndex).toBe(3)
      expect(canTravel(WORDS, wrapped, 3)).toBe(true)
      // One tap forward and the half-packed hundred is in front of them again,
      // still half-packed: same words, same progress, new name over the door.
      expect(canTravel(WORDS, wrapped, 4)).toBe(false)
      expect(bandIds(4).filter((id) => id in wrapped)).toHaveLength(50)
    })
  })
})

/**
 * v4 -> v5: the journey position learns which route it is on.
 *
 * THE THING THAT MUST NOT HAPPEN: a player loses a wrapped word. The whole
 * collection lives in one phone's localStorage, months of work with no way
 * back, and moving progress between storage keys is the one mistake here that
 * has actually cost somebody theirs (src/journey/rescue.ts).
 *
 * So the migration adds two fields and names none of the existing ones, and
 * this suite checks that against a full save rather than a toy one.
 */
describe('migrateJourney (v4 -> current): the route gets a language', () => {
  /** A realistic mid-journey save: five cities done, 500 words packed. */
  const fullSave = () => ({
    cityIndex: 5,
    wrapped: Object.fromEntries(
      WORDS.slice(0, 500).map((w, i) => [w.id, NOW - (500 - i) * DAY]),
    ),
    arrivedAt: { 0: NOW - 400 * DAY, 1: NOW - 300 * DAY, 5: NOW - DAY },
  })

  it('keeps every wrapped word, byte for byte', () => {
    const before = fullSave()
    const after = migrateJourney(structuredClone(before), 4) as {
      wrapped: Record<string, number>
    }
    expect(Object.keys(after.wrapped)).toHaveLength(500)
    expect(after.wrapped).toEqual(before.wrapped)
  })

  it('keeps the journey position and the travel log', () => {
    const before = fullSave()
    const after = migrateJourney(structuredClone(before), 4) as Record<string, unknown>
    expect(after.cityIndex).toBe(5)
    expect(after.arrivedAt).toEqual(before.arrivedAt)
  })

  it('v7 keeps the stamped v4 history in both its compatibility fields and route archive', () => {
    const before = fullSave()
    const after = migrateJourney(structuredClone(before), 4) as Record<string, unknown>
    expect(after).toEqual({ ...before, routeLanguage: 'da', parked: {}, historicalTravelEligibility: {},
      historicalRoutes: { da: { cityIndex: before.cityIndex, arrivedAt: before.arrivedAt, furthest: 0 } } })
  })

  it('still travels from where it left off', () => {
    const before = fullSave()
    const after = migrateJourney(structuredClone(before), 4) as {
      cityIndex: number
      wrapped: Record<string, number>
    }
    // Five cities of a hundred are packed, so the road out of the fifth is
    // open and the sixth is untouched — exactly as before the migration.
    expect(canTravel(WORDS, after.wrapped, 4)).toBe(true)
    expect(canTravel(WORDS, after.wrapped, 5)).toBe(false)
  })

  it('carries a pre-Viborg save all the way through and still loses nothing', () => {
    // The long road: a v2 blob crosses the exam economy, Viborg's removal and
    // now the language stamp, in one call.
    const wrapped = Object.fromEntries(WORDS.slice(0, 300).map((w) => [w.id, NOW]))
    const out = migrateJourney({ cityIndex: 6, banked: wrapped, arrivedAt: { 6: NOW } }, 2) as {
      cityIndex: number
      wrapped: Record<string, number>
      routeLanguage: string
    }
    expect(out.cityIndex).toBe(5)
    expect(Object.keys(out.wrapped)).toHaveLength(300)
    expect(out.routeLanguage).toBe('da')
  })
})

/**
 * Parking one route to travel another.
 *
 * Tested with 'de', which has no pack behind it, because that is the only way
 * to test it at all while Danish is the only language that ships — and a seam
 * only Danish ever exercises is a seam that will not fit German.
 */
describe('switchRoute', () => {
  const start = () => ({
    cityIndex: 5,
    arrivedAt: { 0: NOW, 5: NOW + DAY },
    routeLanguage: 'da' as const,
    parked: {} as Partial<Record<'da' | 'de', { cityIndex: number; arrivedAt: Record<number, number> }>>,
    wrapped: { 'da:hus': NOW },
  })

  it('is a no-op for the route already being travelled', () => {
    const s = start()
    expect(switchRoute(s, 'da')).toBe(s)
  })

  it('starts an untravelled route at its first stop', () => {
    const out = switchRoute(start(), 'de')
    expect(out.cityIndex).toBe(0)
    expect(out.arrivedAt).toEqual({})
    expect(out.routeLanguage).toBe('de')
  })

  it('parks the route it left, and gives it back unchanged on return', () => {
    const before = start()
    const away = switchRoute(before, 'de')
    expect(away.parked.da).toEqual({ cityIndex: 5, arrivedAt: before.arrivedAt })
    const back = switchRoute({ ...away, cityIndex: 2, arrivedAt: { 0: NOW, 2: NOW } }, 'da')
    expect(back.cityIndex).toBe(5)
    expect(back.arrivedAt).toEqual(before.arrivedAt)
    // And the German position is now the parked one.
    expect(back.parked.de).toEqual({ cityIndex: 2, arrivedAt: { 0: NOW, 2: NOW } })
    expect(back.parked.da).toBeUndefined()
  })

  it('never touches the wrapped ledger, in either direction', () => {
    const before = start()
    const away = switchRoute(before, 'de')
    expect(away.wrapped).toEqual(before.wrapped)
    expect(switchRoute(away, 'da').wrapped).toEqual(before.wrapped)
  })
})
