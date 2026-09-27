import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { GameState } from '../engine/types'
import { completedClue } from './feedback'

const gameWith = (number: number, results: Array<'green' | 'bystander'>) =>
  ({
    clueHistory: [
      {
        by: 'ai',
        text: 'test',
        number,
        guesses: results.map((result, index) => ({ wordId: `${index}`, result })),
      },
    ],
  }) as GameState

describe('completedClue', () => {
  it('rewards exactly the promised number of correct guesses', () => {
    expect(completedClue(gameWith(2, ['green']))).toBe(false)
    expect(completedClue(gameWith(2, ['green', 'green']))).toBe(true)
  })

  it('does not reward a turn that ended on a neutral', () => {
    expect(completedClue(gameWith(2, ['green', 'bystander']))).toBe(false)
  })

  it('works the same regardless of which side gave the clue', () => {
    const game = gameWith(1, ['green'])
    game.clueHistory[0]!.by = 'player'
    expect(completedClue(game)).toBe(true)
  })
})

/**
 * The turn haptic and the three sound effects, as feedback.ts hands them to
 * the media-element player (sfx.ts). These used to fake a Web Audio graph
 * and assert that a suspended context meant silence — the very rule that
 * silenced every effect on the owner's iPhone once iOS suspended the context.
 * What is pinned now is the opposite: feedback.ts reaches for no
 * AudioContext at all, each effect goes to its own frozen file, there is no
 * suitcase clack any more, and priming primes the effects' elements. The
 * gesture, pooling and recovery behaviour is sfx.test.ts's.
 */
const sfx = vi.hoisted(() => ({
  playSfx: vi.fn(),
  primeSfx: vi.fn(),
}))
vi.mock('./sfx', () => sfx)

const audioContext = vi.hoisted(() => ({ getAudioContext: vi.fn(), resumeAudioContext: vi.fn() }))
vi.mock('./audioContext', () => audioContext)

describe('turnHaptic and the sound effects', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { vibrate: () => true })
    sfx.playSfx.mockClear()
    sfx.primeSfx.mockClear()
    audioContext.getAudioContext.mockClear()
    audioContext.resumeAudioContext.mockClear()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('keeps the handoff haptic without playing a sound', async () => {
    const vibrate = vi.fn(() => true)
    vi.stubGlobal('navigator', { vibrate })
    const { turnHaptic } = await import('./feedback')
    turnHaptic()
    expect(vibrate).toHaveBeenCalledWith(12)
    expect(sfx.playSfx).not.toHaveBeenCalled()
  })

  it('has no suitcase clack: a green card is answered by its haptic alone', async () => {
    const mod = await import('./feedback')
    expect('suitcaseClack' in mod).toBe(false)
    mod.guessResultHaptic('green')
    expect(sfx.playSfx).not.toHaveBeenCalled()
  })

  it('sends the tick, the blip and the fanfare each to its own effect', async () => {
    const { wheelSpinTick, guessErrorBlip, wheelWinFanfare } = await import('./feedback')
    wheelSpinTick()
    guessErrorBlip()
    wheelWinFanfare()
    expect(sfx.playSfx.mock.calls).toEqual([['tick'], ['blip'], ['fanfare']])
  })

  it('never reaches for the shared AudioContext, so a suspended one cannot silence an effect', async () => {
    const fb = await import('./feedback')
    fb.primeTurnClick()
    fb.primeRewardDing()
    fb.wheelSpinTick()
    fb.guessErrorBlip()
    fb.wheelWinFanfare()
    expect(audioContext.getAudioContext).not.toHaveBeenCalled()
    expect(audioContext.resumeAudioContext).not.toHaveBeenCalled()
  })

  it('exports the haptics beside the existing reward helpers', async () => {
    const mod = await import('./feedback')
    expect(typeof mod.turnHaptic).toBe('function')
    expect(typeof mod.primeTurnClick).toBe('function')
    expect(typeof mod.rewardHaptic).toBe('function')
  })

  it('keeps the light handoff haptic when sound is off', async () => {
    const vibrate = vi.fn(() => true)
    vi.stubGlobal('navigator', { vibrate })
    const { turnHaptic } = await import('./feedback')
    const { useSettings } = await import('../stores/settingsStore')
    useSettings.setState({ sound: false })
    turnHaptic()
    expect(vibrate).toHaveBeenCalledWith(12)
  })

  it('priming primes the effects’ media elements — the unlock Casey’s later blips ride on', async () => {
    const { primeTurnClick, primeRewardDing } = await import('./feedback')
    primeTurnClick()
    primeRewardDing()
    expect(sfx.primeSfx).toHaveBeenCalledTimes(2)
  })
})
