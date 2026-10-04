import { afterEach, describe, expect, it } from 'vitest'
import type { TrainRunFact, TrainRunFacts } from '../journey/progress'
import { mergeTrainRuns } from '../journey/progress'
import { recordCaughtTrainNow, ticketFromResult } from '../journey/trainTicket'
import type { RunResult } from '../run/results'
import { useJourney } from '../stores/journeyStore'
import { validateSaveDestination } from '../stores/saveTransferSchemas'
import { buildBackup, mergeSnapshot, parseBackup, replaceSnapshot, type Snapshot } from './backup'
import { mergeJourney, withoutPhotos } from './journey'
import { TrainRunsFileSchema, TrainRunsSchema } from './learningSchema'

/**
 * The train ticket in the portable file (card CW-07), by the rules `photos`
 * (CW-02) and `cafes` (CW-04) already live by: the file carries it, a merge
 * cannot lose one, a file from before it still imports, and route history is
 * not given a copy.
 */
const NOW = 1_790_000_000_000
const CITY1 = { courseId: 'da', cityId: 'sonderborg' } as const
const DE1 = { courseId: 'de', cityId: 'sonderborg' } as const
const DA = JSON.stringify(['da', 'sonderborg'])
const DE = JSON.stringify(['de', 'sonderborg'])

const fact = (patch: Partial<TrainRunFact> = {}): TrainRunFact =>
  ({ city: CITY1, passed: true, at: NOW, words: 147, photos: 141, slips: 6, allowed: 8, ...patch })
const trainRuns: TrainRunFacts = { [DA]: fact() }

const snapshot = (patch: Partial<Snapshot> = {}): Snapshot => ({
  stats: {},
  games: { played: 0, won: 0, redeemed: 0, lost: 0 },
  translationPostcards: 0,
  journey: { cityIndex: 0, wrapped: {}, arrivedAt: {} },
  prefs: {},
  language: 'da',
  ...patch,
})
const withTicket = snapshot({ journey: { cityIndex: 0, wrapped: {}, arrivedAt: {}, trainRuns } })

const roundTrip = (s: Snapshot) => {
  const parsed = parseBackup(JSON.stringify(buildBackup(s, NOW)))
  if (!parsed.ok) throw new Error(parsed.error)
  return parsed.backup
}

describe('the train ticket in the backup file', () => {
  it('survives export and import exactly, and a replace restores it', () => {
    const back = roundTrip(withTicket)
    expect(back.journey.trainRuns).toEqual(trainRuns)
    expect(replaceSnapshot(back).journey.trainRuns).toEqual(trainRuns)
  })

  it('writes no key when no train was caught', () => {
    expect(JSON.stringify(buildBackup(snapshot(), NOW))).not.toContain('"trainRuns"')
    const empty = snapshot({ journey: { cityIndex: 0, wrapped: {}, arrivedAt: {}, trainRuns: {} } })
    expect(JSON.stringify(buildBackup(empty, NOW))).not.toContain('"trainRuns"')
    expect(replaceSnapshot(roundTrip(empty)).journey.trainRuns).toEqual({})
  })

  it('an old file without it imports; a merge keeps the device its ticket, a replace has none', () => {
    const old = JSON.parse(JSON.stringify(buildBackup(snapshot({ journey: { cityIndex: 0, wrapped: { 'da:hus': NOW }, arrivedAt: {} } }), NOW)))
    expect(old.journey).not.toHaveProperty('trainRuns')
    const parsed = parseBackup(JSON.stringify(old))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.backup.journey.trainRuns).toBeUndefined()
    expect(mergeSnapshot(withTicket, parsed.backup).journey.trainRuns).toEqual(trainRuns)
    expect(replaceSnapshot(parsed.backup).journey.trainRuns).toEqual({})
  })

  it('a format-2 file imports without a ticket', () => {
    const pre = JSON.parse(JSON.stringify(buildBackup(snapshot(), NOW)))
    for (const key of ['progress', 'learning', 'recovery', 'history']) delete pre[key]
    pre.format = 2
    const parsed = parseBackup(JSON.stringify(pre))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(replaceSnapshot(parsed.backup).journey.trainRuns).toEqual({})
  })

  it('merge keeps a ticket from either side, the earlier one when both have one', () => {
    const later = snapshot({ journey: { cityIndex: 0, wrapped: {}, arrivedAt: {}, trainRuns: { [DA]: fact({ at: NOW + 99, slips: 0 }) } } })
    expect(mergeSnapshot(later, roundTrip(withTicket)).journey.trainRuns).toEqual(trainRuns)
    expect(mergeSnapshot(withTicket, roundTrip(later)).journey.trainRuns).toEqual(trainRuns)
    expect(mergeSnapshot(snapshot(), roundTrip(withTicket)).journey.trainRuns).toEqual(trainRuns)
  })

  it('merge across languages keeps both courses, and route history gets no copy', () => {
    const german = roundTrip(snapshot({ language: 'de', journey: { cityIndex: 0, wrapped: {}, arrivedAt: {}, trainRuns: { [DE]: fact({ city: DE1 }) } } }))
    const merged = mergeSnapshot(withTicket, german)
    expect(merged.journey.trainRuns).toEqual({ ...trainRuns, [DE]: fact({ city: DE1 }) })
    expect(merged.journey.parked?.de).toBeDefined()
    expect(merged.journey.parked?.de).not.toHaveProperty('trainRuns')
    expect(withoutPhotos({ cityIndex: 0, arrivedAt: {}, wrapped: {}, trainRuns })).toEqual({ cityIndex: 0, arrivedAt: {}, wrapped: {} })
  })

  it('mergeJourney keeps the ticket of either side', () => {
    expect(mergeJourney({ cityIndex: 0, wrapped: {}, arrivedAt: {}, trainRuns }, { cityIndex: 0, wrapped: {}, arrivedAt: {} }).trainRuns).toEqual(trainRuns)
    expect(mergeJourney({ cityIndex: 0, wrapped: {}, arrivedAt: {} }, { cityIndex: 0, wrapped: {}, arrivedAt: {}, trainRuns }).trainRuns).toEqual(trainRuns)
  })

  it('refuses malformed tickets', () => {
    for (const bad of [
      { sonderborg: fact() },
      { [JSON.stringify(['fr', 'paris'])]: fact() },
      // Filed under Sønderborg but naming Ribe.
      { [DA]: fact({ city: { courseId: 'da', cityId: 'ribe' } }) },
      { [DA]: fact({ at: -1 }) },
      { [DA]: fact({ words: 1.5 }) },
      { [DA]: { city: CITY1, passed: true } },
      [],
    ]) {
      expect(TrainRunsFileSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false)
      const file = JSON.parse(JSON.stringify(buildBackup(snapshot(), NOW)))
      file.journey.trainRuns = bad
      expect(parseBackup(JSON.stringify(file)).ok, JSON.stringify(bad)).toBe(false)
    }
  })

  it('a file from a newer build imports with an unknown key stripped; the live-state validator still refuses it', () => {
    const file = JSON.parse(JSON.stringify(buildBackup(withTicket, NOW)))
    file.journey.trainRuns[DA].seat = '12A'
    const parsed = parseBackup(JSON.stringify(file))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.backup.journey.trainRuns).toEqual(trainRuns)
    expect(TrainRunsSchema.safeParse(file.journey.trainRuns).success).toBe(false)
  })
})

describe('the train ticket in the saved journey (save transfer)', () => {
  const v7 = (value?: unknown) => ({ version: 7, state: {
    cityIndex: 0, furthest: 0, arrivedAt: {}, wrapped: {}, routeLanguage: 'da', parked: {}, historicalRoutes: {},
    waitingForTrain: false, historicalTravelEligibility: {}, ...(value === undefined ? {} : { trainRuns: value }),
  } })

  it('accepts a journey with a ticket, and one without', () => {
    expect(() => validateSaveDestination('cluecab-journey-v2', v7(trainRuns))).not.toThrow()
    expect(() => validateSaveDestination('cluecab-journey-v2', v7({}))).not.toThrow()
    expect(() => validateSaveDestination('cluecab-journey-v2', v7())).not.toThrow()
  })

  it('refuses malformed tickets', () => {
    expect(() => validateSaveDestination('cluecab-journey-v2', v7({ sonderborg: fact() }))).toThrow()
    expect(() => validateSaveDestination('cluecab-journey-v2', v7({ [DA]: { ...fact(), at: 'noon' } }))).toThrow()
    expect(() => validateSaveDestination('cluecab-journey-v2', v7({ [DA]: { ...fact(), extra: true } }))).toThrow()
    expect(() => validateSaveDestination('cluecab-journey-v2', v7([]))).toThrow()
  })
})

describe('the ticket a caught train earns', () => {
  const result = (patch: Partial<RunResult> = {}): RunResult => ({
    walk: 'train', cityIndex: 0, startedAt: NOW - 400_000, endedAt: NOW, end: 'caught', photos: 141, answered: 147,
    forgiven: 8, total: 147, words: [],
    misses: Array.from({ length: 6 }, (_, i) => ({ walk: 'train' as const, kind: 'meaning' as const, wordId: `da:w${i}`, origin: 'board' as const, pickedId: 'da:x', at: NOW, ended: false })),
    ...patch,
  })
  const before = useJourney.getState().trainRuns
  afterEach(() => useJourney.setState({ trainRuns: before }))

  it('is the city, the time, and the run\'s numbers; only a caught train run is one', () => {
    expect(ticketFromResult(result(), CITY1)).toEqual(fact())
    expect(ticketFromResult(result({ end: 'second-wrong' }), CITY1)).toBeNull()
    expect(ticketFromResult(result({ end: 'left' }), CITY1)).toBeNull()
    expect(ticketFromResult(result({ walk: 'words' }), CITY1)).toBeNull()
  })

  it('is stored in the journey under the city key, and the first ticket is kept', () => {
    useJourney.setState({ trainRuns: {} })
    recordCaughtTrainNow(result())
    expect(useJourney.getState().trainRuns).toEqual(trainRuns)
    recordCaughtTrainNow(result({ endedAt: NOW + 5000, misses: [] }))
    expect(useJourney.getState().trainRuns).toEqual(trainRuns)
    recordCaughtTrainNow(result({ end: 'second-wrong' }))
    expect(useJourney.getState().trainRuns).toEqual(trainRuns)
  })

  it('mergeTrainRuns: a passed run beats one that did not pass, whatever the time', () => {
    const failed = { [DA]: fact({ passed: false, at: NOW - 1 }) }
    expect(mergeTrainRuns(failed, trainRuns)).toEqual(trainRuns)
    expect(mergeTrainRuns(trainRuns, failed)).toEqual(trainRuns)
  })
})
