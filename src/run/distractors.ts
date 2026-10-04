import type { RunWord } from './words'

/**
 * WRONG ANSWERS (contract §2): from the same kind of word, and never sharing a
 * meaning with the word asked. The prototype's rule, kept exactly: two words
 * whose meaning keys overlap would both be right, so they are never offered
 * against each other. Two more guards the prototype got for free from its
 * data: never the same word under another id, and never the same spelling.
 */

export function sharesMeaning(a: RunWord, b: RunWord): boolean {
  if (a.keys.length === 0 || b.keys.length === 0) return false
  const set = new Set(a.keys)
  return b.keys.some((k) => set.has(k))
}

const spelling = (w: RunWord) => w.target.trim().toLocaleLowerCase()

/** Whether `other` may stand beside `asked` as a wrong answer. */
export function canOfferAgainst(asked: RunWord, other: RunWord): boolean {
  if (other.id === asked.id) return false
  if (other.group !== asked.group) return false
  if (spelling(other) === spelling(asked)) return false
  // A word with no meaning recorded cannot be shown to be safe: never offer it.
  if (asked.keys.length === 0 || other.keys.length === 0) return false
  return !sharesMeaning(asked, other)
}

/** Every word of the pool that may be a wrong answer for `asked`. */
export function wrongAnswersFor(asked: RunWord, pool: readonly RunWord[]): RunWord[] {
  return pool.filter((w) => canOfferAgainst(asked, w))
}

/**
 * The words a walk can ask: those with at least `wrongCount` possible wrong
 * answers of different spellings. A word without them is left out of the walk
 * rather than given a wrong answer of another kind.
 */
export function askableWords(pool: readonly RunWord[], wrongCount = 2): RunWord[] {
  return pool.filter((w) => new Set(wrongAnswersFor(w, pool).map(spelling)).size >= wrongCount)
}

/**
 * Pick `count` wrong answers for `asked`: same kind, no shared meaning, all of
 * different spellings. Returns fewer only when the pool has fewer (callers ask
 * only words from `askableWords`).
 */
export function pickWrongAnswers(
  asked: RunWord,
  pool: readonly RunWord[],
  rng: () => number,
  count = 2,
): RunWord[] {
  const candidates = wrongAnswersFor(asked, pool)
  // Fisher-Yates on a copy, then take the first `count` distinct spellings.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }
  const out: RunWord[] = []
  const spellings = new Set<string>()
  for (const c of candidates) {
    if (out.length >= count) break
    if (spellings.has(spelling(c))) continue
    spellings.add(spelling(c))
    out.push(c)
  }
  return out
}
