import { cafeSetFor, readSettledFacts } from '../journey/cafeAccess'
import { ensureFirstCafeFound } from '../onboarding/firstCafe'
import { boardKey } from '../progression/identity'
import { withIntroPuzzleAdmitted } from '../purchase/dailyGames'
import { useGame } from '../stores/gameStore'
import { useUi } from '../stores/uiStore'
import { dealOrFallBack } from './cafeDeal'

/**
 * A replayed intro sits down at a FRESH practice table (owner, 2026-10-04).
 * Whatever practice is on the table, from an earlier replay closed half-way
 * or any other session, is put away first, which gives back the course slot
 * it had paused; the new practice then pauses that same slot, untouched, and
 * is a demo that settles nothing (gameStore `tutorialDemo`). Called once, as
 * the replay's tutorial act opens (OnboardingScreen.tsx TutorialAct).
 */
export function dealReplayPractice(): void {
  const before = useGame.getState()
  if (before.mode === 'tutorial' && before.game) before.abandonGame()
  useGame.getState().newTutorialGame()
}

/**
 * A replayed intro's café puzzle (owner, 2026-10-04: "phase 2 of the intro is
 * a full game where at the end the stamp system gets explained. It's part of
 * the intro"). Real play, dealt fresh as the city's first café, the board a
 * first session plays, opening with Casey's clue. It records like any café
 * puzzle: stamp, learning, receipt; the daily limit never refuses it.
 *
 * The first café already played (or lost) is played again as a replay of it,
 * in the replay slot, so the player's own paused round in the primary slot is
 * not touched and is there to continue after the intro. A first café never
 * played is the next primary board itself. Returns whether a board is on the
 * table; when not (the player's replay slot holds another café's round, or a
 * settlement is in progress) the intro goes on without the full board.
 */
export function dealReplayBoard(): boolean {
  const s = useGame.getState()
  const first = cafeSetFor(0)?.boards[0]
  const facts = readSettledFacts()
  if (!first || !facts) return false
  const played = !!facts.boards[boardKey(first)] || !!facts.completedLosses[boardKey(first)]
  if (played) return withIntroPuzzleAdmitted(() => s.startReplay(first.authoredBoardId, false, 'ai'))
  // Never played: the next primary board, through the café gate like every
  // deal. A café no walk has found yet goes on to Home's lesson.
  const toLesson = () => useUi.getState().advanceOnboarding('home-return')
  return withIntroPuzzleAdmitted(() => dealOrFallBack(() => s.newGame({ cityIndex: 0, firstGiver: 'ai' }), toLesson))
}

/**
 * The practice's finish button (TutorialPractice.tsx): on to the café's own
 * puzzle, on a first session and on a replay alike. Any course slot the
 * practice paused comes back first, exactly as it was. A replay's board is
 * dealt here, in the same tap, so the paused round is never drawn as the
 * intro's board.
 */
export function leavePractice(persist: boolean): void {
  const game = useGame.getState()
  if (!game.restoreTutorialSuspension()) game.abandonGame()
  if (!persist && !dealReplayBoard()) {
    useUi.getState().advanceOnboarding('home-return')
    return
  }
  useUi.getState().advanceOnboarding('real-round')
}

/** A normal round is on the table: the intro's real-round act has something to show. */
function roundOnTable(): boolean {
  const { game, mode } = useGame.getState()
  return !!game && mode === 'normal'
}

/**
 * The intro's real-round act asks for its board (OnboardingScreen.tsx
 * RealRoundAct; CW-13, CW-15). The act draws nothing without a normal round,
 * so every way of not getting one ends the intro on Home rather than leaving
 * a blank screen. Returns the cleanup for the act's effect.
 *
 * - A first session (`persist`) deals the found café's own puzzle. Any
 *   refusal (the café gate, a settlement in progress) ends the intro at once.
 *   The daily limit never refuses it.
 * - A replayed intro's board is dealt by the practice's finish
 *   (`leavePractice`). Reached any other way without one, it deals it here;
 *   when none comes it goes on to Home's stamp lesson.
 */
export function openIntroRound(persist: boolean): () => void {
  const s = useGame.getState()
  if (roundOnTable()) return () => undefined
  if (!persist) {
    if (!dealReplayBoard()) useUi.getState().advanceOnboarding('home-return')
    return () => undefined
  }
  s.abandonGame()
  // It is the found café's own puzzle (CW-13). The walk found that café; a
  // path that skipped the walk (the website demo starts at the practice)
  // finds it here, so the café gate (CW-04) does not refuse it.
  ensureFirstCafeFound()
  // The first full board opens the way every normal board does: with
  // Casey's clue (owner, 2026-09-26).
  // Any refusal ends the intro, not only the café gate's (dealOrFallBack's own fallback).
  const finish = () => useUi.getState().finishOnboarding()
  const dealt = withIntroPuzzleAdmitted(() => dealOrFallBack(() => s.newGame({ cityIndex: 0, firstGiver: 'ai' }), finish))
  if (!dealt) useUi.getState().finishOnboarding()
  return () => undefined
}
