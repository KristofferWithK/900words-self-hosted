import { cafeNameForBoard } from '../../cafe/cafeName'
import { cityStampCard } from '../../journey/progress'
import { boardKey } from '../../progression/identity'
import { cafeStamp, cityStamps, medalForPoints, TIERS } from '../../progression/rules'
import type { CompletionReceipt, ProgressFacts, RequiredBoardSet, Tier } from '../../progression/types'

/**
 * What the finish screen's stamp line says about one settled round
 * (docs/roadmap/cafe-world.md section 6: "Platinum stamp on your Café Solen
 * card" with the city percentage beside it).
 *
 * - `new`: this round stamped the café for the first time or raised its
 *   stamp. The stamp lands. A lost first visit lands Bronze (owner,
 *   4 October 2026: a completed loss earns a Bronze stamp).
 * - `kept`: the café already had this stamp and the round did not raise it
 *   (a replay at the same or a lower tier, or a lost replay). Nothing lands.
 *
 * Every café round is completed, so every one leaves the café a stamp: there
 * is no stampless state any more.
 */
export type FinishStampState = 'new' | 'kept'

export interface FinishStamp {
  readonly state: FinishStampState
  /** The café's stamp after this round. */
  readonly tier: Tier
  /** Null where the board has no café name yet (see `cafeNameForBoard`). */
  readonly cafeName: string | null
  /** The city's stamp share after this round, floored to a whole percent. */
  readonly cityPercent: number
  /** The city medal after this round (25/50/75/100%), null below Bronze. */
  readonly cityMedal: Tier | null
}

const rank = (tier: Tier | null | undefined) => (tier ? TIERS.indexOf(tier) : -1)

/**
 * A percentage for display only: floored, so 99.75% reads 99% and 100% is
 * shown only when every café is Platinum (the medal's own integer rule
 * decides the tier; this never rounds a city into a medal it does not have).
 */
export function displayCityPercent(points: number, maximum: number): number {
  if (!Number.isSafeInteger(points) || !Number.isSafeInteger(maximum) || maximum <= 0 || points < 0 || points > maximum) return 0
  return Math.floor((points * 100) / maximum)
}

/**
 * The stamp line for a settled receipt, read with the CW-03 rules
 * (`cityStampCard`, `cafeStamp`, `cityStamps`, `medalForPoints`); it decides
 * nothing itself. Null when the round was not a café of `required` (a board
 * outside the required set, a later city, a tutorial or daily round): those
 * rounds have no stamp card.
 *
 * The café's stamp before and after the round come from the receipt alone:
 * after is its `newBest`, or Bronze for a completed loss (`cafeStamp`); before
 * is its `previousBest`, or Bronze for a replay without one, because a replay
 * needs a best or a completed loss on record and the loss is Bronze. (A
 * primary round's receipt cannot say whether an imported save had already
 * recorded a loss on that board; such a rare round reads as a first visit and
 * its Bronze lands again. The card and the percentage are right either way.)
 *
 * The percentage is the city's after THIS round. The saved facts normally
 * already hold this round's stamp (settlement writes them with the receipt);
 * if they do not yet, the round's own stamp is laid over them, so the line
 * can never show the city as it was before the round.
 */
export function finishStamp(receipt: CompletionReceipt, facts: ProgressFacts, required: RequiredBoardSet): FinishStamp | null {
  const board = receipt.evidence.board
  if (!receipt.cityEligible || !board) return null
  const key = boardKey(board)
  let card = cityStampCard(facts, required)
  if (card.error || !(key in card.stamps)) return null
  const loss = receipt.completedLoss === true || receipt.evidence.game.outcome?.result === 'lost'
  const after = cafeStamp(receipt.newBest, loss)
  // A won café round always has a best, so this is unreachable on a valid receipt.
  if (!after) return null
  const before = cafeStamp(receipt.previousBest, receipt.evidence.origin === 'replay')
  if (rank(card.stamps[key]) < rank(after)) {
    const stamps = Object.fromEntries(Object.entries(card.stamps).filter((entry): entry is [string, Tier] => entry[1] !== null))
    card = cityStamps(required, { ...stamps, [key]: after })
  }
  return {
    state: rank(after) > rank(before) ? 'new' : 'kept',
    tier: after,
    cafeName: cafeNameForBoard(board),
    cityPercent: displayCityPercent(card.points, card.maximum),
    cityMedal: medalForPoints(card.points, card.maximum),
  }
}
