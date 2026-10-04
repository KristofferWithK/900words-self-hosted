import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { applyRoundResults, newStats } from '../srs/scheduler'
import type { WordStats } from '../srs/types'
import {
  CONNECTING_PHOTO_DAYS,
  MARKS_TO_COLLECT,
  boardWordMarks,
  connectingWordMarks,
  countMarks,
  deviceTimeZone,
  emptyPhotoLedger,
  hasPhoto,
  isCollectedByMarks,
  isLocalDayKey,
  localDayKey,
  mergePhotoLedgers,
  photoDays,
  photoEpoch,
  recordPhoto,
  recordPhotos,
  usableTimeZone,
  wordMarks,
  type PhotoLedger,
} from './wordMarks'

const NOW = 1_700_000_000_000
const stats = (over: Partial<WordStats> = {}): WordStats => ({ ...newStats(NOW), ...over })

const CPH = 'Europe/Copenhagen'
const UTC = 'UTC'
// 4 October 2026 is in Danish summer time (CEST, UTC+2).
const T = (iso: string) => Date.parse(iso)
const HUS = 'da:hus'
const HEJ = 'connecting:da:hej'
const BOARD = { id: HUS, kind: 'board' } as const
const CONNECTING = { id: HEJ, kind: 'connecting' } as const

describe('local calendar days', () => {
  it('is the date in the given zone, not the machine zone or UTC', () => {
    // 22:30Z is still 4 October in UTC, already 5 October in Copenhagen.
    const at = T('2026-10-04T22:30:00Z')
    expect(localDayKey(at, UTC)).toBe('2026-10-04')
    expect(localDayKey(at, CPH)).toBe('2026-10-05')
    expect(localDayKey(new Date(at), CPH)).toBe('2026-10-05')
    // Same instant, two dates at the edges of the world.
    const noon = T('2026-10-04T12:00:00Z')
    expect(localDayKey(noon, 'Pacific/Kiritimati')).toBe('2026-10-05')
    expect(localDayKey(noon, 'Pacific/Pago_Pago')).toBe('2026-10-04')
    // The UTC date behind the local date: 05:00Z on the 4th is still the 3rd in Hawaii.
    expect(localDayKey(T('2026-10-04T05:00:00Z'), 'Pacific/Honolulu')).toBe('2026-10-03')
  })

  it('pads the key so it sorts as a date', () => {
    expect(localDayKey(T('2026-01-09T12:00:00Z'), UTC)).toBe('2026-01-09')
  })

  it('refuses a zone it does not know and an instant that is not one', () => {
    expect(() => localDayKey(NOW, 'Mars/Olympus_Mons')).toThrow()
    expect(() => localDayKey(Number.NaN, UTC)).toThrow()
    expect(() => recordPhoto({}, HUS, Number.NaN, UTC)).toThrow()
  })

  it('the device zone is a zone Intl knows', () => {
    expect(() => localDayKey(NOW, deviceTimeZone())).not.toThrow()
  })

  it('a day key is a real calendar date, by the same rule as z.iso.date()', () => {
    const samples = ['2026-10-04', '2026-02-28', '2024-02-29', '2000-02-29', '2026-12-31',
      '2026-02-29', '2026-02-31', '2026-04-31', '1900-02-29', '2026-13-01', '2026-00-10', '2026-10-00', '2026-1-04', 'yesterday', '']
    for (const key of samples) expect(isLocalDayKey(key), key).toBe(z.iso.date().safeParse(key).success)
    expect(isLocalDayKey('2026-02-31')).toBe(false)
  })
})

describe('the device zone when Intl cannot name it', () => {
  afterEach(() => vi.restoreAllMocks())
  // ICU reports Etc/Unknown when it cannot tell the host's zone, and Intl
  // cannot format in Etc/Unknown. A photo must still be filed.
  const unknownHost = () => {
    const real = Intl.DateTimeFormat.prototype.resolvedOptions
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (this: Intl.DateTimeFormat) {
      return { ...real.call(this), timeZone: 'Etc/Unknown' }
    })
  }

  it('Etc/Unknown really is unformattable, which is why the fallback exists', () => {
    expect(() => new Intl.DateTimeFormat('en-US', { timeZone: 'Etc/Unknown' })).toThrow()
  })

  it('falls back to the engine default zone instead of throwing', () => {
    unknownHost()
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Etc/Unknown')
    expect(() => deviceTimeZone()).not.toThrow()
    expect(deviceTimeZone()).toBeUndefined()
    const photos = recordPhoto({}, HUS, T('2026-10-04T12:00:00Z'), deviceTimeZone())
    expect(photoDays(photos, HUS)).toHaveLength(1)
    expect(isLocalDayKey(photoDays(photos, HUS)[0]!)).toBe(true)
  })

  it('usableTimeZone keeps a zone Intl knows and drops one it does not', () => {
    expect(usableTimeZone(CPH)).toBe(CPH)
    expect(usableTimeZone('Etc/Unknown')).toBeUndefined()
    expect(usableTimeZone('Mars/Olympus_Mons')).toBeUndefined()
    expect(usableTimeZone(undefined)).toBeUndefined()
    // A zone a caller names is still refused by the pure function: the
    // fallback is a decision made above it, never a silent one inside it.
    expect(() => localDayKey(NOW, 'Etc/Unknown')).toThrow()
  })
})

describe('daylight saving changes (Europe/Copenhagen, 2026)', () => {
  // Spring: 29 March 2026 01:00Z, 02:00 CET jumps to 03:00 CEST (a 23-hour day).
  // Autumn: 25 October 2026 01:00Z, 03:00 CEST falls back to 02:00 CET (a 25-hour day).
  it('spring forward: local midnight moves from 23:00Z to 22:00Z', () => {
    expect(localDayKey(T('2026-03-28T22:59:59Z'), CPH)).toBe('2026-03-28') // 23:59:59 CET
    expect(localDayKey(T('2026-03-28T23:00:00Z'), CPH)).toBe('2026-03-29') // 00:00 CET
    expect(localDayKey(T('2026-03-29T00:59:59Z'), CPH)).toBe('2026-03-29') // 01:59:59 CET
    expect(localDayKey(T('2026-03-29T01:00:00Z'), CPH)).toBe('2026-03-29') // 03:00 CEST
    expect(localDayKey(T('2026-03-29T21:59:59Z'), CPH)).toBe('2026-03-29') // 23:59:59 CEST
    expect(localDayKey(T('2026-03-29T22:00:00Z'), CPH)).toBe('2026-03-30') // 00:00 CEST
  })

  it('fall back: local midnight moves from 22:00Z to 23:00Z', () => {
    expect(localDayKey(T('2026-10-24T21:59:59Z'), CPH)).toBe('2026-10-24') // 23:59:59 CEST
    expect(localDayKey(T('2026-10-24T22:00:00Z'), CPH)).toBe('2026-10-25') // 00:00 CEST
    expect(localDayKey(T('2026-10-25T00:30:00Z'), CPH)).toBe('2026-10-25') // 02:30 CEST, the first time
    expect(localDayKey(T('2026-10-25T01:30:00Z'), CPH)).toBe('2026-10-25') // 02:30 CET, the second time
    expect(localDayKey(T('2026-10-25T22:59:59Z'), CPH)).toBe('2026-10-25') // 23:59:59 CET
    expect(localDayKey(T('2026-10-25T23:00:00Z'), CPH)).toBe('2026-10-26') // 00:00 CET
  })

  it('the short day and the long day are each one day for a connecting word', () => {
    let spring = recordPhoto({}, HEJ, T('2026-03-28T23:00:00Z'), CPH)
    spring = recordPhoto(spring, HEJ, T('2026-03-29T21:59:59Z'), CPH)
    expect(connectingWordMarks(HEJ, spring).earned).toBe(1)
    let autumn = recordPhoto({}, HEJ, T('2026-10-24T22:00:00Z'), CPH)
    autumn = recordPhoto(autumn, HEJ, T('2026-10-25T00:30:00Z'), CPH)
    autumn = recordPhoto(autumn, HEJ, T('2026-10-25T01:30:00Z'), CPH)
    autumn = recordPhoto(autumn, HEJ, T('2026-10-25T22:59:59Z'), CPH)
    expect(connectingWordMarks(HEJ, autumn).photoDays).toEqual(['2026-10-25'])
    // 23:59 before a change and 00:00 after it are two days.
    let across = recordPhoto({}, HEJ, T('2026-03-28T22:59:00Z'), CPH)
    across = recordPhoto(across, HEJ, T('2026-03-28T23:00:00Z'), CPH)
    across = recordPhoto(across, HEJ, T('2026-10-25T23:00:00Z'), CPH)
    expect(connectingWordMarks(HEJ, across)).toMatchObject({ photoDays: ['2026-03-28', '2026-03-29', '2026-10-26'], collected: true })
  })
})

describe('photo times', () => {
  it('floors a fractional time to its millisecond', () => {
    expect(photoEpoch(NOW + 0.75)).toBe(NOW)
    expect(photoEpoch(new Date(NOW))).toBe(NOW)
    expect(recordPhoto({}, HUS, NOW + 0.5, UTC)[HUS]).toEqual({ [localDayKey(NOW, UTC)]: NOW })
  })

  it('refuses a time that is not a non-negative whole millisecond', () => {
    for (const bad of [Number.NaN, Infinity, -Infinity, -1, -1.5, Number.MAX_SAFE_INTEGER + 2]) {
      expect(() => photoEpoch(bad), String(bad)).toThrow()
      expect(() => recordPhoto({}, HUS, bad, UTC), String(bad)).toThrow()
    }
    expect(() => recordPhoto({}, HUS, new Date(Number.NaN), UTC)).toThrow()
    // 0 is 1 January 1970, a fine time.
    expect(photoEpoch(0)).toBe(0)
  })
})

describe('recording photos', () => {
  it('files a photo under the local day of the zone given', () => {
    const at = T('2026-10-04T22:30:00Z')
    expect(recordPhoto({}, HUS, at, CPH)).toEqual({ [HUS]: { '2026-10-05': at } })
    expect(recordPhoto({}, HUS, at, UTC)).toEqual({ [HUS]: { '2026-10-04': at } })
  })

  it('keeps one row per word per day, with the earliest photo of that day', () => {
    const morning = T('2026-10-04T07:00:00Z')
    const evening = T('2026-10-04T17:00:00Z')
    const afterEvening = recordPhoto({}, HUS, evening, CPH)
    const twice = recordPhoto(afterEvening, HUS, morning, CPH)
    expect(twice).toEqual({ [HUS]: { '2026-10-04': morning } })
    // A later photo of the same day changes nothing, and says so by identity.
    expect(recordPhoto(twice, HUS, evening, CPH)).toBe(twice)
    expect(recordPhoto(twice, HUS, morning, CPH)).toBe(twice)
  })

  it('never mutates the ledger it was given', () => {
    const before: PhotoLedger = { [HUS]: { '2026-10-01': NOW } }
    const frozen = JSON.stringify(before)
    recordPhoto(before, HUS, T('2026-10-04T12:00:00Z'), CPH)
    recordPhoto(before, HEJ, T('2026-10-04T12:00:00Z'), CPH)
    expect(JSON.stringify(before)).toBe(frozen)
  })

  it('refuses a photo of no word', () => {
    expect(() => recordPhoto({}, '', NOW, UTC)).toThrow()
    expect(() => recordPhoto({}, '   ', NOW, UTC)).toThrow()
  })

  it('records a run of right answers at one instant', () => {
    const at = T('2026-10-04T12:00:00Z')
    const after = recordPhotos({}, [HUS, HEJ, HUS], at, CPH)
    expect(photoDays(after, HUS)).toEqual(['2026-10-04'])
    expect(photoDays(after, HEJ)).toEqual(['2026-10-04'])
    expect(recordPhotos(after, [], at, CPH)).toBe(after)
  })

  it('lists photo days sorted, oldest first', () => {
    let ledger = emptyPhotoLedger()
    for (const iso of ['2026-10-04T12:00:00Z', '2026-09-30T12:00:00Z', '2026-10-02T12:00:00Z']) {
      ledger = recordPhoto(ledger, HUS, T(iso), UTC)
    }
    expect(photoDays(ledger, HUS)).toEqual(['2026-09-30', '2026-10-02', '2026-10-04'])
    expect(photoDays(ledger, HEJ)).toEqual([])
    expect(hasPhoto(ledger, HUS)).toBe(true)
    expect(hasPhoto(ledger, HEJ)).toBe(false)
  })
})

describe('the ledger is bounded: the earliest three days per word', () => {
  const day = (d: number) => T(`2026-10-${String(d).padStart(2, '0')}T12:00:00Z`)

  it('a ten-day history keeps three rows, and the marks are unchanged', () => {
    let photos: PhotoLedger = {}
    for (let d = 1; d <= 10; d++) {
      photos = recordPhoto(photos, HEJ, day(d), CPH)
      photos = recordPhoto(photos, HUS, day(d), CPH)
    }
    expect(Object.keys(photos[HEJ]!)).toHaveLength(CONNECTING_PHOTO_DAYS)
    expect(photos[HEJ]).toEqual({ '2026-10-01': day(1), '2026-10-02': day(2), '2026-10-03': day(3) })
    expect(Object.keys(photos[HUS]!)).toHaveLength(CONNECTING_PHOTO_DAYS)
    expect(connectingWordMarks(HEJ, photos)).toMatchObject({ earned: 3, collected: true })
    expect(boardWordMarks(HUS, undefined, photos)).toMatchObject({ photo: true, earned: 1 })
  })

  it('a later day on a full row changes nothing, by identity', () => {
    let photos: PhotoLedger = {}
    for (let d = 1; d <= 3; d++) photos = recordPhoto(photos, HEJ, day(d), CPH)
    expect(recordPhoto(photos, HEJ, day(9), CPH)).toBe(photos)
    // An earlier time on a kept day still moves that day's first photo.
    expect(recordPhoto(photos, HEJ, day(2) - 3_600_000, CPH)[HEJ]!['2026-10-02']).toBe(day(2) - 3_600_000)
  })

  it('an earlier day on a full row takes the place of the latest', () => {
    let photos: PhotoLedger = {}
    for (const d of [5, 6, 7]) photos = recordPhoto(photos, HEJ, day(d), CPH)
    photos = recordPhoto(photos, HEJ, day(2), CPH)
    expect(photoDays(photos, HEJ)).toEqual(['2026-10-02', '2026-10-05', '2026-10-06'])
    expect(connectingWordMarks(HEJ, photos).collected).toBe(true)
  })

  it('merging two three-day ledgers keeps the earliest three, either way round', () => {
    const a: PhotoLedger = { [HEJ]: { '2026-10-01': day(1), '2026-10-04': day(4), '2026-10-06': day(6) } }
    const b: PhotoLedger = { [HEJ]: { '2026-10-02': day(2), '2026-10-03': day(3), '2026-10-05': day(5) } }
    const want = { [HEJ]: { '2026-10-01': day(1), '2026-10-02': day(2), '2026-10-03': day(3) } }
    expect(mergePhotoLedgers(a, b)).toEqual(want)
    expect(mergePhotoLedgers(b, a)).toEqual(want)
    expect(connectingWordMarks(HEJ, mergePhotoLedgers(a, b))).toMatchObject({ earned: 3, collected: true })
  })

  it('a merge trims a row longer than three, whatever wrote it', () => {
    const long: PhotoLedger = { [HEJ]: Object.fromEntries([1, 2, 3, 4, 5].map((d) => [`2026-10-0${d}`, day(d)])) }
    expect(photoDays(mergePhotoLedgers(long, {}), HEJ)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03'])
  })

  it('a merge never lowers a mark: one day and another day are two', () => {
    const a: PhotoLedger = { [HEJ]: { '2026-10-01': day(1) } }
    const b: PhotoLedger = { [HEJ]: { '2026-10-09': day(9) } }
    expect(connectingWordMarks(HEJ, mergePhotoLedgers(a, b)).earned).toBe(2)
  })
})

describe('merging photo ledgers', () => {
  const a: PhotoLedger = { [HUS]: { '2026-10-01': 100, '2026-10-02': 200 } }
  const b: PhotoLedger = { [HUS]: { '2026-10-02': 150, '2026-10-03': 300 }, [HEJ]: { '2026-10-03': 300 } }

  it('unions days per word and keeps the earlier first photo', () => {
    expect(mergePhotoLedgers(a, b)).toEqual({
      [HUS]: { '2026-10-01': 100, '2026-10-02': 150, '2026-10-03': 300 },
      [HEJ]: { '2026-10-03': 300 },
    })
  })

  it('is commutative and idempotent, so a re-import cannot remove a day', () => {
    expect(mergePhotoLedgers(a, b)).toEqual(mergePhotoLedgers(b, a))
    expect(mergePhotoLedgers(a, a)).toEqual(a)
    expect(mergePhotoLedgers(a, {})).toEqual(a)
    expect(mergePhotoLedgers({}, a)).toEqual(a)
    const once = mergePhotoLedgers(a, b)
    expect(mergePhotoLedgers(once, b)).toEqual(once)
  })

  it('does not share rows with its inputs', () => {
    const merged = mergePhotoLedgers(a, {}) as Record<string, Record<string, number>>
    merged[HUS]!['2026-12-24'] = 1
    expect(a[HUS]).not.toHaveProperty('2026-12-24')
  })
})

describe('board words: photo + guess + clue', () => {
  const PHOTO: PhotoLedger = { [HUS]: { '2026-10-04': NOW } }

  it('reads each mark from its own evidence', () => {
    expect(boardWordMarks(HUS, undefined, {})).toEqual({ kind: 'board', photo: false, guess: false, clue: false, earned: 0, collected: false })
    expect(boardWordMarks(HUS, undefined, PHOTO)).toMatchObject({ photo: true, guess: false, clue: false, earned: 1 })
    expect(boardWordMarks(HUS, stats({ greenByGuess: 1 }), {})).toMatchObject({ photo: false, guess: true, clue: false, earned: 1 })
    expect(boardWordMarks(HUS, stats({ greenByClue: 1 }), {})).toMatchObject({ photo: false, guess: false, clue: true, earned: 1 })
  })

  it('a photo of another word is not a photo of this one', () => {
    expect(boardWordMarks(HUS, undefined, { [HEJ]: { '2026-10-04': NOW } }).photo).toBe(false)
  })

  it('a green that ended the round is not a mark unless a side earned it', () => {
    // The old model's `correctGuesses` says the word ended green; the marks
    // read only the directional counters.
    expect(boardWordMarks(HUS, stats({ correctGuesses: 5 }), {}).earned).toBe(0)
  })

  it('collects at three marks in every order of earning them', () => {
    type Step = 'photo' | 'guess' | 'clue'
    const orders: Step[][] = [
      ['photo', 'guess', 'clue'], ['photo', 'clue', 'guess'],
      ['guess', 'photo', 'clue'], ['guess', 'clue', 'photo'],
      ['clue', 'photo', 'guess'], ['clue', 'guess', 'photo'],
    ]
    for (const order of orders) {
      let s: WordStats | undefined
      let photos: PhotoLedger = {}
      let earned = 0
      for (const step of order) {
        expect(boardWordMarks(HUS, s, photos).collected, order.join('>')).toBe(false)
        if (step === 'photo') photos = recordPhoto(photos, HUS, NOW, CPH)
        else s = applyRoundResults(s ? { [HUS]: s } : {}, [{
          wordId: HUS, guessedGreen: true, guessedWrong: false, lookedUp: false,
          greenByOwnClue: step === 'clue', greenByOwnGuess: step === 'guess',
        }], NOW)[HUS]
        earned++
        const marks = boardWordMarks(HUS, s, photos)
        expect(marks.earned, order.join('>')).toBe(earned)
        expect(marks.collected, order.join('>')).toBe(earned === MARKS_TO_COLLECT)
      }
      expect(isCollectedByMarks(BOARD, s, photos)).toBe(true)
    }
  })

  it('two of three is not collected, whichever two', () => {
    expect(boardWordMarks(HUS, stats({ greenByClue: 1, greenByGuess: 1 }), {}).collected).toBe(false)
    expect(boardWordMarks(HUS, stats({ greenByClue: 1 }), PHOTO).collected).toBe(false)
    expect(boardWordMarks(HUS, stats({ greenByGuess: 1 }), PHOTO).collected).toBe(false)
  })

  it('never regresses: replays, wrong rounds and duplicate photos keep every mark', () => {
    const collected = stats({ greenByClue: 1, greenByGuess: 1 })
    let photos = recordPhoto({}, HUS, NOW, CPH)
    expect(boardWordMarks(HUS, collected, photos).collected).toBe(true)
    // A later round where the word is missed: counters only rise.
    const after = applyRoundResults({ [HUS]: collected }, [{
      wordId: HUS, guessedGreen: false, guessedWrong: true, lookedUp: true, greenByOwnClue: false, greenByOwnGuess: false,
    }], NOW + 1)[HUS]
    expect(boardWordMarks(HUS, after, photos).collected).toBe(true)
    // The same photo again, and the same day again.
    photos = recordPhoto(photos, HUS, NOW, CPH)
    photos = recordPhoto(photos, HUS, NOW + 60_000, CPH)
    expect(boardWordMarks(HUS, after, photos).collected).toBe(true)
    // Re-imported over itself.
    expect(boardWordMarks(HUS, after, mergePhotoLedgers(photos, photos)).collected).toBe(true)
  })
})

describe('connecting words: three photos on three local days', () => {
  it('three photos on one day are one mark', () => {
    let photos: PhotoLedger = {}
    for (const iso of ['2026-10-04T08:00:00Z', '2026-10-04T12:00:00Z', '2026-10-04T18:00:00Z']) {
      photos = recordPhoto(photos, HEJ, T(iso), CPH)
    }
    expect(connectingWordMarks(HEJ, photos)).toEqual({ kind: 'connecting', photoDays: ['2026-10-04'], earned: 1, collected: false })
  })

  it('a photo at 23:50 and one at 00:10 local are two days', () => {
    // 21:50Z and 22:10Z: the same UTC day, either side of a Copenhagen midnight.
    const late = T('2026-10-04T21:50:00Z')
    const early = T('2026-10-04T22:10:00Z')
    let photos = recordPhoto({}, HEJ, late, CPH)
    photos = recordPhoto(photos, HEJ, early, CPH)
    expect(connectingWordMarks(HEJ, photos).photoDays).toEqual(['2026-10-04', '2026-10-05'])
    expect(connectingWordMarks(HEJ, photos).earned).toBe(2)
    // In UTC the same two photos are one day. The zone decides, not the clock.
    let utc = recordPhoto({}, HEJ, late, UTC)
    utc = recordPhoto(utc, HEJ, early, UTC)
    expect(connectingWordMarks(HEJ, utc).photoDays).toEqual(['2026-10-04'])
  })

  it('two photos on different UTC days can be one local day', () => {
    // 22:30Z on the 4th and 01:00Z on the 5th are both 5 October in Copenhagen.
    let photos = recordPhoto({}, HEJ, T('2026-10-04T22:30:00Z'), CPH)
    photos = recordPhoto(photos, HEJ, T('2026-10-05T01:00:00Z'), CPH)
    expect(connectingWordMarks(HEJ, photos).photoDays).toEqual(['2026-10-05'])
  })

  it('collects on the third different day, and not before', () => {
    let photos: PhotoLedger = {}
    const days = ['2026-10-04T12:00:00Z', '2026-10-05T12:00:00Z', '2026-10-06T12:00:00Z']
    days.forEach((iso, i) => {
      photos = recordPhoto(photos, HEJ, T(iso), CPH)
      const marks = connectingWordMarks(HEJ, photos)
      expect(marks.earned).toBe(i + 1)
      expect(marks.collected).toBe(i + 1 >= CONNECTING_PHOTO_DAYS)
    })
    expect(isCollectedByMarks(CONNECTING, undefined, photos)).toBe(true)
    // Days need not be consecutive.
    let spread = recordPhoto({}, HEJ, T('2026-01-01T12:00:00Z'), CPH)
    spread = recordPhoto(spread, HEJ, T('2026-06-01T12:00:00Z'), CPH)
    spread = recordPhoto(spread, HEJ, T('2026-12-01T12:00:00Z'), CPH)
    expect(connectingWordMarks(HEJ, spread).collected).toBe(true)
  })

  it('earned is capped at three however many days follow', () => {
    let photos: PhotoLedger = {}
    for (let d = 1; d <= 5; d++) photos = recordPhoto(photos, HEJ, T(`2026-10-0${d}T12:00:00Z`), CPH)
    const marks = connectingWordMarks(HEJ, photos)
    // Was 5 days before the ledger was bounded (review of PR #350): a row now
    // keeps only its earliest three days, which is all a mark reads.
    expect(marks.photoDays).toEqual(['2026-10-01', '2026-10-02', '2026-10-03'])
    expect(marks.earned).toBe(MARKS_TO_COLLECT)
    expect(marks.collected).toBe(true)
  })

  it('board evidence does not count for a connecting word', () => {
    const marks = wordMarks(CONNECTING, stats({ greenByClue: 3, greenByGuess: 3 }), {})
    expect(marks.earned).toBe(0)
    expect(marks.collected).toBe(false)
  })

  it('never regresses on re-import or repeated days', () => {
    let photos: PhotoLedger = {}
    for (let d = 1; d <= 3; d++) photos = recordPhoto(photos, HEJ, T(`2026-10-0${d}T12:00:00Z`), CPH)
    expect(connectingWordMarks(HEJ, photos).collected).toBe(true)
    const again = recordPhotos(photos, [HEJ, HEJ], T('2026-10-03T13:00:00Z'), CPH)
    expect(connectingWordMarks(HEJ, again).collected).toBe(true)
    expect(connectingWordMarks(HEJ, mergePhotoLedgers(again, {})).collected).toBe(true)
    expect(connectingWordMarks(HEJ, mergePhotoLedgers({}, again)).collected).toBe(true)
  })
})

describe('counting marks over a city', () => {
  it('sums marks and counts collected words of both kinds', () => {
    const words = [BOARD, { id: 'da:kat', kind: 'board' } as const, CONNECTING]
    let photos = recordPhoto({}, HUS, NOW, CPH)
    for (let d = 1; d <= 3; d++) photos = recordPhoto(photos, HEJ, T(`2026-10-0${d}T12:00:00Z`), CPH)
    const srs = { [HUS]: stats({ greenByClue: 1, greenByGuess: 1 }), 'da:kat': stats({ greenByGuess: 1 }) }
    expect(countMarks(words, srs, photos)).toEqual({ total: 3, collected: 2, earned: 3 + 1 + 3 })
    expect(countMarks([], {}, {})).toEqual({ total: 0, collected: 0, earned: 0 })
  })
})
