import { describe, expect, it } from 'vitest'
import ledger from '../data/function-words.da.json'
import { danish } from './da'
import {
  OPTIONAL_ITEM_SEMANTICS,
  type CurriculumManifest,
  type CurriculumProgress,
  type CurriculumProgressByLanguage,
  validateCurriculum,
} from './curriculum'

const ledgerTerms = new Set(Object.values(ledger).flat())
type Mutable<T> = T extends readonly (infer Item)[]
  ? Mutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T

const fresh = (): Mutable<CurriculumManifest> => structuredClone(danish.curriculum) as Mutable<CurriculumManifest>
const check = (manifest: CurriculumManifest) =>
  validateCurriculum(manifest, danish.route, { ledgerTerms })

describe('the language-owned curriculum contract', () => {
  it('maps every route city to one chapter, scene, exit and 5+4 queue', () => {
    const report = check(danish.curriculum)
    expect(report.errors).toEqual([])
    expect(report.cityCount).toBe(9)
    expect(report.queueCount).toBe(81)
    expect(report.byLevel).toEqual({ a1: 15, a2: 6 })
    expect(report.ledgerTermsReferenced).toBeGreaterThan(0)
  })

  it('keeps optional learning state separate from journey progress', () => {
    expect(new Set(Object.keys(OPTIONAL_ITEM_SEMANTICS))).toEqual(
      new Set(['locked', 'offered', 'available', 'deferred', 'completed', 'skipped']),
    )
    for (const semantics of Object.values(OPTIONAL_ITEM_SEMANTICS)) {
      expect(semantics.blocksJourney).toBe(false)
    }
    const persisted: CurriculumProgress<'da' | 'de'> = {
      routeLanguage: 'da',
      itemStates: { 'sonderborg-notice': 'deferred' },
      evidence: {},
    }
    expect(persisted.routeLanguage).toBe('da')
    const namespaced: CurriculumProgressByLanguage<'da' | 'de'> = { da: persisted }
    expect(namespaced.de).toBeUndefined()
  })

  it('fails if one of the nine route cities is missing', () => {
    const manifest = fresh()
    manifest.cities = manifest.cities.slice(0, -1)
    expect(check(manifest).errors).toContain('manifest has 8 cities but route has 9')
  })

  it('fails if an A1 support item arrives after Skagen', () => {
    const manifest = fresh()
    const item = manifest.supportItems.find((candidate) => candidate.id === 'a1-directions')!
    item.firstCity = 6
    expect(check(manifest).errors).toContain(
      'A1 support "a1-directions" first appears in city 7, after Skagen\'s A1 check',
    )
  })

  it('fails if ids cease to be globally unique', () => {
    const manifest = fresh()
    manifest.supportItems[1]!.id = manifest.supportItems[0]!.id
    expect(check(manifest).errors).toContain('duplicate id "a1-greeting-repair" (support inventory)')
  })

  it('fails if a city task relies on support introduced later', () => {
    const manifest = fresh()
    manifest.cities[4]!.scene.supportItemIds = ['a2-past-events']
    expect(check(manifest).errors).toContain(
      'city 5 needs support "a2-past-events" before its firstCity 7; task is unreachable',
    )
  })
})
