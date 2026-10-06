import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SPIN_MS, spinTarget, spinTickTimes } from './components/wheelAngle'
import { parseWavPcm16, renderClackTrack, wavDataUrl, type PcmClip } from './spinTrack'

/**
 * The wheel's clack track (owner, build 123: "the sound wasn't matching the
 * spinning"): every clack of a spin mixed into one file from the frozen tick,
 * so one media-element start carries them all, and the disc starts on it.
 */

const tickFile = readFileSync(new URL('../../public/audio/ui/wheel-tick.wav', import.meta.url))
const tickBytes = tickFile.buffer.slice(tickFile.byteOffset, tickFile.byteOffset + tickFile.byteLength) as ArrayBuffer

/** A recognisable clip: 10 samples of 1000 at 1 kHz, so a clack is 10 ms long. */
const clip: PcmClip = { rate: 1000, samples: new Int16Array(10).fill(1000) }

describe('the clack track file', () => {
  it('reads the frozen tick the render script wrote', () => {
    const tick = parseWavPcm16(tickBytes)
    expect(tick).not.toBeNull()
    expect(tick!.rate).toBe(44100)
    // About 50 ms of sound.
    expect(tick!.samples.length / tick!.rate).toBeGreaterThan(0.03)
    expect(tick!.samples.length / tick!.rate).toBeLessThan(0.08)
    expect(tick!.samples.some((s) => s !== 0)).toBe(true)
  })

  it('refuses anything that is not 16-bit PCM WAV rather than playing noise', () => {
    expect(parseWavPcm16(new ArrayBuffer(10))).toBeNull()
    expect(parseWavPcm16(new TextEncoder().encode('<!doctype html><html>'.padEnd(64, ' ')).buffer as ArrayBuffer)).toBeNull()
  })

  it('places one clack at each time, after the lead-in, and nothing before the first', () => {
    const wav = renderClackTrack(clip, [0, 25, 100], 40)
    const back = parseWavPcm16(wav.buffer as ArrayBuffer)!
    expect(back.rate).toBe(1000)
    const sounding = [...back.samples].map((s, i) => (s !== 0 ? i : -1)).filter((i) => i >= 0)
    const starts = sounding.filter((i) => back.samples[i - 1] === 0 || i === 0)
    expect(starts).toEqual([40, 65, 140])
    expect(sounding).toHaveLength(30)
  })

  it('ends where the last clack ends: nothing sounds after the last boundary', () => {
    const wav = renderClackTrack(clip, [0, 25, 100], 40)
    const back = parseWavPcm16(wav.buffer as ArrayBuffer)!
    expect(back.samples.length).toBe(140 + 10)
  })

  it('mixes overlapping clacks without wrapping round', () => {
    const loud: PcmClip = { rate: 1000, samples: new Int16Array(10).fill(30000) }
    const back = parseWavPcm16(renderClackTrack(loud, [0, 5]).buffer as ArrayBuffer)!
    expect(back.samples[7]).toBe(32767)
  })

  it('carries a whole spin of the real tick: as many clacks as boundaries, the file no longer than the spin and one tick', () => {
    const tick = parseWavPcm16(tickBytes)!
    const n = 15
    const times = spinTickTimes(-3, spinTarget(0, 12) - 3, n, -3)
    const wav = renderClackTrack(tick, times, 40)
    const back = parseWavPcm16(wav.buffer as ArrayBuffer)!
    const ms = (back.samples.length / back.rate) * 1000
    expect(ms).toBeLessThanOrEqual(40 + SPIN_MS + (tick.samples.length / tick.rate) * 1000 + 1)
    expect(ms).toBeCloseTo(40 + times.at(-1)! + (tick.samples.length / tick.rate) * 1000, 0)
    expect(wavDataUrl(wav)).toMatch(/^data:audio\/wav;base64,UklGR/)
  })
})

/** A media element with the events the track listens for. */
class EventAudio {
  static made: EventAudio[] = []
  src: string
  preload = ''
  dataset: Record<string, string> = {}
  muted = false
  paused = true
  ended = false
  currentTime = 0
  plays: string[] = []
  private listeners = new Map<string, Set<() => void>>()
  constructor(src = '') {
    this.src = src
    EventAudio.made.push(this)
  }
  addEventListener(type: string, fn: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(fn)
  }
  removeEventListener(type: string, fn: () => void) {
    this.listeners.get(type)?.delete(fn)
  }
  emit(type: string) {
    for (const fn of [...(this.listeners.get(type) ?? [])]) fn()
  }
  play(): Promise<void> {
    this.paused = false
    this.plays.push(this.src)
    return Promise.resolve()
  }
  pause(): void {
    this.paused = true
  }
  load(): void {}
}

const memoryStorage = () => {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}

async function load(sound = true) {
  const feedback = await import('./feedback')
  const sfx = await import('./sfx')
  const spinTrack = await import('./spinTrack')
  const { useSettings } = await import('../stores/settingsStore')
  useSettings.setState({ sound })
  spinTrack.resetClackSampleForTests(parseWavPcm16(tickBytes))
  return { ...feedback, ...sfx, ...spinTrack }
}

const trackEl = () => EventAudio.made.find((el) => el.dataset.sfx === 'spin')
const times = spinTickTimes(-3, spinTarget(0, 12) - 3, 12, -3)

describe('the clack track plays as one start, and the disc waits for it', () => {
  beforeEach(() => {
    EventAudio.made = []
    vi.useFakeTimers()
    vi.stubGlobal('Audio', EventAudio)
    const localStorage = memoryStorage()
    vi.stubGlobal('localStorage', localStorage)
    vi.stubGlobal('window', { localStorage, addEventListener: () => {}, dispatchEvent: () => true })
    vi.stubGlobal('document', { addEventListener: () => {}, visibilityState: 'visible' })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('starts the whole spin with one play of one data: WAV, not one per clack', async () => {
    const fx = await load()
    const track = fx.startWheelClacks(times, 40, 250)
    expect(track).toBeDefined()
    const el = trackEl()!
    expect(el.plays).toHaveLength(1)
    expect(el.plays[0]).toMatch(/^data:audio\/wav;base64,/)
    // No per-clack element was started.
    expect(EventAudio.made.filter((e) => e.dataset.sfx === 'tick' && e.plays.length)).toHaveLength(0)
  })

  it('is ready only once the element is actually playing, and reports how far it has got', async () => {
    const fx = await load()
    const track = fx.startWheelClacks(times, 40, 250)!
    let ready: boolean | undefined
    void track.started.then((ok) => (ready = ok))
    await vi.advanceTimersByTimeAsync(30)
    expect(ready).toBeUndefined()
    const el = trackEl()!
    el.currentTime = 0.012
    el.emit('playing')
    await vi.advanceTimersByTimeAsync(0)
    expect(ready).toBe(true)
    expect(track.position()).toBeCloseTo(12)
  })

  it('waits past `playing` until the media clock actually moves', async () => {
    const fx = await load()
    const track = fx.startWheelClacks(times, 40, 250)!
    let ready: boolean | undefined
    void track.started.then((ok) => (ready = ok))
    const el = trackEl()!
    el.emit('playing')
    await vi.advanceTimersByTimeAsync(40)
    expect(ready).toBeUndefined()
    el.currentTime = 0.005
    await vi.advanceTimersByTimeAsync(4)
    expect(ready).toBe(true)
  })

  it('readies the coming spin ahead, so the tap only presses play on the loaded track', async () => {
    const fx = await load()
    fx.readyWheelClacks(times, 40)
    await vi.advanceTimersByTimeAsync(0)
    const el = trackEl()!
    const readied = el.src
    expect(readied).toMatch(/^data:audio\/wav;base64,/)
    let assigned = 0
    const real = Object.getOwnPropertyDescriptor(el, 'src')!
    Object.defineProperty(el, 'src', { get: () => real.value, set: (v: string) => { assigned++; real.value = v } })
    fx.startWheelClacks(times, 40, 250)
    expect(assigned).toBe(0)
    expect(el.plays).toEqual([readied])
    // A different spin (another landing) is made and loaded at the tap instead.
    fx.startWheelClacks(times.slice(1), 40, 250)
    expect(assigned).toBe(1)
  })

  it('gives up after the wait, silences itself, and sends later spins straight to the fallback', async () => {
    const fx = await load()
    const track = fx.startWheelClacks(times, 40, 250)!
    let ready: boolean | undefined
    void track.started.then((ok) => (ready = ok))
    await vi.advanceTimersByTimeAsync(250)
    expect(ready).toBe(false)
    expect(trackEl()!.paused).toBe(true)
    // A late `playing` changes nothing.
    trackEl()!.emit('playing')
    await vi.advanceTimersByTimeAsync(0)
    expect(ready).toBe(false)
    expect(fx.startWheelClacks(times, 40, 250)).toBeUndefined()
  })

  it('gives up on a load error the same way', async () => {
    const fx = await load()
    const track = fx.startWheelClacks(times, 40, 250)!
    trackEl()!.emit('error')
    expect(await track.started).toBe(false)
    expect(fx.startWheelClacks(times, 40, 250)).toBeUndefined()
  })

  it('plays nothing after the disc rests: finish cuts the track after the last tick tail', async () => {
    const fx = await load()
    const track = fx.startWheelClacks(times, 40, 250)!
    trackEl()!.currentTime = 0.001
    trackEl()!.emit('playing')
    expect(await track.started).toBe(true)
    track.finish(60)
    await vi.advanceTimersByTimeAsync(59)
    expect(trackEl()!.paused).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(trackEl()!.paused).toBe(true)
  })

  it('stops at once when the wheel goes away mid-spin', async () => {
    const fx = await load()
    const track = fx.startWheelClacks(times, 40, 250)!
    trackEl()!.currentTime = 0.001
    trackEl()!.emit('playing')
    await track.started
    track.stop()
    expect(trackEl()!.paused).toBe(true)
  })

  it('is not made at all with sound off, or before the tick is decoded', async () => {
    const off = await load(false)
    expect(off.startWheelClacks(times, 40, 250)).toBeUndefined()
    expect(trackEl()).toBeUndefined()
    const { useSettings } = await import('../stores/settingsStore')
    useSettings.setState({ sound: true })
    off.resetClackSampleForTests(null)
    expect(off.startWheelClacks(times, 40, 250)).toBeUndefined()
  })

  it('cuts the fallback clacks when the disc rests, so a late one cannot follow it', async () => {
    const fx = await load()
    fx.wheelSpinTick()
    fx.wheelSpinTick()
    const ticks = EventAudio.made.filter((e) => e.dataset.sfx === 'tick')
    expect(ticks.filter((e) => !e.paused)).toHaveLength(2)
    fx.silenceWheelTicks()
    expect(ticks.filter((e) => !e.paused)).toHaveLength(0)
  })
})
