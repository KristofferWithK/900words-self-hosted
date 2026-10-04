import type { SrsMap, WordStats } from '../srs/types'

/**
 * THE THREE-MARK MODEL (docs/roadmap/cafe-world.md, section 3; card CW-02).
 *
 * One honest record of what a player has done with each word, and a
 * "collected" state derived from it. Nothing here awards anything: every mark
 * is read from evidence the games already write, plus one new kind of
 * evidence, the photo.
 *
 * Board words (the hundred card words of a city) collect at three marks:
 *   - photo — a right answer in Sightseeing (new evidence, `PhotoLedger`)
 *   - guess — the player named the word under Casey's clue
 *             (`WordStats.greenByGuess`, written by srs/scheduler.ts)
 *   - clue  — the player's own clue led Casey to it
 *             (`WordStats.greenByClue`, same writer)
 *
 * Connecting words (the city's words outside its cards, journey/cityWords.ts)
 * collect at three photos on three different local calendar days. "Different
 * days" is the owner's answer to O5 (4 October 2026): the date in the
 * player's own time zone, so a photo at 23:50 and one at 00:10 are two days.
 *
 * Marks never regress. The photo ledger is add-only and the green counters
 * only rise, so a word that is collected here stays collected whatever is
 * replayed, re-imported or recorded twice.
 *
 * `journey/progress.ts` still holds the pre-café reader (`wordState`,
 * `isCollected`: clue + guess, no photo) because today's screens, the wrap-up
 * pool and settlement read it. CW-11 moves the screens to this module.
 */

/** Marks a word needs to be collected, of either kind. */
export const MARKS_TO_COLLECT = 3
/** Photos on different local days that collect a connecting word. */
export const CONNECTING_PHOTO_DAYS = 3

/**
 * Photo evidence: word id -> local calendar day (`YYYY-MM-DD`) -> epoch ms of
 * the first photo of that word on that day.
 *
 * BOUNDED: at most `CONNECTING_PHOTO_DAYS` (3) rows per word, the EARLIEST
 * three days. Sightseeing is also the review, so collected words keep coming
 * up for as long as the player plays; a row per day for ever would grow the
 * save (and every backup file) without limit. Nothing reads more than three:
 * one day is the board word's photo mark, three distinct days collect a
 * connecting word. Keeping the earliest three keeps every mark monotonic: the
 * kept set only moves to earlier days, and its size only grows, up to three.
 * `recordPhoto` and `mergePhotoLedgers` both hold the bound.
 */
export type PhotoLedger = Readonly<Record<string, Readonly<Record<string, number>>>>

export const emptyPhotoLedger = (): PhotoLedger => ({})

export type WordKind = 'board' | 'connecting'

export interface BoardWordMarks {
  readonly kind: 'board'
  readonly photo: boolean
  readonly guess: boolean
  readonly clue: boolean
  /** Marks earned, 0..3; the suitcase ring fills a third per mark. */
  readonly earned: number
  readonly collected: boolean
}

export interface ConnectingWordMarks {
  readonly kind: 'connecting'
  /** Distinct local days with a photo, sorted: the earliest three at most. */
  readonly photoDays: readonly string[]
  /** Marks earned, 0..3: one per distinct day, capped. */
  readonly earned: number
  readonly collected: boolean
}

export type WordMarks = BoardWordMarks | ConnectingWordMarks

// ── Local calendar days ──────────────────────────────────────────────────────

/**
 * A zone to read local days in: an IANA name Intl can format with, or
 * `undefined` for the engine's own default zone (`Intl.DateTimeFormat`
 * constructed without `timeZone`).
 */
export type DayZone = string | undefined

/**
 * A real calendar date written `YYYY-MM-DD`: `2026-02-31` and `2026-13-01`
 * are not. The same rule as `z.iso.date()`, which the stored ledger is
 * checked against (backup/learningSchema.ts#PhotoLedgerSchema); written out
 * here so this module needs neither zod nor the backup layer.
 */
export function isLocalDayKey(key: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return false
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function dayFormatter(zone: DayZone): Intl.DateTimeFormat {
  const cacheKey = zone ?? ''
  const cached = formatters.get(cacheKey)
  if (cached) return cached
  // Throws RangeError on a named zone Intl does not know: deliberately, for a
  // zone a caller names. A silent fallback here would file a photo under the
  // wrong day without anyone noticing. The fallback lives one level up, in
  // `usableTimeZone` and `deviceTimeZone`, where it is a stated decision.
  const made = new Intl.DateTimeFormat('en-US', {
    ...(zone === undefined ? {} : { timeZone: zone }), year: 'numeric', month: '2-digit', day: '2-digit',
  })
  formatters.set(cacheKey, made)
  return made
}

/**
 * `zone` if Intl can format dates in it, otherwise `undefined`: the engine's
 * own default zone. ICU reports `Etc/Unknown` when it cannot tell the host's
 * zone, and `new Intl.DateTimeFormat('en-US', { timeZone: 'Etc/Unknown' })`
 * throws; formatting without `timeZone` still works there. A photo filed
 * under the engine's idea of the day is better than a whole run's photos lost.
 */
export function usableTimeZone(zone: DayZone): DayZone {
  if (zone === undefined) return undefined
  try {
    dayFormatter(zone)
    return zone
  } catch {
    return undefined
  }
}

/**
 * The zone the player's device keeps time in. Read once per call, never
 * cached: a traveller who lands in another zone gets that zone's days from
 * then on, which is what "their own time zone" means for them. Never a zone
 * Intl cannot format: when the device's zone is missing or unusable (ICU's
 * `Etc/Unknown`) this is `undefined`, the engine default (`usableTimeZone`).
 */
export function deviceTimeZone(): DayZone {
  let zone: string | undefined
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return undefined
  }
  return usableTimeZone(zone || undefined)
}

/**
 * The calendar day `at` falls on in `zone`, as `YYYY-MM-DD`. The zone is a
 * parameter, not the machine's: tests hand in a literal, and the game hands
 * in `deviceTimeZone()`, so nothing here depends on where the tests run.
 * `undefined` is the engine default zone; a named zone Intl does not know
 * throws.
 */
export function localDayKey(at: number | Date, zone: DayZone): string {
  const epoch = typeof at === 'number' ? at : at.getTime()
  if (!Number.isFinite(epoch)) throw new Error('Photo time is not a finite instant')
  const parts = dayFormatter(zone).formatToParts(new Date(epoch))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  const key = `${part('year').padStart(4, '0')}-${part('month')}-${part('day')}`
  if (!isLocalDayKey(key)) throw new Error(`Could not form a local day for zone ${zone ?? '(engine default)'}`)
  return key
}

/**
 * A photo's time as the ledger stores it: whole epoch milliseconds, a
 * non-negative safe integer, which is the `count` the backup file and the
 * save-transfer validator require (`PhotoLedgerSchema`). Fractional input (a
 * clock built on `performance.now()`) is floored: it names the same
 * millisecond. Anything still not a non-negative safe integer after that
 * (NaN, Infinity, an invalid Date, a time before 1970) THROWS rather than be
 * clamped or stored: there is no honest photo time to keep, and one stored
 * value the schemas reject would make every later export and restore fail.
 */
export function photoEpoch(at: number | Date): number {
  const epoch = Math.floor(typeof at === 'number' ? at : at.getTime())
  if (!Number.isSafeInteger(epoch) || epoch < 0) throw new Error('Photo time is not a non-negative whole millisecond')
  return epoch
}

/** The earliest `CONNECTING_PHOTO_DAYS` days of one word's row: the ledger's bound. */
function earliestDays(days: Readonly<Record<string, number>>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const day of Object.keys(days).sort().slice(0, CONNECTING_PHOTO_DAYS)) out[day] = days[day]!
  return out
}

// ── Recording photos ─────────────────────────────────────────────────────────

/**
 * One photo of one word, taken at `at` in `zone`. Pure and add-only: the day
 * is added if new, an earlier first-photo time is kept, and a photo that
 * changes nothing hands back the same ledger object. A row keeps only its
 * earliest `CONNECTING_PHOTO_DAYS` days (see `PhotoLedger`), so a photo on a
 * day after a full row's last day changes nothing either. `at` goes through
 * `photoEpoch`: floored to a whole millisecond; a time that is then not a
 * non-negative safe integer throws. This is the function the running game
 * (card CW-05) calls with its results; the store action
 * `useJourney.getState().recordPhotos` wraps it.
 */
export function recordPhoto(photos: PhotoLedger, wordId: string, at: number | Date, zone: DayZone): PhotoLedger {
  if (typeof wordId !== 'string' || wordId.trim().length === 0) throw new Error('Photo of no word')
  const epoch = photoEpoch(at)
  const day = localDayKey(epoch, zone)
  const days = photos[wordId] ?? {}
  const first = days[day]
  if (first !== undefined && first <= epoch) return photos
  if (first === undefined) {
    const kept = Object.keys(days).sort()
    if (kept.length >= CONNECTING_PHOTO_DAYS && day > kept[CONNECTING_PHOTO_DAYS - 1]!) return photos
  }
  return { ...photos, [wordId]: earliestDays({ ...days, [day]: epoch }) }
}

/**
 * Several photos at one instant. The day comes from `at`, so a caller with
 * per-answer times calls this once per time (or `recordPhoto` per answer)
 * rather than stamping a run's answers with its end.
 */
export function recordPhotos(photos: PhotoLedger, wordIds: readonly string[], at: number | Date, zone: DayZone): PhotoLedger {
  let next = photos
  for (const id of wordIds) next = recordPhoto(next, id, at, zone)
  return next
}

/**
 * Two ledgers folded together without costing a mark: the union of days per
 * word, keeping the earlier first-photo time where both have one, then the
 * earliest `CONNECTING_PHOTO_DAYS` days of each row (see `PhotoLedger`). The
 * kept row has at least as many days as either side, up to three, so every
 * mark either side had survives. The backup merge uses it (`mergeSnapshot`
 * and `mergeJourney`). The v1 rescue does not touch photos at all: a v1 save
 * predates them, and the live ledger is left as it is, which is why photos
 * survive the rescue.
 */
export function mergePhotoLedgers(a: PhotoLedger, b: PhotoLedger): PhotoLedger {
  const out: Record<string, Record<string, number>> = {}
  for (const [id, days] of Object.entries(a)) out[id] = { ...days }
  for (const [id, days] of Object.entries(b)) {
    const mine = out[id] ?? (out[id] = {})
    for (const [day, at] of Object.entries(days)) mine[day] = Math.min(mine[day] ?? at, at)
  }
  for (const id of Object.keys(out)) out[id] = earliestDays(out[id]!)
  return out
}

/** The local days a word was photographed on, sorted oldest first: the earliest three at most. */
export function photoDays(photos: PhotoLedger, wordId: string): readonly string[] {
  return Object.keys(photos[wordId] ?? {}).sort()
}

/** Any photo at all — the board word's photo mark. */
export function hasPhoto(photos: PhotoLedger, wordId: string): boolean {
  return Object.keys(photos[wordId] ?? {}).length > 0
}

// ── Reading marks ────────────────────────────────────────────────────────────

export function boardWordMarks(wordId: string, stats: WordStats | undefined, photos: PhotoLedger): BoardWordMarks {
  const photo = hasPhoto(photos, wordId)
  const guess = (stats?.greenByGuess ?? 0) >= 1
  const clue = (stats?.greenByClue ?? 0) >= 1
  const earned = (photo ? 1 : 0) + (guess ? 1 : 0) + (clue ? 1 : 0)
  return { kind: 'board', photo, guess, clue, earned, collected: earned >= MARKS_TO_COLLECT }
}

export function connectingWordMarks(wordId: string, photos: PhotoLedger): ConnectingWordMarks {
  const days = photoDays(photos, wordId)
  const earned = Math.min(MARKS_TO_COLLECT, days.length)
  return { kind: 'connecting', photoDays: days, earned, collected: days.length >= CONNECTING_PHOTO_DAYS }
}

export function wordMarks(word: { readonly id: string; readonly kind: WordKind }, stats: WordStats | undefined, photos: PhotoLedger): WordMarks {
  return word.kind === 'board' ? boardWordMarks(word.id, stats, photos) : connectingWordMarks(word.id, photos)
}

/** Collected by the three-mark model. Not `progress.isCollected`, which is the pre-café two-mark reader. */
export function isCollectedByMarks(word: { readonly id: string; readonly kind: WordKind }, stats: WordStats | undefined, photos: PhotoLedger): boolean {
  return wordMarks(word, stats, photos).collected
}

export interface MarkCounts {
  readonly total: number
  /** Words at three marks: the suitcase lid's "Collected: n of N". */
  readonly collected: number
  /** Sum of marks earned over every word, out of `total * MARKS_TO_COLLECT`. */
  readonly earned: number
}

export function countMarks(
  words: readonly { readonly id: string; readonly kind: WordKind }[],
  srs: SrsMap,
  photos: PhotoLedger,
): MarkCounts {
  let collected = 0
  let earned = 0
  for (const word of words) {
    const marks = wordMarks(word, srs[word.id], photos)
    earned += marks.earned
    if (marks.collected) collected++
  }
  return { total: words.length, collected, earned }
}
