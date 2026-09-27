import type { CardRole, GameState } from '../engine/types'
import { boardKey, validateRequiredSet } from './identity'
import type { AttemptEvidence, AttemptOrigin, AuthoredBoardContent, BoardIdentity, GameDelta, RequiredBoardSet, RewardComponent, RewardDelta, Tier } from './types'

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
    if (!found.length || !sameOrder(wheel.segments, found) || !unique(wheel.translated) ||
      wheel.translated.some((id) => !found.includes(id)) || !unique(wheel.filled) ||
      wheel.filled.length !== wheel.translated.length || wheel.filled.some((i) => !Number.isInteger(i) || i < 0 || i >= found.length) ||
      !Number.isSafeInteger(wheel.attempts) || wheel.attempts < 0 || wheel.spent !== null ||
      wheel.landed === null || !Number.isInteger(wheel.landed) || wheel.landed < 0 || wheel.landed >= found.length) {
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

export function cityTier(required: RequiredBoardSet | null, bests: Readonly<Record<string, Tier>>): { tier: Tier | null; error: ReturnType<typeof validateRequiredSet> } {
  const error = validateRequiredSet(required)
  if (error) return { tier: null, error }
  const ranks = required!.boards.map((board) => TIERS.indexOf(bests[boardKey(board)]))
  return { tier: ranks.includes(-1) ? null : TIERS[Math.min(...ranks)], error: null }
}

/** Pure conjunction: readiness never grants content/access and never spends. */
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
