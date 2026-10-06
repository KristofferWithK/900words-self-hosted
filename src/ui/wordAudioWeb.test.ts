import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ClipLoad } from './speak'
import { createWebWordAudio, installResumeTriggers, setPlaybackSession, type WebWordEnv } from './wordAudioWeb'

/**
 * The Web Audio word player, the default for words (wordAudioWeb.ts): each
 * clip decoded once, buffers bounded and dropped on screen leave, the voice onset honoured, sound off honoured, a
 * newer tap winning, and a context that is not running resumed. Run over a
 * fake AudioContext: node has none, and what a phone's speaker does is a
 * device check, not this.
 */

class FakeBuffer {
  constructor(
    readonly length: number,
    readonly numberOfChannels = 1,
    readonly sampleRate = 48_000,
  ) {}
  get duration(): number {
    return this.length / this.sampleRate
  }
}

class FakeSource {
  buffer: FakeBuffer | null = null
  playbackRate = { value: 1 }
  onended: (() => void) | null = null
  startedAt: { when: number; offset: number } | null = null
  stopped = false
  out: unknown = null
  constructor(private readonly ctx: FakeContext) {}
  connect(node: unknown) {
    this.out = node
  }
  disconnect() {}
  start(when: number, offset: number) {
    this.startedAt = { when, offset }
    this.ctx.started.push(this)
  }
  stop() {
    this.stopped = true
  }
  /** The clip runs out. */
  end() {
    this.onended?.()
  }
}

class FakeContext {
  state: string = 'suspended'
  destination = { name: 'destination' }
  decoded: number[] = []
  started: FakeSource[] = []
  resumes = 0
  /** False: `resume()` never settles (an iPhone mid-call). */
  resumable = true
  gains: Array<{ gain: { value: number }; connect: (n: unknown) => void; to?: unknown }> = []
  decodeAudioData(data: ArrayBuffer): Promise<FakeBuffer> {
    this.decoded.push(data.byteLength)
    // Ten samples per byte of "mp3", so a test picks a buffer's size by its clip's.
    return Promise.resolve(new FakeBuffer(data.byteLength * 10))
  }
  resume(): Promise<void> {
    this.resumes++
    if (!this.resumable) return new Promise(() => {})
    this.state = 'running'
    return Promise.resolve()
  }
  createGain() {
    const g = { gain: { value: 1 }, connect(this: { to?: unknown }, n: unknown) { this.to = n } }
    this.gains.push(g)
    return g
  }
  createBufferSource() {
    return new FakeSource(this)
  }
}

const clipOf = (bytes: number): ClipLoad => ({ kind: 'clip', clip: new Blob([new Uint8Array(bytes)]) })

function setup(over: Partial<WebWordEnv> & { bytesFor?: (url: string) => number } = {}) {
  const ctx = new FakeContext()
  const loads: string[] = []
  const reports: unknown[] = []
  const started: string[] = []
  let sound = true
  const env: WebWordEnv = {
    context: () => ctx as unknown as AudioContext,
    load: (url) => {
      loads.push(url)
      return Promise.resolve(clipOf(over.bytesFor?.(url) ?? 100))
    },
    wanted: () => sound,
    report: (f) => void reports.push(f),
    article: () => undefined,
    startAt: () => 0,
    started: (url) => void started.push(url),
    ...over,
  }
  const web = createWebWordAudio(env)
  return { web, ctx, loads, reports, started, setSound: (on: boolean) => void (sound = on) }
}

/** Let promise chains (Blob.arrayBuffer, decode) settle. */
const settle = () => new Promise((r) => setTimeout(r, 0))

afterEach(() => {
  vi.useRealTimers()
})

describe('the Web Audio word player', () => {
  it('decodes each clip once: readied, then tapped twice, is one decode and one fetch', async () => {
    const { web, ctx, loads } = setup()
    await web.player.preloadClips(['a.mp3'])
    await settle()
    expect(ctx.decoded).toHaveLength(1)
    ctx.state = 'running'
    await expect(web.player.playClip('a.mp3')).resolves.toBe('baked')
    await expect(web.player.playClip('a.mp3')).resolves.toBe('baked')
    expect(ctx.decoded).toHaveLength(1)
    expect(loads).toEqual(['a.mp3'])
    expect(ctx.started).toHaveLength(2)
  })

  it('a tap and a warm of the same clip at once still decode it once', async () => {
    const { web, ctx } = setup()
    ctx.state = 'running'
    const warming = web.player.preloadClips(['a.mp3'])
    const tapped = web.player.playClip('a.mp3')
    await Promise.all([warming, tapped])
    expect(ctx.decoded).toHaveLength(1)
  })

  it('plays a buffer source through one gain node to the destination, no media element', async () => {
    const made = vi.fn()
    vi.stubGlobal('Audio', made)
    try {
      const { web, ctx, started } = setup()
      ctx.state = 'running'
      await web.player.playClip('a.mp3')
      await web.player.playClip('b.mp3')
      expect(made).not.toHaveBeenCalled()
      expect(ctx.gains).toHaveLength(1)
      expect(ctx.gains[0]!.to).toBe(ctx.destination)
      expect(ctx.started.every((s) => s.out === ctx.gains[0])).toBe(true)
      expect(started).toEqual(['a.mp3', 'b.mp3'])
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('keeps the decoded buffers under the byte cap, oldest out first', async () => {
    // 100 bytes of clip → 1,000 samples → 4,000 bytes of PCM each; room for 3.
    const { web, ctx } = setup({ maxBytes: 12_000 })
    await web.player.preloadClips(['1.mp3', '2.mp3', '3.mp3', '4.mp3', '5.mp3'])
    await settle()
    expect(web.stats()).toMatchObject({ buffers: 3, bytes: 12_000 })
    // The oldest (1) went: a tap on it decodes again; a tap on 5 does not.
    ctx.state = 'running'
    await web.player.playClip('5.mp3')
    expect(ctx.decoded).toHaveLength(5)
    await web.player.playClip('1.mp3')
    expect(ctx.decoded).toHaveLength(6)
    expect(web.stats().bytes).toBeLessThanOrEqual(12_000)
  })

  it("decodes ahead only what the screen's word pool would ready, and drops a screen's buffers when it unmounts", async () => {
    // A stand-in for speak.ts's pools: a sheet (limit 2) over a board (limit 3).
    const board = { name: 'cafe', limit: 3, released: false }
    const sheet = { name: 'sheet', limit: 2, released: false }
    let top: typeof board | undefined = board
    const { web, ctx, loads } = setup({ owner: () => top })
    // One request of five clips: only the first three are decoded for the board.
    await web.player.preloadClips(['1.mp3', '2.mp3', '3.mp3', '4.mp3', '5.mp3'])
    await settle()
    expect(loads).toHaveLength(5)
    expect(ctx.decoded).toHaveLength(3)
    expect(web.stats().buffers).toBe(3)
    // The sheet opens over the board and readies its own two.
    top = sheet
    web.poolsChanged()
    await web.player.preloadClips(['s1.mp3', 's2.mp3', 's3.mp3'])
    await settle()
    expect(web.stats().buffers).toBe(5)
    // The sheet closes: its buffers go, the board's stay.
    sheet.released = true
    top = board
    web.poolsChanged()
    expect(web.stats().buffers).toBe(3)
    ctx.state = 'running'
    await web.player.playClip('1.mp3')
    expect(ctx.decoded).toHaveLength(5)
    // The board unmounts: everything goes; the bytes stay, so nothing is fetched again.
    board.released = true
    top = undefined
    web.poolsChanged()
    expect(web.stats()).toMatchObject({ buffers: 0, bytes: 0 })
    const fetched = loads.length
    await expect(web.player.playClip('2.mp3')).resolves.toBe('baked')
    expect(loads).toHaveLength(fetched)
  })

  it("a screen's pool holds its limit of buffers, oldest out first", async () => {
    const walk = { name: 'sightseeing', limit: 2, released: false }
    const { web, ctx } = setup({ owner: () => walk })
    // Gate after gate, each its own request (as the walk readies them).
    for (const gate of ['g1.mp3', 'g2.mp3', 'g3.mp3']) await web.player.preloadClips([gate])
    await settle()
    expect(web.stats().buffers).toBe(2)
    ctx.state = 'running'
    await web.player.playClip('g3.mp3')
    expect(ctx.decoded).toHaveLength(3)
    await web.player.playClip('g1.mp3')
    expect(ctx.decoded).toHaveLength(4)
  })

  it('nothing is decoded for a screen that left before its bytes arrived, nor kept from a decode it outlived', async () => {
    const cafe = { name: 'cafe', limit: 20, released: false }
    const { web, ctx } = setup({ owner: () => cafe })
    let finish: () => void = () => {}
    ctx.decodeAudioData = (data: ArrayBuffer) => {
      ctx.decoded.push(data.byteLength)
      return new Promise<FakeBuffer>((r) => (finish = () => r(new FakeBuffer(1000))))
    }
    await web.player.preloadClips(['a.mp3'])
    for (let i = 0; i < 20 && ctx.decoded.length < 1; i++) await settle()
    expect(ctx.decoded).toHaveLength(1)
    cafe.released = true
    web.poolsChanged()
    finish()
    await settle()
    expect(web.stats().buffers).toBe(0)
    await web.player.preloadClips(['b.mp3'])
    await settle()
    expect(ctx.decoded).toHaveLength(1)
  })

  it('starts each clip where its voice starts (the clip offsets speak.ts uses), never past its end', async () => {
    // 1,000 bytes of clip → 10,000 samples ≈ 208 ms; 100 bytes ≈ 20.8 ms.
    const { web, ctx } = setup({ startAt: (url) => (url === 'long.mp3' ? 0.012 : 5), bytesFor: (url) => (url === 'long.mp3' ? 1000 : 100) })
    ctx.state = 'running'
    await web.player.playClip('long.mp3')
    expect(ctx.started[0]!.startedAt).toEqual({ when: 0, offset: 0.012 })
    // An offset past the end of the short clip is clamped inside it.
    await web.player.playClip('short.mp3')
    const offset = ctx.started[1]!.startedAt!.offset
    expect(offset).toBeLessThan(ctx.started[1]!.buffer!.duration)
  })

  it('plays the slow bake as its own clip, at its own offset, at rate 1', async () => {
    const { web, ctx, loads } = setup({ startAt: (url) => (url.includes('/slow/') ? 0.004 : 0.002), bytesFor: () => 1000 })
    ctx.state = 'running'
    await web.player.playWord('da:hus', { slow: true, article: false })
    await web.player.playWord('da:hus', { article: false })
    expect(loads[0]).toMatch(/audio\/da\/slow\/hus\.mp3$/)
    expect(loads[1]).toMatch(/audio\/da\/hus\.mp3$/)
    expect(ctx.started.map((s) => s.startedAt!.offset)).toEqual([0.004, 0.002])
    expect(ctx.started.every((s) => s.playbackRate.value === 1)).toBe(true)
  })

  it('says the article, then the word when the article ends', async () => {
    const { web, ctx, started } = setup({ article: (id) => (id === 'da:bog' ? 'en' : undefined) })
    ctx.state = 'running'
    const said = web.player.playWord('da:bog')
    for (let i = 0; i < 20 && ctx.started.length < 1; i++) await settle()
    expect(started).toHaveLength(1)
    expect(started[0]).toMatch(/audio\/da\/article\/en\.mp3$/)
    ctx.started[0]!.end()
    await expect(said).resolves.toBe('baked')
    expect(started[1]).toMatch(/audio\/da\/bog\.mp3$/)
  })

  it('sound off: plays nothing, and silences what is already playing', async () => {
    const { web, ctx, setSound } = setup()
    ctx.state = 'running'
    await web.player.playClip('a.mp3')
    const playing = ctx.started[0]!
    setSound(false)
    await expect(web.player.playClip('b.mp3')).resolves.toBe('silent')
    expect(playing.stopped).toBe(true)
    expect(ctx.started).toHaveLength(1)
  })

  it('a newer tap cancels an older one still loading: only the newer plays', async () => {
    let release: (v: ClipLoad) => void = () => {}
    const { web, ctx, started } = setup({
      load: (url) => (url === 'slow-load.mp3' ? new Promise<ClipLoad>((r) => (release = r)) : Promise.resolve(clipOf(100))),
    })
    ctx.state = 'running'
    const older = web.player.playClip('slow-load.mp3')
    const newer = web.player.playClip('quick.mp3')
    await expect(newer).resolves.toBe('baked')
    release(clipOf(100))
    await expect(older).resolves.toBe('silent')
    expect(started).toEqual(['quick.mp3'])
  })

  it('a newer tap cancels an older one still decoding, and stops one already playing', async () => {
    const { web, ctx, started } = setup()
    ctx.state = 'running'
    await web.player.playClip('first.mp3')
    const first = ctx.started[0]!
    // `second` is fetched and still decoding when `third` is tapped.
    const decode = ctx.decodeAudioData.bind(ctx)
    let finish: () => void = () => {}
    ctx.decodeAudioData = (data: ArrayBuffer) => {
      ctx.decoded.push(data.byteLength)
      return new Promise<FakeBuffer>((r) => (finish = () => r(new FakeBuffer(1000))))
    }
    const second = web.player.playClip('second.mp3')
    for (let i = 0; i < 20 && ctx.decoded.length < 2; i++) await settle()
    expect(ctx.decoded).toHaveLength(2)
    ctx.decodeAudioData = decode
    const third = web.player.playClip('third.mp3')
    await expect(third).resolves.toBe('baked')
    finish()
    await expect(second).resolves.toBe('silent')
    expect(first.stopped).toBe(true)
    expect(started).toEqual(['first.mp3', 'third.mp3'])
  })

  it('resumes a suspended context inside the tap, then plays', async () => {
    const { web, ctx } = setup()
    expect(ctx.state).toBe('suspended')
    const tapped = web.player.playClip('a.mp3')
    // Synchronously, inside the gesture: before any await.
    expect(ctx.resumes).toBe(1)
    await expect(tapped).resolves.toBe('baked')
    expect(ctx.started).toHaveLength(1)
  })

  it('a context that will not resume (iOS "interrupted") is reported, not silently dropped', async () => {
    const { web, ctx, reports } = setup({ resumeWaitMs: 5 })
    ctx.state = 'interrupted'
    ctx.resumable = false
    await expect(web.player.playClip('a.mp3')).resolves.toBe('failed')
    expect(reports).toEqual([{ kind: 'word', reason: 'play' }])
    expect(ctx.started).toHaveLength(0)
    // The next gesture asks again.
    web.resumeIfNeeded()
    expect(ctx.resumes).toBeGreaterThanOrEqual(2)
  })

  it('prime creates and resumes the context; a running one is left alone', () => {
    const { web, ctx } = setup()
    web.prime()
    expect(ctx.resumes).toBe(1)
    web.prime()
    expect(ctx.resumes).toBe(1)
  })
})

describe('resuming the context', () => {
  it('on the next gesture of any kind, and when the app comes back to the front', () => {
    const win = new EventTarget()
    const doc = Object.assign(new EventTarget(), { visibilityState: 'hidden' as DocumentVisibilityState })
    const resume = vi.fn()
    const off = installResumeTriggers(resume, win as unknown as Window, doc as unknown as Document)
    win.dispatchEvent(new Event('pointerdown'))
    expect(resume).toHaveBeenCalledTimes(1)
    doc.dispatchEvent(new Event('visibilitychange'))
    expect(resume).toHaveBeenCalledTimes(1)
    doc.visibilityState = 'visible'
    doc.dispatchEvent(new Event('visibilitychange'))
    expect(resume).toHaveBeenCalledTimes(2)
    win.dispatchEvent(new Event('pageshow'))
    expect(resume).toHaveBeenCalledTimes(3)
    for (const type of ['touchend', 'click', 'keydown']) win.dispatchEvent(new Event(type))
    expect(resume).toHaveBeenCalledTimes(6)
    off()
    win.dispatchEvent(new Event('pointerdown'))
    win.dispatchEvent(new Event('click'))
    expect(resume).toHaveBeenCalledTimes(6)
  })
})

describe('the audio session', () => {
  it("asks WebKit for the playback category where the Audio Session API exists", () => {
    const nav = { audioSession: { type: 'auto' } }
    expect(setPlaybackSession(nav)).toBe(true)
    expect(nav.audioSession.type).toBe('playback')
  })

  it('does nothing where it does not (Chromium, Android, iOS before 16.4)', () => {
    expect(setPlaybackSession({})).toBe(false)
    expect(setPlaybackSession(undefined)).toBe(false)
  })
})
