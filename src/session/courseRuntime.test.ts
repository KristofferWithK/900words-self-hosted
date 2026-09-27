import { expect, it } from 'vitest'
import { CITY1_REQUIRED_BOARD_MANIFEST, CITY1_REQUIRED_BOARDS, GERMAN_CITY1_REQUIRED_BOARDS } from '../data/city1RequiredBoardManifest'
import { emptyProgressFacts } from '../progression/facts'
import { boardKey } from '../progression/identity'
import { initialCourseSessions, nextRequiredBoard, validateCourseSessions, CITY1_REQUIRED_SET, requiredSetForCourse } from './courseRuntime'

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
  expect(CITY1_REQUIRED_BOARDS.at(99).identity.authoredBoardId).toBe('bank_121')
  expect(() => CITY1_REQUIRED_BOARDS.at(100)).toThrow('Unknown')
})

it('keeps German City 1 as a separate owner-authorized 150-board course set', () => {
  const german = requiredSetForCourse('de')
  expect(GERMAN_CITY1_REQUIRED_BOARDS.count).toBe(150)
  expect(GERMAN_CITY1_REQUIRED_BOARDS.cityId).toBe('flensburg')
  expect(GERMAN_CITY1_REQUIRED_BOARDS.setVersion).toBe('city1-german-city1-playtest-v1')
  expect(german.courseId).toBe('de')
  expect(german.boards).toHaveLength(150)
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

it('completed primary loss is consumed by validation and next-board selection without inventing a tier', () => {
  const first = CITY1_REQUIRED_SET.boards[0]
  const facts = { ...emptyProgressFacts(), completedLosses: { [boardKey(first)]: { board: first, firstPrimary: true } } }
  const sessions = initialCourseSessions(facts)
  expect(sessions.continuation.remainingBoardKeys[0]).not.toBe(boardKey(first))
  expect(validateCourseSessions(sessions, facts)).toEqual(sessions)
  expect(nextRequiredBoard(sessions, facts)).toEqual(CITY1_REQUIRED_SET.boards[1])
  expect(facts.boards[boardKey(first)]).toBeUndefined()
})
