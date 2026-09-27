import type { SupportItem } from '../../lang/curriculum'
import type { WordEntry } from '../../data/types'
import {
  sentenceInstantiatesLedgerTarget,
  tokenContainsHeadwordStem,
  tokenIsHeadwordForm,
} from '../../lang/da/example-curriculum'

/**
 * The small words a sentence carries, read at the level of a city.
 *
 * Nothing in the nine hundred is a preposition, a conjunction or a pronoun —
 * none of them can be clued — so «fordi», «det» and the rest arrive as
 * scenery in a green word's example sentence or not at all. T3 authored every
 * example with exactly that in mind: each carries the support terms its city
 * teaches, and the course introduces those terms city by city
 * (`supportItems[].firstCity`). This module is what lets the round summary
 * SHOW that scenery instead of leaving it as plain text: the terms the course
 * has introduced by the player's city, found in the sentence by the same rule
 * T3's validator used (`sentenceInstantiatesLedgerTarget`, which knows that
 * «da» before a clause is the conjunction and «som» after a comma the
 * relative), in the order they occur.
 *
 * "By the player's city" is the owner's rule (2026-09-05): the words to mark
 * are the typical ones "depending on what beginner level the city is". In
 * Sønderborg that is the greetings and «en»/«et»; by Copenhagen it is
 * «fordi», «hvis», «selvom». A term first taught in a LATER city stays plain,
 * so a Sønderborg player is not asked to notice a subordinating conjunction
 * three legs early.
 */
export interface FlowWord {
  readonly term: string
  /** Zero-based city where the course first teaches the term. */
  readonly firstCity: number
  /** The support item's English label — the nearest thing the ledger has to a gloss. */
  readonly label: string
}

const TOKEN = /[\p{L}\p{N}]+/gu

interface Token {
  readonly text: string
  readonly lower: string
  readonly start: number
  readonly end: number
}

function tokenize(sentence: string): Token[] {
  const out: Token[] = []
  for (const m of sentence.matchAll(TOKEN)) {
    out.push({ text: m[0], lower: m[0].toLocaleLowerCase('da-DK'), start: m.index, end: m.index + m[0].length })
  }
  return out
}

/** Every ledger term the course has introduced by `cityIndex`, keyed by term, earliest city wins. */
export function supportTermsByCity(items: readonly SupportItem[], cityIndex: number): Map<string, FlowWord> {
  const out = new Map<string, FlowWord>()
  for (const item of items) {
    if (item.firstCity > cityIndex) continue
    for (const term of item.ledgerTerms) {
      const known = out.get(term)
      if (!known || item.firstCity < known.firstCity) out.set(term, { term, firstCity: item.firstCity, label: item.label })
    }
  }
  return out
}

/** The flow words in one sentence at one city's level, in sentence order, each once. */
export function flowWordsAtCity(sentence: string, cityIndex: number, items: readonly SupportItem[]): FlowWord[] {
  const known = supportTermsByCity(items, cityIndex)
  const seen = new Set<string>()
  const out: FlowWord[] = []
  for (const token of tokenize(sentence)) {
    const word = known.get(token.lower)
    if (!word || seen.has(token.lower)) continue
    if (!sentenceInstantiatesLedgerTarget(token.lower, sentence)) continue
    seen.add(token.lower)
    out.push(word)
  }
  return out
}

export type SegmentKind = 'plain' | 'green' | 'flow'

export interface Segment {
  readonly text: string
  readonly kind: SegmentKind
}

/**
 * The sentence cut into runs: the green word the round found, the flow words
 * the city teaches, and everything else.
 *
 * The headword is matched strictly first (citation form, irregular form,
 * stem, regular verb inflection) and only if nothing matched that way is the
 * validator's substring rule tried — see `tokenIsHeadwordForm`.
 */
export function markSentence(
  sentence: string,
  word: Pick<WordEntry, 'da' | 'pos'>,
  flowTerms: readonly string[],
): Segment[] {
  const tokens = tokenize(sentence)
  const flow = new Set(flowTerms.map((t) => t.toLocaleLowerCase('da-DK')))
  let greenIndices = tokens.flatMap((t, i) => (tokenIsHeadwordForm(word, t.lower) ? [i] : []))
  if (greenIndices.length === 0) {
    greenIndices = tokens.flatMap((t, i) => (tokenContainsHeadwordStem(word, t.lower) ? [i] : []))
  }
  const green = new Set(greenIndices)
  const out: Segment[] = []
  const push = (text: string, kind: SegmentKind) => {
    if (!text) return
    const last = out[out.length - 1]
    if (last && last.kind === kind && kind === 'plain') out[out.length - 1] = { text: last.text + text, kind }
    else out.push({ text, kind })
  }
  let cursor = 0
  tokens.forEach((t, i) => {
    push(sentence.slice(cursor, t.start), 'plain')
    if (green.has(i)) push(t.text, 'green')
    else if (flow.has(t.lower)) push(t.text, 'flow')
    else push(t.text, 'plain')
    cursor = t.end
  })
  push(sentence.slice(cursor), 'plain')
  return out
}
