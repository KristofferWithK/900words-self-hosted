import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * In an open-source build, a round with "your own AI key" chosen asks the
 * player's service (through src/ai/ownKey/), not a Worker. The build flag is
 * false under vitest, so the gate is pretended here, the way a self-built
 * 900words compiles it.
 */

const { ownKeyDecision } = vi.hoisted(() => ({ ownKeyDecision: vi.fn() }))
vi.mock('../ai/ownKey/gate', () => ({
  ownKeyAvailable: true,
  requestOwnKeyDecision: ownKeyDecision,
  testOwnKeyConnection: vi.fn(),
}))
vi.mock('../ui/feedback', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ui/feedback')>()
  return { ...actual, wheelWinFanfare: vi.fn(), rewardHaptic: vi.fn(), guessResultHaptic: vi.fn(), guessErrorBlip: vi.fn() }
})
vi.mock('../ui/speak', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ui/speak')>()
  return { ...actual, playWord: vi.fn(async () => 'baked' as const) }
})

// zustand resolves storage when the module is imported: install it first.
const written = new Map<string, string>()
const storage = {
  getItem: (k: string) => written.get(k) ?? null,
  setItem: (k: string, v: string) => void written.set(k, v),
  removeItem: (k: string) => void written.delete(k),
}
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage } })
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })

const { useGame } = await import('./gameStore')
const { useSettings } = await import('./settingsStore')

const envelope = (guesses: { wordId: string; confidence: number; reasoning: string }[], arm: string) => ({
  protocol: 1 as const,
  decision: { guesses },
  report: { arm, refused: false },
})

const reachPlayerClue = async () => {
  useGame.getState().newTutorialGame()
  await useGame.getState().runAiClue()
  useGame.getState().playerGuess('da:bord')
  expect(useGame.getState().game!.phase).toBe('playerClueInput')
}

describe('a self-built 900words with the player’s own AI key', () => {
  const previousFetch = globalThis.fetch
  beforeEach(() => {
    ownKeyDecision.mockReset()
    written.clear()
    useGame.setState(useGame.getInitialState())
  })
  afterEach(async () => {
    globalThis.fetch = previousFetch
    await useGame.getState().finishRound()
  })

  it('sends Casey’s guess to the player’s own service', async () => {
    useSettings.setState({ caseyMode: 'own-key', useMock: false })
    ownKeyDecision.mockResolvedValue(envelope([{ wordId: 'da:kaffe', confidence: 0.9, reasoning: 'r' }], 'own-key+own'))
    globalThis.fetch = async () => {
      throw new Error('no Worker may be asked')
    }
    await reachPlayerClue()
    useGame.getState().submitPlayerClue('pause', 2)
    await useGame.getState().runAiGuesses()
    expect(ownKeyDecision).toHaveBeenCalled()
    expect(ownKeyDecision.mock.calls.at(-1)![1]).toMatchObject({ operation: 'guess' })
    expect(useGame.getState().error).toBeNull()
  })

  it('leaves a round on the Worker when the player chose their own Casey server', async () => {
    useSettings.setState({ caseyMode: 'worker', useMock: false })
    let workerAsked = 0
    globalThis.fetch = async () => {
      workerAsked += 1
      return new Response(JSON.stringify(envelope([{ wordId: 'da:kaffe', confidence: 0.9, reasoning: 'r' }], 'cluey')), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    await reachPlayerClue()
    useGame.getState().submitPlayerClue('pause', 2)
    await useGame.getState().runAiGuesses()
    expect(workerAsked).toBeGreaterThan(0)
    expect(ownKeyDecision).not.toHaveBeenCalled()
  })
})
