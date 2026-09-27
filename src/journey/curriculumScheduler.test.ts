import { describe, expect, it } from 'vitest'
import type { EvidenceRecord } from '../lang/curriculum'
import { danishCurriculum } from '../lang/da/curriculum'
import {
  REVIEW_AFTER_MS,
  beginItem,
  completeItem,
  currentScheduledItem,
  deferItem,
  initialCurriculumProgress,
  offerAfterWrap,
  offeredScheduledItem,
  skipItem,
} from './curriculumScheduler'

const NOW = 1_700_000_000_000
const CITY = 0
const first = danishCurriculum.cities[CITY]!.postWrapQueue[0]!
const evidence = (attemptedAt: number): EvidenceRecord => ({
  taskId: first.id,
  variantId: `${first.id}-test`,
  mode: 'grammar-in-use',
  attemptedAt,
  attemptKind: 'first',
  support: { english: 'none', audioReplays: 0, hintUsed: false },
  comprehension: 'not-applicable',
  communicativeGoal: 'not-applicable',
  targetSuccess: 'met',
  repair: 'not-needed',
  outcome: 'complete',
})

describe('curriculum post-wrap scheduler', () => {
  it('offers one first grammar slot after a completed wrap-up, without a journey dependency', () => {
    const progress = offerAfterWrap(danishCurriculum, initialCurriculumProgress('da'), CITY, NOW)
    expect(offeredScheduledItem(danishCurriculum, progress, CITY)).toMatchObject({ id: first.id, kind: 'grammar' })
    expect(progress.itemStates[first.id]).toBe('offered')
  })

  it('ignoring an invitation leaves it available and advances on the next wrap-up', () => {
    const one = offerAfterWrap(danishCurriculum, initialCurriculumProgress('da'), CITY, NOW)
    const two = offerAfterWrap(danishCurriculum, one, CITY, NOW + 1)
    expect(two.itemStates[first.id]).toBe('available')
    expect(offeredScheduledItem(danishCurriculum, two, CITY)?.id).toBe(
      danishCurriculum.cities[CITY]!.postWrapQueue[1]!.id,
    )
  })

  it('starts, defers, reloads and resumes without creating evidence', () => {
    const offered = offerAfterWrap(danishCurriculum, initialCurriculumProgress('da'), CITY, NOW)
    const active = beginItem(danishCurriculum, offered, CITY, first.id)
    expect(currentScheduledItem(danishCurriculum, active, CITY)?.id).toBe(first.id)
    const deferred = deferItem(active)
    const reloaded = structuredClone(deferred)
    const resumed = beginItem(danishCurriculum, reloaded, CITY, first.id)
    expect(currentScheduledItem(danishCurriculum, resumed, CITY)?.id).toBe(first.id)
    expect(resumed.evidence).toEqual({})
  })

  it('skips recoverably, and a later start can replay the same item', () => {
    const offered = offerAfterWrap(danishCurriculum, initialCurriculumProgress('da'), CITY, NOW)
    const skipped = skipItem(beginItem(danishCurriculum, offered, CITY, first.id))
    expect(skipped.itemStates[first.id]).toBe('skipped')
    expect(beginItem(danishCurriculum, skipped, CITY, first.id).activeItemId).toBe(first.id)
  })

  it('records evidence once per completion and makes a review due later', () => {
    const offered = offerAfterWrap(danishCurriculum, initialCurriculumProgress('da'), CITY, NOW)
    const record = evidence(NOW)
    const done = completeItem(beginItem(danishCurriculum, offered, CITY, first.id), record)
    const duplicate = completeItem(done, evidence(NOW + 1))
    expect(done.evidence[first.id]).toEqual([record])
    expect(duplicate).toBe(done)
    const beforeDue = offerAfterWrap(danishCurriculum, done, CITY, NOW + REVIEW_AFTER_MS - 1)
    expect(offeredScheduledItem(danishCurriculum, beforeDue, CITY)?.id).toBe(
      danishCurriculum.cities[CITY]!.postWrapQueue[1]!.id,
    )
    const due = offerAfterWrap(danishCurriculum, done, CITY, NOW + REVIEW_AFTER_MS)
    expect(offeredScheduledItem(danishCurriculum, due, CITY)).toMatchObject({ id: first.id, kind: 'review' })
  })

  it('offers an optional exit only after all nine slots are terminal, and never requires it', () => {
    const city = danishCurriculum.cities[CITY]!
    const completed = Object.fromEntries(city.postWrapQueue.map((item) => [item.id, 'completed' as const]))
    const dueAt = Object.fromEntries(city.postWrapQueue.map((item) => [item.id, NOW + REVIEW_AFTER_MS]))
    const progress = offerAfterWrap(
      danishCurriculum,
      { ...initialCurriculumProgress('da'), itemStates: completed, dueAt },
      CITY,
      NOW,
    )
    expect(offeredScheduledItem(danishCurriculum, progress, CITY)).toMatchObject({ id: city.exit.id, kind: 'exit' })
  })

  it('does not assume a fixed wrap-up economy: any number of invitations still has at most one offer', () => {
    let progress = initialCurriculumProgress('da')
    for (let wraps = 1; wraps <= 25; wraps++) {
      progress = offerAfterWrap(danishCurriculum, progress, CITY, NOW + wraps)
      const offered = Object.values(progress.itemStates).filter((state) => state === 'offered')
      expect(offered.length).toBeLessThanOrEqual(1)
    }
  })
})
