/**
 * The curriculum seam.
 *
 * A language owns its route's learning architecture just as it owns its words,
 * grammar and prompts. The shared game never decides that a German lesson has
 * Danish functions, or that a city index means the same place on two routes.
 *
 * This is intentionally a contract rather than lesson content. T6 supplies
 * Danish wording, variants, rubrics and audio scripts against these stable ids;
 * T5 persists and schedules the states; T7 renders the Travel Guide. Keeping
 * those concerns apart lets a later language replace the whole manifest.
 */

export type CurriculumLevel = 'a1' | 'a2'

/** What a learner is asked to do with a support item, not a CEFR certificate. */
export type ProductiveRole = 'receptive' | 'controlled' | 'productive'

export type EvidenceMode =
  | 'listening'
  | 'reading'
  | 'controlled-interaction'
  | 'supported-interaction'
  | 'writing'
  | 'grammar-in-use'

/**
 * Separate from word/SRS progress. Every terminal-or-recoverable state remains
 * visible in the Travel Guide, and none of them can block packing or travel.
 */
export type OptionalItemState = 'locked' | 'offered' | 'available' | 'deferred' | 'completed' | 'skipped'

export const OPTIONAL_ITEM_SEMANTICS: Readonly<Record<OptionalItemState, {
  readonly travelGuide: boolean
  readonly blocksJourney: false
  readonly createsEvidence: boolean
}>> = {
  locked: { travelGuide: false, blocksJourney: false, createsEvidence: false },
  offered: { travelGuide: true, blocksJourney: false, createsEvidence: false },
  // The learner ignored an invitation. It remains New in the Travel Guide and
  // the queue advances, so an optional prompt cannot become a travel gate.
  available: { travelGuide: true, blocksJourney: false, createsEvidence: false },
  deferred: { travelGuide: true, blocksJourney: false, createsEvidence: false },
  completed: { travelGuide: true, blocksJourney: false, createsEvidence: true },
  // A skipped train/exit is also recoverable; it records a choice, not mastery.
  skipped: { travelGuide: true, blocksJourney: false, createsEvidence: false },
}

export interface SupportItem {
  readonly id: string
  readonly label: string
  readonly level: CurriculumLevel
  readonly role: ProductiveRole
  /** Zero-based city at or before which this support is introduced. */
  readonly firstCity: number
  /** Communicative purposes, not final Danish utterances. */
  readonly functionIds: readonly string[]
  /** Existing language-ledger forms that T6 must classify and use deliberately. */
  readonly ledgerTerms: readonly string[]
}

export interface CurriculumChapter {
  readonly id: string
  readonly level: CurriculumLevel
  readonly title: string
  readonly formalFocus: string
  readonly firstCity: number
}

export interface CurriculumScene {
  readonly id: string
  readonly title: string
  readonly functionIds: readonly string[]
  readonly supportItemIds: readonly string[]
}

export interface PostWrapItem {
  readonly id: string
  readonly kind: 'grammar' | 'situation'
  readonly supportItemIds: readonly string[]
}

export interface EvidenceRequirement {
  readonly id: string
  readonly mode: EvidenceMode
  readonly role: ProductiveRole
  readonly supportItemIds: readonly string[]
}

export interface CurriculumExit {
  readonly id: string
  readonly kind: 'city-exit' | 'readiness-check'
  readonly level: CurriculumLevel
  readonly evidence: readonly EvidenceRequirement[]
}

export interface CurriculumCity {
  /** Must be the language route's city id, in the same zero-based position. */
  readonly cityId: string
  readonly cityIndex: number
  readonly chapter: CurriculumChapter
  readonly scene: CurriculumScene
  /** Exactly five compact grammar slots followed by four situation slots. */
  readonly postWrapQueue: readonly PostWrapItem[]
  readonly exit: CurriculumExit
}

export interface CurriculumManifest {
  readonly cities: readonly CurriculumCity[]
  readonly supportItems: readonly SupportItem[]
}

/**
 * The future persisted shape. `routeLanguage` is mandatory because a city
 * index is meaningful only inside its own route. T5 owns the actual store and
 * migration; T4 only prevents it from inventing an unnamespaced shape later.
 */
export interface CurriculumProgress<LanguageCode extends string = string> {
  readonly routeLanguage: LanguageCode
  readonly itemStates: Readonly<Record<string, OptionalItemState>>
  readonly evidence: Readonly<Record<string, readonly EvidenceRecord[]>>
}

/** Store route-relative progress under its language, never under a bare city index. */
export type CurriculumProgressByLanguage<LanguageCode extends string = string> =
  Partial<Record<LanguageCode, CurriculumProgress<LanguageCode>>>

export interface EvidenceRecord {
  readonly taskId: string
  readonly variantId: string
  readonly mode: EvidenceMode
  readonly attemptedAt: number
  /** First-attempt rows are append-only; replay creates a new practice row. */
  readonly attemptKind: 'first' | 'practice-replay'
  readonly support: {
    readonly english: 'none' | 'visible' | 'on-request'
    readonly audioReplays: 0 | 1 | 2
    readonly hintUsed: boolean
  }
  readonly comprehension: 'met' | 'not-met' | 'not-applicable'
  readonly communicativeGoal: 'met' | 'not-met' | 'not-applicable'
  readonly targetSuccess: 'met' | 'not-met'
  readonly repair: 'used' | 'missed' | 'not-needed'
  readonly outcome: 'complete' | 'retry'
}

export interface CurriculumRoute {
  readonly cities: readonly { id: string }[]
}

export interface CurriculumValidationOptions {
  readonly ledgerTerms?: ReadonlySet<string>
}

export interface CurriculumValidationReport {
  readonly errors: readonly string[]
  readonly cityCount: number
  readonly supportCount: number
  readonly queueCount: number
  readonly byLevel: Readonly<Record<CurriculumLevel, number>>
  readonly byRole: Readonly<Record<ProductiveRole, number>>
  readonly ledgerTermsReferenced: number
}

const A1_CHECKPOINT_CITY = 5

function duplicateIds(items: readonly { id: string }[], label: string, errors: string[]) {
  const seen = new Set<string>()
  for (const item of items) {
    if (!item.id) errors.push(`${label} has an empty id`)
    else if (seen.has(item.id)) errors.push(`duplicate id "${item.id}" (${label})`)
    else seen.add(item.id)
  }
}

/**
 * Structural validation only. It cannot judge Danish, task authenticity, or
 * scoring quality; those are deliberately T6's expert-review gates.
 */
export function validateCurriculum(
  manifest: CurriculumManifest,
  route: CurriculumRoute,
  options: CurriculumValidationOptions = {},
): CurriculumValidationReport {
  const errors: string[] = []
  const allIds: { id: string }[] = []
  const supportById = new Map(manifest.supportItems.map((item) => [item.id, item]))
  const referencedSupport = new Set<string>()
  const byLevel = { a1: 0, a2: 0 }
  const byRole = { receptive: 0, controlled: 0, productive: 0 }
  const referencedLedger = new Set<string>()

  if (route.cities.length !== 9) errors.push(`route has ${route.cities.length} cities; the curriculum contract requires nine`)
  if (manifest.cities.length !== route.cities.length) {
    errors.push(`manifest has ${manifest.cities.length} cities but route has ${route.cities.length}`)
  }

  duplicateIds(manifest.supportItems, 'support inventory', errors)
  for (const item of manifest.supportItems) {
    allIds.push(item)
    byLevel[item.level]++
    byRole[item.role]++
    if (item.firstCity < 0 || item.firstCity >= route.cities.length) {
      errors.push(`support "${item.id}" has invalid firstCity ${item.firstCity}`)
    }
    if (item.level === 'a1' && item.firstCity > A1_CHECKPOINT_CITY) {
      errors.push(`A1 support "${item.id}" first appears in city ${item.firstCity + 1}, after Skagen's A1 check`)
    }
    if (item.functionIds.length === 0) errors.push(`support "${item.id}" has no language function`)
    if (item.ledgerTerms.length === 0) errors.push(`support "${item.id}" has no ledger terms`)
    for (const term of item.ledgerTerms) {
      referencedLedger.add(term)
      if (options.ledgerTerms && !options.ledgerTerms.has(term)) {
        errors.push(`support "${item.id}" references "${term}", absent from the language function-word ledger`)
      }
    }
  }

  const seenCities = new Set<string>()
  for (const [index, city] of manifest.cities.entries()) {
    const routeCity = route.cities[index]
    if (!routeCity) {
      errors.push(`manifest city "${city.cityId}" has no matching route city at index ${index}`)
      continue
    }
    if (city.cityIndex !== index) errors.push(`city "${city.cityId}" says cityIndex ${city.cityIndex}, expected ${index}`)
    if (city.cityId !== routeCity.id) errors.push(`city ${index + 1} is "${city.cityId}", expected route city "${routeCity.id}"`)
    if (seenCities.has(city.cityId)) errors.push(`duplicate city "${city.cityId}" in curriculum manifest`)
    seenCities.add(city.cityId)

    allIds.push(city.chapter, city.scene, city.exit)
    if (city.chapter.firstCity !== index) {
      errors.push(`chapter "${city.chapter.id}" firstCity ${city.chapter.firstCity} does not prepare city ${index + 1}`)
    }
    const expectedLevel: CurriculumLevel = index <= A1_CHECKPOINT_CITY ? 'a1' : 'a2'
    if (city.chapter.level !== expectedLevel || city.exit.level !== expectedLevel) {
      errors.push(`city ${index + 1} must be on the ${expectedLevel.toUpperCase()} path, not ${city.chapter.level.toUpperCase()}/${city.exit.level.toUpperCase()}`)
    }
    if (city.scene.functionIds.length === 0) errors.push(`scene "${city.scene.id}" has no functions`)
    if (city.scene.supportItemIds.length === 0) errors.push(`scene "${city.scene.id}" has no support items`)

    const grammar = city.postWrapQueue.filter((item) => item.kind === 'grammar')
    const situations = city.postWrapQueue.filter((item) => item.kind === 'situation')
    if (city.postWrapQueue.length !== 9 || grammar.length !== 5 || situations.length !== 4) {
      errors.push(`city ${index + 1} queue must be five grammar + four situation items; got ${grammar.length} + ${situations.length}`)
    }
    const firstSituation = city.postWrapQueue.findIndex((item) => item.kind === 'situation')
    if (firstSituation !== -1 && city.postWrapQueue.slice(firstSituation).some((item) => item.kind !== 'situation')) {
      errors.push(`city ${index + 1} queue interleaves grammar after a situation; its order must remain readable`)
    }
    allIds.push(...city.postWrapQueue)

    const referenced = [
      ...city.scene.supportItemIds,
      ...city.postWrapQueue.flatMap((item) => item.supportItemIds),
      ...city.exit.evidence.flatMap((item) => item.supportItemIds),
    ]
    for (const id of referenced) {
      referencedSupport.add(id)
      const support = supportById.get(id)
      if (!support) {
        errors.push(`city ${index + 1} references unknown support "${id}"`)
      } else if (support.firstCity > index) {
        errors.push(`city ${index + 1} needs support "${id}" before its firstCity ${support.firstCity + 1}; task is unreachable`)
      }
    }

    if (city.exit.evidence.length === 0) errors.push(`exit "${city.exit.id}" has no evidence modes`)
    allIds.push(...city.exit.evidence)
    for (const evidence of city.exit.evidence) {
      if (evidence.supportItemIds.length === 0) errors.push(`evidence "${evidence.id}" has no support items`)
      if (city.exit.kind === 'readiness-check' && evidence.role === 'receptive' && evidence.mode === 'supported-interaction') {
        errors.push(`evidence "${evidence.id}" cannot be receptive and supported-interaction at once`)
      }
    }
    if (index === A1_CHECKPOINT_CITY && (city.exit.kind !== 'readiness-check' || city.exit.level !== 'a1')) {
      errors.push(`Skagen (city 6) must carry the A1 readiness check`)
    }
    if (index === route.cities.length - 1 && (city.exit.kind !== 'readiness-check' || city.exit.level !== 'a2')) {
      errors.push(`the final city must carry the A2 readiness check`)
    }
  }
  for (const item of manifest.supportItems) {
    if (!referencedSupport.has(item.id)) errors.push(`support "${item.id}" has no city entry point`)
  }
  duplicateIds(allIds, 'curriculum manifest', errors)

  return {
    errors,
    cityCount: manifest.cities.length,
    supportCount: manifest.supportItems.length,
    queueCount: manifest.cities.reduce((sum, city) => sum + city.postWrapQueue.length, 0),
    byLevel,
    byRole,
    ledgerTermsReferenced: referencedLedger.size,
  }
}
