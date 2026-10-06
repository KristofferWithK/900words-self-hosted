import { describe, expect, it } from 'vitest'
import { gateBox, queuedGateAlpha, runFrame } from './draw'
import { createRunEngine, FAR, FIRST_GATE, SPACING, type RunEngine } from './engine'
import { createMemoryRunResultsSink } from './results'
import { activeArticleGateLanes, runWordsForCity } from './sources'

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

const articleLanes = activeArticleGateLanes()
/** Gates drawn when a run starts: the next one shows too. */
const engines: [string, () => RunEngine, number][] = [
  ['walk without article gates', () => createRunEngine({ cityIndex: 0, pool: runWordsForCity(0), sink: createMemoryRunResultsSink(), rng: mulberry32(31) }), 2],
  ['walk with article gates', () => createRunEngine({ articleLanes, cityIndex: 0, pool: runWordsForCity(0), sink: createMemoryRunResultsSink(), rng: mulberry32(32) }), 2],
]

/** Every frame of a run that answers everything right, from the first one. */
function* frames(engine: RunEngine, seconds = 60): Generator<RunEngine['state']> {
  engine.start()
  yield engine.state
  for (let t = 0; t < seconds * 30; t++) {
    const g = engine.activeGate()
    if (g) engine.state.lane = g.correct
    engine.step(1 / 30)
    yield engine.state
  }
}

describe.each(engines)('the gates of the %s', (_name, make, atStart) => {
  it('stand SPACING apart on the road from the first frame (an article gate two, its slot in front empty), and come out of the haze no further than FAR', () => {
    let first = true
    for (const state of frames(make())) {
      const zs = state.gates.map((g) => g.z)
      if (first) {
        expect(zs[0]).toBeCloseTo(FIRST_GATE, 9)
        first = false
      }
      for (let i = 1; i < zs.length; i++) expect(zs[i] - zs[i - 1]).toBeCloseTo(state.gates[i].kind === 'article' ? (4 / 3) * SPACING : SPACING, 9)
      // An article gate is placed as a gate of the usual spacing would be: it waits beyond the haze for its run-up's extra third.
      for (const g of state.gates) expect(g.z - (g.kind === 'article' ? SPACING / 3 : 0)).toBeLessThanOrEqual(FAR + 1e-9)
    }
  })

  it('never draws a queued gate stacked behind the tag of the gate in front of it', () => {
    let drawnAtStart = 0
    let mostDrawn = 0
    let first = true
    for (const state of frames(make())) {
      const ahead = state.gates.filter((g) => g.z > 0).sort((a, b) => b.z - a.z)
      const drawn = ahead.filter((g, i) => queuedGateAlpha(g.z, ahead[i + 1]?.z, g.options.length) > 0)
      if (first) {
        drawnAtStart = drawn.length
        first = false
      }
      mostDrawn = Math.max(mostDrawn, drawn.length)
      for (let i = 0; i < ahead.length - 1; i++) {
        const g = ahead[i]
        if (queuedGateAlpha(g.z, ahead[i + 1].z, g.options.length) <= 0) continue
        const me = gateBox(g.z, g.options.length)
        const front = gateBox(ahead[i + 1].z, g.options.length)
        // Most of its suitcases show below the front gate's tag: a gate, not a tag on a tag.
        expect((me.base - front.tagTop) / (me.base - me.suitcaseTop)).toBeLessThan(0.6)
        expect(me.tagTop).toBeLessThan(front.tagTop)
      }
    }
    // Gates still come into view down the road: more than one is on the screen at once.
    expect(drawnAtStart).toBeGreaterThanOrEqual(atStart)
    expect(mostDrawn).toBeGreaterThanOrEqual(2)
  })

  it('keeps every gate ahead below the horizon, so the far town of a tall phone is never behind a tag', () => {
    // Gates are drawn in the prototype's units; a taller scene only moves them
    // down with the horizon (runFrame), so the horizon here is the prototype's.
    const horizon = runFrame(480, 800).horizon
    for (const tall of [runFrame(390, 844), runFrame(360, 640), runFrame(430, 932, 34)]) {
      expect(tall.casey - tall.horizon).toBeCloseTo(540, 9)
    }
    for (const state of frames(make())) {
      for (const g of state.gates) {
        if (g.z <= 0) continue
        expect(gateBox(g.z, g.options.length).tagTop).toBeGreaterThan(horizon)
      }
    }
  })

  it('draws the nearest gate ahead always, and a gate with nothing in front of it fully', () => {
    expect(queuedGateAlpha(3, undefined, 3)).toBe(1)
    expect(queuedGateAlpha(FAR, FAR - SPACING, 3)).toBe(0)
  })
})
