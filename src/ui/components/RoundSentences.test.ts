import { describe, expect, it } from 'vitest'
import { WORDS } from '../../data/words'
import reviewSource from '../../data/sentence-review.da.json'
import exampleIndex from '../../data/example-curriculum.da.json'
import type { ExampleCurriculumIndex } from '../../lang/example-curriculum'
import {
  chooseSentenceRows,
  estimateRowPx,
  MAX_SENTENCES,
  MIN_SENTENCES,
  pickSentenceWords,
  promptableFocusCandidates,
  ROWS_BUDGET_PX,
  rowsBudgetFor,
  TIGHT_PHONE_HEIGHT,
  unionFlowWords,
} from './RoundSentences'

/**
 * The ordering IS the feature. A summary that showed five greens the player has
 * known for a month would look identical to a working one, so the preference —
 * met for the first time, then collected this round, then the rest — is the
 * thing worth pinning.
 */
describe('pickSentenceWords', () => {
  const board = ['a', 'b', 'c', 'd', 'e', 'f', 'g']

  it('prefers a word met for the first time this round', () => {
    expect(pickSentenceWords(board, ['e'], [], 1)).toEqual(['e'])
  })

  it('then a word collected this round', () => {
    expect(pickSentenceWords(board, [], ['f'], 1)).toEqual(['f'])
  })

  it('puts discovered ahead of collected, and both ahead of the already-known', () => {
    expect(pickSentenceWords(board, ['g'], ['c'], 3)).toEqual(['g', 'c', 'a'])
  })

  it('counts a word that is both as discovered, not twice', () => {
    const got = pickSentenceWords(board, ['d'], ['d'], 3)
    expect(got[0]).toBe('d')
    expect(got.filter((id) => id === 'd')).toHaveLength(1)
  })

  it('keeps board order inside a rank', () => {
    expect(pickSentenceWords(board, ['f', 'b'], [], 2)).toEqual(['b', 'f'])
  })

  it('never shows more than the cap', () => {
    expect(pickSentenceWords(board, board, [], 3)).toHaveLength(3)
  })

  // An overview a player can take in at a glance, all rows visible at once,
  // nothing to page through; the cap is what a tall phone can fill.
  it('caps the overview at six', () => {
    expect(MAX_SENTENCES).toBe(6)
    expect(pickSentenceWords(board, [], [])).toHaveLength(6)
  })

  it('shows what there is when the round greened fewer than the cap', () => {
    expect(pickSentenceWords(['a', 'b'], [], [])).toEqual(['a', 'b'])
  })

  it('is empty for a round that greened nothing — sudden death on the first name', () => {
    expect(pickSentenceWords([], ['a'], ['b'])).toEqual([])
  })

  // Preferences over words that are not on the board must not invent rows.
  it('ignores discovered and collected ids that were not green', () => {
    expect(pickSentenceWords(['a'], ['zz'], ['yy'])).toEqual(['a'])
  })

  it('puts a due retrieval ahead of familiar cards without hiding a new or collected card', () => {
    expect(pickSentenceWords(board, ['f'], ['e'], new Set(['a', 'b']), 4)).toEqual(['f', 'e', 'a', 'b'])
  })
})

/**
 * The band has a measured budget on the tight phone and nothing on the
 * summary may scroll, so long sentences cost rows. The estimator is charged
 * with being pessimistic: it must drop a fourth row before a drive would see
 * a clipped one, and it must never leave the band with fewer than two rows
 * while there are rows to show.
 */
describe('chooseSentenceRows', () => {
  const short = { exampleDa: 'Hej, mor.', exampleEn: 'Hi, mum.' }
  const longest = WORDS.reduce((a, w) => (w.exampleDa.length > a.exampleDa.length ? w : a))

  it('shows four short rows in an ordinary win on the tight phone', () => {
    expect(chooseSentenceRows([short, short, short, short, short], ROWS_BUDGET_PX.normal)).toHaveLength(4)
  })

  it('fills a taller phone with more rows', () => {
    const many = Array.from({ length: 8 }, () => short)
    expect(chooseSentenceRows(many, rowsBudgetFor(ROWS_BUDGET_PX.normal, 844)).length).toBeGreaterThan(
      chooseSentenceRows(many, rowsBudgetFor(ROWS_BUDGET_PX.normal, TIGHT_PHONE_HEIGHT)).length,
    )
    expect(rowsBudgetFor(100, 600)).toBe(100)
  })

  it('shows fewer when the sentences are long, in priority order', () => {
    const rows = chooseSentenceRows([longest, longest, longest, longest], ROWS_BUDGET_PX.normal)
    expect(rows.length).toBeGreaterThanOrEqual(MIN_SENTENCES)
    expect(rows.length).toBeLessThan(4)
    expect(rows[0]).toBe(longest)
  })

  it('passes over a row that does not fit and fills the band with later ones', () => {
    const tall = { exampleDa: longest.exampleDa, exampleEn: longest.exampleEn, id: 'tall' }
    const small = (id: string) => ({ ...short, id })
    const rows = chooseSentenceRows([small('a'), tall, small('b'), small('c')], 250)
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  /** The tightest band the app ever asked for: a wrap-up's, before a wrap-up
   *  stopped showing sentences. Kept as a number rather than a shipped
   *  constant — what it pins is the estimator's floor, not a layout. */
  const TIGHTEST_BAND = 246

  it('always shows one row, and one longest row fits the smallest budget', () => {
    expect(MIN_SENTENCES).toBe(1)
    expect(chooseSentenceRows([longest], TIGHTEST_BAND - 18)).toHaveLength(1)
    expect(estimateRowPx(longest)).toBeLessThanOrEqual(TIGHTEST_BAND - 18)
  })

  it('gives a typical city sentence two rows on the tight phone and four on a tall one', () => {
    const typical = { exampleDa: 'Min far bruger goddag, når han møder en fremmed.', exampleEn: 'My father uses “hello” when he meets a stranger.' }
    const four = [typical, typical, typical, typical]
    expect(chooseSentenceRows(four, TIGHTEST_BAND).length).toBeGreaterThanOrEqual(2)
    expect(chooseSentenceRows(four, ROWS_BUDGET_PX.normal).length).toBeGreaterThanOrEqual(2)
    expect(chooseSentenceRows(four, rowsBudgetFor(ROWS_BUDGET_PX.normal, 844)).length).toBeGreaterThanOrEqual(4)
  })

  it('never shows more than the cap however short the rows and tall the phone', () => {
    expect(chooseSentenceRows(Array.from({ length: 10 }, () => short), rowsBudgetFor(ROWS_BUDGET_PX.normal, 1400))).toHaveLength(MAX_SENTENCES)
  })
})

describe('unionFlowWords', () => {
  it('names each small word once, in order of first appearance', () => {
    const hej = { term: 'hej', firstCity: 0, label: 'a' }
    const jeg = { term: 'jeg', firstCity: 0, label: 'b' }
    const min = { term: 'min', firstCity: 1, label: 'c' }
    expect(unionFlowWords([[hej, jeg], [jeg, min], [hej]]).map((f) => f.term)).toEqual(['hej', 'jeg', 'min'])
  })
})

/**
 * The section renders `exampleDa`/`exampleEn` straight off the dataset, so a
 * word without either would render an empty row. `validate:words` covers the
 * dataset's own rules; this covers the assumption this component makes of it.
 */
describe('the dataset the sentences are drawn from', () => {
  it('never treats an internal curriculum chunk identifier as a Danish focus word', () => {
    expect(promptableFocusCandidates('da:mor')).toEqual(['hej'])
    expect(promptableFocusCandidates('da:mor')).not.toContain('da-chunk-name')
  })

  it('gives every word both halves of an example', () => {
    const missing = WORDS.filter((w) => !w.exampleDa?.trim() || !w.exampleEn?.trim())
    expect(missing.map((w) => w.id)).toEqual([])
  })

  it('keeps the small review payload exactly aligned with its authored retrieval candidates', () => {
    const full = exampleIndex as ExampleCurriculumIndex
    const expected = full.examples
      .map((row) => ({
        wordId: row.wordId,
        focusIds: [...row.ledger, ...row.supplemental]
          .filter((item) => item.evidence.includes('prompted-retrieval-candidate'))
          .map((item) => item.id),
      }))
      .filter((row) => row.focusIds.length > 0)
    expect(reviewSource.entries).toEqual(expected)
  })
})
