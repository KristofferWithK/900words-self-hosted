import type { CurriculumContentPack } from '../curriculum-content'
import { DANISH_CITIES_1_3 } from './curriculum-cities-1-3'
import { DANISH_CITIES_4_6 } from './curriculum-cities-4-6'
import { DANISH_CITIES_7_9 } from './curriculum-cities-7-9'
import { DANISH_CURRICULUM_DESCRIPTORS, DANISH_CURRICULUM_RUBRICS } from './curriculum-descriptors'
import { DANISH_GRAMMAR_REWRITE_BRIEF } from './curriculum-grammar-brief'
import { DANISH_READINESS_FORMS } from './curriculum-readiness'
import { DANISH_LEDGER_FORMS, DANISH_SUPPLEMENTAL_SUPPORT } from './curriculum-support'

/**
 * Complete T6 authoring payload, accepted after the dedicated Sol educator and
 * native-editor review. T5 still owns scheduling and shipping integration.
 */
export const danishCurriculumContent: CurriculumContentPack = {
  language: 'da',
  status: 'accepted',
  claimBoundaryEn: 'This route provides practice and separate in-app readiness evidence for constrained listening, reading, supported interaction, writing and grammar-in-use tasks. It is not CEFR certification and does not assess speaking or pronunciation.',
  reviewGates: [
    {
      id: 'sol-danish-review',
      status: 'complete',
      remitEn: 'A dedicated GPT-5.6 Sol reviewer performs a line-by-line Danish L2 educator and native-editor review for correctness, naturalness and register, progression, support timing, descriptor fit, parallel-form equivalence and assessment validity. Every blocking finding must be resolved in the payload before acceptance.',
    },
  ],
  ledgerForms: DANISH_LEDGER_FORMS,
  supplementalSupport: DANISH_SUPPLEMENTAL_SUPPORT,
  descriptors: DANISH_CURRICULUM_DESCRIPTORS,
  rubrics: DANISH_CURRICULUM_RUBRICS,
  cities: [...DANISH_CITIES_1_3, ...DANISH_CITIES_4_6, ...DANISH_CITIES_7_9],
  readinessForms: DANISH_READINESS_FORMS,
  grammarRewriteBrief: DANISH_GRAMMAR_REWRITE_BRIEF,
}
