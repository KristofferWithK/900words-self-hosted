import { describe, expect, it } from 'vitest'
import { WORDS } from '../data/words'
import { cityWords } from '../journey/cityWords'
import { askableWords } from './distractors'
import { createRunEngine, type RunEngine } from './engine'
import { createMemoryRunResultsSink, type RunResult } from './results'
import { createProgressRunResultsSink, type ProgressSinkDeps } from './sinkSetup'
import { runWordsForCity } from './sources'
import { GATE_TIERS } from './tiers'

/**
 * CATCH THE TRAIN (card CW-07; contract sections 2 and 4): every word of the
 * city once, slips from collected words, the walks' slip rule (slips forgive,
 * the next wrong ends the run), caught when every word is answered.
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

const POOL = runWordsForCity(0)

/** Drive a run: `answer(n, correct)` says the lane to be in at the n-th gate (0-based). */
function drive(engine: RunEngine, answer: (n: number, correct: number) => number, maxSeconds = 900): void {
  const decided = new Map<number, number>()
  for (let t = 0; t < maxSeconds * 30 && engine.state.phase === 'play'; t++) {
    const g = engine.activeGate()
    if (g && g.z < 0.2) {
      if (!decided.has(g.id)) decided.set(g.id, answer(decided.size, g.correct))
      engine.state.lane = decided.get(g.id)!
    }
    engine.step(1 / 30)
  }
}

const wrong = (correct: number) => (correct + 1) % 3

function trainRun(options: { forgiven?: number | (() => number); trainLimit?: number; seed?: number } = {}) {
  const sink = createMemoryRunResultsSink()
  const ended: RunResult[] = []
  const asked: string[] = []
  const engine = createRunEngine({
    walk: 'train',
    cityIndex: 0,
    pool: POOL,
    sink,
    rng: mulberry32(options.seed ?? 7),
    now: () => 5000,
    forgiven: options.forgiven ?? 3,
    trainLimit: options.trainLimit,
    onGateSpawned: (g) => asked.push(g.word.id),
    events: { end: (r) => ended.push(r) },
  })
  return { engine, sink, ended, asked }
}

describe('the train run', () => {
  it('is every word of Sønderborg: 147, the length of cityWords', () => {
    expect(cityWords(WORDS, 0)).toHaveLength(147)
    expect(askableWords(POOL)).toHaveLength(147)
    const { engine } = trainRun()
    expect(engine.asked).toHaveLength(147)
  })

  it('asks every word exactly once, shuffled, and catches the train when the last is answered', () => {
    const { engine, ended, asked, sink } = trainRun()
    engine.start()
    expect(engine.state.total).toBe(147)
    expect(engine.trainWords()).toHaveLength(147)
    drive(engine, (_n, correct) => correct)
    expect(engine.state.phase).toBe('over')
    expect(engine.state.endReason).toBe('caught')
    expect(asked).toHaveLength(147)
    expect(new Set(asked).size).toBe(147)
    expect(new Set(asked)).toEqual(new Set(askableWords(POOL).map((w) => w.id)))
    // Shuffled: not the pool's own order.
    expect(asked).not.toEqual(askableWords(POOL).map((w) => w.id))
    expect(ended).toHaveLength(1)
    const r = sink.results[0]!
    expect(r).toMatchObject({ walk: 'train', end: 'caught', answered: 147, photos: 147, total: 147, forgiven: 3 })
    expect(r.misses).toHaveLength(0)
  })

  it('does not end with slips left, nor with the last slip used, and ends one past it', () => {
    // Three slips: wrong answers at gates 2, 5 and 9 are forgiven; the run is still on.
    const { engine, ended } = trainRun({ forgiven: 3 })
    engine.start()
    const misses = new Set([2, 5, 9, 12])
    let lastAnswered = -1
    drive(engine, (n, correct) => {
      lastAnswered = n
      return misses.has(n) ? wrong(correct) : correct
    })
    const r = ended[0]!
    expect(r.end).toBe('second-wrong')
    // Ended exactly at the fourth wrong answer (gate 12), one past the three slips.
    expect(lastAnswered).toBe(12)
    expect(r.answered).toBe(13)
    expect(r.misses.map((m) => m.ended)).toEqual([false, false, false, true])
    expect(r.forgiven).toBe(3)
  })

  it('with every slip used, the run is still on and can still catch the train', () => {
    const { engine, ended } = trainRun({ forgiven: 2, trainLimit: 12 })
    engine.start()
    const states: { slips: number; phase: string }[] = []
    drive(engine, (n, correct) => {
      states.push({ slips: engine.state.slips, phase: engine.state.phase })
      return n === 3 || n === 7 ? wrong(correct) : correct
    })
    // After the second (last) slip the run went on to the end.
    expect(states[8]).toEqual({ slips: 2, phase: 'play' })
    expect(ended[0]).toMatchObject({ end: 'caught', answered: 12, photos: 10 })
    expect(ended[0]!.misses).toHaveLength(2)
  })

  it('a wrong answer past the slips on the last word misses the train', () => {
    const { engine, ended } = trainRun({ forgiven: 0, trainLimit: 6 })
    engine.start()
    drive(engine, (n, correct) => (n === 5 ? wrong(correct) : correct))
    expect(ended[0]).toMatchObject({ end: 'second-wrong', answered: 6 })
  })

  it('follows the same speed curve by words answered, misses included, and never passes 1.75 s', () => {
    const { engine } = trainRun({ forgiven: 100 })
    engine.start()
    const tierAt = new Map<number, number>()
    drive(engine, (n, correct) => {
      if (!tierAt.has(n)) tierAt.set(n, engine.state.tier)
      return n % 2 ? wrong(correct) : correct
    }, 200)
    expect(tierAt.get(7)).toBe(0)
    expect(tierAt.get(8)).toBe(1)
    expect(tierAt.get(18)).toBe(2)
    expect(tierAt.get(28)).toBe(3)
    expect(Math.max(...tierAt.values())).toBe(GATE_TIERS.length - 1)
    expect(GATE_TIERS[GATE_TIERS.length - 1]!.seconds).toBe(1.75)
  })

  it('reads its slips again at every start', () => {
    let slips = 1
    const { engine } = trainRun({ forgiven: () => slips })
    engine.start()
    expect(engine.state.forgiven).toBe(1)
    engine.leave()
    slips = 8
    engine.start()
    expect(engine.state.forgiven).toBe(8)
  })

  it('a walk still forgives one and never ends caught', () => {
    const engine = createRunEngine({ cityIndex: 0, pool: POOL, sink: createMemoryRunResultsSink(), rng: mulberry32(3) })
    engine.start()
    expect(engine.state.forgiven).toBe(1)
    expect(engine.state.total).toBe(0)
    drive(engine, (n, correct) => (n < 160 ? correct : wrong(correct)), 900)
    expect(engine.state.endReason).toBe('second-wrong')
  })
})

describe('the train run through the progress sink', () => {
  function spies() {
    const calls = { countRun: [] as number[], photos: [] as { wordId: string | null; findsCafes: boolean }[], caught: [] as RunResult[] }
    const deps: ProgressSinkDeps = {
      countRun: (at) => void calls.countRun.push(at),
      recordPhoto: ({ wordId, findsCafes }) => {
        calls.photos.push({ wordId, findsCafes })
        return null
      },
      catchTrain: (r) => void calls.caught.push(r),
    }
    return { calls, sink: createProgressRunResultsSink(deps) }
  }

  const engineFor = (sink: ReturnType<typeof spies>['sink'], trainLimit?: number) => {
    let clock = 1000
    return createRunEngine({ walk: 'train', cityIndex: 0, pool: POOL, sink, rng: mulberry32(11), now: () => clock++, forgiven: 2, trainLimit })
  }

  it('O6: leaving before the first answer is free', () => {
    const { calls, sink } = spies()
    const engine = engineFor(sink)
    engine.start()
    engine.step(0.2)
    engine.leave()
    expect(calls.countRun).toEqual([])
    expect(calls.caught).toEqual([])
  })

  it('O6: the first answer counts the run once against the daily two, right or wrong', () => {
    for (const firstRight of [true, false]) {
      const { calls, sink } = spies()
      const engine = engineFor(sink)
      engine.start()
      drive(engine, (n, correct) => (n === 0 && !firstRight ? wrong(correct) : correct), 12)
      engine.leave()
      expect(calls.countRun, String(firstRight)).toHaveLength(1)
      expect(calls.caught).toEqual([])
    }
  })

  it('records every right answer as a photo of its meaning, finds no café, and stores the ticket only when caught', () => {
    const { calls, sink } = spies()
    const engine = engineFor(sink, 8)
    engine.start()
    drive(engine, (n, correct) => (n === 4 ? wrong(correct) : correct))
    expect(calls.countRun).toHaveLength(1)
    expect(calls.photos).toHaveLength(7)
    expect(calls.photos.every((p) => p.wordId !== null && p.findsCafes === false)).toBe(true)
    expect(calls.caught).toHaveLength(1)
    expect(calls.caught[0]).toMatchObject({ walk: 'train', end: 'caught', answered: 8, photos: 7, forgiven: 2, total: 8 })
  })

  it('a missed train stores no ticket', () => {
    const { calls, sink } = spies()
    const engine = engineFor(sink, 8)
    engine.start()
    drive(engine, (n, correct) => (n >= 2 ? wrong(correct) : correct))
    expect(engine.state.endReason).toBe('second-wrong')
    expect(calls.caught).toEqual([])
  })
})
