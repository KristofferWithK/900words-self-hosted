import extensionScope from '../../../prototypes/finish-review/implementation/roster-extension/scope.json'
import predecessor from '../../../prototypes/finish-review/implementation/predecessor-examples.json'
import { describe, expect, it } from 'vitest'
import exampleIndexJson from '../../data/example-curriculum.da.json'
import wordsJson from '../../data/words.da.json'
import type { WordEntry } from '../../data/types'
import type { CurriculumContentPack, CurriculumUseStage, LedgerFormProfile } from '../curriculum-content'
import type { ExampleCurriculumIndex, ExampleTermEvidence } from '../example-curriculum'
import { danishCurriculumContent } from './curriculum-content'
import {
  buildDanishExampleIndex,
  sentenceInstantiatesLedgerTarget,
  sentenceInstantiatesSupplementalTarget,
  validateDanishExampleIndex,
} from './example-curriculum'

const words = wordsJson.map(word => {
  const extensionPrior = extensionScope.wordSources.find(p => p.wordId === word.id)
  const pair = extensionPrior
    ? { exampleDa: extensionPrior.exampleDa, exampleEn: extensionPrior.exampleEn }
    : {}
  return { ...word, ...pair, ...predecessor.find(p => p.id === word.id) }
}) as readonly WordEntry[]
const committedIndex = exampleIndexJson as ExampleCurriculumIndex

type MutableCoverageFloor = {
  meaningfulInputs: number
  distinctTemplates: number
  lexicalFamilies: number
  promptedRetrievals: number
  scenarioUses: number
  comprehensionSamples: number
}

type MutableLedgerForm = Omit<LedgerFormProfile, 'stages' | 'coverageFloor'> & {
  stages: CurriculumUseStage[]
  coverageFloor: MutableCoverageFloor
}

type MutableContent = Omit<CurriculumContentPack, 'ledgerForms'> & {
  ledgerForms: MutableLedgerForm[]
}

const mutableContent = (): MutableContent =>
  structuredClone(danishCurriculumContent) as unknown as MutableContent

const ledgerCoverage = (
  index: ExampleCurriculumIndex,
  sourceWords: readonly WordEntry[],
  content: CurriculumContentPack,
  term: string,
) => {
  const row = validateDanishExampleIndex(index, sourceWords, content).ledger.find((entry) => entry.id === term)
  if (!row) throw new Error(`missing coverage row ${term}`)
  return row
}

describe('Danish example target detectors', () => {
  it.each([
    ['at', 'Jeg ved, at hun kommer.', 'At løbe er sundt.'],
    ['for', 'Jeg betaler 20 kroner for bogen.', 'Bogen er for lang.'],
    ['der', 'Der er en stol ved døren.', 'Jeg stiller stolen der.'],
    ['som', 'En lærer, som hjælper, står her.', 'Hun arbejder som lærer.'],
    ['når', 'Når bussen kommer, går vi.', 'Vi når bussen klokken ti.'],
    ['da', 'Da bussen kom, gik vi.', 'Jeg taler da dansk.'],
  ])('requires the structure carried by %s, not just its surface token', (term, positive, surfaceOnly) => {
    expect(sentenceInstantiatesLedgerTarget(term, positive)).toBe(true)
    expect(sentenceInstantiatesLedgerTarget(term, surfaceOnly)).toBe(false)
  })

  it('requires a complete accepted chunk rather than its words in unrelated positions', () => {
    const repeat = { forms: ['Kan du sige det igen?'] }
    expect(sentenceInstantiatesSupplementalTarget(repeat, 'Kan du sige det igen?')).toBe(true)
    expect(sentenceInstantiatesSupplementalTarget(repeat, 'Du kan sige det, og jeg prøver igen.')).toBe(false)
  })
})

describe('Danish example validator mutation checks', () => {
  it('keeps all 900 card ids, ranks, cities and Danish examples frozen while support language changes', () => {
    const frozenProjection = words.map(({ id, curriculumRank, exampleDa }) => ({
      id,
      curriculumRank,
      city: Math.floor(((curriculumRank ?? 0) - 1) / 100),
      exampleDa,
    }))
    const source = JSON.stringify(frozenProjection)
    let digest = 0xcbf29ce484222325n
    for (let index = 0; index < source.length; index++) {
      digest ^= BigInt(source.charCodeAt(index))
      digest = BigInt.asUintN(64, digest * 0x100000001b3n)
    }

    expect(words).toHaveLength(900)
    expect(digest.toString(16).padStart(16, '0')).toBe('0307be17473046b6')
  })

  it('accepts the frozen 900-row source before testing mutations', () => {
    expect(validateDanishExampleIndex(committedIndex, words, danishCurriculumContent).errors).toEqual([])
  })

  it('fails when a required target is removed from the corpus', () => {
    const mutantWords = structuredClone(words) as WordEntry[]
    for (const word of mutantWords) word.exampleDa = word.exampleDa.replaceAll(/goddag/giu, 'hej')
    const mutantIndex = buildDanishExampleIndex(mutantWords, danishCurriculumContent)

    expect(validateDanishExampleIndex(mutantIndex, mutantWords, danishCurriculumContent).errors)
      .toContainEqual(expect.stringContaining('goddag misses its example floor'))
  })

  it('fails when an A1 target is moved beyond its checkpoint', () => {
    const content = mutableContent()
    const target = content.ledgerForms.find((profile) => profile.term === 'goddag')
    if (!target) throw new Error('missing goddag profile')
    const finalStage = target.stages.at(-1)
    if (!finalStage) throw new Error('goddag has no target stage')
    target.stages = [{ ...finalStage, city: 6 }]
    const mutantIndex = buildDanishExampleIndex(words, content)

    expect(validateDanishExampleIndex(mutantIndex, words, content).errors)
      .toContainEqual(expect.stringContaining('goddag misses its example floor'))
  })

  it('fails a wrong role even when the target token is still present', () => {
    const mutant = structuredClone(committedIndex) as unknown as {
      reviewGate: ExampleCurriculumIndex['reviewGate']
      examples: Array<{ wordId: string; ledger: ExampleTermEvidence[] }>
    }
    const row = mutant.examples.find((entry) => entry.ledger.length > 0)
    if (!row) throw new Error('fixture has no ledger evidence')
    row.ledger[0] = { ...row.ledger[0]!, role: row.ledger[0]!.role === 'productive' ? 'receptive' : 'productive' }

    expect(validateDanishExampleIndex(mutant as unknown as ExampleCurriculumIndex, words, danishCurriculumContent).errors)
      .toContain(`${row.wordId} sidecar tags differ from the target-specific detectors`)
  })

  it('does not count two copies of one template as two distinct templates', () => {
    const baseline = ledgerCoverage(committedIndex, words, danishCurriculumContent, 'goddag')
    const mutantWords = structuredClone(words) as WordEntry[]
    for (const id of ['da:ost', 'da:fisk']) {
      const word = mutantWords.find((entry) => entry.id === id)
      if (!word) throw new Error(`missing fixture word ${id}`)
      word.exampleDa = `Goddag, her er ${word.da}.`
    }
    const mutantIndex = buildDanishExampleIndex(mutantWords, danishCurriculumContent)
    const mutant = ledgerCoverage(mutantIndex, mutantWords, danishCurriculumContent, 'goddag')

    expect(mutant.meaningfulInputs).toBe(baseline.meaningfulInputs + 2)
    expect(mutant.distinctTemplates).toBeLessThanOrEqual(baseline.distinctTemplates + 1)

    const stricter = mutableContent()
    const target = stricter.ledgerForms.find((profile) => profile.term === 'goddag')
    if (!target) throw new Error('missing goddag profile')
    target.coverageFloor.distinctTemplates = mutant.distinctTemplates + 1
    const strictIndex = buildDanishExampleIndex(mutantWords, stricter)
    expect(validateDanishExampleIndex(strictIndex, mutantWords, stricter).errors)
      .toContainEqual(expect.stringContaining('goddag misses its example floor'))
  }, 10_000)

  it('fails a sidecar tag that has no detector evidence in its sentence', () => {
    const mutant = structuredClone(committedIndex) as unknown as {
      examples: Array<{ wordId: string; ledger: ExampleTermEvidence[] }>
    }
    const row = mutant.examples.find((entry) => entry.wordId === 'da:mor')
    if (!row) throw new Error('missing da:mor review row')
    row.ledger.push({
      id: 'nul',
      use: 'productive-target',
      role: 'productive',
      functionId: 'give-contact-details',
      templateId: 'noun-led-clause',
      evidence: ['meaningful-input'],
    })

    expect(validateDanishExampleIndex(mutant as unknown as ExampleCurriculumIndex, words, danishCurriculumContent).errors)
      .toContain('da:mor sidecar tags differ from the target-specific detectors')
  })
})


describe('instructional corpus provenance', () => {
  it('rejects a historical review record relabeled with a bounded row count', () => {
    const currentWords = wordsJson as readonly WordEntry[]
    const current = buildDanishExampleIndex(currentWords, danishCurriculumContent)
    expect(validateDanishExampleIndex({ ...current, reviewGate: { ...current.reviewGate, reviewedRows: 100 } } as unknown as ExampleCurriculumIndex, currentWords, danishCurriculumContent).errors)
      .toContain('Example review gate differs from exact corpus provenance')
  })
  it('retains original Sol evidence and all original coverage floors', () => {
    const currentWords = wordsJson as readonly WordEntry[]
    const current = buildDanishExampleIndex(currentWords, danishCurriculumContent)
    expect(current.reviewGate).toEqual(committedIndex.reviewGate)
    expect(validateDanishExampleIndex(current, currentWords, danishCurriculumContent).errors).toEqual([])
  })
})
