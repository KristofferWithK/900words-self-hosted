import { useGame } from '../stores/gameStore'

/**
 * Deal the next board, and when the board game refuses because the next café
 * has not been found in Sightseeing yet (CW-04's gate, `lastDealRefusal ===
 * 'cafeNotFound'`), run `fallBack` instead of leaving the player on a control
 * that did nothing. Home opens Sightseeing with a line saying so; the finish
 * screen's "Play next game" goes Home; onboarding's first café puzzle, whose
 * café the first session has always found by then, would fall back to Home.
 *
 * A daily-limit refusal is not this function's: it opened its own offer.
 * Returns what the deal returned.
 */
export function dealOrFallBack(deal: () => boolean, fallBack: () => void): boolean {
  const dealt = deal()
  if (!dealt && useGame.getState().lastDealRefusal === 'cafeNotFound') fallBack()
  return dealt
}
