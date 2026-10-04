import { canStartRun } from '../purchase/dailyGames'
import { useUi } from '../stores/uiStore'

/**
 * Every door into a run that is not the run screen's own Start (CW-15): Home's
 * Sightseeing tag and its Words / Articles chooser, and the train sheet's
 * "Catch the train". A free player whose two runs of today are used up gets
 * the upgrade dialog, never a door that does nothing; otherwise `begin` opens
 * the run. The run screen's own Start and "Walk again" ask `canStartRun`
 * themselves (SightseeingScreen.tsx), and so does the run, at its first
 * answer, through the results sink (O6).
 *
 * After a purchase, the dialog's thank-you button calls the retry: `begin`
 * then runs if a run may start now. It returns false because it has already
 * opened the run itself; the thank-you only goes to the board game for a deal
 * (PassScreen.tsx).
 *
 * Returns whether `begin` ran.
 */
export function beginRunOrOffer(begin: () => void): boolean {
  if (!canStartRun()) {
    useUi.getState().openDailyLimit(() => {
      if (canStartRun()) begin()
      return false
    })
    return false
  }
  begin()
  return true
}
