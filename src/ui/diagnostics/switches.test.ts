import { afterEach, describe, expect, it } from 'vitest'
import { after } from '../../run/writeQueue'
import { createStampTaps, PANEL_TAPS, READOUT_TAPS } from './panel'
import { diagHaptic } from './recorder'
import { DIAG_SWITCHES, diagSwitch, diagSwitchesOn, setDiagSwitch } from './switches'

/**
 * The A/B switches route to the places they turn off, and are off for
 * everyone who never opened the hidden section.
 */
afterEach(() => {
  for (const name of DIAG_SWITCHES) setDiagSwitch(name, false)
})

describe('the performance log switches', () => {
  it('are all off by default', () => {
    for (const name of DIAG_SWITCHES) expect(diagSwitch(name)).toBe(false)
    expect(diagSwitchesOn()).toEqual([])
  })

  it('Defer writes: the run queue writes nothing until it is flushed (run end, pause, hide)', async () => {
    let ran = 0
    after(5)(() => ran++)
    await new Promise((r) => setTimeout(r, 20))
    expect(ran).toBe(1)
    setDiagSwitch('deferWrites', true)
    after(5)(() => ran++)
    await new Promise((r) => setTimeout(r, 20))
    expect(ran).toBe(1)
  })

  it('No haptics: the haptic hook says skip', () => {
    expect(diagHaptic()).toBe(false)
    setDiagSwitch('haptics', true)
    expect(diagHaptic()).toBe(true)
  })

  it('Mute effects: an effect returns before touching a media element', async () => {
    const { playSfx, playSfxTrack } = await import('../sfx')
    setDiagSwitch('sfx', true)
    // No Audio exists in node: getting past the switch would throw or mark a prime.
    expect(() => playSfx('blip')).not.toThrow()
    expect(playSfxTrack('data:,', 100)).toBeUndefined()
  })

  it('Mute words: the word player answers "silent" and readies nothing', async () => {
    const speak = await import('../speak')
    setDiagSwitch('wordAudio', true)
    await expect(speak.playWord('hus')).resolves.toBe('silent')
    await expect(speak.playClipAudio('x.mp3')).resolves.toBe('silent')
    await expect(speak.preloadWordAudio(['hus'])).resolves.toBeUndefined()
  })

  it('lists what is on, for the log header', () => {
    setDiagSwitch('runPictures', true)
    setDiagSwitch('cafeArt', true)
    expect(diagSwitchesOn()).toEqual(['runPictures', 'cafeArt'])
  })
})

describe('the build stamp taps', () => {
  function harness() {
    const calls: string[] = []
    let pending: (() => void) | null = null
    const tap = createStampTaps(
      () => calls.push('readout'),
      () => calls.push('panel'),
      (fn) => {
        pending = fn
        return () => {
          pending = null
        }
      },
    )
    return { calls, tap, pause: () => pending?.() }
  }

  it('five taps and a pause toggle the keyboard readout, as before', () => {
    const h = harness()
    for (let i = 0; i < READOUT_TAPS; i++) h.tap()
    expect(h.calls).toEqual([])
    h.pause()
    expect(h.calls).toEqual(['readout'])
  })

  it('seven taps reveal the performance log without touching the readout', () => {
    const h = harness()
    for (let i = 0; i < PANEL_TAPS; i++) h.tap()
    h.pause()
    expect(h.calls).toEqual(['panel'])
  })
})
