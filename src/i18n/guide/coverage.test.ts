import { describe, expect, it } from 'vitest'
import { danishCurriculumContent } from '../../lang/da/curriculum-content'
import type { ScoredCurriculumActivity } from '../../lang/curriculum-content'
import { guide as deGuide } from './de'
import { guide as svGuide } from './sv'
import { guide as plGuide } from './pl'
import { guide as ptGuide } from './pt'
import { guide as frGuide } from './fr'
import { guide as zhGuide } from './zh'
import { COMPLETE, guideCopy } from './index'
import { learningCopyFor } from '../learning'
import type { LearningField } from '../learning'
import { UI_LANGUAGES } from '../types'
import { danishSurvivalGuide } from '../../lang/da/survival'
import { grammarBooksForActiveCityIndex } from '../../lang/bookshelf'
import { DANISH_BEGINNER_GRAMMAR_LESSONS } from '../../lang/da/beginner-grammar-lessons'

const EN_FIELDS = [
  'titleEn',
  'travelGuideContextEn',
  'promptEn',
  'visualSupportEn',
  'observationEn',
  'feedbackEn',
  'successCriterionEn',
  'novelDetailEn',
] as const

interface ExpectedEntry {
  key: string
  source: string
}

const cities = danishCurriculumContent.cities.slice(0, 3)

function fieldKey(id: string, field: string): string {
  return `${id}.${field}`
}

function collectActivities(): { id: string; activity: ScoredCurriculumActivity }[] {
  const out: { id: string; activity: ScoredCurriculumActivity }[] = []
  for (const city of cities) {
    for (const capsule of city.capsules) out.push({ id: capsule.id, activity: capsule })
    for (const exchange of city.exchanges) out.push({ id: exchange.id, activity: exchange })
    out.push({ id: city.dueReview.id, activity: city.dueReview })
    for (const step of city.exitTask.steps) out.push({ id: step.id, activity: step })
  }
  return out
}

function expectedEntries(): ExpectedEntry[] {
  const out: ExpectedEntry[] = []
  for (const { id, activity } of collectActivities()) {
    const record = activity as unknown as Record<string, unknown>
    for (const field of EN_FIELDS) {
      const value = record[field]
      if (typeof value === 'string' && value.length > 0) {
        out.push({ key: fieldKey(id, field), source: value })
      }
    }
  }
  for (const city of cities) {
    const exit = city.exitTask
    if (exit.titleEn) out.push({ key: fieldKey(exit.id, 'titleEn'), source: exit.titleEn })
    if (exit.travelGuideContextEn) out.push({ key: fieldKey(exit.id, 'travelGuideContextEn'), source: exit.travelGuideContextEn })
    if (exit.novelDetailEn) out.push({ key: fieldKey(exit.id, 'novelDetailEn'), source: exit.novelDetailEn })
  }
  // The session-path keys the Phase 2 wire added: the survival exchange
  // titles the round summary names (keyed with the `survival.` prefix the
  // runtime consumers use) and City 1's grammar chapter title.
  for (const city of danishSurvivalGuide.cities.slice(0, 1)) {
    for (const exchange of city.exchanges) {
      out.push({ key: `survival.${exchange.targetActivityId}.titleEn`, source: exchange.titleEn })
    }
  }
  for (const lesson of grammarBooksForActiveCityIndex(0)) {
    out.push({ key: `${lesson.id}.titleEn`, source: lesson.titleEn })
  }
  return out
}

describe('guide sidecar coverage (cities 1–3)', () => {
  it('flags English as complete and the translations as pending', () => {
    expect(COMPLETE.en).toBe(true)
    expect(COMPLETE.de).toBe(false)
    expect(COMPLETE.sv).toBe(false)
    expect(COMPLETE.pl).toBe(false)
    expect(COMPLETE.pt).toBe(false)
    expect(COMPLETE.fr).toBe(false)
    expect(COMPLETE.zh).toBe(false)
  })

  for (const [label, sidecar] of [
    ['German', deGuide],
    ['Swedish', svGuide],
    ['Polish', plGuide],
    ['Portuguese', ptGuide],
    ['French', frGuide],
    ['Chinese', zhGuide],
  ] as const) {
    it(`defines a non-empty, non-English entry for every source field (${label})`, () => {
      const missing: string[] = []
      const empty: string[] = []
      const untranslated: string[] = []
      for (const { key, source } of expectedEntries()) {
        const value = sidecar[key]
        if (value === undefined) {
          missing.push(key)
          continue
        }
        if (value.trim() === '') empty.push(key)
        else if (value === source) untranslated.push(`${key}: ${JSON.stringify(source)}`)
      }
      expect(missing, 'these sidecar keys are missing').toEqual([])
      expect(empty, 'these sidecar entries are empty').toEqual([])
      expect(untranslated, 'these sidecar entries are still the English').toEqual([])
    })

    it(`defines no keys for fields the source does not have (${label})`, () => {
      const expected = new Set(expectedEntries().map((entry) => entry.key))
      const stray = Object.keys(sidecar).filter((key) => !expected.has(key))
      expect(stray).toEqual([])
    })
  }

  it('falls back to the source when a key is absent', () => {
    expect(guideCopy('does-not-exist', 'titleEn', 'Source title')).toBe('Source title')
  })
})

/**
 * The runtime overlay test (Phase 2 wire): every launch language resolves
 * every guide key the City 1 session path renders — through the same
 * `learningCopy` resolution, per language — to a non-empty value that is not
 * the English source. A value equal to the source is a silent fallback and
 * fails the language; English itself is the source and is exempt from the
 * non-English assertion.
 *
 * City 1 is the launch scope (LAUNCH.md): the Travel Guide's first chapter,
 * the practice capsules, the situations and the survival exchanges, the
 * post-wrap choices on the round summary, and the grammar book the
 * session-path consumers open.
 */
describe('learning overlay coverage (City 1 session path, every launch language)', () => {
  const LAUNCH_LANGUAGES: readonly string[] = UI_LANGUAGES

  interface SessionKey {
    readonly key: string
    readonly field: LearningField
    readonly source: string
  }

  /**
   * Every City 1 activity field the Guide screens render. `collectActivities`
   * walks cities 1–3; the session path renders City 1 only, so keep the
   * activities whose id belongs to the first city's capsules, exchanges, due
   * review and exit steps.
   */
  function activityKeys(): SessionKey[] {
    const out: SessionKey[] = []
    const city = danishCurriculumContent.cities[0]!
    const cityIds = new Set<string>([
      ...city.capsules.map((c) => c.id),
      ...city.exchanges.map((e) => e.id),
      city.dueReview.id,
      ...city.exitTask.steps.map((s) => s.id),
    ])
    for (const { id, activity } of collectActivities()) {
      if (!cityIds.has(id)) continue
      const record = activity as unknown as Record<string, unknown>
      for (const field of EN_FIELDS) {
        const value = record[field]
        if (typeof value === 'string' && value.length > 0) {
          out.push({ key: id, field: field as LearningField, source: value })
        }
      }
    }
    if (city.exitTask.titleEn) out.push({ key: city.exitTask.id, field: 'titleEn', source: city.exitTask.titleEn })
    if (city.exitTask.travelGuideContextEn) out.push({ key: city.exitTask.id, field: 'travelGuideContextEn', source: city.exitTask.travelGuideContextEn })
    if (city.exitTask.novelDetailEn) out.push({ key: city.exitTask.id, field: 'novelDetailEn', source: city.exitTask.novelDetailEn })
    return out
  }

  /**
   * City 1's grammar lessons: the chapter title the Guide rows and reader
   * show (translated in the sidecars), and the examples-page title
   * (`examplesTitleEn`, a later batch). The lesson ids are the sidecar keys.
   */
  function grammarTitleKeys(): SessionKey[] {
    return grammarBooksForActiveCityIndex(0)
      .map((lesson) => ({ key: lesson.id, field: 'titleEn' as LearningField, source: lesson.titleEn }))
      .filter((entry) => entry.source.length > 0)
  }

  function grammarExampleKeys(): SessionKey[] {
    const out: SessionKey[] = []
    // The projection consumes `examplesTitleEn` while building the book
    // pages, so read it off the source lessons the shelf was built from.
    for (const lesson of Object.values(DANISH_BEGINNER_GRAMMAR_LESSONS)[0] ?? []) {
      if (lesson.examplesTitleEn) out.push({ key: lesson.id, field: 'examplesTitleEn', source: lesson.examplesTitleEn })
    }
    return out.filter((entry) => entry.source.length > 0)
  }

  /** The survival exchange titles and city theme the post-wrap choices name (RoundSummary). */
  function survivalKeys(): SessionKey[] {
    const out: SessionKey[] = []
    const city = danishSurvivalGuide.cities[0]!
    for (const exchange of city.exchanges) {
      out.push({ key: `survival.${exchange.targetActivityId}`, field: 'titleEn', source: exchange.titleEn })
    }
    return out
  }

  /** The survival city theme line the Guide book renders. */
  function survivalThemeKeys(): SessionKey[] {
    const city = danishSurvivalGuide.cities[0]!
    return [{ key: `survival-theme.${city.cityId}`, field: 'themeEn', source: city.themeEn }]
  }

  const TRANSLATED_KEYS: readonly SessionKey[] = [...activityKeys(), ...survivalKeys(), ...grammarTitleKeys()]
  /** Later Phase 2 batches (§8.3): compiled through the layer, English until their sidecar batch lands. */
  const PENDING_KEYS: readonly SessionKey[] = [...grammarExampleKeys(), ...survivalThemeKeys()]

  it('collects the keys the City 1 session path renders', () => {
    expect(TRANSLATED_KEYS.length).toBeGreaterThan(0)
    expect(PENDING_KEYS.length).toBeGreaterThan(0)
  })

  for (const lang of LAUNCH_LANGUAGES) {
    it(`resolves every City 1 session-path guide key (${lang})`, () => {
      const empty: string[] = []
      const silentFallbacks: string[] = []
      for (const { key, field, source } of TRANSLATED_KEYS) {
        const value = learningCopyFor(lang, key, field, source)
        if (value.trim() === '') empty.push(`${key}.${field}`)
        else if (lang !== 'en' && value === source) silentFallbacks.push(`${key}.${field}`)
      }
      expect(empty, 'these keys resolved empty').toEqual([])
      if (lang !== 'en') {
        expect(silentFallbacks, 'these keys silently fell back to English').toEqual([])
      }
      // All-or-nothing, pinned: the pending-batch keys resolve to the English
      // source in every language until their sidecar batch lands — a partial
      // entry that leaked through the fallback would break this.
      const leaked: string[] = []
      for (const { key, field, source } of PENDING_KEYS) {
        if (learningCopyFor(lang, key, field, source) !== source) leaked.push(`${key}.${field}`)
      }
      expect(leaked, 'these pending-batch keys leaked a partial entry').toEqual([])
    })
  }

  it('resolves English to the source by design: the source IS the English', () => {
    for (const { key, field, source } of [...TRANSLATED_KEYS, ...PENDING_KEYS]) {
      expect(learningCopyFor('en', key, field, source)).toBe(source)
    }
  })
})
