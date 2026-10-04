import { z } from 'zod'
import { completedPrimaryCount, emptyProgressFacts, factsForImport, mergeProgressFacts } from '../progression/facts'
import { boardKey, milestoneKey, requiredSetKey } from '../progression/identity'
import { cityTier, TIERS } from '../progression/rules'
import type { ProgressFacts } from '../progression/types'
import { knownRequiredSetsForCourse, requiredSetForCourse } from '../session/courseRuntime'
import type { ScheduledProgress } from '../journey/curriculumScheduler'
import type { SurvivalProgress } from '../journey/survival'
export { LearningSchema, HistoricalEligibilitySchema } from './learningSchema'

export const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const id = z.string().min(1)
const record = <T extends z.ZodType>(schema: T) => z.record(id, schema)
const course = z.enum(['da', 'de'])
const city = z.object({ courseId: course, cityId: id })
const board = city.extend({ authoredBoardId: id, contentRevision: id })
const requiredSet = city.extend({ setVersion: id })
const tutorialAward = z.object({ identity: city.extend({ profileKey: id, policyRevision: id }), sourceAttemptId: id, acceptedAt: count })
const tier = z.enum(['bronze', 'silver', 'gold', 'platinum'])
const rawFacts = z.object({
  boards: record(z.object({ board, best: tier, claims: z.array(z.enum(['spinWin', 'solved', 'solvedAndTranslated'])) })),
  completedLosses: record(z.object({ board, firstPrimary: z.boolean() })).default({}),
  firstPrimaryCompletions: record(z.object({ board, requiredSet })),
  milestones: record(z.object({ requiredSet, completedCount: count, notificationHandled: z.boolean() })),
  cityAchievements: record(z.object({ requiredSet, tier })),
  legacyCredit: z.object({ identity: z.literal('danish-city1-legacy-v1'), amount: count }),
  tutorialAwards: record(tutorialAward).default({}),
})

/** Format 3 is intentionally specific to the frozen released manifests: the
 * current set of each course and every set it superseded (Danish City 1 v1,
 * replaced by v2 on 2026-09-27 without changing any board's identity). A fact
 * is proven against the set it names. New content identities need a reviewed
 * successor reader, never fresh claims. */
export function validateProgressFacts(value: unknown): ProgressFacts {
  const facts = factsForImport(rawFacts.parse(value))
  const requiredSets = (['da', 'de'] as const).map(requiredSetForCourse)
  const knownSets = (['da', 'de'] as const).flatMap(knownRequiredSetsForCourse)
  const setsByKey = new Map(knownSets.map((required) => [requiredSetKey(required), required]))
  const setsByBoardKey = new Map<string, Set<string>>()
  for (const required of knownSets) {
    for (const board of required.boards) {
      const sets = setsByBoardKey.get(boardKey(board)) ?? new Set<string>()
      sets.add(requiredSetKey(required))
      setsByBoardKey.set(boardKey(board), sets)
    }
  }
  const keys = new Set(setsByBoardKey.keys())
  for (const [key, progress] of Object.entries(facts.boards)) {
    if (!keys.has(key) || boardKey(progress.board) !== key) throw new Error('Unknown board provenance')
    const claims = progress.claims
    if ((progress.best === 'bronze' && claims.length !== 0) ||
      (progress.best === 'silver' && (claims.length !== 1 || claims[0] !== 'spinWin')) ||
      (progress.best === 'gold' && (!claims.includes('solved') || claims.includes('solvedAndTranslated'))) ||
      (progress.best === 'platinum' && claims.length !== 3)) throw new Error('Inconsistent board achievement')
  }
  for (const [key, loss] of Object.entries(facts.completedLosses)) {
    if (!keys.has(key) || boardKey(loss.board) !== key) throw new Error('Unknown loss provenance')
  }
  for (const completion of Object.values(facts.firstPrimaryCompletions)) {
    const key = boardKey(completion.board)
    const setKey = requiredSetKey(completion.requiredSet)
    if (!facts.boards[key] || !setsByBoardKey.get(key)?.has(setKey) || !setsByKey.has(setKey)) throw new Error('Unproven primary completion')
  }
  for (const milestone of Object.values(facts.milestones)) {
    const required = setsByKey.get(requiredSetKey(milestone.requiredSet))
    if (!required || milestone.completedCount > completedPrimaryCount(facts, required)) throw new Error('Unproven lesson milestone')
  }
  const bests = Object.fromEntries(Object.entries(facts.boards).map(([key, progress]) => [key, progress.best]))
  for (const [key, achievement] of Object.entries(facts.cityAchievements)) {
    const required = setsByKey.get(key)
    const minimum = required ? cityTier(required, bests).tier : null
    if (!required || minimum === null || TIERS.indexOf(achievement.tier) > TIERS.indexOf(minimum)) throw new Error('Unproven city achievement')
  }
  const milestones = { ...facts.milestones }
  for (const required of requiredSets) {
    const completed = completedPrimaryCount(facts, required)
    for (let n = 10; n <= completed; n += 10) milestones[milestoneKey(required, n)] = {
      requiredSet: { courseId: required.courseId, cityId: required.cityId, setVersion: required.setVersion },
      completedCount: n, notificationHandled: true,
    }
  }
  return { ...facts, milestones }
}

export const ProgressSchema = rawFacts.transform((value, ctx) => {
  try { return validateProgressFacts(value) } catch {
    ctx.addIssue({ code: 'custom', message: 'Invalid progression facts' }); return z.NEVER
  }
})

export interface PortableLearning { curriculum: Record<string, ScheduledProgress>; survival: Record<string, SurvivalProgress> }
export const emptyLearning = (): PortableLearning => ({ curriculum: {}, survival: {} })

const unionRows = <T>(a: readonly T[], b: readonly T[]): T[] => [...new Map([...a, ...b].map((row) => [JSON.stringify(row), row])).entries()]
  .sort(([a], [b]) => a.localeCompare(b)).map(([, row]) => row)
const unionEvidence = <T>(a: Readonly<Record<string, readonly T[]>>, b: Readonly<Record<string, readonly T[]>>) =>
  Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].sort().map((id) => [id, unionRows(a[id] ?? [], b[id] ?? [])]))
const stateOrder = ['locked', 'offered', 'available', 'skipped', 'deferred', 'completed'] as const

/** Completion/availability are monotone; imports never re-open a popup. */
export function mergeLearning(a: PortableLearning, b: PortableLearning): PortableLearning {
  const curriculum: Record<string, ScheduledProgress> = {}
  for (const language of new Set([...Object.keys(a.curriculum), ...Object.keys(b.curriculum)])) {
    const left = a.curriculum[language], right = b.curriculum[language]
    const base = left ?? right!
    const states = { ...left?.itemStates }
    for (const [id, state] of Object.entries(right?.itemStates ?? {})) if (stateOrder.indexOf(state) > stateOrder.indexOf(states[id] ?? 'locked')) states[id] = state
    curriculum[language] = { ...base, activeItemId: null,
      itemStates: Object.fromEntries(Object.entries(states).map(([id, s]) => [id, s === 'offered' ? 'available' : s])),
      evidence: unionEvidence(left?.evidence ?? {}, right?.evidence ?? {}),
      sentenceReviewEvidence: unionEvidence(left?.sentenceReviewEvidence ?? {}, right?.sentenceReviewEvidence ?? {}),
      dueAt: Object.fromEntries([...new Set([...Object.keys(left?.dueAt ?? {}), ...Object.keys(right?.dueAt ?? {})])]
        .map((id) => [id, Math.max(left?.dueAt[id] ?? 0, right?.dueAt[id] ?? 0)])),
    }
  }
  const survival: Record<string, SurvivalProgress> = {}
  for (const language of new Set([...Object.keys(a.survival), ...Object.keys(b.survival)])) {
    const left = a.survival[language], right = b.survival[language]
    const exchanges = { ...left?.exchanges }
    for (const [id, entry] of Object.entries(right?.exchanges ?? {})) {
      const mine = exchanges[id]
      const firstCompletedAt = Math.min(mine?.firstCompletedAt ?? Infinity, entry.firstCompletedAt ?? Infinity)
      exchanges[id] = { unlockedAt: Math.min(mine?.unlockedAt ?? Infinity, entry.unlockedAt),
        ...(Number.isFinite(firstCompletedAt) ? { firstCompletedAt } : {}), replayedAt: [...new Set([...(mine?.replayedAt ?? []), ...entry.replayedAt])].sort((a, b) => a - b) }
    }
    survival[language] = { routeLanguage: language, exchanges }
  }
  return { curriculum, survival }
}

export const mergeImportedProgress = (a: ProgressFacts, b: ProgressFacts) => validateProgressFacts(mergeProgressFacts(a, b))
export const legacyProgress = (amount: number): ProgressFacts => ({ ...emptyProgressFacts(), legacyCredit: { identity: 'danish-city1-legacy-v1', amount: count.parse(amount) } })
