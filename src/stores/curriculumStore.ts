import { create } from 'zustand'
import { guardedPersist as persist, withEffectMarkers, type EffectMarkers } from './settlementStorage'
import { ACTIVE } from '../lang/active'
import { danishCurriculum } from '../lang/da/curriculum'
import type { EvidenceRecord } from '../lang/curriculum'
import {
  beginItem,
  completeItem,
  deferItem,
  initialCurriculumProgress,
  recordSentenceReview as recordSentenceReviewIn,
  skipItem,
  type SentenceReviewEvidence,
  type ScheduledProgress,
} from '../journey/curriculumScheduler'

export type CurriculumProgressByLanguage = Record<string, ScheduledProgress>

interface CurriculumStore {
  settlementEffects: EffectMarkers
  /** Milestones whose captured C1-09 availability plan has been applied. */
  settlementMilestones: Record<string, number>
  byLanguage: CurriculumProgressByLanguage
  start: (cityIndex: number, itemId: string) => void
  later: (cityIndex?: number, itemId?: string) => void
  skip: () => void
  complete: (record: EvidenceRecord) => void
  recordSentenceReview: (evidence: SentenceReviewEvidence) => void
  reset: () => void
}

const manifestFor = (language: string) => (language === 'da' ? danishCurriculum : null)

const progressFor = (all: CurriculumProgressByLanguage, language: string) =>
  all[language] ?? initialCurriculumProgress(language)

export function migrateCurriculum(persisted: unknown, version: number): unknown {
  if (version >= 3) return persisted
  if (version === 2) return withEffectMarkers({ ...(persisted as object), settlementMilestones: {} })
  const state = (persisted ?? {}) as { byLanguage?: Record<string, Record<string, unknown>> }
  const byLanguage = Object.fromEntries(
    Object.entries(state.byLanguage ?? {}).map(([language, progress]) => [
      language,
      { ...progress, sentenceReviewEvidence: progress.sentenceReviewEvidence ?? {} },
    ]),
  )
  return withEffectMarkers({ ...state, byLanguage, settlementMilestones: {} })
}

/**
 * A separate persisted ledger from journeyStore. City indices are route
 * relative, hence language-keyed; word ids are not involved at all. The store
 * cannot call travel or write `wrapped`, so its optionality is structural.
 */
export const useCurriculum = create<CurriculumStore>()(
  persist(
    (set) => ({
      settlementEffects: {},
      settlementMilestones: {},
      byLanguage: {},
      start: (cityIndex, itemId) =>
        set((state) => {
          const language = ACTIVE.code
          const manifest = manifestFor(language)
          if (!manifest) return state
          const progress = progressFor(state.byLanguage, language)
          const next = beginItem(manifest, progress, cityIndex, itemId)
          return { byLanguage: { ...state.byLanguage, [language]: next } }
        }),
      later: (cityIndex, itemId) =>
        set((state) => {
          const language = ACTIVE.code
          const progress = progressFor(state.byLanguage, language)
          if (itemId && cityIndex !== undefined) {
            const manifest = manifestFor(language)
            if (!manifest) return state
            const started = beginItem(manifest, progress, cityIndex, itemId)
            return { byLanguage: { ...state.byLanguage, [language]: deferItem(started) } }
          }
          return { byLanguage: { ...state.byLanguage, [language]: deferItem(progress) } }
        }),
      skip: () =>
        set((state) => {
          const language = ACTIVE.code
          const progress = progressFor(state.byLanguage, language)
          return { byLanguage: { ...state.byLanguage, [language]: skipItem(progress) } }
        }),
      complete: (record) =>
        set((state) => {
          const language = ACTIVE.code
          const progress = progressFor(state.byLanguage, language)
          return { byLanguage: { ...state.byLanguage, [language]: completeItem(progress, record) } }
        }),
      recordSentenceReview: (evidence) =>
        set((state) => {
          const language = ACTIVE.code
          const progress = progressFor(state.byLanguage, language)
          const next = recordSentenceReviewIn(progress, evidence)
          return { byLanguage: { ...state.byLanguage, [language]: next } }
        }),
      // A reset starts a new local learning history; leave no durable receipt
      // marker that could suppress the new history's restored reconciliation.
      reset: () => set({ settlementEffects: {}, settlementMilestones: {}, byLanguage: {} }),
    }),
    {
      name: 'cluecab-curriculum-v1',
      // v3 adds atomic settlement markers and consumed milestone IDs. The
      // older v2 sentence-review migration remains in migrateCurriculum.
      version: 3,
      migrate: migrateCurriculum,
    },
  ),
)

export function activeCurriculumProgress(): ScheduledProgress {
  return progressFor(useCurriculum.getState().byLanguage, ACTIVE.code)
}
