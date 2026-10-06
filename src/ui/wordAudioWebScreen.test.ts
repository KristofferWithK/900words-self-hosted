import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The app's real wiring (speak.ts → wordAudioWeb.ts) over a fake
 * AudioContext: words play through Web Audio by default with no word element
 * made; the first gesture anywhere makes and resumes the context; and the
 * decoded buffers keep the element pool's screens (speak.ts `claimWordPool`).
 */
const ctx = vi.hoisted(() => {
  const c = {
    state: 'suspended',
    destination: {},
    decoded: 0,
    resumes: 0,
    started: [] as number[],
    resume() {
      c.resumes++
      c.state = 'running'
      return Promise.resolve()
    },
    decodeAudioData(data: ArrayBuffer) {
      c.decoded++
      return Promise.resolve({ length: data.byteLength * 10, numberOfChannels: 1, sampleRate: 48_000, duration: 0.2 })
    },
    createGain() {
      return { gain: { value: 1 }, connect() {} }
    },
    createBufferSource() {
      return {
        buffer: null,
        playbackRate: { value: 1 },
        onended: null,
        connect() {},
        disconnect() {},
        start(_when: number, offset: number) {
          c.started.push(offset)
        },
        stop() {},
      }
    },
  }
  return c
})
const made = vi.hoisted(() => ({ contexts: 0 }))
vi.mock('./audioContext', () => ({
  getAudioContext: () => {
    made.contexts = 1
    return ctx
  },
  resumeAudioContext: () => {},
}))

class CountingAudio {
  static made = 0
  constructor() {
    CountingAudio.made++
  }
}

// One page for the whole file: wordAudioWeb.ts listens for the first gesture
// on the window it finds when it loads.
const win = Object.assign(new EventTarget(), { location: { hostname: '', search: '' }, AudioContext: class {} })
const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' })

beforeEach(() => {
  vi.stubGlobal('window', win)
  vi.stubGlobal('document', doc)
  vi.stubGlobal('Audio', CountingAudio)
  vi.stubGlobal('fetch', () => Promise.resolve(new Response(new Uint8Array([0x49, 0x44, 0x33, 0, 0]), { headers: { 'content-type': 'audio/mpeg' } })))
})

const settle = async (until: () => boolean) => {
  for (let i = 0; i < 100 && !until(); i++) await new Promise((r) => setTimeout(r, 5))
}

describe('words through Web Audio, the real wiring', () => {
  it('the first gesture anywhere makes and resumes the context, before any word', async () => {
    await import('./wordAudioWeb')
    expect(made.contexts).toBe(0)
    win.dispatchEvent(new Event('pointerdown'))
    expect(made.contexts).toBe(1)
    expect(ctx.resumes).toBe(1)
    expect(ctx.state).toBe('running')
    // Once it runs, a gesture is a state check.
    win.dispatchEvent(new Event('click'))
    expect(ctx.resumes).toBe(1)
    // Suspended again (iOS: a call, the lock screen): the next tap resumes it.
    ctx.state = 'interrupted'
    win.dispatchEvent(new Event('touchend'))
    expect(ctx.resumes).toBe(2)
  })

  it('by default a board readies and says its words with no word element made', async () => {
    const speak = await import('./speak')
    CountingAudio.made = 0
    const board = speak.claimWordPool('cafe', 20)
    try {
      await speak.preloadWordAudio(['da:hus', 'da:bog'])
      await settle(() => ctx.decoded >= 2)
      const before = ctx.started.length
      await expect(speak.playWord('da:hus', { article: false })).resolves.toBe('baked')
      expect(ctx.started.length).toBe(before + 1)
      expect(CountingAudio.made).toBe(0)
      expect(speak.elementPoolForTests.size).toBe(0)
    } finally {
      board.release()
    }
  })

  it("the buffers follow the screen's word pool: its limit while it is mounted, nothing once it is gone", async () => {
    const { webWords } = await import('./wordAudioWeb')
    const { claimWordPool } = await import('./speak')
    const sheet = claimWordPool('sheet', 2)
    const decoded = ctx.decoded
    // Four clips asked for at once; the sheet's pool holds two.
    await webWords.preloadClips(['/a.mp3', '/b.mp3', '/c.mp3', '/d.mp3'])
    await settle(() => ctx.decoded >= decoded + 2)
    await new Promise((r) => setTimeout(r, 20))
    expect(ctx.decoded).toBe(decoded + 2)
    expect(webWords.stats()?.buffers).toBe(2)
    sheet.release()
    expect(webWords.stats()).toMatchObject({ buffers: 0, bytes: 0 })
  })
})
