import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The UI sound effects on media elements (sfx.ts), exercised through the
 * functions the game actually calls (feedback.ts).
 *
 * The suite runs in node, so the browser is faked: `FakeAudio` is a media
 * element with WebKit's gesture rule built in — under the `needs-gesture`
 * policy an element may start audibly only after it has once been started
 * inside a gesture, and `revokeAll()` takes that away again, the way a lock
 * screen or an interruption does on a phone. `document` and `window` are
 * just enough to hold listeners and dispatch to them.
 *
 * What is counted is an AUDIBLE start: `play()` accepted while not muted.
 * The prime's muted start-and-stop is recorded but is not a sound.
 */
type Policy = 'allow' | 'needs-gesture'

class FakeAudio {
  static made: FakeAudio[] = []
  static policy: Policy = 'allow'
  static inGesture = false
  static audible: Array<{ el: FakeAudio; src: string }> = []

  src: string
  preload = ''
  dataset: Record<string, string> = {}
  muted = false
  paused = true
  ended = false
  currentTime = 0
  unlocked = false

  constructor(src = '') {
    this.src = src
    FakeAudio.made.push(this)
  }

  play(): Promise<void> {
    if (FakeAudio.inGesture) this.unlocked = true
    if (FakeAudio.policy === 'needs-gesture' && !this.unlocked) {
      return Promise.reject(Object.assign(new Error('not allowed'), { name: 'NotAllowedError' }))
    }
    this.paused = false
    this.ended = false
    if (!this.muted) FakeAudio.audible.push({ el: this, src: this.src })
    return Promise.resolve()
  }

  pause(): void {
    this.paused = true
  }

  /** The phone took playback away (lock screen, call, session reset). */
  static revokeAll(): void {
    for (const el of FakeAudio.made) el.unlocked = false
  }
}

type Listener = (event: { isTrusted: boolean }) => void
const docListeners = new Map<string, Listener[]>()
const fakeDocument = {
  visibilityState: 'visible' as 'visible' | 'hidden',
  addEventListener(type: string, fn: Listener) {
    docListeners.set(type, [...(docListeners.get(type) ?? []), fn])
  },
}
const fire = (type: string, isTrusted = true) => {
  for (const fn of docListeners.get(type) ?? []) fn({ isTrusted })
}
/** A real tap: the listeners run inside the gesture, the way the capture listener does. */
const tap = (handler?: () => void) => {
  FakeAudio.inGesture = true
  try {
    fire('touchend')
    handler?.()
  } finally {
    FakeAudio.inGesture = false
  }
}

const sfxEvents: string[] = []
/** The settings store persists through window.localStorage once a window exists. */
const memoryStorage = () => {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}
const fakeWindow = {
  addEventListener: (_type: string, _fn: Listener) => {},
  dispatchEvent: (event: CustomEvent<{ kind: string }>) => {
    sfxEvents.push(event.detail.kind)
    return true
  },
}

/** An AudioContext that can never run — the state that used to silence every effect. */
const contextsMade = vi.fn()
class DeadAudioContext {
  state = 'suspended'
  constructor() {
    contextsMade()
  }
  resume() {
    return Promise.reject(new Error('the session is gone'))
  }
}

const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

const audibleKinds = () => FakeAudio.audible.map((p) => p.el.dataset.sfx)

async function load() {
  const feedback = await import('./feedback')
  const sfx = await import('./sfx')
  const { useSettings } = await import('../stores/settingsStore')
  useSettings.setState({ sound: true })
  sfx.installSfxUnlock()
  return { ...feedback, ...sfx, useSettings }
}

beforeEach(() => {
  FakeAudio.made = []
  FakeAudio.audible = []
  FakeAudio.policy = 'allow'
  FakeAudio.inGesture = false
  docListeners.clear()
  sfxEvents.length = 0
  contextsMade.mockClear()
  fakeDocument.visibilityState = 'visible'
  vi.stubGlobal('Audio', FakeAudio)
  vi.stubGlobal('document', fakeDocument)
  const localStorage = memoryStorage()
  vi.stubGlobal('localStorage', localStorage)
  vi.stubGlobal('window', { ...fakeWindow, localStorage, AudioContext: DeadAudioContext })
  vi.stubGlobal('AudioContext', DeadAudioContext)
  vi.stubGlobal('navigator', { vibrate: () => true })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('the sound effects do not depend on the AudioContext', () => {
  it('plays all three while the only AudioContext is suspended for good', async () => {
    const fx = await load()
    fx.wheelSpinTick()
    fx.guessErrorBlip()
    fx.wheelWinFanfare()
    expect(audibleKinds().sort()).toEqual(['blip', 'fanfare', 'tick'])
    // And nothing even tried to make one.
    expect(contextsMade).not.toHaveBeenCalled()
  })

  it('plays each effect from its own frozen file under audio/ui/', async () => {
    const fx = await load()
    fx.wheelSpinTick()
    fx.guessErrorBlip()
    fx.wheelWinFanfare()
    expect(FakeAudio.audible.map((p) => p.src.replace(/^.*audio\/ui\//, ''))).toEqual([
      'wheel-tick.wav',
      'error-blip.wav',
      'wheel-win.wav',
    ])
    expect(sfxEvents).toEqual(['tick', 'blip', 'fanfare'])
  })

  it('has no suitcase clack any more (owner, 2026-09-26: the green haptic is enough)', async () => {
    const fx = await load()
    expect('suitcaseClack' in fx).toBe(false)
    expect(Object.keys(fx.SFX_FILES).sort()).toEqual(['blip', 'fanfare', 'tick'])
  })

  it('never pauses or takes over an element it did not make (the word player)', async () => {
    const fx = await load()
    const speech = new FakeAudio('audio/da/hus.mp3')
    await speech.play()
    fx.guessErrorBlip()
    fx.wheelSpinTick()
    tap(() => fx.primeTurnClick())
    expect(speech.paused).toBe(false)
    expect(speech.muted).toBe(false)
    expect(speech.src).toBe('audio/da/hus.mp3')
    // The speech element's own start is the first entry; the effects follow it.
    expect(audibleKinds()).toEqual([undefined, 'blip', 'tick'])
  })
})

describe('the sound preference', () => {
  it('plays nothing at all with sound off, and primes nothing', async () => {
    vi.useFakeTimers()
    const fx = await load()
    fx.useSettings.setState({ sound: false })
    tap(() => fx.primeRewardDing())
    fx.wheelSpinTick()
    fx.guessErrorBlip()
    fx.wheelWinFanfare()
    vi.advanceTimersByTime(1000)
    expect(FakeAudio.audible).toHaveLength(0)
    expect(sfxEvents).toHaveLength(0)
  })

  it('keeps the haptics with sound off', async () => {
    const vibrate = vi.fn(() => true)
    vi.stubGlobal('navigator', { vibrate })
    const fx = await load()
    fx.useSettings.setState({ sound: false })
    fx.turnHaptic()
    fx.guessResultHaptic('bystander')
    expect(vibrate).toHaveBeenCalledWith(12)
    expect(vibrate).toHaveBeenCalledWith(40)
  })
})

describe('the wheel ticks', () => {
  it('sounds every boundary crossing, even while earlier ticks are still ringing', async () => {
    const fx = await load()
    // No element ever reports `ended` here: every tick is still "sounding"
    // when the next arrives — the spin's fastest case.
    for (let i = 0; i < 12; i++) fx.wheelSpinTick()
    const ticks = FakeAudio.audible.filter((p) => p.el.dataset.sfx === 'tick')
    expect(ticks).toHaveLength(12)
    // Spread over a bounded pool rather than one element restarted in place…
    const used = new Set(ticks.map((p) => p.el))
    expect(used.size).toBeGreaterThan(1)
    // …and never an unbounded one.
    expect(FakeAudio.made.filter((el) => el.dataset.sfx === 'tick').length).toBeLessThanOrEqual(4)
  })

  it('reuses an element whose tick has finished before one that is still ringing', async () => {
    const fx = await load()
    fx.wheelSpinTick()
    const first = FakeAudio.audible[0]!.el
    first.ended = true
    first.paused = true
    fx.wheelSpinTick()
    fx.wheelSpinTick()
    const els = FakeAudio.audible.map((p) => p.el)
    expect(new Set(els).size).toBe(3)
  })
})

describe('priming from a gesture', () => {
  it('lets Casey\'s later blips play after the Give clue tap, with no gesture of their own', async () => {
    vi.useFakeTimers()
    FakeAudio.policy = 'needs-gesture'
    const fx = await load()
    // The composer's Give clue tap: synchronous prime, then Casey's turn runs on timers.
    tap(() => fx.primeRewardDing())
    // The prime itself makes no sound.
    expect(FakeAudio.audible).toHaveLength(0)
    setTimeout(() => fx.guessErrorBlip(), 2500)
    setTimeout(() => fx.guessErrorBlip(), 5000)
    vi.advanceTimersByTime(2500)
    expect(audibleKinds()).toEqual(['blip'])
    vi.advanceTimersByTime(2500)
    await settle()
    expect(audibleKinds()).toEqual(['blip', 'blip'])
    expect(fx.sfxNeedsPrime()).toBe(false)
  })

  it('primes the ticks on the wheel tap, before the rAF loop asks for them', async () => {
    FakeAudio.policy = 'needs-gesture'
    const fx = await load()
    tap(() => fx.primeRewardDing())
    for (let i = 0; i < 6; i++) fx.wheelSpinTick()
    fx.wheelWinFanfare()
    await settle()
    expect(audibleKinds()).toEqual(['tick', 'tick', 'tick', 'tick', 'tick', 'tick', 'fanfare'])
  })

  it('recovers after the phone takes playback away: prime, play, revoke, prime again, play again', async () => {
    FakeAudio.policy = 'needs-gesture'
    const fx = await load()
    tap(() => fx.primeTurnClick())
    fx.guessErrorBlip()
    expect(audibleKinds()).toEqual(['blip'])
    expect(fx.sfxNeedsPrime()).toBe(false)

    // Locked, backgrounded, interrupted: every element loses its permission.
    FakeAudio.revokeAll()
    fakeDocument.visibilityState = 'visible'
    fire('visibilitychange')
    expect(fx.sfxNeedsPrime()).toBe(true)

    // The next ordinary tap anywhere re-primes, through the one document listener.
    tap()
    expect(fx.sfxNeedsPrime()).toBe(false)
    fx.guessErrorBlip()
    fx.wheelSpinTick()
    expect(audibleKinds()).toEqual(['blip', 'blip', 'tick'])
  })

  it('marks itself for priming again when a play is refused, and heals on the next tap', async () => {
    FakeAudio.policy = 'needs-gesture'
    const fx = await load()
    tap(() => fx.primeTurnClick())
    // Revoked with no visibility event to announce it.
    FakeAudio.revokeAll()
    fx.guessErrorBlip()
    await settle()
    expect(FakeAudio.audible).toHaveLength(0)
    expect(fx.sfxNeedsPrime()).toBe(true)
    tap()
    fx.guessErrorBlip()
    expect(audibleKinds()).toEqual(['blip'])
  })

  it('ignores a script-dispatched event, which carries no user activation', async () => {
    FakeAudio.policy = 'needs-gesture'
    const fx = await load()
    fire('click', false)
    expect(fx.sfxNeedsPrime()).toBe(true)
    expect(FakeAudio.made).toHaveLength(0)
  })

  it('does not cut off an effect that is sounding when a later tap primes', async () => {
    const fx = await load()
    fx.wheelWinFanfare()
    const fanfare = FakeAudio.audible[0]!.el
    tap(() => fx.primeRewardDing())
    expect(fanfare.paused).toBe(false)
    expect(fanfare.muted).toBe(false)
  })

  it('never lets an audio failure escape into the game action', async () => {
    vi.stubGlobal(
      'Audio',
      class {
        constructor() {
          throw new Error('no media')
        }
      },
    )
    const fx = await load()
    expect(() => fx.guessErrorBlip()).not.toThrow()
    expect(() => fx.wheelSpinTick()).not.toThrow()
    expect(() => tap(() => fx.primeRewardDing())).not.toThrow()
  })
})

/**
 * The phone (2026-09-30). The shell plays without a gesture, so there is
 * nothing to prime, and priming there only put seven media players inside the
 * first tap after a launch or a return, ahead of that tap's own haptic. The
 * players are built once the launch settles instead. The haptics warm-up
 * lives beside them in feedback.ts and is exercised here for the same
 * mocked shell.
 */
describe('in the native shell', () => {
  const haptics = { impact: vi.fn(async () => {}), notification: vi.fn(async () => {}), selectionStart: vi.fn(async () => {}) }
  const shell = async (native: boolean) => {
    vi.doMock('@capacitor/core', async (importOriginal) => {
      const real = await importOriginal<typeof import('@capacitor/core')>()
      return {
        ...real,
        Capacitor: { isNativePlatform: () => native, getPlatform: () => (native ? 'ios' : 'web') },
      }
    })
    vi.doMock('@capacitor/haptics', () => ({
      Haptics: haptics,
      ImpactStyle: { Light: 'LIGHT', Heavy: 'HEAVY' },
      NotificationType: { Success: 'SUCCESS' },
    }))
    return load()
  }

  beforeEach(() => {
    haptics.selectionStart.mockClear()
    haptics.impact.mockClear()
  })
  afterEach(() => {
    vi.doUnmock('@capacitor/core')
    vi.doUnmock('@capacitor/haptics')
  })

  it('primes nothing inside a tap, and builds the players once the launch settles', async () => {
    vi.useFakeTimers()
    const fx = await shell(true)
    tap(() => fx.primeRewardDing())
    tap()
    expect(FakeAudio.made).toHaveLength(0)
    expect(fx.sfxNeedsPrime()).toBe(false)
    vi.advanceTimersByTime(1500)
    // tick 4 + blip 2 + fanfare 1, built but silent.
    expect(FakeAudio.made).toHaveLength(7)
    expect(FakeAudio.audible).toHaveLength(0)
    fx.guessErrorBlip()
    expect(audibleKinds()).toEqual(['blip'])
    // The blip started one of the players built ahead, not a new one.
    expect(FakeAudio.made).toHaveLength(7)
  })

  it('builds nothing ahead when sound is off', async () => {
    vi.useFakeTimers()
    const fx = await shell(true)
    fx.useSettings.setState({ sound: false })
    vi.advanceTimersByTime(1500)
    expect(FakeAudio.made).toHaveLength(0)
  })

  it('warms the Taptic Engine on a touch, at most once a second', async () => {
    const now = vi.spyOn(performance, 'now')
    const fx = await shell(true)
    now.mockReturnValue(10_000)
    fx.prepareHaptics()
    now.mockReturnValue(10_400)
    fx.prepareHaptics()
    expect(haptics.selectionStart).toHaveBeenCalledTimes(1)
    now.mockReturnValue(11_100)
    fx.prepareHaptics()
    expect(haptics.selectionStart).toHaveBeenCalledTimes(2)
    // Warming is not a tick.
    expect(haptics.impact).not.toHaveBeenCalled()
    now.mockRestore()
  })

  it('leaves the web as it was: the gesture still primes, and nothing is warmed', async () => {
    FakeAudio.policy = 'needs-gesture'
    const fx = await shell(false)
    fx.prepareHaptics()
    expect(haptics.selectionStart).not.toHaveBeenCalled()
    tap()
    expect(fx.sfxNeedsPrime()).toBe(false)
    expect(FakeAudio.made).toHaveLength(7)
  })
})
