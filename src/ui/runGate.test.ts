import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * CW-15: every door into a run that is not the run screen's own Start asks
 * the daily limit first, and a refusal opens the upgrade dialog. Home's
 * Sightseeing tag and chooser, and the train sheet's "Catch the train", all go
 * through `beginRunOrOffer`; `startTrainRun` is checked here end to end.
 */
const gate = vi.hoisted(() => ({ open: true }))
vi.mock('../purchase/dailyGames', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../purchase/dailyGames')>()),
  canStartRun: () => gate.open,
}))

const { beginRunOrOffer } = await import('./runGate')
const { startTrainRun } = await import('./components/TrainRunPanel')
const { useUi } = await import('../stores/uiStore')
const { chosenWalk } = await import('../run/walks')

beforeEach(() => {
  gate.open = true
  useUi.setState({ dailyLimitOpen: false, dailyLimitRetry: null, screen: 'home' })
})

describe('beginRunOrOffer', () => {
  it('opens the run while a free run is left (or the player is Unlimited)', () => {
    const begin = vi.fn()
    expect(beginRunOrOffer(begin)).toBe(true)
    expect(begin).toHaveBeenCalledOnce()
    expect(useUi.getState().dailyLimitOpen).toBe(false)
  })

  it('with today\'s two runs used: the upgrade dialog, not the run, and never a silent no', () => {
    gate.open = false
    const begin = vi.fn()
    expect(beginRunOrOffer(begin)).toBe(false)
    expect(begin).not.toHaveBeenCalled()
    expect(useUi.getState().dailyLimitOpen).toBe(true)
  })

  it('after a purchase the thank-you\'s retry opens the run itself, and is not a board deal', () => {
    gate.open = false
    const begin = vi.fn()
    beginRunOrOffer(begin)
    const retry = useUi.getState().dailyLimitRetry!
    // Still refused (say a restore found nothing): the retry does nothing.
    expect(retry()).toBe(false)
    expect(begin).not.toHaveBeenCalled()
    gate.open = true
    expect(retry()).toBe(false)
    expect(begin).toHaveBeenCalledOnce()
  })
})

describe('the train sheet\'s Catch the train', () => {
  it('closes the sheet, then opens the train run', () => {
    const leaving = vi.fn()
    startTrainRun(leaving)
    expect(leaving).toHaveBeenCalledOnce()
    expect(useUi.getState().screen).toBe('sightseeing')
    expect(chosenWalk()).toBe('train')
  })

  it('with today\'s two runs used: the sheet closes and the upgrade dialog opens over Home', () => {
    gate.open = false
    const leaving = vi.fn()
    startTrainRun(leaving)
    expect(leaving).toHaveBeenCalledOnce()
    expect(useUi.getState().screen).toBe('home')
    expect(useUi.getState().dailyLimitOpen).toBe(true)
    gate.open = true
    useUi.getState().dailyLimitRetry!()
    expect(useUi.getState().screen).toBe('sightseeing')
  })
})
