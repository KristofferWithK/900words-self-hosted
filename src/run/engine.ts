import { askableWords, pickWrongAnswers } from './distractors'
import {
  answerKindOf,
  type RunAnswerKind,
  type RunEndReason,
  type RunMiss,
  type RunResult,
  type RunResultsSink,
  type RunWalk,
  type RunWordTally,
} from './results'
import { GATE_TIERS, tierOf } from './tiers'
import { articleLaneWord, laneOfArticle } from './walks'
import type { RunWord } from './words'

/**
 * THE RUN, WITHOUT A SCREEN.
 *
 * A port of the running game in docs/design/cafe-world/door-dash.html (the
 * Sightseeing run: the Words walk, and the Articles walk that the prototype
 * calls Article Crossroads), cut away from its drawing so it can be tested
 * in node and drawn by src/run/draw.ts. Distances are in the prototype's
 * units: z is how far a gate is ahead of Casey (0 = at her), gates stand
 * SPACING apart and come out of the haze at FAR.
 *
 * Rules kept from the contract (docs/roadmap/cafe-world.md §2):
 *  - one wrong word is forgiven; the next one ends the run;
 *  - seconds per gate 3.2 / 2.6 / 2.1 / 1.75 (src/run/tiers.ts);
 *  - only the next gate's words are readable (`reveal`); later gates stay
 *    scribbled over until the gate before them is passed;
 *  - wrong answers are the same kind of word and never share a meaning;
 *  - missed words come back more often (`missesBefore` and this run's misses);
 *  - Articles walk: the noun is on the tag and the suitcases are the course's
 *    articles, each always in its own lane (`lanes`, from the course data).
 *
 * The train run (card CW-07, contract §4) is the same road with three
 * differences: it asks every word of its pool exactly once, in a shuffled
 * order, and ends `caught` when the last one is answered; it forgives the
 * player's slips (`forgiven`, from journey/trainSlips.ts) instead of one; and
 * its speed counts words answered, as the prototype's train run did, since a
 * run that must get through every word cannot be held at the first speed by
 * its misses. Wrong answers and the slip rule are the Words walk's.
 */

/** Distance between gates. */
export const SPACING = 2.9
/** Where gates come out of the haze, well down the road. */
export const FAR = 9.1
/** The first gate stands this far ahead when a run starts. */
export const FIRST_GATE = SPACING * 1.3
/** The words of the active gate are rubbed clear over this many seconds. */
export const REVEAL_SECONDS = 0.3
/** Seconds the slip and faster notes stay up. */
export const SLIP_NOTE_SECONDS = 2.2
export const FASTER_NOTE_SECONDS = 1.6
/** A café leaves the road's list once it is this far behind Casey: walked through, collected and gone (draw.ts `cafeAlphaAt`). */
export const SHOPFRONT_GONE = -0.1

export type RunPhase = 'ready' | 'play' | 'over'

export interface RunGate {
  readonly id: number
  /** What the gate asks: what the word means (Words walk) or its article (Articles walk). */
  readonly kind: RunAnswerKind
  readonly word: RunWord
  /**
   * What the tag says: the meaning in the player's language (Words walk), or
   * the noun itself (Articles walk).
   */
  readonly prompt: string
  /** The suitcases, left to right. In the Articles walk, the articles in their lanes. */
  readonly options: readonly RunWord[]
  readonly correct: number
  z: number
  /** 0 = scribbled over, 1 = readable. */
  reveal: number
  resolved: boolean
  /** The lane the player was in when this gate was missed, or -1. */
  wrongLane: number
}

/**
 * A café found on this walk, standing ON THE ROAD ahead with its name
 * (contract §5; owner, 2026-10-04: "on the road and not on the side"). Casey
 * walks to it and through it: it is scenery, nothing to steer into or around,
 * so it is drawn faint (src/run/draw.ts `cafeBox`). It stands halfway between
 * two gates and moves with the road, so it keeps that place until it has
 * passed, and in that place it never stands over a gate on the screen.
 */
export interface RunShopfront {
  readonly id: number
  /** The café's name, as it is written on the shop: a Danish proper name, never translated. */
  readonly name: string
  z: number
  /** Where on the road it was placed. A café that did not hold the run comes out of the road from here (draw.ts). */
  readonly placedZ: number
  /**
   * Whether the run held on it ("You found a café", the first session only):
   * then it is already standing there, behind the panel, when the panel opens.
   */
  readonly held: boolean
}

export type RunNote =
  | { readonly kind: 'faster'; t: number }
  | { readonly kind: 'slip'; readonly word: RunWord; t: number }

export interface RunState {
  phase: RunPhase
  photos: number
  answered: number
  slips: number
  /** Wrong words this run forgives; the next one ends it. Fixed when the run starts. */
  forgiven: number
  /** Words the run asks in all: the train run's list, 0 on an endless walk. */
  total: number
  /** How many lanes the road has: 3 in the Words walk, one per article in the Articles walk. */
  readonly lanes: number
  /** The lane steered to, 0 at the left. */
  lane: number
  /** Where Casey is across the road, easing towards `lane`, in lanes. */
  laneX: number
  gates: RunGate[]
  /** Cafés found on this walk, on the road ahead or passing by. */
  shopfronts: RunShopfront[]
  /**
   * A café was just found on the first session's walk: the run holds where it
   * is ("You found a café") until `carryOn`. Nothing moves while it holds, so
   * the speed, the slips and the photos are what they were. The run is still
   * on: leaving now reports it. Any other walk finds its cafés without holding.
   */
  held: boolean
  /** Distance run, for the scrolling street. */
  scroll: number
  /** Seconds since the screen began, for Casey's bob and blink. */
  clock: number
  /** Distance per second. */
  speed: number
  tier: number
  /** Seconds left of the camera's little jump in the HUD. */
  flash: number
  slipFlash: number
  note: RunNote | null
  lastMiss: { readonly word: RunWord; readonly picked: RunWord } | null
  endReason: RunEndReason | null
}

export interface RunEvents {
  /** A right answer, the moment Casey passes through it. */
  photo?(word: RunWord): void
  /** A wrong answer. `ended` when it was the second. */
  miss?(word: RunWord, picked: RunWord, ended: boolean): void
  faster?(tier: number): void
  end?(result: RunResult): void
}

export interface RunEngineOptions {
  readonly walk?: RunWalk
  readonly cityIndex: number
  /**
   * The city's run words. Words walk: only words with two possible wrong
   * answers are asked. Articles walk: only nouns whose article has a lane.
   */
  readonly pool: readonly RunWord[]
  /**
   * The Articles walk's lanes, left to right: the course's articles
   * (src/run/walks.ts `articleLanes`). Needed for that walk, ignored by the other.
   */
  readonly lanes?: readonly string[]
  readonly sink: RunResultsSink
  readonly events?: RunEvents
  readonly rng?: () => number
  readonly now?: () => number
  /**
   * How often a word should come up, before this run's own misses are added.
   * The prototype's weight is 1 + 4 per remembered miss; a rule card can feed
   * remembered misses in here. `kind` says which misses count: a missed
   * article brings a noun back in the Articles walk, a missed meaning in the
   * Words walk (src/run/results.ts `tallyMisses` keeps them apart).
   */
  readonly missesBefore?: (word: RunWord, kind: RunAnswerKind) => number
  /**
   * Wrong words forgiven before the run ends. One in both walks; the train
   * run's slips. A function is read again at every start, so a train run
   * started after more words were collected gets their slips.
   */
  readonly forgiven?: number | (() => number)
  /**
   * TRAIN RUN, LOCAL DEV ONLY: ask only this many of the train's words, so a
   * screenshot can reach the end of the run. The screen passes it only on a
   * local host (`?trainwords=`); nothing else sets it.
   */
  readonly trainLimit?: number
  /** Called when a gate is placed on the road, so its recording can be readied. */
  readonly onGateSpawned?: (gate: RunGate) => void
}

/** Lanes in the Words walk: the right word and two wrong ones. */
export const LANES = 3
/**
 * Gates on the road at once, at most: a walk needs more words than this, or
 * the road could not be filled with words that are not already on it.
 */
export const ROAD_GATES = Math.ceil(FAR / SPACING) + 1

/**
 * THE QUIET PART OF A GATE. Work that can wait (making the pictures of the
 * next gates' words, readying their recordings) is done only while no answer
 * is near: the frames around an answer already carry the answer itself (the
 * word said, the suitcase turning green, the next gate coming into play), and
 * the owner's stutter was exactly there. Quiet means at least QUIET_BEFORE
 * seconds before the next gate reaches Casey and QUIET_AFTER seconds after the
 * last answer (`sinceAnswer`). A run that is not moving is quiet throughout.
 */
export const QUIET_BEFORE = 0.35
export const QUIET_AFTER = 0.3

export function runIsQuiet(state: Pick<RunState, 'phase' | 'held' | 'gates' | 'speed'>, sinceAnswer: number): boolean {
  if (state.phase !== 'play' || state.held) return true
  if (sinceAnswer < QUIET_AFTER) return false
  const next = state.gates.find((g) => !g.resolved)
  if (!next || state.speed <= 0) return true
  return next.z / state.speed >= QUIET_BEFORE
}

/** The lane Casey starts in: the middle of three, the left of two (as in the prototype). */
export const startLane = (lanes: number) => Math.floor((lanes - 1) / 2)

export function createRunEngine(options: RunEngineOptions) {
  const walk = options.walk ?? 'words'
  const kind = answerKindOf(walk)
  const rng = options.rng ?? Math.random
  const now = options.now ?? Date.now
  const train = walk === 'train'
  const forgivenNow = (): number => {
    const n = typeof options.forgiven === 'function' ? options.forgiven() : options.forgiven ?? 1
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 1
  }
  const pool = options.pool
  const articles = walk === 'articles' ? [...(options.lanes ?? [])] : []
  if (walk === 'articles' && articles.length < 2) throw new Error('the Articles walk needs two articles or more')
  const laneWords = articles.map(articleLaneWord)
  const laneCount = walk === 'articles' ? articles.length : LANES
  const asked = walk === 'articles' ? pool.filter((w) => laneOfArticle(articles, w.article) >= 0) : askableWords(pool)
  // A walk refills the road from its words for ever, so it needs more than the
  // road holds; the train run asks each word once and only needs one.
  if (train ? asked.length === 0 : asked.length <= ROAD_GATES) throw new Error('a run needs more words than this')
  /** How many words the train run asks: all it can, or the local dev limit. */
  const trainLength = (): number => {
    const limit = options.trainLimit
    return limit !== undefined && Number.isInteger(limit) && limit > 0 && limit < asked.length ? limit : asked.length
  }
  /** The train run's words in the order they come, each once; empty on a walk. */
  let trainList: RunWord[] = []
  let spawned = 0

  let gateId = 0
  let shopId = 0
  let startedAt = 0
  let tallies = new Map<string, { kind: RunAnswerKind; origin: RunWord['origin']; photos: number; misses: number }>()
  let misses: RunMiss[] = []
  const runMisses = new Map<string, number>()

  const state: RunState = {
    phase: 'ready',
    photos: 0,
    answered: 0,
    slips: 0,
    forgiven: forgivenNow(),
    // Known before the start, so the bar behind the first panel already says how many.
    total: train ? trainLength() : 0,
    lanes: laneCount,
    lane: startLane(laneCount),
    laneX: startLane(laneCount),
    gates: [],
    shopfronts: [],
    held: false,
    scroll: 0,
    clock: 0,
    speed: SPACING / GATE_TIERS[0].seconds,
    tier: 0,
    flash: 0,
    slipFlash: 0,
    note: null,
    lastMiss: null,
    endReason: null,
  }

  const tally = (w: RunWord) => {
    let t = tallies.get(w.id)
    if (!t) tallies.set(w.id, (t = { kind, origin: w.origin, photos: 0, misses: 0 }))
    return t
  }

  function pickWord(): RunWord {
    if (train) return trainList[spawned++]
    const onRoad = new Set(state.gates.map((g) => g.word.id))
    const candidates = asked.filter((w) => !onRoad.has(w.id))
    const weights = candidates.map((w) => 1 + 4 * ((options.missesBefore?.(w, kind) ?? 0) + (runMisses.get(w.id) ?? 0)))
    const total = weights.reduce((a, b) => a + b, 0)
    let r = rng() * total
    for (let i = 0; i < candidates.length; i++) {
      r -= weights[i]
      if (r <= 0) return candidates[i]
    }
    return candidates[candidates.length - 1]
  }

  /** The suitcases of a gate and the right one. Articles never move: each keeps its lane. */
  function optionsFor(word: RunWord): { options: RunWord[]; correct: number } {
    if (walk === 'articles') return { options: laneWords, correct: laneOfArticle(articles, word.article) }
    const opts = [word, ...pickWrongAnswers(word, pool, rng, LANES - 1)]
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[opts[i], opts[j]] = [opts[j], opts[i]]
    }
    return { options: opts, correct: opts.indexOf(word) }
  }

  function spawnGate(z: number): void {
    const word = pickWord()
    const { options: opts, correct } = optionsFor(word)
    const gate: RunGate = {
      id: ++gateId,
      kind,
      word,
      prompt: walk === 'articles' ? word.target : word.prompt,
      options: opts,
      correct,
      z,
      reveal: 0,
      resolved: false,
      wrongLane: -1,
    }
    state.gates.push(gate)
    options.onGateSpawned?.(gate)
  }

  function fillRoad(): void {
    while (!state.gates.length || state.gates[state.gates.length - 1].z + SPACING <= FAR) {
      // The train's list runs out: the road ends at its last word.
      if (train && spawned >= trainList.length) return
      spawnGate(state.gates.length ? state.gates[state.gates.length - 1].z + SPACING : FIRST_GATE)
    }
  }

  const activeGate = (): RunGate | undefined => state.gates.find((g) => !g.resolved)

  function result(end: RunEndReason): RunResult {
    const words: RunWordTally[] = [...tallies].map(([wordId, t]) => ({ wordId, ...t }))
    return {
      walk,
      cityIndex: options.cityIndex,
      startedAt,
      endedAt: now(),
      end,
      photos: state.photos,
      answered: state.answered,
      forgiven: state.forgiven,
      total: state.total,
      misses,
      words,
    }
  }

  function finish(end: RunEndReason): void {
    if (state.phase !== 'play') return
    state.phase = 'over'
    state.held = false
    state.endReason = end
    const r = result(end)
    options.sink.end(r)
    options.events?.end?.(r)
  }

  function start(): void {
    state.phase = 'play'
    state.photos = 0
    state.answered = 0
    state.slips = 0
    state.forgiven = forgivenNow()
    if (train) {
      // Every word once, shuffled (Fisher-Yates), as the prototype's train run.
      trainList = [...asked]
      for (let i = trainList.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1))
        ;[trainList[i], trainList[j]] = [trainList[j], trainList[i]]
      }
      trainList.length = trainLength()
      spawned = 0
    }
    state.total = trainList.length
    state.gates = []
    state.shopfronts = []
    shopId = 0
    state.held = false
    state.lane = startLane(laneCount)
    state.laneX = state.lane
    state.tier = 0
    state.speed = SPACING / GATE_TIERS[0].seconds
    state.flash = 0
    state.slipFlash = 0
    state.note = null
    state.lastMiss = null
    state.endReason = null
    tallies = new Map()
    misses = []
    startedAt = now()
    fillRoad()
  }

  function steer(d: -1 | 1): void {
    if (state.phase !== 'play' || state.held) return
    state.lane = Math.max(0, Math.min(laneCount - 1, state.lane + d))
  }

  function resolve(g: RunGate): void {
    g.resolved = true
    state.answered++
    const before = state.tier
    if (state.lane === g.correct) {
      state.photos++
      state.flash = 0.35
      tally(g.word).photos++
      const left = runMisses.get(g.word.id)
      if (left && left > 1) runMisses.set(g.word.id, left - 1)
      else if (left) runMisses.delete(g.word.id)
      options.sink.photo({ walk, kind, wordId: g.word.id, origin: g.word.origin, at: now() })
      options.events?.photo?.(g.word)
    } else {
      const picked = g.options[state.lane]
      state.slips++
      g.wrongLane = state.lane
      state.slipFlash = 0.5
      state.lastMiss = { word: g.word, picked }
      tally(g.word).misses++
      runMisses.set(g.word.id, (runMisses.get(g.word.id) ?? 0) + 1)
      const ended = state.slips > state.forgiven
      // An article miss names the article picked ("et"); a meaning miss, the word's id.
      const pickedId = kind === 'article' ? picked.target : picked.id
      const miss: RunMiss = { walk, kind, wordId: g.word.id, origin: g.word.origin, pickedId, at: now(), ended }
      misses.push(miss)
      options.sink.miss(miss)
      options.events?.miss?.(g.word, picked, ended)
      if (ended) {
        finish('second-wrong')
        return
      }
      state.note = { kind: 'slip', word: g.word, t: SLIP_NOTE_SECONDS }
    }
    state.tier = tierOf(train ? state.answered : state.photos)
    if (state.tier !== before) {
      state.note = { kind: 'faster', t: FASTER_NOTE_SECONDS }
      options.events?.faster?.(state.tier)
    }
    // The last word of the train run answered, and the run still on: caught.
    if (train && state.answered >= trainList.length) finish('caught')
  }

  /** Advance the run by `dt` seconds. The caller clamps `dt` after a pause. */
  function step(dt: number): void {
    // Held for a found café: the run stands still, Casey's own clock included.
    if (state.held) return
    state.clock += dt
    state.laneX += (state.lane - state.laneX) * Math.min(1, dt * 18)
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt)
    if (state.slipFlash > 0) state.slipFlash = Math.max(0, state.slipFlash - dt)
    if (state.note) {
      state.note.t -= dt
      if (state.note.t <= 0) state.note = null
    }
    if (state.phase !== 'play') return
    const target = SPACING / GATE_TIERS[state.tier].seconds
    state.speed += (target - state.speed) * Math.min(1, dt * 2)
    state.scroll += state.speed * dt
    for (const g of state.gates) g.z -= state.speed * dt
    // Cafés move with the gates, before a gate is answered: one placed by
    // this step's answer (`findCafe`) is already where it belongs.
    for (const shop of state.shopfronts) shop.z -= state.speed * dt
    const g = activeGate()
    if (g) g.reveal = Math.min(1, g.reveal + dt / REVEAL_SECONDS)
    if (g && g.z <= 0) resolve(g)
    state.gates = state.gates.filter((x) => x.z > -0.2)
    state.shopfronts = state.shopfronts.filter((x) => x.z > SHOPFRONT_GONE)
    if (state.phase === 'play') fillRoad()
  }

  /**
   * A café was found by the photo just taken (src/run/sinkSetup.ts
   * `onCafeFound`): one café on the road ahead. With `hold` (the first
   * session's walk, src/run/cafeHold.ts) the run also holds until `carryOn`;
   * without it the run carries straight on and Casey walks through the café.
   * Only a walk finds cafés and only while it runs; anything else places
   * nothing and returns null.
   *
   * The café stands halfway between the gate just passed and the next one,
   * and keeps that place, since the road moves gates and cafés alike. There
   * it never stands over a gate on the screen (draw.ts `cafeBox`, proved in
   * cafeHold.test.ts).
   */
  function findCafe(name: string, hold: boolean): RunShopfront | null {
    if (state.phase !== 'play' || !(walk === 'words' || walk === 'articles')) return null
    const next = activeGate()
    const z = next ? next.z - SPACING / 2 : SPACING / 2
    const shop: RunShopfront = { id: ++shopId, name, z, placedZ: z, held: hold }
    state.shopfronts.push(shop)
    if (hold) state.held = true
    return shop
  }

  /** The player carries on from "You found a café": the run moves again from where it held. */
  function carryOn(): void {
    state.held = false
  }

  return {
    state,
    start,
    steer,
    step,
    activeGate,
    findCafe,
    carryOn,
    /** The player left mid-run. Reported as a run that ended by leaving; nothing if no run is on. */
    leave: () => finish('left'),
    /**
     * The words this walk asks: the pool's words with two possible wrong
     * answers (Words walk), or its nouns whose article has a lane (Articles).
     */
    asked,
    walk,
    /** The Articles walk's lanes, left to right; empty in the Words walk. */
    articles: articles as readonly string[],
    /** The train run's words in the order this run asks them; empty on a walk or before a start. */
    trainWords: (): readonly RunWord[] => trainList,
  }
}

export type RunEngine = ReturnType<typeof createRunEngine>
