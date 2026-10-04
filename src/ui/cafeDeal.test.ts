import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * CW-10's handling of CW-04's café gate, with the gate switched ON (as it
 * ships since CW-13): Home's Café puzzle tag points at
 * Sightseeing when the next café is not found, and every "deal the next
 * board" control falls back instead of doing nothing (dealOrFallBack). Set up
 * like stores/gameStore.cafeGate.test.ts.
 */
const daily = vi.hoisted(() => ({ open: true }))

vi.mock('../purchase/dailyGames', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../purchase/dailyGames')>()
  return { ...actual, canStartDailyGame: () => daily.open, canDeveloperContinue: () => false }
})

vi.mock('./speak', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./speak')>()
  return { ...actual, playWord: vi.fn(async () => 'baked' as const) }
})

const written = new Map<string, string>()
const storage = {
  getItem: (k: string) => written.get(k) ?? null,
  setItem: (k: string, v: string) => void written.set(k, v),
  removeItem: (k: string) => void written.delete(k),
}
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage } })
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })

const { useGame } = await import('../stores/gameStore')
const { useUi } = await import('../stores/uiStore')
const { useJourney } = await import('../stores/journeyStore')
const { useSettings } = await import('../stores/settingsStore')
const { CITY1_REQUIRED_SET } = await import('../session/courseRuntime')
const { emptyProgressFacts } = await import('../progression/facts')
const { cafeLaunchRefused, overrideCafeGateForTests } = await import('../journey/cafeAccess')
const { dealOrFallBack } = await import('./cafeDeal')
const { cafePuzzleAction, cafePuzzleNote, nextHomeBoard } = await import('./screens/HomeScreen')
const { UI } = await import('../i18n')

const DA = JSON.stringify(['da', 'sonderborg'])
const first = CITY1_REQUIRED_SET.boards[0]!

/** Home's own reading: the tag's action for a fresh player. */
const homeAction = () => {
  const facts = emptyProgressFacts()
  return cafePuzzleAction(null, nextHomeBoard(facts, null), (board) => !cafeLaunchRefused(board, facts))
}
const deal = () => useGame.getState().newGame({ cityIndex: 0 })

beforeEach(() => {
  written.clear()
  daily.open = true
  overrideCafeGateForTests(true)
  useGame.getState().abandonGame()
  useGame.setState({ lastDealRefusal: null })
  useJourney.setState({ cityIndex: 0, cafes: {} })
  useSettings.setState({ useMock: true })
  useUi.setState({ screen: 'home', dailyLimitOpen: false })
})

afterAll(() => overrideCafeGateForTests(null))

describe('the café gate on Home, the finish screen and onboarding (gate on)', () => {
  it('a fresh player: the Café puzzle tag says to find a café first, and a deal falls back', () => {
    const action = homeAction()
    expect(action).toEqual({ kind: 'find-first', board: first })
    expect(cafePuzzleNote(action)).toBe(UI.home.cafeNotFoundNote)

    const fallBack = vi.fn()
    expect(dealOrFallBack(deal, fallBack)).toBe(false)
    expect(useGame.getState().lastDealRefusal).toBe('cafeNotFound')
    expect(fallBack).toHaveBeenCalledOnce()
    expect(useGame.getState().game).toBeNull()
  })

  it('once a walk has found the first café, the tag deals it and nothing falls back', () => {
    useJourney.setState({ cafes: { [DA]: { found: { [first.authoredBoardId]: Date.now() }, toward: 0 } } })
    expect(homeAction()).toEqual({ kind: 'next', board: first })

    const fallBack = vi.fn()
    expect(dealOrFallBack(deal, fallBack)).toBe(true)
    expect(fallBack).not.toHaveBeenCalled()
    expect(useGame.getState().game).not.toBeNull()
  })

  it('a daily-limit refusal is not a café refusal: its own offer opens, nothing falls back', () => {
    useJourney.setState({ cafes: { [DA]: { found: { [first.authoredBoardId]: Date.now() }, toward: 0 } } })
    daily.open = false
    const fallBack = vi.fn()
    expect(dealOrFallBack(deal, fallBack)).toBe(false)
    expect(useGame.getState().lastDealRefusal).toBe('dailyLimit')
    expect(fallBack).not.toHaveBeenCalled()
  })

  it('with the gate as shipped (on since CW-13), Home points the way to Sightseeing', () => {
    overrideCafeGateForTests(null)
    expect(homeAction()).toEqual({ kind: 'find-first', board: first })
    const fallBack = vi.fn()
    expect(dealOrFallBack(deal, fallBack)).toBe(false)
    expect(fallBack).toHaveBeenCalledOnce()
  })
})
