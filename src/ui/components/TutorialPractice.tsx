import { useEffect, useState } from 'react'
import type { GameState } from '../../engine/types'
import { commentary, introGameTourDue, tutorialEvent } from '../../onboarding/tutorial'
import { INTRO_GAME_TOUR_STEPS, translationTourSteps, wheelReadyTourSteps } from '../../onboarding/tour'
import { useGame } from '../../stores/gameStore'
import { useUi } from '../../stores/uiStore'
import { ClueyFace } from './Cluey'
import { Confetti } from './Confetti'
import { CoachMarkTour } from './SuitcaseTour'
import { UI } from '../../i18n'
import { Tag } from './Tag'
import { leavePractice } from '../introRound'

/**
 * Casey stays on the practice board throughout. This is deliberately a compact
 * live status, not another set of tutorial controls: the player learns by
 * using the real board, guess bar and composer underneath it.
 *
 * While the intro-game tour has the floor, the band's line for that beat IS
 * the tour panel's line — one voice, one place. The band's reactive
 * commentary (guess reactions, the token handoff) is untouched otherwise.
 */
export function TutorialCaseyBand({ game, tourOpen }: { game: GameState; tourOpen: boolean }) {
  // Before the scripted clue is committed there is no history entry for
  // `tutorialEvent` to read. The authored opening line is already the real
  // clue Casey is about to submit, so it is the useful thing to show while she
  // prepares it.
  const event = game.clueHistory.length === 0 ? { type: 'intro' } as const : tutorialEvent(game)
  const eventKey = event.type === 'player-guess' ? `${event.clueIndex}:${event.guessIndex}` : null
  const [settledEventKey, setSettledEventKey] = useState<string | null>(null)

  // Let the final card land, then move the conversation on to the instruction
  // for the controls that are now visible. Without this beat, tutorialEvent's
  // reload-stable final reaction occupied the band for the whole clue turn and
  // Casey never actually said the player-turn handoff.
  useEffect(() => {
    if (!eventKey || game.phase === 'playerGuessing') {
      setSettledEventKey(null)
      return
    }
    const timer = window.setTimeout(() => setSettledEventKey(eventKey), 1100)
    return () => window.clearTimeout(timer)
  }, [eventKey, game.phase])

  const line = commentary(
    game,
    eventKey && settledEventKey === eventKey ? { type: 'state' } : event,
  )
  return (
    <aside className="tutorial-casey-band" aria-live="polite">
      <ClueyFace mood={line.mood} className="cluey-mini" />
      {/* A tour step speaking keeps the same words OUT of this band: the tour
          panel is Casey's one voice while it is up. The band keeps its
          rectangle (the round's geometry does not move); the face's mood and
          the silent p keep the row alive without a second sentence. */}
      {tourOpen && <p className="tutorial-casey-bubble" aria-hidden="true" />}
      {!tourOpen && (
        <p className="tutorial-casey-bubble">
          {withClueWords(line.text, game.clueHistory.map((clue) => clue.text), event.type === 'intro')}
        </p>
      )}
    </aside>
  )
}

/**
 * Casey's lines quote words in «guillemets». A quoted CLUE is set in the same
 * green as the clue in the dock below, so «drikke» reads as the clue it is.
 * A quoted guess is left alone: «vand» in "«vand» is not green on my key"
 * must not look green. The opening line, spoken before the clue is in the
 * history, quotes only the clue.
 */
export function withClueWords(text: string, clues: readonly string[], allQuotesAreClues = false) {
  const known = new Set(clues.map((clue) => clue.toLowerCase()))
  return text.split(/(«[^»]+»)/).map((part, i) => {
    const quoted = part.startsWith('«') && part.endsWith('»')
    if (!quoted || !(allQuotesAreClues || known.has(part.slice(1, -1).toLowerCase()))) return part
    return <b key={i} className="tutorial-clue">{part}</b>
  })
}

/**
 * The four-beat guided tour over the LIVE practice board (2026-09-18). Rendered
 * from GameScreen when the practice is at its teaching beat and the tour has
 * not been finished or skipped this round: `introGameTourDue` derives the start
 * from the game state, so a reload mid-tour resumes at worst one step instead
 * of needing a persisted cursor.
 *
 * Skip ends only the tour, unlike every other Skip in this flow — the practice
 * round continues with the band as today. The spotlight is fixed-position, so
 * the no-scroll rule holds by construction.
 */
export function IntroGameTour({
  game,
  onDone,
  onSkip,
}: {
  game: GameState
  onDone: () => void
  onSkip: () => void
}) {
  if (!introGameTourDue(game)) return null
  return (
    <CoachMarkTour
      steps={INTRO_GAME_TOUR_STEPS}
      onDone={onDone}
      onSkip={onSkip}
      kind="tutorial"
      surfaceSelector=".game-screen"
    />
  )
}

/** The second, optional spotlight teaches the live translation controls. */
export function TranslationTour({
  onDone,
  onSkip,
  onUnavailable,
}: {
  onDone: () => void
  /** Skip or Escape closes only this lesson and records it as dismissed. */
  onSkip: () => void
  onUnavailable: () => void
}) {
  return <CoachMarkTour
    steps={translationTourSteps()}
    surfaceSelector=".game-screen"
    onDone={onDone}
    onSkip={onSkip}
    onUnavailable={onUnavailable}
    doneLabel={UI.onboarding.tourDone}
    kind="translation"
  />
}

/** One beat on the full wheel before its spin; the player spins after it. */
export function WheelReadyTour({
  onDone,
  onSkip,
  onUnavailable,
}: {
  onDone: () => void
  onSkip: () => void
  onUnavailable: () => void
}) {
  return <CoachMarkTour
    steps={wheelReadyTourSteps()}
    surfaceSelector=".game-screen"
    onDone={onDone}
    onSkip={onSkip}
    onUnavailable={onUnavailable}
    doneLabel={UI.onboarding.tourDone}
    kind="wheel"
  />
}

/**
 * Casey's opening clue in the practice round: the first guess a learner ever
 * makes, before a key of their own has been shown to them. The guess bar's
 * teaching line ("Tap ⓘ beside a word…") hangs off this. The key itself is
 * put away during EVERY guessing turn since the owner's call of 2026-09-11,
 * practice or not — that rule is `playerKeyHidden` in BoardGrid.tsx, and this
 * predicate no longer decides it.
 */
export function tutorialOpeningGuess({
  tutorial,
  phase,
  clueGivers,
}: {
  tutorial: boolean
  phase: GameState['phase']
  clueGivers: readonly ('player' | 'ai')[]
}): boolean {
  return (
    tutorial &&
    clueGivers.every((by) => by === 'ai') &&
    (phase === 'aiClueInput' || phase === 'playerGuessing')
  )
}

/** The one speech Casey gives after either completed practice outcome. */
export const TUTORIAL_FINISH_LINE = UI.onboarding.practiceFinish

/**
 * Finishing the practice is the achievement here. A loss still teaches the
 * turn loop, so it gets the same light handoff rather than becoming a dead end.
 * The compact next-step copy keeps the practice attempt distinct from normal
 * board tiers and replay improvement.
 */
export function tutorialFinishCopy(
  result: NonNullable<GameState['outcome']>['result'] | undefined,
): string | null {
  if (result === 'won') return UI.onboarding.practiceWon
  if (result === 'lost') return UI.onboarding.practiceLost
  return null
}

/**
 * The finish button's words: on to the café's own puzzle, on a first session
 * and on a replayed intro alike (owner, 2026-10-04: the full game is part of
 * the intro). A round the player had paused is never offered here; it is
 * there to continue once the intro is over.
 */
export function tutorialFinishCtaCopy(): string {
  return UI.onboarding.playFullRound
}

export function TutorialFinish({ game, awardStatus: settledAwardStatus }: { game: GameState; awardStatus?: 'new' | 'already-held' | 'not-eligible' }) {
  const line = commentary(game, { type: 'state' })
  const winCopy = tutorialFinishCopy(game.outcome?.result)
  const awardStatus = settledAwardStatus ?? useGame((s) => s.completionReceipt?.tutorialAward?.status ?? 'not-eligible')
  const replay = useUi((s) => s.onboarding?.persist === false)
  const mood = game.outcome?.result === 'won' ? 'happy' : line.mood
  return (
    <div className="tutorial-finish" data-tutorial-award={awardStatus}>
      {game.outcome?.result === 'won' && <Confetti />}
      {/* Casey speaks; the explicit button below owns navigation. */}
      <div className="cluey-band tutorial-finish-casey">
        <p className="cluey-bubble tutorial-finish-bubble" role="status">
          {winCopy ?? line.text}
        </p>
        {/* No award line any more: the practice's one-time award was a
            postcard, and the café world teaches stamps, not postcards
            (CW-13). The settled status stays readable on data-tutorial-award. */}
        <div className="tutorial-finish-mascot" aria-hidden="true">
          <div className="cluey-live">
            <ClueyFace mood={mood} />
          </div>
          <span className="cluey-name">
            Casey
          </span>
        </div>
      </div>
      <Tag
        size="wide"
        tone="primary"
        className="tutorial-full-round"
        label={tutorialFinishCtaCopy()}
        // On to the café's own puzzle, its finish-screen stamp lesson, the
        // Home spotlight and the suitcase tour: a first session and a
        // replayed intro alike. A replay's puzzle is dealt fresh as the first
        // café, beside the round the player had paused (src/ui/introRound.ts).
        onClick={() => leavePractice(!replay)}
      />
    </div>
  )
}
