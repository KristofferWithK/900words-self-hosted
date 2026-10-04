import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * CW-15: the intro's real-round act never leaves a blank screen. A first
 * session whose board is refused, for whatever reason, ends the intro on
 * Home; a replayed intro whose own next board is refused ends it too, at once
 * or once the daily-limit dialog closes, and stays when a purchase dealt it.
 */
const gate = vi.hoisted(() => ({ open: true }))

vi.mock('../purchase/dailyGames', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../purchase/dailyGames')>()
  return { ...actual, canStartDailyGame: () => gate.open, canDeveloperContinue: () => gate.open }
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

  it('ends the intro on Home when the daily limit refuses the board, the dialog then over Home', () => {
    gate.open = false
    inIntro(true)
    openIntroRound(true)
    expect(roundOn()).toBe(false)
    expect(introOver()).toBe(true)
    expect(useUi.getState().screen).toBe('home')
    expect(useUi.getState().dailyLimitOpen).toBe(true)
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

describe('a replayed intro', () => {
  it('resumes the player\'s own next board and stays', () => {
    findEveryCafe()
    inIntro(false)
    const stop = openIntroRound(false)
    expect(roundOn()).toBe(true)
    expect(introOver()).toBe(false)
    stop()
  })

  it('ends at once when no board comes and no dialog opened (here a settlement in progress)', () => {
    inIntro(false)
    useGame.setState({ settlementBusy: true })
    openIntroRound(false)
    expect(roundOn()).toBe(false)
    expect(useUi.getState().dailyLimitOpen).toBe(false)
    expect(introOver()).toBe(true)
    useGame.setState({ settlementBusy: false })
  })

  it('past the daily limit waits for the dialog, then ends on Home', () => {
    findEveryCafe()
    gate.open = false
    inIntro(false)
    openIntroRound(false)
    expect(useUi.getState().dailyLimitOpen).toBe(true)
    expect(introOver()).toBe(false)
    useUi.getState().closeDailyLimit()
    expect(introOver()).toBe(true)
    expect(useUi.getState().screen).toBe('home')
  })

  it('stays when a purchase in the dialog dealt the board', () => {
    findEveryCafe()
    gate.open = false
    inIntro(false)
    openIntroRound(false)
    gate.open = true
    expect(useUi.getState().dailyLimitRetry!()).toBe(true)
    useUi.getState().closeDailyLimit()
    expect(roundOn()).toBe(true)
    expect(introOver()).toBe(false)
  })

  it('stops waiting when the act goes first', () => {
    findEveryCafe()
    gate.open = false
    inIntro(false)
    const stop = openIntroRound(false)
    stop()
    useUi.getState().closeDailyLimit()
    expect(introOver()).toBe(false)
  })
})
