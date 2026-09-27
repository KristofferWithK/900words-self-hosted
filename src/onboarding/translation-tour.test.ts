import { describe, expect, it } from 'vitest'
import { UI } from '../i18n'
import { translationLessonDue, translationLessonHoldsGuidance, wheelLessonDue } from './tutorial'
import { translationTourSteps, wheelReadyTourSteps } from './tour'

describe('translation spotlight guidance', () => {
  it('waits for the real translation handoff to finish and runs only in the challenge', () => {
    const eligible = {
      tutorial: true,
      eligible: true,
      phase: 'translateChallenge' as const,
      takeoverComplete: true,
      lessonFinished: false,
    }
    expect(translationLessonDue(eligible)).toBe(true)
    expect(translationLessonDue({ ...eligible, takeoverComplete: false })).toBe(false)
    expect(translationLessonDue({ ...eligible, phase: 'translateWheel' })).toBe(false)
    expect(translationLessonDue({ ...eligible, lessonFinished: true })).toBe(false)
    expect(translationLessonDue({ ...eligible, eligible: false })).toBe(false)
  })

  it('points at a pending suitcase, the real free-type controls, and the wheel', () => {
    const steps = translationTourSteps('da')
    expect(steps.map(step => step.anchor)).toEqual([
      '.word-card-wrap[data-translation-pending="true"] .card-lid-word',
      '.wheel-answer-row',
      '.wheel-disc',
    ])
    // Any remaining word may be answered: the lids are not a selection step.
    expect(steps[0]!.text).toMatch(/do not need to tap a suitcase/i)
    expect(steps[1]!.text).toContain('Danish')
    expect(steps[1]!.text).toContain('tick')
    expect(steps[2]!.text).not.toMatch(/guarantee/i)
    expect(translationTourSteps('de')[1]!.text).toContain('German')
    expect(translationTourSteps('de')[1]!.text).not.toContain('Danish')
    // Honest about an early spin: allowed, but an empty segment loses, and a
    // full wheel is the sure thing.
    expect(steps[2]!.text).toMatch(/spin any time/i)
    expect(steps[2]!.text).toMatch(/empty segment loses the round/i)
    expect(steps[2]!.text).toMatch(/any spin wins/i)
  })

  it('uses localized explanation copy and keeps lesson controls available', () => {
    const copy = translationTourSteps('de')
    expect(copy.every(step => step.text.trim().length > 0)).toBe(true)
    expect(UI.onboarding.tourNext).toBeTruthy()
    expect(UI.onboarding.skip).toBeTruthy()
  })
})

describe('the ordinary translation panel on a full board', () => {
  const owed = { tutorial: false, owed: true, closed: false, phase: 'translateChallenge' as const }
  it('waits while the lesson is owed, so one instruction has the floor', () => {
    expect(translationLessonHoldsGuidance(owed)).toBe(true)
  })
  it('speaks as usual once the lesson is closed, unavailable, or never owed', () => {
    expect(translationLessonHoldsGuidance({ ...owed, closed: true })).toBe(false)
    expect(translationLessonHoldsGuidance({ ...owed, owed: false })).toBe(false)
    expect(translationLessonHoldsGuidance({ ...owed, phase: 'playerClueInput' })).toBe(false)
    expect(translationLessonHoldsGuidance({ ...owed, phase: 'translateWheel' })).toBe(false)
  })
  it('never applies to the practice round, which announces no round panels', () => {
    expect(translationLessonHoldsGuidance({ ...owed, tutorial: true })).toBe(false)
  })
})

describe('the full-wheel lesson before the spin', () => {
  const due = { owed: true, phase: 'translateWheel' as const, spinning: false, takeoverSettled: true, lessonClosed: false }
  it('opens on a full wheel, before its spin', () => {
    expect(wheelLessonDue(due)).toBe(true)
  })
  it('stays shut while translating, while spinning, under a card, once closed, or when not owed', () => {
    expect(wheelLessonDue({ ...due, phase: 'translateChallenge' })).toBe(false)
    expect(wheelLessonDue({ ...due, phase: 'finished' })).toBe(false)
    expect(wheelLessonDue({ ...due, spinning: true })).toBe(false)
    expect(wheelLessonDue({ ...due, takeoverSettled: false })).toBe(false)
    expect(wheelLessonDue({ ...due, lessonClosed: true })).toBe(false)
    expect(wheelLessonDue({ ...due, owed: false })).toBe(false)
  })
  it('points at the live disc and says this spin wins, without spinning for the player', () => {
    const steps = wheelReadyTourSteps()
    expect(steps.map((step) => step.anchor)).toEqual(['.wheel-disc'])
    expect(steps[0]!.text).toMatch(/all green/i)
    expect(steps[0]!.text).toMatch(/this spin wins/i)
    expect(steps[0]!.text).toMatch(/Tap the wheel/i)
  })
})
