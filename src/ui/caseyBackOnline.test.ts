import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CASEY_BACK_CHECK_MS, watchForCaseyBack } from './caseyBackOnline'

/**
 * During an offline round the game watches for Casey's server, so it can offer
 * normal Casey back. These pin when it asks (and when it must not spend a
 * request) and that it stops after the first answer.
 */
describe('watching for Casey during an offline round', () => {
  let events: EventTarget
  let onScreen: boolean
  let online: boolean
  let reachable: ReturnType<typeof vi.fn<() => Promise<boolean>>>
  let onBack: ReturnType<typeof vi.fn<() => void>>
  let stop: () => void

  beforeEach(() => {
    vi.useFakeTimers()
    events = new EventTarget()
    onScreen = true
    online = true
    reachable = vi.fn<() => Promise<boolean>>().mockResolvedValue(false)
    onBack = vi.fn<() => void>()
    stop = watchForCaseyBack({
      reachable,
      onBack,
      events: events as unknown as Window,
      isOnScreen: () => onScreen,
      maybeOnline: () => online,
    })
  })

  afterEach(() => {
    stop()
    vi.useRealTimers()
  })

  it('asks every half minute, and keeps watching while Casey stays unreachable', async () => {
    await vi.advanceTimersByTimeAsync(CASEY_BACK_CHECK_MS - 1)
    expect(reachable).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(reachable).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(CASEY_BACK_CHECK_MS)
    expect(reachable).toHaveBeenCalledTimes(2)
    expect(onBack).not.toHaveBeenCalled()
  })

  it('asks at once when the phone reports a connection, and stops after Casey answers', async () => {
    reachable.mockResolvedValue(true)
    events.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(0)
    expect(reachable).toHaveBeenCalledTimes(1)
    expect(onBack).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(CASEY_BACK_CHECK_MS * 3)
    events.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(0)
    expect(reachable).toHaveBeenCalledTimes(1)
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('sends nothing while the phone says it is offline or the app is off screen', async () => {
    online = false
    await vi.advanceTimersByTimeAsync(CASEY_BACK_CHECK_MS)
    online = true
    onScreen = false
    await vi.advanceTimersByTimeAsync(CASEY_BACK_CHECK_MS)
    expect(reachable).not.toHaveBeenCalled()

    // Coming back on screen is itself a reason to ask.
    onScreen = true
    events.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)
    expect(reachable).toHaveBeenCalledTimes(1)
  })

  it('never has two checks in flight', async () => {
    let answer: (value: boolean) => void = () => {}
    reachable.mockImplementation(() => new Promise<boolean>((resolve) => (answer = resolve)))
    events.dispatchEvent(new Event('online'))
    events.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(CASEY_BACK_CHECK_MS)
    expect(reachable).toHaveBeenCalledTimes(1)
    answer(false)
  })

  it('does nothing once stopped', async () => {
    stop()
    reachable.mockResolvedValue(true)
    events.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(CASEY_BACK_CHECK_MS * 2)
    expect(reachable).not.toHaveBeenCalled()
    expect(onBack).not.toHaveBeenCalled()
  })
})
