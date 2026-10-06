import { describe, expect, it } from 'vitest'
import { RUN_READY_GATES, takeGateToReady } from '../../run/audio'
import { createRunEngine, runIsQuiet, type RunGate } from '../../run/engine'
import { createMemoryRunResultsSink } from '../../run/results'
import { activeArticleGateLanes, runWordsForCity } from '../../run/sources'
import type { RunWord } from '../../run/words'
import { gateRecordings } from './SightseeingScreen'

/**
 * Long sessions (build 123): a gate readies only the recording the run will
 * say. Every word the run says, right or after a miss, was readied when its
 * gate was placed, and nothing else is readied: one recording a gate, not
 * three.
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

describe('the recordings a Sightseeing gate readies', () => {
  it('readies one recording a gate, and every word the run says was readied before it is said', () => {
    const readied: RunWord[] = []
    const said: RunWord[] = []
    const gates: RunGate[] = []
    const engine = createRunEngine({
      cityIndex: 0,
      pool: runWordsForCity(0),
      sink: createMemoryRunResultsSink(),
      rng: mulberry32(11),
      onGateSpawned: (gate) => {
        gates.push(gate)
        readied.push(...gateRecordings(gate))
      },
      events: { photo: (w) => said.push(w), miss: (w) => said.push(w) },
    })
    engine.start()
    // Right forty times, then wrong until the run ends.
    for (let i = 0; i < 100_000 && engine.state.phase === 'play'; i++) {
      const g = engine.activeGate()
      if (g) engine.state.lane = engine.state.photos < 40 ? g.correct : (g.correct + 1) % g.options.length
      engine.step(1 / 30)
    }
    expect(engine.state.phase).toBe('over')
    expect(said.length).toBeGreaterThan(40)
    expect(readied).toHaveLength(gates.length)
    const readiedIds = new Set(readied.map((w) => w.id))
    for (const w of said) expect(readiedIds.has(w.id)).toBe(true)
    // The wrong suitcases are never said, so they are never readied.
    for (const g of gates) expect(gateRecordings(g)).toEqual([g.word])
  })
})

/**
 * After build 124 (owner: "A player is not needed after the gate has been
 * cleared"): only the current gate and the next two have their word readied,
 * a gate passed before its turn is dropped, and still every word the run says
 * was readied before its gate reached Casey, in both walks' kinds of gate.
 */
describe('which gates a walk readies', () => {
  for (const articles of [false, true]) {
    it(`readies only the current gate and the next ${RUN_READY_GATES - 1}, each before it reaches Casey${articles ? ' (article gates)' : ''}`, () => {
      const queue: RunGate[] = []
      const readied = new Set<number>()
      const said: RunGate[] = []
      const engine = createRunEngine({
        walk: 'words',
        cityIndex: 0,
        pool: runWordsForCity(0),
        articleLanes: articles ? activeArticleGateLanes() : null,
        sink: createMemoryRunResultsSink(),
        rng: mulberry32(articles ? 5 : 11),
        onGateSpawned: (gate) => void queue.push(gate),
        events: {
          photo: () => said.push(engine.state.gates.find((g) => g.resolved && !said.includes(g))!),
          miss: () => said.push(engine.state.gates.find((g) => g.resolved && !said.includes(g))!),
        },
      })
      engine.start()
      let lastAnswered = 0
      let answeredAt = -Infinity
      let articleGates = 0
      for (let i = 0; i < 100_000 && engine.state.phase === 'play'; i++) {
        const g = engine.activeGate()
        if (g) engine.state.lane = engine.state.photos < 40 ? g.correct : (g.correct + 1) % g.options.length
        engine.step(1 / 30)
        const st = engine.state
        if (st.answered !== lastAnswered) {
          lastAnswered = st.answered
          answeredAt = st.clock
        }
        // As the screen's frame does: one gate a quiet frame.
        if (queue.length && runIsQuiet(st, st.clock - answeredAt)) {
          const gate = takeGateToReady(queue, st.gates)
          if (gate) {
            readied.add(gate.id)
            if (gate.kind === 'article') articleGates++
          }
        }
        // Never more than three gates readied and not yet passed.
        const live = st.gates.filter((x) => !x.resolved && readied.has(x.id))
        expect(live.length).toBeLessThanOrEqual(RUN_READY_GATES)
      }
      expect(said.length).toBeGreaterThan(40)
      for (const gate of said) expect(readied.has(gate.id)).toBe(true)
      if (articles) expect(articleGates).toBeGreaterThan(0)
    })
  }

  it('drops a gate already passed and waits with one beyond the next two', () => {
    const gate = (id: number, resolved = false) => ({ id, resolved })
    const road = [gate(1, true), gate(2), gate(3), gate(4), gate(5)]
    const queue = [gate(1, true), gate(5), gate(2)]
    // Gate 1 is passed: dropped. Gate 5 is fourth on the road: it waits.
    expect(takeGateToReady(queue, road)).toBeUndefined()
    expect(queue.map((g) => g.id)).toEqual([5, 2])
    road[1]!.resolved = true
    expect(takeGateToReady(queue, road)?.id).toBe(5)
    // A gate gone from the road is dropped too.
    expect(takeGateToReady([gate(9)], road)).toBeUndefined()
  })
})
