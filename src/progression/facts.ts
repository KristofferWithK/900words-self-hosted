import { boardKey, cityKey, firstCompletionKey, milestoneKey, requiredSetKey, tutorialAwardKey, validateRequiredSet } from './identity'
import { COMPONENTS, maxTier, REWARD_WEIGHTS, TIERS } from './rules'
import type { BoardIdentity, CityIdentity, PrimaryContinuation, ProgressFacts, RequiredBoardSet } from './types'

export const LEGACY_CITY: CityIdentity = { courseId: 'da', cityId: 'sonderborg' }

export function emptyProgressFacts(): ProgressFacts {
  return { boards: {}, completedLosses: {}, firstPrimaryCompletions: {}, milestones: {}, cityAchievements: {}, tutorialAwards: {}, legacyCredit: { identity: 'danish-city1-legacy-v1', amount: 0 } }
}

const ordered = <T>(records: Readonly<Record<string, T>>): Record<string, T> => Object.fromEntries(Object.entries(records).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))

function assertFacts(facts: ProgressFacts): void {
  if (facts.legacyCredit.identity !== 'danish-city1-legacy-v1' || !Number.isSafeInteger(facts.legacyCredit.amount) || facts.legacyCredit.amount < 0) throw new Error('Invalid legacy credit')
  for (const [key, value] of Object.entries(facts.boards)) {
    if (key !== boardKey(value.board) || !TIERS.includes(value.best) || value.claims.some((claim) => !COMPONENTS.includes(claim))) throw new Error('Invalid board facts')
  }
  for (const [key, value] of Object.entries(facts.completedLosses)) {
    if (key !== boardKey(value.board) || typeof value.firstPrimary !== 'boolean') throw new Error('Invalid completed-loss facts')
  }
  for (const [key, value] of Object.entries(facts.firstPrimaryCompletions)) {
    if (key !== firstCompletionKey(value.board) || cityKey(value.board) !== cityKey(value.requiredSet)) throw new Error('Invalid completion facts')
  }
  for (const [key, value] of Object.entries(facts.milestones)) {
    if (!Number.isSafeInteger(value.completedCount) || value.completedCount <= 0 || value.completedCount % 10 !== 0 || key !== milestoneKey(value.requiredSet, value.completedCount)) throw new Error('Invalid milestone facts')
  }
  for (const [key, value] of Object.entries(facts.cityAchievements)) {
    if (key !== requiredSetKey(value.requiredSet) || !TIERS.includes(value.tier)) throw new Error('Invalid city achievement')
  }
  for (const [key, value] of Object.entries(facts.tutorialAwards)) {
    if (key !== tutorialAwardKey(value.identity) || !value.sourceAttemptId.trim() || !Number.isSafeInteger(value.acceptedAt) || value.acceptedAt < 0) throw new Error('Invalid tutorial award')
  }
}

/** Validated facts only. Import must also verify manifest/content provenance. */
export function mergeProgressFacts(a: ProgressFacts, b: ProgressFacts): ProgressFacts {
  assertFacts(a)
  assertFacts(b)
  const boards = { ...a.boards }
  for (const [key, value] of Object.entries(b.boards)) {
    const mine = boards[key]
    boards[key] = { board: value.board, best: maxTier(mine?.best ?? null, value.best)!, claims: COMPONENTS.filter((claim) => value.claims.includes(claim) || mine?.claims.includes(claim)) }
  }
  // Normalize even a one-sided entry so repeated merges serialize identically.
  for (const [key, value] of Object.entries(boards)) boards[key] = { ...value, claims: COMPONENTS.filter((claim) => value.claims.includes(claim)) }
  const completedLosses = { ...a.completedLosses }
  for (const [key, value] of Object.entries(b.completedLosses)) {
    completedLosses[key] = { board: value.board, firstPrimary: value.firstPrimary || completedLosses[key]?.firstPrimary === true }
  }
  const firstPrimaryCompletions = { ...a.firstPrimaryCompletions }
  for (const [key, value] of Object.entries(b.firstPrimaryCompletions)) {
    const mine = firstPrimaryCompletions[key]
    firstPrimaryCompletions[key] = !mine || requiredSetKey(value.requiredSet) < requiredSetKey(mine.requiredSet) ? value : mine
  }
  const milestones = { ...a.milestones }
  for (const [key, value] of Object.entries(b.milestones)) milestones[key] = { ...value, notificationHandled: value.notificationHandled || milestones[key]?.notificationHandled === true }
  const cityAchievements = { ...a.cityAchievements }
  for (const [key, value] of Object.entries(b.cityAchievements)) cityAchievements[key] = { ...value, tier: maxTier(value.tier, cityAchievements[key]?.tier ?? null)! }
  const tutorialAwards = { ...a.tutorialAwards }
  for (const [key, value] of Object.entries(b.tutorialAwards)) {
    if (!tutorialAwards[key]) tutorialAwards[key] = value
    else if (JSON.stringify(value) < JSON.stringify(tutorialAwards[key])) tutorialAwards[key] = value
  }
  return {
    boards: ordered(boards), completedLosses: ordered(completedLosses), firstPrimaryCompletions: ordered(firstPrimaryCompletions), milestones: ordered(milestones), cityAchievements: ordered(cityAchievements), tutorialAwards: ordered(tutorialAwards),
    legacyCredit: { identity: 'danish-city1-legacy-v1', amount: Math.max(a.legacyCredit.amount, b.legacyCredit.amount) },
  }
}

export function earnedPostcards(facts: ProgressFacts, city: CityIdentity): number {
  assertFacts(facts)
  const claims = Object.values(facts.boards).filter((entry) => cityKey(entry.board) === cityKey(city))
    .reduce((sum, entry) => sum + COMPONENTS.filter((claim) => entry.claims.includes(claim)).reduce((n, claim) => n + REWARD_WEIGHTS[claim], 0), 0)
  const practice = Object.values(facts.tutorialAwards).filter((entry) => cityKey(entry.identity) === cityKey(city)).length
  return claims + practice + (cityKey(city) === cityKey(LEGACY_CITY) ? facts.legacyCredit.amount : 0)
}

export function withLegacyCredit(facts: ProgressFacts, normalizedAmount: number): ProgressFacts {
  return mergeProgressFacts(facts, { ...emptyProgressFacts(), legacyCredit: { identity: 'danish-city1-legacy-v1', amount: normalizedAmount } })
}

export function completedPrimaryCount(facts: ProgressFacts, required: RequiredBoardSet): number {
  return required.boards.filter((board) => facts.firstPrimaryCompletions[firstCompletionKey(board)]).length
}

/**
 * Called only for a new queue, the one-time validated legacy migration, or the
 * one-time rebase onto a superseding frozen set (`rebased`, see
 * `rebaseCourseSessions`). Either migration may anchor the round already on
 * the table at the front.
 */
export function createPrimaryContinuation(required: RequiredBoardSet, facts: ProgressFacts, legacyAnchor?: BoardIdentity,
  rebased = false): PrimaryContinuation {
  const error = validateRequiredSet(required)
  if (error) throw new Error(error)
  const keys = required.boards.map(boardKey)
  const remaining = required.boards.filter((board) => !facts.firstPrimaryCompletions[firstCompletionKey(board)] && !facts.completedLosses[boardKey(board)]).map(boardKey)
  if (legacyAnchor && !keys.includes(boardKey(legacyAnchor))) throw new Error('Unknown legacy anchor')
  const anchor = legacyAnchor && boardKey(legacyAnchor)
  return {
    requiredSet: { courseId: required.courseId, cityId: required.cityId, setVersion: required.setVersion },
    remainingBoardKeys: anchor ? [anchor, ...remaining.filter((key) => key !== anchor)] : remaining,
    source: rebased ? 'rebased' : anchor ? 'legacy-anchor' : 'canonical',
  }
}

/** Incoming notifications are historical; reconcile availability without popups. */
export function factsForImport(facts: ProgressFacts): ProgressFacts {
  const normalized = mergeProgressFacts(emptyProgressFacts(), facts)
  return { ...normalized, milestones: Object.fromEntries(Object.entries(normalized.milestones).map(([key, fact]) => [key, { ...fact, notificationHandled: true }])) }
}
