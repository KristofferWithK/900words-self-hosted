import { describe, expect, it } from 'vitest'
import cafes from '../data/city1-cafe-names.da.json'
import manifestV1 from '../data/city1-required-board-manifest.da.v1.json'
import { DANISH_CITY1_REQUIRED_BOARDS } from '../data/city1RequiredBoardManifest'
import { requiredSetForCourse } from '../session/courseRuntime'
import assignment from './city1-cafe-assignment.da.json'
import { cafeForBoard, cafeNameForBoard } from './cafeName'

// CW-08: the frozen board -> café table (src/cafe/city1-cafe-assignment.da.json).
describe('cafeNameForBoard (frozen assignment, CW-08)', () => {
  const danish = requiredSetForCourse('da')

  it('names board 01 Café Solen and board 100 after the last name, as the interim mapping did', () => {
    const first = DANISH_CITY1_REQUIRED_BOARDS.identityFor(DANISH_CITY1_REQUIRED_BOARDS.idsInDisplayOrder[0]!)
    const last = DANISH_CITY1_REQUIRED_BOARDS.identityFor(DANISH_CITY1_REQUIRED_BOARDS.idsInDisplayOrder[99]!)
    expect(cafeNameForBoard({ ...first, courseId: 'da' })).toBe('Café Solen')
    expect(cafeNameForBoard({ ...last, courseId: 'da' })).toBe(cafes.names[99]!.name)
  })

  it('gives every required Danish board one café, each name once, the same answer every time', () => {
    const named = danish.boards.map((board) => cafeNameForBoard(board))
    expect(named.every((name) => typeof name === 'string' && name.length > 0)).toBe(true)
    expect(new Set(named).size).toBe(danish.boards.length)
    expect(danish.boards.map((board) => cafeNameForBoard(board))).toEqual(named)
  })

  it('covers exactly the required set, and every café id is in the names file', () => {
    const ids = new Set(cafes.names.map((entry) => entry.id))
    expect(Object.keys(assignment.boards).sort()).toEqual([...DANISH_CITY1_REQUIRED_BOARDS.idsInDisplayOrder].sort())
    expect(Object.values(assignment.boards).every((id) => ids.has(id))).toBe(true)
    expect(new Set(Object.values(assignment.boards)).size).toBe(Object.keys(assignment.boards).length)
    expect(assignment.count).toBe(Object.keys(assignment.boards).length)
    expect(assignment.cityId).toBe(DANISH_CITY1_REQUIRED_BOARDS.cityId)
  })

  it('was made from the v2 display order, so no name a player has seen moved', () => {
    expect(assignment.assignedFrom).toBe(DANISH_CITY1_REQUIRED_BOARDS.setVersion)
    for (const [place, id] of DANISH_CITY1_REQUIRED_BOARDS.idsInDisplayOrder.entries()) {
      const board = danish.boards.find((entry) => entry.authoredBoardId === id)!
      expect(cafeNameForBoard(board)).toBe(cafes.names[place]!.name)
    }
  })

  it('is keyed by the board, not its revision: a revised board keeps its café', () => {
    const board = danish.boards[0]!
    expect(cafeForBoard({ ...board, contentRevision: 'a-later-revision' })).toEqual(cafeForBoard(board))
  })

  it('pins a few cafés by board id, so a reorder of the course cannot move them', () => {
    const at = (id: string) => cafeNameForBoard({ ...danish.boards[0]!, authoredBoardId: id })
    expect(at('bank_001')).toBe('Café Solen')
    expect(at('bank_036')).toBe('Café Månen')
    expect(at('bank_115')).toBe('Café Stjernen')
  })

  it('carries the signature item from the names file', () => {
    const cafe = cafeForBoard(danish.boards.find((b) => b.authoredBoardId === 'bank_001'))
    expect(cafe).toEqual({ id: 'cafe-solen', name: 'Café Solen', signatureItem: cafes.names[0]!.signatureItem })
  })

  it('has no name for no board, a retired v1 board, another city or a course without cafés (Flensburg)', () => {
    const board = danish.boards[0]!
    const retired = manifestV1.displayOrder.find((id) => !DANISH_CITY1_REQUIRED_BOARDS.has(id))!
    expect(retired).toBeTruthy()
    expect(cafeNameForBoard(null)).toBeNull()
    expect(cafeNameForBoard(undefined)).toBeNull()
    expect(cafeNameForBoard({ ...board, authoredBoardId: 'not-a-required-board' })).toBeNull()
    expect(cafeNameForBoard({ ...board, authoredBoardId: retired })).toBeNull()
    expect(cafeNameForBoard({ ...board, authoredBoardId: 'toString' })).toBeNull()
    expect(cafeNameForBoard({ ...board, cityId: 'another-city' })).toBeNull()
    expect(cafeNameForBoard({ ...board, courseId: 'de' })).toBeNull()
    for (const german of requiredSetForCourse('de').boards) expect(cafeNameForBoard(german)).toBeNull()
  })
})
