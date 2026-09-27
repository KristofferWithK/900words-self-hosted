import type {
  CityExitTask,
  CurriculumAnswer,
  DanishAudioLine,
  DueReview,
  GrammarCapsule,
  ReadinessVariant,
  ScoredCurriculumActivity,
  SurvivalExchange,
} from '../curriculum-content'
import type { CurriculumLevel, EvidenceMode, ProductiveRole } from '../curriculum'

type SpeakerLine = readonly [DanishAudioLine['speaker'], string]

export const scripts = (id: string, lines: readonly SpeakerLine[]): readonly DanishAudioLine[] =>
  lines.map(([speaker, textDa], index) => ({ id: `${id}-audio-${index + 1}`, speaker, textDa }))

export const answer = (
  kind: CurriculumAnswer['kind'],
  modelDa: string,
  acceptedDa: readonly string[] = [modelDa],
  choicesDa?: readonly string[],
): CurriculumAnswer => ({ kind, modelDa, acceptedDa, choicesDa })

interface BaseDraft {
  readonly id: string
  readonly level: CurriculumLevel
  readonly mode: EvidenceMode
  readonly role: ProductiveRole
  readonly titleEn: string
  readonly travelGuideContextEn: string
  readonly promptEn: string
  readonly visualDa?: string
  readonly visualSupportEn?: string
  readonly lines: readonly SpeakerLine[]
  readonly answer: CurriculumAnswer
  readonly feedbackEn: string
  readonly rubricId?: string
  readonly descriptorIds: readonly string[]
  readonly supportItemIds: readonly string[]
}

const base = (draft: BaseDraft): ScoredCurriculumActivity => ({
  id: draft.id,
  level: draft.level,
  mode: draft.mode,
  role: draft.role,
  titleEn: draft.titleEn,
  travelGuideContextEn: draft.travelGuideContextEn,
  promptEn: draft.promptEn,
  visualDa: draft.visualDa,
  visualSupportEn: draft.visualSupportEn,
  audio: scripts(draft.id, draft.lines),
  answer: draft.answer,
  feedbackEn: draft.feedbackEn,
  rubricId: draft.rubricId ?? `${draft.level}-${draft.mode}`,
  descriptorIds: draft.descriptorIds,
  supportItemIds: draft.supportItemIds,
  evidencePolicy: {
    variantId: draft.id,
    allowedEnglishSupport: draft.visualSupportEn ? 'visible' : 'none',
    replayLimit: draft.mode === 'listening' ? 1 : 0,
    firstAttemptImmutable: true,
    communicativeGoalEn: draft.feedbackEn,
    targetSuccessEn: `Match one accepted ${draft.answer.kind} response for the authored target without consulting feedback.`,
    feedbackRuleEn: 'Commit the first response before feedback; preserve that evidence, then permit non-crediting replay or retry practice.',
  },
})

export const scoredActivity = (draft: BaseDraft): ScoredCurriculumActivity => base(draft)

export const capsule = (
  draft: BaseDraft & Pick<GrammarCapsule, 'phase' | 'observationEn'>,
): GrammarCapsule => ({ ...base(draft), phase: draft.phase, observationEn: draft.observationEn })

export const exchange = (
  draft: BaseDraft & Pick<SurvivalExchange, 'sceneId' | 'variant' | 'successCriterionEn'>,
): SurvivalExchange => {
  const activity = base(draft)
  return {
    ...activity,
    evidencePolicy: { ...activity.evidencePolicy, communicativeGoalEn: draft.successCriterionEn },
    sceneId: draft.sceneId,
    variant: draft.variant,
    successCriterionEn: draft.successCriterionEn,
  }
}

export const dueReview = (
  draft: BaseDraft & Pick<DueReview, 'sourceItemIds'>,
): DueReview => ({ ...base(draft), sourceItemIds: draft.sourceItemIds })

export const exitTask = (draft: CityExitTask): CityExitTask => draft

export const readinessVariant = (
  draft: BaseDraft & Pick<ReadinessVariant, 'form'>,
): ReadinessVariant => ({ ...base(draft), form: draft.form })
