import { describe, expect, it } from 'vitest'
import { createRunEngine, QUIET_AFTER, QUIET_BEFORE, runIsQuiet } from './engine'
import { createMemoryRunResultsSink } from './results'
import { runWordsForCity } from './sources'

describe('the quiet part of a gate: work that can wait keeps clear of every answer', () => {
  it('is never quiet within QUIET_BEFORE of the next answer or QUIET_AFTER of the last, and is quiet in between', () => {
    const engine = createRunEngine({ cityIndex: 0, pool: runWordsForCity(0), sink: createMemoryRunResultsSink(), rng: () => 0.3, now: () => 1 })
    expect(runIsQuiet(engine.state, Infinity)).toBe(true) // not started: nothing to keep clear of
    engine.start()
    let lastAnswer = -Infinity
    let answered = 0
    let quiet = 0
    let loud = 0
    for (let i = 0; i < 30 * 40; i++) {
      const g = engine.activeGate()!
      engine.state.lane = g.correct
      engine.step(1 / 30)
      const s = engine.state
      if (s.answered !== answered) {
        answered = s.answered
        lastAnswer = s.clock
      }
      const next = s.gates.find((x) => !x.resolved)!
      const toNext = next.z / s.speed
      const sinceLast = s.clock - lastAnswer
      const q = runIsQuiet(s, sinceLast)
      if (toNext < QUIET_BEFORE || sinceLast < QUIET_AFTER) expect(q).toBe(false)
      else expect(q).toBe(true)
      if (q) quiet++
      else loud++
    }
    expect(answered).toBeGreaterThan(8)
    // Most of every gate is quiet: plenty of frames to make the next gates' pictures in.
    expect(quiet).toBeGreaterThan(loud * 2)
  })
})
