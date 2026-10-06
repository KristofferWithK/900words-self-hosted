import { beforeEach, describe, expect, it } from 'vitest'
import { quietAll, resetMediaQuietForTests, wake, watchMedia } from './mediaQuiet'
import { startWhenReady } from './speak'

/**
 * NOW PLAYING IS LEFT AGAIN (TestFlight 125, iPhone simulator soak 2). Once a
 * sound longer than 0.95 s has played, WebKit counts every resting element
 * with a source for the system's Now Playing and recomputes it at every
 * start, pause and new source. A muted element never counts: when a long
 * sound stops, every resting element with a source is muted, and every play
 * path unmutes its own element first, so nothing sounds different.
 */

class FakeMedia {
  paused = true
  ended = false
  currentTime = 0
  duration = NaN
  readyState = 4
  networkState = 1
  mutedSets = 0
  plays = 0
  mutedAtPlay: boolean | null = null
  src: string | null = null
  private m = false
  private listeners = new Map<string, Set<() => void>>()
  get muted(): boolean {
    return this.m
  }
  set muted(v: boolean) {
    this.mutedSets++
    this.m = v
  }
  get currentSrc(): string {
    return this.src ?? ''
  }
  getAttribute(name: string): string | null {
    return name === 'src' ? this.src : null
  }
  addEventListener(type: string, fn: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(fn)
  }
  removeEventListener(type: string, fn: () => void) {
    this.listeners.get(type)?.delete(fn)
  }
  fire(type: string) {
    for (const fn of this.listeners.get(type) ?? []) fn()
  }
  play(): Promise<void> {
    this.plays++
    this.mutedAtPlay = this.m
    this.paused = false
    return Promise.resolve()
  }
  /** The sound ran out. */
  end() {
    this.paused = true
    this.ended = true
    this.fire('pause')
    this.fire('ended')
  }
}

const media = (opts: Partial<Pick<FakeMedia, 'duration' | 'src'>> = {}) => {
  const el = Object.assign(new FakeMedia(), opts)
  watchMedia(el as unknown as HTMLMediaElement)
  return el
}

beforeEach(() => resetMediaQuietForTests())

describe('resting sound elements and Now Playing', () => {
  it('mutes every resting element with a sound when a long sound ends, and leaves the rest alone', () => {
    const fanfare = media({ duration: 1.84, src: 'wheel-win.wav' })
    const words = [media({ duration: 0.6, src: 'hus.mp3' }), media({ duration: 0.7, src: 'mor.mp3' })]
    const spare = media({ src: null })
    const sounding = media({ duration: 0.5, src: 'far.mp3' })
    void sounding.play()
    void fanfare.play()
    fanfare.currentTime = 1.84
    fanfare.end()
    expect(fanfare.muted).toBe(true)
    for (const w of words) expect(w.muted).toBe(true)
    // No source: never in Now Playing, and each change would be one more update.
    expect(spare.mutedSets).toBe(0)
    // Never muted while it plays.
    expect(sounding.muted).toBe(false)
  })

  it('does nothing when a short word ends: no update per word', () => {
    const other = media({ duration: 0.6, src: 'mor.mp3' })
    const word = media({ duration: 0.65, src: 'hus.mp3' })
    void word.play()
    word.currentTime = 0.65
    word.end()
    expect(word.mutedSets + other.mutedSets).toBe(0)
  })

  it('counts a long sound cut short (the clack track at the end of a spin), not a prime that never ran', () => {
    const track = media({ duration: 4.2, src: 'data:audio/wav;base64,' })
    const word = media({ duration: 0.6, src: 'hus.mp3' })
    // A prime: started and paused at once, still at 0.
    track.fire('pause')
    expect(word.muted).toBe(false)
    // A spin's track, silenced after it ran.
    void track.play()
    track.currentTime = 3.1
    track.paused = true
    track.fire('pause')
    expect(word.muted).toBe(true)
    expect(track.muted).toBe(true)
  })

  it('unmutes an element just before it plays, and only when it is muted', async () => {
    const word = media({ duration: 0.6, src: 'hus.mp3' })
    wake(word as unknown as HTMLMediaElement)
    expect(word.mutedSets).toBe(0)
    word.muted = true
    // The word player's start (speak.ts) wakes its element as it plays it.
    await startWhenReady(word as unknown as HTMLMediaElement, 0)
    expect(word.mutedAtPlay).toBe(false)
    expect(word.muted).toBe(false)
  })

  it('watches an element once, however often it is readied again', () => {
    const el = new FakeMedia()
    el.duration = 2
    el.src = 'x.mp3'
    watchMedia(el as unknown as HTMLMediaElement)
    watchMedia(el as unknown as HTMLMediaElement)
    const word = media({ duration: 0.6, src: 'hus.mp3' })
    void el.play()
    el.currentTime = 2
    el.end()
    // One listener pair: muted once, not twice.
    expect(word.mutedSets).toBe(1)
    quietAll()
    expect(word.mutedSets).toBe(1)
  })
})
