import { describe, expect, it } from 'vitest'
import { recordPhoto, type PhotoLedger } from '../journey/wordMarks'
import { validateSaveDestination } from '../stores/saveTransferSchemas'
import { buildBackup, mergeSnapshot, parseBackup, replaceSnapshot, type Snapshot } from './backup'
import { mergeJourney, withoutPhotos } from './journey'
import { PhotoLedgerSchema } from './learningSchema'

/**
 * Photo marks in the portable file (card CW-02). The rules are the ones
 * `wrapped` already lives by: the file carries them, a merge cannot lose one,
 * and a file from before they existed still imports.
 */
const NOW = 1_700_000_000_000
const CPH = 'Europe/Copenhagen'
const T = (iso: string) => Date.parse(iso)
const HUS = 'da:hus'
const HEJ = 'connecting:da:hej'

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

let photos: PhotoLedger = recordPhoto({}, HUS, T('2026-10-04T12:00:00Z'), CPH)
photos = recordPhoto(photos, HEJ, T('2026-10-04T21:50:00Z'), CPH)
photos = recordPhoto(photos, HEJ, T('2026-10-04T22:10:00Z'), CPH)
const withPhotos = snapshot({ journey: { cityIndex: 0, wrapped: {}, arrivedAt: {}, photos } })

describe('photo marks in the backup file', () => {
  it('round-trip export and import exactly', () => {
    const back = roundTrip(withPhotos)
    expect(back.journey.photos).toEqual(photos)
    expect(back.journey.photos![HEJ]).toEqual({
      '2026-10-04': T('2026-10-04T21:50:00Z'),
      '2026-10-05': T('2026-10-04T22:10:00Z'),
    })
    expect(replaceSnapshot(back).journey.photos).toEqual(photos)
  })

  it('write no key at all when there are no photos, like furthest', () => {
    expect(JSON.stringify(buildBackup(snapshot(), NOW))).not.toContain('"photos"')
    const empty = snapshot({ journey: { cityIndex: 0, wrapped: {}, arrivedAt: {}, photos: {} } })
    expect(JSON.stringify(buildBackup(empty, NOW))).not.toContain('"photos"')
    expect(replaceSnapshot(roundTrip(empty)).journey.photos).toEqual({})
  })

  it('an old file without them imports, and leaves the device its photos', () => {
    const old = JSON.parse(JSON.stringify(buildBackup(snapshot({ journey: { cityIndex: 0, wrapped: { [HUS]: NOW }, arrivedAt: {} } }), NOW)))
    expect(old.journey).not.toHaveProperty('photos')
    const parsed = parseBackup(JSON.stringify(old))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.backup.journey.photos).toBeUndefined()
    const merged = mergeSnapshot(withPhotos, parsed.backup)
    expect(merged.journey.photos).toEqual(photos)
    expect(merged.journey.wrapped).toEqual({ [HUS]: NOW })
  })

  it('a format-2 file, from before the progression ledger, imports without photos', () => {
    const pre = JSON.parse(JSON.stringify(buildBackup(snapshot(), NOW)))
    delete pre.progress
    delete pre.learning
    delete pre.recovery
    delete pre.history
    pre.format = 2
    const parsed = parseBackup(JSON.stringify(pre))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(replaceSnapshot(parsed.backup).journey.photos).toEqual({})
  })

  it('merge unions days and keeps the earlier photo, in either direction', () => {
    const file = roundTrip(withPhotos)
    const later: PhotoLedger = recordPhoto(recordPhoto({}, HUS, T('2026-10-04T08:00:00Z'), CPH), HEJ, T('2026-10-06T12:00:00Z'), CPH)
    const device = snapshot({ journey: { cityIndex: 0, wrapped: {}, arrivedAt: {}, photos: later } })
    const merged = mergeSnapshot(device, file)
    expect(merged.journey.photos).toEqual({
      [HUS]: { '2026-10-04': T('2026-10-04T08:00:00Z') },
      [HEJ]: { '2026-10-04': T('2026-10-04T21:50:00Z'), '2026-10-05': T('2026-10-04T22:10:00Z'), '2026-10-06': T('2026-10-06T12:00:00Z') },
    })
    const other = mergeSnapshot(withPhotos, roundTrip(device))
    expect(other.journey.photos).toEqual(merged.journey.photos)
    // Twice over changes nothing.
    expect(mergeSnapshot(merged, file).journey.photos).toEqual(merged.journey.photos)
  })

  it('merge across languages keeps the photos: ids carry their language', () => {
    const german = roundTrip(snapshot({ language: 'de', journey: { cityIndex: 0, wrapped: {}, arrivedAt: {},
      photos: { 'de:Haus': { '2026-10-04': NOW } } } }))
    const merged = mergeSnapshot(withPhotos, german)
    expect(merged.journey.photos).toEqual({ ...photos, 'de:Haus': { '2026-10-04': NOW } })
  })

  it('replace makes the device the file, photos included', () => {
    expect(replaceSnapshot(roundTrip(withPhotos)).journey.photos).toEqual(photos)
    expect(replaceSnapshot(roundTrip(snapshot())).journey.photos).toEqual({})
  })

  it('refuses a photo day that is not a calendar day', () => {
    for (const bad of [{ [HUS]: { 'yesterday': NOW } }, { [HUS]: { '2026-13-01': NOW } }, { [HUS]: { '2026-02-31': NOW } },
      { [HUS]: { '2026-02-29': NOW } }, { [HUS]: { '2026-10-04': -1 } }, { [HUS]: { '2026-10-04': NOW + 0.5 } }, { [HUS]: { '2026-10-04': 'noon' } }]) {
      const file = JSON.parse(JSON.stringify(buildBackup(snapshot(), NOW)))
      file.journey.photos = bad
      expect(parseBackup(JSON.stringify(file)).ok, JSON.stringify(bad)).toBe(false)
    }
  })

  it('every ledger recordPhoto writes is one the schemas accept, fractional and DST times included', () => {
    // A float epoch in the ledger once made buildBackup throw, so every later
    // export and restore failed. recordPhoto floors it; the file must then
    // build, parse back and pass PhotoLedgerSchema.
    let ledger: PhotoLedger = {}
    const times = [NOW + 0.25, NOW + 86_400_000.999, T('2026-03-29T01:00:00.5Z') + 0.5, T('2026-10-25T01:30:00Z') + 0.1, 0.9]
    for (const [i, at] of times.entries()) {
      ledger = recordPhoto(ledger, HUS, at, CPH)
      ledger = recordPhoto(ledger, `da:w${i}`, new Date(at), 'Pacific/Kiritimati')
      ledger = recordPhoto(ledger, HEJ, at, undefined)
    }
    expect(PhotoLedgerSchema.safeParse(ledger).success).toBe(true)
    for (const days of Object.values(ledger)) for (const at of Object.values(days)) expect(Number.isSafeInteger(at)).toBe(true)
    const s = snapshot({ journey: { cityIndex: 0, wrapped: {}, arrivedAt: {}, photos: ledger } })
    expect(() => buildBackup(s, NOW)).not.toThrow()
    expect(roundTrip(s).journey.photos).toEqual(ledger)
  })

  it('photos are not copied into the route history when a whole journey is filed there', () => {
    // A file from the other course is parked whole; its photos live once, at
    // the top of the journey, and not again inside parked.
    const german = roundTrip(snapshot({ language: 'de', journey: { cityIndex: 0, wrapped: {}, arrivedAt: {},
      photos: { 'de:Haus': { '2026-10-04': NOW } } } }))
    const merged = mergeSnapshot(withPhotos, german)
    expect(merged.journey.parked?.de).toBeDefined()
    expect(merged.journey.parked?.de).not.toHaveProperty('photos')
    expect(withoutPhotos({ cityIndex: 1, arrivedAt: {}, wrapped: { a: 1 }, photos })).toEqual({ cityIndex: 1, arrivedAt: {}, wrapped: { a: 1 } })
  })

  it('mergeJourney, the same-language backup merge, keeps photos from both sides', () => {
    // The v1 rescue also calls mergeJourney, but hands it no photos and
    // writes back only position and wrapped words: photos survive the rescue
    // because nothing there touches them.
    const merged = mergeJourney({ cityIndex: 0, wrapped: {}, arrivedAt: {}, photos }, { cityIndex: 0, wrapped: {}, arrivedAt: {} })
    expect(merged.photos).toEqual(photos)
    const both = mergeJourney({ cityIndex: 0, wrapped: {}, arrivedAt: {} }, { cityIndex: 0, wrapped: {}, arrivedAt: {}, photos })
    expect(both.photos).toEqual(photos)
  })
})

describe('photo marks in the saved journey (save transfer)', () => {
  const v7 = (photos?: unknown) => ({ version: 7, state: {
    cityIndex: 0, furthest: 0, arrivedAt: {}, wrapped: {}, routeLanguage: 'da', parked: {}, historicalRoutes: {},
    waitingForTrain: false, historicalTravelEligibility: {}, ...(photos === undefined ? {} : { photos }),
  } })

  it('accepts a journey with photos, and one without', () => {
    expect(() => validateSaveDestination('cluecab-journey-v2', v7(photos))).not.toThrow()
    expect(() => validateSaveDestination('cluecab-journey-v2', v7({}))).not.toThrow()
    expect(() => validateSaveDestination('cluecab-journey-v2', v7())).not.toThrow()
  })

  it('refuses malformed photo facts', () => {
    expect(() => validateSaveDestination('cluecab-journey-v2', v7({ [HUS]: { 'someday': NOW } }))).toThrow()
    expect(() => validateSaveDestination('cluecab-journey-v2', v7({ [HUS]: { '2026-02-31': NOW } }))).toThrow()
    expect(() => validateSaveDestination('cluecab-journey-v2', v7({ [HUS]: { '2026-10-04': NOW + 0.5 } }))).toThrow()
    expect(() => validateSaveDestination('cluecab-journey-v2', v7({ [HUS]: NOW }))).toThrow()
    expect(() => validateSaveDestination('cluecab-journey-v2', v7([]))).toThrow()
  })
})
