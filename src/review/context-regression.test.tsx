import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import words from '../data/words.da.json'
import inventory from '../../prototypes/finish-review/implementation/inventory.json'
import predecessor from '../../prototypes/finish-review/implementation/predecessor-examples.json'
import scope from '../../prototypes/finish-review/implementation/roster-extension/scope.json'
import { CITY1_CATALOG } from './city1'
import { useUi } from '../stores/uiStore'
import { DictionarySheet } from '../ui/components/DictionarySheet'
import { buildDanishExampleIndex, validateDanishExampleIndex } from '../lang/da/example-curriculum'
import { danishCurriculumContent } from '../lang/da/curriculum-content'
import type { WordEntry } from '../data/types'
vi.mock('../stores/uiStore', async importOriginal => {
  const actual = await importOriginal<typeof import('../stores/uiStore')>()
  return { ...actual, useUi: Object.assign(() => actual.useUi.getState(), { getState: actual.useUi.getState, subscribe: actual.useUi.subscribe }) }
})
const historical = words.map(w => ({ ...w, ...(() => { const p = scope.wordSources.find(p => p.wordId === w.id); return p ? { exampleDa: p.exampleDa, exampleEn: p.exampleEn } : {} })(), ...predecessor.find(p => p.id === w.id) }))
it('preserves the complete original instructional word file', async () => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(words, null, 2) + '\n'))
  expect(Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')).toBe(inventory.sources['src/data/words.da.json'])
})
for (const id of ['da:film', predecessor[0]!.id]) it(`${id} has contextual board presentation and original instruction`, () => {
  const row = CITY1_CATALOG.board.find(r => r.wordId === id)!
  const prior = historical.find(w => w.id === id)!
  useUi.getState().openSheet(id, { kind: 'board', cityIndex: 0 })
  const board = renderToStaticMarkup(<DictionarySheet />)
  expect(board.replace(/<[^>]*>/g, '')).toContain(row.text.en)
  expect(board).toContain(row.wordSpan.text)
  useUi.getState().openSheet(id, { kind: 'instructional' })
  const instruction = renderToStaticMarkup(<DictionarySheet />)
  expect(instruction.replace(/<[^>]*>/g, '')).toContain(prior.exampleEn)
  expect(instruction).not.toContain(row.text.en)
  useUi.getState().openSheet(id, { kind: 'board', cityIndex: 4 })
  expect(renderToStaticMarkup(<DictionarySheet />)).toBe(instruction)
  useUi.getState().openSheet(id) // Home/suitcase/default lookup must not inherit the board context.
  expect(renderToStaticMarkup(<DictionarySheet />)).toBe(instruction)
})
for (const change of [{ exampleEn: 'MUTATED ENGLISH' }, { curriculumRank: 9999 }]) it(`fails closed on historical mutation ${JSON.stringify(change)}`, () => {
  const mutated = structuredClone(historical) as WordEntry[]
  Object.assign(mutated[0]!, change)
  const index = buildDanishExampleIndex(mutated, danishCurriculumContent)
  expect(index.reviewGate.status).not.toBe('complete')
  expect(validateDanishExampleIndex(index, mutated, danishCurriculumContent).errors.some(e => /provenance|review|historical/i.test(e))).toBe(true)
})
