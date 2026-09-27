import type {
  CurriculumLevel,
  CurriculumManifest,
  EvidenceMode,
  ProductiveRole,
} from './curriculum'

/**
 * Authored curriculum content remains separate from the T4 route contract.
 * A language can replace this entire payload without teaching its rules to the
 * shared scheduler or UI. The dedicated T6 review is complete; T5/T7 may
 * consume only payloads whose acceptance status and review gate agree.
 */
export type ContentReviewStatus = 'review-ready' | 'accepted'

export type SupportTarget =
  | 'a1-productive'
  | 'a1-receptive'
  | 'a2-productive'
  | 'a2-receptive'
  | 'ambient'

export type CurriculumUse =
  | 'preview-as-chunk'
  | 'controlled-target'
  | 'productive-target'
  | 'receptive-ambient'

export interface CurriculumUseStage {
  readonly city: number
  readonly use: CurriculumUse
  readonly functionIds: readonly string[]
}

export interface CurriculumCoverageFloor {
  readonly meaningfulInputs: number
  readonly lexicalFamilies: number
  readonly distinctTemplates: number
  readonly promptedRetrievals: number
  readonly scenarioUses: number
  readonly comprehensionSamples: number
}

export interface LedgerFormProfile {
  readonly term: string
  readonly target: SupportTarget
  /** Zero-based route city where deliberate teaching may first use the form. */
  readonly firstCity: number
  readonly functionIds: readonly string[]
  /** A form may arrive as a chunk before later controlled/productive analysis. */
  readonly stages: readonly CurriculumUseStage[]
  readonly coverageFloor: CurriculumCoverageFloor
}

export interface SupplementalSupport {
  readonly id: string
  readonly kind: 'word' | 'chunk'
  readonly forms: readonly string[]
  readonly target: Exclude<SupportTarget, 'ambient'>
  readonly firstCity: number
  readonly functionIds: readonly string[]
  readonly glossEn: string
  readonly stages: readonly CurriculumUseStage[]
  readonly coverageFloor: CurriculumCoverageFloor
}

export type DescriptorSource =
  | 'cefr-companion-2020'
  | 'coe-action-oriented'
  // The national curriculum each language's beginner path is mapped against,
  // plus a Reference Level Description where the Council of Europe recognises
  // one. Danish has no RLD, which is why the Danish pack maps to BEK alone.
  | 'bek-1686-2025'
  | 'bamf-rahmencurriculum'
  | 'profile-deutsch'

export interface CurriculumDescriptor {
  readonly id: string
  readonly source: DescriptorSource
  readonly sourceUrl: string
  readonly level: CurriculumLevel | 'a1-a2'
  readonly modes: readonly EvidenceMode[]
  /** A concise project paraphrase, never presented as a verbatim quotation. */
  readonly canDoEn: string
  readonly boundaryEn: string
}

export interface CurriculumRubric {
  readonly id: string
  readonly level: CurriculumLevel
  readonly mode: EvidenceMode
  readonly criteria: readonly {
    readonly id: string
    readonly labelEn: string
    readonly max: number
    readonly descriptionEn: string
  }[]
  readonly bands: readonly {
    readonly min: number
    readonly labelEn: 'not-yet' | 'with-support' | 'ready-in-this-mode'
    readonly interpretationEn: string
  }[]
}

export interface DanishAudioLine {
  readonly id: string
  readonly speaker: 'casey' | 'other' | 'announcement'
  /** S4 may bake this field. There is intentionally no English-audio field. */
  readonly textDa: string
}

export interface CurriculumAnswer {
  readonly kind: 'select' | 'text' | 'order'
  /** Danish strings accepted by the authored route; the final Sol review may widen it. */
  readonly acceptedDa: readonly string[]
  readonly modelDa: string
  /** Select/order surfaces only. The correct response may appear here by design. */
  readonly choicesDa?: readonly string[]
}

export interface ScoredCurriculumActivity {
  readonly id: string
  readonly level: CurriculumLevel
  readonly mode: EvidenceMode
  readonly role: ProductiveRole
  readonly titleEn: string
  /** Standalone context shown when this is opened weeks later in Travel Guide. */
  readonly travelGuideContextEn: string
  readonly promptEn: string
  /** Danish written stimulus. It may contain the information being assessed. */
  readonly visualDa?: string
  /** Visible English help. English is never included in an audio line. */
  readonly visualSupportEn?: string
  readonly audio: readonly DanishAudioLine[]
  readonly answer: CurriculumAnswer
  readonly feedbackEn: string
  readonly rubricId: string
  readonly descriptorIds: readonly string[]
  readonly supportItemIds: readonly string[]
  readonly evidencePolicy: {
    readonly variantId: string
    readonly allowedEnglishSupport: 'none' | 'visible' | 'on-request'
    readonly replayLimit: 0 | 1 | 2
    readonly firstAttemptImmutable: true
    readonly communicativeGoalEn: string
    readonly targetSuccessEn: string
    readonly feedbackRuleEn: string
  }
}

export interface GrammarCapsule extends ScoredCurriculumActivity {
  readonly phase: 'notice' | 'discriminate' | 'manipulate' | 'listen' | 'transfer'
  readonly observationEn: string
}

export interface SurvivalExchange extends ScoredCurriculumActivity {
  readonly sceneId: string
  readonly variant: 1 | 2 | 3 | 4
  readonly successCriterionEn: string
}

export interface DueReview extends ScoredCurriculumActivity {
  readonly sourceItemIds: readonly string[]
}

export interface CityExitTask {
  readonly id: string
  readonly sceneId: string
  readonly titleEn: string
  readonly travelGuideContextEn: string
  readonly novelDetailEn: string
  readonly steps: readonly ScoredCurriculumActivity[]
}

export interface CurriculumCityContent {
  readonly cityId: string
  readonly chapterId: string
  readonly sceneId: string
  readonly capsules: readonly GrammarCapsule[]
  readonly exchanges: readonly SurvivalExchange[]
  readonly dueReview: DueReview
  readonly exitTask: CityExitTask
}

export interface ReadinessVariant extends ScoredCurriculumActivity {
  readonly form: 'a' | 'b'
}

export interface ReadinessTask {
  readonly id: string
  readonly mode: EvidenceMode
  readonly rubricId: string
  /** Two parallel forms: changed details, same construct and support burden. */
  readonly variants: readonly [ReadinessVariant, ReadinessVariant]
}

export interface ReadinessForm {
  readonly id: string
  readonly cityId: string
  readonly level: CurriculumLevel
  readonly titleEn: string
  readonly claimBoundaryEn: string
  readonly evidenceRule: {
    readonly checkpointAndAccumulated: true
    readonly minimumContextsPerMode: number
    readonly reportModesSeparately: true
    readonly overallPassForbidden: true
  }
  readonly tasks: readonly ReadinessTask[]
}

export interface GrammarRewriteChapter {
  readonly cityId: string
  readonly titleDa: string
  readonly titleEn: string
  readonly formalFocusEn: string
  readonly rewriteEn: readonly string[]
  readonly doNotClaimEn: readonly string[]
  readonly modelExamplesDa: readonly string[]
  readonly descriptorIds: readonly string[]
  /**
   * The fixed, learner-facing book lesson for this city.  This is the source
   * of both the Guide and the train page sheets; do not duplicate examples in
   * a screen-local projection.
   */
  readonly lesson: GrammarRewriteLesson
  /** A city may deliberately add a second named lesson without adding a city. */
  readonly additionalLessons?: readonly GrammarRewriteLesson[]
}

export type GrammarLessonRuleBlock =
  | { readonly kind: 'paragraph'; readonly text: string }
  | { readonly kind: 'heading'; readonly text: string; readonly level?: 2 | 3 }
  | { readonly kind: 'quote'; readonly text: string }
  | { readonly kind: 'table'; readonly headers: readonly string[]; readonly rows: readonly (readonly string[])[] }

export interface GrammarRewriteLesson {
  /** Stable reader and route key, independent of its visible title. */
  readonly id: string
  readonly titleDa: string
  readonly titleEn: string
  readonly rulesContext: string
  readonly rules: readonly GrammarLessonRuleBlock[]
  readonly examplesTitleEn: string
  readonly examples: readonly (readonly [danish: string, english: string])[]
}

export interface GrammarRewriteBrief {
  readonly status: ContentReviewStatus
  readonly chapterSemanticsEn: string
  readonly exampleSentenceRulesEn: readonly string[]
  readonly chapters: readonly GrammarRewriteChapter[]
}

export interface CurriculumReviewGate {
  readonly id: 'sol-danish-review'
  readonly status: 'pending' | 'complete'
  readonly remitEn: string
}

export interface CurriculumContentPack {
  readonly language: string
  readonly status: ContentReviewStatus
  readonly claimBoundaryEn: string
  readonly reviewGates: readonly CurriculumReviewGate[]
  readonly ledgerForms: readonly LedgerFormProfile[]
  readonly supplementalSupport: readonly SupplementalSupport[]
  readonly descriptors: readonly CurriculumDescriptor[]
  readonly rubrics: readonly CurriculumRubric[]
  readonly cities: readonly CurriculumCityContent[]
  readonly readinessForms: readonly ReadinessForm[]
  readonly grammarRewriteBrief: GrammarRewriteBrief
}

export interface CurriculumContentValidationOptions {
  readonly ledgerTerms: ReadonlySet<string>
}

export interface CurriculumContentValidationReport {
  readonly errors: readonly string[]
  readonly status: ContentReviewStatus
  readonly ledgerClassified: number
  readonly supplementalSupport: number
  readonly capsules: number
  readonly exchanges: number
  readonly dueReviews: number
  readonly exits: number
  readonly exitSteps: number
  readonly scoredActivities: number
  readonly readinessTasks: number
  readonly readinessVariants: number
  readonly audioLines: number
  readonly descriptorLinks: number
  readonly byTarget: Readonly<Record<SupportTarget, number>>
  readonly byUse: Readonly<Record<CurriculumUse, number>>
}

const PHASES: readonly GrammarCapsule['phase'][] = [
  'notice', 'discriminate', 'manipulate', 'listen', 'transfer',
]

const DEFERRED_CONTEXT_HAZARDS = [
  /just packed/i,
  /this round/i,
  /the round you just/i,
  /on this train/i,
  /you have just/i,
  /you've just/i,
]

const normalize = (value: string): string[] =>
  value.toLocaleLowerCase('da-DK').match(/[\p{L}\p{N}]+/gu) ?? []

const containsPhrase = (surface: string, phrase: string): boolean => {
  const haystack = normalize(surface)
  const needle = normalize(phrase)
  if (needle.length === 0 || haystack.length < needle.length) return false
  return haystack.some((_, start) => needle.every((token, offset) => haystack[start + offset] === token))
}

const activitySurfaces = (activity: ScoredCurriculumActivity): string[] => [
  activity.titleEn,
  activity.travelGuideContextEn,
  activity.promptEn,
  activity.visualSupportEn ?? '',
  (activity as Partial<GrammarCapsule>).observationEn ?? '',
]

/**
 * Machine-checkable content integrity only. Danish naturalness, CEFR alignment,
 * scoring validity and register remain the named Sol review gate.
 */
export function validateCurriculumContent(
  content: CurriculumContentPack,
  manifest: CurriculumManifest,
  options: CurriculumContentValidationOptions,
): CurriculumContentValidationReport {
  const errors: string[] = []
  const descriptorById = new Map(content.descriptors.map((item) => [item.id, item]))
  const rubricById = new Map(content.rubrics.map((item) => [item.id, item]))
  const supportById = new Map(manifest.supportItems.map((item) => [item.id, item]))
  const cityById = new Map(manifest.cities.map((item) => [item.cityId, item]))
  const allIds = new Set<string>()
  const audioIds = new Set<string>()
  const authoredSupportIds = new Set<string>()
  let descriptorLinks = 0

  const uniqueId = (id: string, label: string) => {
    if (!id) errors.push(`${label} has an empty id`)
    else if (allIds.has(id)) errors.push(`duplicate authored id "${id}"`)
    else allIds.add(id)
  }

  const validateActivity = (activity: ScoredCurriculumActivity, cityIndex: number) => {
    uniqueId(activity.id, 'activity')
    if (!activity.travelGuideContextEn.trim()) errors.push(`${activity.id} has no deferred Travel Guide context`)
    if (DEFERRED_CONTEXT_HAZARDS.some((pattern) => pattern.test(activity.travelGuideContextEn))) {
      errors.push(`${activity.id} depends on immediate-play context and will not defer cleanly`)
    }
    if (!activity.promptEn.trim()) errors.push(`${activity.id} has no prompt`)
    if (activity.audio.length === 0) errors.push(`${activity.id} has no Danish audio script`)
    for (const line of activity.audio) {
      if (!line.textDa.trim()) errors.push(`${activity.id} has an empty Danish audio line`)
      if (audioIds.has(line.id)) errors.push(`duplicate audio id "${line.id}"`)
      audioIds.add(line.id)
    }
    if (activity.answer.acceptedDa.length === 0) errors.push(`${activity.id} has no accepted answer`)
    if (!activity.answer.acceptedDa.includes(activity.answer.modelDa)) {
      errors.push(`${activity.id} model answer is not accepted`)
    }
    if (activity.answer.kind === 'select') {
      if (!activity.answer.choicesDa || activity.answer.choicesDa.length < 2) {
        errors.push(`${activity.id} select answer has fewer than two choices`)
      } else if (!activity.answer.acceptedDa.every((answer) => activity.answer.choicesDa!.includes(answer))) {
        errors.push(`${activity.id} accepts a choice that is not visible`)
      }
    }
    if (activity.answer.kind === 'order' && (!activity.answer.choicesDa || activity.answer.choicesDa.length < 2)) {
      errors.push(`${activity.id} order answer has no tokens`)
    }
    const blindSurface = activitySurfaces(activity).join(' ')
    for (const answer of activity.answer.acceptedDa) {
      if (containsPhrase(blindSurface, answer)) {
        errors.push(`${activity.id} leaks accepted answer "${answer}" before the response`)
      }
    }
    const phase = (activity as Partial<GrammarCapsule>).phase
    const answerBearingAudioIsTheConstruct = activity.mode === 'listening' || phase === 'notice'
    if (!answerBearingAudioIsTheConstruct) {
      const audioSurface = activity.audio.map((line) => line.textDa).join(' ')
      for (const answer of activity.answer.acceptedDa) {
        if (containsPhrase(audioSurface, answer)) {
          errors.push(`${activity.id} plays accepted answer "${answer}" before the response`)
        }
      }
    }
    const rubric = rubricById.get(activity.rubricId)
    if (!rubric) errors.push(`${activity.id} references unknown rubric "${activity.rubricId}"`)
    else if (rubric.mode !== activity.mode || rubric.level !== activity.level) {
      errors.push(`${activity.id} uses ${rubric.level}/${rubric.mode} rubric for ${activity.level}/${activity.mode}`)
    }
    if (activity.descriptorIds.length === 0) errors.push(`${activity.id} has no descriptor mapping`)
    for (const id of activity.descriptorIds) {
      const descriptor = descriptorById.get(id)
      descriptorLinks++
      if (!descriptor) errors.push(`${activity.id} references unknown descriptor "${id}"`)
      else {
        if (descriptor.level !== 'a1-a2' && descriptor.level !== activity.level) {
          errors.push(`${activity.id} maps ${activity.level.toUpperCase()} work to ${descriptor.level.toUpperCase()} descriptor "${id}"`)
        }
        if (!descriptor.modes.includes(activity.mode)) {
          errors.push(`${activity.id} maps ${activity.mode} work to incompatible descriptor "${id}"`)
        }
      }
    }
    if (activity.supportItemIds.length === 0) errors.push(`${activity.id} has no support mapping`)
    for (const id of activity.supportItemIds) {
      authoredSupportIds.add(id)
      const support = supportById.get(id)
      if (!support) errors.push(`${activity.id} references unknown support "${id}"`)
      else if (support.firstCity > cityIndex) errors.push(`${activity.id} uses support "${id}" before city ${support.firstCity + 1}`)
    }
    if (activity.evidencePolicy.variantId !== activity.id) errors.push(`${activity.id} has a drifting evidence variant id`)
    if (!activity.evidencePolicy.firstAttemptImmutable) errors.push(`${activity.id} can overwrite first-attempt evidence`)
    if (activity.evidencePolicy.replayLimit > 0 && activity.mode !== 'listening') {
      errors.push(`${activity.id} allows audio replay outside a listening construct`)
    }
    if (!activity.evidencePolicy.communicativeGoalEn.trim()) errors.push(`${activity.id} has no communicative evidence goal`)
    if (!activity.evidencePolicy.targetSuccessEn.trim()) errors.push(`${activity.id} has no target-success rule`)
    if (!activity.evidencePolicy.feedbackRuleEn.trim()) errors.push(`${activity.id} has no feedback rule`)
  }

  for (const descriptor of content.descriptors) {
    uniqueId(descriptor.id, 'descriptor')
    if (!descriptor.sourceUrl.startsWith('https://')) errors.push(`${descriptor.id} has no cited source URL`)
    if (!descriptor.canDoEn.trim() || !descriptor.boundaryEn.trim()) errors.push(`${descriptor.id} has no descriptor claim boundary`)
  }
  for (const rubric of content.rubrics) {
    uniqueId(rubric.id, 'rubric')
    if (rubric.criteria.length < 2) errors.push(`${rubric.id} has fewer than two scored criteria`)
    if (rubric.bands.length < 3) errors.push(`${rubric.id} has fewer than three descriptive bands`)
  }

  if (content.status !== 'accepted') {
    errors.push(`Sol-reviewed T6 content must be accepted; got "${content.status}"`)
  }
  const expectedGates = new Set(['sol-danish-review'])
  for (const gate of content.reviewGates) {
    expectedGates.delete(gate.id)
    if (gate.status !== 'complete') errors.push(`${gate.id} is incomplete; accepted content requires a completed review gate`)
  }
  for (const gate of expectedGates) errors.push(`missing review gate "${gate}"`)

  const classified = new Map<string, LedgerFormProfile>()
  const byTarget: Record<SupportTarget, number> = {
    'a1-productive': 0,
    'a1-receptive': 0,
    'a2-productive': 0,
    'a2-receptive': 0,
    ambient: 0,
  }
  const byUse: Record<CurriculumUse, number> = {
    'preview-as-chunk': 0,
    'controlled-target': 0,
    'productive-target': 0,
    'receptive-ambient': 0,
  }
  for (const profile of content.ledgerForms) {
    if (classified.has(profile.term)) errors.push(`ledger form "${profile.term}" is classified twice`)
    classified.set(profile.term, profile)
    byTarget[profile.target]++
    if (!options.ledgerTerms.has(profile.term)) errors.push(`classified form "${profile.term}" is absent from the ledger`)
    if (profile.firstCity < 0 || profile.firstCity > 8) errors.push(`classified form "${profile.term}" has invalid firstCity`)
    if (profile.target.startsWith('a1-') && profile.firstCity > 5) {
      errors.push(`A1 form "${profile.term}" first appears after Skagen`)
    }
    if (profile.functionIds.length === 0) errors.push(`classified form "${profile.term}" has no function`)
    if (profile.stages.length === 0) errors.push(`classified form "${profile.term}" has no use stage`)
    if (profile.stages[0]?.city !== profile.firstCity) errors.push(`classified form "${profile.term}" firstCity does not match its first use stage`)
    for (const [index, stage] of profile.stages.entries()) {
      byUse[stage.use]++
      if (stage.city < 0 || stage.city > 8) errors.push(`classified form "${profile.term}" has an invalid stage city`)
      if (index > 0 && stage.city < profile.stages[index - 1]!.city) errors.push(`classified form "${profile.term}" has stages out of order`)
      if (stage.functionIds.length === 0) errors.push(`classified form "${profile.term}" has a stage without a function`)
    }
    if (profile.target === 'ambient' && Object.values(profile.coverageFloor).some((value) => value !== 0)) {
      errors.push(`ambient form "${profile.term}" has a gating coverage floor`)
    }
  }
  for (const term of options.ledgerTerms) {
    if (!classified.has(term)) errors.push(`ledger form "${term}" is unclassified`)
  }

  for (const item of content.supplementalSupport) {
    uniqueId(item.id, 'supplemental support')
    if (item.forms.length === 0) errors.push(`${item.id} has no Danish form`)
    if (item.functionIds.length === 0) errors.push(`${item.id} has no function`)
    if (item.target.startsWith('a1-') && item.firstCity > 5) errors.push(`${item.id} arrives after the A1 checkpoint`)
    if (item.stages.length === 0 || item.stages[0]?.city !== item.firstCity) errors.push(`${item.id} has no valid first use stage`)
    for (const stage of item.stages) byUse[stage.use]++
  }
  const recentPastSupport = content.supplementalSupport.find((item) => item.id === 'da-chunk-a1-recent-past')
  const requiredRecentPastForms = [
    'I går arbejdede jeg …', 'I dag har jeg arbejdet …',
    'I går lavede jeg …', 'I dag har jeg lavet …',
    'I går købte jeg …', 'I dag har jeg købt …',
    'I går læste jeg …', 'I dag har jeg læst …',
  ]
  const routeActivities = content.cities.flatMap((city) => [
    ...city.capsules, ...city.exchanges, ...city.exitTask.steps,
  ])
  const recentPastRetrievals = routeActivities.filter((activity) =>
    activity.role !== 'receptive' && activity.supportItemIds.includes('a1-recent-past'))
  const recentPastScenarios = content.cities.flatMap((city) => city.exchanges).filter((activity) =>
    activity.supportItemIds.includes('a1-recent-past'))
  const aalborgDelayedRecentPast = content.cities.find((city) => city.cityId === 'aalborg')?.exchanges.find(
    (activity) => activity.id === 'aalborg-situation-4',
  )
  const aarhusContrast = content.cities.find((city) => city.cityId === 'aarhus')?.capsules.find(
    (activity) => activity.id === 'aarhus-listen',
  )
  const sameDayContrastCount = Math.floor(
    (aarhusContrast?.audio.filter((line) => line.textDa.startsWith('I dag ')).length ?? 0) / 2,
  )
  if (!recentPastSupport
    || recentPastSupport.forms.length < 8
    || requiredRecentPastForms.some((form) => !recentPastSupport.forms.includes(form))
    || recentPastSupport.coverageFloor.meaningfulInputs < 8
    || recentPastSupport.coverageFloor.lexicalFamilies < 4
    || recentPastSupport.coverageFloor.promptedRetrievals < 4
    || recentPastSupport.coverageFloor.scenarioUses < 2
    || recentPastSupport.coverageFloor.comprehensionSamples < 2
    || recentPastRetrievals.length < recentPastSupport.coverageFloor.promptedRetrievals
    || recentPastScenarios.length < recentPastSupport.coverageFloor.scenarioUses
    || !aalborgDelayedRecentPast?.supportItemIds.includes('a1-recent-past')
    || sameDayContrastCount < recentPastSupport.coverageFloor.comprehensionSamples) {
    errors.push('A1 recent-past support does not meet the owner evidence floor')
  }

  if (content.cities.length !== manifest.cities.length) {
    errors.push(`content has ${content.cities.length} cities; manifest has ${manifest.cities.length}`)
  }
  for (const [cityIndex, cityContent] of content.cities.entries()) {
    const city = cityById.get(cityContent.cityId)
    if (!city || city.cityIndex !== cityIndex) {
      errors.push(`content city ${cityIndex + 1} "${cityContent.cityId}" does not match the manifest`)
      continue
    }
    if (cityContent.chapterId !== city.chapter.id) errors.push(`${cityContent.cityId} content has the wrong chapter id`)
    if (cityContent.sceneId !== city.scene.id) errors.push(`${cityContent.cityId} content has the wrong scene id`)
    if (cityContent.capsules.length !== 5) errors.push(`${cityContent.cityId} has ${cityContent.capsules.length} capsules; expected five`)
    if (cityContent.exchanges.length !== 4) errors.push(`${cityContent.cityId} has ${cityContent.exchanges.length} exchanges; expected four`)
    const grammarIds = city.postWrapQueue.filter((item) => item.kind === 'grammar').map((item) => item.id)
    const situationIds = city.postWrapQueue.filter((item) => item.kind === 'situation').map((item) => item.id)
    if (cityContent.capsules.map((item) => item.id).join('|') !== grammarIds.join('|')) {
      errors.push(`${cityContent.cityId} capsules do not match the T4 grammar queue`)
    }
    if (cityContent.exchanges.map((item) => item.id).join('|') !== situationIds.join('|')) {
      errors.push(`${cityContent.cityId} exchanges do not match the T4 situation queue`)
    }
    if (cityContent.capsules.map((item) => item.phase).join('|') !== PHASES.join('|')) {
      errors.push(`${cityContent.cityId} capsule phases are not notice/discriminate/manipulate/listen/transfer`)
    }
    for (const capsule of cityContent.capsules) validateActivity(capsule, cityIndex)
    for (const [index, exchange] of cityContent.exchanges.entries()) {
      if (exchange.variant !== index + 1) errors.push(`${exchange.id} has variant ${exchange.variant}; expected ${index + 1}`)
      if (exchange.sceneId !== city.scene.id) errors.push(`${exchange.id} does not belong to ${city.scene.id}`)
      validateActivity(exchange, cityIndex)
    }
    for (const id of cityContent.dueReview.sourceItemIds) {
      if (!grammarIds.includes(id) && !situationIds.includes(id)) errors.push(`${cityContent.dueReview.id} reviews unknown item "${id}"`)
    }
    validateActivity(cityContent.dueReview, cityIndex)
    if (cityContent.exitTask.id !== city.exit.id) errors.push(`${cityContent.cityId} exit id does not match T4`)
    if (cityContent.exitTask.sceneId !== city.scene.id) errors.push(`${cityContent.cityId} exit does not belong to its scene`)
    uniqueId(cityContent.exitTask.id, 'city exit')
    if (!cityContent.exitTask.travelGuideContextEn.trim()) errors.push(`${cityContent.exitTask.id} has no deferred Travel Guide context`)
    if (DEFERRED_CONTEXT_HAZARDS.some((pattern) => pattern.test(cityContent.exitTask.travelGuideContextEn))) {
      errors.push(`${cityContent.exitTask.id} depends on immediate-play context and will not defer cleanly`)
    }
    if (cityContent.exitTask.steps.length === 0) errors.push(`${cityContent.exitTask.id} has no scored route`)
    for (const step of cityContent.exitTask.steps) validateActivity(step, cityIndex)
  }

  const readinessByCity = new Map(content.readinessForms.map((item) => [item.cityId, item]))
  for (const [cityId, level, modes] of [
    ['skagen', 'a1', ['listening', 'reading', 'supported-interaction', 'writing', 'writing']],
    ['kobenhavn', 'a2', ['listening', 'reading', 'supported-interaction', 'writing', 'grammar-in-use']],
  ] as const) {
    const form = readinessByCity.get(cityId)
    if (!form) {
      errors.push(`missing ${cityId} ${level.toUpperCase()} readiness form`)
      continue
    }
    if (form.level !== level) errors.push(`${form.id} has level ${form.level}; expected ${level}`)
    if (!form.evidenceRule.checkpointAndAccumulated || form.evidenceRule.minimumContextsPerMode < 2) {
      errors.push(`${form.id} can make a readiness claim from one checkpoint context`)
    }
    if (!form.evidenceRule.reportModesSeparately || !form.evidenceRule.overallPassForbidden) {
      errors.push(`${form.id} permits an overall level pass instead of a mode profile`)
    }
    if (form.tasks.map((task) => task.mode).join('|') !== modes.join('|')) {
      errors.push(`${form.id} does not report the required modes separately`)
    }
    for (const task of form.tasks) {
      uniqueId(task.id, 'readiness task')
      if (task.variants.length !== 2) errors.push(`${task.id} needs two parallel forms`)
      const [a, b] = task.variants
      if (a.form !== 'a' || b.form !== 'b') errors.push(`${task.id} variants must be forms a and b`)
      if (a.mode !== b.mode || a.role !== b.role || a.rubricId !== b.rubricId || a.answer.kind !== b.answer.kind) {
        errors.push(`${task.id} variants do not preserve mode, role, rubric and response shape`)
      }
      if (task.id === 'skagen-a1-recent-past-writing') {
        for (const variant of task.variants) {
          if (!variant.supportItemIds.includes('a1-recent-past')) {
            errors.push(`${variant.id} does not assess the owner-required A1 recent-past outcome`)
          }
        }
      }
      validateActivity(a, cityId === 'skagen' ? 5 : 8)
      validateActivity(b, cityId === 'skagen' ? 5 : 8)
    }
  }
  if (readinessByCity.size !== 2) errors.push(`expected two readiness forms; got ${readinessByCity.size}`)

  for (const item of manifest.supportItems) {
    if (!authoredSupportIds.has(item.id)) errors.push(`T4 support "${item.id}" has no authored T6 activity`)
  }

  if (content.grammarRewriteBrief.status !== 'accepted') errors.push('grammar rewrite brief is not accepted')
  if (content.grammarRewriteBrief.chapters.length !== 9) errors.push('grammar rewrite brief must have nine chapters')
  for (const [index, chapter] of content.grammarRewriteBrief.chapters.entries()) {
    if (chapter.cityId !== manifest.cities[index]?.cityId) errors.push(`grammar rewrite chapter ${index + 1} has the wrong city`)
    if (chapter.modelExamplesDa.length < 2) errors.push(`${chapter.cityId} rewrite brief has fewer than two Danish examples`)
    for (const id of chapter.descriptorIds) if (!descriptorById.has(id)) errors.push(`${chapter.cityId} rewrite brief references unknown descriptor "${id}"`)
  }
  const aarhusBrief = content.grammarRewriteBrief.chapters.find((chapter) => chapter.cityId === 'aarhus')
  if (!aarhusBrief?.doNotClaimEn.some((claim) => /i går.*preterite.*i dag.*perfect/i.test(claim))) {
    errors.push('aarhus rewrite brief lacks the owner-required yesterday/today anti-rule')
  }

  const capsules = content.cities.reduce((sum, city) => sum + city.capsules.length, 0)
  const exchanges = content.cities.reduce((sum, city) => sum + city.exchanges.length, 0)
  const readinessTasks = content.readinessForms.reduce((sum, form) => sum + form.tasks.length, 0)
  const readinessVariants = content.readinessForms.reduce(
    (sum, form) => sum + form.tasks.reduce((taskSum, task) => taskSum + task.variants.length, 0), 0,
  )
  const exitSteps = content.cities.reduce((sum, city) => sum + city.exitTask.steps.length, 0)
  return {
    errors,
    status: content.status,
    ledgerClassified: classified.size,
    supplementalSupport: content.supplementalSupport.length,
    capsules,
    exchanges,
    dueReviews: content.cities.length,
    exits: content.cities.length,
    exitSteps,
    scoredActivities: capsules + exchanges + content.cities.length + exitSteps + readinessVariants,
    readinessTasks,
    readinessVariants,
    audioLines: audioIds.size,
    descriptorLinks,
    byTarget,
    byUse,
  }
}
