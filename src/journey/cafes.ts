import { boardKey, cityKey, firstCompletionKey } from '../progression/identity'
import type { BoardIdentity, CityIdentity, ProgressFacts } from '../progression/types'
import { photoEpoch } from './wordMarks'

/**
 * CAFÉ FINDS (docs/roadmap/cafe-world.md, sections 5 and 9 O1; card CW-04).
 *
 * Each required board of a city is a café. A café is UNFOUND, FOUND (waiting
 * unplayed) or PLAYED, and its puzzle cannot be started before it is found.
 * Cafés are found on Sightseeing walks, in the fixed order of the city's
 * required board set (`requiredSetForCourse(...).boards`), at this pace (O1):
 *
 *   - the first café of a city after 5 photos;
 *   - after that, the next café needs 10 / 20 / 30 / 40 photos while
 *     0 / 1 / 2 / 3-or-more found cafés are waiting unplayed.
 *
 * What is stored, per city (`cityKey`), is only what a walk did:
 *   - `found`: authored board id -> epoch ms of the find. Add-only; the first
 *     find wins (a merge keeps the earlier time).
 *   - `toward`: photos counted toward the next find since the last one.
 *
 * PLAYED is never stored here. It is read from the settled progress facts the
 * board game already writes (a first primary completion, a completed loss or
 * a board best), so there is one authority for "played" and nothing here can
 * contradict it. A played board is also FOUND, whether or not a walk found it:
 * that is the honest reading of a save from before the café world, whose
 * boards were played without walking (the owner's own save). Nothing is
 * written to make that true; it is how the state is read.
 *
 * Pure: no store, no clock, no storage. `cafeAccess.ts` wires it to the app.
 */

/** Photos that find a city's first café. */
export const FIRST_CAFE_PHOTOS = 5
/** Photos for each next café, by found cafés waiting unplayed: 0, 1, 2, 3 or more. */
export const NEXT_CAFE_PHOTOS = [10, 20, 30, 40] as const

/** What a walk has done in one city. */
export interface CafeFinds {
  /** Authored board id -> epoch ms of the find. */
  readonly found: Readonly<Record<string, number>>
  /** Photos counted toward the next find since the last one. */
  readonly toward: number
}

/** Café finds of every city, by `cityKey`. */
export type CafeFindsByCity = Readonly<Record<string, CafeFinds>>

export const emptyCafeFinds = (): CafeFinds => ({ found: {}, toward: 0 })

export type CafeState = 'unfound' | 'found' | 'played'

export interface Cafe {
  readonly board: BoardIdentity
  /** Place in the required order, from 0. */
  readonly index: number
  readonly state: CafeState
  /** When a walk found it; null for a café played without one, and for an unfound café. */
  readonly foundAt: number | null
}

/**
 * Photos the next find needs, given the cafés already found in the city
 * (played ones included) and how many of those are waiting unplayed.
 */
export function photosForNextCafe(foundCount: number, waiting: number): number {
  if (foundCount <= 0) return FIRST_CAFE_PHOTOS
  const step = Math.min(Math.max(0, Math.floor(waiting)), NEXT_CAFE_PHOTOS.length - 1)
  return NEXT_CAFE_PHOTOS[step]!
}

/**
 * The board game's own evidence that a board was played: a first primary
 * completion, a completed loss, or a ranked best from any completed attempt.
 * `null` facts (the ledger could not be read) say nothing was played.
 */
export function isBoardPlayed(facts: ProgressFacts | null, board: BoardIdentity): boolean {
  if (!facts) return false
  const key = boardKey(board)
  return !!facts.firstPrimaryCompletions[firstCompletionKey(board)] || !!facts.completedLosses[key] || !!facts.boards[key]
}

/** The finds of one city, or none. */
export function findsFor(all: CafeFindsByCity, city: CityIdentity): CafeFinds {
  return all[cityKey(city)] ?? emptyCafeFinds()
}

/**
 * Board ids that count as found without a walk, besides played boards: the
 * head of a board-game queue anchored out of the set's order (a legacy round
 * or a rebase put it first; see `cafeAccess.ts#anchoredHeadId`). The board
 * game deals that board next, so it is a café waiting to be played. Never
 * stored; read from the queue like "played" is read from the facts.
 */
export type AlsoFound = ReadonlySet<string>
const NONE: AlsoFound = new Set()

/** Every café of a city in the required order, with its state. */
export function cafesOf(boards: readonly BoardIdentity[], finds: CafeFinds, facts: ProgressFacts | null, alsoFound: AlsoFound = NONE): Cafe[] {
  return boards.map((board, index) => {
    const at = finds.found[board.authoredBoardId]
    const foundAt = typeof at === 'number' ? at : null
    const state: CafeState = isBoardPlayed(facts, board) ? 'played'
      : foundAt !== null || alsoFound.has(board.authoredBoardId) ? 'found' : 'unfound'
    return { board, index, state, foundAt }
  })
}

export interface CafeSummary {
  /** Cafés found, played ones included. */
  readonly found: number
  /** Found and not yet played. */
  readonly waiting: number
  readonly played: number
  readonly total: number
  /** The café the next find will be, or null when every café is found. */
  readonly next: Cafe | null
  /** Photos counted toward it. */
  readonly toward: number
  /** Photos it needs in all (`photosForNextCafe`), or null when there is none. */
  readonly needed: number | null
}

export function summarizeCafes(cafes: readonly Cafe[], finds: CafeFinds): CafeSummary {
  const played = cafes.filter((c) => c.state === 'played').length
  const waiting = cafes.filter((c) => c.state === 'found').length
  const found = played + waiting
  const next = cafes.find((c) => c.state === 'unfound') ?? null
  return {
    found,
    waiting,
    played,
    total: cafes.length,
    next,
    toward: next ? finds.toward : 0,
    needed: next ? photosForNextCafe(found, waiting) : null,
  }
}

/** A café's puzzle may start once it is found; a played one may always be played again. */
export function isCafeLaunchable(board: BoardIdentity, finds: CafeFinds, facts: ProgressFacts | null, alsoFound: AlsoFound = NONE): boolean {
  return isBoardPlayed(facts, board) || typeof finds.found[board.authoredBoardId] === 'number' || alsoFound.has(board.authoredBoardId)
}

export interface CafePhotoOutcome {
  readonly finds: CafeFinds
  /** The café this photo found, or null. */
  readonly found: Cafe | null
}

/**
 * Count one photo of a walk toward the next café. When the count reaches what
 * the next find needs, the next café in the required order is found at `at`
 * and the count starts again from nothing. One photo finds one café at most.
 * When every café is found, nothing changes and the same object comes back.
 *
 * The need is read at the photo, from the cafés waiting at that moment, so a
 * café played between two walks makes the next find nearer at once.
 *
 * `at` is stored as the photo ledger stores times (`photoEpoch`): floored to
 * a whole millisecond, and a time that is not a non-negative safe integer
 * throws rather than be stored where the schemas would refuse it.
 */
export function countCafePhoto(
  boards: readonly BoardIdentity[],
  finds: CafeFinds,
  facts: ProgressFacts | null,
  at: number,
  alsoFound: AlsoFound = NONE,
): CafePhotoOutcome {
  const time = photoEpoch(at)
  const cafes = cafesOf(boards, finds, facts, alsoFound)
  const summary = summarizeCafes(cafes, finds)
  if (!summary.next || summary.needed === null) return { finds, found: null }
  const toward = finds.toward + 1
  if (toward < summary.needed) return { finds: { found: finds.found, toward }, found: null }
  const id = summary.next.board.authoredBoardId
  return {
    finds: { found: { ...finds.found, [id]: time }, toward: 0 },
    found: { ...summary.next, state: 'found', foundAt: time },
  }
}

/**
 * Two records of one player's finds folded together without losing a find:
 * the union of found cafés, the earlier time where both have one. `toward`
 * is a count since the last find, so it comes from the side that has found
 * more (its count is the newer one); with as many finds on each side, the
 * larger count. Never more than either side really walked.
 */
export function mergeCafeFinds(a: CafeFindsByCity, b: CafeFindsByCity): CafeFindsByCity {
  const out: Record<string, CafeFinds> = {}
  for (const key of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    const left = a[key], right = b[key]
    if (!left || !right) {
      out[key] = (left ?? right)!
      continue
    }
    const found: Record<string, number> = { ...left.found }
    for (const [id, at] of Object.entries(right.found)) found[id] = Math.min(found[id] ?? at, at)
    const l = Object.keys(left.found).length, r = Object.keys(right.found).length
    const toward = l > r ? left.toward : r > l ? right.toward : Math.max(left.toward, right.toward)
    out[key] = { found, toward }
  }
  return out
}
