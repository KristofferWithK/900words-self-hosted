import type { CurriculumLevel, ProductiveRole } from './curriculum'
import type { CurriculumUse } from './curriculum-content'

export type ExampleUse = CurriculumUse | 'pre-target-exposure'

export type ExampleEvidenceKind =
  | 'meaningful-input'
  | 'prompted-retrieval-candidate'
  | 'scenario-use-candidate'
  | 'comprehension-sample-candidate'

export type DanishExampleStructure =
  | 'main-clause'
  | 'question'
  | 'imperative'
  | 'direct-speech'
  | 'indefinite-noun-phrase'
  | 'definite-noun-phrase'
  | 'existential-clause'
  | 'repair-utterance'
  | 'personal-pronoun'
  | 'possessive'
  | 'present-clause'
  | 'quantity-expression'
  | 'plural-noun'
  | 'negation'
  | 'transaction'
  | 'fronted-v2'
  | 'recent-past-preterite'
  | 'recent-past-perfect'
  | 'wh-question'
  | 'direction-location'
  | 'adjective-agreement'
  | 'coordination'
  | 'simple-reason'
  | 'past-event'
  | 'present-perfect'
  | 'event-sequence'
  | 'problem-help'
  | 'modal-clause'
  | 'comparison'
  | 'invitation'
  | 'reflexive-possessive'
  | 'content-clause'
  | 'reason-clause'
  | 'condition-clause'
  | 'subordinate-negation'
  | 'receptive-clause-link'
  | 'service-message'

export interface ExampleTermEvidence {
  readonly id: string
  readonly use: ExampleUse
  readonly role: ProductiveRole
  readonly functionId: string
  /** A target-specific occurrence shape, not a generic sentence label. */
  readonly templateId: string
  /**
   * Authored opportunities for P2, not claims about learner performance.
   * Completed learner evidence remains in CurriculumProgress.
   */
  readonly evidence: readonly ExampleEvidenceKind[]
  /** Used only by support whose floor names lexical families. */
  readonly lexicalFamily?: string
}

export interface ExampleCurriculumRow {
  readonly wordId: string
  readonly curriculumRank: number
  /** Zero-based, like the language-owned curriculum manifest. */
  readonly city: number
  readonly level: CurriculumLevel
  /** Binds the review row to the exact final Danish and English strings. */
  readonly sourceFingerprint: string
  readonly structures: readonly DanishExampleStructure[]
  readonly ledger: readonly ExampleTermEvidence[]
  readonly supplemental: readonly ExampleTermEvidence[]
  readonly functionIds: readonly string[]
  readonly roles: readonly ProductiveRole[]
}

export interface ExampleReviewGate {
  readonly id: 'sol-example-review'
  readonly status: 'complete'
  readonly reviewer: 'Sol'
  readonly l2EducatorPass: 'complete'
  readonly nativeEditorPass: 'complete'
  readonly reviewedRows: 900
  readonly blockingFindings: 0
  readonly artifact: 'docs/curriculum/t3-sol-review.md'
}

export interface ExampleCurriculumIndex {
  readonly version: 1
  readonly language: 'da'
  readonly reviewGate: ExampleReviewGate | { readonly id: 'unreviewed'; readonly status: 'unreviewed'; readonly reviewedRows: 0 }
  readonly examples: readonly ExampleCurriculumRow[]
}

export interface ExampleCoverageCount {
  readonly id: string
  readonly target: string
  readonly firstCity: number
  readonly meaningfulInputs: number
  readonly meaningfulInputFloor: number
  readonly distinctTemplates: number
  readonly distinctTemplateFloor: number
  readonly lexicalFamilies: number
  readonly lexicalFamilyFloor: number
  readonly promptedRetrievals: number
  readonly promptedRetrievalFloor: number
  readonly scenarioUses: number
  readonly scenarioUseFloor: number
  readonly comprehensionSamples: number
  readonly comprehensionSampleFloor: number
  readonly sources: {
    readonly examples: number
    readonly grammarModels: number
    readonly scoredActivities: number
  }
}

export interface ExampleCityCoverage {
  readonly city: number
  readonly level: CurriculumLevel
  readonly examples: number
  readonly cityTargetHits: number
  readonly cityTargetFloor: number
  readonly receptive: number
  readonly controlled: number
  readonly productive: number
}

export interface ExampleFunctionCoverage {
  readonly id: string
  readonly level: CurriculumLevel
  readonly role: ProductiveRole
  readonly meaningfulInputs: number
  readonly meaningfulInputFloor: number
  readonly promptedRetrievals: number
  readonly promptedRetrievalFloor: number
  readonly scenarioUses: number
  readonly scenarioUseFloor: number
}

export interface ExampleCurriculumValidationReport {
  readonly errors: readonly string[]
  readonly examples: number
  readonly ledger: readonly ExampleCoverageCount[]
  readonly supplemental: readonly ExampleCoverageCount[]
  readonly functions: readonly ExampleFunctionCoverage[]
  readonly cities: readonly ExampleCityCoverage[]
  readonly byLevel: Readonly<Record<CurriculumLevel, number>>
  readonly byRole: Readonly<Record<ProductiveRole, number>>
  readonly ambientObserved: readonly { id: string; occurrences: number }[]
}
