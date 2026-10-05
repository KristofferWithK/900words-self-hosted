import { describe, expect, it } from 'vitest'
import type { Cafe } from '../journey/cafes'
import { holdRunForCafes, type CafeHold } from './cafeHold'
import { boxesOverlap, cafeAlphaAt, cafeBoardAlpha, cafeBox, CAFE_GONE_AT, caseyBox, caseyDrawX, gateBehind, gateRects, KIOSK_SCALE, kioskRects, type ScreenBox } from './draw'
import { createRunEngine, FAR, SHOPFRONT_GONE, SPACING, type RunEngine } from './engine'
import type { RunResult, RunWalk } from './results'
import { createProgressRunResultsSink } from './sinkSetup'
import { activeArticleLanes, walkPool } from './sources'

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

const lanes = activeArticleLanes()

const cafeAt = (index: number): Cafe =>
  ({ board: { courseId: 'da', cityId: 'sonderborg', authoredBoardId: `b${index}` }, index, state: 'found', foundAt: index }) as unknown as Cafe

/**
 * A walk on the real progress sink whose café count finds a café at the given
 * photos (the first at photo 5, as in a fresh profile), wired to the run as
 * the screen wires it: `hold` on the first session's walk only. `ends`
 * collects what the run reported when it ended; `stored` the cafés the sink
 * found (the find as the journey records it).
 */
function walkWithFinds(walk: RunWalk, findAt: readonly number[], { seed = 41, hold = true }: { seed?: number; hold?: boolean } = {}) {
  let photos = 0
  const ends: RunResult[] = []
  const stored: Cafe[] = []
  const progress = createProgressRunResultsSink({
    countRun: () => {},
    recordPhoto: ({ findsCafes }) => {
      if (!findsCafes) return null
      photos++
      const i = findAt.indexOf(photos)
      if (i < 0) return null
      stored.push(cafeAt(i))
      return cafeAt(i)
    },
  })
  const sink = { ...progress, end: (r: RunResult) => (ends.push(r), progress.end(r)) }
  const engine = createRunEngine({
    walk,
    cityIndex: 0,
    pool: walkPool(walk, 0, lanes),
    lanes,
    sink,
    rng: mulberry32(seed),
    now: () => 1000,
  })
  const holds: CafeHold[] = []
  const stop = holdRunForCafes(engine, (c) => (c.index === 1 ? null : `Café ${c.index}`), 'Café', hold, (h) => holds.push(h))
  return { engine, holds, ends, stored, stop }
}

/** Step a run that answers every gate right, until `until` or a time limit. */
function runUntil(engine: RunEngine, until: () => boolean, seconds = 120, onFrame?: () => void): void {
  for (let t = 0; t < seconds * 30 && !until(); t++) {
    const g = engine.activeGate()
    if (g) while (engine.state.lane !== g.correct) engine.steer(engine.state.lane < g.correct ? 1 : -1)
    engine.step(1 / 30)
    onFrame?.()
  }
}

describe('a café found on the first session\'s walk (onboarding): the run holds', () => {
  it.each(['words', 'articles'] as const)('%s walk: a find places exactly one café on the road and holds the run', (walk) => {
    const { engine, holds, stored, stop } = walkWithFinds(walk, [5, 15, 25])
    try {
      engine.start()
      runUntil(engine, () => engine.state.held)
      expect(engine.state.photos).toBe(5)
      expect(holds).toHaveLength(1)
      expect(holds[0].held).toBe(true)
      expect(engine.state.shopfronts).toHaveLength(1)
      const [shop] = engine.state.shopfronts
      expect(shop).toBe(holds[0].shop)
      expect(shop).toMatchObject({ name: 'Café 0', held: true })
      // Halfway between the gate just passed and the next one, on the road.
      expect(shop.z).toBeCloseTo(engine.activeGate()!.z - SPACING / 2, 9)
      expect(shop.placedZ).toBe(shop.z)
      // Every later find adds exactly one more; the second café has no name of its own.
      let seen = 1
      for (const n of [2, 3]) {
        engine.carryOn()
        runUntil(engine, () => engine.state.held)
        expect(holds).toHaveLength(n)
        expect(engine.state.photos).toBe([5, 15, 25][n - 1])
        expect(engine.state.shopfronts.filter((s) => s.id > seen)).toHaveLength(1)
        seen = holds[n - 1].shop.id
      }
      expect(holds.map((h) => [h.name, h.shop.name])).toEqual([
        ['Café 0', 'Café 0'],
        [null, 'Café'],
        ['Café 2', 'Café 2'],
      ])
      expect(stored.map((c) => c.index)).toEqual([0, 1, 2])
      // A photo that finds nothing places nothing.
      engine.carryOn()
      const before = engine.state.photos
      runUntil(engine, () => engine.state.photos >= before + 3)
      expect(holds).toHaveLength(3)
      expect(engine.state.held).toBe(false)
    } finally {
      stop()
    }
  })

  it('holds and carries on without changing the speed, its tier, the slips or the photos', () => {
    const { engine, stop } = walkWithFinds('words', [5, 12])
    try {
      engine.start()
      // One forgiven wrong word first, so there is a slip to keep.
      runUntil(engine, () => engine.state.photos >= 2)
      const g = engine.activeGate()!
      const wrong = (g.correct + 1) % g.options.length
      while (engine.state.lane !== wrong) engine.steer(engine.state.lane < wrong ? 1 : -1)
      while (!g.resolved) engine.step(1 / 30)
      expect(engine.state.slips).toBe(1)
      runUntil(engine, () => engine.state.held)
      // Through the second find too, at a faster tier.
      engine.carryOn()
      runUntil(engine, () => engine.state.held)
      expect(engine.state.photos).toBe(12)
      expect(engine.state.tier).toBeGreaterThan(0)
      const s = engine.state
      const before = JSON.stringify({ ...s, note: s.note, gates: s.gates.map((x) => [x.id, x.z, x.reveal]), shopfronts: s.shopfronts })
      const snapshot = { tier: s.tier, speed: s.speed, slips: s.slips, photos: s.photos, answered: s.answered, scroll: s.scroll, lane: s.lane }
      // Held: steps and steering change nothing at all, however long it holds.
      for (let i = 0; i < 300; i++) {
        engine.step(1 / 30)
        engine.steer(i % 2 ? 1 : -1)
      }
      expect(JSON.stringify({ ...s, note: s.note, gates: s.gates.map((x) => [x.id, x.z, x.reveal]), shopfronts: s.shopfronts })).toBe(before)
      // Carried on: the run moves at the speed it had, and counts on from where it was.
      engine.carryOn()
      expect(engine.state.held).toBe(false)
      expect({ tier: s.tier, speed: s.speed, slips: s.slips, photos: s.photos, answered: s.answered, scroll: s.scroll, lane: s.lane }).toEqual(snapshot)
      engine.step(1 / 30)
      expect(s.scroll).toBeCloseTo(snapshot.scroll + snapshot.speed / 30, 3)
      runUntil(engine, () => engine.state.photos > snapshot.photos)
      expect(engine.state.photos).toBe(snapshot.photos + 1)
      expect(engine.state.slips).toBe(1)
      expect(engine.state.phase).toBe('play')
    } finally {
      stop()
    }
  })

  it('a run left from the hold is reported once, as left', () => {
    const { engine, ends, stop } = walkWithFinds('words', [5])
    try {
      engine.start()
      runUntil(engine, () => engine.state.held)
      engine.leave()
      engine.leave()
      engine.step(1 / 30)
      engine.leave()
      expect(ends).toHaveLength(1)
      expect(ends[0]).toMatchObject({ walk: 'words', end: 'left', photos: 5, answered: 5 })
      expect(engine.state.phase).toBe('over')
      expect(engine.state.held).toBe(false)
    } finally {
      stop()
    }
  })
})

describe('a café found on any other walk: Casey keeps walking', () => {
  /** What a run is doing, frame by frame, apart from its cafés. */
  const motion = (e: RunEngine) => {
    const s = e.state
    return {
      phase: s.phase,
      held: s.held,
      speed: s.speed,
      tier: s.tier,
      slips: s.slips,
      photos: s.photos,
      answered: s.answered,
      lane: s.lane,
      laneX: s.laneX,
      scroll: s.scroll,
      gates: s.gates.map((g) => [g.id, g.word.id, g.z, g.reveal, g.resolved]),
    }
  }

  it.each(['words', 'articles'] as const)('%s walk: a find does not hold the run; speed, slips, photos and lane go on as in a walk that found nothing', (walk) => {
    const finding = walkWithFinds(walk, [5, 15], { seed: 9, hold: false })
    const plain = walkWithFinds(walk, [], { seed: 9, hold: false })
    // The finds are heard app-wide (sinkSetup.ts `onCafeFound`): the walk that
    // finds nothing does not listen, so the other walk's finds are not its own.
    plain.stop()
    try {
      finding.engine.start()
      plain.engine.start()
      let frames = 0
      for (let t = 0; t < 120 * 30 && finding.engine.state.photos < 20; t++) {
        for (const e of [finding.engine, plain.engine]) {
          const g = e.activeGate()
          // A wrong word at the third gate, so a slip is carried through the finds.
          const want = g ? (e.state.answered === 2 ? (g.correct + 1) % g.options.length : g.correct) : e.state.lane
          while (e.state.lane !== want) e.steer(e.state.lane < want ? 1 : -1)
          e.step(1 / 30)
        }
        expect(finding.engine.state.held).toBe(false)
        expect(motion(finding.engine)).toEqual(motion(plain.engine))
        frames++
      }
      expect(frames).toBeGreaterThan(100)
      expect(finding.engine.state.photos).toBe(20)
      expect(finding.engine.state.slips).toBe(1)
      // Both finds were heard, placed on the road and stored, without a hold.
      expect(finding.holds.map((h) => [h.name, h.held])).toEqual([
        ['Café 0', false],
        [null, false],
      ])
      expect(finding.stored.map((c) => c.index)).toEqual([0, 1])
      expect(plain.holds).toHaveLength(0)
      expect(plain.engine.state.shopfronts).toHaveLength(0)
    } finally {
      finding.stop()
      plain.stop()
    }
  })

  it('the café stands on the road between the gates, and Casey walks through it', () => {
    const { engine, holds, stop } = walkWithFinds('words', [5], { hold: false })
    try {
      engine.start()
      runUntil(engine, () => holds.length > 0)
      const shop = holds[0].shop
      expect(shop).toMatchObject({ name: 'Café 0', held: false })
      expect(shop.placedZ).toBe(shop.z)
      const gate = engine.activeGate()!
      expect(shop.z).toBeCloseTo(gate.z - SPACING / 2, 9)
      const gap = gate.z - shop.z
      runUntil(engine, () => engine.state.shopfronts.length === 0, 10, () => {
        expect(engine.state.held).toBe(false)
        if (engine.state.shopfronts.length) expect(gate.z - engine.state.shopfronts[0].z).toBeCloseTo(gap, 9)
      })
      // It passed Casey (z 0) and left the road, before the next gate, and the walk goes on.
      expect(shop.z).toBeLessThanOrEqual(SHOPFRONT_GONE)
      expect(gate.resolved).toBe(false)
      expect(engine.state.phase).toBe('play')
    } finally {
      stop()
    }
  })

  it('the train run finds no café: nothing is placed and nothing holds', () => {
    const engine = createRunEngine({ walk: 'train', cityIndex: 0, pool: walkPool('train', 0, lanes), sink: createProgressRunResultsSink({ countRun: () => {}, recordPhoto: () => cafeAt(0) }), rng: mulberry32(3), trainLimit: 12 })
    let heard = 0
    const stops = [true, false].map((hold) => holdRunForCafes(engine, () => 'Café Solen', 'Café', hold, () => heard++))
    try {
      engine.start()
      runUntil(engine, () => engine.state.phase !== 'play')
      expect(engine.findCafe('Café Solen', true)).toBeNull()
      expect(heard).toBe(0)
      expect(engine.state.shopfronts).toEqual([])
      expect(engine.state.held).toBe(false)
    } finally {
      stops.forEach((stop) => stop())
    }
  })

  it('deferred writes: a café found by the last answers of a run is heard after it ends, and still named (onLate)', () => {
    const waiting: (() => void)[] = []
    let photos = 0
    const sink = createProgressRunResultsSink(
      { countRun: () => {}, recordPhoto: ({ findsCafes }) => (findsCafes && ++photos === 5 ? cafeAt(0) : null) },
      { defer: (run) => (waiting.push(run), () => waiting.splice(waiting.indexOf(run), 1)) },
    )
    const engine = createRunEngine({ walk: 'words', cityIndex: 0, pool: walkPool('words', 0, lanes), lanes, sink, rng: mulberry32(8), now: () => 1000 })
    const holds: CafeHold[] = []
    const late: (string | null)[] = []
    const stop = holdRunForCafes(engine, (c) => `Café ${c.index}`, 'Café', false, (h) => holds.push(h), (name) => late.push(name))
    try {
      engine.start()
      runUntil(engine, () => engine.state.photos >= 5)
      // Found, not yet written: nothing on the road yet.
      expect(engine.state.shopfronts).toEqual([])
      engine.leave()
      expect(holds).toEqual([])
      expect(late).toEqual(['Café 0'])
      expect(engine.state.shopfronts).toEqual([])
    } finally {
      stop()
    }
  })

  it('deferred writes: a café found mid-walk stands on the road a moment later, still between the gates', () => {
    const waiting: (() => void)[] = []
    let photos = 0
    const sink = createProgressRunResultsSink(
      { countRun: () => {}, recordPhoto: ({ findsCafes }) => (findsCafes && ++photos === 5 ? cafeAt(0) : null) },
      { defer: (run) => (waiting.push(run), () => waiting.splice(waiting.indexOf(run), 1)) },
    )
    const engine = createRunEngine({ walk: 'words', cityIndex: 0, pool: walkPool('words', 0, lanes), lanes, sink, rng: mulberry32(8), now: () => 1000 })
    const holds: CafeHold[] = []
    const stop = holdRunForCafes(engine, (c) => `Café ${c.index}`, 'Café', false, (h) => holds.push(h))
    try {
      engine.start()
      runUntil(engine, () => engine.state.photos >= 5)
      // The write a quarter of a second later (WRITE_AFTER_MS).
      for (let i = 0; i < 8; i++) engine.step(1 / 30)
      waiting.splice(0).forEach((run) => run())
      expect(holds).toHaveLength(1)
      const shop = holds[0].shop
      expect(shop.z).toBeCloseTo(engine.activeGate()!.z - SPACING / 2, 9)
      expect(shop.z).toBeGreaterThan(0.8)
    } finally {
      stop()
    }
  })

  it('nothing is placed before a run starts or after it ends', () => {
    const { engine, stop } = walkWithFinds('words', [])
    try {
      expect(engine.findCafe('Café Solen', false)).toBeNull()
      engine.start()
      engine.leave()
      expect(engine.findCafe('Café Solen', true)).toBeNull()
      expect(engine.state.held).toBe(false)
    } finally {
      stop()
    }
  })
})

/** What a café draws at `z` with the nearest gate behind it at `zBehind`: the kiosk always, the name board once it is shown. */
function drawnParts(z: number, zBehind: number | undefined): ScreenBox[] {
  const { kiosk, board } = kioskRects(z)
  return cafeBoardAlpha(z, zBehind) > 0 ? [kiosk, board] : [kiosk]
}

describe('the café on the road, on the screen', () => {
  const walks: [string, RunWalk, number][] = [
    ['Words', 'words', 3],
    ['Articles', 'articles', lanes.length],
  ]
  /** The kerbs, either side of the middle of the road (draw.ts: 1.5 lanes of 158). */
  const KERB = 237

  it.each(walks)('%s walk: never stands over a gate, its tag or its string, in any frame of a walk with finds', (_name, walk, laneCount) => {
    const { engine, stop } = walkWithFinds(walk, [5, 15, 25, 35, 45, 55, 65], { seed: 77, hold: false })
    let checked = 0
    try {
      engine.start()
      runUntil(
        engine,
        () => engine.state.phase !== 'play',
        400,
        () => {
          for (const shop of engine.state.shopfronts) {
            const parts = drawnParts(shop.z, gateBehind(engine.state, shop.z))
            for (const g of engine.state.gates) {
              if (g.z < -0.18 || g.z > FAR) continue
              checked++
              for (const part of parts) for (const r of gateRects(g.z, laneCount)) expect(boxesOverlap(part, r), `cafe ${shop.z} gate ${g.z}`).toBe(false)
            }
          }
        },
      )
      expect(engine.state.photos).toBeGreaterThanOrEqual(65)
      expect(checked).toBeGreaterThan(300)
    } finally {
      stop()
    }
  })

  it('never stands over a gate anywhere on its way, for two and three lanes, and covers the road kerb to kerb', () => {
    let checked = 0
    for (const laneCount of [2, 3])
      for (let z = SPACING / 2; z > SHOPFRONT_GONE; z -= 0.01) {
        const box = cafeBox(z)
        const s = 1 / (1 + z)
        expect(box.left).toBeCloseTo(240 - KERB * s, 9)
        expect(box.right).toBeCloseTo(240 + KERB * s, 9)
        // The kiosk and its island reach both kerbs.
        const { kiosk } = kioskRects(z)
        expect(kiosk.left).toBeCloseTo(box.left, 9)
        expect(kiosk.right).toBeCloseTo(box.right, 9)
        const zBehind = z + SPACING / 2
        const parts = drawnParts(z, zBehind)
        for (const part of parts) {
          expect(part.left).toBeGreaterThanOrEqual(box.left - 1e-9)
          expect(part.right).toBeLessThanOrEqual(box.right + 1e-9)
          expect(part.top).toBeGreaterThanOrEqual(box.top - 1e-9)
          expect(part.bottom).toBeLessThanOrEqual(box.bottom + 1e-9)
        }
        for (let k = -1; k <= 3; k++) {
          const gz = z + (k + 0.5) * SPACING
          if (gz < -0.18 || gz > FAR) continue
          checked++
          for (const part of parts) for (const r of gateRects(gz, laneCount)) expect(boxesOverlap(part, r), `${laneCount} lanes, cafe ${z}, gate ${gz}`).toBe(false)
        }
      }
    expect(checked).toBeGreaterThan(900)
  })

  it('it is bigger than the kiosk was, and its name board comes in on the way, well before Casey reaches it', () => {
    expect(KIOSK_SCALE).toBeGreaterThan(1)
    // Far down the road the board is left out over the gate behind...
    expect(cafeBoardAlpha(SPACING / 2, SPACING)).toBe(0)
    // ...and it is all there long before the café reaches her.
    expect(cafeBoardAlpha(0.7, 0.7 + SPACING / 2)).toBe(1)
    expect(cafeBoardAlpha(0.3, undefined)).toBe(1)
  })

  it('the check can fail, since a café that was not halfway between gates would stand over one', () => {
    expect(gateRects(2, 2).some((r) => boxesOverlap(cafeBox(3), r))).toBe(true)
    expect(gateRects(1.6, 3).some((r) => boxesOverlap(cafeBox(1.1), r))).toBe(true)
    // And without leaving its board out, the bigger kiosk would stand over the gate behind.
    expect(gateRects(SPACING, 3).some((r) => boxesOverlap(kioskRects(SPACING / 2).board, r))).toBe(true)
  })
})

describe('Casey and the café: she walks straight into it, in her lane', () => {
  /** A lane's place across the road, from its middle (draw.ts `laneAt`: three lanes of 158 share the road). */
  const laneAt = (i: number, n: number) => (i - (n - 1) / 2) * ((3 * 158) / n)

  it.each([2, 3])('%i lanes: every lane runs into the kiosk, so whichever lane she is in she walks into it', (n) => {
    const { kiosk } = kioskRects(0)
    for (let i = 0; i < n; i++) {
      const casey = caseyBox(laneAt(i, n), 0, 0)
      expect(casey.left).toBeGreaterThanOrEqual(kiosk.left)
      expect(casey.right).toBeLessThanOrEqual(kiosk.right)
    }
  })

  it.each(['words', 'articles'] as const)('%s walk: her drawn place never leaves her lane because of a café; there is no swerve', (walk) => {
    const { engine, stop } = walkWithFinds(walk, [5, 15, 25, 35], { seed: 5, hold: false })
    let withCafe = 0
    try {
      engine.start()
      runUntil(engine, () => engine.state.photos >= 40, 200, () => {
        const s = engine.state
        if (s.shopfronts.length) withCafe++
        expect(caseyDrawX(s)).toBe(laneAt(s.laneX, s.lanes))
        // Without its cafés she is drawn in exactly the same place.
        expect(caseyDrawX({ ...s, shopfronts: [] } as typeof s)).toBe(caseyDrawX(s))
      })
      expect(withCafe).toBeGreaterThan(30)
    } finally {
      stop()
    }
  })

  it('as she reaches it, it fades and is gone just behind her, as the kiosk always did; nothing lights up', () => {
    expect(cafeAlphaAt(0.2)).toBe(1)
    expect(cafeAlphaAt(0.05)).toBeLessThan(1)
    expect(cafeAlphaAt(CAFE_GONE_AT)).toBe(0)
    expect(CAFE_GONE_AT).toBeGreaterThan(SHOPFRONT_GONE)
  })
})
