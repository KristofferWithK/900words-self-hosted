import { describe, expect, it } from 'vitest'
import type { Cafe } from '../journey/cafes'
import { holdRunForCafes, type CafeHold } from './cafeHold'
import { cafeAlphaAt, cafeBox, cafeDrawnAlpha, CAFE_GONE_AT, caseyBox, caseyDrawX, gateBox, KIOSK_SCALE, kioskRects, queuedGateAlpha, slotAlphas } from './draw'
import { createRunEngine, FAR, SHOPFRONT_GONE, SHOPFRONT_REACHED, SPACING, type RunEngine, type RunEvents, type RunShopfront } from './engine'
import type { RunResult } from './results'
import { createProgressRunResultsSink } from './sinkSetup'
import { tierOf } from './tiers'
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

/** The Danish course's article gates: et, the wall, en. */
const gateLanes = activeArticleGateLanes()
/** A walk without article gates (a course without articles, the first session's walk), or with them. */
type Mode = 'meanings only' | 'article gates'
const MODES: readonly Mode[] = ['meanings only', 'article gates']

const cafeAt = (index: number): Cafe =>
  ({ board: { courseId: 'da', cityId: 'sonderborg', authoredBoardId: `b${index}` }, index, state: 'found', foundAt: index }) as unknown as Cafe

/**
 * A walk on the real progress sink whose café count finds a café at the given
 * photos (the first at photo 5, as in a fresh profile), wired to the run as
 * the screen wires it: `hold` on the first session's walk only. `ends`
 * collects what the run reported when it ended; `stored` the cafés the sink
 * found (the find as the journey records it).
 */
function walkWithFinds(
  mode: Mode,
  findAt: readonly number[],
  { seed = 41, hold = true, events = {} }: { seed?: number; hold?: boolean; events?: RunEvents } = {},
) {
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
  const reached: RunShopfront[] = []
  const engine = createRunEngine({
    events: { ...events, cafeHeld: (shop) => (reached.push(shop), events.cafeHeld?.(shop)) },
    walk: 'words',
    cityIndex: 0,
    pool: runWordsForCity(0),
    articleLanes: mode === 'article gates' ? gateLanes : null,
    sink,
    rng: mulberry32(seed),
    now: () => 1000,
  })
  const holds: CafeHold[] = []
  const stop = holdRunForCafes(engine, (c) => (c.index === 1 ? null : `Café ${c.index}`), 'Café', hold, (h) => holds.push(h))
  return { engine, holds, ends, stored, stop, reached }
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

/** Every slot on the road, gates and cafés, near to far. */
function slots(engine: RunEngine): { kind: 'gate' | 'cafe'; z: number; article: boolean }[] {
  return [
    ...engine.state.gates.map((g) => ({ kind: 'gate' as const, z: g.z, article: g.kind === 'article' })),
    ...engine.state.shopfronts.map((c) => ({ kind: 'cafe' as const, z: c.z, article: false })),
  ].sort((a, b) => a.z - b.z)
}

/**
 * The road's slots stand SPACING apart, a café in one of them like a gate:
 * nothing stands between two slots. The one longer gap is the run-up before an
 * article gate, which stands 4/3 of the spacing behind whatever is in front of it.
 */
function expectSlotsEvenlySpaced(engine: RunEngine): void {
  const road = slots(engine)
  for (let i = 1; i < road.length; i++) expect(road[i].z - road[i - 1].z, JSON.stringify(road)).toBeCloseTo(road[i].article ? (4 / 3) * SPACING : SPACING, 9)
}

/** A café found now stands in the first slot not on the road yet: past the last gate, out of sight beyond the haze. */
function expectInFirstFreeSlot(engine: RunEngine, shopZ: number): void {
  // The road is filled to FAR at every step, so the next free slot is at most one step's way short of FAR.
  expect(shopZ).toBeGreaterThan(FAR - 0.2)
  for (const g of engine.state.gates) expect(Math.abs(g.z - shopZ)).toBeGreaterThan(SPACING - 1e-9)
}

it('the walk with article gates here is the Danish course\'s: et, the wall, en', () => {
  expect(gateLanes).toEqual(['et', null, 'en'])
})

describe('a café found on the first session\'s walk (onboarding): the run holds', () => {
  it.each(MODES)('%s: a find places exactly one café on the road; the run holds only when Casey reaches it', (mode) => {
    const { engine, holds, stored, stop, reached } = walkWithFinds(mode, [5, 15, 25])
    try {
      engine.start()
      const findAt = [5, 15, 25]
      for (const n of [1, 2, 3]) {
        // Found: one more café on the road, in the first free gate slot, and the walk goes on.
        runUntil(engine, () => holds.length === n)
        expect(engine.state.photos).toBe(findAt[n - 1])
        const shop = holds[n - 1].shop
        expect(holds[n - 1].held).toBe(true)
        expect(engine.state.shopfronts.filter((c) => c.id === shop.id)).toEqual([shop])
        expectInFirstFreeSlot(engine, shop.z)
        expectSlotsEvenlySpaced(engine)
        expect(engine.state.held).toBe(false)
        expect(shop.reached).toBe(false)
        // Between the find and the café the walk carries on: answers, photos, the road moving.
        let frames = 0
        runUntil(engine, () => engine.state.held, 60, () => {
          if (!engine.state.held) {
            frames++
            expect(shop.z).toBeGreaterThan(SHOPFRONT_REACHED)
          }
        })
        expect(frames).toBeGreaterThan(30)
        expect(engine.state.photos).toBeGreaterThan(findAt[n - 1])
        // Held as Casey walks into it: the café is at her, and the event names it.
        expect(engine.state.held).toBe(true)
        expect(shop.reached).toBe(true)
        expect(shop.z).toBeLessThanOrEqual(SHOPFRONT_REACHED)
        expect(shop.z).toBeGreaterThan(0)
        expect(reached).toHaveLength(n)
        expect(reached[n - 1]).toBe(shop)
        engine.carryOn()
      }
      expect(holds.map((h) => [h.name, h.shop.name])).toEqual([
        ['Café 0', 'Café 0'],
        [null, 'Café'],
        ['Café 2', 'Café 2'],
      ])
      expect(stored.map((c) => c.index)).toEqual([0, 1, 2])
      // A café holds once: walking on through it, and photos that find nothing, hold nothing.
      const before = engine.state.photos
      runUntil(engine, () => engine.state.photos >= before + 4)
      expect(holds).toHaveLength(3)
      expect(reached).toHaveLength(3)
      expect(engine.state.held).toBe(false)
    } finally {
      stop()
    }
  })

  it('holds and carries on without changing the speed, its tier, the slips or the photos', () => {
    const { engine, stop } = walkWithFinds('meanings only', [5, 12])
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
      expect(engine.state.photos).toBeGreaterThan(12)
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
    const { engine, ends, stop } = walkWithFinds('meanings only', [5])
    try {
      engine.start()
      runUntil(engine, () => engine.state.held)
      engine.leave()
      engine.leave()
      engine.step(1 / 30)
      engine.leave()
      expect(ends).toHaveLength(1)
      expect(ends[0]).toMatchObject({ walk: 'words', end: 'left' })
      expect(ends[0].photos).toBeGreaterThan(5)
      expect(engine.state.phase).toBe('over')
      expect(engine.state.held).toBe(false)
    } finally {
      stop()
    }
  })
})

describe('a café found on any other walk: Casey keeps walking', () => {
  it.each(MODES)('%s: a find does not hold the run; Casey never stops, and the speed, slips and photos go on', (mode) => {
    const finding = walkWithFinds(mode, [5, 15], { seed: 9, hold: false })
    const plain = walkWithFinds(mode, [], { seed: 9, hold: false })
    // The finds are heard app-wide (sinkSetup.ts `onCafeFound`): the walk that
    // finds nothing does not listen, so the other walk's finds are not its own.
    plain.stop()
    try {
      finding.engine.start()
      plain.engine.start()
      let frames = 0
      let scroll = 0
      for (let t = 0; t < 120 * 30 && finding.engine.state.photos < 20; t++) {
        const e = finding.engine
        const g = e.activeGate()
        // A wrong word at the third gate, so a slip is carried through the finds.
        const want = g ? (e.state.answered === 2 ? (g.correct + 1) % g.options.length : g.correct) : e.state.lane
        while (e.state.lane !== want) e.steer(e.state.lane < want ? 1 : -1)
        e.step(1 / 30)
        expect(e.state.held).toBe(false)
        expect(e.state.scroll).toBeGreaterThan(scroll)
        scroll = e.state.scroll
        // The speed follows the photos, as in any walk: a café neither speeds it up nor slows it down.
        expect(e.state.tier).toBe(tierOf(e.state.photos))
        // Until the first café, the walk is the walk that found nothing, frame for frame.
        if (!e.state.shopfronts.length && !finding.holds.length) {
          const p = plain.engine
          const pg = p.activeGate()
          const pw = pg ? (p.state.answered === 2 ? (pg.correct + 1) % pg.options.length : pg.correct) : p.state.lane
          while (p.state.lane !== pw) p.steer(p.state.lane < pw ? 1 : -1)
          p.step(1 / 30)
          expect(e.state.gates.map((x) => [x.word.id, x.z])).toEqual(p.state.gates.map((x) => [x.word.id, x.z]))
        }
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
      expect(plain.engine.state.photos).toBeGreaterThan(0)
    } finally {
      finding.stop()
      plain.stop()
    }
  })

  it('the café takes a gate\'s slot: it asks nothing, keeps its slot, and Casey walks through it', () => {
    const { engine, holds, stop } = walkWithFinds('meanings only', [5], { hold: false })
    try {
      engine.start()
      runUntil(engine, () => holds.length > 0)
      const shop = holds[0].shop
      expect(shop).toMatchObject({ name: 'Café 0', held: false })
      expectInFirstFreeSlot(engine, shop.z)
      // The gate in front of it is the one that was last on the road.
      const front = engine.state.gates.filter((g) => g.z < shop.z).at(-1)!
      expect(shop.z - front.z).toBeCloseTo(SPACING, 9)
      let answered = engine.state.answered
      runUntil(engine, () => engine.state.shopfronts.length === 0, 30, () => {
        expect(engine.state.held).toBe(false)
        expectSlotsEvenlySpaced(engine)
        if (engine.state.shopfronts.length && engine.state.gates.includes(front)) expect(shop.z - front.z).toBeCloseTo(SPACING, 9)
        // Every answer is a gate's: the café's slot asks nothing, so nothing is answered as it passes.
        if (engine.state.answered !== answered) {
          answered = engine.state.answered
          expect(Math.abs(shop.z)).toBeGreaterThan(SPACING - 0.2)
        }
      })
      expect(front.resolved).toBe(true)
      // It passed Casey (z 0) and left the road, and the gate behind it is next.
      expect(shop.z).toBeLessThanOrEqual(SHOPFRONT_GONE)
      const next = engine.activeGate()!
      expect(next.z - shop.z).toBeCloseTo(SPACING, 9)
      expect(engine.state.phase).toBe('play')
    } finally {
      stop()
    }
  })

  it.each(MODES)('%s: in every frame of a walk with finds the road\'s slots stand evenly, and every gate still asks', (mode) => {
    const { engine, holds, stop } = walkWithFinds(mode, [5, 15, 25, 35], { seed: 13, hold: false })
    const gatesSeen = new Set<number>()
    try {
      engine.start()
      runUntil(engine, () => engine.state.photos >= 40, 300, () => {
        expectSlotsEvenlySpaced(engine)
        for (const g of engine.state.gates) gatesSeen.add(g.id)
      })
      expect(holds).toHaveLength(4)
      // Every answer was a gate's, one per gate passed: the cafés took slots, not answers.
      const passed = [...gatesSeen].filter((id) => !engine.state.gates.some((g) => g.id === id && !g.resolved)).length
      expect(engine.state.answered).toBe(passed)
      expect(engine.state.photos).toBe(engine.state.answered)
    } finally {
      stop()
    }
  })

  it('the train run finds no café: nothing is placed and nothing holds', () => {
    const engine = createRunEngine({ walk: 'train', cityIndex: 0, pool: runWordsForCity(0), sink: createProgressRunResultsSink({ countRun: () => {}, recordPhoto: () => cafeAt(0) }), rng: mulberry32(3), trainLimit: 12 })
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
    const engine = createRunEngine({ walk: 'words', cityIndex: 0, pool: runWordsForCity(0), articleLanes: gateLanes, sink, rng: mulberry32(8), now: () => 1000 })
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

  it('deferred writes: a café found mid-walk takes the first free gate slot a moment later', () => {
    const waiting: (() => void)[] = []
    let photos = 0
    const sink = createProgressRunResultsSink(
      { countRun: () => {}, recordPhoto: ({ findsCafes }) => (findsCafes && ++photos === 5 ? cafeAt(0) : null) },
      { defer: (run) => (waiting.push(run), () => waiting.splice(waiting.indexOf(run), 1)) },
    )
    const engine = createRunEngine({ walk: 'words', cityIndex: 0, pool: runWordsForCity(0), articleLanes: gateLanes, sink, rng: mulberry32(8), now: () => 1000 })
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
      expectInFirstFreeSlot(engine, shop.z)
      expectSlotsEvenlySpaced(engine)
    } finally {
      stop()
    }
  })

  it('nothing is placed before a run starts or after it ends', () => {
    const { engine, stop } = walkWithFinds('meanings only', [])
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

/** The share of a gate's suitcases at `z` that stand behind something whose top is at `top` on the screen. */
function hiddenShare(z: number, top: number, lanes: number): number {
  const me = gateBox(z, lanes)
  return Math.max(0, Math.min(1, (me.base - top) / (me.base - me.suitcaseTop)))
}

describe('the café on the road, on the screen', () => {
  const walks: [Mode, number][] = [
    ['meanings only', 3],
    ['article gates', 3],
  ]
  /** The kerbs, either side of the middle of the road (draw.ts: 1.5 lanes of 158). */
  const KERB = 237

  it.each(walks)('%s: comes down the road like a gate in its slot, from far away; the active gate is never hidden', (mode, laneCount) => {
    const { engine, stop } = walkWithFinds(mode, [5, 15, 25, 35, 45], { seed: 77, hold: false })
    const firstDrawn = new Map<number, number>()
    let behindChecked = 0
    try {
      engine.start()
      runUntil(
        engine,
        () => engine.state.photos >= 50 || engine.state.phase !== 'play',
        400,
        () => {
          const road = slotAlphas(engine.state)
          road.forEach(({ slot, alpha }, i) => {
            const front = road[i + 1]?.slot
            if (slot.kind === 'cafe') {
              const drawn = cafeDrawnAlpha(slot.shop.z, alpha)
              if (drawn > 0 && !firstDrawn.has(slot.shop.id)) firstDrawn.set(slot.shop.id, slot.shop.z)
              // Behind a gate it comes out exactly as a gate in its slot would.
              if (front?.kind === 'gate') expect(alpha).toBe(queuedGateAlpha(slot.shop.z, front.gate.z, laneCount))
            } else if (front?.kind === 'cafe') {
              // A gate behind a café is drawn only once its suitcases are mostly clear of the café's name board.
              if (alpha > 0) {
                behindChecked++
                expect(hiddenShare(slot.gate.z, kioskRects(front.shop.z).board.top, laneCount)).toBeLessThan(0.6)
              }
            }
          })
          // The gate being asked is always drawn whole, and a café in front of it covers no more than a sliver of its suitcases.
          const active = engine.activeGate()
          const entry = active && road.find((r) => r.slot.kind === 'gate' && r.slot.gate === active)
          if (entry && active.z > 0) {
            expect(entry.alpha).toBe(1)
            for (const shop of engine.state.shopfronts)
              if (shop.z > 0 && shop.z < active.z) expect(hiddenShare(active.z, kioskRects(shop.z).board.top, laneCount)).toBeLessThan(0.1)
          }
        },
      )
      expect(engine.state.photos).toBeGreaterThanOrEqual(45)
      expect(firstDrawn.size).toBeGreaterThanOrEqual(4)
      // Seen from far down the road: well over a gate and a half away, where the old in-between café only began.
      for (const z of firstDrawn.values()) expect(z).toBeGreaterThan(1.5 * SPACING)
      expect(behindChecked).toBeGreaterThan(20)
    } finally {
      stop()
    }
  })

  it('beyond the haze it is not drawn at all, and it comes out of it as a gate does: nothing pops up in view', () => {
    expect(cafeDrawnAlpha(FAR + 0.01, 1)).toBe(0)
    expect(cafeDrawnAlpha(FAR, 1)).toBe(0)
    expect(cafeDrawnAlpha(FAR - 0.3, 1)).toBeCloseTo(0.5, 9)
    expect(cafeDrawnAlpha(FAR - 0.6, 1)).toBeCloseTo(1, 9)
    expect(cafeDrawnAlpha(3, 0)).toBe(0)
  })

  it('covers the road kerb to kerb all the way, for two and three lanes', () => {
    for (let z = FAR; z > SHOPFRONT_GONE; z -= 0.01) {
      const box = cafeBox(z)
      const s = 1 / (1 + z)
      expect(box.left).toBeCloseTo(240 - KERB * s, 9)
      expect(box.right).toBeCloseTo(240 + KERB * s, 9)
      // The kiosk and its island reach both kerbs, and every part stays in its box.
      const { kiosk, board } = kioskRects(z)
      expect(kiosk.left).toBeCloseTo(box.left, 9)
      expect(kiosk.right).toBeCloseTo(box.right, 9)
      for (const part of [kiosk, board]) {
        expect(part.left).toBeGreaterThanOrEqual(box.left - 1e-9)
        expect(part.right).toBeLessThanOrEqual(box.right + 1e-9)
        expect(part.top).toBeGreaterThanOrEqual(box.top - 1e-9)
        expect(part.bottom).toBeLessThanOrEqual(box.bottom + 1e-9)
      }
    }
  })

  it('it is bigger than the kiosk was, and the check on the gate behind can fail: far off, its board hides most of that gate, which is then not drawn', () => {
    expect(KIOSK_SCALE).toBeGreaterThan(1)
    const cafe = 5
    const behind = cafe + SPACING
    expect(hiddenShare(behind, kioskRects(cafe).board.top, 3)).toBeGreaterThan(0.6)
    const shop = { id: 1, name: 'Café Solen', z: cafe, held: false, reached: false }
    const gate = { z: behind } as RunEngine['state']['gates'][number]
    const road = slotAlphas({ gates: [gate], shopfronts: [shop], lanes: 3 })
    expect(road.map((r) => [r.slot.kind, r.alpha])).toEqual([
      ['gate', 0],
      ['cafe', 1],
    ])
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

  it.each(MODES)('%s: her drawn place never leaves her lane because of a café; there is no swerve', (mode) => {
    const { engine, stop } = walkWithFinds(mode, [5, 15, 25, 35], { seed: 5, hold: false })
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

// The café-collect sound (owner, 2026-10-05: "a satisfying sound when someone
// collects the cafés"). The screen plays it from `cafeReached`
// (SightseeingScreen.tsx -> feedback.ts `cafeCollectSound`), so what is
// tested here is when that event comes: once per café, as Casey reaches it,
// on every walk, and never in the step that registers an answer. With article
// gates, a café can stand right in front of an article gate, at the start of
// its run-up (never inside it): it is still at least a whole slot from every
// gate, so it is collected in no answer step.
describe('collecting a café: the cafeReached event the café sound plays from', () => {
  /** Finds as an article gate is next to be placed: the café stands in front of it, at the start of its run-up. */
  const DENSE = [10, 17, 24]
  it.each([
    ['meanings only', true, [5, 9, 15, 25]],
    ['meanings only', false, [5, 9, 15, 25]],
    ['article gates', true, [5, 9, 15, 25]],
    ['article gates', false, [5, 9, 15, 25]],
    ['article gates', true, DENSE],
    ['article gates', false, DENSE],
  ] as const)('%s (hold %s): once per café, as Casey reaches it, never in an answer step (finds at %j)', (mode, hold, findAt) => {
    let step = 0
    const log: { step: number; what: 'reached' | 'held' | 'answer'; id?: number; z?: number }[] = []
    /** Cafés with an article gate right behind them, the run-up between. */
    const beforeRunUp = new Set<number>()
    const { engine, holds, stop } = walkWithFinds(mode, findAt, {
      hold,
      events: {
        cafeReached: (shop) => {
          log.push({ step, what: 'reached', id: shop.id, z: shop.z })
          if (engine.state.gates.some((g) => g.kind === 'article' && Math.abs(g.z - shop.z - (4 / 3) * SPACING) < 1e-6)) beforeRunUp.add(shop.id)
        },
        cafeHeld: (shop) => log.push({ step, what: 'held', id: shop.id }),
        photo: () => log.push({ step, what: 'answer' }),
        miss: () => log.push({ step, what: 'answer' }),
      },
    })
    try {
      engine.start()
      runUntil(
        engine,
        () => holds.length === findAt.length && engine.state.shopfronts.every((c) => c.reached),
        240,
        () => {
          step++
          if (engine.state.held) engine.carryOn()
          // No café ever stands inside an article gate's run-up.
          for (const g of engine.state.gates) {
            if (g.kind !== 'article') continue
            for (const shop of engine.state.shopfronts) expect(shop.z > g.z - (4 / 3) * SPACING + 1e-6 && shop.z < g.z - 1e-6).toBe(false)
          }
        },
      )
      // Run on past the last café: walking on collects nothing more.
      const after = engine.state.photos
      runUntil(engine, () => engine.state.photos >= after + 6, 60, () => step++)
      const reached = log.filter((e) => e.what === 'reached')
      expect(holds).toHaveLength(findAt.length)
      expect(reached.map((e) => e.id)).toEqual(holds.map((h) => h.shop.id))
      for (const e of reached) {
        // At Casey, not before: the moment she walks into it.
        expect(e.z!).toBeLessThanOrEqual(SHOPFRONT_REACHED)
        expect(e.z!).toBeGreaterThan(SHOPFRONT_GONE)
        // Not in the step of an answer, nor the ones right around it.
        const answers = log.filter((a) => a.what === 'answer').map((a) => a.step)
        for (const a of answers) expect(Math.abs(a - e.step), `café ${e.id} at step ${e.step}, an answer at ${a}`).toBeGreaterThan(3)
      }
      const held = log.filter((e) => e.what === 'held')
      if (hold) {
        // The first session's walk: collected (and its sound started) as the panel opens, in the same step, first.
        expect(held.map((e) => e.id)).toEqual(reached.map((e) => e.id))
        for (const h of held) {
          const r = log.findIndex((e) => e.what === 'reached' && e.id === h.id)
          expect(log[r].step).toBe(h.step)
          expect(r).toBeLessThan(log.indexOf(h))
        }
      } else {
        expect(held).toEqual([])
      }
      // The DENSE walks put a café right in front of an article gate, its run-up behind it.
      if (findAt === DENSE) expect(beforeRunUp.size).toBeGreaterThan(0)
      if (mode === 'meanings only') expect(beforeRunUp.size).toBe(0)
    } finally {
      stop()
    }
  })
})
