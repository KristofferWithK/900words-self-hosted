import { describe, expect, it } from 'vitest'
import type { CafeFindsByCity } from '../journey/cafes'
import { validateSaveDestination } from '../stores/saveTransferSchemas'
import { buildBackup, mergeSnapshot, parseBackup, replaceSnapshot, type Snapshot } from './backup'
import { mergeJourney, withoutPhotos } from './journey'
import { CafeFindsFileSchema, CafeFindsSchema } from './learningSchema'

/**
 * Café finds in the portable file (card CW-04), by the rules `photos` already
 * lives by (CW-02): the file carries them, a merge cannot lose one, a file
 * from before them still imports, and route history is not given a copy.
 */
const NOW = 1_790_000_000_000
const DA = JSON.stringify(['da', 'sonderborg'])
const DE = JSON.stringify(['de', 'sonderborg'])

const snapshot = (patch: Partial<Snapshot> = {}): Snapshot => ({
  stats: {},
  games: { played: 0, won: 0, redeemed: 0, lost: 0 },
  translationPostcards: 0,
  journey: { cityIndex: 0, wrapped: {}, arrivedAt: {} },
  prefs: {},
  language: 'da',
  ...patch,
})

const roundTrip = (s: Snapshot) => {
  const parsed = parseBackup(JSON.stringify(buildBackup(s, NOW)))
  if (!parsed.ok) throw new Error(parsed.error)
  return parsed.backup
}

const cafes: CafeFindsByCity = { [DA]: { found: { bank_001: NOW, bank_036: NOW + 5 }, toward: 7 } }
const withCafes = snapshot({ journey: { cityIndex: 0, wrapped: {}, arrivedAt: {}, cafes } })

describe('café finds in the backup file', () => {
  it('round-trip export and import exactly', () => {
    const back = roundTrip(withCafes)
    expect(back.journey.cafes).toEqual(cafes)
    expect(replaceSnapshot(back).journey.cafes).toEqual(cafes)
  })

  it('write no key at all when nothing was found', () => {
    expect(JSON.stringify(buildBackup(snapshot(), NOW))).not.toContain('"cafes"')
    const empty = snapshot({ journey: { cityIndex: 0, wrapped: {}, arrivedAt: {}, cafes: {} } })
    expect(JSON.stringify(buildBackup(empty, NOW))).not.toContain('"cafes"')
    expect(replaceSnapshot(roundTrip(empty)).journey.cafes).toEqual({})
  })

  it('an old file without them imports, and a merge leaves the device its finds', () => {
    const old = JSON.parse(JSON.stringify(buildBackup(snapshot({ journey: { cityIndex: 0, wrapped: { 'da:hus': NOW }, arrivedAt: {} } }), NOW)))
    expect(old.journey).not.toHaveProperty('cafes')
    const parsed = parseBackup(JSON.stringify(old))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.backup.journey.cafes).toBeUndefined()
    expect(mergeSnapshot(withCafes, parsed.backup).journey.cafes).toEqual(cafes)
    expect(replaceSnapshot(parsed.backup).journey.cafes).toEqual({})
  })

  it('a format-2 file imports without finds', () => {
    const pre = JSON.parse(JSON.stringify(buildBackup(snapshot(), NOW)))
    for (const key of ['progress', 'learning', 'recovery', 'history']) delete pre[key]
    pre.format = 2
    const parsed = parseBackup(JSON.stringify(pre))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(replaceSnapshot(parsed.backup).journey.cafes).toEqual({})
  })

  it('merge unions finds, keeps the earlier find, and takes the count of the side that found more', () => {
    const device = snapshot({ journey: { cityIndex: 0, wrapped: {}, arrivedAt: {},
      cafes: { [DA]: { found: { bank_001: NOW - 10 }, toward: 3 } } } })
    const merged = mergeSnapshot(device, roundTrip(withCafes))
    expect(merged.journey.cafes).toEqual({ [DA]: { found: { bank_001: NOW - 10, bank_036: NOW + 5 }, toward: 7 } })
    expect(mergeSnapshot(withCafes, roundTrip(device)).journey.cafes).toEqual(merged.journey.cafes)
    expect(mergeSnapshot(merged, roundTrip(withCafes)).journey.cafes).toEqual(merged.journey.cafes)
  })

  it('merge across languages keeps both courses: a city key carries its course', () => {
    const german = roundTrip(snapshot({ language: 'de', journey: { cityIndex: 0, wrapped: {}, arrivedAt: {},
      cafes: { [DE]: { found: { bank_001: NOW }, toward: 1 } } } }))
    const merged = mergeSnapshot(withCafes, german)
    expect(merged.journey.cafes).toEqual({ ...cafes, [DE]: { found: { bank_001: NOW }, toward: 1 } })
    // Not copied into the route history the other course is parked in.
    expect(merged.journey.parked?.de).toBeDefined()
    expect(merged.journey.parked?.de).not.toHaveProperty('cafes')
  })

  it('route history never gets a copy', () => {
    expect(withoutPhotos({ cityIndex: 0, arrivedAt: {}, wrapped: {}, photos: {}, cafes })).toEqual({ cityIndex: 0, arrivedAt: {}, wrapped: {} })
  })

  it('mergeJourney keeps the finds of either side', () => {
    expect(mergeJourney({ cityIndex: 0, wrapped: {}, arrivedAt: {}, cafes }, { cityIndex: 0, wrapped: {}, arrivedAt: {} }).cafes).toEqual(cafes)
    expect(mergeJourney({ cityIndex: 0, wrapped: {}, arrivedAt: {} }, { cityIndex: 0, wrapped: {}, arrivedAt: {}, cafes }).cafes).toEqual(cafes)
  })

  it('refuses malformed finds', () => {
    for (const bad of [
      { sonderborg: { found: {}, toward: 0 } },
      { [JSON.stringify(['fr', 'paris'])]: { found: {}, toward: 0 } },
      { [DA]: { found: { bank_001: -1 }, toward: 0 } },
      { [DA]: { found: { bank_001: NOW + 0.5 }, toward: 0 } },
      { [DA]: { found: {}, toward: -1 } },
      { [DA]: { found: {} } },
      { [DA]: { found: { '': NOW }, toward: 0 } },
      [],
    ]) {
      expect(CafeFindsFileSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false)
      const file = JSON.parse(JSON.stringify(buildBackup(snapshot(), NOW)))
      file.journey.cafes = bad
      expect(parseBackup(JSON.stringify(file)).ok, JSON.stringify(bad)).toBe(false)
    }
  })
})

describe('a file from a newer build', () => {
  it('imports with a record key this build does not know stripped; the live-state validator still refuses it', () => {
    const file = JSON.parse(JSON.stringify(buildBackup(withCafes, NOW)))
    file.journey.cafes[DA].owner = 'someone'
    const parsed = parseBackup(JSON.stringify(file))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.backup.journey.cafes).toEqual(cafes)
    expect(CafeFindsSchema.safeParse(file.journey.cafes).success).toBe(false)
  })
})

describe('café finds in the saved journey (save transfer)', () => {
  const v7 = (value?: unknown) => ({ version: 7, state: {
    cityIndex: 0, furthest: 0, arrivedAt: {}, wrapped: {}, routeLanguage: 'da', parked: {}, historicalRoutes: {},
    waitingForTrain: false, historicalTravelEligibility: {}, ...(value === undefined ? {} : { cafes: value }),
  } })

  it('accepts a journey with finds, and one without', () => {
    expect(() => validateSaveDestination('cluecab-journey-v2', v7(cafes))).not.toThrow()
    expect(() => validateSaveDestination('cluecab-journey-v2', v7({}))).not.toThrow()
    expect(() => validateSaveDestination('cluecab-journey-v2', v7())).not.toThrow()
  })

  it('refuses malformed finds', () => {
    expect(() => validateSaveDestination('cluecab-journey-v2', v7({ sonderborg: { found: {}, toward: 0 } }))).toThrow()
    expect(() => validateSaveDestination('cluecab-journey-v2', v7({ [DA]: { found: { bank_001: 'noon' }, toward: 0 } }))).toThrow()
    expect(() => validateSaveDestination('cluecab-journey-v2', v7([]))).toThrow()
    expect(() => validateSaveDestination('cluecab-journey-v2', v7({ [DA]: { found: {}, toward: 0, extra: true } }))).toThrow()
  })
})
