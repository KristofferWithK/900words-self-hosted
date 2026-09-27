import type { WordEntry } from '../data/types'
import { CITY1_CATALOG } from './city1'

/** The caller supplies the lookup's purpose and actual round city, never word rank. */
export type ExampleContext = { kind: 'instructional' } | { kind: 'board'; cityIndex: number }
export const INSTRUCTIONAL_CONTEXT: ExampleContext = { kind: 'instructional' }
export function examplePresentation(word: WordEntry, context: ExampleContext) {
  const board = context.kind === 'board' && context.cityIndex === 0
    ? CITY1_CATALOG.board.find(row => row.wordId === word.id) : undefined
  return { da: board?.text.da ?? word.exampleDa, en: board?.text.en ?? word.exampleEn, board }
}
