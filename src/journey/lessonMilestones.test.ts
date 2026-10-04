import { describe, expect, it } from 'vitest'
import { milestoneKey } from '../progression/identity'
import type { CompletionReceipt, RequiredBoardSet } from '../progression/types'
import { initialCurriculumProgress } from './curriculumScheduler'
import { initialSurvivalProgress } from './survival'
import {
  CITY1_LESSON_MILESTONES,
  lessonFinishOffers,
  planRuntimeLessons,
  reconcileLessonMilestones,
  validateCity1LessonMilestones,
} from './lessonMilestones'

const NOW = 1_700_000_000_000
const board = { courseId: 'da', cityId: 'sonderborg', authoredBoardId: 'bank_001', contentRevision: '1' } as const
const set: RequiredBoardSet = { courseId: 'da', cityId: 'sonderborg', setVersion: 'city1-required-boards-v1', boards: [board] }

function receipt(count: number, acceptedAt = NOW): CompletionReceipt {
  return {
    acceptedAt,
    evidence: { board },
    newMilestoneIds: [milestoneKey(set, count)],
  } as unknown as CompletionReceipt
}

describe('City 1 lesson milestones', () => {
  it('has a complete, ordered map from each 10-board milestone to existing City 1 content', () => {
    expect(validateCity1LessonMilestones()).toEqual([])
    expect(CITY1_LESSON_MILESTONES[0]).toEqual({ completedBoards: 10, curriculumItemId: 'sonderborg-notice', survivalExchangeId: 'sonderborg-situation-1' })
    expect(CITY1_LESSON_MILESTONES[3]).toEqual({ completedBoards: 40, curriculumItemId: 'sonderborg-listen', survivalExchangeId: 'sonderborg-situation-4' })
    expect(CITY1_LESSON_MILESTONES.at(-1)).toEqual({ completedBoards: 100, curriculumItemId: 'sonderborg-exit', survivalExchangeId: null })
  })

  it('offers all existing curriculum and Survival content by the final primary without making either required', () => {
    let curriculum = null
    let survival = null
    let last: CompletionReceipt | null = null
    let finalPlan: ReturnType<typeof planRuntimeLessons> | null = null
    for (const entry of CITY1_LESSON_MILESTONES) {
      last = receipt(entry.completedBoards, NOW + entry.completedBoards)
      const plan = planRuntimeLessons({ receipt: last, curriculum, survival })
      curriculum = plan.curriculum.after
      survival = plan.survival.after
      finalPlan = plan
    }
    expect(Object.keys(curriculum!.itemStates)).toEqual(CITY1_LESSON_MILESTONES.map((entry) => entry.curriculumItemId))
    expect(Object.values(curriculum!.itemStates).filter((state) => state === 'offered')).toHaveLength(1)
    expect(curriculum!.itemStates['sonderborg-exit']).toBe('offered')
    expect(Object.keys(survival!.exchanges)).toEqual([
      'sonderborg-situation-1', 'sonderborg-situation-2', 'sonderborg-situation-3', 'sonderborg-situation-4',
    ])
    expect(lessonFinishOffers({ ...last!, lessons: finalPlan! } as CompletionReceipt)).toEqual([
      { kind: 'curriculum', cityIndex: 0, itemId: 'sonderborg-exit' },
    ])
  })

  it('keeps completed/deferred history and never relocks a reviewed milestone entry', () => {
    const current = {
      ...initialCurriculumProgress('da'),
      itemStates: { 'sonderborg-notice': 'completed' as const, 'sonderborg-discriminate': 'deferred' as const },
    }
    const plan = planRuntimeLessons({ receipt: receipt(10), curriculum: current, survival: initialSurvivalProgress('da') })
    expect(plan.curriculum.after.itemStates).toMatchObject({
      'sonderborg-notice': 'completed',
      'sonderborg-discriminate': 'deferred',
    })
  })

  it('reconciles imported milestones into Guide availability without replaying an invitation', () => {
    const plan = reconcileLessonMilestones({
      requiredSet: set,
      completedMilestoneIds: [milestoneKey(set, 20), milestoneKey(set, 10), milestoneKey(set, 10)],
      consumedMilestoneIds: {},
      curriculum: null,
      survival: null,
      acceptedAt: NOW,
    })
    expect(plan.curriculum.after.itemStates).toEqual({
      'sonderborg-notice': 'available',
      'sonderborg-discriminate': 'available',
    })
    expect(Object.keys(plan.survival.after.exchanges)).toEqual(['sonderborg-situation-1', 'sonderborg-situation-2'])
  })

  it('does not advance a second slot when the same restored milestone is already durably consumed', () => {
    const ten = milestoneKey(set, 10)
    const first = reconcileLessonMilestones({
      requiredSet: set, completedMilestoneIds: [ten], consumedMilestoneIds: {}, curriculum: null, survival: null, acceptedAt: NOW,
    })
    const second = reconcileLessonMilestones({
      requiredSet: set,
      completedMilestoneIds: [ten],
      consumedMilestoneIds: { [ten]: NOW },
      curriculum: first.curriculum.after,
      survival: first.survival.after,
      acceptedAt: NOW + 1,
    })
    expect(second.curriculum.after).toEqual(first.curriculum.after)
    expect(second.survival.after).toEqual(first.survival.after)
  })

  it('reads a milestone counted against the balanced v2 set exactly like a v1 one, and refuses an unknown set', () => {
    const v2: RequiredBoardSet = { ...set, setVersion: 'city1-required-boards-v2' }
    const v2Receipt = { acceptedAt: NOW, evidence: { board }, newMilestoneIds: [milestoneKey(v2, 30)] } as unknown as CompletionReceipt
    const fromV1 = planRuntimeLessons({ receipt: receipt(30), curriculum: null, survival: null })
    const fromV2 = planRuntimeLessons({ receipt: v2Receipt, curriculum: null, survival: null })
    expect(fromV2).toEqual(fromV1)
    const unknown = { ...v2Receipt, newMilestoneIds: [milestoneKey({ ...set, setVersion: 'city1-required-boards-v9' }, 30)] } as CompletionReceipt
    expect(() => planRuntimeLessons({ receipt: unknown, curriculum: null, survival: null })).toThrow('valid City 1 milestone')
    expect(() => reconcileLessonMilestones({ requiredSet: v2, completedMilestoneIds: [milestoneKey(set, 10), milestoneKey(v2, 20)],
      consumedMilestoneIds: {}, curriculum: null, survival: null, acceptedAt: NOW })).not.toThrow()
  })

  it('pins a receipt to its reviewed milestone entry instead of the next locked entry', () => {
    const plan = planRuntimeLessons({ receipt: receipt(100), curriculum: null, survival: null })
    expect(plan.curriculum.after.itemStates).toEqual({ 'sonderborg-exit': 'offered' })
    expect(plan.survival.after.exchanges).toEqual({})
  })

  it('treats exhausted categories as a no-op rather than inventing another lesson', () => {
    const allCurriculum = Object.fromEntries(CITY1_LESSON_MILESTONES.map((entry) => [entry.curriculumItemId!, 'completed' as const]))
    const allSurvival = Object.fromEntries(['sonderborg-situation-1', 'sonderborg-situation-2', 'sonderborg-situation-3', 'sonderborg-situation-4']
      .map((id) => [id, { unlockedAt: NOW, firstCompletedAt: NOW, replayedAt: [] as number[] }]))
    const curriculum = { ...initialCurriculumProgress('da'), itemStates: allCurriculum }
    const survival = { ...initialSurvivalProgress('da'), exchanges: allSurvival }
    const plan = planRuntimeLessons({ receipt: receipt(100), curriculum, survival })
    expect(plan.curriculum.after).toEqual(curriculum)
    expect(plan.survival.after).toEqual(survival)
  })
})
