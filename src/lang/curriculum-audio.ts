import type {
  CurriculumContentPack,
  DanishAudioLine,
  ScoredCurriculumActivity,
} from './curriculum-content'

/**
 * Every accepted T6 audio line S4 owns. This is deliberately the complete
 * `audio` surface of every scored activity, not only the lines the current
 * T5 shell happens to render: 45 capsules, 36 exchanges, nine due reviews,
 * 27 exit steps and both readiness checkpoints all become one performance per
 * authored utterance. The runtime cards may land separately; their frozen
 * voices must not be silently omitted from the bake.
 */
export type CurriculumTaskAudioKind =
  | 'capsule'
  | 'exchange'
  | 'due-review'
  | 'exit-step'
  | 'checkpoint'

export interface CurriculumTaskAudioLine {
  readonly id: string
  readonly activityId: string
  readonly kind: CurriculumTaskAudioKind
  /** The route city that owns the activity; checkpoints use their checkpoint city. */
  readonly cityId: string
  readonly mode: ScoredCurriculumActivity['mode']
  /** The five authored capsule phases stay visible in the manifest. */
  readonly phase?: 'notice' | 'discriminate' | 'manipulate' | 'listen' | 'transfer'
  /** Stable parent readiness form, for the two checkpoint sets. */
  readonly checkpointId?: string
  readonly textDa: string
}

const linesFor = (
  metadata: Omit<CurriculumTaskAudioLine, 'id' | 'textDa'>,
  lines: readonly DanishAudioLine[],
): readonly CurriculumTaskAudioLine[] => lines.map((line) => ({
  ...metadata,
  id: line.id,
  textDa: line.textDa,
}))

/** Derive the bake inventory from T6 instead of copying learner-facing text. */
export function curriculumTaskAudio(content: CurriculumContentPack): readonly CurriculumTaskAudioLine[] {
  return [
    ...content.cities.flatMap((city) => [
      ...city.capsules.flatMap((capsule) => linesFor({
        kind: 'capsule', activityId: capsule.id, cityId: city.cityId, mode: capsule.mode, phase: capsule.phase,
      }, capsule.audio)),
      ...city.exchanges.flatMap((exchange) => linesFor({
        kind: 'exchange', activityId: exchange.id, cityId: city.cityId, mode: exchange.mode,
      }, exchange.audio)),
      ...linesFor({
        kind: 'due-review', activityId: city.dueReview.id, cityId: city.cityId, mode: city.dueReview.mode,
      }, city.dueReview.audio),
      ...city.exitTask.steps.flatMap((step) => linesFor({
        kind: 'exit-step', activityId: step.id, cityId: city.cityId, mode: step.mode,
      }, step.audio)),
    ]),
    ...content.readinessForms.flatMap((form) =>
      form.tasks.flatMap((task) => task.variants.flatMap((variant) => linesFor({
        kind: 'checkpoint', activityId: variant.id, cityId: form.cityId, mode: variant.mode, checkpointId: form.id,
      }, variant.audio)))),
  ]
}
