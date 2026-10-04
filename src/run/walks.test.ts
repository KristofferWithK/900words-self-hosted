import { describe, expect, it } from 'vitest'
import type { WordEntry } from '../data/types'
import { LANGUAGES } from '../lang'
import { createRunEngine } from './engine'
import { createMemoryRunResultsSink, tallyMisses, type RunMiss, type RunResult } from './results'
import { articleWords, runWordsForCity, walkPool } from './sources'
import { articleLanes, chooseWalk, chosenWalk, laneOfArticle, walksForCourse } from './walks'
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

/** Drive a run: `answer(correct)` says which lane to be in when each gate arrives. */
function drive(engine: ReturnType<typeof createRunEngine>, answer: (correct: number) => number, maxSeconds = 600): void {
  const decided = new Map<number, number>()
  for (let t = 0; t < maxSeconds * 30 && engine.state.phase === 'play'; t++) {
    const g = engine.activeGate()
    if (g && g.z < 0.2) {
      if (!decided.has(g.id)) decided.set(g.id, answer(g.correct))
      engine.state.lane = decided.get(g.id)!
    }
    engine.step(1 / 30)
  }
}

describe('the walks a course offers', () => {
  it('are Words and Articles for Danish and German', () => {
    expect(walksForCourse(DANISH)).toEqual(['words', 'articles'])
    expect(walksForCourse(GERMAN)).toEqual(['words', 'articles'])
  })

  it('are Words alone for a course whose nouns have no article', () => {
    const course = {
      words: [noun(undefined, 'a'), noun(undefined, 'b'), { pos: 'verb' as const }],
      grammar: { genders: { a: {}, b: {} } },
    }
    expect(articleLanes(course)).toEqual([])
    expect(walksForCourse(course)).toEqual(['words'])
  })

  it('are Words alone for a course with one article only: nothing to choose between', () => {
    const course = { words: [noun('a', 'x'), noun('a', 'x')], grammar: { genders: { x: {} } } }
    expect(articleLanes(course)).toEqual(['a'])
    expect(walksForCourse(course)).toEqual(['words'])
  })
})

describe('the Articles walk lanes', () => {
  it('come from the course data: en left and et right in Danish; der, die, das in German', () => {
    expect(articleLanes(DANISH)).toEqual(['en', 'et'])
    expect(articleLanes(GERMAN)).toEqual(['der', 'die', 'das'])
  })

  it('follow the gender table, not the order the nouns come in', () => {
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
    expect(articleWords([word], ['en', 'et'])).toEqual([])
  })

  it('map an article to its own lane and nothing else to any lane', () => {
    expect(laneOfArticle(['en', 'et'], 'en')).toBe(0)
    expect(laneOfArticle(['en', 'et'], 'et')).toBe(1)
    expect(laneOfArticle(['der', 'die', 'das'], 'das')).toBe(2)
    expect(laneOfArticle(['en', 'et'], 'der')).toBe(-1)
    expect(laneOfArticle(['en', 'et'], undefined)).toBe(-1)
  })
})

describe('the Articles walk, Danish', () => {
  const lanes = articleLanes(DANISH)
  const pool = walkPool('articles', 0, lanes)

  it('asks only City 1 nouns with an article, never a connecting word', () => {
    expect(pool.length).toBeGreaterThan(20)
    expect(pool.every((w) => w.origin === 'board' && (w.article === 'en' || w.article === 'et'))).toBe(true)
    const nouns = runWordsForCity(0).filter((w) => w.article)
    expect(pool).toEqual(nouns)
  })

  it('has two lanes, en always left and et always right, the noun on the tag', () => {
    const engine = createRunEngine({ walk: 'articles', lanes, cityIndex: 0, pool, sink: createMemoryRunResultsSink(), rng: mulberry32(1) })
    engine.start()
    expect(engine.state.lanes).toBe(2)
    expect(engine.state.lane).toBe(0)
    const seen = new Set<number>()
    for (let i = 0; i < 30 * 400 && seen.size < 200; i++) {
      const g = engine.activeGate()
      if (g) engine.state.lane = g.correct
      engine.step(1 / 30)
      for (const gate of engine.state.gates) {
        if (seen.has(gate.id)) continue
        seen.add(gate.id)
        expect(gate.kind).toBe('article')
        expect(gate.options.map((o) => o.target)).toEqual(['en', 'et'])
        expect(gate.correct).toBe(gate.word.article === 'et' ? 1 : 0)
        expect(gate.prompt).toBe(gate.word.target)
      }
    }
    expect(seen.size).toBe(200)
    engine.steer(1)
    engine.steer(1)
    expect(engine.state.lane).toBe(1)
  })
})

describe('the Articles walk, German', () => {
  const lanes = articleLanes(GERMAN)
  const pool = boardRunWords(GERMAN.words).filter((w) => w.article)

  it('has three lanes, der, die and das, each article always in its own lane', () => {
    expect(pool.length).toBe(GERMAN.words.filter((w) => w.pos === 'noun').length)
    const engine = createRunEngine({ walk: 'articles', lanes, cityIndex: 0, pool, sink: createMemoryRunResultsSink(), rng: mulberry32(2) })
    engine.start()
    expect(engine.state.lanes).toBe(3)
    expect(engine.state.lane).toBe(1)
    const lanesOf = new Map<string, number>()
    for (let i = 0; i < 30 * 300; i++) {
      const g = engine.activeGate()
      if (g) engine.state.lane = g.correct
      engine.step(1 / 30)
      for (const gate of engine.state.gates) {
        expect(gate.options.map((o) => o.target)).toEqual(['der', 'die', 'das'])
        lanesOf.set(gate.word.article!, gate.correct)
      }
    }
    expect(Object.fromEntries(lanesOf)).toEqual({ der: 0, die: 1, das: 2 })
  })
})

describe('the missed tally', () => {
  const lanes = articleLanes(DANISH)

  function runOf(walk: 'words' | 'articles', seed: number): { result: RunResult; misses: RunMiss[] } {
    const sink = createMemoryRunResultsSink()
    const misses: RunMiss[] = []
    const engine = createRunEngine({
      walk,
      lanes,
      cityIndex: 0,
      pool: walkPool(walk, 0, lanes),
      sink: { photo: sink.photo, miss: (m) => (misses.push(m), sink.miss(m)), end: sink.end },
      rng: mulberry32(seed),
    })
    engine.start()
    let n = 0
    // Right, wrong, right, wrong: the run ends on the second wrong answer.
    const plan = [true, false, true, false]
    const count = engine.state.lanes
    drive(engine, (correct) => (plan[n++] ? correct : (correct + 1) % count))
    return { result: sink.results[0], misses }
  }

  it('counts a missed article as an article and a missed meaning as a meaning', () => {
    const articles = runOf('articles', 21)
    expect(articles.result.walk).toBe('articles')
    expect(articles.misses).toHaveLength(2)
    expect(articles.misses.every((m) => m.kind === 'article' && (m.pickedId === 'en' || m.pickedId === 'et'))).toBe(true)
    expect(articles.result.words.every((w) => w.kind === 'article')).toBe(true)

    const words = runOf('words', 22)
    expect(words.misses).toHaveLength(2)
    expect(words.misses.every((m) => m.kind === 'meaning' && m.pickedId !== m.wordId)).toBe(true)
    expect(words.result.words.every((w) => w.kind === 'meaning')).toBe(true)

    const tally = tallyMisses([...articles.misses, ...words.misses])
    expect([...tally.article.values()].reduce((a, b) => a + b, 0)).toBe(2)
    expect([...tally.meaning.values()].reduce((a, b) => a + b, 0)).toBe(2)
    for (const m of articles.misses) expect(tally.article.get(m.wordId)).toBeGreaterThan(0)
  })

  it('keeps one noun missed in both walks apart: one of each, never two of either', () => {
    const tally = tallyMisses([
      { kind: 'article', wordId: 'da:hus' },
      { kind: 'meaning', wordId: 'da:hus' },
      { kind: 'article', wordId: 'da:hus' },
    ])
    expect(tally.article.get('da:hus')).toBe(2)
    expect(tally.meaning.get('da:hus')).toBe(1)
  })

  it('feeds remembered misses back by kind: a missed article brings a noun back in the Articles walk only', () => {
    const pool = walkPool('articles', 0, lanes)
    const target = pool[0]
    const asked: string[] = []
    const kinds = new Set<string>()
    const engine = createRunEngine({
      walk: 'articles',
      lanes,
      cityIndex: 0,
      pool,
      sink: createMemoryRunResultsSink(),
      rng: mulberry32(23),
      missesBefore: (w: RunWord, kind) => {
        kinds.add(kind)
        return w.id === target.id && kind === 'article' ? 5 : 0
      },
      onGateSpawned: (g) => asked.push(g.word.id),
    })
    engine.start()
    drive(engine, (c) => c, 300)
    expect(kinds).toEqual(new Set(['article']))
    const mine = asked.filter((id) => id === target.id).length
    expect(mine / (asked.length / pool.length)).toBeGreaterThan(5)
  })
})

describe('the walk the screen opens', () => {
  it('is Words until another is chosen', () => {
    expect(chosenWalk()).toBe('words')
    chooseWalk('articles')
    expect(chosenWalk()).toBe('articles')
    chooseWalk('words')
  })
})
