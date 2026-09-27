import { describe, expect, it } from 'vitest'
import ledger from '../data/function-words.da.json'
import type { CurriculumContentPack } from './curriculum-content'
import { validateCurriculumContent } from './curriculum-content'
import { danishCurriculum } from './da/curriculum'
import { danishCurriculumContent } from './da/curriculum-content'

type Mutable<T> = T extends readonly [infer First, infer Second]
  ? [Mutable<First>, Mutable<Second>]
  : T extends readonly (infer Item)[]
    ? Mutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T

const ledgerTerms = new Set(Object.values(ledger).flat())
const fresh = (): Mutable<CurriculumContentPack> =>
  structuredClone(danishCurriculumContent) as unknown as Mutable<CurriculumContentPack>
const check = (content: CurriculumContentPack) =>
  validateCurriculumContent(content, danishCurriculum, { ledgerTerms })

describe('the accepted Danish curriculum payload', () => {
  it('fills every T4 route slot and carries a completed acceptance gate', () => {
    const report = check(danishCurriculumContent)
    expect(report.errors).toEqual([])
    expect(report.status).toBe('accepted')
    expect(report).toMatchObject({
      ledgerClassified: 252,
      supplementalSupport: 44,
      capsules: 45,
      exchanges: 36,
      dueReviews: 9,
      exits: 9,
      exitSteps: 27,
      scoredActivities: 137,
      readinessTasks: 10,
      readinessVariants: 20,
      audioLines: 144,
    })
    expect(danishCurriculumContent.reviewGates).toEqual([
      expect.objectContaining({ id: 'sol-danish-review', status: 'complete' }),
    ])
  })

  it('keeps early chunks separate from later productive systems', () => {
    const byTerm = new Map(danishCurriculumContent.ledgerForms.map((item) => [item.term, item]))
    expect(byTerm.get('kan')?.stages.map(({ city, use }) => [city, use])).toEqual([
      [0, 'preview-as-chunk'], [7, 'productive-target'],
    ])
    expect(byTerm.get('fordi')?.stages.map(({ city, use }) => [city, use])).toEqual([
      [5, 'controlled-target'], [8, 'productive-target'],
    ])
    expect(byTerm.get('at')?.stages.map(({ city, use }) => [city, use])).toEqual([
      [8, 'productive-target'],
    ])
    expect(byTerm.get('selvom')?.target).toBe('a2-receptive')
    expect(byTerm.get('sin')?.target).toBe('a2-receptive')
    expect(byTerm.get('ad')?.coverageFloor).toEqual({
      meaningfulInputs: 0, lexicalFamilies: 0, distinctTemplates: 0, promptedRetrievals: 0, scenarioUses: 0, comprehensionSamples: 0,
    })
  })

  it('keeps the six spoken-coverage additions as staged sentence support, outside the frozen ledger and cards', () => {
    expect(danishCurriculumContent.ledgerForms).toHaveLength(252)
    const support = new Map(danishCurriculumContent.supplementalSupport.map((item) => [item.id, item]))

    expect(support.get('da-word-uh')?.forms).toEqual(['øh'])
    expect(support.get('da-word-jamen')?.forms).toEqual(['jamen'])
    expect(support.get('da-word-ej')?.forms).toEqual(['ej'])
    expect(support.get('da-word-ligesom')?.stages.map(({ city, use }) => [city, use])).toEqual([
      [5, 'preview-as-chunk'], [6, 'receptive-ambient'],
    ])
    expect(support.get('da-word-thing')?.forms).toEqual(['ting', 'tingen'])
    expect(support.get('da-chunk-i-hvert-fald')?.forms).toEqual(['i hvert fald'])
    expect(support.get('da-chunk-i-hvert-fald')?.stages.map(({ city, use }) => [city, use])).toEqual([
      [3, 'preview-as-chunk'], [7, 'controlled-target'],
    ])
  })

  it('fails when one ledger form loses its deliberate classification', () => {
    const content = fresh()
    const removed = content.ledgerForms.pop()!
    expect(check(content).errors).toContain(`ledger form "${removed.term}" is unclassified`)
  })

  it('fails a blind route when the English-facing prompt reveals its Danish answer', () => {
    const content = fresh()
    const activity = content.cities[0]!.capsules[0]!
    activity.promptEn = `Choose ${activity.answer.modelDa}`
    expect(check(content).errors).toContain(
      `${activity.id} leaks accepted answer "${activity.answer.modelDa}" before the response`,
    )
  })

  it('pins the owner-amended A1 recent-past spiral and leaves systematic expansion in Odense', () => {
    const recentPast = danishCurriculum.supportItems.find((item) => item.id === 'a1-recent-past')
    expect(recentPast).toMatchObject({ level: 'a1', role: 'productive', firstCity: 3 })

    const [aarhus, aalborg, , odense] = danishCurriculumContent.cities.slice(3, 7)
    expect(aarhus!.capsules.slice(0, 3).map((item) => item.id)).toEqual([
      'aarhus-notice', 'aarhus-discriminate', 'aarhus-manipulate',
    ])
    expect(aarhus!.capsules.find((item) => item.id === 'aarhus-listen')?.audio.map((line) => line.textDa)).toEqual([
      'I dag arbejdede jeg fra otte til ti.',
      'I dag har jeg arbejdet hjemme, så nu er jeg træt.',
      'I dag købte jeg brød klokken otte.',
      'I dag har jeg købt brød, så vi har mad.',
    ])
    expect(aarhus!.capsules.find((item) => item.id === 'aarhus-transfer')?.answer.modelDa).toBe(
      'I går arbejdede jeg hjemme og lavede mad. I dag har jeg læst en bog.',
    )
    expect(aarhus!.exitTask.steps.find((item) => item.id === 'aarhus-exit-write')?.rubricId).toBe(
      'a1-recent-past-writing',
    )
    expect(aalborg!.exchanges.find((item) => item.id === 'aalborg-situation-4')?.supportItemIds).toContain(
      'a1-recent-past',
    )

    const personalWriting = danishCurriculumContent.readinessForms[0]!.tasks.find((task) => task.id === 'skagen-a1-writing')!
    expect(personalWriting.variants.every((variant) => variant.supportItemIds.includes('a1-personal-information'))).toBe(true)
    const recentPastWriting = danishCurriculumContent.readinessForms[0]!.tasks.find(
      (task) => task.id === 'skagen-a1-recent-past-writing',
    )!
    expect(recentPastWriting.variants.map((variant) => variant.answer.modelDa)).toEqual([
      'I går arbejdede jeg hjemme og købte brød. I dag har jeg læst en bog.',
      'I går lavede jeg mad og læste en bog. I dag har jeg købt kaffe.',
    ])
    expect(recentPastWriting.variants.every((variant) => variant.rubricId === 'a1-recent-past-writing')).toBe(true)
    expect(odense!.capsules[0]!.supportItemIds).toContain('a2-past-events')
    expect(danishCurriculumContent.grammarRewriteBrief.chapters.find((chapter) => chapter.cityId === 'odense')?.formalFocusEn).toContain(
      'Systematic expansion',
    )
  })

  it('fails when a non-listening activity plays its accepted answer before scoring', () => {
    const content = fresh()
    const activity = content.cities[0]!.capsules[1]!
    activity.audio[0]!.textDa = activity.answer.modelDa
    expect(check(content).errors).toContain(
      `${activity.id} plays accepted answer "${activity.answer.modelDa}" before the response`,
    )
  })

  it('fails if a deferred item relies on the just-finished round', () => {
    const content = fresh()
    const activity = content.cities[4]!.exchanges[0]!
    activity.travelGuideContextEn = 'Use the words you have just packed.'
    expect(check(content).errors).toContain(
      `${activity.id} depends on immediate-play context and will not defer cleanly`,
    )
  })

  it('fails if a city loses its T4 queue order or a Danish audio script', () => {
    const content = fresh()
    content.cities[2]!.capsules.reverse()
    content.cities[2]!.exchanges[0]!.audio = []
    const errors = check(content).errors
    expect(errors).toContain('kolding capsules do not match the T4 grammar queue')
    expect(errors).toContain('kolding-situation-1 has no Danish audio script')
  })

  it('fails if parallel readiness forms stop measuring the same mode', () => {
    const content = fresh()
    const task = content.readinessForms[0]!.tasks[0]!
    task.variants[1]!.mode = 'reading'
    expect(check(content).errors).toContain(
      `${task.id} variants do not preserve mode, role, rubric and response shape`,
    )
  })

  it('fails if either Skagen form loses equivalent recent-past evidence', () => {
    const content = fresh()
    const task = content.readinessForms[0]!.tasks.find((item) => item.id === 'skagen-a1-recent-past-writing')!
    task.variants[1]!.supportItemIds = ['a1-time-routine']
    const errors = check(content).errors
    expect(errors).toContain('skagen-a1-recent-past-writing-b does not assess the owner-required A1 recent-past outcome')
  })

  it('fails if the A1 recent-past evidence floor is weakened', () => {
    const content = fresh()
    const support = content.supplementalSupport.find((item) => item.id === 'da-chunk-a1-recent-past')!
    support.coverageFloor.comprehensionSamples = 1
    expect(check(content).errors).toContain('A1 recent-past support does not meet the owner evidence floor')
  })

  it('fails if delayed recent-past retrieval disappears from Aalborg', () => {
    const content = fresh()
    const aalborgRetrieval = content.cities[4]!.exchanges.find((item) => item.id === 'aalborg-situation-4')!
    aalborgRetrieval.supportItemIds = ['a1-directions']
    expect(check(content).errors).toContain('A1 recent-past support does not meet the owner evidence floor')
  })

  it('fails if Aarhus loses the warning against a mechanical yesterday/today tense rule', () => {
    const content = fresh()
    const chapter = content.grammarRewriteBrief.chapters.find((item) => item.cityId === 'aarhus')!
    chapter.doNotClaimEn = []
    expect(check(content).errors).toContain(
      'aarhus rewrite brief lacks the owner-required yesterday/today anti-rule',
    )
  })

  it('fails if readiness can rest on one context or first-attempt evidence can be overwritten', () => {
    const content = fresh()
    content.readinessForms[0]!.evidenceRule.minimumContextsPerMode = 1
    ;(content.cities[0]!.capsules[0]!.evidencePolicy as { firstAttemptImmutable: boolean }).firstAttemptImmutable = false
    const errors = check(content).errors
    expect(errors).toContain('skagen-a1-readiness can make a readiness claim from one checkpoint context')
    expect(errors).toContain('sonderborg-notice can overwrite first-attempt evidence')
  })

  it('rejects a false acceptance whose review gate is still pending', () => {
    const content = fresh()
    content.status = 'accepted'
    content.reviewGates[0]!.status = 'pending'
    const errors = check(content).errors
    expect(errors).toContain('sol-danish-review is incomplete; accepted content requires a completed review gate')
  })
})
