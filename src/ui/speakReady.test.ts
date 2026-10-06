import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { READY_WAIT_MS, parkAtVoice, startWhenReady } from './speak'

/**
 * Owner, build 123: "a few words that were cut off, that started too late,
 * where I only heard half the word." The voice sits ~60 ms into a clip once
 * the player skips to it, so the playback path may not lose the start of an
 * element it reached before the element finished loading.
 */

/** Just enough of a media element: readiness, position, play and its events. */
class FakeMedia {
  readyState = 0
  networkState = 2 // NETWORK_LOADING
  paused = true
  seeks: number[] = []
  plays: number[] = []
  log: string[] = []
  private time = 0
  private listeners = new Map<string, Set<() => void>>()
  get currentTime() {
    return this.time
  }
  set currentTime(value: number) {
    this.time = value
    this.seeks.push(value)
    this.log.push(`seek ${value}`)
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
  listening(type: string) {
    return this.listeners.get(type)?.size ?? 0
  }
  play() {
    this.paused = false
    this.plays.push(this.time)
    this.log.push('play')
    return Promise.resolve()
  }
}

const media = (init: Partial<FakeMedia> = {}) => Object.assign(new FakeMedia(), init) as FakeMedia & HTMLMediaElement

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('a word starts from where its voice starts, never from a half-loaded element', () => {
  it('starts a ready element at once, seeking first, exactly as before', async () => {
    const el = media({ readyState: 4, networkState: 1 })
    await startWhenReady(el, 0.05)
    expect(el.log).toEqual(['seek 0.05', 'play'])
  })

  it('does not seek a ready element already parked at its voice', async () => {
    const el = media({ readyState: 4, networkState: 1 })
    el.currentTime = 0.05
    el.log = []
    await startWhenReady(el, 0.05)
    expect(el.log).toEqual(['play'])
  })

  it('waits for a still-loading element to be able to play, then seeks and starts it together', async () => {
    const el = media({ readyState: 1 })
    let done = false
    void startWhenReady(el, 0.05).then(() => (done = true))
    await vi.advanceTimersByTimeAsync(40)
    // Nothing touched the element while it loads: no reset, no play.
    expect(el.log).toEqual([])
    el.readyState = 3
    el.emit('canplay')
    await vi.advanceTimersByTimeAsync(0)
    expect(el.log).toEqual(['seek 0.05', 'play'])
    expect(done).toBe(true)
    expect(el.listening('canplay') + el.listening('error')).toBe(0)
  })

  it('waits for an element just handed its source, even before it reports loading', async () => {
    const el = media({ readyState: 0, networkState: 0 })
    void startWhenReady(el, 0.05)
    expect(el.log).toEqual([])
    el.readyState = 4
    el.emit('canplay')
    await vi.advanceTimersByTimeAsync(0)
    expect(el.log).toEqual(['seek 0.05', 'play'])
  })

  it('never seeks an element with no metadata yet: it plays from the top', async () => {
    const el = media({ readyState: 0 })
    void startWhenReady(el, 0.05)
    // A stack that never says canplay still plays, after the bounded wait.
    await vi.advanceTimersByTimeAsync(READY_WAIT_MS)
    expect(el.log).toEqual(['play'])
    expect(el.plays).toEqual([0])
  })

  it('plays at once an element that is not loading at all, rather than wait for nothing', async () => {
    // e.g. a WebKit that stopped at metadata until play() is called.
    const el = media({ readyState: 1, networkState: 1 })
    await startWhenReady(el, 0.05)
    expect(el.log).toEqual(['seek 0.05', 'play'])
  })

  it('gives way to a newer tap that came in while it waited, without touching the element', async () => {
    const el = media({ readyState: 1 })
    let current = true
    const started = startWhenReady(el, 0.05, () => current)
    current = false
    el.readyState = 3
    el.emit('canplay')
    await expect(started).rejects.toMatchObject({ name: 'AbortError' })
    expect(el.log).toEqual([])
  })

  it('parks a resting element at its voice, and leaves a playing one where it is', () => {
    const resting = media({ readyState: 1 })
    parkAtVoice(resting, 0.05)
    expect(resting.seeks).toEqual([0.05])
    // The tap got there first: metadata landing mid-start must not jump it.
    const playing = media({ readyState: 1, paused: false })
    parkAtVoice(playing, 0.05)
    expect(playing.seeks).toEqual([])
  })
})
