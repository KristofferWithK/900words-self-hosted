import { z } from 'zod'
import { emptyProgressFacts, mergeProgressFacts } from './facts'
import { boardKey, receiptKey, tutorialAwardKey } from './identity'
import { claimDelta, evaluateAttempt, gameDelta, maxTier, REWARD_WEIGHTS } from './rules'
import { roundLearningResults } from '../srs/settlement'
import type { AttemptEvidence, CompletionReceipt, CourseSessions, SettlementLedger } from './types'

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const id = z.string().min(1)
const record = <T extends z.ZodType>(value: T) => z.record(id, value)
export const markersSchema = record(id)
const city = z.object({ courseId: z.enum(['da', 'de']), cityId: id })
const board = city.extend({ authoredBoardId: id, contentRevision: id })
const requiredSet = city.extend({ setVersion: id })
const tutorialAward = z.object({ identity: city.extend({ profileKey: id, policyRevision: id }), sourceAttemptId: id, acceptedAt: count })
const tutorialAwardReceipt = z.object({ identity: city.extend({ profileKey: id, policyRevision: id }), sourceAttemptId: id, status: z.enum(['new', 'already-held']), postcards: z.union([z.literal(0), z.literal(1)]) })
const tier = z.enum(['bronze', 'silver', 'gold', 'platinum'])
const component = z.enum(['spinWin', 'solved', 'solvedAndTranslated'])
const uniqueIds = z.array(id).refine((ids) => new Set(ids).size === ids.length)
const components = z.array(component).refine((ids) => new Set(ids).size === ids.length)
const effect = z.enum(['learning', 'games', 'streak', 'associations', 'daily', 'session', 'lessons'])
export const wordStatsSchema = z.object({
  box: count.max(4), lastSeenAt: count, seen: count, correctGuesses: count, misses: count,
  lookups: count, redemptionRight: count, redemptionWrong: count, greenByClue: count, greenByGuess: count,
}).passthrough()
export const tallySchema = z.object({ played: count, won: count, redeemed: count, lost: count }).passthrough()
const result = z.object({ wordId: id, guessedGreen: z.boolean(), guessedWrong: z.boolean(),
  greenByOwnClue: z.boolean(), greenByOwnGuess: z.boolean(), lookedUp: z.boolean(), packingMissed: z.boolean().optional() })
const side = z.enum(['player', 'ai'])
const role = z.enum(['green', 'bystander'])
export const gameSchema = z.object({
  config: z.object({ rows: count, cols: count, totalWords: count, greensPerSide: count,
    greenOverlap: count, turnTokens: count, maxNewWordsPerBoard: count }).passthrough(),
  seed: count, words: z.array(z.object({ wordId: id, da: z.string(), en: z.array(z.string()), pos: z.string() }).passthrough()),
  reveals: record(z.union([z.object({ kind: z.enum(['hidden', 'green']) }),
    z.object({ kind: z.literal('bystander'), against: z.array(side) })])),
  playerKey: record(role), aiKey: record(role),
  phase: z.enum(['playerClueInput', 'aiGuessing', 'aiClueInput', 'playerGuessing', 'suddenDeath', 'translateChallenge', 'translateWheel', 'finished']),
  turnsLeft: count,
  clueHistory: z.array(z.object({ by: side, text: z.string(), number: count,
    guesses: z.array(z.object({ wordId: id, result: role }).passthrough()) }).passthrough()),
  outcome: z.object({ result: z.enum(['won', 'lost']), reason: z.enum(['all-greens', 'wheel-win', 'timeout', 'sudden-death', 'wheel-miss', 'wheel-spent-exhausted']) }).optional(),
  wheel: z.object({ segments: uniqueIds, translated: uniqueIds, filled: z.array(count), attempts: count,
    landed: count.nullable(), result: z.enum(['win', 'miss']).nullable(), spent: side.nullable() }).optional(),
}).passthrough()
const evidence = z.object({ attemptId: id, board: board.nullable(), origin: z.enum(['primary', 'replay', 'daily', 'developer', 'optional', 'tutorial', 'retired-wrapup']),
  game: gameSchema, cancelled: z.boolean().optional() })
const facts = z.object({
  boards: record(z.object({ board, best: tier, claims: components })),
  completedLosses: record(z.object({ board, firstPrimary: z.boolean() })).default({}),
  firstPrimaryCompletions: record(z.object({ board, requiredSet })),
  milestones: record(z.object({ requiredSet, completedCount: count, notificationHandled: z.boolean() })),
  cityAchievements: record(z.object({ requiredSet, tier })),
  legacyCredit: z.object({ identity: z.literal('danish-city1-legacy-v1'), amount: count }),
  tutorialAwards: record(tutorialAward).default({}),
})
export const curriculumSchema = z.object({
  routeLanguage: id, itemStates: record(z.enum(['locked', 'offered', 'available', 'deferred', 'skipped', 'completed'])),
  evidence: record(z.array(z.object({}).passthrough())), dueAt: record(count), activeItemId: id.nullable(),
  sentenceReviewEvidence: record(z.array(z.object({}).passthrough())),
}).passthrough()
export const survivalSchema = z.object({ routeLanguage: id, exchanges: record(z.object({
  unlockedAt: count, firstCompletedAt: count.optional(), replayedAt: z.array(count),
}).passthrough()) }).passthrough()
const receipt = z.object({
  schemaVersion: z.literal(1), contractRevision: z.enum(['C1-PC-1', 'C1-G1-A1']), receiptId: id, attemptId: id,
  acceptedAt: count, localDate: z.iso.date(), evidence, attemptTier: tier, previousBest: tier.nullable(), newBest: tier.nullable(),
  completedLoss: z.boolean().optional(),
  cityEligible: z.boolean(), rewards: z.object({ eligible: components, alreadyHeld: components, newlyClaimed: components, postcards: count }),
  tutorialAward: tutorialAwardReceipt.optional(),
  learning: z.object({ results: z.array(result), changes: z.array(z.object({ wordId: id, before: wordStatsSchema.nullable(), after: wordStatsSchema })),
    newlyCollected: uniqueIds, newlyDiscovered: uniqueIds }),
  games: z.object({ played: count.max(1), won: count.max(1), lost: count.max(1), redeemed: z.literal(0) }),
  dailyKey: id.nullable(), primary: z.object({ completedBoardKey: id, firstCompletionId: id.nullable(), nextBoardKey: id.nullable() }).nullable(),
  newMilestoneIds: uniqueIds, effects: z.array(effect),
  lessons: z.object({ courseId: z.enum(['da', 'de']),
    curriculum: z.object({ before: curriculumSchema.nullable(), after: curriculumSchema }),
    survival: z.object({ before: survivalSchema.nullable(), after: survivalSchema }) }).optional(),
})
const ledgerSchema = z.object({ schemaVersion: z.literal(1), facts,
  settlements: record(z.object({ receipt, acknowledgedEffects: z.array(effect) })) })

export function parseLedger(value: unknown): SettlementLedger {
  const raw = value as Record<string, unknown>
  const ledger = ledgerSchema.parse({ ...raw,
    facts: { ...((raw.facts ?? {}) as Record<string, unknown>), completedLosses: (((raw.facts ?? {}) as Record<string, unknown>).completedLosses ?? {}), tutorialAwards: (((raw.facts ?? {}) as Record<string, unknown>).tutorialAwards ?? {}) },
  }) as unknown as SettlementLedger
  mergeProgressFacts(emptyProgressFacts(), ledger.facts) // Validate identity-key correlations.
  let pending = 0
  for (const [key, entry] of Object.entries(ledger.settlements)) {
    const r = entry.receipt
    const evaluation = evaluateAttempt(r.evidence as AttemptEvidence)
    const expectedEffects = ['learning', ...(r.games.played ? ['games', 'streak', 'associations'] : []),
      ...(r.evidence.origin === 'daily' ? ['daily'] : []), 'session', ...(r.newMilestoneIds.length ? ['lessons'] : [])]
    if (key !== receiptKey(r.attemptId) || r.receiptId !== key || r.evidence.attemptId !== r.attemptId ||
      evaluation.status !== 'completed' || evaluation.tier !== r.attemptTier ||
      (r.contractRevision === 'C1-G1-A1' && r.completedLoss !== (evaluation.outcome === 'lost')) ||
      (r.contractRevision === 'C1-PC-1' && r.completedLoss !== undefined) ||
      JSON.stringify(r.games) !== JSON.stringify(gameDelta(r.evidence.origin, evaluation.outcome)) ||
      JSON.stringify(r.effects) !== JSON.stringify(expectedEffects) ||
      entry.acknowledgedEffects.some((sink) => !r.effects.includes(sink)) ||
      new Set(entry.acknowledgedEffects).size !== entry.acknowledgedEffects.length ||
      (r.evidence.origin === 'daily') !== (r.dailyKey !== null)) throw new Error('Inconsistent settlement receipt')
    if (r.rewards.postcards !== r.rewards.newlyClaimed.reduce((sum, claim) => sum + REWARD_WEIGHTS[claim], 0) ||
      r.rewards.newlyClaimed.some((claim) => !r.rewards.eligible.includes(claim) || r.rewards.alreadyHeld.includes(claim)) ||
      (!r.cityEligible && (r.rewards.eligible.length || r.newBest || r.primary))) throw new Error('Inconsistent receipt rewards')
    if ((r.tutorialAward?.status === 'new' && r.tutorialAward.postcards !== 1) ||
      (r.tutorialAward?.status === 'already-held' && r.tutorialAward.postcards !== 0) ||
      (r.tutorialAward && (r.evidence.origin !== 'tutorial' || r.tutorialAward.sourceAttemptId !== r.attemptId ||
        (r.evidence.board !== null && r.tutorialAward.identity.courseId !== r.evidence.board.courseId) ||
        (r.evidence.board !== null && r.tutorialAward.identity.cityId !== r.evidence.board.cityId) ||
        !ledger.facts.tutorialAwards[tutorialAwardKey(r.tutorialAward.identity)] ||
        !sameValue(ledger.facts.tutorialAwards[tutorialAwardKey(r.tutorialAward.identity)]!.identity, r.tutorialAward.identity)))) throw new Error('Inconsistent tutorial award')
    if (r.cityEligible !== (r.evidence.origin === 'primary' || r.evidence.origin === 'replay') ||
      !sameValue(r.rewards, claimDelta(r.cityEligible && !r.completedLoss ? evaluation.components : [], r.rewards.alreadyHeld)) ||
      r.newBest !== (r.cityEligible && !r.completedLoss ? maxTier(r.previousBest, r.attemptTier) : (r.completedLoss ? r.previousBest : null)) ||
      (r.evidence.origin === 'primary') !== (r.primary !== null)) throw new Error('Inconsistent receipt progression')
    if (r.cityEligible) {
      const progress = r.evidence.board && ledger.facts.boards[boardKey(r.evidence.board)]
      if (r.completedLoss) {
        if (r.rewards.eligible.length || r.rewards.newlyClaimed.length || r.rewards.postcards !== 0 || !ledger.facts.completedLosses[boardKey(r.evidence.board!)]) throw new Error('Loss facts missing')
      } else if (!progress || r.rewards.newlyClaimed.some((claim) => !progress.claims.includes(claim)) ||
        maxTier(progress.best, r.newBest) !== progress.best) throw new Error('Receipt facts missing')
    }
    if (r.effects.includes('lessons') !== (r.lessons !== undefined) ||
      (r.lessons && (r.lessons.courseId !== r.evidence.board?.courseId ||
        r.lessons.curriculum.after.routeLanguage !== r.lessons.courseId || r.lessons.survival.after.routeLanguage !== r.lessons.courseId))) {
      throw new Error('Inconsistent captured lesson plan')
    }
    const wordIds = r.evidence.game.words.map((word) => word.wordId)
    if (!sameValue(wordIds, r.learning.changes.map((patch) => patch.wordId)) ||
      !sameValue(r.learning.results, roundLearningResults(r.evidence.game as AttemptEvidence['game'], r.learning.results.filter((word) => word.lookedUp).map((word) => word.wordId)))) {
      throw new Error('Invalid captured learning signals')
    }
    // Do not run the scheduler during recovery: a future algorithm must still
    // apply the exact output this receipt captured. Validate structural/history
    // invariants without recalculating scheduling or the accepted timestamp.
    if (!sameValue(r.learning.newlyDiscovered, r.learning.changes.filter((patch) => patch.before === null).map((patch) => patch.wordId)) ||
      r.learning.newlyCollected.some((id) => !wordIds.includes(id)) ||
      r.learning.changes.some((patch) => patch.after.seen !== (patch.before?.seen ?? 0) + 1)) throw new Error('Invalid captured learning patches')
    if (entry.acknowledgedEffects.length < r.effects.length) pending++
  }
  if (pending > 1) throw new Error('Multiple pending settlements')
  return ledger
}

const continuation = z.object({ requiredSet, remainingBoardKeys: uniqueIds, source: z.enum(['canonical', 'legacy-anchor']) })
const slot = z.object({ attemptId: id, board, origin: z.enum(['primary', 'replay']), promptLanguage: z.enum(['en', 'de', 'es', 'zh', 'fr', 'pt', 'pl', 'hu', 'sv', 'nb', 'nl']),
  game: gameSchema, lookedUp: uniqueIds, reviewRoundId: id.nullable(), randomnessPolicy: z.literal('engine-wheel-v1') }).passthrough()
export function parseSessions(value: unknown): CourseSessions {
  const sessions = z.object({ continuation, primary: slot.nullable(), replay: slot.nullable(), activeSlot: z.enum(['primary', 'replay']).nullable() })
    .parse(value) as unknown as CourseSessions
  if ((sessions.primary && sessions.primary.origin !== 'primary') || (sessions.replay && sessions.replay.origin !== 'replay') ||
    (sessions.primary && sessions.replay && sessions.primary.attemptId === sessions.replay.attemptId) ||
    (sessions.activeSlot !== null && !sessions[sessions.activeSlot])) throw new Error('Invalid session ownership')
  return sessions
}

/** Stable comparison tolerates JSON field order, but never a changed payload. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => sameValue(v, b[i]))
  const x = a as Record<string, unknown>, y = b as Record<string, unknown>
  const keys = Object.keys(x)
  return keys.length === Object.keys(y).length && keys.every((key) => Object.hasOwn(y, key) && sameValue(x[key], y[key]))
}

export function receiptFingerprint(r: CompletionReceipt): string {
  // The immutable payload has exactly one authority. Destinations retain only
  // its identity, avoiding seven full game snapshots per completed board.
  return r.receiptId
}
