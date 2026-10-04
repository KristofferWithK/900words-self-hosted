import { wheelMissedSegments } from '../engine/game'
import type { CardRole, GameState } from '../engine/types'
import { boardKey, validateRequiredSet } from './identity'
import type { AttemptEvidence, AttemptOrigin, AuthoredBoardContent, BoardIdentity, GameDelta, ProgressFacts, RequiredBoardSet, RewardComponent, RewardDelta, Tier } from './types'

export const TIERS: readonly Tier[] = ['bronze', 'silver', 'gold', 'platinum']
export const COMPONENTS: readonly RewardComponent[] = ['spinWin', 'solved', 'solvedAndTranslated']
export const REWARD_WEIGHTS: Readonly<Record<RewardComponent, number>> = { spinWin: 1, solved: 1, solvedAndTranslated: 2 }
export const PROVISIONAL_TRAVEL_THRESHOLD = 100

export function maxTier(a: Tier | null, b: Tier | null): Tier | null {
  if (a === null) return b
  if (b === null) return a
  return TIERS[Math.max(TIERS.indexOf(a), TIERS.indexOf(b))]
}

const unique = <T>(items: readonly T[]): boolean => new Set(items).size === items.length
const sameOrder = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((v, i) => v === b[i])

/** Validates both full keys; overlap is counted once and neutral tiles stay out. */
export function targetUnion(words: readonly string[], playerKey: Readonly<Record<string, CardRole>>, aiKey: Readonly<Record<string, CardRole>>): string[] | null {
  if (!words.length || !unique(words) || words.some((word) => !word.trim())) return null
  for (const key of [playerKey, aiKey]) {
    if (Object.keys(key).length !== words.length || Object.keys(key).some((id) => !words.includes(id)) ||
      words.some((id) => key[id] !== 'green' && key[id] !== 'bystander')) return null
  }
  const targets = words.filter((id) => playerKey[id] === 'green' || aiKey[id] === 'green')
  return targets.length ? targets : null
}

export type AttemptResult =
  | { readonly status: 'pending' | 'cancelled' }
  | { readonly status: 'invalid'; readonly reason: 'invalid-targets' | 'invalid-wheel' | 'invalid-terminal' | 'retired-origin' }
  | { readonly status: 'completed'; readonly tier: Tier; readonly solved: boolean; readonly fullyTranslated: boolean; readonly outcome: 'won' | 'lost'; readonly completedLoss: boolean; readonly components: readonly RewardComponent[] }

/** Only the supplied attempt can prove Platinum; no saved claims enter this rule. */
export function evaluateAttempt(attempt: AttemptEvidence): AttemptResult {
  const game = attempt.game
  if (attempt.origin === 'retired-wrapup') return { status: 'invalid', reason: 'retired-origin' }
  if (game.phase !== 'finished') return { status: attempt.cancelled ? 'cancelled' : 'pending' }
  const words = game.words.map((word) => word.wordId)
  const targets = targetUnion(words, game.playerKey, game.aiKey)
  if (!targets || Object.keys(game.reveals).some((id) => !words.includes(id)) || words.some((id) => !game.reveals[id]) ||
    words.some((id) => game.reveals[id].kind === 'green' && !targets.includes(id))) {
    return { status: 'invalid', reason: 'invalid-targets' }
  }
  const found = targets.filter((id) => game.reveals[id].kind === 'green')
  const solved = found.length === targets.length
  const wheel = game.wheel
  let fullyTranslated = false
  let won = false
  if (wheel) {
    // The wheel holds every key word since 2026-09-27 (the missed ones' slices
    // can never fill); a round settled from an older save holds only the
    // found words. Both shapes are honest evidence.
    const size = wheel.segments.length
    const missed = wheelMissedSegments(game)
    if (!found.length || !(sameOrder(wheel.segments, found) || sameOrder(wheel.segments, targets)) || !unique(wheel.translated) ||
      wheel.translated.some((id) => !found.includes(id)) || !unique(wheel.filled) ||
      wheel.filled.length !== wheel.translated.length || wheel.filled.some((i) => !Number.isInteger(i) || i < 0 || i >= size || missed.includes(i)) ||
      !Number.isSafeInteger(wheel.attempts) || wheel.attempts < 0 || wheel.spent !== null ||
      wheel.landed === null || !Number.isInteger(wheel.landed) || wheel.landed < 0 || wheel.landed >= size) {
      return { status: 'invalid', reason: 'invalid-wheel' }
    }
    won = wheel.filled.includes(wheel.landed)
    if (wheel.result !== (won ? 'win' : 'miss') || game.outcome?.result !== (won ? 'won' : 'lost') ||
      game.outcome.reason !== (won ? 'wheel-win' : 'wheel-miss')) return { status: 'invalid', reason: 'invalid-wheel' }
    fullyTranslated = wheel.translated.length === found.length
  } else if (solved || game.outcome?.result !== 'lost' ||
    (game.outcome.reason !== 'sudden-death' && game.outcome.reason !== 'timeout')) {
    return { status: 'invalid', reason: 'invalid-terminal' }
  }
  const tier: Tier = solved ? (fullyTranslated ? 'platinum' : 'gold') : (won ? 'silver' : 'bronze')
  const components: RewardComponent[] = []
  if (won) components.push('spinWin')
  if (solved) components.push('solved')
  if (solved && fullyTranslated) components.push('solvedAndTranslated')
  return { status: 'completed', tier, solved, fullyTranslated, outcome: won ? 'won' : 'lost', completedLoss: !won, components }
}

export type Eligibility = { readonly eligible: true } | { readonly eligible: false; readonly reason: string }
export function rewardEligibility(origin: AttemptOrigin, board: BoardIdentity | null, required: RequiredBoardSet | null): Eligibility {
  if (origin !== 'primary' && origin !== 'replay') return { eligible: false, reason: 'excluded-origin' }
  const error = validateRequiredSet(required)
  if (error) return { eligible: false, reason: error }
  if (!board) return { eligible: false, reason: 'unknown-board' }
  try {
    if (!required!.boards.some((entry) => boardKey(entry) === boardKey(board))) return { eligible: false, reason: 'unknown-board' }
  } catch { return { eligible: false, reason: 'unknown-board' } }
  return { eligible: true }
}

export function claimDelta(eligible: readonly RewardComponent[], held: readonly RewardComponent[]): RewardDelta {
  const available = COMPONENTS.filter((component) => eligible.includes(component))
  const newlyClaimed = available.filter((component) => !held.includes(component))
  return {
    eligible: available,
    alreadyHeld: available.filter((component) => held.includes(component)),
    newlyClaimed,
    postcards: newlyClaimed.reduce((total, component) => total + REWARD_WEIGHTS[component], 0),
  }
}

export function gameDelta(origin: AttemptOrigin, outcome: 'won' | 'lost'): GameDelta {
  const played = origin !== 'tutorial' && origin !== 'retired-wrapup' ? 1 : 0
  return { played, won: played && outcome === 'won' ? 1 : 0, lost: played && outcome === 'lost' ? 1 : 0, redeemed: 0 }
}

/**
 * The lowest personal best over the frozen required set: the rule the stored
 * `cityAchievements` fact was written under (C1-PC-1 AC17) and the one backup
 * import still proves that fact against. It is no longer the medal shown: the
 * café world's medal is `cityMedalFromStamps` below (owner, 2026-10-04).
 */
export function cityTier(required: RequiredBoardSet | null, bests: Readonly<Record<string, Tier>>): { tier: Tier | null; error: ReturnType<typeof validateRequiredSet> } {
  const error = validateRequiredSet(required)
  if (error) return { tier: null, error }
  const ranks = required!.boards.map((board) => TIERS.indexOf(bests[boardKey(board)]))
  return { tier: ranks.includes(-1) ? null : TIERS[Math.min(...ranks)], error: null }
}

/*
 * The café world (docs/roadmap/cafe-world.md, section 4). Each required board
 * is a café. Finishing its puzzle stamps the café's card. A won round stamps
 * it with the tier reached, and that stamp IS the board's saved best
 * (`BoardProgress.best`); `maxTier` already keeps a replay from lowering it.
 * A completed loss earns Bronze (owner, 4 October 2026), whatever tier the
 * attempt reached: settlement still writes no best for it (only
 * `completedLosses`), so the Bronze is read here, from that fact, and never
 * stored. Old saves with completed losses therefore show Bronze as they are,
 * and the stored `cityAchievements` rule and its backup proof are unchanged.
 */

/**
 * A café's stamp: its best tier from won rounds, or Bronze when it has none
 * but a completed loss on record. A loss never lowers a better stamp, and a
 * later win raises Bronze, because a won best is always Silver or above.
 */
export function cafeStamp(best: Tier | null | undefined, completedLoss: boolean): Tier | null {
  const won = best !== undefined && best !== null && TIERS.includes(best) ? best : null
  return maxTier(won, completedLoss ? 'bronze' : null)
}

/** Every café stamp the facts hold, by board key: saved bests, and Bronze for a café only ever lost. */
export function savedStamps(facts: Pick<ProgressFacts, 'boards' | 'completedLosses'>): Record<string, Tier> {
  const stamps: Record<string, Tier> = {}
  for (const key of new Set([...Object.keys(facts.boards), ...Object.keys(facts.completedLosses)])) {
    const stamp = cafeStamp(facts.boards[key]?.best, Object.hasOwn(facts.completedLosses, key))
    if (stamp) stamps[key] = stamp
  }
  return stamps
}

/** What a stamp is worth towards the city medal. */
export const STAMP_POINTS: Readonly<Record<Tier, number>> = Object.freeze({ bronze: 1, silver: 2, gold: 3, platinum: 4 })
/** The medal levels, as a share of the city's possible points (4 per café). */
export const MEDAL_LEVELS: readonly { readonly tier: Tier; readonly percent: number }[] = Object.freeze([
  Object.freeze({ tier: 'bronze' as Tier, percent: 25 }), Object.freeze({ tier: 'silver' as Tier, percent: 50 }),
  Object.freeze({ tier: 'gold' as Tier, percent: 75 }), Object.freeze({ tier: 'platinum' as Tier, percent: 100 }),
])

export function stampPoints(stamp: Tier | null): number {
  return stamp === null ? 0 : STAMP_POINTS[stamp]
}

export interface CityStamps {
  /** Every required café by board key; null where the card has no stamp yet. */
  readonly stamps: Readonly<Record<string, Tier | null>>
  readonly cafes: number
  readonly stamped: number
  readonly points: number
  /** 4 x the required cafés; 0 when the manifest is missing or empty. */
  readonly maximum: number
  /** points / maximum as a percentage, unrounded; 0 when there is no maximum. */
  readonly percent: number
  readonly error: ReturnType<typeof validateRequiredSet>
}

/** The stamp card of a city: one stamp per required café, read from `savedStamps`. */
export function cityStamps(required: RequiredBoardSet | null, stamps: Readonly<Record<string, Tier>>): CityStamps {
  const error = validateRequiredSet(required)
  if (error) return { stamps: {}, cafes: 0, stamped: 0, points: 0, maximum: 0, percent: 0, error }
  const card = Object.fromEntries(required!.boards.map((board) => {
    const key = boardKey(board)
    const stamp = stamps[key]
    return [key, stamp !== undefined && TIERS.includes(stamp) ? stamp : null]
  })) as Record<string, Tier | null>
  const values = Object.values(card)
  const points = values.reduce((sum, stamp) => sum + stampPoints(stamp), 0)
  const maximum = STAMP_POINTS.platinum * values.length
  return { stamps: card, cafes: values.length, stamped: values.filter((stamp) => stamp !== null).length, points, maximum, percent: (points / maximum) * 100, error: null }
}

/**
 * The medal a share of points earns. Integer arithmetic on the boundary, so
 * 25 of 100 points is Bronze and 249 of 1000 is not; no float decides.
 */
export function medalForPoints(points: number, maximum: number): Tier | null {
  if (!Number.isSafeInteger(points) || !Number.isSafeInteger(maximum) || maximum <= 0 || points < 0 || points > maximum) throw new Error('Invalid stamp points')
  for (const level of [...MEDAL_LEVELS].reverse()) {
    if (points * 100 >= level.percent * maximum) return level.tier
  }
  return null
}

/** The café world's city medal: the percentage of possible stamp points. */
export function cityMedalFromStamps(required: RequiredBoardSet | null, stamps: Readonly<Record<string, Tier>>): CityStamps & { readonly tier: Tier | null } {
  const card = cityStamps(required, stamps)
  return { ...card, tier: card.error ? null : medalForPoints(card.points, card.maximum) }
}

/**
 * The seam for the train run (card CW-07, not built): the run is the only way
 * onto the train, and stamps, medals and postcards do not travel. Pure
 * conjunction, like `travelStatus`: it grants no content or access.
 */
export function trainTravelStatus(trainRunPassed: boolean, destinationAvailable: boolean, accessAllowed: boolean) {
  const ready = trainRunPassed === true
  return { trainRunPassed: ready, ready, canBoard: ready && destinationAvailable && accessAllowed }
}

/**
 * Postcard readiness. Pure conjunction: readiness never grants content/access
 * and never spends. On the café-world line this is not the travel rule any
 * more (`trainTravelStatus` is); Home and the map still read it through
 * `journeyTravelGate` until the screen cards switch them over.
 */
export function travelStatus(earned: number, threshold: number, historicalEligibility: boolean, destinationAvailable: boolean, accessAllowed: boolean) {
  if (!Number.isSafeInteger(earned) || earned < 0 || !Number.isSafeInteger(threshold) || threshold <= 0) throw new Error('Invalid travel amounts')
  const thresholdReady = earned >= threshold
  const ready = thresholdReady || historicalEligibility
  return { earned, remaining: Math.max(0, threshold - earned), thresholdReady, historicalEligibility, ready, canBoard: ready && destinationAvailable && accessAllowed }
}

/** Canonical lookup must supply content; a saved authored ID alone is no proof. */
export function matchesAuthoredContent(game: GameState, content: AuthoredBoardContent): boolean {
  return sameOrder(game.words.map((word) => word.wordId), content.wordIds) &&
    unique(content.playerGreenIds) && unique(content.aiGreenIds) &&
    content.playerGreenIds.every((id) => content.wordIds.includes(id)) && content.aiGreenIds.every((id) => content.wordIds.includes(id)) &&
    content.wordIds.every((id) => game.playerKey[id] === (content.playerGreenIds.includes(id) ? 'green' : 'bystander') &&
      game.aiKey[id] === (content.aiGreenIds.includes(id) ? 'green' : 'bystander'))
}
