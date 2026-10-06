import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRunPainter, runPictureCanvases, SPRITES_MAX } from './draw'
import { createRunEngine } from './engine'
import { createMemoryRunResultsSink } from './results'
import { activeArticleGateLanes, runWordsForCity } from './sources'

/**
 * THE RUN'S PICTURES ARE GIVEN BACK (long sessions, build 123: "it started to
 * freeze and stutter more the longer I played"). The painter keeps a picture
 * of every word it stamps (draw.ts `sprites`), at three sizes; a phone pays
 * for each picture's pixels until it is collected. These tests drive a real
 * painter over a long run with a stand-in canvas and check that the pictures
 * stay bounded, that a picture leaving the cache gives its pixels back at
 * once, and that `dispose` (the screen going) gives every pixel back.
 *
 * AND THEIR CANVASES ARE REUSED (build 124, iPhone simulator soak: 5,169
 * canvases made in 30 minutes, about ten an answer). A picture that leaves
 * the cache, or a painter that goes with its screen, hands its zeroed canvas
 * on to the next picture: however many walks are played, the painters make
 * about one painter's worth of canvases in all.
 */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A 2D context that accepts everything and measures text by its length. */
function fakeContext(): CanvasRenderingContext2D {
  const props: Record<string | symbol, unknown> = { font: '10px sans-serif', fillStyle: '#000000', globalAlpha: 1 }
  const gradient = { addColorStop: () => {} }
  return new Proxy(props, {
    get(target, key) {
      if (key in target) return target[key]
      if (key === 'measureText') return (text: string) => ({ width: String(text).length * 55 })
      if (key === 'createLinearGradient' || key === 'createRadialGradient' || key === 'createPattern') return () => gradient
      if (key === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })
      return () => {}
    },
    set(target, key, value) {
      target[key] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
}

interface FakeCanvas {
  /** Setting the size clears a canvas and resets its context: counted here. */
  resets: number
  width: number
  height: number
  clientWidth: number
  clientHeight: number
  getContext(): CanvasRenderingContext2D
}

let made: FakeCanvas[] = []
const fakeCanvas = (w = 0, h = 0): FakeCanvas => {
  const ctx = fakeContext()
  let width = w
  let height = h
  const c: FakeCanvas = {
    resets: 0,
    get width() {
      return width
    },
    set width(v: number) {
      width = v
      c.resets++
    },
    get height() {
      return height
    },
    set height(v: number) {
      height = v
      c.resets++
    },
    clientWidth: 390,
    clientHeight: 844,
    getContext: () => ctx,
  }
  return c
}

beforeEach(() => {
  made = []
  runPictureCanvases.reset()
  vi.stubGlobal('Path2D', class { moveTo() {} lineTo() {} quadraticCurveTo() {} bezierCurveTo() {} arc() {} closePath() {} rect() {} })
  vi.stubGlobal('document', {
    createElement: () => {
      const c = fakeCanvas()
      made.push(c)
      return c
    },
  })
  vi.stubGlobal('window', { devicePixelRatio: 3 })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** A walk with the Danish article gates (and their wall), steered right every time, painted every frame for `seconds`. */
function paintLongRun(seconds: number) {
  const canvas = fakeCanvas()
  const painter = createRunPainter(canvas as unknown as HTMLCanvasElement)
  const engine = createRunEngine({ cityIndex: 0, pool: runWordsForCity(0), articleLanes: activeArticleGateLanes(), sink: createMemoryRunResultsSink(), rng: mulberry32(5) })
  engine.start()
  const labels = { photos: 'PHOTOS', best: 'BEST', ask: 'WHAT IS', slipsLeft: (n: number) => `${n}`, faster: 'Faster', slipNote: (w: { target: string }) => w.target }
  let peak = { count: 0, pixels: 0 }
  for (let i = 0; i < seconds * 20; i++) {
    const g = engine.activeGate()
    if (g) engine.state.lane = g.correct
    engine.step(1 / 20)
    painter.draw(engine.state, { labels, best: 0, forgiven: 1, running: true, reducedMotion: false, safeBottom: 0 } as Parameters<typeof painter.draw>[1])
    if (i % 20 === 0) {
      const now = painter.sprites()
      if (now.count > peak.count) peak = now
    }
  }
  return { canvas, painter, engine, peak }
}

describe('the run painter over a long run', () => {
  it('keeps at most its cap of word pictures, and every picture that left the cache has given its pixels back', () => {
    const { painter, peak } = paintLongRun(240)
    const held = painter.sprites()
    // The cap of word pictures at most, and the one picture of the brick wall.
    expect(held.count).toBeLessThanOrEqual(SPRITES_MAX + 1)
    expect(peak.count).toBeLessThanOrEqual(SPRITES_MAX + 1)
    // The cache turned over (more pictures were made than it holds), on no
    // more canvases than it holds: a picture leaving it gave its canvas on.
    expect(made.length).toBeLessThanOrEqual(SPRITES_MAX + 1)
    expect(made.reduce((n, c) => n + c.resets, 0)).toBeGreaterThan(made.length * 2)
    // Pictures no longer in the cache hold no pixels: only the cached ones do.
    const pixelsOfAll = made.reduce((n, c) => n + c.width * c.height, 0)
    expect(pixelsOfAll).toBe(held.pixels)
  }, 60_000)

  it('gives every pixel back, the canvas included, when the screen goes', () => {
    const { canvas, painter } = paintLongRun(30)
    expect(painter.sprites().count).toBeGreaterThan(0)
    expect(canvas.width * canvas.height).toBeGreaterThan(0)
    painter.dispose()
    expect(painter.sprites()).toEqual({ count: 0, pixels: 0 })
    expect(made.every((c) => c.width === 0 && c.height === 0)).toBe(true)
    expect(canvas.width).toBe(0)
    expect(canvas.height).toBe(0)
  }, 60_000)

  it('makes no more canvases over fifty walks, each on its own screen, than one painter holds', () => {
    for (let walk = 0; walk < 50; walk++) {
      const { painter } = paintLongRun(12)
      painter.dispose()
    }
    // Fifty painters used to make about 1,700 canvases here, ten an answer.
    expect(runPictureCanvases.made).toBe(made.length)
    expect(made.length).toBeLessThanOrEqual(SPRITES_MAX + 1)
    // Every one of them is zeroed and waiting for the next screen.
    expect(made.every((c) => c.width === 0 && c.height === 0)).toBe(true)
    expect(runPictureCanvases.spare).toBe(made.length)
  }, 120_000)

  it('draws a picture on a reused canvas at the size a new canvas would have, from a cleared canvas', () => {
    const sizes = () => made.filter((c) => c.width > 0).map((c) => `${c.width}x${c.height}`).sort()
    // The same walk twice: first on new canvases, then on the first one's spares.
    const first = paintLongRun(30)
    const fresh = sizes()
    first.painter.dispose()
    const spares = made.length
    const resets = new Map(made.map((c) => [c, c.resets]))
    paintLongRun(30)
    expect(made.length).toBe(spares)
    // The same pictures at the same sizes, every one on a canvas resized
    // (which clears it and resets its context) before it was drawn on.
    expect(sizes()).toEqual(fresh)
    for (const c of made.filter((c) => c.width > 0)) expect(c.resets).toBeGreaterThan(resets.get(c)!)
  }, 120_000)
})
