import { describe, expect, it } from 'vitest'
import type { WordEntry } from '../data/types'
import { LANGUAGES } from '../lang'
import { ARTICLE_GATE_EVERY, ARTICLE_RUN_UP, createRunEngine, FAR, LANES, ROAD_GATES, SPACING, type RunEngine, type RunGate } from './engine'
import { createMemoryRunResultsSink, tallyMisses, type RunMiss, type RunResult } from './results'
import { articleWords, runWordsForCity } from './sources'
import { articleGateLanes, articleLanes, chooseWalk, chosenWalk, hasArticleGates, laneOfArticle, OWNER_LANE_ORDER } from './walks'
import { boardRunWords, type RunWord } from './words'

/** A seeded generator, so a failure names a run that can be replayed. */
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

const DANISH = LANGUAGES.da!
const GERMAN = LANGUAGES.de!

const noun = (article: string | undefined, gender: string, extra: Partial<WordEntry> = {}) =>
  ({ pos: 'noun', article, gender, ...extra }) as Pick<WordEntry, 'pos' | 'article' | 'gender' | 'countable'>

/** Drive a run: `answer(gate)` says which lane to be in when each gate arrives. */
function drive(engine: RunEngine, answer: (gate: RunGate) => number, maxSeconds = 600): void {
  const decided = new Map<number, number>()
  for (let t = 0; t < maxSeconds * 30 && engine.state.phase === 'play'; t++) {
    const g = engine.activeGate()
    if (g && g.z < 0.2) {
      if (!decided.has(g.id)) decided.set(g.id, answer(g))
      engine.state.lane = decided.get(g.id)!
    }
    engine.step(1 / 30)
  }
}

/** Every gate a run placed, in order, answering each right, until `count` gates were placed. */
function gatesOf(engine: RunEngine, count: number): RunGate[] {
  const placed: RunGate[] = []
  const seen = new Set<number>()
  engine.start()
  for (let i = 0; i < 30 * 2000 && placed.length < count && engine.state.phase === 'play'; i++) {
    for (const g of engine.state.gates) {
      if (seen.has(g.id)) continue
      seen.add(g.id)
      placed.push(g)
    }
    const g = engine.activeGate()
    if (g) engine.state.lane = g.correct
    engine.step(1 / 30)
  }
  return placed.slice(0, count)
}

const danishLanes = articleGateLanes(DANISH)!
const germanLanes = articleGateLanes(GERMAN)!
const danishPool = runWordsForCity(0)

describe('a course\'s articles', () => {
  it('come from the course data, in the order of its gender table', () => {
    expect(articleLanes(DANISH)).toEqual(['en', 'et'])
    expect(articleLanes(GERMAN)).toEqual(['der', 'die', 'das'])
    const course = {
      words: [noun('das', 'neuter'), noun('die', 'feminine'), noun('der', 'masculine')],
      grammar: { genders: { masculine: {}, feminine: {}, neuter: {} } },
    }
    expect(articleLanes(course)).toEqual(['der', 'die', 'das'])
  })

  it('leave out a Danish mass noun, which the app shows with its gender and not an article', () => {
    const mass = DANISH.words.find((w) => w.pos === 'noun' && w.countable === false && w.article)!
    expect(mass).toBeDefined()
    const [word] = boardRunWords([mass])
    expect(word.article).toBeUndefined()
    expect(articleWords([word], danishLanes)).toEqual([])
  })
})

describe('the lanes of an article gate', () => {
  it('Danish: et on the left, a brick wall in the middle, en on the right (owner, 2026-10-05)', () => {
    expect(OWNER_LANE_ORDER.da).toEqual(['et', 'en'])
    expect(danishLanes).toEqual(['et', null, 'en'])
    expect(hasArticleGates(DANISH)).toBe(true)
  })

  it('German: der, die, das across the three lanes, left to right, no wall', () => {
    expect(germanLanes).toEqual(['der', 'die', 'das'])
    expect(hasArticleGates(GERMAN)).toBe(true)
  })

  it('another two-article course: its own order in the outer lanes, the wall in the middle', () => {
    const course = { code: 'xx', words: [noun('b', 'neuter'), noun('a', 'common')], grammar: { genders: { common: {}, neuter: {} } } }
    expect(articleGateLanes(course)).toEqual(['a', null, 'b'])
  })

  it('none for a course without articles, with one article, or with more than the road\'s three lanes hold', () => {
    const none = { words: [noun(undefined, 'a'), noun(undefined, 'b'), { pos: 'verb' as const }], grammar: { genders: { a: {}, b: {} } } }
    const one = { words: [noun('a', 'x'), noun('a', 'x')], grammar: { genders: { x: {} } } }
    const four = { words: ['p', 'q', 'r', 's'].map((a, i) => noun(a, `g${i}`)), grammar: { genders: { g0: {}, g1: {}, g2: {}, g3: {} } } }
    for (const course of [none, one, four]) {
      expect(articleGateLanes(course)).toBeNull()
      expect(hasArticleGates(course)).toBe(false)
    }
  })

  it('map an article to its own lane, and nothing to the wall', () => {
    expect(laneOfArticle(danishLanes, 'et')).toBe(0)
    expect(laneOfArticle(danishLanes, 'en')).toBe(2)
    expect(laneOfArticle(germanLanes, 'das')).toBe(2)
    expect(laneOfArticle(danishLanes, 'der')).toBe(-1)
    expect(laneOfArticle(danishLanes, undefined)).toBe(-1)
  })
})

describe('the Danish walk: article gates mixed in', () => {
  const engine = () => createRunEngine({ cityIndex: 0, pool: danishPool, articleLanes: danishLanes, sink: createMemoryRunResultsSink(), rng: mulberry32(1) })

  it('every seventh gate is an article gate, the others ask meanings (owner, after TestFlight 125: "maybe every 7")', () => {
    expect(ARTICLE_GATE_EVERY).toBe(7)
    const gates = gatesOf(engine(), 210)
    expect(gates).toHaveLength(210)
    gates.forEach((g, i) => expect(g.kind, `gate ${i + 1}`).toBe((i + 1) % 7 === 0 ? 'article' : 'meaning'))
    expect(gates.filter((g) => g.kind === 'article')).toHaveLength(30)
  })

  it('an article gate asks a City 1 noun with en or et: the noun on the tag, et left, the wall in the middle, en right', () => {
    const e = engine()
    expect(e.articles).toEqual(['et', null, 'en'])
    expect(e.articleNouns.length).toBeGreaterThan(ROAD_GATES)
    expect(e.articleNouns.every((w) => w.origin === 'board' && (w.article === 'en' || w.article === 'et'))).toBe(true)
    expect(e.articleNouns).toEqual(danishPool.filter((w) => w.article === 'en' || w.article === 'et'))
    const articleGates = gatesOf(e, 280).filter((g) => g.kind === 'article')
    expect(articleGates.length).toBe(40)
    for (const g of articleGates) {
      expect(g.options.map((o) => o.target)).toEqual(['et', '', 'en'])
      expect(g.wall).toBe(1)
      expect(g.correct).toBe(g.word.article === 'et' ? 0 : 2)
      expect(g.prompt).toBe(g.word.target)
    }
    expect(new Set(articleGates.map((g) => g.word.article))).toEqual(new Set(['en', 'et']))
  })

  it('a meaning gate is as it was: three words, no wall, the meaning on the tag', () => {
    for (const g of gatesOf(engine(), 40).filter((x) => x.kind === 'meaning')) {
      expect(g.options).toHaveLength(LANES)
      expect(g.wall).toBe(-1)
      expect(g.prompt).toBe(g.word.prompt)
      expect(g.options.every((o) => o.group !== 'article-lane')).toBe(true)
    }
  })

  it('every article gate has a run-up of 4/3 of the gate spacing (a third less than the old two gates), nothing between; the next gate follows at the usual spacing', () => {
    expect(ARTICLE_RUN_UP).toBeCloseTo((4 / 3) * SPACING, 12)
    const e = engine()
    e.start()
    let checked = 0
    for (let i = 0; i < 30 * 300 && e.state.phase === 'play'; i++) {
      const road = [...e.state.gates].sort((a, b) => a.z - b.z)
      road.forEach((g, k) => {
        const front = road[k - 1]
        if (!front) return
        expect(g.z - front.z).toBeCloseTo(g.kind === 'article' ? (4 / 3) * SPACING : SPACING, 9)
        if (g.kind === 'article') checked++
      })
      // Placed as a gate of the usual spacing would be, an article gate waits beyond the haze for its run-up's extra third.
      for (const g of road) expect(g.z - (g.kind === 'article' ? SPACING / 3 : 0)).toBeLessThanOrEqual(FAR + 1e-9)
      const g = e.activeGate()
      if (g) e.state.lane = g.correct
      e.step(1 / 30)
    }
    expect(checked).toBeGreaterThan(50)
    expect(e.state.photos).toBeGreaterThan(40)
  }, 30_000)
})

describe('the brick wall', () => {
  it('Casey in the wall\'s lane when an article gate arrives: a wrong answer, a slip like a wrong article, shown on the wall', () => {
    const sink = createMemoryRunResultsSink()
    const misses: RunMiss[] = []
    const e = createRunEngine({ cityIndex: 0, pool: danishPool, articleLanes: danishLanes, sink: { ...sink, miss: (m) => (misses.push(m), sink.miss(m)) }, rng: mulberry32(3) })
    let wallGate: RunGate | null = null
    e.start()
    // Right at every meaning, into the wall at every article gate.
    drive(e, (g) => {
      if (g.kind !== 'article') return g.correct
      wallGate ??= g
      return g.wall
    })
    expect(e.state.phase).toBe('over')
    expect(e.state.endReason).toBe('second-wrong')
    expect(misses).toHaveLength(2)
    for (const m of misses) expect(m).toMatchObject({ kind: 'article', pickedId: 'wall' })
    expect(misses.map((m) => m.ended)).toEqual([false, true])
    // The second article gate (gate 14) ended it: the twelve meaning gates before it were photos.
    expect(e.state.photos).toBe(12)
    expect(e.state.answered).toBe(14)
    expect(e.state.lastMiss).toMatchObject({ asked: 'article' })
    expect(e.state.lastMiss!.picked.id).toBe('article:wall')
    // Drawn as a wrong lane: the painter outlines the wall in red (draw.ts).
    expect(wallGate!.wrongLane).toBe(wallGate!.wall)
  })

  it('the wall lane can be steered through like any lane: left to right crosses it', () => {
    const e = createRunEngine({ cityIndex: 0, pool: danishPool, articleLanes: danishLanes, sink: createMemoryRunResultsSink(), rng: mulberry32(4) })
    e.start()
    expect(e.state.lane).toBe(1)
    e.steer(-1)
    expect(e.state.lane).toBe(0)
    e.steer(1)
    e.steer(1)
    expect(e.state.lane).toBe(2)
  })
})

describe('the German walk', () => {
  it('its article gates have der, die and das across the three lanes, each always in its own lane, no wall', () => {
    const pool = boardRunWords(GERMAN.words)
    const e = createRunEngine({ cityIndex: 0, pool, articleLanes: germanLanes, sink: createMemoryRunResultsSink(), rng: mulberry32(2) })
    const lanesOf = new Map<string, number>()
    const gates = gatesOf(e, 210)
    for (const g of gates.filter((x) => x.kind === 'article')) {
      expect(g.options.map((o) => o.target)).toEqual(['der', 'die', 'das'])
      expect(g.wall).toBe(-1)
      lanesOf.set(g.word.article!, g.correct)
    }
    expect(Object.fromEntries(lanesOf)).toEqual({ der: 0, die: 1, das: 2 })
    expect(gates.filter((x) => x.kind === 'article')).toHaveLength(30)
  })
})

describe('no article gates', () => {
  it('without article lanes (a course without articles, the first session\'s walk): every gate asks a meaning', () => {
    const e = createRunEngine({ cityIndex: 0, pool: danishPool, sink: createMemoryRunResultsSink(), rng: mulberry32(5) })
    expect(e.articles).toEqual([])
    expect(gatesOf(e, 80).every((g) => g.kind === 'meaning')).toBe(true)
  })

  it('never on the train run, even when it is handed the lanes', () => {
    const e = createRunEngine({ walk: 'train', cityIndex: 0, pool: danishPool, articleLanes: danishLanes, sink: createMemoryRunResultsSink(), rng: mulberry32(6), trainLimit: 60 })
    expect(e.articles).toEqual([])
    expect(e.articleNouns).toEqual([])
    const gates = gatesOf(e, 60)
    expect(gates.length).toBeGreaterThan(30)
    expect(gates.every((g) => g.kind === 'meaning' && g.wall === -1)).toBe(true)
  })

  it('not when the course has too few nouns to fill the road with them', () => {
    const few = danishPool.filter((w) => !w.article).concat(danishPool.filter((w) => w.article).slice(0, ROAD_GATES))
    const e = createRunEngine({ cityIndex: 0, pool: few, articleLanes: danishLanes, sink: createMemoryRunResultsSink(), rng: mulberry32(7) })
    expect(e.articles).toEqual([])
    expect(gatesOf(e, 40).every((g) => g.kind === 'meaning')).toBe(true)
  })
})

describe('the missed tally', () => {
  function runOf(seed: number, right: (n: number) => boolean): { result: RunResult; misses: RunMiss[] } {
    const sink = createMemoryRunResultsSink()
    const misses: RunMiss[] = []
    const engine = createRunEngine({
      cityIndex: 0,
      pool: danishPool,
      articleLanes: danishLanes,
      sink: { photo: sink.photo, miss: (m) => (misses.push(m), sink.miss(m)), end: sink.end },
      rng: mulberry32(seed),
    })
    engine.start()
    let n = 0
    // A wrong article is the other article; a wrong meaning the next lane over.
    drive(engine, (g) => (right(n++) ? g.correct : g.kind === 'article' ? 2 - g.correct : (g.correct + 1) % LANES))
    return { result: sink.results[0], misses }
  }

  it('counts a missed article as an article and a missed meaning as a meaning, in the same walk', () => {
    // Wrong at the first article gate (gate 7) and at the meaning gate after it (gate 8).
    const { result, misses } = runOf(21, (n) => n !== 6 && n !== 7)
    expect(result.walk).toBe('words')
    expect(misses).toHaveLength(2)
    expect(misses[0].kind).toBe('article')
    expect(['en', 'et']).toContain(misses[0].pickedId)
    expect(misses[1].kind).toBe('meaning')
    expect(misses[1].pickedId).not.toBe(misses[1].wordId)
    expect(result.words.filter((w) => w.kind === 'article')).toHaveLength(1)
    expect(result.words.filter((w) => w.kind === 'meaning')).toHaveLength(7)
    const tally = tallyMisses(misses)
    expect([...tally.article.values()]).toEqual([1])
    expect([...tally.meaning.values()]).toEqual([1])
  })

  it('keeps one noun missed both ways apart: one of each, never two of either', () => {
    const tally = tallyMisses([
      { kind: 'article', wordId: 'da:hus' },
      { kind: 'meaning', wordId: 'da:hus' },
      { kind: 'article', wordId: 'da:hus' },
    ])
    expect(tally.article.get('da:hus')).toBe(2)
    expect(tally.meaning.get('da:hus')).toBe(1)
  })

  it('feeds remembered misses back by kind: a missed article brings a noun back at article gates only', () => {
    const target = danishPool.find((w) => w.article === 'et')!
    const asked: { id: string; kind: string }[] = []
    const kinds = new Set<string>()
    const engine = createRunEngine({
      cityIndex: 0,
      pool: danishPool,
      articleLanes: danishLanes,
      sink: createMemoryRunResultsSink(),
      rng: mulberry32(23),
      missesBefore: (w: RunWord, kind) => {
        kinds.add(kind)
        return w.id === target.id && kind === 'article' ? 5 : 0
      },
      onGateSpawned: (g) => asked.push({ id: g.word.id, kind: g.kind }),
    })
    engine.start()
    drive(engine, (g) => g.correct, 400)
    expect(kinds).toEqual(new Set(['article', 'meaning']))
    const articleAsks = asked.filter((a) => a.kind === 'article')
    const mine = articleAsks.filter((a) => a.id === target.id).length
    expect(mine / (articleAsks.length / engine.articleNouns.length)).toBeGreaterThan(5)
  })
})

describe('the run the screen opens', () => {
  it('is the walk until the train run is chosen', () => {
    expect(chosenWalk()).toBe('words')
    chooseWalk('train')
    expect(chosenWalk()).toBe('train')
    chooseWalk('words')
    expect(chosenWalk()).toBe('words')
  })
})
