import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The first tap on a board (owner, 2026-09-30: "always slow to react with the
 * vibration and the sound"). A word tap primes the word player. That prime
 * used to create the app's AudioContext, which nothing plays through while
 * WEB_AUDIO is off, and in the shell it started a silent unlock clip the shell
 * does not need. Both happened inside the tap, ahead of the word itself. The
 * sound-effect and haptics halves are in sfx.test.ts.
 */
const audioContext = vi.hoisted(() => ({ getAudioContext: vi.fn(), resumeAudioContext: vi.fn() }))
vi.mock('./audioContext', () => audioContext)

class CountingAudio {
  static made = 0
  static played: string[] = []
  src = ''
  preload = ''
  constructor() {
    CountingAudio.made++
  }
  play() {
    CountingAudio.played.push(this.src)
    return Promise.resolve()
  }
  pause() {}
}

const shell = (native: boolean) =>
  vi.doMock('@capacitor/core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@capacitor/core')>()),
    Capacitor: { isNativePlatform: () => native, getPlatform: () => (native ? 'ios' : 'web') },
  }))

describe('priming the word player', () => {
  beforeEach(() => {
    CountingAudio.made = 0
    CountingAudio.played = []
    audioContext.getAudioContext.mockClear()
    audioContext.resumeAudioContext.mockClear()
    vi.stubGlobal('Audio', CountingAudio)
  })
  afterEach(() => {
    vi.doUnmock('@capacitor/core')
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('never builds the AudioContext: nothing plays through it while Web Audio is off', async () => {
    shell(false)
    const { primeWordAudio } = await import('./speak')
    primeWordAudio()
    primeWordAudio()
    expect(audioContext.getAudioContext).not.toHaveBeenCalled()
    expect(audioContext.resumeAudioContext).not.toHaveBeenCalled()
  })

  it('on the web, still unlocks the element once with the silent clip', async () => {
    shell(false)
    const { primeWordAudio } = await import('./speak')
    primeWordAudio()
    primeWordAudio()
    expect(CountingAudio.made).toBe(1)
    expect(CountingAudio.played).toHaveLength(1)
    expect(CountingAudio.played[0]).toMatch(/^data:audio\/wav/)
  })

  it('in the shell, starts no unlock clip: playback needs no gesture there', async () => {
    shell(true)
    const { primeWordAudio } = await import('./speak')
    primeWordAudio()
    expect(CountingAudio.made).toBe(0)
    expect(CountingAudio.played).toHaveLength(0)
  })
})
