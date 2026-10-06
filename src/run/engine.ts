import { askableWords, pickWrongAnswers } from './distractors'
import {
  type RunAnswerKind,
  type RunEndReason,
  type RunMiss,
  type RunResult,
  type RunResultsSink,
  type RunWalk,
  type RunWordTally,
} from './results'
import { GATE_TIERS, tierOf } from './tiers'
import { articleLaneWord, laneOfArticle, WALL_ID, WALL_LANE } from './walks'
import type { RunWord } from './words'

/**
 * THE RUN, WITHOUT A SCREEN.
 *
 * A port of the running game in docs/design/cafe-world/door-dash.html (the
 * Sightseeing walk, with the article gates of the prototype's Article
 * Crossroads mixed in), cut away from its drawing so it can be tested
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
 *  - article gates (owner, 2026-10-05: the Articles walk merged into the
 *    walk): where the course has them (`articleLanes`), every
 *    ARTICLE_GATE_EVERY-th gate asks a noun's article. The noun is on the tag
 *    and the lanes are its possible articles, each always in its own lane; a
 *    two-article course has a brick wall in the middle lane. An article gate
 *    has a longer run-up (ARTICLE_RUN_UP, 4/3 of the gate spacing), so the
 *    player has more time for it.
 *
 * The train run (card CW-07, contract §4) is the same road with three
 * differences: it asks every word of its pool exactly once, in a shuffled
 * order, and ends `caught` when the last one is answered; it forgives the
 * player's slips (`forgiven`, from journey/trainSlips.ts) instead of one; and
 * its speed counts words answered, as the prototype's train run did, since a
 * run that must get through every word cannot be held at the first speed by
 * its misses. Wrong answers and the slip rule are the walk's. It has no
 * article gates.
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
/** A café leaves the road's list once it is this far behind Casey: walked through and gone (draw.ts `cafeAlphaAt`). */
export const SHOPFRONT_GONE = -0.1
/**
 * Casey reaches a café when it is this close: she walks into it and it
 * starts to fade (draw.ts `cafeAlphaAt`). The first session's walk holds
 * here, on "You found a café" (owner, after build 123: "the panel should
 * open when you hit the café, of course").
 */
export const SHOPFRONT_REACHED = 0.1

export type RunPhase = 'ready' | 'play' | 'over'

export interface RunGate {
  readonly id: number
  /** What the gate asks: what the word means, or a noun's article (an article gate). */
  readonly kind: RunAnswerKind
  readonly word: RunWord
  /**
   * What the tag says: the meaning in the player's language, or the noun
   * itself (an article gate).
   */
  readonly prompt: string
  /** The suitcases, left to right. At an article gate, the articles in their lanes, and the wall's lane. */
  readonly options: readonly RunWord[]
  readonly correct: number
  /**
   * The lane of the brick wall (an article gate of a two-article course: the
   * middle lane), or -1. Nothing is answered there: Casey in the wall's lane
   * when the gate reaches her is a wrong answer, like a wrong article.
   */
  readonly wall: number
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
 * so it is drawn faint (src/run/draw.ts `drawCafe`).
 *
 * It takes the place of a gate (owner, after build 123: "The cafes, they
 * should replace a gate. And they should be visible also from the distance.
 * [...] So it's a little bit of a breather."): it stands in the first gate
 * slot that is not on the road yet, SPACING behind the last gate or café, and
 * the road goes on SPACING behind it. That slot asks nothing: no words, no
 * answer, no photo, no slip. The words that gate would have asked come later.
 * It comes out of the haze far down the road as a gate does, and moves with
 * the road, so it keeps its slot until it has passed.
 */
export interface RunShopfront {
  readonly id: number
  /** The café's name, as it is written on the shop: a Danish proper name, never translated. */
  readonly name: string
  z: number
  /**
   * Whether the run holds when Casey reaches it ("You found a café", the
   * first session only). It is drawn the same either way: it comes down the
   * road from its slot.
   */
  readonly held: boolean
  /** Casey has reached it (`SHOPFRONT_REACHED`); a café that holds has held by then. */
  reached: boolean
}

export type RunNote =
  | { readonly kind: 'faster'; t: number }
  | { readonly kind: 'slip'; readonly word: RunWord; readonly asked: RunAnswerKind; t: number }

export interface RunState {
  phase: RunPhase
  photos: number
  answered: number
  slips: number
  /** Wrong words this run forgives; the next one ends it. Fixed when the run starts. */
  forgiven: number
  /** Words the run asks in all: the train run's list, 0 on an endless walk. */
  total: number
  /** How many lanes the road has: always 3 (`LANES`); an article gate fills them too. */
  readonly lanes: number
  /** The lane steered to, 0 at the left. */
  lane: number
  /** Where Casey is across the road, easing towards `lane`, in lanes. */
  laneX: number
  gates: RunGate[]
  /** Cafés found on this walk, on the road ahead or passing by. */
  shopfronts: RunShopfront[]
  /**
   * Casey has just reached a café found on the first session's walk: the run
   * holds where it is ("You found a café") until `carryOn`. Nothing moves
   * while it holds, so the speed, the slips and the photos are what they
   * were. The run is still on: leaving now reports it. Between the find and
   * reaching the café the walk goes on as any walk does, and any other walk
   * never holds.
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
  lastMiss: { readonly word: RunWord; readonly picked: RunWord; readonly asked: RunAnswerKind } | null
  endReason: RunEndReason | null
}

export interface RunEvents {
  /** A right answer, the moment Casey passes through it. */
  photo?(word: RunWord): void
  /** A wrong answer. `ended` when it was the second. `asked`: a meaning or an article. */
  miss?(word: RunWord, picked: RunWord, ended: boolean, asked: RunAnswerKind): void
  faster?(tier: number): void
  /**
   * Casey reached a café (`SHOPFRONT_REACHED`) and collects it: once per café,
   * on every walk, before `cafeHeld` when it holds. A café stands a whole
   * gate slot from the gates around it, so this never lands in an answer's step.
   */
  cafeReached?(shop: RunShopfront): void
  /** Casey reached a café that holds the run (the first session's walk): the run now holds. */
  cafeHeld?(shop: RunShopfront): void
  end?(result: RunResult): void
}

export interface RunEngineOptions {
  readonly walk?: RunWalk
  readonly cityIndex: number
  /**
   * The city's run words. A meaning is asked only of words with two possible
   * wrong answers; an article only of nouns whose article has a lane.
   */
  readonly pool: readonly RunWord[]
  /**
   * The lanes of an article gate, left to right, null for the brick wall
   * (src/run/walks.ts `articleGateLanes`): the walk mixes article gates in.
   * Left out (a course without articles, the first session's walk), the walk
   * asks meanings only. The train run never has article gates.
   */
  readonly articleLanes?: readonly (string | null)[] | null
  readonly sink: RunResultsSink
  readonly events?: RunEvents
  readonly rng?: () => number
  readonly now?: () => number
  /**
   * How often a word should come up, before this run's own misses are added.
   * The prototype's weight is 1 + 4 per remembered miss; a rule card can feed
   * remembered misses in here. `kind` says which misses count: a missed
   * article brings a noun back at article gates, a missed meaning at the
   * other gates (src/run/results.ts `tallyMisses` keeps them apart).
   */
  readonly missesBefore?: (word: RunWord, kind: RunAnswerKind) => number
  /**
   * Wrong words forgiven before the run ends. One on the walk; the train
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

/** Lanes on the road: the right word and two wrong ones, or an article gate's articles (and wall). */
export const LANES = 3
/**
 * Every this many gates of a walk, one is an article gate (where the course
 * has them): gates 7, 14, 21... One constant, for the owner to tune (owner,
 * after TestFlight 125: "let's have less articles, maybe every 7"; it was 4).
 */
export const ARTICLE_GATE_EVERY = 7
/**
 * How far an article gate stands behind the gate (or café) in front of it:
 * a longer run-up than SPACING, so the player has more time for it. It was
 * two SPACINGs (an empty gate slot before it); the owner cut that by a third
 * after TestFlight 125 ("Let's cut the distance by 33 percent"): 4/3 SPACING.
 */
export const ARTICLE_RUN_UP = ((2 * 2) / 3) * SPACING
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

/** The lane Casey starts in: the middle of three. */
export const startLane = (lanes: number) => Math.floor((lanes - 1) / 2)

export function createRunEngine(options: RunEngineOptions) {
  const walk = options.walk ?? 'words'
  const rng = options.rng ?? Math.random
  const now = options.now ?? Date.now
  const train = walk === 'train'
  const forgivenNow = (): number => {
    const n = typeof options.forgiven === 'function' ? options.forgiven() : options.forgiven ?? 1
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 1
  }
  const pool = options.pool
  const laneCount = LANES
  const asked = askableWords(pool)
  // Article gates: a walk's, never the train's, and only with a lane per
  // article across the road and more nouns than the road holds.
  const given = options.articleLanes
  const gateLanes = !train && given && given.length === LANES && given.filter((a) => a !== null).length >= 2 ? [...given] : []
  const articleNouns = gateLanes.length ? pool.filter((w) => laneOfArticle(gateLanes, w.article) >= 0) : []
  const articleGates = articleNouns.length > ROAD_GATES
  const articles = articleGates ? gateLanes : []
  const laneWords = articles.map((a) => (a === null ? WALL_LANE : articleLaneWord(a)))
  const wallLane = articles.indexOf(null)
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
  /** Gates this walk has placed, for every ARTICLE_GATE_EVERY-th to be an article gate. */
  let placed = 0

  let gateId = 0
  let shopId = 0
  let startedAt = 0
  /** Per word and kind (`keyOf`): a noun asked both ways has two tallies. */
  let tallies = new Map<string, { wordId: string; kind: RunAnswerKind; origin: RunWord['origin']; photos: number; misses: number }>()
  let misses: RunMiss[] = []
  /** This run's misses, per word and kind as `tallies`. */
  const runMisses = new Map<string, number>()
  const keyOf = (w: RunWord, kind: RunAnswerKind) => `${kind}:${w.id}`

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

  const tally = (w: RunWord, kind: RunAnswerKind) => {
    const key = keyOf(w, kind)
    let t = tallies.get(key)
    if (!t) tallies.set(key, (t = { wordId: w.id, kind, origin: w.origin, photos: 0, misses: 0 }))
    return t
  }

  function pickWord(kind: RunAnswerKind): RunWord {
    if (train) return trainList[spawned++]
    const onRoad = new Set(state.gates.map((g) => g.word.id))
    const candidates = (kind === 'article' ? articleNouns : asked).filter((w) => !onRoad.has(w.id))
    const weights = candidates.map((w) => 1 + 4 * ((options.missesBefore?.(w, kind) ?? 0) + (runMisses.get(keyOf(w, kind)) ?? 0)))
    const total = weights.reduce((a, b) => a + b, 0)
    let r = rng() * total
    for (let i = 0; i < candidates.length; i++) {
      r -= weights[i]
      if (r <= 0) return candidates[i]
    }
    return candidates[candidates.length - 1]
  }

  /** The suitcases of a gate and the right one. Articles never move: each keeps its lane. */
  function optionsFor(word: RunWord, kind: RunAnswerKind): { options: RunWord[]; correct: number } {
    if (kind === 'article') return { options: laneWords, correct: laneOfArticle(articles, word.article) }
    const opts = [word, ...pickWrongAnswers(word, pool, rng, LANES - 1)]
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[opts[i], opts[j]] = [opts[j], opts[i]]
    }
    return { options: opts, correct: opts.indexOf(word) }
  }

  /** Whether the next gate this walk places is an article gate. */
  const nextIsArticle = (): boolean => articleGates && (placed + 1) % ARTICLE_GATE_EVERY === 0

  function spawnGate(z: number, kind: RunAnswerKind): void {
    placed++
    const word = pickWord(kind)
    const { options: opts, correct } = optionsFor(word, kind)
    const gate: RunGate = {
      id: ++gateId,
      kind,
      word,
      prompt: kind === 'article' ? word.target : word.prompt,
      options: opts,
      correct,
      wall: kind === 'article' ? wallLane : -1,
      z,
      reveal: 0,
      resolved: false,
      wrongLane: -1,
    }
    state.gates.push(gate)
    options.onGateSpawned?.(gate)
  }

  /**
   * The furthest slot on the road: the last gate or café, whichever is
   * further. Undefined on an empty road. Both lists are kept in road order.
   */
  function lastSlotZ(): number | undefined {
    const gate = state.gates[state.gates.length - 1]
    const shop = state.shopfronts[state.shopfronts.length - 1]
    if (!gate) return shop?.z
    return shop && shop.z > gate.z ? shop.z : gate.z
  }

  /** Where the next slot goes: SPACING behind the furthest one, or the first gate's place. */
  function nextSlotZ(): number {
    const last = lastSlotZ()
    return last === undefined ? FIRST_GATE : last + SPACING
  }

  /**
   * Fill the road's slots to FAR. An article gate has a longer run-up:
   * it stands ARTICLE_RUN_UP behind the slot in front of it, not SPACING,
   * with nothing in between, so the player has more time for it; the slot
   * after it follows at the usual SPACING. It is placed when a slot of the
   * usual spacing would come into reach, so it waits beyond the haze
   * (undrawn) for the run-up's extra third. A café takes the next free slot
   * as it always does (`findCafe`), a whole SPACING behind whatever is last,
   * out of sight: behind an article gate already placed, or, when an article
   * gate is next, in front of it (the run-up then runs from the café). A
   * café is never inside a run-up and stands at least SPACING from the gates
   * around it, so Casey reaches it (`cafeReached`) in no answer's step.
   */
  function fillRoad(): void {
    for (;;) {
      // The train's list runs out: the road ends at its last word.
      if (train && spawned >= trainList.length) return
      if (nextSlotZ() > FAR && state.gates.length) return
      const kind: RunAnswerKind = nextIsArticle() ? 'article' : 'meaning'
      spawnGate(nextSlotZ() + (kind === 'article' ? ARTICLE_RUN_UP - SPACING : 0), kind)
    }
  }

  const activeGate = (): RunGate | undefined => state.gates.find((g) => !g.resolved)

  function result(end: RunEndReason): RunResult {
    const words: RunWordTally[] = [...tallies.values()].map((t) => ({ ...t }))
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
    placed = 0
    fillRoad()
  }

  function steer(d: -1 | 1): void {
    if (state.phase !== 'play' || state.held) return
    state.lane = Math.max(0, Math.min(laneCount - 1, state.lane + d))
  }

  /**
   * A gate reaches Casey: the lane she is in is her answer. At an article
   * gate of a two-article course the middle lane is a brick wall: she bumps
   * into it, and that is a wrong answer like a wrong article (a slip, or the
   * run's end), shown on the wall as on a wrong suitcase.
   */
  function resolve(g: RunGate): void {
    g.resolved = true
    state.answered++
    const before = state.tier
    const kind = g.kind
    const key = keyOf(g.word, kind)
    if (state.lane === g.correct) {
      state.photos++
      state.flash = 0.35
      tally(g.word, kind).photos++
      const left = runMisses.get(key)
      if (left && left > 1) runMisses.set(key, left - 1)
      else if (left) runMisses.delete(key)
      options.sink.photo({ walk, kind, wordId: g.word.id, origin: g.word.origin, at: now() })
      options.events?.photo?.(g.word)
    } else {
      const picked = g.options[state.lane]
      state.slips++
      g.wrongLane = state.lane
      state.slipFlash = 0.5
      state.lastMiss = { word: g.word, picked, asked: kind }
      tally(g.word, kind).misses++
      runMisses.set(key, (runMisses.get(key) ?? 0) + 1)
      const ended = state.slips > state.forgiven
      // An article miss names the article picked ("et") or the wall; a meaning miss, the word's id.
      const pickedId = kind === 'article' ? (picked.id === WALL_ID ? 'wall' : picked.target) : picked.id
      const miss: RunMiss = { walk, kind, wordId: g.word.id, origin: g.word.origin, pickedId, at: now(), ended }
      misses.push(miss)
      options.sink.miss(miss)
      options.events?.miss?.(g.word, picked, ended, kind)
      if (ended) {
        finish('second-wrong')
        return
      }
      state.note = { kind: 'slip', word: g.word, asked: kind, t: SLIP_NOTE_SECONDS }
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
    for (const shop of state.shopfronts) {
      if (shop.reached || shop.z > SHOPFRONT_REACHED) continue
      shop.reached = true
      options.events?.cafeReached?.(shop)
      if (shop.held && state.phase === 'play' && !state.held) {
        state.held = true
        options.events?.cafeHeld?.(shop)
      }
    }
    state.shopfronts = state.shopfronts.filter((x) => x.z > SHOPFRONT_GONE)
    if (state.phase === 'play') fillRoad()
  }

  /**
   * A café was found by the photo just taken (src/run/sinkSetup.ts
   * `onCafeFound`): one café on the road ahead. With `hold` (the first
   * session's walk, src/run/cafeHold.ts) the run holds when Casey reaches it
   * (`SHOPFRONT_REACHED`, `cafeHeld`) until `carryOn`; until then, and
   * without `hold` throughout, the run carries on and Casey walks through it.
   * Only a walk finds cafés and only while it runs; anything else places
   * nothing and returns null.
   *
   * The café takes the first gate slot that is not on the road yet (owner,
   * after build 123: cafés replace a gate), so it is seen coming from far
   * down the road like a gate. The road fills on behind it from there.
   */
  function findCafe(name: string, hold: boolean): RunShopfront | null {
    if (state.phase !== 'play' || walk !== 'words') return null
    const shop: RunShopfront = { id: ++shopId, name, z: nextSlotZ(), held: hold, reached: false }
    state.shopfronts.push(shop)
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
    /** The words whose meaning this run asks: the pool's words with two possible wrong answers. */
    asked,
    /** The nouns its article gates ask: those whose article has a lane. Empty without article gates. */
    articleNouns: articleNouns as readonly RunWord[],
    walk,
    /** An article gate's lanes, left to right, null for the wall; empty without article gates. */
    articles: articles as readonly (string | null)[],
    /** The train run's words in the order this run asks them; empty on a walk or before a start. */
    trainWords: (): readonly RunWord[] => trainList,
  }
}

export type RunEngine = ReturnType<typeof createRunEngine>
