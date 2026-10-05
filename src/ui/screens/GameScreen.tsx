import { isWebDemo } from '../../build/audience'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { cafeForBoard } from '../../cafe/cafeName'
import { cafeArrangement } from '../../cafe/cafeTable'
import { currentClue } from '../../engine/game'
import type { GameState, Side } from '../../engine/types'
import { UI } from '../../i18n'
import { onPracticeCompanion, rerollOpen, useGame } from '../../stores/gameStore'
import { useSettings } from '../../stores/settingsStore'
import { onDeviceCaseyAvailable, playsOnDevice } from '../../ai/gemma/gate'
import { gemmaStatus } from '../../ai/gemma/native'
import { setOfflineCaseyWanted } from '../../ai/gemma/residency'
import { useUi } from '../../stores/uiStore'
import { useCaseyBackOnline } from '../caseyBackOnline'
import { AiTurnPanel } from '../components/AiTurnPanel'
import { BoardGrid, playerKeyHidden, wheelBoardActive } from '../components/BoardGrid'
import { CafeNameTag, CafeTable } from '../components/CafeTable'
import { ClueInput } from '../components/ClueInput'
import { useOpenDictionary } from '../components/DictionarySheet'
import { LeaveGameDialog } from '../components/LeaveGameDialog'
import { OnlineAgainDialog } from '../components/OnlineAgainDialog'
import { RoundGuidanceDialog } from '../components/RoundGuidanceDialog'
import { RoundSummary } from '../components/RoundSummary'
import { Tag } from '../components/Tag'
import { TurnTakeover } from '../components/TurnTakeover'
import { useDictionary } from '../components/TranslateBox'
import { TranslateChallengeBar } from '../components/TranslateChallengeBar'
import { TurnTokens } from '../components/TurnTokens'
import {
  IntroGameTour,
  TutorialCaseyBand,
  TutorialFinish,
  TranslationTour,
  WheelReadyTour,
  tutorialOpeningGuess,
} from '../components/TutorialPractice'
import { introGameTourDue, translationLessonDue, translationLessonHoldsGuidance, wheelLessonDue } from '../../onboarding/tutorial'
import type { OnboardLessonStatus } from '../../onboarding/flow'
import { firstFoundCafe } from '../../onboarding/firstCafe'
import { HINT_KEYS, useFirstTimeHint } from '../hints'

const PHASE_CAPTION: Record<GameState['phase'], string> = {
  playerClueInput: UI.game.phaseGiveClue,
  aiGuessing: UI.game.phaseCaseyGuessing,
  aiClueInput: UI.game.phaseCaseyClue,
  playerGuessing: UI.game.phaseYourGuess,
  suddenDeath: UI.game.phaseLastChance,
  translateChallenge: UI.game.phaseTranslateChallenge,
  translateWheel: UI.game.phaseTranslateWheel,
  finished: UI.game.phaseRoundOver,
}

/**
 * Whether a move from phase `from`'s giver to phase `to`'s giver is a turn
 * handover. The pure rule the effect below applies: both phases must HAVE a
 * giver and the giver must have flipped. Round start (null → 'ai'), sudden
 * death (any → null) and the round's end (any → null) are not handovers; a
 * SUBMIT_CLUE's micro-transition ('player' → 'player') is not one either.
 */
export function isTurnHandover(from: GameState['phase'], to: GameState['phase']): boolean {
  const before = takeoverSideOf(from)
  const after = takeoverSideOf(to)
  return before !== null && after !== null && before !== after
}

/** Retired attempts must leave the game surface rather than becoming a normal board. */
export function mustRetireRoundMode(mode: string): boolean {
  return mode === 'wrapup'
}

/**
 * Whose turn a phase is putting on the dock — the clue-giver where a phase
 * has one, and `undefined` where none does (sudden death, round over, study
 * and the wrap-up's packing). The takeover fires when THIS value changes
 * between two defined values, which is what makes it a turn handover rather
 * than a phase change: a clue of one, sudden death's opening and a turn that
 * ends in the round's end all cross phases without ever flipping the giver.
 *
 * `aiGuessing` maps to 'player' because the PLAYER is the giver there (the
 * guesses are judged against their key); `playerGuessing` to 'ai', hers.
 */
export function takeoverSideOf(phase: GameState['phase']): Side | null {
  switch (phase) {
    case 'playerClueInput':
    case 'aiGuessing':
      return 'player'
    case 'aiClueInput':
    case 'playerGuessing':
      return 'ai'
    default:
      return null
  }
}

/** Translation replaces any clue handover immediately, including a still-running animation. */
export function takeoverPhaseOf(phase: GameState['phase']): Side | 'translation' | null {
  return phase === 'translateChallenge' || phase === 'translateWheel' ? 'translation' : takeoverSideOf(phase)
}

export function showTranslationDock(phase: GameState['phase'], hold: boolean): boolean {
  return phase === 'translateChallenge' || phase === 'translateWheel' || (phase === 'finished' && hold)
}

/**
 * Whether a takeover card may show. The same rule for every round, the
 * practice round included: it used to hide its clue handoffs, and the owner
 * asked for it to play like a normal game (2026-09-26).
 */
/**
 * How long the practice round's scripted Casey "thinks" before her next clue:
 * past her ~1.8 s turn card (TurnTakeover) plus a short visible thinking beat.
 */
export const TUTORIAL_CASEY_CLUE_HOLD_MS = 2600

export function showTurnTakeover({
  phase,
  side,
  packing,
  guidance,
}: {
  phase: GameState['phase']
  side: Side | 'translation'
  packing: boolean
  guidance: boolean
}): boolean {
  return (
    !packing &&
    !guidance &&
    side === takeoverPhaseOf(phase)
  )
}

export function GameScreen({
  showTranslationLesson = false,
  onTranslationLessonComplete,
  showWheelLesson = false,
  onWheelLessonComplete,
  showResultLesson = false,
  onResultLessonComplete,
}: {
  /**
   * The translation lesson is still owed on this onboarding run: the practice
   * teaches it, and the first full board does when practice was skipped first.
   */
  showTranslationLesson?: boolean
  onTranslationLessonComplete?: (status: OnboardLessonStatus) => void
  /** The full-wheel beat is still owed: practice teaches it, else the first full board. */
  showWheelLesson?: boolean
  onWheelLessonComplete?: (status: OnboardLessonStatus) => void
  /** Walk the first saved full-board result and its optional review. */
  showResultLesson?: boolean
  onResultLessonComplete?: (status: OnboardLessonStatus) => void
} = {}) {
  const game = useGame((s) => s.game)
  const attemptId = useGame((s) => s.attemptId)
  const activeSlot = useGame((s) => s.activeSlot)
  const eventGeneration = useGame((s) => s.eventGeneration)
  const activeRoundGuidance = useGame((s) => s.activeRoundGuidance)
  const wheelSpinHold = useGame((s) => s.wheelSpinHold)
  // After the spin the board stays until "See results" (owner, 2026-09-27).
  const wheelReview = useGame((s) => s.wheelReview)
  const wheelShowing = wheelSpinHold || wheelReview
  const sheetWordId = useUi((s) => s.sheetWordId)
  const mode = useGame((s) => s.mode)
  // Only what this screen draws from: a whole-store subscription re-rendered
  // the screen (board, dock and table) on every store event of the round.
  const { error, aiBusy, planForClueIndex, selectedWordId, clearError, roundRecorded, settlementBusy, settlementFailure } = useGame(
    useShallow((s) => ({
      error: s.error,
      aiBusy: s.aiBusy,
      planForClueIndex: s.planForClueIndex,
      selectedWordId: s.selectedWordId,
      clearError: s.clearError,
      roundRecorded: s.roundRecorded,
      settlementBusy: s.settlementBusy,
      settlementFailure: s.settlementFailure,
    })),
  )
  const lastAiGuess = useGame((s) => s.lastAiGuess)
  // No internet, offline mode on, and offline Casey on this iPhone: the error
  // banner offers to play the rest of the round with her (owner, 2026-09-27:
  // ask the player, per round, rather than switching silently).
  const errorNoInternet = useGame((s) => s.errorNoInternet)
  const playRoundOffline = useGame((s) => s.playRoundOffline)
  const offlineMode = useSettings((s) => s.offlineMode)
  const [offlineCaseyReady, setOfflineCaseyReady] = useState(false)
  useEffect(() => {
    if (!errorNoInternet || !offlineMode || !onDeviceCaseyAvailable) {
      setOfflineCaseyReady(false)
      return
    }
    let live = true
    void gemmaStatus()
      .then((status) => { if (live) setOfflineCaseyReady(status.installed) })
      .catch(() => { if (live) setOfflineCaseyReady(false) })
    return () => { live = false }
  }, [errorNoInternet, offlineMode])
  const offerOffline = errorNoInternet && offlineCaseyReady
  // Offline Casey is playing: chosen for this round, or forced by the
  // developer build. Casey's dock says so while she thinks.
  const offlineRound = useGame((s) => s.offlineRoundFor !== null && s.offlineRoundFor === s.attemptId)
  const forcedOffline = useSettings((s) => playsOnDevice(s.caseyMode))
  const offlineCasey = onDeviceCaseyAvailable && (offlineRound || forcedOffline)
  // Her model stays in memory only while this screen holds an unfinished
  // round she plays (src/ai/gemma/residency.ts): the round ending, the player
  // leaving it, or normal Casey taking it back puts her away. Leaving the app
  // does too. A dictionary miss on the finish screen loads her for that one
  // lookup, and she goes again after it.
  const keepOfflineCasey = offlineCasey && !!game && game.phase !== 'finished'
  useEffect(() => {
    setOfflineCaseyWanted(keepOfflineCasey)
    return () => setOfflineCaseyWanted(false)
  }, [keepOfflineCasey])
  // The internet is back during an offline round: offer normal Casey for the
  // rest of it, once, unless the player already chose to stay offline.
  const stayOffline = useGame((s) => s.stayOfflineFor !== null && s.stayOfflineFor === s.attemptId)
  const playRoundOnline = useGame((s) => s.playRoundOnline)
  const keepRoundOffline = useGame((s) => s.keepRoundOffline)
  const baseUrl = useSettings((s) => s.baseUrl)
  const watchForOnline = onDeviceCaseyAvailable && offlineRound && !stayOffline && !!game && game.phase !== 'finished'
  const caseyBack = useCaseyBackOnline(watchForOnline, baseUrl)
  // The daily challenge is one shared board per date, so it is the one round
  // that must not be re-dealt.
  const dailyKey = useGame((s) => s.dailyKey)
  const {
    goTo,
    onboarding,
    leaveGameOpen,
    requestGameExit,
    closeGameExit,
  } = useUi()
  const boardCityIndex = useGame((s) => s.boardCityIndex)
  const openDictionary = useOpenDictionary({ kind: 'board', cityIndex: boardCityIndex })
  // ---- the turn-takeover state machine (build 83) --------------------------
  //
  // `giver` is the side whose turn the current phase is; `takeover` holds the
  // running handover, if one is playing. The rule is the diff of the giver
  // between two phases that BOTH have one — everything else (round start,
  // sudden death, the round's end) crosses from or to `null` and stays quiet.
  // A change of phase with the same giver (SUBMIT_CLUE → aiGuessing, a turn
  // ending into sudden death) never mints a key.
  const giver = useRef<Side | 'translation' | null>(null)
  const takeoverOwner = useRef<string | null>(null)
  const [takeover, setTakeover] = useState<{ turn: number; side: Side | 'translation' } | null>(null)
  // The last takeover card that has finished leaving. A lesson that points at
  // the dock waits for it, so a spotlight never opens over a card in flight.
  const [takeoverDoneTurn, setTakeoverDoneTurn] = useState<number | null>(null)
  const turnCount = useRef(0)
  useLayoutEffect(() => {
    const owner = `${attemptId}:${eventGeneration}`
    if (takeoverOwner.current !== owner) {
      takeoverOwner.current = owner
      giver.current = null
      setTakeover(null)
      setTakeoverDoneTurn(null)
    }
    if (!game) return
    const next = takeoverPhaseOf(game.phase)
    const previous = giver.current
    giver.current = next
    if (next === null) { setTakeover(null); return }
    if (next === previous || (previous === null && next !== 'translation')) return
    turnCount.current += 1
    setTakeoverDoneTurn(null)
    setTakeover({ turn: turnCount.current, side: next })
  }, [game, attemptId, eventGeneration])
  // Resolve an outside gesture before dismissing the keyboard. Touch scrolling
  // starts on the board, so pointer-down must not blur the composer; stopping
  // propagation here still prevents the card's pointer-down audio action.
  const dismissalGesture = useRef<{
    pointerId: number
    x: number
    y: number
    moved: boolean
  } | null>(null)
  // The keyboard can disappear before the browser synthesises click. Keep a
  // one-gesture latch so that click cannot fall through to the card underneath.
  const swallowDismissalClick = useRef(false)

  const beginOutsideGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = document.activeElement
    const composer = active instanceof HTMLElement ? active.closest('.clue-input') : null
    const target = event.target instanceof Node ? event.target : null
    if (!composer) {
      dismissalGesture.current = null
      swallowDismissalClick.current = false
      return
    }
    if (target && composer.contains(target)) {
      dismissalGesture.current = null
      swallowDismissalClick.current = false
      return
    }
    swallowDismissalClick.current = false
    dismissalGesture.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    }
    // Do not cancel the pointer's default action: touch-action on .board-area
    // must still be able to hand a vertical swipe to native scrolling.
    event.stopPropagation()
  }

  const trackOutsideGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = dismissalGesture.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) >= 8) {
      gesture.moved = true
    }
    event.stopPropagation()
  }

  const finishOutsideGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = dismissalGesture.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    dismissalGesture.current = null
    event.stopPropagation()
    const moved = gesture.moved || Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) >= 8
    // Swallow the click after both a tap and a swipe: the tap only puts the
    // keyboard away, while a swipe only scrolls the board.
    swallowDismissalClick.current = true
    if (moved) return

    const active = document.activeElement
    const composer = active instanceof HTMLElement ? active.closest('.clue-input') : null
    active instanceof HTMLElement && composer && active.blur()
  }

  const cancelOutsideGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = dismissalGesture.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    dismissalGesture.current = null
    swallowDismissalClick.current = false
    event.stopPropagation()
  }

  const swallowDismissedClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!swallowDismissalClick.current) return
    swallowDismissalClick.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  // C1-PC-1 retires packing. C1-06 retires old wrap-up saves before they can
  // reach this screen; keeping this constant makes a stale in-memory mode
  // unable to resurrect the old English-face/dock UI meanwhile.
  const packing = false
  // The onboarding practice uses this same real screen and engine. Its first
  // clue is the lesson, so there is no pre-board coach-mark gate.
  const tutorial = mode === 'tutorial'
  // The café this round is (CW-08): a required Sønderborg board in its course
  // slot. A seeded or daily board and the German course's boards are no café,
  // and keep the dots, the caption and a bare table. The first session's
  // practice is played at the café the first walk found (CW-13: "today's
  // spotlight tutorial, restyled for the café"), so it wears that café's
  // cups, tag and table; a practice outside the first session is no café.
  const slotBoard = useGame((s) => (s.activeSlot && s.sessions ? s.sessions[s.activeSlot]?.board ?? null : null))
  const practiceAtCafe = tutorial && !!onboarding
  const practiceCafe = useMemo(() => (practiceAtCafe ? cafeForBoard(firstFoundCafe()?.board) : null), [practiceAtCafe])
  const slotCafe = useMemo(() => cafeForBoard(slotBoard), [slotBoard])
  const cafe = tutorial ? practiceCafe : slotCafe
  // One table per café, fixed for the whole puzzle (owner, build 122): made
  // once from the café's identity and drawn by a memoised layer that no game
  // state reaches.
  const table = useMemo(() => (cafe ? cafeArrangement(cafe) : null), [cafe])
  // The intro game's four-beat guided tour (2026-09-18). One state flag for
  // THIS screen's lifetime: `introGameTourDue` (the predicate) decides when the
  // tour may START from the game state alone, and this flag stops it from
  // re-opening after the player finished or skipped it on this visit — the
  // practice continues with the band, as today. Reload-safety comes free: a
  // reload remounts GameScreen with a fresh flag, and the predicate only says
  // yes again on the SAME first player clue turn, so at worst one step
  // replays. No storage is written — not a settingsStore field (the migration
  // trap) and not a new localStorage key.
  const [tourFinished, setTourFinished] = useState(false)
  // A takeover card still on screen. The practice round shows the same cards
  // as any round (the owner's "feel like a normal game", 2026-09-26), so the
  // first-clue tour now opens after "Give a clue" has left, not under it.
  const takeoverShowing = !!game && !!takeover && takeoverDoneTurn !== takeover.turn && showTurnTakeover({
    phase: game.phase,
    side: takeover.side,
    packing,
    guidance: !!activeRoundGuidance,
  })
  const tourOpen = !!game && tutorial && !tourFinished && !takeoverShowing && introGameTourDue(game)
  const [translationTourFinished, setTranslationTourFinished] = useState(false)
  const [translationTourUnavailable, setTranslationTourUnavailable] = useState(false)
  const translationTourOpen = !!game && translationLessonDue({
    eligible: showTranslationLesson,
    phase: game.phase,
    takeoverComplete: takeover?.side === 'translation' && takeoverDoneTurn === takeover.turn,
    lessonFinished: translationTourFinished || translationTourUnavailable,
  })
  const finishTranslationTour = (status: OnboardLessonStatus) => {
    // The lesson replaced the ordinary translation panel on a full board, so
    // that panel is retired rather than announced straight after it.
    useGame.getState().retireTranslationGuidance()
    setTranslationTourFinished(true)
    onTranslationLessonComplete?.(status)
  }
  const [wheelTourClosed, setWheelTourClosed] = useState(false)
  const wheelTourOpen = !!game && wheelLessonDue({
    owed: showWheelLesson,
    phase: game.phase,
    spinning: wheelSpinHold,
    // Positive, as for the translation lesson: the wheel phase's card (a
    // translation card is minted on arrival and on every reload) must have
    // been seen to leave. "No card showing" would read true for the one
    // render before the takeover state catches up with the phase.
    takeoverSettled: takeover?.side === 'translation' && takeoverDoneTurn === takeover.turn,
    lessonClosed: wheelTourClosed,
  })
  const finishWheelTour = (status: OnboardLessonStatus | null) => {
    setWheelTourClosed(true)
    if (status) onWheelLessonComplete?.(status)
  }
  // On a full board the lesson, not the ordinary panel, introduces this
  // translation step. Hold that panel while the lesson is owed; if the lesson
  // cannot mount its controls, the hold lifts and the panel speaks instead.
  const lessonHoldsGuidance = !!game && translationLessonHoldsGuidance({
    tutorial,
    owed: showTranslationLesson,
    closed: translationTourFinished || translationTourUnavailable,
    phase: game.phase,
  })
  // Drive the AI side of the loop off the game phase. Guards inside the store
  // actions make this safe under StrictMode double-invocation and reloads.
  useEffect(() => {
    if (!game || packing) return
    const s = useGame.getState()
    if (
      game.phase === 'aiGuessing' &&
      s.planForClueIndex !== game.clueHistory.length &&
      !s.aiBusy &&
      !s.error
    ) {
      void s.runAiGuesses()
    }
    if (game.phase === 'aiClueInput' && !s.aiBusy && !s.error) {
      // The tutorial's scripted companion resolves in a microtask. Without a
      // hold, the reaction to the tap that ended a turn is replaced by the
      // next clue before a browser paints it (and U3's final reveal below is
      // cut off for the same reason). Ordinary Casey naturally spends longer
      // thinking, long enough that her turn card (~1.8 s) leaves while she is
      // still at it. The practice round plays the same way (owner, 2026-09-26):
      // the hold outlasts the card, so her thinking dock shows for a beat
      // before the clue lands, as it does in a normal round.
      const previous = game.clueHistory.at(-1)
      if (tutorial && previous?.guesses.length) {
        const timer = window.setTimeout(() => {
          const current = useGame.getState()
          if (current.game === game && !current.aiBusy && !current.error) void current.runAiClue()
        }, TUTORIAL_CASEY_CLUE_HOLD_MS)
        return () => window.clearTimeout(timer)
      }
      void s.runAiClue()
    }
    if (game.phase === 'finished' && !s.roundRecorded && !s.settlementBusy && !s.error) void s.finishRound()
  }, [game, packing, tutorial, error, aiBusy, planForClueIndex, settlementBusy])

  // The scripted tutorial keeps its own teaching. Other overlays (including
  // a system Back's leave dialog) get the floor without stacking guidance.
  //
  // Packing is no longer on this list. It used to be, because nothing was
  // ever announced during it; the wrap-up's own opening panel is, and the
  // store is what decides that a packing phase may announce that panel and
  // nothing else (announceRoundGuidance). Keeping the veto here would have
  // been a second, silent rule in a second file.
  const guidanceBlocked = tutorial || !!sheetWordId || leaveGameOpen || lessonHoldsGuidance
  useLayoutEffect(() => {
    const s = useGame.getState()
    if (guidanceBlocked) {
      if (s.activeRoundGuidance) s.dismissRoundGuidance()
      return
    }
    s.announceRoundGuidance()
  }, [game, mode, packing, guidanceBlocked])

  useEffect(() => {
    if (!game) goTo('home')
  }, [game, goTo])
  // A malformed/directly injected retired mode is not coerced into normal
  // play. Persistence recovery archives it; until that boundary has run this
  // screen exposes neither the old dock nor an ordinary board underneath it.
  useEffect(() => {
    if (mustRetireRoundMode(mode)) goTo('home')
  }, [mode, goTo])
  if (!game) return null
  if (mustRetireRoundMode(mode)) return null

  const showBoard = game.phase !== 'finished' || wheelShowing
  const wheelBoard = wheelBoardActive(game, wheelShowing)
  // The key is put away for the half of the round it cannot help with
  // (owner, 2026-09-11): while Casey prepares a clue and while the player
  // guesses under it there are no green frames, so the board reads as her
  // puzzle rather than your key — and their absence is itself the sign of
  // whose turn it is. They are back the moment the clue turn is the player's,
  // and they stay through the last chance, where your own greens are among
  // the words that win it. Never during study, which is exactly when the key
  // is read; and packing hides it for a reason of its own (recall, not a
  // key-reading exercise). The rule lives beside the board it governs.
  const keyHidden = playerKeyHidden({ phase: game.phase, packing })
  // Casey's opening clue in the practice round: the first guess a learner
  // ever makes, before they have seen a key of their own. The guess bar's
  // teaching line hangs off it.
  const tutorialFirstGuess = tutorialOpeningGuess({
    tutorial,
    phase: game.phase,
    clueGivers: game.clueHistory.map((clue) => clue.by),
  })
  const onboardingRealRound = !tutorial && onboarding?.step === 'real-round'

  const announcement = (() => {
    if (game.phase === 'aiGuessing' && lastAiGuess) {
      const word = game.words.find((w) => w.wordId === lastAiGuess.wordId)
      const result = game.reveals[lastAiGuess.wordId]?.kind
      if (word && result) {
        return UI.game.announceCaseyGuess(
          word.da,
          result === 'green' ? UI.game.resultCorrect : UI.game.resultNeutral,
        )
      }
    }
    if (aiBusy) return UI.game.announceCaseyThinking
    return PHASE_CAPTION[game.phase]
  })()

  return (
    <div
      className={`screen game-screen ${tutorial ? 'tutorial-game' : ''}${cafe ? ' cafe-puzzle' : ''}`}
      onPointerDownCapture={beginOutsideGesture}
      onPointerMoveCapture={trackOutsideGesture}
      onPointerUpCapture={finishOutsideGesture}
      onPointerCancelCapture={cancelOutsideGesture}
      onClickCapture={swallowDismissedClick}
    >
      {/* A fixed, pointerless companion to the native keyboard ride. It only
          appears while nativeKeyboard.ts transforms the active dock, carrying
          the white composer sheet and bottom inset with the fields instead of
          leaving that page-painted surface a beat behind. */}
      <div className="kb-surface" aria-hidden="true" />
      {/* The café's table: big faint pencil items behind everything on this
          screen, the same in every state of the puzzle. */}
      {table && <CafeTable table={table} />}
      {/* While the keyboard is up, a tap anywhere else puts it away — and does
          nothing else. It is a real element rather than a document listener
          precisely so the tap lands HERE: dismissing the keyboard and also
          guessing the card you happened to touch is two actions from one tap,
          and the second one costs a turn nobody chose to spend. (It used to
          cost the whole round — that tap could land on a forbidden word.)
          The next tap, with the keyboard down, does what it says.
          IN THE GAME SCREEN only, because the board is what it protects:
          rendered app-wide it swallowed the first tap on Settings and the
          backup panel, whose inputs live in no dock. */}
      <div
        className="kb-scrim"
        aria-hidden="true"
      />
      <header className="game-header">
        {tutorial ? (
          // Skip is always visible, like the train acts. It ends the intro the
          // ticket's skip does; the half-played round goes with it, its SRS
          // already banked by finishRound if the round got that far.
          <Tag
            className="onboard-skip"
            label={UI.game.skip}
            onClick={() => {
              const game = useGame.getState()
              if (game.restoreTutorialSuspension()) {
                useUi.getState().finishOnboarding()
                return
              }
              game.abandonGame()
              const run = useUi.getState().onboarding
              if (run?.persist) useUi.getState().advanceOnboarding('real-round')
              else useUi.getState().finishOnboarding()
            }}
          />
        ) : onboardingRealRound ? (
          // The first real round is required before Home and the suitcase gate.
          // Keep the header geometry without offering an arrow that cannot
          // leave the onboarding shell yet.
          <span className="game-header-placeholder" aria-hidden="true" />
        ) : (
          <button
            className="icon-btn"
            aria-label={UI.game.homeAria}
            onClick={() =>
              game.phase === 'finished' && !wheelSpinHold
                ? (useGame.getState().dismissResult(), goTo('home'))
                : requestGameExit()
            }
          >
            ←
          </button>
        )}
        {/* Re-deal, as a symbol in the header rather than a worded button in
            the composer — where it cost a whole line of a block that has to
            fit above a keyboard. It exists only before the player's first
            move — Casey opens, so her opening clue is on the table while the
            player is still deciding whether the board can be read at all —
            when nothing has been spent and nothing is being undone, and never
            on the daily challenge, which is one shared board per date. The
            store's rerollOpen is the one rule; the header only reads it. */}
        {!activeSlot && rerollOpen(game, { dailyKey, mode }) && (
          <button
            className="icon-btn"
            aria-label={UI.game.dealNewWordsAria}
            title={UI.game.dealNewWordsAria}
            onClick={() => useGame.getState().rerollBoard()}
          >
            ↻
          </button>
        )}
        <div className="game-header-mid">
          <TurnTokens
            total={game.config.turnTokens}
            left={game.turnsLeft}
            given={game.clueHistory.length}
            cups={!!cafe}
          />
          {/* Inside a café the café's name stands where the phase caption
              did, on a small tag (CW-08), at the caption's height so the
              board does not move. The caption stays for screen readers. */}
          <p className={`phase-caption${cafe ? ' visually-hidden' : ''}`} role="status">
            {PHASE_CAPTION[game.phase]}
          </p>
          {cafe && <CafeNameTag name={cafe.name} />}
        </div>
        {/* The right-hand side is empty on purpose (owner, 2026-09-26): hear
            the board and How to play both left the round, the tutorial's
            included. How to play is still behind Home's ?. The placeholder
            balances the left-hand arrow so the pips stay centred. */}
        <span className="game-header-placeholder" aria-hidden="true" />
      </header>

      {/* Casey's whole turn happened in silence: every status message in the
          loop was a plain paragraph that never took focus, so no screen reader
          had reason to speak it. This region is mounted for the whole round —
          a live region that appears with its content does not announce. */}
      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>

      {error && (
        <div className="error-banner" role="alert">
          <p>{offerOffline ? UI.game.offlineRoundPrompt : error}</p>
          <div className="error-actions">
            {offerOffline && (
              <Tag tone="primary" data-action="play-offline" label={UI.game.playOfflineButton} onClick={playRoundOffline} />
            )}
            <Tag label={UI.game.errorRetry} onClick={clearError} />
            {!offerOffline && !settlementFailure && !isWebDemo() && <Tag label={UI.game.errorCaseySettings} onClick={() => goTo('settings')} />}
          </div>
        </div>
      )}

      {/* Not on the end screen (P1). The only thing this sentence exists to
          tell someone is that Casey is not answering and where the switch is,
          and once the round is finished there is nothing left for her to
          answer — while the 53px it costs is 53px off a summary that has to
          fit a 640px phone with no scroller. */}
      {onPracticeCompanion() && !error && game.phase !== 'finished' && !wheelSpinHold && (
        // This exists only on the local dev/e2e route. It must never be
        // presented as Casey or as a player mode: the judged data is an
        // experimental instrument until the owner has tested and approved it.
        <p className="practice-note">{UI.game.practiceNote}</p>
      )}

      {tutorial && showBoard && (
        <TutorialCaseyBand game={game} tourOpen={tourOpen || translationTourOpen || wheelTourOpen} />
      )}

      {/* A lesson waits until its own surface has the floor. */}
      {tourOpen && !activeRoundGuidance && !leaveGameOpen && (
        <IntroGameTour
          game={game}
          onDone={() => setTourFinished(true)}
          onSkip={() => setTourFinished(true)}
        />
      )}
      {translationTourOpen && !activeRoundGuidance && !leaveGameOpen && !sheetWordId && (
        <TranslationTour
          onDone={() => finishTranslationTour('done')}
          onSkip={() => finishTranslationTour('dismissed')}
          onUnavailable={() => setTranslationTourUnavailable(true)}
        />
      )}
      {wheelTourOpen && !activeRoundGuidance && !leaveGameOpen && !sheetWordId && (
        <WheelReadyTour
          onDone={() => finishWheelTour('done')}
          onSkip={() => finishWheelTour('dismissed')}
          onUnavailable={() => finishWheelTour(null)}
        />
      )}

      {showBoard && (
        <div className="board-area">
          <BoardGrid
            game={game}
            canGuess={
              !packing &&
              !activeRoundGuidance &&
              (game.phase === 'playerGuessing' || game.phase === 'suddenDeath')
            }
            selectedWordId={selectedWordId}
            onCardTap={(id) => useGame.getState().selectWord(id)}
            onInfoTap={openDictionary}
            // Locked while the board is being packed AND across the whole
            // wheel challenge: the dock asks for these exact words, so the
            // card's ⓘ and the dictionary would be the answer key.
            dictionaryLocked={packing || wheelShowing || game.phase === 'translateChallenge' || game.phase === 'translateWheel'}
            // The wheel's board treatments (lid words, dimming, the missed
            // key words' marks) run from the challenge through the filled
            // wheel to the end of the post-spin review (owner, 2026-09-27).
            // No tap-to-select (owner, 2026-09-17): the composer grades the
            // typed answer against every untranslated found word on submit.
            wheelActive={wheelBoard}
            wheelSolved={wheelBoard ? (id) => game.wheel?.translated.includes(id) ?? false : undefined}
            // Once the wheel has spun, every suitcase shows its Danish: the
            // ones typed in green, the rest as the answer that was not given.
            wheelAnswers={wheelBoard && !!game.wheel?.result}
            hidePlayerKey={keyHidden}
          />
        </div>
      )}

      {/* The key legend stood here — a swatch reading "your target" and a ⓘ
          reading "look up", one line between the board and the dock. K2 took
          it out, and it is a deletion rather than a move: the border IS the
          legend (README's rule, and the card's aria-label says "your target"
          in words for anyone who cannot see it), and a ⓘ on a card explains
          itself the moment it is tapped. What it cost was 17.3px plus the
          column's 12px gap on a screen that must fit 640px, in every phase of
          every round, for a sentence read once. The board has it now. */}

      {/* The panel IS the reserve again (K2). There was a `.dock-slot` wrapper
          here holding --dock-slot-h while the dock inside hugged its own
          content, because the docks were different heights and the difference
          had to be held as air rather than as grey. Every dock a round can be
          in is now --dock-h exactly, which is why they are not wrapped either,
          so the wrapper had nothing left to
          reserve and went. I2 removes the tutorial exception too: the band
          while the dock below is the exact composer / guess bar / Casey panel
          used in real play. */}
      {game.phase === 'playerClueInput' && !packing && (
        <ClueInput
          game={game}
          firstTimeHint={!tutorial}
          tutorialTeaching={tutorial && game.clueHistory.length === 1}
          tutorial={tutorial}
          onSubmit={(t, n) => useGame.getState().submitPlayerClue(t, n)}
        />
      )}
      {(game.phase === 'aiGuessing' || game.phase === 'aiClueInput') &&
        !packing && <AiTurnPanel key={`${attemptId}:${eventGeneration}`} game={game} offlineCasey={offlineCasey} cafe={!!table} />}
      {game.phase === 'playerGuessing' && !packing && (
        <PlayerGuessBar
          game={game}
          firstTimeHint={!tutorial}
          tutorialFirstGuess={tutorialFirstGuess}
        />
      )}
      {game.phase === 'suddenDeath' && !packing && <SuddenDeathBar game={game} />}
      {/* The Translation Wheel's ENDING (owner, 2026-09-18): the challenge dock
          while suitcases remain, then the wheel itself — spinnable once every
          one is translated — whose spin decides the round. The finish screen
          waits for the spin's ~3s ease-out (the store's wheelSpinHold, cleared
          by WheelSpinner at rest) and then for "See results" (wheelReview,
          owner 2026-09-27), so the disc is seen to land and every suitcase's
          Danish can be read before the outcome replaces it. */}
      {/* A single keyed mount survives challenge → accepted verdict. Splitting
          these branches unmounted the disc on the very frame it should spin. */}
      {showTranslationDock(game.phase, wheelShowing) && !packing && <TranslateChallengeBar key={attemptId} game={game} />}
      {/* The takeover card borrows the dock's rectangle while a turn changes
          hands. Rendered AFTER the real dock, absolutely positioned over it:
          the dock mounts beneath on the same commit and takes the keyboard
          (or not) as before, and the card clears out before the player can
          want to type. See TurnTakeover for the timing. */}
      {takeover && showTurnTakeover({
        phase: game.phase,
        side: takeover.side,
        packing,
        guidance: !!activeRoundGuidance,
      }) && (
        <TurnTakeover
          key={takeover.turn}
          turn={takeover.turn}
          side={takeover.side}
          onGone={() => setTakeoverDoneTurn(takeover.turn)}
        />
      )}
      {game.phase === 'finished' && !roundRecorded && !error && <p role="status">{UI.game.settlementSaving}</p>}
      {game.phase === 'finished' && roundRecorded && !wheelShowing &&
        (tutorial ? (
          <TutorialFinish game={game} />
        ) : onboarding?.step === 'real-round' ? (
          <RoundSummary
            game={game}
            hideReplay
            showResultLesson={showResultLesson}
            onResultLessonComplete={onResultLessonComplete}
            onHome={() => useUi.getState().advanceOnboarding('home-return')}
          />
        ) : (
          <RoundSummary game={game} />
        ))}
      {activeRoundGuidance && !guidanceBlocked && (
        <RoundGuidanceDialog
          key={activeRoundGuidance}
          kind={activeRoundGuidance}
          clue={activeRoundGuidance === 'casey' && currentClue(game)
            ? { text: currentClue(game)!.text, number: currentClue(game)!.number }
            : undefined}
          wheel={game.phase === 'translateChallenge' || game.phase === 'translateWheel'}
          onDismiss={useGame.getState().dismissRoundGuidance}
        />
      )}
      {/* Asked between Casey's turns, never over one: a switch mid-turn would
          leave her offline move running for nothing. Every other overlay
          keeps the floor first. */}
      {caseyBack && watchForOnline && !aiBusy && !leaveGameOpen && !sheetWordId && !activeRoundGuidance &&
        !tourOpen && !translationTourOpen && !wheelTourOpen && !wheelSpinHold && (
        <OnlineAgainDialog onPlayOnline={playRoundOnline} onStayOffline={keepRoundOffline} />
      )}
      {leaveGameOpen && game.phase !== 'finished' && (
        <LeaveGameDialog
          onKeepPlaying={closeGameExit}
          onPause={() => goTo('home')}
          onCancelRound={() => {
            useGame.getState().abandonGame()
            goTo('home')
          }}
        />
      )}
    </div>
  )
}

/**
 * The clues are gone and the board is not finished. Codenames Duet ends this
 * way rather than on a buzzer: keep naming words, with nothing to go on but
 * what the clues already meant, and one wrong name ends it.
 *
 * The greens on your own key are the ones you can already see, so what is left
 * is whatever Casey was pointing at and you never worked out. No target count
 * is shown on purpose — knowing how many remain is most of the puzzle.
 */
function SuddenDeathBar({ game }: { game: GameState }) {
  const selectedWordId = useGame((s) => s.selectedWordId)
  const selected = selectedWordId ? game.words.find((w) => w.wordId === selectedWordId) : null

  return (
    <div className="dock guess-bar sudden-death-bar">
      <p className="dock-title">{UI.game.phaseLastChance}</p>
      {/* ONE line (K2), where three sentences used to stand. It is still the
          dock's give-way region — prose, so it may be cut — but it no longer
          has to give way for anything: the dock is --dock-h like every other
          one, and the sentence that survived is the whole rule. */}
      <p className="dim dock-flex">{UI.game.suddenDeathRule}</p>
      {/* One row, not two. Giving up and confirming a name are alternatives —
          you cancel a selection before you walk away from the round — so they
          share a row rather than each reserving one. The second row was 56px
          of the dock's reserve, and the dock's reserve is the board's size in
          every phase of the round. */}
      <div className="dock-actions">
        {selected ? (
          <div className="guess-confirm">
            <button
              className="btn btn-primary"
              onClick={() => {
                useGame.getState().playerGuess(selected.wordId)
              }}
            >
              {UI.game.nameWord(selected.da)}
            </button>
            <button className="btn" onClick={() => useGame.getState().selectWord(null)}>
              {UI.game.cancel}
            </button>
          </div>
        ) : (
          <button className="btn btn-ghost" onClick={() => useGame.getState().playerStop()}>
            {UI.game.giveUpRound}
          </button>
        )}
      </div>
    </div>
  )
}

function PlayerGuessBar({
  game,
  firstTimeHint = true,
  firstWrapTeaching = false,
  tutorialFirstGuess = false,
}: {
  game: GameState
  firstTimeHint?: boolean
  /** This guess turn is part of a wrap-up round. */
  firstWrapTeaching?: boolean
  /** Casey's opening clue: the learner has not yet seen their green frames. */
  tutorialFirstGuess?: boolean
}) {
  const selectedWordId = useGame((s) => s.selectedWordId)
  const clue = currentClue(game)!
  const made = clue.guesses.length
  const left = clue.number - made
  const selected = selectedWordId ? game.words.find((w) => w.wordId === selectedWordId) : null
  // Taps on the clue in the title, each one sending it to the dictionary
  // below. A counter, so the same clue can be asked for again after the field
  // has been typed over — see TranslateBox's `fill`.
  const [lookUps, setLookUps] = useState(0)
  // The first guessing turn ever restates the rule the tutorial's staged miss
  // taught, in the hint slot that already exists — the line a selection swaps
  // away, so the dock's reserved height never grows (O4). Once ever, via
  // cluecab-hint-guess; never in the tutorial, whose dock replaces this one.
  const firstGuessEver = useFirstTimeHint(HINT_KEYS.guess, firstTimeHint)
  const firstWrapCaseyKey = useFirstTimeHint(HINT_KEYS.wrapCaseyKey, firstWrapTeaching)
  const teachingLine = firstWrapCaseyKey
    ? UI.game.wrapCaseyKeyHint
    : tutorialFirstGuess
      ? UI.game.tutorialLookupHint
      : undefined

  // The dictionary, taken apart the way the composer takes it apart (K1's
  // `useDictionary`): its field and its one answer sit side by side on the
  // dock's last row instead of stacked in a box of their own. The box was two
  // rows plus its own rule and padding; this is one.
  const dictionaryCity = useGame(s => s.boardCityIndex)
  const dictionary = useDictionary({ term: clue.text, nonce: lookUps }, { kind: 'board', cityIndex: dictionaryCity })

  return (
    <div className="dock guess-bar">
      {/* Three rows, the same three the composer has and the same height (K2):
          the title, ONE action row, and the dictionary. Nothing here may add a
          fourth.

          The clue is the button that looks it up. It was printed here AND
          offered again on the dictionary's own line ("Look up Casey's clue")
          one row below — two rows for one word, in the dock whose height is
          the board's height for the whole round. Tapping the word you cannot
          read is also the more obvious gesture of the two.

          "· 2 guesses left" rather than "— up to 2 more guesses": the title is
          nowrap and ellipsized, so what it says has to fit a long Danish clue
          beside it. */}
      <p className="dock-title">
        {UI.game.caseysClueLabel}{' '}
        <button
          className="clue-lookup"
          aria-label={UI.game.lookUpInDictionaryAria(clue.text)}
          onClick={() => setLookUps((n) => n + 1)}
        >
          {clue.text}
        </button>{' '}
        ({clue.number}) · {UI.game.guessesLeft(left)}
      </p>
      {/* A stake note stood here explaining what a forbidden tap cost and whose
          forbidden words were in play. Nothing on this screen is fatal any
          more: a wrong guess spends the turn, and that is the whole stake. */}
      {/* One row for all three states. Stopping and confirming a guess are
          alternatives — a selected card is cancelled before you stop — so the
          stop button lives where the hint was rather than reserving a row of
          its own underneath it. That row was 74px of the reserve at 360x640
          (66 of button, wrapped to two lines, and an 8px gap), and the reserve
          is the board's height in every phase of the round — including the
          ones with no stop button in them at all.

          The row is also this dock's give-way region, so the difference
          between a 49px button and a one-line hint is spent HERE rather than
          moving the dictionary under it. */}
      <div className="dock-actions">
        {selected ? (
          <div className="guess-confirm">
            <button
              className="btn btn-primary"
              onClick={() => {
                useGame.getState().playerGuess(selected.wordId)
              }}
            >
              {UI.game.guessWord(selected.da)}
            </button>
            <button className="btn" onClick={() => useGame.getState().selectWord(null)}>
              {UI.game.cancel}
            </button>
          </div>
        ) : made > 0 ? (
          // Only once a guess has been made, which is also the only moment the
          // hint below has nothing left to teach — the player has just done the
          // thing it describes.
          <button className="btn btn-ghost" onClick={() => useGame.getState().playerStop()}>
            {UI.game.stopKeepWhatWeHave}
          </button>
        ) : (
          <p className={firstGuessEver ? 'dim first-hint' : 'dim'}>
            {teachingLine ?? (firstGuessEver
              ? // A guess is judged against the clue-giver's key — Casey clued,
                // so her key is the one being read. Said forwards, the way
                // game.test.ts pins it; the phase-specific consequence only.
                UI.game.firstGuessHint
              : UI.game.guessPrompt)}
          </p>
        )}
      </div>
      {/* Casey clues in Danish when asked to, and a clue you cannot read is
          not a clue. The title above is the tap that fills this. */}
      <div className="dock-dictionary">
        {dictionary.field}
        <div className="dict-line">{dictionary.line}</div>
      </div>
    </div>
  )
}
