import { afterEach, describe, expect, it, vi } from 'vitest'
import { WORDS } from '../data/words'
import type { Cafe } from '../journey/cafes'
import { createRunEngine } from './engine'
import type { RunPhoto, RunResult } from './results'
import { createProgressRunResultsSink, onCafeFound, type ProgressSinkDeps } from './sinkSetup'
import { runWordsForCity } from './sources'
import { after, createWriteQueue, flushWhenHidden, WRITE_AFTER_MS, type Schedule } from './writeQueue'

/** A schedule the test runs by hand: `fire()` runs what is waiting. */
function manual() {
  const waiting: (() => void)[] = []
  const schedule: Schedule = (run) => {
    waiting.push(run)
    return () => {
      const i = waiting.indexOf(run)
      if (i >= 0) waiting.splice(i, 1)
    }
  }
  return { schedule, waiting, fire: () => waiting.splice(0).forEach((run) => run()) }
}

describe('the write queue', () => {
  it('coalesces: entries pushed before the schedule runs are applied once, together, in order', () => {
    const m = manual()
    const batches: number[][] = []
    const q = createWriteQueue<number>((b) => void batches.push([...b]), m.schedule)
    q.push(1)
    q.push(2)
    q.push(3)
    expect(m.waiting).toHaveLength(1)
    expect(batches).toEqual([])
    expect(q.size).toBe(3)
    m.fire()
    expect(batches).toEqual([[1, 2, 3]])
    expect(q.size).toBe(0)
  })

  it('a flush applies now and cancels the schedule, so nothing is applied twice', () => {
    const m = manual()
    const applied: number[] = []
    const q = createWriteQueue<number>((b) => void applied.push(...b), m.schedule)
    q.push(1)
    q.push(2)
    q.flush()
    expect(applied).toEqual([1, 2])
    expect(m.waiting).toHaveLength(0)
    q.flush()
    m.fire()
    expect(applied).toEqual([1, 2])
    q.push(3)
    m.fire()
    expect(applied).toEqual([1, 2, 3])
  })

  it('an entry pushed while a batch is applied makes the next batch', () => {
    const m = manual()
    const batches: number[][] = []
    let q!: ReturnType<typeof createWriteQueue<number>>
    q = createWriteQueue<number>((b) => {
      batches.push([...b])
      if (b.includes(1)) q.push(9)
    }, m.schedule)
    q.push(1)
    m.fire()
    expect(batches).toEqual([[1]])
    expect(q.size).toBe(1)
    m.fire()
    expect(batches).toEqual([[1], [9]])
  })

  it('a batch that throws is not applied again', () => {
    const m = manual()
    let calls = 0
    const q = createWriteQueue<number>(() => {
      calls++
      throw new Error('storage')
    }, m.schedule)
    q.push(1)
    expect(() => q.flush()).toThrow('storage')
    q.flush()
    m.fire()
    expect(calls).toBe(1)
  })

  it('the app schedule writes WRITE_AFTER_MS after the first entry of a batch', () => {
    vi.useFakeTimers()
    try {
      const applied: number[][] = []
      const q = createWriteQueue<number>((b) => void applied.push([...b]), after(WRITE_AFTER_MS))
      q.push(1)
      vi.advanceTimersByTime(WRITE_AFTER_MS - 50)
      q.push(2)
      expect(applied).toEqual([])
      vi.advanceTimersByTime(50)
      expect(applied).toEqual([[1, 2]])
      expect(WRITE_AFTER_MS).toBeGreaterThan(200)
      expect(WRITE_AFTER_MS).toBeLessThan(1750)
    } finally {
      vi.useRealTimers()
    }
  })
})

/** A stand-in window and document that remember their listeners. */
function page() {
  const on = new Map<string, Set<() => void>>()
  const target = {
    addEventListener: (type: string, f: () => void) => void (on.get(type) ?? on.set(type, new Set()).get(type)!).add(f),
    removeEventListener: (type: string, f: () => void) => void on.get(type)?.delete(f),
  }
  const doc = { ...target, visibilityState: 'visible' as DocumentVisibilityState }
  const fire = (type: string) => on.get(type)?.forEach((f) => f())
  return { target, doc, fire, count: () => [...on.values()].reduce((n, s) => n + s.size, 0) }
}

describe('flushed when the page is hidden or goes away', () => {
  it('pagehide, freeze and a hidden page flush; a page that becomes visible does not; stop listening removes all', () => {
    const p = page()
    let flushed = 0
    const stop = flushWhenHidden(() => flushed++, p.target as never, p.doc as never)
    p.fire('pagehide')
    p.fire('freeze')
    expect(flushed).toBe(2)
    p.fire('visibilitychange')
    expect(flushed).toBe(2)
    p.doc.visibilityState = 'hidden'
    p.fire('visibilitychange')
    expect(flushed).toBe(3)
    stop()
    expect(p.count()).toBe(0)
  })

  it('a stand-in window without events is left alone', () => {
    expect(() => flushWhenHidden(() => {}, {} as never, undefined)()).not.toThrow()
  })
})

// ── the progress sink, deferred ─────────────────────────────────────────────

function recorder(found: (at: number) => Cafe | null = () => null) {
  const log: string[] = []
  const deps: ProgressSinkDeps = {
    countRun: (at) => void log.push(`count ${at}`),
    recordPhoto: ({ wordId, at, findsCafes, zone }) => {
      log.push(`photo ${wordId} ${at} ${findsCafes} ${zone}`)
      return findsCafes ? found(at) : null
    },
    catchTrain: (r) => void log.push(`ticket ${r.endedAt}`),
    batch: (writes) => {
      log.push('batch[')
      writes()
      log.push(']')
    },
    zone: () => {
      log.push('zone')
      return 'Europe/Copenhagen'
    },
  }
  return { log, deps }
}

const photo = (at: number, patch: Partial<RunPhoto> = {}): RunPhoto =>
  ({ walk: 'words', kind: 'meaning', wordId: 'da:hus', origin: 'board', at, ...patch })
const result = (patch: Partial<RunResult> = {}): RunResult => ({
  walk: 'words', cityIndex: 0, startedAt: 1, endedAt: 2, end: 'second-wrong', photos: 0, answered: 0, forgiven: 1, total: 0, misses: [], words: [], ...patch,
})

describe('the deferred progress sink', () => {
  afterEach(() => vi.restoreAllMocks())

  it('an answer writes nothing in its own frame; the batch is written later, each fact with its own time, in one batch', () => {
    const m = manual()
    const { log, deps } = recorder()
    const sink = createProgressRunResultsSink(deps, { defer: m.schedule })
    sink.photo(photo(100))
    sink.photo(photo(200, { wordId: 'da:kat' }))
    expect(log).toEqual([])
    expect(sink.pending).toBe(3)
    m.fire()
    expect(log).toEqual([
      'batch[',
      'count 100',
      'zone',
      'photo da:hus 100 true Europe/Copenhagen',
      'photo da:kat 200 true Europe/Copenhagen',
      ']',
    ])
    expect(sink.pending).toBe(0)
  })

  it('the run\'s end writes everything still queued, before the ticket, exactly once', () => {
    const m = manual()
    const { log, deps } = recorder()
    const sink = createProgressRunResultsSink(deps, { defer: m.schedule })
    sink.photo(photo(5, { walk: 'train' }))
    sink.end(result({ walk: 'train', end: 'caught', answered: 1, endedAt: 9 }))
    expect(log.filter((l) => l !== 'batch[' && l !== ']' && l !== 'zone')).toEqual(['count 5', 'photo da:hus 5 false Europe/Copenhagen', 'ticket 9'])
    m.fire()
    sink.flush()
    expect(log.filter((l) => l.startsWith('photo'))).toHaveLength(1)
  })

  it('a flush (pause, a hidden page) writes now; a café found is heard then, with its photo\'s own time', () => {
    const m = manual()
    const cafe = { index: 3, state: 'found', foundAt: 300 } as unknown as Cafe
    const { log, deps } = recorder((at) => (at === 300 ? cafe : null))
    const sink = createProgressRunResultsSink(deps, { defer: m.schedule })
    const heard: [number, number][] = []
    const stop = onCafeFound((c, p) => heard.push([c.index, p.at]))
    try {
      sink.photo(photo(300))
      expect(heard).toEqual([])
      sink.flush()
      expect(heard).toEqual([[3, 300]])
      // The listeners hear it after the batch is stored.
      expect(log[log.length - 1]).toBe(']')
      m.fire()
      expect(heard).toHaveLength(1)
    } finally {
      stop()
    }
  })

  it('a failing writer loses no other fact of the batch, and is not retried', () => {
    const m = manual()
    const { log, deps } = recorder()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    let first = true
    const sink = createProgressRunResultsSink(
      {
        ...deps,
        recordPhoto: (p) => {
          if (first) {
            first = false
            throw new Error('a time no schema accepts')
          }
          return deps.recordPhoto(p)
        },
      },
      { defer: m.schedule },
    )
    sink.photo(photo(1))
    sink.photo(photo(2))
    m.fire()
    sink.flush()
    expect(log.filter((l) => l.startsWith('photo') || l.startsWith('count'))).toEqual(['count 1', 'photo da:hus 2 true Europe/Copenhagen'])
  })

  it('through the real engine: a walk left mid-run writes every photo exactly once, at its answer\'s time', () => {
    const m = manual()
    const { log, deps } = recorder()
    const sink = createProgressRunResultsSink(deps, { defer: m.schedule })
    let clock = 1_000_000
    const engine = createRunEngine({ cityIndex: 0, pool: runWordsForCity(0), sink, rng: () => 0.42, now: () => clock })
    const answeredAt: number[] = []
    engine.start()
    for (let i = 0; i < 30 * 20; i++) {
      const g = engine.activeGate()
      if (g) engine.state.lane = g.correct
      const before = engine.state.photos
      clock += 1000 / 30
      engine.step(1 / 30)
      if (engine.state.photos > before) answeredAt.push(clock)
      // Some batches written along the way, some still queued when the player leaves.
      if (i % 120 === 60) m.fire()
    }
    // One more answer, left queued when the player leaves.
    const n = answeredAt.length
    for (let i = 0; i < 30 * 5 && answeredAt.length === n; i++) {
      const g = engine.activeGate()
      if (g) engine.state.lane = g.correct
      const before = engine.state.photos
      clock += 1000 / 30
      engine.step(1 / 30)
      if (engine.state.photos > before) answeredAt.push(clock)
    }
    expect(answeredAt.length).toBeGreaterThan(4)
    expect(sink.pending).toBeGreaterThan(0)
    engine.leave()
    expect(sink.pending).toBe(0)
    m.fire()
    const photos = log.filter((l) => l.startsWith('photo')).map((l) => Number(l.split(' ')[2]))
    expect(photos).toEqual(answeredAt)
    expect(log.filter((l) => l.startsWith('count'))).toEqual([`count ${answeredAt[0]}`])
    expect(WORDS.length).toBeGreaterThan(0)
  })
})
