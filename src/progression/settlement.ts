import { boardKey, firstCompletionKey, milestoneKey, receiptKey, requiredSetKey } from './identity'
import { completedPrimaryCount, emptyProgressFacts, mergeProgressFacts } from './facts'
import { cityTier, claimDelta, evaluateAttempt, gameDelta, matchesAuthoredContent, maxTier, rewardEligibility } from './rules'
import type { AttemptEvidence, AttemptEventOwner, AuthoredBoardContent, CompletionReceipt, LearningEffect, LocalSettlement, PrimaryContinuation, RequiredBoardSet, SettledReceiptFact, SettlementEffect, SettlementLedger, SettlementPersistence } from './types'
import { effectKey } from './identity'
import { claimTutorialAward } from './tutorialAward'
import type { TutorialAwardIdentity } from './types'

export function emptySettlementLedger(): SettlementLedger {
  return { schemaVersion: 1, facts: emptyProgressFacts(), settlements: {} }
}

export function pendingEffects(settlement: LocalSettlement): SettlementEffect[] {
  return settlement.receipt.effects.filter((effect) => !settlement.acknowledgedEffects.includes(effect))
}

export function pendingSettlement(ledger: SettlementLedger): LocalSettlement | null {
  return Object.values(ledger.settlements).find((entry) => pendingEffects(entry).length > 0) ?? null
}

export function acceptsEvent(current: AttemptEventOwner | null, incoming: AttemptEventOwner): boolean {
  return current !== null && current.attemptId === incoming.attemptId && current.slot === incoming.slot && current.generation === incoming.generation
}

export interface SettlementInput {
  readonly attempt: AttemptEvidence
  readonly required: RequiredBoardSet | null
  readonly acceptedAt: number
  readonly localDate: string
  readonly learning: LearningEffect
  readonly continuation: PrimaryContinuation | null
  readonly dailyKey?: string
  /** Trusted lookup from C1-03; required for primary/replay progression. */
  readonly authoredContent: AuthoredBoardContent | null
  /** Explicit P04 identity; omitted for ordinary rounds and old callers. */
  readonly tutorialAward?: TutorialAwardIdentity
}

export type PrepareResult =
  | { readonly status: 'prepared' | 'existing'; readonly ledger: SettlementLedger; readonly receipt: CompletionReceipt }
  | { readonly status: 'blocked'; readonly reason: string }

/**
 * Pure proposal for ONE durable ledger replacement. No sink may run before the
 * adapter commits it. One unfinished settlement serializes all other writes.
 */
export function prepareSettlement(ledger: SettlementLedger, input: SettlementInput): PrepareResult {
  const { attempt, required } = input
  let id: string
  try { id = receiptKey(attempt.attemptId) } catch { return { status: 'blocked', reason: 'invalid-attempt-id' } }
  const existing = ledger.settlements[id]
  if (existing) {
    const accepted = existing.receipt.evidence
    if (attempt.origin !== accepted.origin || (attempt.board ? boardKey(attempt.board) : null) !== (accepted.board ? boardKey(accepted.board) : null)) return { status: 'blocked', reason: 'attempt-identity-conflict' }
    // A retried Finish reads the accepted evidence, never the caller's new view.
    return { status: 'existing', ledger, receipt: existing.receipt }
  }
  if (pendingSettlement(ledger)) return { status: 'blocked', reason: 'recover-pending-settlement' }
  const result = evaluateAttempt(attempt)
  if (result.status !== 'completed') return { status: 'blocked', reason: result.status === 'invalid' ? result.reason : result.status }
  if (!Number.isSafeInteger(input.acceptedAt) || input.acceptedAt < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(input.localDate)) return { status: 'blocked', reason: 'invalid-completion-time' }
  if (attempt.origin === 'daily' && !input.dailyKey?.trim()) return { status: 'blocked', reason: 'missing-daily-key' }
  const eligibility = rewardEligibility(attempt.origin, attempt.board, required)
  if (!eligibility.eligible && (attempt.origin === 'primary' || attempt.origin === 'replay')) return { status: 'blocked', reason: eligibility.reason }
  if (eligibility.eligible && (!input.authoredContent || boardKey(input.authoredContent.board) !== boardKey(attempt.board!) ||
    !matchesAuthoredContent(attempt.game, input.authoredContent))) return { status: 'blocked', reason: 'content-mismatch' }
  const key = eligibility.eligible ? boardKey(attempt.board!) : null
  const previous = key ? ledger.facts.boards[key] : undefined
  const priorLoss = key ? ledger.facts.completedLosses[key] : undefined
  if (attempt.origin === 'replay' && !previous && !priorLoss) return { status: 'blocked', reason: 'replay-needs-completed-board' }
  const previousBest = previous?.best ?? null
  const completedLoss = result.completedLoss
  const newBest = eligibility.eligible && !completedLoss ? maxTier(previousBest, result.tier) : previousBest
  const rewards = claimDelta(eligibility.eligible && !completedLoss ? result.components : [], previous?.claims ?? [])
  let facts = ledger.facts
  let tutorialAward: CompletionReceipt['tutorialAward']
  if (attempt.origin === 'tutorial' && input.tutorialAward) {
    const claimed = claimTutorialAward(facts, input.tutorialAward, attempt, input.acceptedAt)
    if (claimed.status !== 'not-eligible') {
      facts = claimed.facts
      tutorialAward = { identity: input.tutorialAward, sourceAttemptId: attempt.attemptId, status: claimed.status, postcards: claimed.postcards }
    }
  }
  let primary: CompletionReceipt['primary'] = null
  const newMilestoneIds: string[] = []
  if (eligibility.eligible) {
    const board = attempt.board!
    facts = mergeProgressFacts(facts, completedLoss
      ? { ...emptyProgressFacts(), completedLosses: { [key!]: { board, firstPrimary: attempt.origin === 'primary' } } }
      : { ...emptyProgressFacts(), boards: { [key!]: { board, best: newBest!, claims: rewards.newlyClaimed } } })
    if (attempt.origin === 'primary') {
      const continuation = input.continuation
      const requiredKeys = required!.boards.map(boardKey)
      if (!continuation || requiredSetKey(continuation.requiredSet) !== requiredSetKey(required!) || continuation.remainingBoardKeys[0] !== key ||
        new Set(continuation.remainingBoardKeys).size !== continuation.remainingBoardKeys.length || continuation.remainingBoardKeys.some((entry) => !requiredKeys.includes(entry)) ||
        required!.boards.some((entry) => !facts.firstPrimaryCompletions[firstCompletionKey(entry)] && !facts.completedLosses[boardKey(entry)] && !continuation.remainingBoardKeys.includes(boardKey(entry)))) {
        return { status: 'blocked', reason: 'invalid-primary-continuation' }
      }
      // A restore may already prove this active primary complete. Its slot is
      // preserved, but no second first-completion or milestone can be created.
      const completionId = firstCompletionKey(board)
      const first = !facts.firstPrimaryCompletions[completionId]
      const set = { courseId: required!.courseId, cityId: required!.cityId, setVersion: required!.setVersion }
      if (first && !completedLoss) {
        facts = { ...facts, firstPrimaryCompletions: { ...facts.firstPrimaryCompletions, [completionId]: { board, requiredSet: set } } }
        const count = completedPrimaryCount(facts, required!)
        if (count % 10 === 0) {
          const milestoneId = milestoneKey(set, count)
          if (!facts.milestones[milestoneId]) {
            facts = { ...facts, milestones: { ...facts.milestones, [milestoneId]: { requiredSet: set, completedCount: count, notificationHandled: false } } }
            newMilestoneIds.push(milestoneId)
          }
        }
      }
      const stillMissing = (entry: string) => {
        const board = required!.boards.find((b) => boardKey(b) === entry)!
        return !facts.firstPrimaryCompletions[firstCompletionKey(board)] && !facts.completedLosses[entry]
      }
      primary = { completedBoardKey: key!, firstCompletionId: first && !completedLoss ? completionId : null, nextBoardKey: continuation.remainingBoardKeys.slice(1).find(stillMissing) ?? null }
    }
    const achievement = completedLoss ? { tier: null } : cityTier(required, Object.fromEntries(Object.entries(facts.boards).map(([boardId, progress]) => [boardId, progress.best])))
    if (achievement.tier) {
      const set = { courseId: required!.courseId, cityId: required!.cityId, setVersion: required!.setVersion }
      facts = mergeProgressFacts(facts, { ...emptyProgressFacts(), cityAchievements: { [requiredSetKey(set)]: { requiredSet: set, tier: achievement.tier } } })
    }
  }
  const games = gameDelta(attempt.origin, result.outcome)
  const effects: SettlementEffect[] = ['learning']
  if (games.played) effects.push('games', 'streak', 'associations')
  if (attempt.origin === 'daily') effects.push('daily')
  effects.push('session')
  if (newMilestoneIds.length) effects.push('lessons')
  const receipt: CompletionReceipt = structuredClone({
    schemaVersion: 1, contractRevision: 'C1-G1-A1', receiptId: id, attemptId: attempt.attemptId,
    acceptedAt: input.acceptedAt, localDate: input.localDate, evidence: attempt,
    attemptTier: result.tier, completedLoss, previousBest, newBest: completedLoss && !previous ? null : newBest, cityEligible: eligibility.eligible, rewards,
    learning: input.learning, games, dailyKey: attempt.origin === 'daily' ? input.dailyKey! : null,
    primary, newMilestoneIds, effects, ...(tutorialAward ? { tutorialAward } : {}),
  })
  return { status: 'prepared', receipt, ledger: { ...ledger, facts: structuredClone(facts), settlements: { ...ledger.settlements, [id]: { receipt, acknowledgedEffects: [] } } } }
}

/** Call only AFTER the sink's atomic effect+marker write has succeeded. */
export function acknowledgeEffect(ledger: SettlementLedger, receiptId: string, effect: SettlementEffect): SettlementLedger {
  const entry = ledger.settlements[receiptId]
  if (!entry || !entry.receipt.effects.includes(effect)) throw new Error('Unknown receipt effect')
  if (entry.acknowledgedEffects.includes(effect)) return ledger
  const acknowledgedEffects = entry.receipt.effects.filter((candidate) => candidate === effect || entry.acknowledgedEffects.includes(candidate))
  return { ...ledger, settlements: { ...ledger.settlements, [receiptId]: { ...entry, acknowledgedEffects } } }
}

/** Receipt MUST already be durable. A failed sink or acknowledgement stops recovery. */
export async function recoverSettlement(durableLedger: SettlementLedger, persistence: SettlementPersistence): Promise<SettlementLedger> {
  let ledger = durableLedger
  for (const entry of Object.values(durableLedger.settlements)) {
    for (const effect of pendingEffects(entry)) {
      await persistence.applyEffectOnce(effectKey(entry.receipt.receiptId, effect), effect, entry.receipt)
      const next = acknowledgeEffect(ledger, entry.receipt.receiptId, effect)
      await persistence.commitLedger(next)
      ledger = next
    }
  }
  return ledger
}

/** Export only after local recovery. Receipts are facts, never recovery jobs. */
export function settledReceiptFacts(ledger: SettlementLedger): readonly SettledReceiptFact[] {
  if (pendingSettlement(ledger)) throw new Error('Recover local settlement before export/import')
  return Object.values(ledger.settlements).map(({ receipt: r }) => ({
    schemaVersion: r.schemaVersion, contractRevision: r.contractRevision, receiptId: r.receiptId, attemptId: r.attemptId,
    acceptedAt: r.acceptedAt, localDate: r.localDate, attemptTier: r.attemptTier, completedLoss: r.completedLoss, previousBest: r.previousBest, newBest: r.newBest,
    cityEligible: r.cityEligible, rewards: r.rewards, games: r.games, board: r.evidence.board, origin: r.evidence.origin,
    newlyCollected: r.learning.newlyCollected, newlyDiscovered: r.learning.newlyDiscovered,
  }))
}
