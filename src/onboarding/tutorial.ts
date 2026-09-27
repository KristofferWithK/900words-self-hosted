import type { CardRole, GameState } from '../engine/types'
import { TUTORIAL_CONFIG } from '../engine/config'
import { UI } from '../i18n'
import { ACTIVE } from '../lang/active'

export type TutorialLanguage = 'da' | 'de'

/** Languages with a fully authored first-run practice round. */
export function isTutorialLanguage(language: string): language is TutorialLanguage {
  return language === 'da' || language === 'de'
}

/** The active course's script; unsupported preview courses retain the Danish fallback. */
export const TUTORIAL_LANGUAGE: TutorialLanguage = isTutorialLanguage(ACTIVE.code) ? ACTIVE.code : 'da'
const activeCopy = UI.onboarding.courseText(TUTORIAL_LANGUAGE)

/** The seed that assigns the authored roles below to the practice board. */
export const TUTORIAL_SEED = 2020

/** The practice composer asks for one useful association, never a singleton. */
export const TUTORIAL_CLUE_NUMBERS = [2, 3] as const

export interface TutorialScript {
  wordIds: readonly string[]
  roles: {
    sharedGreens: readonly string[]
    aiOnlyGreens: readonly string[]
    playerOnlyGreens: readonly string[]
    bystanders: readonly string[]
  }
  aiClues: readonly {
    text: string
    number: number
    targetWordIds: readonly string[]
    rationale: string
  }[]
  recoveryClue: { text: string; rationale: string }
}

const TUTORIAL_SCRIPTS: Record<TutorialLanguage, TutorialScript> = {
  da: {
    wordIds: [
      'da:vand', 'da:mad', 'da:æble', 'da:hus', 'da:kaffe',
      'da:bord', 'da:ost', 'da:hund', 'da:mælk',
    ],
    roles: {
      sharedGreens: ['da:hus'],
      aiOnlyGreens: ['da:vand', 'da:kaffe', 'da:mælk'],
      playerOnlyGreens: ['da:mad', 'da:æble', 'da:ost'],
      bystanders: ['da:bord', 'da:hund'],
    },
    aiClues: [
      {
        text: 'drikke',
        number: 3,
        targetWordIds: ['da:vand', 'da:kaffe', 'da:mælk'],
        rationale: UI.onboarding.practiceRationaleDrink,
      },
      {
        text: 'hjem',
        number: 1,
        targetWordIds: ['da:hus'],
        rationale: UI.onboarding.practiceRationaleHome,
      },
    ],
    recoveryClue: {
      text: 'drikke',
      rationale: UI.onboarding.practiceRationaleRecovery,
    },
  },
  de: {
    wordIds: [
      'de:Uhr', 'de:Mutter', 'de:Vater', 'de:Haus', 'de:Monat',
      'de:Stadt', 'de:Kind', 'de:Hund', 'de:Woche',
    ],
    roles: {
      sharedGreens: ['de:Haus'],
      aiOnlyGreens: ['de:Uhr', 'de:Monat', 'de:Woche'],
      playerOnlyGreens: ['de:Mutter', 'de:Vater', 'de:Kind'],
      bystanders: ['de:Stadt', 'de:Hund'],
    },
    aiClues: [
      {
        text: 'Zeit',
        number: 3,
        targetWordIds: ['de:Uhr', 'de:Monat', 'de:Woche'],
        rationale: activeCopy.practiceRationaleTime,
      },
      {
        text: 'Zuhause',
        number: 1,
        targetWordIds: ['de:Haus'],
        rationale: UI.onboarding.practiceRationaleHome,
      },
    ],
    recoveryClue: {
      text: 'Zeit',
      rationale: activeCopy.practiceRationaleTimeRecovery,
    },
  },
}

export function tutorialScriptFor(language: TutorialLanguage): TutorialScript {
  return TUTORIAL_SCRIPTS[language]
}

const activeTutorial = TUTORIAL_SCRIPTS[TUTORIAL_LANGUAGE]

/** The authored practice board. The first clue and player key vary by course. */
export const TUTORIAL_WORD_IDS = activeTutorial.wordIds

/** What the fixed seed deals. Commentary tests pin this against the engine. */
export const TUTORIAL_ROLES = activeTutorial.roles

/** A resumed practice round must still be the current authored lesson. */
export function isCurrentTutorialGame(game: GameState): boolean {
  const config = game.config
  return (
    config.rows === TUTORIAL_CONFIG.rows &&
    config.cols === TUTORIAL_CONFIG.cols &&
    config.totalWords === TUTORIAL_CONFIG.totalWords &&
    config.greensPerSide === TUTORIAL_CONFIG.greensPerSide &&
    config.greenOverlap === TUTORIAL_CONFIG.greenOverlap &&
    config.turnTokens === TUTORIAL_CONFIG.turnTokens &&
    config.maxNewWordsPerBoard === TUTORIAL_CONFIG.maxNewWordsPerBoard &&
    game.words.every((word, index) => word.wordId === TUTORIAL_WORD_IDS[index])
  )
}

/**
 * Casey's fixed clues. The player is never told which cards they name; only
 * Casey's clue-giver half is deterministic, while the player's route is real.
 */
export const TUTORIAL_AI_CLUES = activeTutorial.aiClues

/**
 * Whether the four-beat intro-game tour has its floor right now (2026-09-18).
 *
 * The tour is DERIVED from the game state, never persisted: its cursor is
 * component state while the steps run, and its START is this predicate, so a
 * reload mid-tour replays at worst one step instead of needing a cursor of
 * its own (no localStorage key, no settingsStore field, no flow change).
 *
 * Beat 1 opens on the player's FIRST practice clue turn — the only moment the
 * green frames are both on the board and unexplained. Beats 2–4 walk the
 * composer's three controls while that same composer is open, in the order a
 * clue is built: the field, the dictionary beside it, then the stepper.
 *
 * Deliberately false:
 *  - during the scripted AI-clue opening beats and while Casey guesses (the
 *    band's reactive line has the floor, and the key is not even on the
 *    board);
 *  - once any clue has been GIVEN by the player (`playerClued`), so a second
 *    clue turn or a reload after the round moved on never re-opens it;
 *  - while the tour is finished/skipped (GameScreen holds that in state).
 *
 * The 1100ms holds are Casey's own reveal beats in GameScreen's scripted
 * opening; this predicate only reads phases, so a hold cannot race it.
 */
export function introGameTourDue(game: GameState): boolean {
  if (game.phase !== 'playerClueInput') return false
  const firstPlayerClue = game.clueHistory.find((clue) => clue.by === 'player')
  if (firstPlayerClue) return false
  // Casey's opening clue must be in the history: the scripted AI-clue beats
  // before it commit nothing, and the band is speaking then.
  return game.clueHistory.some((clue) => clue.by === 'ai')
}

/** The translation lesson starts only after its real takeover has left. */
export function translationLessonDue({
  eligible,
  phase,
  takeoverComplete,
  lessonFinished,
}: {
  eligible: boolean
  phase: GameState['phase']
  takeoverComplete: boolean
  lessonFinished: boolean
}): boolean {
  return eligible && phase === 'translateChallenge' && takeoverComplete && !lessonFinished
}

/**
 * On a full board the owed lesson, not the ordinary translation panel,
 * introduces the translation step, so that panel waits while the lesson is
 * owed. The practice round never announces round panels at all. Once the
 * lesson closes (or cannot find its controls) the hold lifts.
 */
export function translationLessonHoldsGuidance({
  tutorial,
  owed,
  closed,
  phase,
}: {
  tutorial: boolean
  owed: boolean
  closed: boolean
  phase: GameState['phase']
}): boolean {
  return !tutorial && owed && !closed && phase === 'translateChallenge'
}

/**
 * The full-wheel lesson opens once the wheel is full (the engine is in
 * `translateWheel` exactly then) and before the spin: not while a spin is
 * landing, only once the translation card has left, and never twice.
 */
export function wheelLessonDue({
  owed,
  phase,
  spinning,
  takeoverSettled,
  lessonClosed,
}: {
  owed: boolean
  phase: GameState['phase']
  spinning: boolean
  takeoverSettled: boolean
  lessonClosed: boolean
}): boolean {
  return owed && phase === 'translateWheel' && !spinning && takeoverSettled && !lessonClosed
}

/** Reconnects any scripted clue targets left behind by an honest early miss. */
export const TUTORIAL_AI_RECOVERY_CLUE = activeTutorial.recoveryClue

export type TutorialCommentaryEvent =
  | { type: 'intro' }
  | { type: 'state' }
  | { type: 'player-guess'; clueIndex: number; guessIndex: number }

export interface TutorialClaim {
  wordId: string
  result: CardRole
  roleOnPlayerKey: CardRole
  turnEnded: boolean
  teachesDirection: boolean
}

export interface TutorialCommentary {
  text: string
  mood: 'idle' | 'thinking' | 'happy' | 'oops'
  kind: 'narration' | 'reaction'
  claim?: TutorialClaim
}

/** Has the player met a card that is live on one key but not the other? */
export function tutorialDirectionTaught(game: GameState): boolean {
  return game.clueHistory.some(
    (clue) =>
      clue.by === 'ai' &&
      clue.guesses.some(
        (guess) => guess.result === 'bystander' && game.playerKey[guess.wordId] === 'green',
      ),
  )
}

/**
 * The event visible in a persisted GameState. Explicit indices make a reload
 * land on the same reaction without a second, parallel beat counter.
 */
export function tutorialEvent(game: GameState): TutorialCommentaryEvent {
  const clueIndex = game.clueHistory.length - 1
  const clue = game.clueHistory[clueIndex]
  if (
    clue?.by === 'ai' &&
    clue.guesses.length > 0 &&
    game.phase !== 'aiGuessing' &&
    game.phase !== 'translateChallenge' &&
    game.phase !== 'translateWheel' &&
    game.phase !== 'finished'
  ) {
    return { type: 'player-guess', clueIndex, guessIndex: clue.guesses.length - 1 }
  }
  return { type: 'state' }
}

/**
 * Casey's reactive tutorial voice. There is one tappable narration line; all
 * later changes are automatic reactions to real engine state. The claim is
 * returned beside the copy so exhaustive tests can prove every adjective
 * against the clue-giver's key rather than parsing prose after the fact.
 */
export function commentary(
  game: GameState,
  event: TutorialCommentaryEvent,
): TutorialCommentary {
  if (event.type === 'intro') {
    return {
      kind: 'narration',
      mood: 'idle',
      text: activeCopy.practiceIntro(
        TUTORIAL_AI_CLUES[0]!.text,
        TUTORIAL_AI_CLUES[0]!.number,
      ),
    }
  }

  if (event.type === 'player-guess') {
    const clue = game.clueHistory[event.clueIndex]
    const guess = clue?.guesses[event.guessIndex]
    const word = guess && game.words.find((entry) => entry.wordId === guess.wordId)
    if (!clue || clue.by !== 'ai' || !guess || !word) return commentary(game, { type: 'state' })

    const roleOnPlayerKey = game.playerKey[guess.wordId]!
    const turnEnded = game.phase !== 'playerGuessing'
    const directionalReveal = guess.result === 'bystander' && roleOnPlayerKey === 'green'
    const earlierState: GameState = {
      ...game,
      clueHistory: game.clueHistory.map((entry, clueIndex) =>
        clueIndex === event.clueIndex
          ? { ...entry, guesses: entry.guesses.slice(0, event.guessIndex) }
          : entry,
      ),
    }
    const teachesDirection = directionalReveal && !tutorialDirectionTaught(earlierState)
    const claim: TutorialClaim = {
      wordId: guess.wordId,
      result: guess.result,
      roleOnPlayerKey,
      turnEnded,
      teachesDirection,
    }

    // Each ending is its own whole sentence in the catalogue rather than a
    // frame with clauses glued on: a language writes its own punctuation
    // between two sentences, and nothing here can join them with a space it
    // does not want.
    if (guess.result === 'green') {
      const mineNotYours = turnEnded && !tutorialDirectionTaught(game)
      return {
        kind: 'reaction',
        mood: 'happy',
        claim,
        text: !turnEnded
          ? UI.onboarding.guessGreenMore(word.da)
          : mineNotYours
            ? UI.onboarding.guessGreenEndMine(word.da)
            : UI.onboarding.guessGreenEnd(word.da),
      }
    }

    if (teachesDirection) {
      return {
        kind: 'reaction',
        mood: 'oops',
        claim,
        text: UI.onboarding.guessYoursNotMine(word.da),
      }
    }

    const mineNotYours = turnEnded && !tutorialDirectionTaught(game)
    return {
      kind: 'reaction',
      mood: 'oops',
      claim,
      text: mineNotYours ? UI.onboarding.guessMissMine(word.da) : UI.onboarding.guessMiss(word.da),
    }
  }

  const clue = game.clueHistory.at(-1)
  if (game.phase === 'playerGuessing' && clue?.by === 'ai') {
    return {
      kind: 'reaction',
      mood: 'happy',
      text:
        game.clueHistory.length === 1
          ? UI.onboarding.firstClue(clue.text)
          : UI.onboarding.clueFor(clue.text, clue.number),
    }
  }

  if (game.phase === 'playerClueInput') {
    const remainingPlayerGreens = game.words.filter((word) => {
      if (game.playerKey[word.wordId] !== 'green') return false
      const reveal = game.reveals[word.wordId]!
      return reveal.kind === 'hidden' || (reveal.kind === 'bystander' && !reveal.against.includes('player'))
    }).length
    return {
      kind: 'reaction',
      mood: 'idle',
      text: remainingPlayerGreens === 1
        ? activeCopy.lastGreen
        : activeCopy.yourTurn,
    }
  }

  if (game.phase === 'aiGuessing' && clue?.by === 'player') {
    const firstPlayerClue = game.clueHistory.filter((entry) => entry.by === 'player').length === 1
    return {
      kind: 'reaction',
      mood: 'thinking',
      text: firstPlayerClue
        ? UI.onboarding.yourFirstClue(clue.text, clue.number, game.config.turnTokens)
        : UI.onboarding.yourClue(clue.text, clue.number),
    }
  }

  if (game.phase === 'translateChallenge') {
    // Stage one teaches the action only. Tier/normal-board claims belong to
    // the settled normal receipt, never to the practice board.
    return { kind: 'reaction', mood: 'happy', text: UI.game.guidanceTranslationBody(activeCopy.languageName) }
  }

  if (game.phase === 'translateWheel') {
    return { kind: 'reaction', mood: 'happy', text: UI.game.wheelLede(activeCopy.languageName) }
  }

  if (game.phase === 'finished') {
    return {
      kind: 'reaction',
      mood: game.outcome?.result === 'won' ? 'happy' : 'oops',
      text:
        game.outcome?.result === 'won' ? UI.onboarding.practiceWon : UI.onboarding.practiceLost,
    }
  }

  return {
    kind: 'reaction',
    mood: 'thinking',
    text: UI.onboarding.findingAClue,
  }
}
