import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTOPLAY_SECONDS, autoplaysNext, cancelOnHide, startCountdown, type AutoplayFacts } from './runAutoplay'

const lost: AutoplayFacts = { walk: 'words', firstWalk: false, end: 'second-wrong', canStart: true }

describe('whether a lost walk starts the next one by itself', () => {
  it('counts down after a lost walk, article gates and all, when another walk may start', () => {
    expect(AUTOPLAY_SECONDS).toBe(4)
    expect(autoplaysNext(lost)).toBe(true)
  })

  it('not when today\'s free walks are used: the tag leads to the daily limit as before', () => {
    expect(autoplaysNext({ ...lost, canStart: false })).toBe(false)
  })

  it('never on the train run, and never on the first session\'s walk', () => {
    expect(autoplaysNext({ ...lost, walk: 'train' })).toBe(false)
    expect(autoplaysNext({ ...lost, walk: 'train', end: 'caught' })).toBe(false)
    expect(autoplaysNext({ ...lost, firstWalk: true })).toBe(false)
  })

  it('only after a loss: a run that was left does not start another', () => {
    expect(autoplaysNext({ ...lost, end: 'left' })).toBe(false)
  })
})

describe('the countdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows 4 at once, then 3, 2, 1, one a second, and starts the walk when the fourth second is over', () => {
    const ticks: number[] = []
    const done = vi.fn()
    startCountdown(AUTOPLAY_SECONDS, (n) => ticks.push(n), done)
    expect(ticks).toEqual([4])
    vi.advanceTimersByTime(999)
    expect(ticks).toEqual([4])
    vi.advanceTimersByTime(1)
    expect(ticks).toEqual([4, 3])
    vi.advanceTimersByTime(2000)
    expect(ticks).toEqual([4, 3, 2, 1])
    expect(done).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(done).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(10_000)
    expect(ticks).toEqual([4, 3, 2, 1])
    expect(done).toHaveBeenCalledTimes(1)
  })

  it('a cancel (a tap, leaving the panel or the screen, a pause) stops it for good', () => {
    const ticks: number[] = []
    const done = vi.fn()
    const c = startCountdown(AUTOPLAY_SECONDS, (n) => ticks.push(n), done)
    vi.advanceTimersByTime(2500)
    c.cancel()
    c.cancel()
    vi.advanceTimersByTime(10_000)
    expect(ticks).toEqual([4, 3, 2])
    expect(done).not.toHaveBeenCalled()
  })

  it('hiding the app (backgrounded, the phone locked) or the page going away stops it', () => {
    const listeners = new Map<string, () => void>()
    const target = {
      addEventListener: (type: string, fn: () => void) => void listeners.set(type, fn),
      removeEventListener: (type: string, fn: () => void) => {
        if (listeners.get(type) === fn) listeners.delete(type)
      },
    }
    const doc = { ...target, visibilityState: 'visible' as DocumentVisibilityState }
    const on = { document: doc, window: target } as unknown as Parameters<typeof cancelOnHide>[1]

    for (const how of ['hidden', 'pagehide'] as const) {
      const done = vi.fn()
      const c = startCountdown(AUTOPLAY_SECONDS, () => {}, done)
      const stop = cancelOnHide(c.cancel, on)
      // Coming back into view does not stop it.
      doc.visibilityState = 'visible'
      listeners.get('visibilitychange')!()
      vi.advanceTimersByTime(1000)
      if (how === 'hidden') {
        doc.visibilityState = 'hidden'
        listeners.get('visibilitychange')!()
      } else listeners.get('pagehide')!()
      vi.advanceTimersByTime(10_000)
      expect(done, how).not.toHaveBeenCalled()
      stop()
      expect(listeners.size, how).toBe(0)
      doc.visibilityState = 'visible'
    }
  })
})
