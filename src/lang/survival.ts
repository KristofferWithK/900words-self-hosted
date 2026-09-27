/**
 * Read-only exchanges for the Travel Guide's Survival section.
 *
 * This is intentionally separate from the older scored curriculum activities:
 * a Survival page re-presents an authored target as a compact conversation.
 * Reading it never writes assessment evidence.
 */
export interface SurvivalPhrase {
  readonly da: string
  readonly en: string
}

export interface SurvivalDialogueLine {
  readonly speaker: 'traveller' | 'local'
  readonly da: string
  readonly en: string
}

export interface SurvivalExchange {
  /** Stable ID of the existing authored curriculum target this page presents. */
  readonly targetActivityId: string
  readonly titleEn: string
  /**
   * How the speakers address each other, in the language's own word: `du`,
   * `Sie`, `De`, `usted`.
   *
   * Optional, because it is only worth recording where the language makes the
   * learner choose. Danish omits it: contemporary `du` is the productive voice
   * of the whole accepted course and `De` is receptive only (T6 blocker B6), so
   * a field on all 36 pages would say the same thing 36 times. German declares
   * it on every page, because `Sie` is the working register of its transaction,
   * direction, help and service scenes while `du` belongs to peers — and a
   * counter clerk addressed as `du` is the error a German course is likeliest
   * to ship at volume.
   *
   * The reader prints it as-is next to the exchange title. It is the language
   * being learned, not chrome, so it does not go through `src/i18n`.
   */
  readonly register?: string
  readonly phrases: readonly SurvivalPhrase[]
  /** Exactly four short, learner-facing lines; each English gloss is tap-revealed by the reader. */
  readonly dialogue: readonly [SurvivalDialogueLine, SurvivalDialogueLine, SurvivalDialogueLine, SurvivalDialogueLine]
}

export interface CitySurvivalGuide {
  readonly cityId: string
  readonly cityIndex: number
  readonly themeEn: string
  /** Four optional exchanges in their authored order. */
  readonly exchanges: readonly [SurvivalExchange, SurvivalExchange, SurvivalExchange, SurvivalExchange]
}

export interface SurvivalGuide {
  readonly cities: readonly CitySurvivalGuide[]
}

/**
 * Structural guard for content packs and alternate language routes. It does
 * not assess naturalness; the Danish curriculum target remains the source of
 * that authoring/review.
 */
export interface SurvivalGuideRules {
  /**
   * Require every exchange to declare its address form. On for a language that
   * makes the learner choose one; off for Danish, which has one productive
   * voice — see `SurvivalExchange.register`.
   */
  readonly registers?: readonly string[]
}

export function validateSurvivalGuide(
  guide: SurvivalGuide,
  expectedCityIds: readonly string[],
  rules: SurvivalGuideRules = {},
): readonly string[] {
  const errors: string[] = []
  if (guide.cities.length !== expectedCityIds.length) {
    errors.push(`survival guide has ${guide.cities.length} cities, expected ${expectedCityIds.length}`)
  }
  const ids = new Set<string>()
  for (const [index, city] of guide.cities.entries()) {
    if (city.cityId !== expectedCityIds[index]) errors.push(`survival city ${index + 1} is ${city.cityId}, expected ${expectedCityIds[index]}`)
    if (city.cityIndex !== index) errors.push(`survival city ${city.cityId} has index ${city.cityIndex}, expected ${index}`)
    if (city.exchanges.length !== 4) errors.push(`${city.cityId} needs four exchanges`)
    for (const exchange of city.exchanges) {
      if (!exchange.targetActivityId) errors.push(`${city.cityId} has an exchange without an authored target`)
      else if (ids.has(exchange.targetActivityId)) errors.push(`duplicate survival target ${exchange.targetActivityId}`)
      else ids.add(exchange.targetActivityId)
      if (exchange.phrases.length === 0) errors.push(`${exchange.targetActivityId} has no phrase overview`)
      if (rules.registers && !rules.registers.includes(exchange.register ?? '')) {
        errors.push(`${exchange.targetActivityId} must declare one of ${rules.registers.join('/')}, not ${exchange.register ?? 'nothing'}`)
      }
      if (exchange.dialogue.length !== 4) errors.push(`${exchange.targetActivityId} needs a four-turn dialogue`)
      for (const line of exchange.dialogue) {
        if (!line.da || !line.en) errors.push(`${exchange.targetActivityId} has an untranslated dialogue line`)
      }
    }
  }
  return errors
}
