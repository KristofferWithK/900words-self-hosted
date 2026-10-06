import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

/**
 * The performance log's recorder (recorder.ts), in node with just enough of a
 * browser faked: a window and a document that hold listeners, a Storage
 * class, media and canvas elements. The point of the first test is the
 * promise made to players: OFF, nothing of the app's world is touched.
 */

class FakeStorage {
  private data = new Map<string, string>()
  get length() {
    return this.data.size
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null
  }
  getItem(k: string) {
    return this.data.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.data.set(k, String(v))
  }
  removeItem(k: string) {
    this.data.delete(k)
  }
}
class FakeMedia {
  private s = ''
  get src() {
    return this.s
  }
  set src(v: string) {
    this.s = v
  }
  play(): Promise<void> {
    return Promise.resolve()
  }
}
class FakeAudio extends FakeMedia {
  constructor(src?: string) {
    super()
    if (src !== undefined) this.src = src
  }
}
class FakeCanvas {
  width = 300
  height = 150
  toDataURL() {
    return 'data:,'
  }
}

const g = globalThis as unknown as Record<string, unknown>
const saved: Record<string, unknown> = {}
const FAKES = ['window', 'document', 'localStorage', 'Storage', 'HTMLMediaElement', 'HTMLCanvasElement', 'navigator']

function fakeBrowser() {
  for (const k of FAKES) saved[k] = g[k]
  const win = new EventTarget() as unknown as Record<string, unknown>
  Object.assign(win, {
    setTimeout: globalThis.setTimeout,
    setInterval: globalThis.setInterval,
    clearTimeout: globalThis.clearTimeout,
    clearInterval: globalThis.clearInterval,
    requestAnimationFrame: (cb: FrameRequestCallback) => globalThis.setTimeout(() => cb(performance.now()), 16),
    Audio: FakeAudio,
    innerWidth: 390,
    innerHeight: 844,
    devicePixelRatio: 3,
    screen: { width: 390, height: 844 },
    sessionStorage: new FakeStorage(),
  })
  const doc = new EventTarget() as unknown as Record<string, unknown>
  Object.assign(doc, {
    createElement: (tag: string) => (tag === 'canvas' ? new FakeCanvas() : tag === 'audio' ? new FakeAudio() : {}),
    getElementsByTagName: () => [],
    timeline: { currentTime: null },
  })
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X)' }, configurable: true })
  Object.assign(g, {
    window: win,
    document: doc,
    Storage: FakeStorage,
    localStorage: new FakeStorage(),
    HTMLMediaElement: FakeMedia,
    HTMLCanvasElement: FakeCanvas,
  })
  return { win, doc }
}

let browser: ReturnType<typeof fakeBrowser>
let R: typeof import('./recorder')

beforeAll(async () => {
  browser = fakeBrowser()
  R = await import('./recorder')
})
afterEach(() => R.resetDiagForTests())
afterAll(() => {
  for (const k of FAKES) {
    if (k === 'navigator') Object.defineProperty(globalThis, 'navigator', { value: saved[k], configurable: true })
    else g[k] = saved[k]
  }
})

const wait = (ms: number) => new Promise((r) => globalThis.setTimeout(r, ms))

describe('the performance recorder', () => {
  it('installs nothing and records nothing while off', async () => {
    const before = {
      setTimeout: browser.win.setTimeout,
      addEventListener: browser.win.addEventListener,
      Audio: browser.win.Audio,
      setItem: FakeStorage.prototype.setItem,
      play: FakeMedia.prototype.play,
      createElement: browser.doc.createElement,
    }
    let added = 0
    const add = EventTarget.prototype.addEventListener
    EventTarget.prototype.addEventListener = function (this: EventTarget, ...a: Parameters<typeof add>) {
      added++
      return add.apply(this, a)
    }
    try {
      R.diagHit('answer-right')
      expect(R.diagHaptic()).toBe(false)
      R.diagMark('x')
      expect(R.snapshot('interval')).toBeNull()
      await wait(20)
    } finally {
      EventTarget.prototype.addEventListener = add
    }
    expect(added).toBe(0)
    expect(R.diagRecording()).toBe(false)
    expect(R.diagEvents()).toHaveLength(0)
    expect(browser.win.setTimeout).toBe(before.setTimeout)
    expect(browser.win.addEventListener).toBe(before.addEventListener)
    expect(browser.win.Audio).toBe(before.Audio)
    expect(FakeStorage.prototype.setItem).toBe(before.setItem)
    expect(FakeMedia.prototype.play).toBe(before.play)
    expect(browser.doc.createElement).toBe(before.createElement)
  })

  it('records a hit with its timings, and puts every original back when turned off', async () => {
    const original = { setTimeout: browser.win.setTimeout, setItem: FakeStorage.prototype.setItem, play: FakeMedia.prototype.play }
    R.startRecording()
    expect(R.diagRecording()).toBe(true)
    expect(browser.win.setTimeout).not.toBe(original.setTimeout)

    R.diagHit('answer-wrong')
    R.diagHaptic()
    const Audio = browser.win.Audio as typeof FakeAudio
    void new Audio('x.mp3').play()
    await wait(1700)
    const hit = R.diagEvents().find((e): e is import('./recorder').HitEvent => e.type === 'hit')
    expect(hit).toBeDefined()
    expect(hit!.kind).toBe('answer-wrong')
    expect(hit!.handler).not.toBeNull()
    expect(hit!.haptic).not.toBeNull()
    expect(hit!.playCall).not.toBeNull()
    expect(hit!.playResolved).not.toBeNull()
    expect(hit!.firstFrame).not.toBeNull()
    expect(hit!.worstGap).not.toBeNull()
    expect(hit!.frames).toBeGreaterThan(0)
    expect(typeof hit!.cost).toBe('number')
    expect(hit!.up).toBeGreaterThan(0)

    R.stopRecording()
    expect(browser.win.setTimeout).toBe(original.setTimeout)
    expect(FakeStorage.prototype.setItem).toBe(original.setItem)
    expect(FakeMedia.prototype.play).toBe(original.play)
  })

  it('counts what piles up: media, canvases, storage writes, listeners and timers', () => {
    R.startRecording()
    const doc = browser.doc as unknown as Document
    const win = browser.win as unknown as Window
    new (browser.win.Audio as typeof FakeAudio)()
    doc.createElement('canvas')
    doc.createElement('audio')
    localStorage.setItem('cluecab-test', 'x'.repeat(100))
    const keep = () => {}
    win.addEventListener('resize', keep)
    win.setTimeout(() => {}, 60_000)
    const snap = R.snapshot('home')!
    expect(snap.audio.created).toBe(2)
    expect(snap.canvas.created).toBe(1)
    expect(snap.canvas.alivePixels).toBe(300 * 150)
    expect(snap.storage.setItems).toBeGreaterThanOrEqual(1)
    expect(snap.storage.largest[0]!.key).toBe('cluecab-test')
    expect(snap.storage.chars).toBeGreaterThanOrEqual(112)
    expect(snap.listeners.window).toBe(1)
    expect(snap.listeners.byType['window:resize']).toBe(1)
    expect(snap.timers.timeouts).toBeGreaterThanOrEqual(1)
    expect(snap.memory).toBeNull()
    win.removeEventListener('resize', keep)
  })

  it('counts media elements reused (a new src on an element that had one) apart from those made', () => {
    R.startRecording()
    const Audio = browser.win.Audio as typeof FakeAudio
    const a = new Audio()
    a.src = 'one.mp3'
    a.src = 'two.mp3'
    const b = new Audio()
    b.src = 'three.mp3'
    const snap = R.snapshot('interval')!
    expect(snap.audio.created).toBe(2)
    expect(snap.audio.srcSets).toBe(3)
    const wrapped = Object.getOwnPropertyDescriptor(FakeMedia.prototype, 'src')!.set
    expect(snap.audio.reloaded).toBe(1)
    R.stopRecording()
    expect(Object.getOwnPropertyDescriptor(FakeMedia.prototype, 'src')!.set).not.toBe(wrapped)
  })

  it("adds the word player's pool to each snapshot once it is handed a probe", () => {
    R.startRecording()
    expect(R.snapshot('interval')!.audio.pool).toBeUndefined()
    R.setWordPoolProbe(() => ({ loaded: 8, spare: 12, limit: 8, scope: 'sightseeing' }))
    expect(R.snapshot('interval')!.audio.pool).toEqual({ loaded: 8, spare: 12, limit: 8, scope: 'sightseeing' })
    R.stopRecording()
  })

  it('tells an article answer from a meaning answer by the gate just resolved', async () => {
    R.startRecording()
    R.diagAnswer(true, { state: { gates: [{ resolved: true, kind: 'meaning' }, { resolved: true, kind: 'article' }, { resolved: false, kind: 'meaning' }] } })
    R.diagAnswer(true, { state: { gates: [{ resolved: true, kind: 'meaning' }, { resolved: false, kind: 'article' }] } })
    await wait(1700)
    expect(R.diagEvents().filter((e) => e.type === 'hit').map((e) => (e as { kind: string }).kind)).toEqual(['article-right', 'answer-right'])
  })

  it('stays bounded: 5,000 events and about a megabyte at most', () => {
    R.startRecording()
    for (let i = 0; i < 6000; i++) R.diagMark(`m${i}`)
    expect(R.diagEvents().length).toBeLessThanOrEqual(5000)
    expect((R.diagEvents().at(-1) as { what: string }).what).toBe('m5999')
    for (let i = 0; i < 1500; i++) R.diagMark('y'.repeat(2000))
    expect(JSON.stringify(R.diagEvents()).length).toBeLessThan(1_050_000)
  })

  it('exports one JSON document with the device, the switches and a summary', () => {
    R.startRecording()
    const log = JSON.parse(JSON.stringify(R.buildDiagLog('abc1234', '124')))
    expect(log.format).toBe('900words-perf-log')
    expect(log.device.build).toBe('abc1234')
    expect(log.device.testFlight).toBe('124')
    expect(log.device.ios).toBe('18.6')
    expect(log.device.dpr).toBe(3)
    expect(Array.isArray(log.switches)).toBe(true)
    expect(log.recording.on).toBe(true)
    expect(log.summary.hits).toBe(0)
    expect(log.events.some((e: { type: string; reason?: string }) => e.type === 'snap' && e.reason === 'export')).toBe(true)
  })
})

describe('the summary', () => {
  const hit = (cost: number, kind: import('./recorder').HitKind = 'card') =>
    ({ type: 'hit', kind, t: 0, up: 0, inputDelay: 0, handler: 0, firstFrame: 0, worstGap: cost, frames: 1, haptic: null, playCall: null, playResolved: null, cost }) as const

  it('compares the first 50 word hits with the last 50, leaving steering out', () => {
    const list = [...Array.from({ length: 60 }, () => hit(10)), hit(999, 'steer'), ...Array.from({ length: 60 }, (_, i) => hit(i === 59 ? 300 : 40))]
    const s = R.summarize(list)
    expect(s.hits).toBe(120)
    expect(s.steers).toBe(1)
    expect(s.first50).toEqual({ n: 50, median: 10, worst: 10 })
    expect(s.last50).toEqual({ n: 50, median: 40, worst: 300 })
  })

  it('reads the iOS version from the user agent', () => {
    expect(R.iosVersion('Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15')).toBe('18.6.2')
    expect(R.iosVersion('Mozilla/5.0 (X11; Linux x86_64)')).toBeNull()
  })
})
