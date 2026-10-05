import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * CW-15: the intro's real-round act never leaves a blank screen. A first
 * session whose board is refused ends the intro on Home. The intro's café
 * puzzle is part of the intro (owner, 2026-10-04): the daily limit never
 * refuses it, on a first session or a replay. A replay's puzzle is the
 * city's first café, dealt fresh.
 */
const gate = vi.hoisted(() => ({ open: true, admitted: false }))

vi.mock('../purchase/dailyGames', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../purchase/dailyGames')>()
  return {
    ...actual,
    canStartDailyGame: () => gate.open || gate.admitted,
    canDeveloperContinue: () => gate.open,
    withIntroPuzzleAdmitted: <T,>(deal: () => T): T => {
      gate.admitted = true
      try { return deal() } finally { gate.admitted = false }
    },
  }
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
const { findEveryCafe } = await import('../journey/cafeTestSupport')
const { openIntroRound } = await import('./introRound')
const { CITY1_REQUIRED_SET } = await import('../session/courseRuntime')

function inIntro(persist: boolean) {
  useUi.setState({ onboarding: { step: 'real', persist } as never, screen: 'home', dailyLimitOpen: false, dailyLimitRetry: null })
}
const introOver = () => useUi.getState().onboarding === null
const roundOn = () => !!useGame.getState().game && useGame.getState().mode === 'normal'

beforeEach(async () => {
  await useGame.getState().finishRound()
  written.clear()
  useGame.setState(useGame.getInitialState())
  useUi.setState({ pendingFirstGiver: null, screen: 'home', onboarding: null, dailyLimitOpen: false, dailyLimitRetry: null })
  gate.open = true
})

describe('a first session (persist)', () => {
  it('deals the found café\'s puzzle and stays in the intro', () => {
    inIntro(true)
    openIntroRound(true)
    expect(roundOn()).toBe(true)
    expect(introOver()).toBe(false)
  })

  it('is never refused by the daily limit: the café puzzle is part of the intro', () => {
    gate.open = false
    inIntro(true)
    openIntroRound(true)
    expect(roundOn()).toBe(true)
    expect(introOver()).toBe(false)
    expect(useUi.getState().dailyLimitOpen).toBe(false)
  })
})

describe('a first session, any other refusal', () => {
  it('ends the intro on Home when no board comes (here a settlement in progress), not only for the café gate', () => {
    inIntro(true)
    useGame.setState({ settlementBusy: true })
    openIntroRound(true)
    expect(roundOn()).toBe(false)
    expect(introOver()).toBe(true)
    useGame.setState({ settlementBusy: false })
  })
})

describe('a replayed intro (owner, 2026-10-04: the full game is part of the intro)', () => {
  it("deals the city's first café fresh, opening with Casey's clue, and stays in the intro", () => {
    findEveryCafe()
    inIntro(false)
    openIntroRound(false)
    expect(roundOn()).toBe(true)
    expect(introOver()).toBe(false)
    expect(useGame.getState().authoredBoardId).toBe(CITY1_REQUIRED_SET.boards[0]!.authoredBoardId)
    expect(useGame.getState().game!.phase).toBe('aiClueInput')
  })

  it('past the daily limit still deals it, with no dialog', () => {
    findEveryCafe()
    gate.open = false
    inIntro(false)
    openIntroRound(false)
    expect(roundOn()).toBe(true)
    expect(useUi.getState().dailyLimitOpen).toBe(false)
  })

  it("goes on to Home's lesson when no board can come (a settlement in progress)", () => {
    inIntro(false)
    useGame.setState({ settlementBusy: true })
    openIntroRound(false)
    expect(roundOn()).toBe(false)
    expect(introOver()).toBe(false)
    expect(useUi.getState().onboarding?.step).toBe('home-return')
    useGame.setState({ settlementBusy: false })
  })
})
