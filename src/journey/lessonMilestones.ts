import type { OptionalItemState } from '../lang/curriculum'
import { danishCurriculum } from '../lang/da/curriculum'
import { danishSurvivalGuide } from '../lang/da/survival'
import type { CompletionReceipt, LessonEffect, RequiredSetIdentity } from '../progression/types'
import {
  initialCurriculumProgress,
  type ScheduledProgress,
} from './curriculumScheduler'
import { initialSurvivalProgress, type SurvivalProgress } from './survival'

/** A City 1 board completion is a stable clock, not a lesson prerequisite. */
export interface LessonMilestone {
  readonly completedBoards: number
  readonly curriculumItemId: string | null
  readonly survivalExchangeId: string | null
}

export interface LessonFinishOffer {
  readonly kind: 'curriculum' | 'survival'
  readonly cityIndex: number
  readonly itemId: string
}

const CITY1_INDEX = 0
const CITY1_COURSE = 'da'
const CITY1_ID = 'sonderborg'
/**
 * Every frozen City 1 set a milestone can have been counted against. The map
 * below is keyed by count, not by board, so both sets unlock the same lessons;
 * settlement reaches each count once per city whichever set counted it.
 */
const CITY1_SET_VERSIONS: readonly string[] = ['city1-required-boards-v1', 'city1-required-boards-v2']
const MILESTONE_COUNTS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const

/**
 * Reviewed, literal City 1 schedule. This is intentionally not derived from
 * the live manifests: changing content or its order must require a deliberate
 * map review, never silently change what an old receipt unlocks.
 */
export const CITY1_LESSON_MILESTONES: readonly LessonMilestone[] = [
  { completedBoards: 10, curriculumItemId: 'sonderborg-notice', survivalExchangeId: 'sonderborg-situation-1' },
  { completedBoards: 20, curriculumItemId: 'sonderborg-discriminate', survivalExchangeId: 'sonderborg-situation-2' },
  { completedBoards: 30, curriculumItemId: 'sonderborg-manipulate', survivalExchangeId: 'sonderborg-situation-3' },
  { completedBoards: 40, curriculumItemId: 'sonderborg-listen', survivalExchangeId: 'sonderborg-situation-4' },
  { completedBoards: 50, curriculumItemId: 'sonderborg-transfer', survivalExchangeId: null },
  { completedBoards: 60, curriculumItemId: 'sonderborg-situation-1', survivalExchangeId: null },
  { completedBoards: 70, curriculumItemId: 'sonderborg-situation-2', survivalExchangeId: null },
  { completedBoards: 80, curriculumItemId: 'sonderborg-situation-3', survivalExchangeId: null },
  { completedBoards: 90, curriculumItemId: 'sonderborg-situation-4', survivalExchangeId: null },
  { completedBoards: 100, curriculumItemId: 'sonderborg-exit', survivalExchangeId: null },
] as const

function milestoneCount(id: string): number | null {
  try {
    const outer = JSON.parse(id)
    if (!Array.isArray(outer) || outer.length !== 3 || outer[0] !== 'milestone-v1' || typeof outer[2] !== 'string') return null
    const set = JSON.parse(outer[1])
    if (!Array.isArray(set) || set.length !== 3 || set[0] !== CITY1_COURSE || set[1] !== CITY1_ID || !CITY1_SET_VERSIONS.includes(set[2])) return null
    const count = Number(outer[2])
    return Number.isSafeInteger(count) && count > 0 && count % 10 === 0 ? count : null
  } catch {
    return null
  }
}

function cityForReceipt(receipt: CompletionReceipt): number {
  const board = receipt.evidence.board
  if (!board || board.courseId !== CITY1_COURSE || board.cityId !== CITY1_ID) {
    throw new Error('No C1-09 lesson map exists for this course/city')
  }
  return CITY1_INDEX
}

function ageOutstandingInvitation(states: Readonly<Record<string, OptionalItemState>>): Record<string, OptionalItemState> {
  return Object.fromEntries(Object.entries(states).map(([id, state]) => [id, state === 'offered' ? 'available' : state]))
}

function planCurriculum(
  progress: ScheduledProgress | null,
  itemId: string | null,
  presentation: 'offer' | 'available',
): ScheduledProgress {
  const before = progress ?? initialCurriculumProgress('da')
  const states = presentation === 'offer' ? ageOutstandingInvitation(before.itemStates) : before.itemStates
  if (!itemId || (states[itemId] !== undefined && states[itemId] !== 'locked')) {
    return states === before.itemStates ? before : { ...before, itemStates: states }
  }
  return { ...before, itemStates: { ...states, [itemId]: presentation === 'offer' ? 'offered' : 'available' } }
}

function planSurvival(
  progress: SurvivalProgress | null,
  exchangeId: string | null,
  acceptedAt: number,
): SurvivalProgress {
  const before = progress ?? initialSurvivalProgress('da')
  if (!exchangeId || before.exchanges[exchangeId]) return before
  return { ...before, exchanges: { ...before.exchanges, [exchangeId]: { unlockedAt: acceptedAt, replayedAt: [] } } }
}

/**
 * Pure authoritative planner used by the settlement adapter. The receipt has
 * already established that this is a first required primary completion; this
 * function only captures the two exact destination patches.
 */
export function planRuntimeLessons(input: {
  readonly receipt: CompletionReceipt
  readonly curriculum: ScheduledProgress | null
  readonly survival: SurvivalProgress | null
}): LessonEffect {
  cityForReceipt(input.receipt)
  const entries = input.receipt.newMilestoneIds.map((id) => {
    const count = milestoneCount(id)
    return count === null ? null : CITY1_LESSON_MILESTONES.find((entry) => entry.completedBoards === count) ?? null
  })
  if (!entries.length || entries.some((entry) => entry === null)) {
    throw new Error('Receipt does not contain a valid City 1 milestone')
  }

  let curriculum = input.curriculum
  let survival = input.survival
  // A normal receipt contains one ID. Looping makes the rule explicit and
  // remains deterministic if a future recovery record legitimately contains
  // multiple consecutive milestones.
  for (const entry of entries) {
    curriculum = planCurriculum(curriculum, entry!.curriculumItemId, 'offer')
    survival = planSurvival(survival, entry!.survivalExchangeId, input.receipt.acceptedAt)
  }
  return {
    courseId: 'da',
    curriculum: { before: input.curriculum, after: curriculum ?? initialCurriculumProgress('da') },
    survival: { before: input.survival, after: survival ?? initialSurvivalProgress('da') },
  }
}

/**
 * Backup/import reconciliation uses the same ordered map but deliberately
 * creates Guide availability, never a new finish-screen celebration.
 */
export interface LessonMilestoneReconciliation {
  /** Restored facts must name their course/city/set; raw counts are ambiguous. */
  readonly requiredSet: RequiredSetIdentity
  /** Exact milestone IDs from the restored settlement facts. */
  readonly completedMilestoneIds: readonly string[]
  /** Durable markers already consumed by both lesson stores. */
  readonly consumedMilestoneIds: Readonly<Record<string, number>>
  readonly curriculum: ScheduledProgress | null
  readonly survival: SurvivalProgress | null
  readonly acceptedAt: number
}

export function reconcileLessonMilestones(input: LessonMilestoneReconciliation): LessonEffect {
  if (input.requiredSet.courseId !== CITY1_COURSE || input.requiredSet.cityId !== CITY1_ID || !CITY1_SET_VERSIONS.includes(input.requiredSet.setVersion)) {
    throw new Error('No C1-09 lesson map exists for this course/city/set')
  }
  let nextCurriculum = input.curriculum
  let nextSurvival = input.survival
  const ids = [...new Set(input.completedMilestoneIds)].filter((id) => input.consumedMilestoneIds[id] === undefined)
  for (const id of ids.sort((a, b) => (milestoneCount(a) ?? Infinity) - (milestoneCount(b) ?? Infinity))) {
    const count = milestoneCount(id)
    const entry = count === null ? null : CITY1_LESSON_MILESTONES.find((candidate) => candidate.completedBoards === count)
    if (!entry) continue
    nextCurriculum = planCurriculum(nextCurriculum, entry.curriculumItemId, 'available')
    nextSurvival = planSurvival(nextSurvival, entry.survivalExchangeId, input.acceptedAt)
  }
  const current = nextCurriculum ?? initialCurriculumProgress('da')
  return {
    courseId: CITY1_COURSE,
    curriculum: { before: input.curriculum, after: { ...current, itemStates: ageOutstandingInvitation(current.itemStates) } },
    survival: { before: input.survival, after: nextSurvival ?? initialSurvivalProgress('da') },
  }
}

/** A result surface can read this immutable receipt without scheduling work. */
export function lessonFinishOffers(receipt: CompletionReceipt): readonly LessonFinishOffer[] {
  const lessons = receipt.lessons
  if (!lessons) return []
  const beforeCurriculum = lessons.curriculum.before?.itemStates ?? {}
  const curriculum = Object.entries(lessons.curriculum.after.itemStates)
    .filter(([id, state]) => state === 'offered' && beforeCurriculum[id] !== 'offered')
    .map(([itemId]) => ({ kind: 'curriculum' as const, cityIndex: CITY1_INDEX, itemId }))
  const beforeSurvival = lessons.survival.before?.exchanges ?? {}
  const survival = Object.keys(lessons.survival.after.exchanges)
    .filter((itemId) => !beforeSurvival[itemId])
    .map((itemId) => ({ kind: 'survival' as const, cityIndex: CITY1_INDEX, itemId }))
  return [...curriculum, ...survival]
}

/** Fails fast if authored content changes without a reviewed new map. */
export function validateCity1LessonMilestones(): readonly string[] {
  const errors: string[] = []
  if (CITY1_LESSON_MILESTONES.length !== 10) errors.push('City 1 needs milestones 10 through 100')
  if (CITY1_LESSON_MILESTONES.map((entry) => entry.completedBoards).join('|') !== MILESTONE_COUNTS.join('|')) errors.push('City 1 milestone order drift')
  if (new Set(CITY1_LESSON_MILESTONES.map((entry) => entry.completedBoards)).size !== CITY1_LESSON_MILESTONES.length) errors.push('duplicate City 1 milestone count')
  const curriculumItems = [
    ...danishCurriculum.cities[CITY1_INDEX]!.postWrapQueue.map((item) => item.id),
    danishCurriculum.cities[CITY1_INDEX]!.exit.id,
  ]
  const survivalItems = danishSurvivalGuide.cities[CITY1_INDEX]!.exchanges.map((exchange) => exchange.targetActivityId)
  if (CITY1_LESSON_MILESTONES.map((entry) => entry.curriculumItemId).filter(Boolean).join('|') !== curriculumItems.join('|')) errors.push('curriculum milestone map drift')
  if (CITY1_LESSON_MILESTONES.map((entry) => entry.survivalExchangeId).filter(Boolean).join('|') !== survivalItems.join('|')) errors.push('Survival milestone map drift')
  return errors
}
