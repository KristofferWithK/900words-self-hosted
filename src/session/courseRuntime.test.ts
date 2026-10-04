import { expect, it } from 'vitest'
import {
  CITY1_REQUIRED_BOARD_MANIFEST, CITY1_REQUIRED_BOARDS, DANISH_CITY1_REQUIRED_BOARDS, GERMAN_CITY1_REQUIRED_BOARDS,
  GERMAN_CITY1_REQUIRED_BOARDS_V1,
} from '../data/city1RequiredBoardManifest'
import { createPrimaryContinuation, emptyProgressFacts } from '../progression/facts'
import { boardKey, firstCompletionKey } from '../progression/identity'
import {
  initialCourseSessions, isSupersededQueue, knownRequiredSetsForCourse, nextRequiredBoard, rebaseCourseSessions, validateCourseSessions,
  CITY1_REQUIRED_SET, requiredSetForCourse,
} from './courseRuntime'

it('the runtime manifest exports public identity/validation fields without private provenance', () => {
  expect(Object.keys(CITY1_REQUIRED_BOARD_MANIFEST).sort()).toEqual([
    'schemaVersion', 'kind', 'status', 'boardSetVersion', 'learnerCourse', 'stableCityId',
    'requiredBoardCount', 'requiredBoards', 'displayOrder',
  ].sort())
  const publicValue = JSON.stringify(CITY1_REQUIRED_BOARD_MANIFEST)
  expect(publicValue).not.toContain('proxy/')
  expect(publicValue).not.toContain('association-index.')
  expect(publicValue).not.toContain('lcsi.')
  expect(CITY1_REQUIRED_BOARDS.count).toBe(100)
  expect(CITY1_REQUIRED_BOARDS.at(99).identity.authoredBoardId).toBe(CITY1_REQUIRED_BOARD_MANIFEST.displayOrder[99])
  expect(() => CITY1_REQUIRED_BOARDS.at(100)).toThrow('Unknown')
})

it('plays German City 1 as the Danish course, board for board, in its own owner-authorized set', () => {
  const german = requiredSetForCourse('de')
  expect(GERMAN_CITY1_REQUIRED_BOARDS.count).toBe(100)
  expect(GERMAN_CITY1_REQUIRED_BOARDS.cityId).toBe('flensburg')
  expect(GERMAN_CITY1_REQUIRED_BOARDS.setVersion).toBe('city1-german-city1-playtest-v2')
  expect(GERMAN_CITY1_REQUIRED_BOARDS.idsInDisplayOrder).toEqual(DANISH_CITY1_REQUIRED_BOARDS.idsInDisplayOrder)
  expect(german.courseId).toBe('de')
  expect(german.boards).toHaveLength(100)
  expect(german.boards.every((board) => board.courseId === 'de' && board.cityId === 'flensburg')).toBe(true)
  expect(german.boards.map((board) => board.authoredBoardId)).toEqual(
    GERMAN_CITY1_REQUIRED_BOARDS.idsInDisplayOrder,
  )
  const facts = emptyProgressFacts()
  const sessions = initialCourseSessions(facts, 'de')
  expect(nextRequiredBoard(sessions, facts, german)).toEqual(german.boards[0])
  expect(validateCourseSessions(sessions, facts, german)).toEqual(sessions)
  expect(CITY1_REQUIRED_SET.courseId).toBe('da')
})

it('moves a German queue from the 150-board playtest set onto the Danish course order', () => {
  const [v1] = knownRequiredSetsForCourse('de')
  const v2 = requiredSetForCourse('de')
  expect(v1!.setVersion).toBe(GERMAN_CITY1_REQUIRED_BOARDS_V1.setVersion)
  expect(v1!.boards).toHaveLength(150)
  // Twelve boards played on the old German course, as a phone would hold them.
  const played = v1!.boards.slice(0, 12)
  const set = { courseId: v1!.courseId, cityId: v1!.cityId, setVersion: v1!.setVersion }
  const facts = {
    ...emptyProgressFacts(),
    boards: Object.fromEntries(played.map((board) => [boardKey(board), { board, best: 'bronze' as const, claims: [] }])),
    firstPrimaryCompletions: Object.fromEntries(played.map((board) => [firstCompletionKey(board), { board, requiredSet: set }])),
  }
  const old = { continuation: createPrimaryContinuation(v1!, facts), primary: null, replay: null, activeSlot: null }
  expect(isSupersededQueue(old, 'de')).toBe(true)
  const { sessions, retired } = rebaseCourseSessions(old, facts, v2)
  const playedKeys = new Set(played.map(boardKey))
  expect(retired).toEqual([])
  expect(sessions.continuation.requiredSet.setVersion).toBe('city1-german-city1-playtest-v2')
  expect(sessions.continuation.remainingBoardKeys).toEqual(v2.boards.map(boardKey).filter((key) => !playedKeys.has(key)))
  expect(validateCourseSessions(sessions, facts, v2)).toEqual(sessions)
})

it('completed primary loss is consumed by validation and next-board selection without inventing a tier', () => {
  const first = CITY1_REQUIRED_SET.boards[0]
  const facts = { ...emptyProgressFacts(), completedLosses: { [boardKey(first)]: { board: first, firstPrimary: true } } }
  const sessions = initialCourseSessions(facts)
  expect(sessions.continuation.remainingBoardKeys[0]).not.toBe(boardKey(first))
  expect(validateCourseSessions(sessions, facts)).toEqual(sessions)
  expect(nextRequiredBoard(sessions, facts)).toEqual(CITY1_REQUIRED_SET.boards[1])
  expect(facts.boards[boardKey(first)]).toBeUndefined()
})
