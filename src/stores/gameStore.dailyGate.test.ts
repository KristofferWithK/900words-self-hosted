import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Where the game asks the daily limit, whichever store's build it is: before
 * a fresh deal, never before resuming the game already in progress.
 */
const gate = vi.hoisted(() => ({ open: true }))

vi.mock('../purchase/dailyGames', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../purchase/dailyGames')>()
  return { ...actual, canStartDailyGame: () => gate.open, canDeveloperContinue: () => false }
})

vi.mock('../ui/speak', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ui/speak')>()
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

const { useGame } = await import('./gameStore')
const { useUi } = await import('./uiStore')
// The board game's deals are cafés found on walks (CW-04); this file is about the daily limit.
const { findEveryCafe } = await import('../journey/cafeTestSupport')

beforeEach(async () => {
  await useGame.getState().finishRound()
  written.clear()
  useGame.setState(useGame.getInitialState())
  useUi.setState({ pendingFirstGiver: null, screen: 'home', onboarding: null, dailyLimitOpen: false, dailyLimitRetry: null })
  gate.open = true
  findEveryCafe()
})

describe('the daily limit inside the game store', () => {
  it('stops a fresh deal and opens the upgrade dialog', () => {
    gate.open = false
    expect(useGame.getState().newGame({ cityIndex: 0 })).toBe(false)
    expect(useGame.getState().game).toBeNull()
    expect(useUi.getState().dailyLimitOpen).toBe(true)
  })

  // CW-15: the deal doors other than Home's Café puzzle tag. RoundSummary's
  // "Play next game" deals with no options (dealOrFallBack(() => newGame()));
  // the map's Travel ahead deals the selected city. Each is refused with the
  // dialog open and the refusal named, never a silent no.
  it.each([
    ["the finish screen's Play next game", undefined],
    ["the map's Travel ahead", { cityIndex: 1 }],
  ] as const)('%s is refused with the upgrade dialog', (_door, opts) => {
    gate.open = false
    expect(useGame.getState().newGame(opts)).toBe(false)
    expect(useGame.getState().game).toBeNull()
    expect(useGame.getState().lastDealRefusal).toBe('dailyLimit')
    expect(useUi.getState().dailyLimitOpen).toBe(true)
  })

  it('resumes the game already in progress even when the limit is reached', () => {
    expect(useGame.getState().newGame({ cityIndex: 0 })).toBe(true)
    const started = useGame.getState()
    gate.open = false
    expect(useGame.getState().newGame({ cityIndex: 0 })).toBe(true)
    expect(useGame.getState().attemptId).toBe(started.attemptId)
    expect(useGame.getState().game).toEqual(started.game)
    expect(useUi.getState().dailyLimitOpen).toBe(false)
  })
})
