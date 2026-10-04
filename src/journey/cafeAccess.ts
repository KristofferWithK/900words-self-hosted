import { ACTIVE } from '../lang/active'
import type { LanguageCode } from '../lang/types'
import { emptyProgressFacts } from '../progression/facts'
import { boardKey } from '../progression/identity'
import type { BoardIdentity, PrimaryContinuation, ProgressFacts, RequiredBoardSet } from '../progression/types'
import { requiredSetForCourse } from '../session/courseRuntime'
import { useJourney } from '../stores/journeyStore'
import { SESSION_KEY, SETTLEMENT_KEY, validatedLedger } from '../stores/settlementStorage'
import { cafesOf, findsFor, isCafeLaunchable, summarizeCafes, type AlsoFound, type Cafe, type CafeSummary } from './cafes'
import type { DayZone } from './wordMarks'

/**
 * The café rules (journey/cafes.ts) wired to the app: which board set is a
 * city's cafés, what the settled facts say was played, which board the
 * board game's queue deals next, and the live finds in the journey store.
 * Screens read cafés through `cafesForCity`; the board game's launch point
 * asks `cafeLaunchRefused`; the run's results sink records photos with
 * `recordRunPhotoNow`.
 */

/**
 * THE ONE SWITCH for the café gate: whether the board game refuses to deal a
 * required board whose café no walk has found.
 *
 * ON since CW-13: Home has its Sightseeing door (CW-10) and the first session
 * walks before it plays, finding the first café on the way (CW-13,
 * src/onboarding/firstCafe.ts for the paths that skip the walk). Every launch
 * point handles a refusal (`dealOrFallBack`, ui/cafeDeal.ts).
 *
 * Only the refusal is switched. Café finds, photos, the daily run count and
 * slips are live whatever it says, so a player's walks count from day one.
 */
export const CAFE_GATE_ENABLED: boolean = true

let gateOverride: boolean | null = null

/** Whether the launch gate refuses unfound cafés now. */
export function cafeGateEnabled(): boolean {
  return gateOverride ?? CAFE_GATE_ENABLED
}

/**
 * TESTS ONLY: run the gate on (true), off (false), or as shipped (null).
 * No app module calls this.
 */
export function overrideCafeGateForTests(enabled: boolean | null): void {
  gateOverride = enabled
}

/**
 * A city's cafés: its required board set, in its fixed order. Only Sønderborg
 * (route index 0) has one; every other city has no cafés yet and finds none.
 */
export function cafeSetFor(cityIndex: number, course: LanguageCode = ACTIVE.code): RequiredBoardSet | null {
  if (cityIndex !== 0) return null
  try {
    return requiredSetForCourse(course)
  } catch {
    return null
  }
}

/**
 * The settled progress facts the board game wrote: the one authority for
 * "played". Empty when nothing was ever settled; null when the ledger is there
 * but cannot be read.
 */
export function readSettledFacts(storage?: Pick<Storage, 'getItem'>): ProgressFacts | null {
  const store = storage ?? (typeof localStorage === 'undefined' ? null : localStorage)
  if (!store) return emptyProgressFacts()
  try {
    const raw = store.getItem(SETTLEMENT_KEY)
    if (raw === null) return emptyProgressFacts()
    return validatedLedger(raw).ledger.facts
  } catch {
    return null
  }
}

/**
 * The board a queue anchored out of the set's order deals next: the head of
 * a continuation whose `source` is not 'canonical' (a legacy round anchored
 * by the save migration, or the round on the table when a superseded set was
 * rebased). The deal order is the board game's and is not changed; that
 * board simply counts as found, so the café gate never stands in its way.
 */
export function anchoredHeadId(continuation: PrimaryContinuation | null | undefined, set: RequiredBoardSet): string | null {
  if (!continuation || continuation.source === 'canonical') return null
  const head = continuation.remainingBoardKeys[0]
  if (!head) return null
  return set.boards.find((board) => boardKey(board) === head)?.authoredBoardId ?? null
}

let sessionsRead: { raw: string; course: string; continuation: PrimaryContinuation | null } | null = null

/**
 * The saved queue of `course`, read lightly for the café readers (the board
 * game validates it fully wherever it deals, and hands its own to the gate).
 * Null when there is none or it cannot be read.
 */
function savedContinuation(course: LanguageCode, storage?: Pick<Storage, 'getItem'>): PrimaryContinuation | null {
  const store = storage ?? (typeof localStorage === 'undefined' ? null : localStorage)
  if (!store) return null
  try {
    const raw = store.getItem(SESSION_KEY)
    if (raw === null) return null
    if (sessionsRead?.raw === raw && sessionsRead.course === course) return sessionsRead.continuation
    const continuation = (JSON.parse(raw)?.state?.byCourse?.[course]?.continuation ?? null) as PrimaryContinuation | null
    const usable = continuation && typeof continuation.source === 'string' && Array.isArray(continuation.remainingBoardKeys) ? continuation : null
    sessionsRead = { raw, course, continuation: usable }
    return usable
  } catch {
    return null
  }
}

function alsoFoundFor(set: RequiredBoardSet, continuation: PrimaryContinuation | null | undefined): AlsoFound {
  const id = anchoredHeadId(continuation, set)
  return id ? new Set([id]) : new Set()
}

export interface CityCafes {
  readonly set: RequiredBoardSet
  readonly cafes: readonly Cafe[]
  readonly summary: CafeSummary
}

/** Every café of a city with its state, and the count toward the next find; null for a city with no cafés. */
export function cafesForCity(
  cityIndex: number = useJourney.getState().cityIndex,
  facts: ProgressFacts | null = readSettledFacts(),
  course: LanguageCode = ACTIVE.code,
): CityCafes | null {
  const set = cafeSetFor(cityIndex, course)
  if (!set) return null
  const finds = findsFor(useJourney.getState().cafes ?? {}, set)
  const cafes = cafesOf(set.boards, finds, facts, alsoFoundFor(set, savedContinuation(course)))
  return { set, cafes, summary: summarizeCafes(cafes, finds) }
}

/**
 * Whether a required board's café is open to play: found by a walk, played,
 * or the head of an anchored queue (`continuation`, when the caller has the
 * validated one; otherwise the saved one is read). A board of no café set
 * (another city, a board outside the set) is not this rule's to refuse.
 * The rule only: it does not ask the switch (`cafeLaunchRefused` does).
 */
export function mayLaunchCafe(
  board: BoardIdentity,
  facts: ProgressFacts | null = readSettledFacts(),
  continuation?: PrimaryContinuation | null,
): boolean {
  const set = board.courseId === 'da' || board.courseId === 'de' ? cafeSetFor(0, board.courseId) : null
  if (!set || set.cityId !== board.cityId || !set.boards.some((b) => b.authoredBoardId === board.authoredBoardId)) return true
  const queue = continuation === undefined ? savedContinuation(board.courseId) : continuation
  return isCafeLaunchable(board, findsFor(useJourney.getState().cafes ?? {}, set), facts, alsoFoundFor(set, queue))
}

/** The launch gate: true when the switch is on and the board's café is not open to play. */
export function cafeLaunchRefused(board: BoardIdentity, facts: ProgressFacts | null, continuation?: PrimaryContinuation | null): boolean {
  return cafeGateEnabled() && !mayLaunchCafe(board, facts, continuation)
}

/**
 * One right answer of a run, recorded in one journey write: the photo mark of
 * `wordId` (null: none, as for a right article) and, when `findsCafes`, the
 * count toward the next café of the city the player stands in. Café counting
 * is skipped when the settled facts cannot be read: without knowing what was
 * played, the waiting count would be a guess. Returns the café found, or null.
 */
export function recordRunPhotoNow(
  photo: { readonly wordId: string | null; readonly at: number; readonly findsCafes: boolean; readonly zone?: DayZone },
  cityIndex: number = useJourney.getState().cityIndex,
): Cafe | null {
  const set = photo.findsCafes ? cafeSetFor(cityIndex) : null
  const facts = set ? readSettledFacts() : null
  const cafe = set && facts ? { city: set, boards: set.boards, facts, alsoFound: alsoFoundFor(set, savedContinuation(set.courseId)) } : undefined
  if (photo.wordId === null && !cafe) return null
  return useJourney.getState().recordRunPhoto({
    wordId: photo.wordId,
    at: photo.at,
    ...(photo.zone === undefined ? {} : { zone: photo.zone }),
    ...(cafe ? { cafe } : {}),
  })
}
