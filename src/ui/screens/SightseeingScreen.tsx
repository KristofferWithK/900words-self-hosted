import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { feedbackTravelAllowed } from '../../build/audience'
import { cafeNameForBoard } from '../../cafe/cafeName'
import { WORDS } from '../../data/words'
import { UI, UI_LANGUAGE } from '../../i18n'
import { CITIES, cityAt } from '../../journey/cities'
import { cityWords } from '../../journey/cityWords'
import { trainRunsFrom } from '../../journey/trainService'
import { trainSlipsFor } from '../../journey/trainSlips'
import { canStartRun } from '../../purchase/dailyGames'
import { useJourney } from '../../stores/journeyStore'
import { useSrs } from '../../stores/srsStore'
import { devSwitchesAllowed, useUi } from '../../stores/uiStore'
import { Tag } from '../components/Tag'
import { TrainTicket } from '../components/TrainRunPanel'
import { cafeCollectSound, guessErrorBlip } from '../feedback'
import { AUTOPLAY_SECONDS, autoplaysNext, cancelOnHide, startCountdown } from '../runAutoplay'
import { primeSfx } from '../sfx'
import { stopWordAudio, WORD_POOL_LIMITS } from '../speak'
import { useWordPool } from '../useWordPool'
import { primeRunAudio, readyRunWords, sayRunWord, takeGateToReady } from '../../run/audio'
import { holdRunForCafes, type CafeHold } from '../../run/cafeHold'
import { flushRunProgress, warmRunProgress } from '../../run/sinkSetup'
import { createRunPainter, stageSize as fitStage, type RunLabels, type RunPainter } from '../../run/draw'
import { createRunEngine, runIsQuiet, type RunEngine, type RunGate } from '../../run/engine'
import { runResultsSink, type RunAnswerKind, type RunResult, type RunWalk } from '../../run/results'
import { activeArticleGateLanes, runWordsForCity } from '../../run/sources'
import { chosenWalk, takeWalkStartNow } from '../../run/walks'
import type { RunWord } from '../../run/words'
import { diagAnswer, diagHit } from '../diagnostics/recorder'
import { exposeRunForDiag } from '../diagnostics/autoplayGate'

/**
 * SIGHTSEEING: the running game (café world): the walk (CW-05), with article
 * gates mixed in where the course has articles (CW-06; owner, 2026-10-05: the
 * Articles walk merged into the walk), and the train run, Catch the train
 * (CW-07). Which one opens is chosen before the screen does
 * (src/run/walks.ts `chooseWalk`: Home's Sightseeing tag, the train sheet, or
 * the `?sightseeing=` dev switch).
 *
 * The run itself lives in src/run: the engine (rules, no screen), the painter
 * (the prototype's drawing on a canvas) and the one results interface the
 * rule cards plug into. This screen is the shell around them: the canvas at
 * device resolution, the frame loop, touch and keys, pausing when the app is
 * hidden, reduced motion, and the panels before, between and after runs.
 * A walk chosen on Home starts at once, without the ready panel; a lost
 * walk's end panel starts the next one after a short count
 * (src/ui/runAutoplay.ts).
 *
 * A photo that finds a café (any right answer of the walk) puts the café, with
 * its name, on the road ahead in the place of a gate not yet in sight, and
 * Casey walks through it (src/run/cafeHold.ts, engine.ts `findCafe`).
 * Only the first session's walk (`firstWalk`, onboarding) holds the run on the
 * "You found a café" panel (`cafe`), from the moment Casey reaches the café
 * until the player keeps walking; held,
 * nothing moves, so the speed, the slips and the photos carry on as they
 * were. Every other walk keeps walking, and its run-end panel says which
 * cafés it found (owner, 2026-10-04).
 *
 * The canvas fills the screen down to its bottom edge (option C, "taller
 * scene"): on a phone taller than the prototype's 480 x 800 frame the scene
 * grows taller, with more sky and more road (src/run/draw.ts `runFrame`). The
 * road runs on under the home indicator; Casey and the pause button keep clear
 * of it (env(safe-area-inset-bottom), measured by `.run-safe-bottom`). A screen
 * wider than the frame's shape letterboxes sideways.
 */

/**
 * `caught`: the train run answered every word ("You caught the train", the
 * ticket). `soon`: after it, while the next city is not released ("Ribe
 * opens soon", owner O3).
 */
type Panel = 'ready' | 'play' | 'paused' | 'cafe' | 'over' | 'caught' | 'soon'

const BEST_KEY = 'cluecab-sightseeing-best'
/** Forgiven wrong words on the walk (contract §2). The train run's come from its slips. */
const FORGIVEN = 1
/** A pointer that moves this far (CSS px) sideways is a swipe; less is a tap on a half. */
const SWIPE_PX = 24
/** The right word is said after a wrong one, a moment after the blip (prototype: 450 ms). */
const SAY_AFTER_MISS_MS = 450

/**
 * The walk's one best photo count, from what is stored under BEST_KEY:
 * `{ words: n }`. A save from the time of two walks also holds `articles`, the
 * Articles walk's own best: the higher of the two is the best now (owner,
 * 2026-10-05: one walk), and the next best written drops the old field.
 * Anything unreadable is no best.
 */
export function readWalkBest(raw: string | null): number {
  try {
    const all: unknown = JSON.parse(raw ?? '{}')
    if (!all || typeof all !== 'object') return 0
    const bests = ['words', 'articles'].map((k) => Number((all as Record<string, unknown>)[k] ?? 0))
    return Math.max(0, ...bests.map((n) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0)))
  } catch {
    return 0
  }
}

function readBest(): number {
  try {
    return readWalkBest(localStorage.getItem(BEST_KEY))
  } catch {
    return 0
  }
}

function writeBest(n: number): void {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify({ words: n }))
  } catch {
    // No storage: the best simply is not kept.
  }
}

/** The train run's slips now: one plus one per 20 of the city's words collected (journey/trainSlips.ts). */
function trainSlipsNow(cityIndex: number): number {
  return trainSlipsFor(cityWords(WORDS, cityIndex), useSrs.getState().stats, useJourney.getState().photos ?? {})
}

/**
 * `?trainwords=N` (local hosts only): the train run asks only N of its words,
 * so a screenshot can reach "You caught the train" without 147 gates. Never
 * honoured outside the dev switches, so a player's run is always every word.
 */
function devTrainLimit(): number | undefined {
  if (!devSwitchesAllowed()) return undefined
  const raw = new URLSearchParams(window.location.search).get('trainwords')
  return raw && /^\d{1,3}$/.test(raw) && Number(raw) > 0 ? Number(raw) : undefined
}

/** A noun with its article, as it is said: «et hus», «die Milch». */
const withArticle = (w: RunWord) => (w.article ? `${w.article} ${w.target}` : w.target)
/** A word's answer as the gate that asked it shows it: with its article at an article gate. */
const answerOf = (w: RunWord, asked: RunAnswerKind) => (asked === 'article' ? withArticle(w) : w.target)

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

const upper = (s: string) => s.toLocaleUpperCase(UI_LANGUAGE)

/**
 * `?auto` (local hosts only, like the prototype's switch of the same name):
 * Casey steers herself into every right answer, so a probe can take
 * screenshots and measure frame time at every speed without playing.
 * `?auto=N` steers right for N photos and wrong after them, so a probe can
 * reach the run's end panel. Null when off.
 */
function autoSteer(): number | null {
  if (!devSwitchesAllowed()) return null
  const raw = new URLSearchParams(window.location.search).get('auto')
  if (raw === null) return null
  return /^\d{1,3}$/.test(raw) ? Number(raw) : Infinity
}

interface Ending {
  readonly result: RunResult
  /** The cafés this walk found, in order: each one's own name, or null for a café without one. */
  readonly cafes: readonly (string | null)[]
  readonly lastMiss: { readonly word: RunWord; readonly picked: RunWord; readonly asked: RunAnswerKind } | null
  /** The words missed on this run, each once per kind it was asked (meaning or article). */
  readonly missed: readonly { readonly word: RunWord; readonly asked: RunAnswerKind }[]
  readonly best: number
  readonly newBest: boolean
}

/**
 * The first walk of the first session (CW-13, contract section 7 step 4):
 * the Words walk, started at once when Casey's "Let's go" was the tap that
 * opened it (`startNow`; a reload resumes on the ready panel instead, so a
 * reload never spends a run by itself). Its Home goes where onboarding goes
 * next, its end panel says what Home holds, and Skip ends the first session.
 * Nothing in the run's rules changes: no extra forgiveness on this walk.
 */
export interface FirstWalk {
  readonly startNow: boolean
  /** A café this walk found, or one found before it: the end panel says so. */
  readonly cafeFound: () => boolean
  readonly onHome: () => void
  readonly onSkip: () => void
}

/**
 * On the run-end panel of a walk that found cafés without stopping: "Café
 * found: Café Solen" for one café with a name of its own, otherwise "Cafés
 * found: 2". Nothing when the walk found none. The first session's walk says
 * it its own way (its walk-end line), after its find held the run.
 */
export function RunCafesFound({ cafes }: { cafes: readonly (string | null)[] }) {
  if (!cafes.length) return null
  return <p className="run-line run-cafes-found">{UI.sightseeing.cafesFound(cafes.length, cafes.length === 1 ? cafes[0] : null)}</p>
}

/**
 * The recordings a gate needs readied when it is placed: its own word, the
 * only one the run ever says (a photo, or the right word after a miss).
 */
export function gateRecordings(gate: Pick<RunGate, 'word'>): RunWord[] {
  return [gate.word]
}

/**
 * "More sightseeing" on the run-end panel. While the next walk counts down to
 * starting by itself (src/ui/runAutoplay.ts), the tag fills from its hole end
 * over the seconds, with no number (owner's choice, option D). With reduced
 * motion it does not fill and reads as it always does.
 */
export function SightseeingAgainTag({ counting, primary, autoFocus, onClick }: { counting: boolean; primary: boolean; autoFocus: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`run-tag-btn run-again${primary ? ' run-tag-btn-primary' : ''}${counting ? ' run-again-counting' : ''}`}
      onClick={onClick}
      autoFocus={autoFocus}
    >
      {counting && <span className="run-again-fill" aria-hidden="true" style={{ animationDuration: `${AUTOPLAY_SECONDS}s` }} />}
      {UI.sightseeing.sightseeingAgain}
    </button>
  )
}

export function SightseeingScreen({ firstWalk }: { firstWalk?: FirstWalk } = {}) {
  // The words of the gates on the road, and nothing once the walk is left (speak.ts, `claimWordPool`).
  useWordPool('sightseeing', WORD_POOL_LIMITS.sightseeing)
  const goTo = useUi((s) => s.goTo)
  const cityIndex = useJourney((s) => s.cityIndex)
  const t = UI.sightseeing

  // The first session's walk is always the walk (contract section 7).
  const [walk] = useState<RunWalk>(() => (!firstWalk && chosenWalk() === 'train' ? 'train' : 'words'))
  // A walk chosen on Home starts as the screen opens, without the ready panel
  // (`chooseWalk`'s startNow); the first walk says so itself.
  const [chosenStartsNow] = useState(() => !firstWalk && takeWalkStartNow())
  const train = walk === 'train'
  // Article gates: the walk's, where the course has them. Never on the first
  // session's walk (it stays as onboarding made it) or the train run.
  const [lanes] = useState(() => (firstWalk || train ? null : activeArticleGateLanes()))
  const articleChoices = useMemo(() => (lanes ?? []).filter((a): a is string => a !== null), [lanes])
  const here = cityAt(cityIndex).name
  const next = cityIndex + 1 < CITIES.length ? cityAt(cityIndex + 1).name : null
  const words = useMemo(() => runWordsForCity(cityIndex), [cityIndex])

  const screenRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const safeRef = useRef<HTMLDivElement>(null)
  /** CSS px of the stage under the home indicator. */
  const safeBottomRef = useRef(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const painterRef = useRef<RunPainter | null>(null)
  const panelRef = useRef<Panel>('ready')
  const bestRef = useRef(readBest())
  const reducedRef = useRef(prefersReducedMotion())
  const missTimer = useRef<number | undefined>(undefined)
  const announcedGate = useRef(0)
  const autoRef = useRef(autoSteer())
  /** The cafés found since the run started, for its end panel. */
  const cafesRef = useRef<(string | null)[]>([])
  /** The first walk's finds still ahead on the road, by café: the panel opens as Casey reaches one. */
  const heldFinds = useRef(new Map<number, CafeHold>())
  /**
   * The gates placed on the road whose recordings are still to be readied,
   * one gate per frame while the run is quiet (`runIsQuiet`): readying loads
   * media elements, and that work does not belong in the frames around an
   * answer. Only the current gate and the next two are readied
   * (`takeGateToReady`); a gate already passed is dropped.
   */
  const toReady = useRef<RunGate[]>([])
  /** The run's clock at its last answer. */
  const lastAnswer = useRef({ answered: 0, at: -Infinity })

  const [panel, setPanelState] = useState<Panel>('ready')
  const [ending, setEnding] = useState<Ending | null>(null)
  const [cafeFound, setCafeFound] = useState<CafeHold | null>(null)
  /** Seconds before the next walk starts by itself, on a lost walk's end panel; null when nothing counts. */
  const [autoLeft, setAutoLeft] = useState<number | null>(null)
  const cancelAutoplayRef = useRef<() => void>(() => {})
  /**
   * The gate read out to a screen reader, written straight into its live
   * region: a React state here re-rendered the whole screen at every gate,
   * right after each answer.
   */
  const announceRef = useRef<HTMLParagraphElement>(null)
  const [stageSize, setStageSize] = useState<{ w: number; h: number } | null>(null)

  const setPanel = useCallback((p: Panel) => {
    panelRef.current = p
    if (p !== 'play' && announceRef.current) announceRef.current.textContent = ''
    setPanelState(p)
  }, [])

  const engineRef = useRef<RunEngine | null>(null)
  if (!engineRef.current) {
    const missed: { word: RunWord; asked: RunAnswerKind }[] = []
    engineRef.current = createRunEngine({
      walk,
      cityIndex,
      pool: words,
      articleLanes: lanes,
      sink: runResultsSink(),
      forgiven: walk === 'train' ? () => trainSlipsNow(cityIndex) : FORGIVEN,
      ...(walk === 'train' ? { trainLimit: devTrainLimit() } : {}),
      // Only the gate's own word is ever said (a photo, or the right word after
      // a miss), so only it is readied: readying the two wrong words too made
      // three media elements a gate, two of them never played, and pushed the
      // board's warm words out of the word player's pool (long sessions,
      // build 123). An article gate's articles are not recordings either.
      onGateSpawned: (gate) => void toReady.current.push(gate),
      events: {
        photo: (word) => (diagAnswer(true, engineRef.current), sayRunWord(word)),
        // Casey walks through a café on the road: it is collected, with its sound.
        cafeReached: () => cafeCollectSound(),
        // The first walk holds as Casey reaches the café it found: "You found a café".
        cafeHeld: (shop) => {
          const find = heldFinds.current.get(shop.id) ?? { name: shop.name, shop, held: true }
          heldFinds.current.delete(shop.id)
          setCafeFound(find)
          setPanel('cafe')
        },
        miss: (word, _picked, _ended, asked) => {
          diagHit(asked === 'article' ? 'article-wrong' : 'answer-wrong')
          missed.push({ word, asked })
          guessErrorBlip()
          window.clearTimeout(missTimer.current)
          missTimer.current = window.setTimeout(() => sayRunWord(word), SAY_AFTER_MISS_MS)
        },
        end: (result) => {
          const engine = engineRef.current
          if (!engine || result.end === 'left') return
          if (walk === 'train') {
            // The ticket itself is stored by the results sink (sinkSetup.ts);
            // this screen only shows the run's end.
            setEnding({
              result,
              cafes: [],
              lastMiss: result.end === 'caught' ? null : engine.state.lastMiss,
              missed: [],
              best: 0,
              newBest: false,
            })
            missed.length = 0
            setPanel(result.end === 'caught' ? 'caught' : 'over')
            return
          }
          const previous = bestRef.current
          const newBest = result.photos > previous
          if (newBest) {
            bestRef.current = result.photos
            writeBest(result.photos)
          }
          setEnding({
            result,
            cafes: [...cafesRef.current],
            lastMiss: engine.state.lastMiss,
            missed: [...new Map(missed.map((m) => [`${m.asked}:${m.word.id}`, m])).values()],
            best: bestRef.current,
            newBest,
          })
          missed.length = 0
          setPanel('over')
        },
      },
    })
  }
  const engine = engineRef.current
  exposeRunForDiag(engine) // performance log's soak player; nothing unless seeded
  // `?auto` (local hosts only): a probe reads where the run is, to take its
  // screenshots at the right moment (a café ahead, at Casey, behind her).
  if (autoRef.current !== null && typeof window !== 'undefined') (window as unknown as { __runState?: unknown }).__runState = engine.state

  const labels: RunLabels = useMemo(
    () => ({
      // The train run counts words answered and words to go, not photos and a best.
      photos: upper(train ? t.wordsLabel : t.photosLabel),
      best: upper(train ? t.toGoLabel : t.bestLabel),
      ask: upper(t.askLabel),
      // An article gate: "EN OR ET?  ·  house", as in the prototype's Article Crossroads.
      ...(articleChoices.length >= 2
        ? {
            articleAsk: upper(t.articleAsk(articleChoices.slice(0, -1).join(', '), articleChoices[articleChoices.length - 1])),
            askDetail: (gate: { word: RunWord }) => gate.word.prompt,
          }
        : {}),
      slipsLeft: t.slipsLeft,
      faster: t.faster,
      slipNote: (w: RunWord, asked: RunAnswerKind) => (asked === 'article' ? withArticle(w) : t.pair(w.prompt, w.target)),
    }),
    [t, articleChoices, train],
  )

  // ── the stage: the screen's full height, the prototype's width at most ─────
  useLayoutEffect(() => {
    const screen = screenRef.current
    if (!screen) return
    const measure = () => {
      const r = screen.getBoundingClientRect()
      const inset = safeRef.current?.getBoundingClientRect().height ?? 0
      safeBottomRef.current = inset
      setStageSize(fitStage(r.width, r.height, inset))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(screen)
    return () => ro.disconnect()
  }, [])

  // ── the frame loop ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const painter = createRunPainter(canvas)
    painterRef.current = painter
    let raf = 0
    let prev = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - prev) / 1000))
      prev = now
      // A paused or café-held run stands still; on the other panels only Casey's own clock moves.
      if (panelRef.current !== 'paused' && panelRef.current !== 'cafe') engine.step(dt)
      const st = engine.state
      if (st.answered !== lastAnswer.current.answered) lastAnswer.current = { answered: st.answered, at: st.clock }
      if (toReady.current.length && runIsQuiet(st, st.clock - lastAnswer.current.at)) {
        const gate = takeGateToReady(toReady.current, st.gates)
        if (gate) readyRunWords(gateRecordings(gate))
      }
      // Read after the step: a photo in it may have found a café and held the
      // run, and a held run does not steer (the loops below would never end).
      const playing = panelRef.current === 'play' && !engine.state.held
      const active = engine.activeGate()
      if (playing && autoRef.current !== null && active) {
        const want = engine.state.photos < autoRef.current ? active.correct : (active.correct + 1) % active.options.length
        while (engine.state.lane < want) engine.steer(1)
        while (engine.state.lane > want) engine.steer(-1)
      }
      if (playing && active && active.reveal > 0 && announcedGate.current !== active.id) {
        announcedGate.current = active.id
        // The wall's lane says nothing: only the articles are read out.
        const choices = active.options.filter((o) => o.target).map((o) => o.target).join(', ')
        if (announceRef.current) announceRef.current.textContent = active.kind === 'article' ? t.articleGateAria(active.prompt, choices) : t.gateAria(active.prompt, choices)
      }
      painterRef.current?.draw(engine.state, {
        labels,
        best: bestRef.current,
        forgiven: engine.state.forgiven,
        running: playing,
        reducedMotion: reducedRef.current,
        safeBottom: safeBottomRef.current,
      })
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      // The word pictures and the canvas give their pixels back now, not at
      // the next collection: a phone keeps paying for them until then.
      if (painterRef.current === painter) painterRef.current = null
      painter.dispose()
    }
  }, [engine, labels, t])

  // ── reduced motion, followed live ─────────────────────────────────────────
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const on = () => {
      reducedRef.current = mq.matches
    }
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])

  // ── backgrounding: a hidden app pauses the run, and never resumes by itself
  useEffect(() => {
    const hide = () => {
      if (document.visibilityState === 'hidden' && panelRef.current === 'play') {
        stopWordAudio()
        setPanel('paused')
      }
    }
    const pagehide = () => {
      if (panelRef.current === 'play') setPanel('paused')
    }
    document.addEventListener('visibilitychange', hide)
    window.addEventListener('pagehide', pagehide)
    return () => {
      document.removeEventListener('visibilitychange', hide)
      window.removeEventListener('pagehide', pagehide)
    }
  }, [setPanel])

  // ── the slow first-time work of the deferred writes, done while the ready
  // panel shows rather than in the frame of the first answer ───────────────
  useEffect(() => {
    const id = window.setTimeout(warmRunProgress, 60)
    return () => window.clearTimeout(id)
  }, [])

  // ── a café found: it stands on the road; only the first session's walk
  // holds the run on a panel, every other walk keeps walking ───────────────
  const holdOnFind = !!firstWalk
  useEffect(
    () =>
      holdRunForCafes(
        engine,
        (cafe) => cafeNameForBoard(cafe.board),
        t.cafeSign,
        holdOnFind,
        (find) => {
          cafesRef.current.push(find.name)
          // The panel waits until Casey reaches the café (engine.ts `cafeHeld`).
          if (find.held) heldFinds.current.set(find.shop.id, find)
        },
        // Found by one of the run's last answers, written as it ended: no road
        // to stand on any more, but the run-end panel still names it.
        (name) => cafesRef.current.push(name),
      ),
    [engine, t, setPanel, holdOnFind],
  )

  // ── leaving the screen mid-run reports a run that ended by leaving ────────
  useEffect(
    () => () => {
      window.clearTimeout(missTimer.current)
      engine.leave()
      stopWordAudio()
    },
    [engine],
  )

  const start = useCallback(() => {
    // A run counts against the daily two at its first answer (O6), so it may
    // only begin while one is left (purchase/dailyGames.ts canStartRun).
    if (!canStartRun()) {
      useUi.getState().openDailyLimit()
      return
    }
    // Inside the tap: unlock the word player and the blip for the sounds the
    // run will make later from its own frame loop.
    primeRunAudio()
    primeSfx()
    announcedGate.current = 0
    cafesRef.current = []
    heldFinds.current.clear()
    toReady.current = []
    lastAnswer.current = { answered: 0, at: -Infinity }
    setEnding(null)
    engine.start()
    setPanel('play')
  }, [engine, setPanel])

  const pause = useCallback(() => {
    if (panelRef.current !== 'play') return
    stopWordAudio()
    setPanel('paused')
    // The answers' progress is written now: a paused run may be closed.
    flushRunProgress()
  }, [setPanel])

  const resume = useCallback(() => {
    primeRunAudio()
    primeSfx()
    setPanel('play')
  }, [setPanel])

  /** From "You found a café": the run moves on from where it held. */
  const keepWalking = useCallback(() => {
    primeRunAudio()
    primeSfx()
    engine.carryOn()
    setCafeFound(null)
    setPanel('play')
  }, [engine, setPanel])

  // ── a lost walk's end panel starts the next walk by itself after a few
  // seconds (src/ui/runAutoplay.ts), unless anything stops it first: a tap or
  // key on the panel, the panel or the screen going away, the app hidden ───
  const isFirstWalk = !!firstWalk
  useEffect(() => {
    if (panel !== 'over' || !ending) return
    if (!autoplaysNext({ walk, firstWalk: isFirstWalk, end: ending.result.end, canStart: canStartRun() })) return
    const countdown = startCountdown(AUTOPLAY_SECONDS, setAutoLeft, () => {
      stop()
      start()
    })
    let stopListening = () => {}
    const stop = () => {
      countdown.cancel()
      stopListening()
      window.removeEventListener('keydown', stop, true)
      setAutoLeft(null)
    }
    stopListening = cancelOnHide(stop)
    window.addEventListener('keydown', stop, true)
    cancelAutoplayRef.current = stop
    return () => {
      cancelAutoplayRef.current = () => {}
      stop()
    }
  }, [panel, ending, walk, isFirstWalk, start])

  const onFirstWalkHome = firstWalk?.onHome
  const home = useCallback(() => (onFirstWalkHome ? onFirstWalkHome() : goTo('home')), [goTo, onFirstWalkHome])

  // The first walk starts at once: Casey's "Let's go" was the tap that primed
  // the run's audio (OnboardingScreen). So does a walk chosen on Home, whose
  // tap primed it (HomeScreen `startHomeWalk`). Once per mount, StrictMode included.
  const startedNow = useRef(false)
  const startNow = firstWalk ? !!firstWalk.startNow : chosenStartsNow
  // A layout effect, so the ready panel is never painted under a walk that starts at once.
  useLayoutEffect(() => {
    if (!startNow || startedNow.current) return
    startedNow.current = true
    if (canStartRun()) start()
  }, [startNow, start])
  // In the first session the daily limit's offer cannot open over the flow,
  // so a walk that cannot start is not offered (its panel offers Home).
  const mayWalk = !firstWalk || canStartRun()
  // After the first walk found its café, Home (where it is played) leads.
  const homeFirst = !!firstWalk && (!mayWalk || (panel === 'over' && firstWalk.cafeFound()))

  /**
   * From the ticket: "Ribe opens soon" while the line out of this city is
   * closed to this build (owner O3). A feedback build that may ride on goes
   * straight home, where the train is the board button. Nothing here opens a
   * city: boarding is Home's and the map's, behind `journeyTravelGate`.
   */
  const afterTicket = useCallback(() => {
    if (next !== null && !trainRunsFrom(cityIndex, { bypass: feedbackTravelAllowed() })) setPanel('soon')
    else goTo('home')
  }, [next, cityIndex, goTo, setPanel])

  // ── keys: arrows or A/D steer; Escape pauses ──────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (panelRef.current !== 'play') return
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        engine.steer(-1)
        e.preventDefault()
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        engine.steer(1)
        e.preventDefault()
      } else if (e.key === 'Escape') {
        pause()
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [engine, pause])

  // ── touch: a swipe steers its way; a tap steers towards its half ──────────
  const downX = useRef<number | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    if (panelRef.current !== 'play') return
    downX.current = e.clientX
  }
  const onPointerUp = (e: React.PointerEvent) => {
    if (panelRef.current !== 'play' || downX.current == null) return
    const dx = e.clientX - downX.current
    downX.current = null
    const r = stageRef.current?.getBoundingClientRect()
    if (Math.abs(dx) > SWIPE_PX) engine.steer(dx > 0 ? 1 : -1)
    else if (r) engine.steer(e.clientX < r.left + r.width / 2 ? -1 : 1)
  }

  return (
    <div className="run-screen" ref={screenRef} aria-label={train ? t.trainTitle : t.title}>
      <div className="run-safe-bottom" ref={safeRef} aria-hidden="true" />
      <div
        className="run-stage"
        ref={stageRef}
        style={stageSize ? { width: stageSize.w, height: stageSize.h } : undefined}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (downX.current = null)}
      >
        <canvas className="run-canvas" ref={canvasRef} aria-hidden="true" />
        {panel === 'play' && (
          <button
            type="button"
            className="icon-btn run-pause"
            aria-label={t.pauseAria}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={pause}
          >
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
              <rect x="5" y="4" width="3.4" height="12" rx="1" fill="currentColor" />
              <rect x="11.6" y="4" width="3.4" height="12" rx="1" fill="currentColor" />
            </svg>
          </button>
        )}
        {panel !== 'play' && (
          // Any tap on a panel stops the count to the next walk.
          <div className="run-scrim" onPointerDownCapture={() => cancelAutoplayRef.current()}>
            <section className="run-tag run-panel" aria-live="polite">
              <span className="run-tag-hole" aria-hidden="true" />
              <svg className="run-tag-string" viewBox="0 0 120 120" aria-hidden="true">
                <path d="M60 103 C24 62 104 12 80 -40" />
              </svg>
              {panel === 'ready' && train && (
                <>
                  <h1 className="run-title">{t.trainTitle}</h1>
                  {next && <p className="run-sub">{t.trainRoute(here, next)}</p>}
                  <p className="run-line run-hint">{t.trainCount(engine.state.total || engine.asked.length, engine.state.forgiven)}</p>
                  <p className="run-line dim">{t.trainRule}</p>
                  <p className="run-line run-hint">{t.steerHint}</p>
                  <div className="run-actions">
                    <button type="button" className="run-tag-btn run-tag-btn-primary" onClick={start} autoFocus>
                      {t.trainStart}
                    </button>
                    <button type="button" className="run-tag-btn run-home" onClick={home}>
                      {UI.game.home}
                    </button>
                  </div>
                </>
              )}
              {panel === 'ready' && !train && (
                <>
                  <h1 className="run-title">{t.title}</h1>
                  <p className="run-line dim">{t.rules}</p>
                  <p className="run-line run-hint">{t.steerHint}</p>
                  <div className="run-actions">
                    {mayWalk && (
                      <button type="button" className="run-tag-btn run-tag-btn-primary" onClick={start} autoFocus>
                        {t.start}
                      </button>
                    )}
                    <button type="button" className="run-tag-btn run-home" onClick={home}>
                      {UI.game.home}
                    </button>
                    {firstWalk && <Tag className="onboard-skip run-first-skip" label={UI.onboarding.skip} onClick={firstWalk.onSkip} />}
                  </div>
                </>
              )}
              {panel === 'paused' && (
                <>
                  <h1 className="run-title">{t.paused}</h1>
                  <p className="run-sub">{t.photosTotal(engine.state.photos)}</p>
                  <div className="run-actions">
                    <button type="button" className="run-tag-btn run-tag-btn-primary" onClick={resume} autoFocus>
                      {t.resume}
                    </button>
                    <button type="button" className="run-tag-btn run-home" onClick={home}>
                      {UI.game.home}
                    </button>
                    {firstWalk && <Tag className="onboard-skip run-first-skip" label={UI.onboarding.skip} onClick={firstWalk.onSkip} />}
                  </div>
                </>
              )}
              {panel === 'cafe' && cafeFound && (
                <div className="run-cafe">
                  <h1 className="run-title">{t.cafeFoundTitle}</h1>
                  {cafeFound.name && (
                    <p className="run-cafe-name" lang="da">
                      {cafeFound.name}
                    </p>
                  )}
                  <p className="run-line">{t.cafeFoundLater}</p>
                  <div className="run-actions">
                    <Tag size="wide" tone="primary" className="run-cafe-go" label={t.resume} onClick={keepWalking} autoFocus />
                  </div>
                </div>
              )}
              {panel === 'caught' && ending && (
                <>
                  <h1 className="run-title run-title-caught">{t.caughtTitle}</h1>
                  {next && (
                    <TrainTicket from={here} to={next} ticket={{ at: ending.result.endedAt, words: ending.result.answered }} />
                  )}
                  <p className="run-line">{t.caughtSummary(ending.result.answered, ending.result.misses.length)}</p>
                  <div className="run-actions">
                    <button type="button" className="run-tag-btn run-tag-btn-primary" onClick={afterTicket} autoFocus>
                      {t.next}
                    </button>
                  </div>
                </>
              )}
              {panel === 'soon' && next && (
                <>
                  <h1 className="run-title">{t.opensSoonTitle(next)}</h1>
                  <p className="run-line">{t.opensSoonBody(next)}</p>
                  <div className="run-actions">
                    <button type="button" className="run-tag-btn run-tag-btn-primary run-home" onClick={home} autoFocus>
                      {UI.game.home}
                    </button>
                  </div>
                </>
              )}
              {panel === 'over' && ending && train && (
                <>
                  <h1 className="run-title run-title-wrong">{t.trainMissed}</h1>
                  {ending.lastMiss && (
                    <>
                      <p className="run-answer">{t.pair(ending.lastMiss.word.prompt, ending.lastMiss.word.target)}</p>
                      <p className="run-line dim">{t.youPicked(ending.lastMiss.picked.target, ending.lastMiss.picked.prompt)}</p>
                    </>
                  )}
                  <p className="run-total">{t.trainProgress(ending.result.answered, ending.result.total)}</p>
                  <p className="run-line dim">{t.trainRule}</p>
                  <div className="run-actions">
                    <button type="button" className="run-tag-btn run-tag-btn-primary" onClick={start} autoFocus>
                      {t.trainAgain}
                    </button>
                    <button type="button" className="run-tag-btn run-home" onClick={home}>
                      {UI.game.home}
                    </button>
                  </div>
                </>
              )}
              {panel === 'over' && ending && !train && (
                <>
                  <h1 className="run-title run-title-wrong">{ending.lastMiss?.asked === 'article' ? t.wrongArticle : t.wrongWord}</h1>
                  {ending.lastMiss && ending.lastMiss.asked === 'article' && (
                    <>
                      <p className="run-answer">{withArticle(ending.lastMiss.word)}</p>
                      <p className="run-line dim">{t.pair(ending.lastMiss.word.target, ending.lastMiss.word.prompt)}</p>
                    </>
                  )}
                  {ending.lastMiss && ending.lastMiss.asked !== 'article' && (
                    <>
                      <p className="run-answer">{t.pair(ending.lastMiss.word.prompt, ending.lastMiss.word.target)}</p>
                      <p className="run-line dim">{t.youPicked(ending.lastMiss.picked.target, ending.lastMiss.picked.prompt)}</p>
                    </>
                  )}
                  <p className="run-total">
                    {t.photosTotal(ending.result.photos)}
                    <span aria-hidden="true">{'  ·  '}</span>
                    {t.bestTotal(ending.best)}
                  </p>
                  {ending.newBest && <p className="run-new-best">{t.newBest}</p>}
                  {!firstWalk && <RunCafesFound cafes={ending.cafes} />}
                  {firstWalk && (
                    <p className="run-line run-first-end">{firstWalk.cafeFound() ? UI.onboarding.walkEndFound : UI.onboarding.walkEndNotFound}</p>
                  )}
                  {ending.missed.length > 0 && (
                    <div className="run-missed">
                      <p className="run-line dim">{t.comingBack}</p>
                      <ul>
                        {ending.missed.map(({ word: w, asked }) => (
                          <li key={`${asked}:${w.id}`}>{t.pair(w.prompt, answerOf(w, asked))}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="run-actions">
                    {mayWalk && <SightseeingAgainTag counting={autoLeft !== null} primary={!homeFirst} autoFocus={!homeFirst} onClick={start} />}
                    <button type="button" className={`run-tag-btn run-home${homeFirst ? ' run-tag-btn-primary' : ''}`} onClick={home} autoFocus={homeFirst}>
                      {UI.game.home}
                    </button>
                    {firstWalk && <Tag className="onboard-skip run-first-skip" label={UI.onboarding.skip} onClick={firstWalk.onSkip} />}
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>
      <p className="visually-hidden" aria-live="polite" ref={announceRef} />
    </div>
  )
}
