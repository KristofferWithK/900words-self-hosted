import { beforeEach, describe, expect, it } from 'vitest'

/**
 * The first session's first café (CW-13): a Skip, or a first walk that ended
 * before its fifth photo, still reaches a Home whose Café puzzle tag plays.
 * The café is found the way a walk finds it, and never a second one.
 */
const written = new Map<string, string>()
const storage = {
  getItem: (k: string) => written.get(k) ?? null,
  setItem: (k: string, v: string) => void written.set(k, v),
  removeItem: (k: string) => void written.delete(k),
}
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage } })
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })

const { useJourney } = await import('../stores/journeyStore')
const { cafesForCity, mayLaunchCafe } = await import('../journey/cafeAccess')
const { CITY1_REQUIRED_SET } = await import('../session/courseRuntime')
const { ensureFirstCafeFound, firstCafeName, firstFoundCafe } = await import('./firstCafe')
const { cafeNameForBoard } = await import('../cafe/cafeName')

const DA = JSON.stringify(['da', 'sonderborg'])
const first = CITY1_REQUIRED_SET.boards[0]!

beforeEach(() => {
  written.clear()
  useJourney.setState(useJourney.getInitialState())
})

describe('ensureFirstCafeFound', () => {
  it('finds the first café of a fresh profile, so its puzzle may launch', () => {
    expect(firstFoundCafe('da')).toBeNull()
    expect(mayLaunchCafe(first)).toBe(false)
    const cafe = ensureFirstCafeFound('da', 1759600000000)
    expect(cafe?.board.authoredBoardId).toBe(first.authoredBoardId)
    expect(mayLaunchCafe(first)).toBe(true)
    expect(cafesForCity(0, undefined, 'da')!.summary).toMatchObject({ found: 1, waiting: 1, toward: 0 })
    expect(firstCafeName('da')).toBe(cafeNameForBoard(first))
    expect(firstCafeName('da')).toMatch(/^Café /)
  })

  it('counts on from a walk that stopped short of its fifth photo', () => {
    useJourney.setState({ cafes: { [DA]: { found: {}, toward: 3 } } })
    ensureFirstCafeFound('da', 1759600000000)
    expect(cafesForCity(0, undefined, 'da')!.summary).toMatchObject({ found: 1, toward: 0 })
  })

  it('does nothing once a café is found: never a second find, never a moved count', () => {
    useJourney.setState({ cafes: { [DA]: { found: { [first.authoredBoardId]: 1 }, toward: 4 } } })
    const before = useJourney.getState().cafes
    expect(ensureFirstCafeFound('da')?.board.authoredBoardId).toBe(first.authoredBoardId)
    expect(useJourney.getState().cafes).toBe(before)
  })

  it('finds the German course’s first café by index; it has no name', () => {
    const cafe = ensureFirstCafeFound('de', 1759600000000)
    expect(cafe?.index).toBe(0)
    expect(firstFoundCafe('de')?.index).toBe(0)
    expect(firstCafeName('de')).toBeNull()
  })
})
