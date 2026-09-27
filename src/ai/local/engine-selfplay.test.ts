import { describe, expect, it } from 'vitest'
import { BOARD, distinctGreens } from '../../engine/config'
import {
  applyEvent as applyEventIn,
  createGame,
  currentClue,
  giverOf,
  isGuessable,
  remainingGreenIds,
  targetableGreenIds,
} from '../../engine/game'
import { checkClueLegality } from '../../engine/legality'
import { mulberry32 } from '../../engine/rng'
import { normalize } from '../../engine/text'
import type { BoardWord, GameState, Side } from '../../engine/types'
import { WORDS } from '../../data/words'
import matrixCity1 from '../../../proxy/data/matrix.da.1.json'
import matrixCity2 from '../../../proxy/data/matrix.da.2.json'
import matrixCity9 from '../../../proxy/data/matrix.da.9.json'
import { danish } from '../../lang/da'
// `curriculumBand`, not `wordsForCity`: the shards, tags and boards this file
// measures were authored against the curriculumRank band a city used to be,
// before City 1 became the authored roster (2026-09-11). See progress.ts.
import { curriculumBand } from '../../journey/progress'
import { planGuessExecution } from '../companion'
import { buildAiClueView, buildAiGuessView } from '../projections'
import {
  authoredCities,
  buildEvaluator,
  loadEvaluator,
  type BookEntry,
  type BookFile,
  type Evaluator,
  type MatrixFile,
} from './evaluator'
import { searchClue, THETA } from './search'
import {
  authoringPairFromMatrix,
  displayModel,
  type AuthoringPair,
} from './authoringPair'

/**
 * STAGE 4 — the measurement the whole clue engine is built to survive
 * (docs/clue-engine.md §6 "Stage 4"). `selfplay.test.ts` brackets the BOARD
 * with a know-nothing floor and a biased-coin guesser; it can say nothing
 * about a clue-giver, because it has none. This file has one.
 *
 * Every row below plays the SAME eighteen-card city-1 boards, seeded 1..N, so
 * the floor, the p-curve and the engine are read off identical deals rather
 * than compared across two harnesses on two different word sets. That is the
 * whole point of putting them in one table.
 *
 * THE CAVEAT THAT MUST NOT BE LAUNDERED. Engine-vs-engine shares ONE
 * evaluator between the seats: the guesser is confusable in exactly the ways
 * the clue-giver already priced in, so its win rate is §2's honest-evaluator
 * UPPER BOUND and not a claim about anybody's partner. E3 measured 99.0% at
 * θ=0.5 and said so; this file says it again rather than quoting the number
 * as a result. The cross-model rows below are the answer to it: the book and
 * the matrix were written twice, once by Opus and once by Fable, and the
 * votes are committed per model — so a clue-giver reading one model's
 * judgement can be examined by a guesser reading the other's, and the exam
 * does not share the product's opinion.
 */

const applyEvent = (s: GameState, e: Parameters<typeof applyEventIn>[1]) =>
  applyEventIn(s, e, danish)

/** src/ compiles with DOM libs and no node types; see selfplay.test.ts. */
const envVar = (name: string): string | undefined =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name]

/**
 * Seeded games per row.
 *
 * The seeds are 1..GAMES, so a run is reproducible but NOT independent of this
 * number — change it and every figure moves. Hence bands, never points. The
 * figures quoted in `docs/clue-engine.md` were taken at 200; every pin here was
 * checked at the default and at 200.
 *
 * Print the table with
 *
 *   ENGINE_SELFPLAY_GAMES=200 ENGINE_SELFPLAY_REPORT=1 \
 *     npx vitest run --reporter=verbose src/ai/local/engine-selfplay.test.ts
 *
 * and note the `--reporter=verbose`: vitest 4's default reporter swallows a
 * PASSING test's console output, so without it the report prints only when
 * something has already gone wrong. That cost this session ten minutes.
 */
const GAMES = Number(envVar('ENGINE_SELFPLAY_GAMES') ?? 40)

// ---------------------------------------------------------------------------
// The two authoring halves, rebuilt from the committed votes.
//
// `src/data/generated/matrix-city1/<model>-NN.json` and
// `src/data/generated/book-city1/<model>-{words,pairs}-NN.json` are the raw
// record of who said what; `merge-matrix.mjs` and `merge-book.mjs` are the only
// things that turn them into the shipped pair. Rebuilding the halves HERE, from
// the same files, costs the repo no duplicated data and keeps the split honest:
// nothing below reads the merged artifact except its `ids`, which is an
// ordering rather than a judgement.
//
// Two deliberate simplifications against the shipped merge, both immaterial to
// sim: entries illegal against their own headword are left in (the search
// re-checks legality against the real board anyway, and there were 31 of them
// in 5,800), and the `why` word-band is not enforced (a `why` is read aloud,
// never scored).
// ---------------------------------------------------------------------------

interface MatrixVote {
  scores: Record<string, number>
}
interface BookVote {
  model?: string
  words?: Record<string, BookEntry[]>
  pairs?: Record<string, BookEntry[]>
}

type Model = string

const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1)
const modelOf = (path: string): Model => baseName(path).split('-')[0]!

/**
 * The raw votes, PER CITY. E6 authors one city per PR and E4 asked for the
 * cross-model reading to be re-taken on the first new one, so the halves are
 * keyed by city rather than hard-wired to city 1. `import.meta.glob` needs a
 * literal pattern, so a new city adds its shipped matrix and two raw-data
 * globs here. The matrix metadata, not this map, decides which two models run.
 */
const VOTES: Record<
  number,
  { shippedMatrix: MatrixFile; matrix: Record<string, MatrixVote>; book: Record<string, BookVote> }
> =
  {
    1: {
      shippedMatrix: matrixCity1 as unknown as MatrixFile,
      matrix: import.meta.glob<MatrixVote>('../../data/generated/matrix-city1/*.json', {
        eager: true,
        import: 'default',
      }),
      book: import.meta.glob<BookVote>('../../data/generated/book-city1/*.json', {
        eager: true,
        import: 'default',
      }),
    },
    2: {
      shippedMatrix: matrixCity2 as unknown as MatrixFile,
      matrix: import.meta.glob<MatrixVote>('../../data/generated/matrix-city2/*.json', {
        eager: true,
        import: 'default',
      }),
      book: import.meta.glob<BookVote>('../../data/generated/book-city2/*.json', {
        eager: true,
        import: 'default',
      }),
    },
    9: {
      shippedMatrix: matrixCity9 as unknown as MatrixFile,
      matrix: import.meta.glob<MatrixVote>('../../data/generated/matrix-city9/*.json', {
        eager: true,
        import: 'default',
      }),
      book: import.meta.glob<BookVote>('../../data/generated/book-city9/*.json', {
        eager: true,
        import: 'default',
      }),
    },
  }

/** Two bits a cell, row-major over the full square — matrix-pack.mjs's format. */
function packCells(cells: Uint8Array, n: number): string {
  const bytes = new Uint8Array(Math.ceil((n * n) / 4))
  for (let i = 0; i < n * n; i++) bytes[i >> 2]! |= (cells[i]! & 0b11) << ((i & 3) * 2)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

/**
 * One model's matrix, from its own votes alone — no merge rule, because there
 * is nothing to merge. The pair index is 1-based over i<j in `ids` order, which
 * is what `cityPairs()` defines and what every vote file is keyed by; `ids`
 * comes from the shipped matrix because that IS the canonical order.
 */
function halfMatrix(model: Model, ids: readonly string[], city: number): MatrixFile {
  const n = ids.length
  const scores = new Map<number, number>()
  for (const [path, vote] of Object.entries(VOTES[city]!.matrix)) {
    if (modelOf(path) !== model) continue
    for (const [k, v] of Object.entries(vote.scores ?? {})) scores.set(Number(k), v)
  }
  const cells = new Uint8Array(n * n)
  for (let i = 0; i < n; i++) cells[i * n + i] = 3 // the diagonal merge-matrix.mjs writes
  let k = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      k++
      const v = scores.get(k) ?? 0
      cells[i * n + j] = v
      cells[j * n + i] = v
    }
  }
  expect(scores.size).toBe(k) // every pair judged, or the half is not a half
  return { lang: 'da', city, n, bits: 2, ids: [...ids], data: packCells(cells, n) }
}

const ASSOC_CAP = 35
const PAIR_CAP = 6

/** One model's book, from its own files alone. Union is not needed: it is one voice. */
function halfBook(
  model: Model,
  ids: readonly string[],
  city: number,
): { book: BookFile; malformed: number } {
  let malformed = 0
  const shaped = (e: BookEntry): boolean => {
    const ok =
      typeof e?.da === 'string' &&
      typeof e?.en === 'string' &&
      typeof e?.why === 'string' &&
      Number.isInteger(e?.s) &&
      e.s >= 1 &&
      e.s <= 3 &&
      e.da.trim().length > 0
    if (!ok) malformed++
    return ok
  }
  const dedupe = (list: BookEntry[], cap: number): BookEntry[] => {
    const best = new Map<string, BookEntry>()
    for (const e of list) {
      if (!shaped(e)) continue
      const k = normalize(e.da)
      const prior = best.get(k)
      if (!prior || e.s > prior.s) best.set(k, { ...e, v: 1 })
    }
    return [...best.values()].sort((a, b) => b.s - a.s || a.da.localeCompare(b.da, 'da')).slice(0, cap)
  }

  const rawWords = new Map<string, BookEntry[]>()
  const rawPairs = new Map<string, BookEntry[]>()
  for (const [path, doc] of Object.entries(VOTES[city]!.book)) {
    if (modelOf(path) !== model) continue
    for (const [id, list] of Object.entries(doc.words ?? {})) {
      rawWords.set(id, [...(rawWords.get(id) ?? []), ...list])
    }
    for (const [key, list] of Object.entries(doc.pairs ?? {})) {
      rawPairs.set(key, [...(rawPairs.get(key) ?? []), ...list])
    }
  }

  const words: BookFile['words'] = {}
  for (const id of ids) words[id] = { assoc: dedupe(rawWords.get(id) ?? [], ASSOC_CAP) }
  const pairs: BookFile['pairs'] = {}
  for (const [key, list] of rawPairs) pairs[key] = dedupe(list, PAIR_CAP)
  return { book: { lang: 'da', city, words, pairs }, malformed }
}

interface AuthoringHalves {
  models: AuthoringPair
  first: Evaluator
  second: Evaluator
}

const halvesCache = new Map<number, AuthoringHalves>()
async function loadHalves(city = 1): Promise<AuthoringHalves> {
  const hit = halvesCache.get(city)
  if (hit) return hit
  const artifacts = VOTES[city]
  if (!artifacts) {
    throw new Error(`city ${city} has no raw authoring artifacts in the self-play harness`)
  }
  const models = authoringPairFromMatrix(artifacts.shippedMatrix)
  const rawModels = new Set(
    [...Object.keys(artifacts.matrix), ...Object.keys(artifacts.book)].map(modelOf),
  )
  for (const rawModel of rawModels) {
    if (!models.includes(rawModel)) {
      throw new Error(
        `city ${city} has ${rawModel} raw artifacts, but matrix.meta.judges is ${models.join(',')}`,
      )
    }
  }
  const shipped = (await loadEvaluator(city))!
  const built = {} as Record<Model, Evaluator>
  for (const m of models) {
    const { book } = halfBook(m, shipped.ids, city)
    built[m] = buildEvaluator(halfMatrix(m, shipped.ids, city), book)
  }
  const halves = { models, first: built[models[0]]!, second: built[models[1]]! }
  halvesCache.set(city, halves)
  return halves
}

/**
 * THE MUTATION. `sim` replaced by djb2 over (salt, clue, wordId) folded onto
 * the same 0–3 scale — the MockCompanion's hash, which selfplay measured as
 * statistically indistinguishable from naming a card at random. Every other
 * moving part of the engine is untouched: the same search, the same legality,
 * the same book supplying candidates.
 *
 * THE SALT IS THE WHOLE OF THE FINDING. Two seats sharing one hash win 100% of
 * these boards — the search finds the candidate the hash happens to rank high
 * on its targets and low on the traps, and a guesser ranking by the SAME hash
 * reads it back perfectly. A shared arbitrary function is a private code, and
 * self-play over one cannot tell a code from knowledge. That is what makes
 * engine-vs-engine an upper bound and nothing else, and it is why the pins
 * below hang on the cross-model rows. Two seats holding DIFFERENT hashes have
 * no code, and collapse to the floor — which is the mutation that has to fail.
 */
function hashEvaluator(real: Evaluator, salt: string): Evaluator {
  const djb2 = (s: string): number => {
    let h = 5381
    for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i)
    return h >>> 0
  }
  const sim = (clue: string, wordId: string): number => (djb2(`${salt}|${clue}|${wordId}`) % 7) / 2
  return {
    ...real,
    sim,
    scoreClue: (clue, targets, traps) => {
      let minTarget = targets.length === 0 ? 0 : Infinity
      for (const t of targets) minTarget = Math.min(minTarget, sim(clue, t))
      let riskiest: { id: string; sim: number } | null = null
      for (const t of traps) {
        const s = sim(clue, t)
        if (!riskiest || s > riskiest.sim) riskiest = { id: t, sim: s }
      }
      return { margin: minTarget - (riskiest?.sim ?? 0), riskiest, coverage: targets.length }
    },
  }
}

// ---------------------------------------------------------------------------
// The harness
// ---------------------------------------------------------------------------

/**
 * A real board: eighteen of one city's hundred, seeded uniform.
 *
 * `city` is 1-BASED here, like the data files; `curriculumBand` is 0-based
 * (CLAUDE.md's own note, and the trap E3 hit) — hence the `- 1`.
 */
function cityBoard(seed: number, city = 1): BoardWord[] {
  const pool = curriculumBand(WORDS, city - 1)
  const rng = mulberry32(seed)
  const picked = [...pool]
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[picked[i], picked[j]] = [picked[j]!, picked[i]!]
  }
  return picked
    .slice(0, BOARD.totalWords)
    .map((w) => ({ wordId: w.id, da: w.da, en: [...w.en], pos: w.pos }))
}

const flip = (side: Side): Side => (side === 'player' ? 'ai' : 'player')

/**
 * One engine answering both seats: swap the keys, flip every reveal's
 * `against` and the history's `by`, and the player's seat becomes an ai-clue
 * view the same search can answer. The flip must be exact or the directional
 * trap rule is silently violated for the mirrored seat (`engine.test.ts`).
 */
function mirror(s: GameState): GameState {
  return {
    ...s,
    playerKey: s.aiKey,
    aiKey: s.playerKey,
    reveals: Object.fromEntries(
      Object.entries(s.reveals).map(([id, r]) => [
        id,
        r.kind === 'bystander' ? { ...r, against: r.against.map(flip) } : r,
      ]),
    ),
    clueHistory: s.clueHistory.map((c) => ({ ...c, by: flip(c.by) })),
    phase:
      s.phase === 'playerClueInput'
        ? 'aiClueInput'
        : s.phase === 'playerGuessing'
          ? 'aiGuessing'
          : s.phase,
  }
}

/** A legal clue that means nothing — the floor's and the p-curve's clue-giver. */
function nonsenseClue(state: GameState, turn: number): string {
  for (let i = 0; i < 50; i++) {
    const candidate = `klods${turn}x${i}`
    if (checkClueLegality(candidate, state.words, danish).legal) return candidate
  }
  throw new Error('could not produce a legal nonsense clue')
}

type Guesser =
  | { kind: 'engine'; ev: Evaluator }
  /** selfplay.test.ts's dial: the chance a guess finds a word the giver meant. */
  | { kind: 'coin'; p: number }

interface Row {
  label: string
  /** null = nonsense clues, the floor's and the p-curve's giver. */
  clueEv: Evaluator | null
  guesser: Guesser
  /** Override the search's bars. Only the theta sweep below sets these. */
  theta?: number
  lastClueTheta?: number
  /** Which city's boards this row is played on. 1-based; city 1 by default. */
  city?: number
}

interface Played {
  won: boolean
  clues: number
  /**
   * The moment the tokens finally ran out. Two shapes share it now (owner,
   * build 90): the zero-suitcase round that keeps sudden death, and the
   * spent-wheel round that ends the game outright.
   */
  reachedTokenEnd: boolean
  greensLeftAtTokenEnd: number
  /** Sum of the numbers announced, and the greens actually found under them. */
  asked: number
  hits: number
  /** Sum of every clue's coverage, and the clues that cleared no bar at all. */
  coverage: number
  belowTheta: number
}

async function playGame(seed: number, row: Row): Promise<Played> {
  // The opener is pinned: every figure in this file was measured with the
  // player's seat cluing first, and the app's default moved to Casey on
  // 2026-09-06 (game.ts). Left to the default, city 2's cross-half row fell
  // from above its floor to 0.488 on the same seeds — the harness is about the
  // engine, not about who opens, so it keeps the seat order it was pinned under.
  let s = createGame({
    config: BOARD,
    words: cityBoard(seed, row.city ?? 1),
    seed,
    firstGiver: 'player',
  })
  const rng = mulberry32(seed ^ 0x9e37)
  let clues = 0
  let asked = 0
  let hits = 0
  let coverage = 0
  let belowTheta = 0
  let reachedTokenEnd = false
  let greensLeftAtTokenEnd = 0
  let safety = 400

  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]!

  const giveClue = (state: GameState, by: Side): GameState => {
    const view = buildAiClueView(by === 'ai' ? state : mirror(state))
    clues++
    if (row.clueEv) {
      const plan = searchClue(row.clueEv, view, {
        theta: row.theta,
        lastClueTheta: row.lastClueTheta,
      })
      expect(plan).not.toBeNull()
      asked += plan!.coverage
      coverage += plan!.coverage
      if (plan!.belowTheta) belowTheta++
      return applyEvent(state, {
        type: 'SUBMIT_CLUE',
        by,
        text: plan!.text,
        number: plan!.coverage,
        targets: plan!.targets,
      })
    }
    const number = Math.min(3, targetableGreenIds(state, by).length)
    asked += number
    return applyEvent(state, {
      type: 'SUBMIT_CLUE',
      by,
      text: nonsenseClue(state, state.clueHistory.length),
      number,
    })
  }

  const countHits = (before: GameState, after: GameState) => {
    const clue = currentClue(after)
    if (!clue) return
    const priorGuesses = currentClue(before)?.guesses.length ?? 0
    if (clue.guesses.length <= priorGuesses) return
    hits += clue.guesses.slice(priorGuesses).filter((g) => g.result === 'green').length
  }

  const guess = async (state: GameState, seat: Side): Promise<GameState> => {
    const phase = seat === 'ai' ? 'aiGuessing' : 'playerGuessing'
    let st = state
    if (row.guesser.kind === 'engine') {
      const ev = row.guesser.ev
      const clue = currentClue(st)!
      const view = buildAiGuessView(seat === 'ai' ? st : mirror(st))
      const ranked = view.words
        .filter((w) => isGuessable(st, w.id))
        .map((w) => ({
          wordId: w.id,
          confidence: Math.min(0.95, 0.2 + ev.sim(clue.text, w.id) * 0.25),
          reasoning: '',
          sim: ev.sim(clue.text, w.id),
        }))
        .sort((a, b) => b.sim - a.sim || (a.wordId < b.wordId ? -1 : 1))
      for (const g of planGuessExecution(ranked, clue.number)) {
        if (st.phase !== phase) break
        if (!isGuessable(st, g.wordId)) continue
        const before = st
        st = applyEvent(st, { type: 'GUESS', wordId: g.wordId })
        countHits(before, st)
      }
    } else {
      const p = row.guesser.p
      const number = currentClue(st)!.number
      for (let i = 0; i < number && st.phase === phase; i++) {
        const meant = targetableGreenIds(st, giverOf(st.phase))
        const open = st.words.filter((w) => isGuessable(st, w.wordId))
        if (open.length === 0) break
        const right = meant.length > 0 && rng() < p
        const id = right ? pick(meant) : pick(open).wordId
        const before = st
        st = applyEvent(st, { type: 'GUESS', wordId: id })
        countHits(before, st)
      }
    }
    if (st.phase === phase) st = applyEvent(st, { type: 'STOP_GUESSING' })
    return st
  }

  while (s.phase !== 'finished' && safety-- > 0) {
    if (s.phase === 'suddenDeath' && !reachedTokenEnd) {
      reachedTokenEnd = true
      greensLeftAtTokenEnd = remainingGreenIds(s).length
    }
    switch (s.phase) {
      case 'playerClueInput':
        s = giveClue(s, 'player')
        break
      case 'aiClueInput':
        s = giveClue(s, 'ai')
        break
      case 'translateChallenge': {
        // The Translation Wheel, auto-passed: every segment's answer is read
        // off the state so the grading path is the engine's own. The last
        // accepted translation moves the phase to translateWheel INSIDE the
        // engine (see SUBMIT_TRANSLATION), so the spin lives in the
        // translateWheel arm below.
        for (const id of s.wheel!.segments) {
          if (s.wheel!.translated.includes(id)) continue
          s = applyEvent(s, {
            type: 'SUBMIT_TRANSLATION',
            wordId: id,
            answer: s.words.find((w) => w.wordId === id)!.da,
          })
        }
        break
      }
      case 'translateWheel': {
        // A filled wheel spins here; since the ending change (owner,
        // 2026-09-18) the spin's verdict IS the round's outcome — a win
        // finishes the round as won, a miss as lost. No token, no chooser.
        if (!s.wheel!.result) s = applyEvent(s, { type: 'SPIN_WHEEL' })
        break
      }
      case 'aiGuessing':
        s = await guess(s, 'ai')
        break
      case 'playerGuessing':
        s = await guess(s, 'player')
        break
      case 'suddenDeath': {
        // No giver and no new clue: whatever the row's guesser makes of the
        // last clue it heard. Played out rather than walked away from, for the
        // reason selfplay.test.ts's playOneGame gives.
        const open = s.words.filter((w) => isGuessable(s, w.wordId))
        if (open.length === 0) {
          s = applyEvent(s, { type: 'STOP_GUESSING' })
          break
        }
        if (row.guesser.kind === 'engine') {
          const ev = row.guesser.ev
          const last = currentClue(s)?.text ?? ''
          const best = [...open].sort(
            (a, b) =>
              ev.sim(last, b.wordId) - ev.sim(last, a.wordId) || (a.wordId < b.wordId ? -1 : 1),
          )[0]!
          s = applyEvent(s, { type: 'GUESS', wordId: best.wordId })
        } else {
          const alive = remainingGreenIds(s).filter((id) => isGuessable(s, id))
          const right = alive.length > 0 && rng() < row.guesser.p
          s = applyEvent(s, { type: 'GUESS', wordId: right ? pick(alive) : pick(open).wordId })
        }
        break
      }
    }
  }
  expect(safety).toBeGreaterThan(0)
  // C1-PC-1: solved boards also spin. Preserve the association-quality metric
  // by checking the actual budget; a wheel no longer implies exhaustion.
  if (s.turnsLeft <= 0) {
    reachedTokenEnd = true
    greensLeftAtTokenEnd = remainingGreenIds(s).length
  }
  return {
    won: s.outcome?.result === 'won',
    clues,
    reachedTokenEnd,
    greensLeftAtTokenEnd,
    asked,
    hits,
    coverage,
    belowTheta,
  }
}

interface Summary {
  winRate: number
  tokenEndRate: number
  meanClues: number
  meanGreensLeftAtTokenEnd: number
  /** Greens found per word the clue-giver asked for — the probe's own metric. */
  hitsPerNumber: number
  /** 100 - tokenEndRate: the board cleared while the tokens lasted. */
  clearedInTokens: number
  /** Words a clue points at, on average, and how often nothing cleared the bar. */
  coveragePerClue: number
  belowTheta: number
}

const pct = (x: number) => +(100 * x).toFixed(1)

async function measure(row: Row, games: number): Promise<Summary> {
  const runs: Played[] = []
  for (let seed = 1; seed <= games; seed++) runs.push(await playGame(seed, row))
  const sd = runs.filter((r) => r.reachedTokenEnd)
  const sum = (f: (r: Played) => number) => runs.reduce((a, r) => a + f(r), 0)
  return {
    winRate: pct(runs.filter((r) => r.won).length / games),
    tokenEndRate: pct(sd.length / games),
    meanClues: +(sum((r) => r.clues) / games).toFixed(2),
    meanGreensLeftAtTokenEnd: +(
      sd.reduce((a, r) => a + r.greensLeftAtTokenEnd, 0) / Math.max(sd.length, 1)
    ).toFixed(2),
    hitsPerNumber: +(sum((r) => r.hits) / Math.max(1, sum((r) => r.asked))).toFixed(3),
    clearedInTokens: pct((games - sd.length) / games),
    coveragePerClue: +(sum((r) => r.coverage) / Math.max(1, sum((r) => r.clues))).toFixed(2),
    belowTheta: sum((r) => r.belowTheta),
  }
}

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

describe('the engine measured against the floor and the p-curve', () => {
  it(
    'reads the same boards three ways, and the engine is not the harness',
    async () => {
      const shipped = (await loadEvaluator(1))!
      const { models, first: opus, second: fable } = await loadHalves()
      expect(models).toEqual(['opus', 'fable'])
      const hashA = hashEvaluator(shipped, 'a')
      const hashB = hashEvaluator(shipped, 'b')

      const rows: Row[] = [
        { label: 'mock floor  (nonsense clues, p=0)  ', clueEv: null, guesser: { kind: 'coin', p: 0 } },
        { label: 'p-curve  p=0.6                     ', clueEv: null, guesser: { kind: 'coin', p: 0.6 } },
        { label: 'p-curve  p=0.7                     ', clueEv: null, guesser: { kind: 'coin', p: 0.7 } },
        { label: 'p-curve  p=0.8                     ', clueEv: null, guesser: { kind: 'coin', p: 0.8 } },
        { label: 'engine <-> engine (UPPER BOUND)    ', clueEv: shipped, guesser: { kind: 'engine', ev: shipped } },
        { label: 'Opus clues  / Fable guesses        ', clueEv: opus, guesser: { kind: 'engine', ev: fable } },
        { label: 'Fable clues / Opus guesses         ', clueEv: fable, guesser: { kind: 'engine', ev: opus } },
        { label: 'MUTATION djb2, one shared hash     ', clueEv: hashA, guesser: { kind: 'engine', ev: hashA } },
        { label: 'MUTATION djb2, two INDEPENDENT     ', clueEv: hashA, guesser: { kind: 'engine', ev: hashB } },
      ]

      const out: Summary[] = []
      for (const row of rows) out.push(await measure(row, GAMES))

      if (envVar('ENGINE_SELFPLAY_REPORT')) {
        console.log(
          `\ncity-1 boards, ${GAMES} seeded games a row, 3x6 8/3/8\n` +
            'row                                   win%   token-end%    clues  hits/number  greens left at end\n' +
            rows
              .map((r, i) => {
                const s = out[i]!
                return (
                  `${r.label} ${s.winRate.toFixed(1).padStart(6)} ${s.tokenEndRate
                    .toFixed(1)
                    .padStart(13)} ${s.meanClues.toFixed(2).padStart(6)} ${s.hitsPerNumber
                    .toFixed(3)
                    .padStart(12)} ${s.meanGreensLeftAtTokenEnd.toFixed(2).padStart(18)}`
                )
              })
              .join('\n'),
        )
      }

      const [floor, p60, p70, p80, upper, opusFable, fableOpus, sharedHash, splitHash] = out as [
        Summary, Summary, Summary, Summary, Summary, Summary, Summary, Summary, Summary,
      ]

      /**
       * BANDS, NOT POINTS — every figure here moves with GAMES.
       *
       * 1. The floor is the floor. Nothing ends a round early, so a guesser
       *    that knows nothing spends every token. Since the spin decides the
       *    round (owner, 2026-09-18), the auto-passed, fully-filled wheel
       *    wins every round that reaches the ending — the floor's win rate is
       *    the ending's reach, not the guesser's skill. The pins defend the
       *    shape (spend every token, end through the wheel) rather than a
       *    losing record; this reproduces selfplay.test.ts's know-nothing row
       *    on REAL words, which is the check that the city-1 board is not
       *    somehow easier than the synthetic one.
       */
      expect(floor.winRate).toBeGreaterThan(0)
      expect(floor.tokenEndRate).toBeGreaterThan(90)
      expect(floor.meanGreensLeftAtTokenEnd).toBeGreaterThan(distinctGreens(BOARD) / 3)

      /**
       * 2. The upper bound is an upper bound, and it is ABOVE everything else
       *    in the table. It is not a claim about a human — one evaluator sits
       *    in both seats.
       */
      expect(upper.winRate).toBeGreaterThan(90)
      expect(upper.winRate).toBeGreaterThanOrEqual(opusFable.winRate)
      expect(upper.winRate).toBeGreaterThanOrEqual(fableOpus.winRate)

      /**
       * 3. THE NUMBER THIS CARD EXISTS FOR. A clue-giver reading one model's
       *    judgement, examined by a guesser reading the other's — neither seat
       *    sharing the other's opinion, and neither sharing the merged book the
       *    app ships. This is the only row in the table that is evidence about
       *    a partner rather than about a code. Banded loosely: what is being
       *    defended is that it sits well clear of the floor and inside the
       *    coin's own range, not the third digit.
       */
      for (const cross of [opusFable, fableOpus]) {
        expect(cross.winRate).toBeGreaterThan(30)
        expect(cross.winRate).toBeLessThanOrEqual(upper.winRate)
        expect(cross.hitsPerNumber).toBeGreaterThan(0.5)
        expect(cross.hitsPerNumber).toBeLessThan(upper.hitsPerNumber)
      }
      // Read against the coin on the SAME boards rather than against a memory
      // of one. The engine's cross-model hit rate lands between the p=0.6 and
      // the p=0.8 coin — the band where selfplay's curve says a board is still
      // losable. Banded on p=0.8 rather than p=0.7 because the p=0.7 cell and
      // the better cross row are within 0.02 of each other at the default
      // sample size, which is a coin flip rather than a claim.
      const crossHits = Math.max(opusFable.hitsPerNumber, fableOpus.hitsPerNumber)
      expect(crossHits).toBeGreaterThan(p60.hitsPerNumber)
      expect(crossHits).toBeLessThan(p80.hitsPerNumber)

      /**
       * 4. THE MUTATION, in two halves, and the first half is a finding rather
       *    than a check.
       *
       *    ONE SHARED HASH WINS. djb2 in sim's place, both seats reading the
       *    same djb2, and the row beats the p-curve outright — because the
       *    search picks whatever the hash happens to rank high on its targets
       *    and low on its traps, and the guesser reads it back off the same
       *    hash. A shared arbitrary function is a private code between the
       *    seats. So the upper-bound row measures AGREEMENT, not association,
       *    and no pin here may rest on it.
       *
       *    TWO INDEPENDENT HASHES COLLAPSE. Take the shared code away and the
       *    same engine falls to the floor. That is the mutation that must fail
       *    band 3, and it is the check that the cross-model rows are pinning
       *    the book and the matrix rather than the harness. Recorded as a run
       *    in the E4 commit, and asserted here so it stays true.
       */
      // Since the ending change (owner, 2026-09-18) the wheel's auto-passed,
      // fully-filled spin decides every round that reaches the ending, so
      // p70's row also saturates — "beats the p-curve outright" is no longer
      // readable as strictly greater. The finding survives as an EQUALITY
      // pin at saturation plus the split-hash collapse below it: the shared
      // code still wins everything, the split code still loses.
      expect(sharedHash.winRate).toBeGreaterThanOrEqual(p70.winRate) // the finding
      expect(sharedHash.winRate).toBeGreaterThan(90)
      // The split hash's own collapse is gone with the blind-naming ending:
      // the auto-passed, fully-filled wheel now decides every round that
      // reaches the ending, so BOTH mutation rows saturate. The mutation
      // check that survives is hitsPerNumber — the split code's clues are
      // still found far less than the shared code's (its guesser reads a
      // different hash), which is the "private code" signature.
      expect(splitHash.winRate).toBeLessThanOrEqual(sharedHash.winRate)
      expect(splitHash.hitsPerNumber).toBeLessThan(sharedHash.hitsPerNumber === 0 ? 0.5 : sharedHash.hitsPerNumber)
      expect(splitHash.hitsPerNumber).toBeLessThan(0.5)

      /**
       * 5. θ IS DEFENDED HERE, CROSS-MODEL, because the sweep that first chose
       *    it was run on the row band 4 just retired.
       *
       *    The objective is "cleared inside the tokens", NOT hits/number.
       *    hits/number rises monotonically with θ all the way to 0.966 at
       *    θ = 2.0 — a bar that high gives clues so safe they are almost always
       *    read correctly and so narrow that **0% of boards are finished**. A
       *    clue engine optimised on hit rate alone would pick the setting that
       *    never wins. So the dial is read off the boards it clears.
       *
       *    WHAT IS PINNED IS WHAT SURVIVES THE SAMPLE SIZE. θ = 0.5 clears more
       *    than θ = 0 (which lets a clue TIE its strongest trap) and far more
       *    than θ = 1.5 (which runs the tokens out with greens still up), in
       *    both directions, at 40 games and at 200 and at 400. The neighbour
       *    that is NOT pinned is θ = 1.0: it loses by 8.7 and 15.3 points at
       *    400 games and by 9.5 and 18.5 at 200, but at this file's 40-game
       *    default one direction flips (55.0 against 57.5). That is exactly the
       *    trap CLAUDE.md names — fixed seeds are reproducible, not independent
       *    of n — so the shipped choice between 0.5 and 1.0 rests on the 400-
       *    game run recorded in `search.ts`, and this suite does not pretend to
       *    re-decide it in twenty seconds.
       */
      const halves = await loadHalves()
      const cleared = async (clueEv: Evaluator, guessEv: Evaluator, theta: number) =>
        (await sweepCell(clueEv, guessEv, theta, theta, GAMES)).clearedInTokens
      for (const [, a, b] of directions(halves)) {
        const atTheta = await cleared(a, b, THETA)
        expect(atTheta).toBeGreaterThan(await cleared(a, b, 0))
        expect(atTheta).toBeGreaterThan(await cleared(a, b, 1.5))
      }
    },
    1_800_000,
  )
})

describe('the authoring halves are really halves', () => {
  it('each model judged every pair and wrote every word, and they differ', async () => {
    const shipped = (await loadEvaluator(1))!
    const { models, first: opus, second: fable } = await loadHalves()
    expect(models).toEqual(['opus', 'fable'])

    for (const half of [opus, fable]) {
      expect(half.ids.length).toBe(shipped.ids.length)
      for (const id of shipped.ids) expect(half.assocFor(id).length).toBeGreaterThan(15)
    }

    // If the two halves agreed everywhere the cross-model rows would be
    // engine-vs-engine wearing a hat. E2 measured 1,898 of 3,490 entries with
    // v=2; the disagreement below is what is left over.
    let differing = 0
    for (const id of shipped.ids) {
      const o = new Set(opus.assocFor(id).map((e) => normalize(e.da)))
      const f = new Set(fable.assocFor(id).map((e) => normalize(e.da)))
      for (const k of o) if (!f.has(k)) differing++
      for (const k of f) if (!o.has(k)) differing++
    }
    expect(differing).toBeGreaterThan(500)

    // And the shipped book is the union of the two, so it must be at least as
    // rich as either half on every word.
    for (const id of shipped.ids) {
      expect(shipped.assocFor(id).length).toBeGreaterThanOrEqual(
        Math.min(opus.assocFor(id).length, fable.assocFor(id).length),
      )
    }
  }, 120_000)
})

// ---------------------------------------------------------------------------
// EVERY AUTHORED CITY, ON THE ONE ROW THAT IS EVIDENCE.
//
// E4's verdict names the number that would REVERSE E6: "if the first new
// city's cross-model hits/number comes in below ~0.45 - near the p = 0.5
// region rather than 0.6-0.7 - that would say the city-1 result was about
// city 1's hand-curated hundred rather than about the method". So the check is
// re-taken per city rather than asserted once for city 1 and inherited.
//
// It is the cross-model row and nothing else: a clue-giver reading one model's
// half, examined by a guesser reading the other's. Engine-vs-engine is a
// shared code (the mutation above), and the merged book the app ships is what
// both halves fed into, so neither can answer this question about a NEW city.
//
// The floor is re-run per city too. Without it, a city whose words happen to
// be easier to guess at random would read as a working book.
// ---------------------------------------------------------------------------

/** The bar E4 set for a new city, on hits per word asked. */
const NEW_CITY_FLOOR = 0.45

describe('the method generalises to every city E6 has authored', () => {
  it.each(authoredCities.map((city) => [city] as const))(
    'city %i reads its own boards well clear of the floor',
    async (city) => {
      const halves = await loadHalves(city)
      const [firstModel, secondModel] = halves.models
      const floor = await measure(
        { label: 'floor', clueEv: null, guesser: { kind: 'coin', p: 0 }, city },
        GAMES,
      )
      const firstSecond = await measure(
        {
          label: 'first/second',
          clueEv: halves.first,
          guesser: { kind: 'engine', ev: halves.second },
          city,
        },
        GAMES,
      )
      const secondFirst = await measure(
        {
          label: 'second/first',
          clueEv: halves.second,
          guesser: { kind: 'engine', ev: halves.first },
          city,
        },
        GAMES,
      )

      if (envVar('ENGINE_SELFPLAY_REPORT')) {
        const line = (label: string, x: Summary) =>
          `${label.padEnd(22)} ${x.hitsPerNumber.toFixed(3).padStart(11)} ${x.clearedInTokens
            .toFixed(1)
            .padStart(9)} ${x.winRate.toFixed(1).padStart(6)} ${x.coveragePerClue
            .toFixed(2)
            .padStart(9)}`
        console.log(
          `\ncity ${city}, ${GAMES} seeded boards a row\n` +
            'row                    hits/number   cleared%   win%   cov/clue\n' +
            [
              line('mock floor  p=0', floor),
              line(
                `${displayModel(firstModel)} clues / ${displayModel(secondModel)}`,
                firstSecond,
              ),
              line(
                `${displayModel(secondModel)} clues / ${displayModel(firstModel)}`,
                secondFirst,
              ),
            ].join('\n'),
        )
      }

      // The floor is the floor on this city's words too.
      expect(floor.hitsPerNumber).toBeLessThan(0.3)

      // And the book beats it by a wide margin, in both directions, above the
      // bar E4 named. Banded, not pinned to a digit: GAMES moves every figure.
      for (const cross of [firstSecond, secondFirst]) {
        expect(cross.hitsPerNumber).toBeGreaterThan(NEW_CITY_FLOOR)
        expect(cross.hitsPerNumber).toBeGreaterThan(floor.hitsPerNumber * 2)
      }
    },
    600_000,
  )
})

// ---------------------------------------------------------------------------
// THE θ SWEEP, RE-RUN ON AN INSTRUMENT THAT SURVIVES THIS FILE'S OWN CRITIQUE.
//
// θ was first chosen (E3) on an engine-vs-engine sweep. The mutation above
// retires that instrument: with one evaluator in both seats a shared djb2 hash
// scores 100%, so the sweep was ranking θ on how well the search encodes into a
// code the guesser already shares — not on clue quality. θ governs every clue
// the shipped engine gives, so it must not rest on that.
//
// This sweeps the cross-model split instead: Opus-authored clues read by a
// Fable-authored guesser and the reverse, reporting hits/number and "cleared
// inside the tokens" rather than win rate, for the sudden-death reason band 3
// gives. Report-only — the committed pin is the band below it.
// ---------------------------------------------------------------------------

/**
 * The whole grid, and it is EXHAUSTIVE rather than a sample. `sim` returns
 * multiples of 0.5 and nothing else, so every margin is a multiple of 0.5 and a
 * bar of 0.75 admits exactly the clues a bar of 1.0 admits. There is no finer θ
 * to try. `ENGINE_THETA_LIST=0.5,1` narrows it when one comparison needs a
 * bigger sample than the whole sweep can afford.
 */
const THETAS: readonly number[] =
  envVar('ENGINE_THETA_LIST')?.split(',').map(Number) ?? [0, 0.5, 1, 1.5, 2]

const sweepCell = (
  clueEv: Evaluator,
  guessEv: Evaluator,
  theta: number,
  lastClueTheta: number,
  games: number,
): Promise<Summary> =>
  measure(
    { label: '', clueEv, guesser: { kind: 'engine', ev: guessEv }, theta, lastClueTheta },
    games,
  )

const directions = (halves: AuthoringHalves): Array<[string, Evaluator, Evaluator]> => {
  const [first, second] = halves.models.map(displayModel)
  return [
    [`${first} clues / ${second} guesses`, halves.first, halves.second],
    [`${second} clues / ${first} guesses`, halves.second, halves.first],
  ]
}

describe('θ, measured cross-model', () => {
  it(
    'sweeps when asked — the measurement THETA quotes',
    async () => {
      if (!envVar('ENGINE_THETA_CROSS')) return
      const games = Number(envVar('ENGINE_SELFPLAY_GAMES') ?? 200)
      const dirs = directions(await loadHalves())
      const head =
        'direction                      dial  hits/number  cleared-in-tokens  win%  cov/clue  below'
      const line = (label: string, dial: number, r: Summary) =>
        `${label} ${dial.toFixed(1).padStart(6)} ${r.hitsPerNumber.toFixed(3).padStart(12)} ` +
        `${r.clearedInTokens.toFixed(1).padStart(18)} ${r.winRate.toFixed(1).padStart(5)} ` +
        `${r.coveragePerClue.toFixed(2).padStart(9)} ${String(r.belowTheta).padStart(7)}`

      // One bar throughout, so this isolates θ rather than mixing it with the
      // last-clue branch. That branch gets its own sweep after.
      console.log(`\ncross-model θ sweep, ${games} seeded city-1 boards a cell\n${head}`)
      for (const [label, a, b] of dirs) {
        for (const theta of THETAS) {
          console.log(line(label, theta, await sweepCell(a, b, theta, theta, games)))
        }
      }

      const at = Number(envVar('ENGINE_LAST_CLUE_AT') ?? 0.5)
      console.log(`\nthe last-clue bar on its own, at θ = ${at.toFixed(1)}\n${head}`)
      for (const [label, a, b] of dirs) {
        for (const bar of [0, 0.5, 1]) {
          console.log(line(label, bar, await sweepCell(a, b, at, bar, games)))
        }
      }
    },
    3_600_000,
  )
})
