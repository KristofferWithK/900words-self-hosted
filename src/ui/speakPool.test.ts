import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { claimWordPool, elementPoolForTests, releasePooledElement, setWordPoolLimit, WORD_POOL_LIMITS, wordPoolStats } from './speak'

// The pool's own listeners are what these tests count; the Now Playing
// watch every element also carries (mediaQuiet.ts) has tests of its own.
vi.mock('./mediaQuiet', async (actual) => ({ ...(await actual<typeof import('./mediaQuiet')>()), watchMedia: () => {} }))

/**
 * THE WARM ELEMENTS ARE REUSED (long sessions, builds 123 and 124), AND EACH
 * SCREEN HOLDS ONLY ITS OWN FEW (after build 124). A screen claims a word pool
 * of its own size (Sightseeing 8, the café board 20); the run readies a new
 * word every gate and a board eighteen, so a session readies hundreds of
 * clips. A clip readied into a full pool takes over the element of the clip
 * unused longest: no element is made beyond the cap, since in WebKit every
 * element made and not yet collected costs each later play (speak.ts, the
 * pool's note), and the old clip's media goes with the new load. Leaving a
 * screen releases all of its elements, and the next screen loads those same
 * elements rather than making new ones.
 */

class FakeAudio {
  static all: FakeAudio[] = []
  preload = ''
  dataset: Record<string, string> = {}
  currentTime = 0
  attrs = new Map<string, string>()
  listeners = new Map<string, Set<() => void>>()
  calls: string[] = []
  constructor() {
    FakeAudio.all.push(this)
  }
  set src(value: string) {
    this.attrs.set('src', value)
  }
  get src(): string {
    return this.attrs.get('src') ?? ''
  }
  removeAttribute(name: string) {
    this.attrs.delete(name)
    this.calls.push(`remove:${name}`)
  }
  addEventListener(type: string, fn: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(fn)
  }
  removeEventListener(type: string, fn: () => void) {
    this.listeners.get(type)?.delete(fn)
  }
  load() {
    this.calls.push(this.attrs.has('src') ? 'load' : 'load:empty')
  }
  pause() {
    this.calls.push('pause')
  }
  /** Every listener still attached, of any type. */
  get listening(): number {
    return [...this.listeners.values()].reduce((n, set) => n + set.size, 0)
  }
}

const revoked: string[] = []
let urls = 0

beforeEach(() => {
  FakeAudio.all = []
  revoked.length = 0
  vi.stubGlobal('Audio', FakeAudio)
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:clip-${++urls}`)
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((u: string) => void revoked.push(u))
})

afterEach(() => {
  elementPoolForTests.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const clip = new Blob([new Uint8Array([0xff, 0xfb])], { type: 'audio/mpeg' })
// A Danish word with a measured lead, so its element carries a parking listener.
const url = (i: number) => `/audio/da/hus.mp3?v=${i}`

describe('the word player element pool', () => {
  const MAX = WORD_POOL_LIMITS.cafe
  beforeEach(() => {
    claimWordPool('cafe', MAX)
  })

  it('never holds more than its cap, however many clips are readied', () => {
    for (let i = 0; i < MAX * 4; i++) elementPoolForTests.ready(`normal:w${i}`, url(i), clip)
    expect(elementPoolForTests.size).toBe(MAX)
  })

  it('makes no more elements than its cap, however many clips are readied (WebKit: every element made costs each play)', () => {
    for (let i = 0; i < MAX * 20; i++) elementPoolForTests.ready(`normal:w${i}`, url(i), clip)
    expect(FakeAudio.all).toHaveLength(MAX)
  })

  it('hands the element of the clip unused longest over to a new clip, its old media and listeners dropped', () => {
    const extra = 10
    for (let i = 0; i < MAX + extra; i++) elementPoolForTests.ready(`normal:w${i}`, url(i), clip)
    expect(FakeAudio.all).toHaveLength(MAX)
    const reused = FakeAudio.all.slice(0, extra)
    const kept = FakeAudio.all.slice(extra)
    reused.forEach((el, i) => {
      // Paused, then loaded with the new clip: the old media is gone with that load.
      expect(el.calls).toEqual(['load', 'pause', 'load'])
      expect(el.src).toBe(`blob:clip-${urls - extra + 1 + i}`)
      expect(el.dataset.clip).toBe(url(MAX + i))
      // One parking listener, the new clip's: the old one is off.
      expect(el.listeners.get('ended')?.size).toBe(1)
      expect(el.listeners.get('loadedmetadata')?.size).toBe(1)
    })
    // The old clips' blob URLs are given back.
    expect(revoked).toHaveLength(extra)
    // The elements still serving their first clip are untouched and ready.
    for (const el of kept) {
      expect(el.calls).toEqual(['load'])
      expect(el.attrs.has('src')).toBe(true)
    }
  })

  it('a clip readied after its element was handed over gets an element again, still within the cap', () => {
    for (let i = 0; i < MAX + 1; i++) elementPoolForTests.ready(`normal:w${i}`, url(i), clip)
    // w0 left the pool; asking for it again takes the next oldest element.
    const again = elementPoolForTests.ready('normal:w0', url(0), clip)
    expect(again.dataset.clip).toBe(url(0))
    expect(FakeAudio.all).toHaveLength(MAX)
    expect(elementPoolForTests.size).toBe(MAX)
  })

  it('reuses the warm element of a clip readied again rather than making another', () => {
    const a = elementPoolForTests.ready('normal:hus', url(1), clip)
    const b = elementPoolForTests.ready('normal:hus', url(1), clip)
    expect(b).toBe(a)
    expect(FakeAudio.all).toHaveLength(1)
  })

  it('never hands over the element that is playing while another can go', () => {
    for (let i = 0; i < MAX; i++) elementPoolForTests.ready(`normal:w${i}`, url(i), clip)
    const saying = FakeAudio.all[0]!
    elementPoolForTests.playing(saying as unknown as HTMLAudioElement)
    elementPoolForTests.ready('normal:next', url(99), clip)
    expect(saying.dataset.clip).toBe(url(0))
    expect(FakeAudio.all[1]!.dataset.clip).toBe(url(99))
  })

  it('releasePooledElement never throws for an element that will not let go', () => {
    const el = { pause: () => { throw new Error('no') }, removeAttribute: () => {}, load: () => {}, removeEventListener: () => {} }
    const scope = { name: 'x', limit: 1, released: false }
    expect(() => releasePooledElement({ el: el as unknown as HTMLAudioElement, startAt: 0, objectUrl: 'blob:x', scope })).not.toThrow()
    expect(revoked).toEqual(['blob:x'])
  })
})

/** Ready `n` clips the way a preload does: into `owner`'s pool, each the first of its own request. */
function readyGates(owner: unknown, n: number, from = 0) {
  for (let i = from; i < from + n; i++) elementPoolForTests.warm(`normal:g${i}`, url(i), clip, { owner, rank: 0 })
}

/** An element let go properly: paused, no source, emptied with load(), no listener left, its blob URL given back. */
function expectReleased(el: FakeAudio, blob: string) {
  expect(el.calls).toContain('pause')
  expect(el.attrs.has('src')).toBe(false)
  expect(el.calls.slice(-2)).toEqual(['remove:src', 'load:empty'])
  expect(el.listening).toBe(0)
  expect(revoked).toContain(blob)
}

describe("each screen its own word pool (owner, after build 124: \"Why 64? Wouldn't 8 be enough?\")", () => {
  it('sizes Sightseeing at 8 and the café board at 20', () => {
    expect(WORD_POOL_LIMITS.sightseeing).toBe(8)
    expect(WORD_POOL_LIMITS.cafe).toBe(20)
  })

  it('a walk never holds more than 8 elements, however many gates it readies and says', () => {
    const walk = claimWordPool('sightseeing', WORD_POOL_LIMITS.sightseeing)
    const owner = elementPoolForTests.owner()
    for (let gate = 0; gate < 200; gate++) {
      readyGates(owner, 1, gate)
      // The word said at each gate readies into the pool of the screen on top.
      elementPoolForTests.ready(`normal:g${Math.max(0, gate - 2)}`, url(gate), clip)
      expect(elementPoolForTests.sizeOf('sightseeing')).toBeLessThanOrEqual(8)
    }
    expect(FakeAudio.all).toHaveLength(8)
    walk.release()
  })

  it('a café board never holds more than 20, and every card of a dealt board of 18 is readied', () => {
    const cafe = claimWordPool('cafe', WORD_POOL_LIMITS.cafe)
    const owner = elementPoolForTests.owner()
    for (let round = 0; round < 10; round++) {
      // One deal: 18 phrases (ranks 0-17), then the 18 bare words no card tap asks for (ranks 18-35).
      for (let i = 0; i < 18; i++) elementPoolForTests.warm(`da-phrase:normal:r${round}w${i}`, url(i), clip, { owner, rank: i })
      for (let i = 0; i < 18; i++) elementPoolForTests.warm(`normal:r${round}w${i}`, url(i), clip, { owner, rank: 18 + i })
      expect(elementPoolForTests.sizeOf('cafe')).toBeLessThanOrEqual(20)
      // The request's tail never pushed its own head out: all 18 cards are warm.
      const warm = new Set(FakeAudio.all.filter((el) => el.attrs.has('src')).map((el) => el.dataset.clip))
      for (let i = 0; i < 18; i++) expect(warm.has(url(i))).toBe(true)
    }
    expect(FakeAudio.all.length).toBeLessThanOrEqual(20)
    cafe.release()
  })

  it('shrinking a pool releases the clips unused longest at once, properly', () => {
    const walk = claimWordPool('sightseeing', 8)
    readyGates(elementPoolForTests.owner(), 8)
    const blobs = FakeAudio.all.map((el) => el.src)
    walk.setLimit(3)
    expect(elementPoolForTests.sizeOf('sightseeing')).toBe(3)
    FakeAudio.all.slice(0, 5).forEach((el, i) => expectReleased(el, blobs[i]!))
    // The newest three are untouched.
    for (const el of FakeAudio.all.slice(5)) expect(el.calls).toEqual(['load'])
    // setWordPoolLimit resizes the newest claim the same way.
    setWordPoolLimit(1)
    expect(elementPoolForTests.sizeOf('sightseeing')).toBe(1)
    walk.release()
  })

  it('leaving a screen releases every element it held, so Home holds none', () => {
    const cafe = claimWordPool('cafe', 20)
    const owner = elementPoolForTests.owner()
    for (let i = 0; i < 18; i++) elementPoolForTests.warm(`normal:w${i}`, url(i), clip, { owner, rank: i })
    const blobs = FakeAudio.all.map((el) => el.src)
    cafe.release()
    expect(elementPoolForTests.size).toBe(0)
    FakeAudio.all.forEach((el, i) => expectReleased(el, blobs[i]!))
    expect(wordPoolStats()).toMatchObject({ loaded: 0, scope: 'loose' })
    // Idempotent.
    cafe.release()
    expect(elementPoolForTests.size).toBe(0)
  })

  it('the next screen loads the elements the last one gave back rather than making new ones', () => {
    const cafe = claimWordPool('cafe', 20)
    readyGates(elementPoolForTests.owner(), 20)
    cafe.release()
    expect(elementPoolForTests.spare).toBe(20)
    const walk = claimWordPool('sightseeing', 8)
    readyGates(elementPoolForTests.owner(), 50, 100)
    expect(FakeAudio.all).toHaveLength(20)
    expect(elementPoolForTests.size).toBe(8)
    walk.release()
  })

  it('bytes that arrive after their screen was left are not readied', () => {
    const walk = claimWordPool('sightseeing', 8)
    const owner = elementPoolForTests.owner()
    walk.release()
    elementPoolForTests.warm('normal:late', url(1), clip, { owner, rank: 0 })
    expect(elementPoolForTests.size).toBe(0)
    expect(FakeAudio.all).toHaveLength(0)
  })

  it('a sheet over the board lets its own clips go as it closes, and the board keeps its own', () => {
    const cafe = claimWordPool('cafe', 20)
    readyGates(elementPoolForTests.owner(), 18)
    const sheet = claimWordPool('sheet', WORD_POOL_LIMITS.sheet)
    const owner = elementPoolForTests.owner()
    for (let i = 0; i < 10; i++) elementPoolForTests.warm(`slow:s${i}`, url(i), clip, { owner, rank: i })
    expect(elementPoolForTests.sizeOf('sheet')).toBe(WORD_POOL_LIMITS.sheet)
    expect(elementPoolForTests.sizeOf('cafe')).toBe(18)
    sheet.release()
    expect(elementPoolForTests.sizeOf('sheet')).toBe(0)
    expect(elementPoolForTests.sizeOf('cafe')).toBe(18)
    cafe.release()
  })

  it('a clip played with no screen claimed keeps at most 2, given back when a screen comes', () => {
    for (let i = 0; i < 10; i++) elementPoolForTests.ready(`normal:t${i}`, url(i), clip)
    expect(elementPoolForTests.sizeOf('loose')).toBe(elementPoolForTests.loose)
    const s = claimWordPool('suitcase', WORD_POOL_LIMITS.tap)
    expect(elementPoolForTests.size).toBe(0)
    s.release()
  })
})
