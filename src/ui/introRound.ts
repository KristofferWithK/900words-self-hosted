import { ensureFirstCafeFound } from '../onboarding/firstCafe'
import { useGame } from '../stores/gameStore'
import { useUi } from '../stores/uiStore'
import { dealOrFallBack } from './cafeDeal'

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
 *   refusal (the café gate, the daily limit, a settlement in progress) ends
 *   the intro at once. A daily-limit dialog the refusal opened then shows
 *   over Home, since it never covers a first session.
 * - A replayed intro resumes the player's own next board (`resumePrimary`,
 *   which deals one when none is waiting). If that is refused, the intro ends:
 *   at once, or, when the refusal opened the daily-limit dialog (which shows
 *   over a replayed intro), once the dialog closes. A purchase made in the
 *   dialog deals the board through its retry, and then the intro stays.
 */
export function openIntroRound(persist: boolean): () => void {
  const s = useGame.getState()
  if (roundOnTable()) return () => undefined
  s.abandonGame()
  if (persist) {
    // It is the found café's own puzzle (CW-13). The walk found that café; a
    // path that skipped the walk (the website demo starts at the practice)
    // finds it here, so the café gate (CW-04) does not refuse it.
    ensureFirstCafeFound()
    // The first full board opens the way every normal board does: with
    // Casey's clue (owner, 2026-09-26).
    // Any refusal ends the intro, not only the café gate's (dealOrFallBack's own fallback).
    const dealt = dealOrFallBack(() => s.newGame({ cityIndex: 0, firstGiver: 'ai' }), () => useUi.getState().finishOnboarding())
    if (!dealt) useUi.getState().finishOnboarding()
    return () => undefined
  }
  // A replayed intro's full board is the player's own next one, the board
  // Home's Café puzzle would give them, not City 1's first.
  s.resumePrimary()
  return leaveIntroUnlessDealt()
}

/** End the intro when no round came: now, or when the daily-limit dialog closes. Returns the cleanup. */
export function leaveIntroUnlessDealt(): () => void {
  if (roundOnTable()) return () => undefined
  if (!useUi.getState().dailyLimitOpen) {
    useUi.getState().finishOnboarding()
    return () => undefined
  }
  const stop = useUi.subscribe((state) => {
    if (state.dailyLimitOpen) return
    stop()
    if (!roundOnTable()) useUi.getState().finishOnboarding()
  })
  return stop
}
