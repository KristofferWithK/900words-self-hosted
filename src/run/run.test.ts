import { describe, expect, it } from 'vitest'
import { WORDS } from '../data/words'
import type { WordEntry } from '../data/types'
import connectingList from '../data/city1-connecting-words.da.json'
import { CATALOGUES, UI_LANGUAGE_INFO } from '../i18n'
import { COMPLETE, withPlayerLanguage } from '../i18n/glosses'
import type { UiLanguage } from '../i18n/types'
import { wordsForCity } from '../journey/progress'
import { LANGUAGES } from '../lang'
import { askableWords, canOfferAgainst, pickWrongAnswers, wrongAnswersFor } from './distractors'
import { createRunEngine, SPACING, type RunEngine } from './engine'
import { createMemoryRunResultsSink, type RunResult } from './results'
import { boardWordSource, connectingMeaningLanguage, connectingWordsFor, runWordsForCity } from './sources'
import { GATE_TIERS, secondsPerGate, tierOf } from './tiers'
import { boardRunWords, cityRunWords, connectingWordId, meaningKeys, type RunWord, type RunWordSource } from './words'

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
const CANONICAL = new Map(DANISH.words.map((w) => [w.id, w]))
const CITY1_IDS = wordsForCity(WORDS, 0).map((w) => w.id)
/** Sønderborg's connecting words, counted from their file (more are coming). */
const CONNECTING = connectingList.words
const CONNECTING_BY_ID = new Map(CONNECTING.map((row) => [connectingWordId('da', row), row]))
/** The languages a connecting word's meaning is written in: English and every complete gloss overlay. */
type MeaningLanguage = 'en' | 'de' | 'fr' | 'pl' | 'pt' | 'sv' | 'zh'

/**
 * Meanings worked out here, independently of src/run/words.ts: every gloss of
 * the word in the canonical English and in the player's language, lower case,
 * with a leading "to " and any bracketed note dropped. A wrong answer must
 * share none of them with the word asked.
 */
function independentMeanings(entry: WordEntry, canonical: WordEntry): Set<string> {
  const out = new Set<string>()
  for (const g of [...entry.en, ...canonical.en]) {
    const base = g.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
    out.add(base)
    out.add(base.replace(/^(to|a|an|the) /, ''))
  }
  return out
}

/**
 * The same for a connecting word, from its file: the meaning in the language
 * its tag is written in, and the English, every key and the shown form.
 */
function independentConnectingMeanings(id: string, lang: UiLanguage): Set<string> {
  const row = CONNECTING_BY_ID.get(id)!
  const tagLang = connectingMeaningLanguage(lang) as MeaningLanguage
  const out = new Set<string>()
  for (const g of [row.en.shown, ...row.en.keys, row[tagLang].shown, ...row[tagLang].keys]) {
    const base = g.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
    out.add(base)
    out.add(base.replace(/^(to|a|an|the) /, ''))
  }
  return out
}

function city1Pool(lang: UiLanguage): { pool: RunWord[]; meanings: (w: RunWord) => Set<string> } {
  const overlay = withPlayerLanguage(DANISH, lang)
  const byId = new Map(overlay.words.map((w) => [w.id, w]))
  const entries = CITY1_IDS.map((id) => byId.get(id)!)
  const board = boardRunWords(entries, (id) => CANONICAL.get(id), {
    playerArticles: UI_LANGUAGE_INFO[lang].glossArticles,
    verbPrompt: CATALOGUES[lang].sightseeing.verbPrompt,
  })
  const pool = [...board, ...connectingWordsFor('da', 0, lang)]
  const meanings = (w: RunWord) =>
    w.origin === 'connecting' ? independentConnectingMeanings(w.id, lang) : independentMeanings(byId.get(w.id)!, CANONICAL.get(w.id)!)
  return { pool, meanings }
}

const ALL_UI = Object.keys(CATALOGUES) as UiLanguage[]

describe('the speeds (contract §2)', () => {
  it('are 3.2 s per gate from the start, 2.6 from word 8, 2.1 from word 18, 1.75 from word 28 and top', () => {
    expect(GATE_TIERS.map((t) => [t.from, t.seconds])).toEqual([
      [0, 3.2],
      [8, 2.6],
      [18, 2.1],
      [28, 1.75],
    ])
    expect(secondsPerGate(0)).toBe(3.2)
    expect(secondsPerGate(7)).toBe(3.2)
    expect(secondsPerGate(8)).toBe(2.6)
    expect(secondsPerGate(17)).toBe(2.6)
    expect(secondsPerGate(18)).toBe(2.1)
    expect(secondsPerGate(27)).toBe(2.1)
    expect(secondsPerGate(28)).toBe(1.75)
    expect(secondsPerGate(500)).toBe(1.75)
    expect(tierOf(1000)).toBe(GATE_TIERS.length - 1)
  })
})

describe('the City 1 pool', () => {
  it('is the hundred Sønderborg board words and then the connecting words, every one of them askable', () => {
    const pool = runWordsForCity(0)
    expect(pool).toHaveLength(100 + CONNECTING.length)
    expect(pool.slice(0, 100).map((w) => w.id)).toEqual(CITY1_IDS)
    expect(pool.slice(0, 100).every((w) => w.origin === 'board' && w.audio?.kind === 'dataset')).toBe(true)
    const connecting = pool.slice(100)
    expect(connecting.map((w) => w.target)).toEqual(CONNECTING.map((row) => row.da))
    expect(connecting.every((w) => w.origin === 'connecting' && w.audio?.kind === 'clip')).toBe(true)
    expect(connecting.map((w) => w.prompt)).toEqual(CONNECTING.map((row) => row.en.shown))
    expect(new Set(pool.map((w) => w.id)).size).toBe(pool.length)
    expect(askableWords(pool)).toHaveLength(pool.length)
  })

  it('takes every connecting word in every UI language, its tag in the board tags\' language', () => {
    for (const lang of ALL_UI) {
      const words = connectingWordsFor('da', 0, lang)
      const tagLang = connectingMeaningLanguage(lang) as MeaningLanguage
      expect(words, lang).toHaveLength(47)
      expect(words.map((w) => w.prompt), lang).toEqual(CONNECTING.map((row) => row[tagLang].shown))
      // A complete gloss overlay writes the board tags, and so the connecting tags, in the player's own language.
      expect(tagLang, lang).toBe(lang === 'en' || !COMPLETE[lang] ? 'en' : lang)
    }
    // Never for another course or another city.
    expect(connectingWordsFor('de', 0, 'en')).toEqual([])
    expect(connectingWordsFor('da', 1, 'en')).toEqual([])
  })

  it('never offers a connecting word against a board word, or a board word against a connecting one', () => {
    const pool = runWordsForCity(0)
    for (const asked of pool) {
      for (const other of wrongAnswersFor(asked, pool)) expect(other.origin, `${asked.target} / ${other.target}`).toBe(asked.origin)
    }
  })

  describe.each(ALL_UI)('in %s', (lang) => {
    const { pool, meanings } = city1Pool(lang)

    it('never offers a word against another correct answer (every pair of the whole pool)', () => {
      const bad: string[] = []
      let offered = 0
      for (const asked of pool) {
        const askedMeanings = meanings(asked)
        for (const other of pool) {
          if (!canOfferAgainst(asked, other)) continue
          offered++
          const otherMeanings = meanings(other)
          const shared = [...askedMeanings].filter((m) => otherMeanings.has(m))
          if (shared.length) bad.push(`${asked.target} / ${other.target}: ${shared.join(', ')}`)
          if (other.group !== asked.group) bad.push(`${asked.target} / ${other.target}: different kind`)
          if (other.target.toLowerCase() === asked.target.toLowerCase()) bad.push(`${asked.target}: same spelling`)
          // The prompt on the tag must not be any meaning of a wrong answer.
          if (otherMeanings.has(asked.prompt.toLowerCase().replace(/^(to|att|å) /, ''))) bad.push(`${asked.prompt} names ${other.target}`)
        }
      }
      expect(bad).toEqual([])
      expect(offered).toBeGreaterThan(1000)
    })

    it('can ask every word with two wrong answers of its own kind', () => {
      const short = pool.filter((w) => wrongAnswersFor(w, pool).length < 2).map((w) => w.target)
      expect(short).toEqual([])
    })

    it('has all 147 words, the 47 connecting words among them, and the train run asks every one', () => {
      expect(pool).toHaveLength(147)
      expect(pool.filter((w) => w.origin === 'connecting')).toHaveLength(47)
      expect(askableWords(pool)).toHaveLength(147)
      const sink = createMemoryRunResultsSink()
      const asked: string[] = []
      const engine = createRunEngine({
        walk: 'train',
        cityIndex: 0,
        pool,
        sink,
        rng: mulberry32(19),
        onGateSpawned: (g) => asked.push(g.word.id),
      })
      expect(engine.asked).toHaveLength(147)
      engine.start()
      expect(engine.state.total).toBe(147)
      drive(engine, (correct) => correct, 900)
      expect(engine.state.endReason).toBe('caught')
      expect(asked).toHaveLength(147)
      expect(new Set(asked)).toEqual(new Set(pool.map((w) => w.id)))
      expect(sink.results[0]).toMatchObject({ walk: 'train', end: 'caught', answered: 147, total: 147 })
    })
  })

  it.each(ALL_UI)('never puts a second correct answer on a gate across thousands of gates (%s)', (lang) => {
    const { pool, meanings } = city1Pool(lang)
    expect(pool.some((w) => w.origin === 'connecting')).toBe(true)
    const sink = createMemoryRunResultsSink()
    const engine = createRunEngine({ cityIndex: 0, pool, sink, rng: mulberry32(7) })
    engine.start()
    const seen = new Set<number>()
    const bad: string[] = []
    // Steer into the right suitcase every time, so the run never ends.
    for (let i = 0; i < 200000 && seen.size < 3000; i++) {
      const g = engine.activeGate()
      if (g) engine.state.lane = g.correct
      engine.step(1 / 20)
      for (const gate of engine.state.gates) {
        if (seen.has(gate.id)) continue
        seen.add(gate.id)
        expect(gate.options).toHaveLength(3)
        expect(gate.options[gate.correct]).toBe(gate.word)
        const askedMeanings = meanings(gate.word)
        for (const [i2, o] of gate.options.entries()) {
          if (i2 === gate.correct) continue
          const m = meanings(o)
          if ([...askedMeanings].some((x) => m.has(x))) bad.push(`${gate.word.target} with ${o.target}`)
          if (o.group !== gate.word.group) bad.push(`${gate.word.target} with ${o.target}: kind`)
        }
        if (new Set(gate.options.map((o) => o.target)).size !== 3) bad.push(`${gate.word.target}: repeated suitcase`)
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(3000)
    expect(bad).toEqual([])
    expect(engine.state.phase).toBe('play')
  })
})

describe('meaning keys', () => {
  it('drop a leading "to" and bracketed notes, so "to eat" and "eat (food)" match', () => {
    expect(meaningKeys(['to eat'])).toContain('eat')
    expect(meaningKeys(['eat (food)'])).toContain('eat')
    expect(meaningKeys(['der Apfel'], /^(der|die|das) /)).toContain('apfel')
  })
})

describe('word sources', () => {
  it('take a second list without the run changing, and keep a word once', () => {
    const board = boardWordSource.words(0)
    const second: RunWordSource = {
      origin: 'connecting',
      words: () => [
        { id: 'c:hej', origin: 'connecting', target: 'hej', prompt: 'hi', group: 'greeting', keys: ['hi', 'hello'], audio: null },
        { ...board[0] },
      ],
    }
    const all = cityRunWords([{ origin: 'board', words: () => board }, second], 0)
    expect(all).toHaveLength(board.length + 1)
    expect(all.filter((w) => w.id === board[0].id)).toHaveLength(1)
  })
})

/** Drive a run: `answer(gate)` says which lane to be in when the gate arrives. */
function drive(engine: RunEngine, answer: (correct: number) => number, maxSeconds = 600): void {
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

describe('the run', () => {
  const pool = runWordsForCity(0)

  it('forgives one wrong word and ends on the second, reporting through the one sink', () => {
    const sink = createMemoryRunResultsSink()
    const ended: RunResult[] = []
    const spoken: string[] = []
    const engine = createRunEngine({
      cityIndex: 0,
      pool,
      sink,
      rng: mulberry32(3),
      now: () => 1000,
      events: { photo: (w) => spoken.push(w.id), end: (r) => ended.push(r) },
    })
    engine.start()
    let n = 0
    // Right, right, wrong, right, wrong: the run ends on the second wrong word.
    const plan = [true, true, false, true, false, true, true]
    drive(engine, (correct) => (plan[n++] ? correct : (correct + 1) % 3))
    expect(engine.state.phase).toBe('over')
    expect(engine.state.slips).toBe(2)
    expect(ended).toHaveLength(1)
    const r = sink.results[0]
    expect(r).toBe(ended[0])
    expect(r.end).toBe('second-wrong')
    expect(r.photos).toBe(3)
    expect(r.answered).toBe(5)
    expect(r.misses).toHaveLength(2)
    expect(r.misses[0].ended).toBe(false)
    expect(r.misses[1].ended).toBe(true)
    expect(r.words.reduce((a, w) => a + w.photos, 0)).toBe(3)
    expect(r.words.reduce((a, w) => a + w.misses, 0)).toBe(2)
    expect(spoken).toHaveLength(3)
    // The stub keeps the run and drops its events once it has ended.
    expect(sink.photos).toHaveLength(0)
  })

  it('reveals only the next gate; later gates stay scribbled over', () => {
    const engine = createRunEngine({ cityIndex: 0, pool, sink: createMemoryRunResultsSink(), rng: mulberry32(5) })
    engine.start()
    expect(engine.state.gates.length).toBeGreaterThanOrEqual(2)
    for (let i = 0; i < 20; i++) engine.step(1 / 30)
    const [first, ...later] = engine.state.gates
    expect(first.reveal).toBe(1)
    expect(later.every((g) => g.reveal === 0)).toBe(true)
  })

  it('reaches each speed at its word and never goes past 1.75 s per gate', () => {
    const engine = createRunEngine({ cityIndex: 0, pool, sink: createMemoryRunResultsSink(), rng: mulberry32(9) })
    engine.start()
    const tierAt = new Map<number, number>()
    for (let t = 0; t < 30 * 200 && engine.state.photos < 40; t++) {
      const g = engine.activeGate()
      if (g) engine.state.lane = g.correct
      engine.step(1 / 30)
      if (!tierAt.has(engine.state.photos)) tierAt.set(engine.state.photos, engine.state.tier)
    }
    expect(tierAt.get(7)).toBe(0)
    expect(tierAt.get(8)).toBe(1)
    expect(tierAt.get(18)).toBe(2)
    expect(tierAt.get(28)).toBe(3)
    expect(tierAt.get(40)).toBe(3)
    // Eased in, it settles on the top speed: SPACING per 1.75 s.
    expect(engine.state.speed).toBeCloseTo(SPACING / 1.75, 2)
  })

  it('reports a run left part-way, once, and nothing for a run never started', () => {
    const sink = createMemoryRunResultsSink()
    const engine = createRunEngine({ cityIndex: 0, pool, sink, rng: mulberry32(11) })
    engine.leave()
    expect(sink.results).toHaveLength(0)
    engine.start()
    drive(engine, (c) => c, 8)
    engine.leave()
    engine.leave()
    expect(sink.results).toHaveLength(1)
    expect(sink.results[0].end).toBe('left')
    expect(sink.results[0].answered).toBeGreaterThan(0)
  })

  it('brings a missed word back more often', () => {
    const asked = pool[0]
    const spawned = new Map<string, number>()
    const engine = createRunEngine({
      cityIndex: 0,
      pool,
      sink: createMemoryRunResultsSink(),
      rng: mulberry32(13),
      missesBefore: (w) => (w.id === asked.id ? 3 : 0),
      onGateSpawned: (g) => spawned.set(g.word.id, (spawned.get(g.word.id) ?? 0) + 1),
    })
    engine.start()
    for (let t = 0; t < 30 * 3000; t++) {
      const g = engine.activeGate()
      if (g) engine.state.lane = g.correct
      engine.step(1 / 30)
    }
    const total = [...spawned.values()].reduce((a, b) => a + b, 0)
    const others = (total - (spawned.get(asked.id) ?? 0)) / (pool.length - 1)
    // Weight 1 + 4 x 3 = 13 against 1 for every other word.
    expect((spawned.get(asked.id) ?? 0) / others).toBeGreaterThan(5)
  })

  it('picks wrong answers that are all different', () => {
    const rng = mulberry32(17)
    for (const w of pool) {
      const picked = pickWrongAnswers(w, pool, rng)
      expect(picked).toHaveLength(2)
      expect(new Set(picked.map((p) => p.target)).size).toBe(2)
    }
  })
})
