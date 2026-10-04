import {
  DANISH_CITY1_REQUIRED_BOARDS,
  DANISH_CITY1_REQUIRED_BOARDS_V1,
  GERMAN_CITY1_REQUIRED_BOARDS,
  GERMAN_CITY1_REQUIRED_BOARDS_V1,
  type City1RequiredBoardRegistry,
} from '../data/city1RequiredBoardManifest'
import { ACTIVE } from '../lang/active'
import { createPrimaryContinuation } from '../progression/facts'
import { boardKey, cityKey, firstCompletionKey, requiredSetKey } from '../progression/identity'
import { matchesAuthoredContent } from '../progression/rules'
import type { AttemptSlot, AuthoredBoardContent, BoardIdentity, CourseSessions, ProgressFacts, RequiredBoardSet } from '../progression/types'
import type { LanguageCode } from '../lang/types'

const registries = { da: DANISH_CITY1_REQUIRED_BOARDS, de: GERMAN_CITY1_REQUIRED_BOARDS }
/** Superseded frozen sets, oldest first. Read-only provenance; never dealt from. */
const historicalRegistries: Record<LanguageCode, readonly City1RequiredBoardRegistry[]> = {
  da: [DANISH_CITY1_REQUIRED_BOARDS_V1],
  de: [GERMAN_CITY1_REQUIRED_BOARDS_V1],
}

const setOf = (courseId: LanguageCode, registry: City1RequiredBoardRegistry): RequiredBoardSet => ({
  courseId,
  cityId: registry.cityId,
  setVersion: registry.setVersion,
  boards: registry.identities.map((board) => ({ ...board, courseId })),
})

/** Content identity comes from a course-specific manifest, never the live game. */
export function requiredSetForCourse(courseId: LanguageCode): RequiredBoardSet {
  return setOf(courseId, registries[courseId])
}

/**
 * Every frozen set this course has ever had, superseded ones first and the
 * current one last. Saved facts may name any of them (a first completion keeps
 * the set it was earned against), so a reader that validates provenance asks
 * this; anything that deals or counts the course asks `requiredSetForCourse`.
 */
export function knownRequiredSetsForCourse(courseId: LanguageCode): readonly RequiredBoardSet[] {
  return [...historicalRegistries[courseId].map((registry) => setOf(courseId, registry)), requiredSetForCourse(courseId)]
}

export const CITY1_REQUIRED_SET = requiredSetForCourse(ACTIVE.code)

export function requiredContent(board: BoardIdentity): AuthoredBoardContent {
  const registry = registries[board.courseId]
  const requiredSet = requiredSetForCourse(board.courseId)
  const entry = registry.lookup(board.authoredBoardId)
  const identity = requiredSet.boards.find((item) => boardKey(item) === boardKey(board))
  if (!identity) throw new Error('Unknown required board identity')
  return { board: identity, wordIds: entry.board.wordIds, playerGreenIds: entry.board.playerGreenIds, aiGreenIds: entry.board.aiGreenIds }
}

export function initialCourseSessions(facts: ProgressFacts, courseId: LanguageCode = ACTIVE.code): CourseSessions {
  return { continuation: createPrimaryContinuation(requiredSetForCourse(courseId), facts), primary: null, replay: null, activeSlot: null }
}

/** Reject a corrupted/shortened queue before allowing another board to open. */
export function validateCourseSessions(sessions: CourseSessions, facts: ProgressFacts, requiredSet = CITY1_REQUIRED_SET): CourseSessions {
  const keys = requiredSet.boards.map(boardKey)
  const remaining = sessions.continuation.remainingBoardKeys
  if (requiredSetKey(sessions.continuation.requiredSet) !== requiredSetKey(requiredSet) ||
    new Set(remaining).size !== remaining.length || remaining.some((key) => !keys.includes(key)) ||
    requiredSet.boards.some((board) => !facts.firstPrimaryCompletions[firstCompletionKey(board)] && !facts.completedLosses[boardKey(board)] && !remaining.includes(boardKey(board)))) {
    throw new Error('Invalid primary continuation')
  }
  for (const slot of [sessions.primary, sessions.replay]) {
    if (!slot) continue
    if (!matchesAuthoredContent(slot.game, requiredContent(slot.board))) throw new Error('Saved board content mismatch')
    if (slot.origin === 'primary' && slot.game.phase !== 'finished' && remaining[0] !== boardKey(slot.board)) throw new Error('Primary board is not next')
    if (slot.origin === 'replay' && !facts.boards[boardKey(slot.board)] && !facts.completedLosses[boardKey(slot.board)]) throw new Error('Replay requires a completed board')
  }
  return sessions
}

/** Whether a saved queue names a different set from `required` (any set at all). */
export function needsRebase(sessions: CourseSessions, required: RequiredBoardSet): boolean {
  return requiredSetKey(sessions.continuation.requiredSet) !== requiredSetKey(required)
}

/**
 * Whether a saved queue names a frozen set this course has superseded, and so
 * is to be rebased. Only a known predecessor qualifies: a queue naming any other
 * set is not this migration's to touch, and keeps failing validation as before.
 */
export function isSupersededQueue(sessions: CourseSessions, courseId: LanguageCode): boolean {
  const key = requiredSetKey(sessions.continuation.requiredSet)
  return historicalRegistries[courseId].some((registry) => requiredSetKey(setOf(courseId, registry)) === key)
}

export interface RebasedCourseSessions {
  readonly sessions: CourseSessions
  /** Unfinished or unsettled rounds on boards the new set dropped: archived, not resumable. */
  readonly retired: readonly AttemptSlot[]
}

/**
 * Move a saved queue from a superseded frozen set of the same city onto the
 * current one, once. Board identity does not include the set, so nothing
 * earned moves or is lost: a board completed under the old set is completed
 * under the new one if both hold it, and its postcards stay either way. What
 * changes is the queue, which becomes the new set's display order minus every
 * board already completed or lost.
 *
 * The round on the table decides one thing more. On a board the new set keeps,
 * an unfinished round (or a finished one whose receipt has not been written) is
 * anchored at the front, so it resumes and settles as the next board. On a
 * board the new set dropped, it cannot settle as a required board at all, so it
 * is retired and returned for the caller to archive; a finished round that was
 * already settled has nothing left to lose and is simply let go, its receipt
 * untouched in the ledger. A replay on a dropped board goes the same way.
 *
 * Call only while no settlement effect is pending: a durable receipt's queue
 * effect was written against the old queue and has to land on it first.
 */
export function rebaseCourseSessions(sessions: CourseSessions, facts: ProgressFacts, required: RequiredBoardSet): RebasedCourseSessions {
  if (!needsRebase(sessions, required)) return { sessions, retired: [] }
  if (cityKey(sessions.continuation.requiredSet) !== cityKey(required)) throw new Error('A queue cannot move to another city')
  const keys = new Set(required.boards.map(boardKey))
  const settled = (board: BoardIdentity) =>
    !!facts.firstPrimaryCompletions[firstCompletionKey(board)] || !!facts.completedLosses[boardKey(board)] || !!facts.boards[boardKey(board)]
  const retired: AttemptSlot[] = []
  let anchor: BoardIdentity | undefined
  const carry = (slot: AttemptSlot | null): AttemptSlot | null => {
    if (!slot) return null
    const open = slot.game.phase !== 'finished' || !settled(slot.board)
    if (keys.has(boardKey(slot.board))) {
      if (slot.origin === 'primary' && open) anchor = slot.board
      return slot
    }
    if (open) retired.push(slot)
    return null
  }
  const primary = carry(sessions.primary)
  const replay = carry(sessions.replay)
  const activeSlot = sessions.activeSlot === 'primary' && primary ? 'primary' : sessions.activeSlot === 'replay' && replay ? 'replay' : null
  const rebased: CourseSessions = {
    continuation: createPrimaryContinuation(required, facts, anchor, true),
    primary, replay, activeSlot,
  }
  return { sessions: validateCourseSessions(rebased, facts, required), retired }
}

export function nextRequiredBoard(sessions: CourseSessions, facts: ProgressFacts, requiredSet = CITY1_REQUIRED_SET): BoardIdentity | null {
  validateCourseSessions(sessions, facts, requiredSet)
  return sessions.continuation.remainingBoardKeys.map((key) => requiredSet.boards.find((board) => boardKey(board) === key)!)
    .find((board) => !facts.firstPrimaryCompletions[firstCompletionKey(board)] && !facts.completedLosses[boardKey(board)]) ?? null
}

/** Also used by delayed UI actions; seed/layout are deliberately not owners. */
export interface RuntimeEventOwner {
  readonly attemptId: string | null
  readonly slot: 'primary' | 'replay' | null
  readonly generation: number
}

export function sameEventOwner(current: RuntimeEventOwner, incoming: RuntimeEventOwner): boolean {
  return current.attemptId === incoming.attemptId && current.slot === incoming.slot && current.generation === incoming.generation
}
