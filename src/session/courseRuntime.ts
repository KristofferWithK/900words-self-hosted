import {
  DANISH_CITY1_REQUIRED_BOARDS,
  GERMAN_CITY1_REQUIRED_BOARDS,
} from '../data/city1RequiredBoardManifest'
import { ACTIVE } from '../lang/active'
import { createPrimaryContinuation } from '../progression/facts'
import { boardKey, firstCompletionKey, requiredSetKey } from '../progression/identity'
import { matchesAuthoredContent } from '../progression/rules'
import type { AuthoredBoardContent, BoardIdentity, CourseSessions, ProgressFacts, RequiredBoardSet } from '../progression/types'
import type { LanguageCode } from '../lang/types'

const registries = { da: DANISH_CITY1_REQUIRED_BOARDS, de: GERMAN_CITY1_REQUIRED_BOARDS }

/** Content identity comes from a course-specific manifest, never the live game. */
export function requiredSetForCourse(courseId: LanguageCode): RequiredBoardSet {
  const registry = registries[courseId]
  return {
    courseId,
    cityId: registry.cityId,
    setVersion: registry.setVersion,
    boards: registry.identities.map((board) => ({ ...board, courseId })),
  }
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
