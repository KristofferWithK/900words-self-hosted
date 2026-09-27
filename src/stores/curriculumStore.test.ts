import { beforeEach, describe, expect, it } from 'vitest'
import { ACTIVE } from '../lang/active'
import { danishCurriculum } from '../lang/da/curriculum'
import { initialCurriculumProgress } from '../journey/curriculumScheduler'
import { migrateCurriculum, useCurriculum } from './curriculumStore'

const NOW = 1_700_000_000_000
const first = danishCurriculum.cities[0]!.postWrapQueue[0]!
describe('curriculumStore', () => {
  beforeEach(() => useCurriculum.getState().reset())

  it('keeps curriculum evidence language-namespaced', () => {
    useCurriculum.getState().recordSentenceReview({
      wordId: 'da:mor', focusId: first.id, attemptedAt: NOW, correct: true, exposure: true, retrieval: true,
    })
    const da = useCurriculum.getState().byLanguage[ACTIVE.code]!
    useCurriculum.setState((state) => ({
      byLanguage: { ...state.byLanguage, de: initialCurriculumProgress('de') },
    }))
    expect(useCurriculum.getState().byLanguage.de!.evidence).toEqual({})
    expect(useCurriculum.getState().byLanguage[ACTIVE.code]!.evidence).toEqual(da.evidence)
  })

  it('has no retired post-wrap invitation entry point', () => {
    expect(useCurriculum.getState()).not.toHaveProperty('offerAfterWrap')
    // Receipt milestones are the sole invitation writer; an ordinary store
    // reset must not invent an old wrap-up offer.
    expect(useCurriculum.getState().byLanguage).toEqual({})
  })

  it('clears settlement markers with the learning history on reset', () => {
    useCurriculum.setState({ settlementEffects: { receipt: 'fingerprint' }, settlementMilestones: { milestone: NOW } })
    useCurriculum.getState().reset()
    expect(useCurriculum.getState()).toMatchObject({ settlementEffects: {}, settlementMilestones: {}, byLanguage: {} })
  })

  it('records sentence review evidence only when the review actually receives an answer', () => {
    expect(useCurriculum.getState().byLanguage[ACTIVE.code]).toBeUndefined()
    useCurriculum.getState().recordSentenceReview({
      wordId: 'da:mor', focusId: 'hej', attemptedAt: NOW, correct: true, exposure: true, retrieval: true,
    })
    const evidence = useCurriculum.getState().byLanguage[ACTIVE.code]!.sentenceReviewEvidence
    expect(Object.values(evidence)).toEqual([[expect.objectContaining({ wordId: 'da:mor', correct: true })]])
  })

  it('migrates an existing route without inventing sentence-review evidence', () => {
    const migrated = migrateCurriculum({ byLanguage: { da: { routeLanguage: 'da', evidence: {} } } }, 1) as {
      byLanguage: { da: { sentenceReviewEvidence: unknown } }
    }
    expect(migrated.byLanguage.da.sentenceReviewEvidence).toEqual({})
  })
})
