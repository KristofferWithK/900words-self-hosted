import type { ConceptId } from '../ai/local/concepts'
import { isConceptId } from '../ai/local/concepts'
import type { LanguagePack } from '../lang/types'
import type { WordEntry } from './types'

/**
 * The indexes over one language's word list, built from a pack.
 *
 * Split out from `words.ts` so the seam can be tested against a fake language
 * — `words.ts` is the same thing bound to whichever pack is active, and is what
 * the app imports.
 */

/** The language a clue was written in, as far as the dataset can tell. */
/**
 * 'english' means "the player's language" (docs/ui-language-plan.md §9.3 step
 * 4): once the Phase 3 gloss overlay turns on, the gloss side of a WordEntry
 * is whatever the player speaks, and `classifyClue` returns this when a clue
 * matches one of those glosses. The value name is historical; nothing
 * persists it, so a rename to 'native' was considered — see CALLERS.md.
 */
export type ClueLanguage = 'target' | 'english' | 'unknown'

export interface Dataset {
  words: readonly WordEntry[]
  wordById(id: string): WordEntry | undefined
  conceptsOf(id: string): readonly ConceptId[]
  isKnownGloss(normalized: string): boolean
  normalizeGloss(s: string): string
  /** One of the shipped nine hundred, as a headword in the target language. */
  isHeadword(normalized: string): boolean
  classifyClue(raw: string): ClueLanguage
}

/**
 * The normalization the gloss index is built with, so callers can match it.
 *
 * The leading-word strip follows the player's language: `glossArticles` comes
 * from `UI_LANGUAGE_INFO[UI_LANGUAGE].glossArticles` (§9.3 step 3), so German
 * "der Apfel" and "Apfel" are one answer. Null strips nothing (Chinese,
 * Polish). Applied consistently everywhere: it builds the gloss index, the
 * dataset's exported `normalizeGloss`, and `classifyClue`'s lookup.
 */
export const normalizeGloss = (s: string, glossArticles: RegExp | null = null): string => {
  const base = s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
  return glossArticles ? base.replace(glossArticles, '') : base.replace(/^(to|a|an|the) /, '')
}

export function createDataset(pack: LanguagePack, glossArticles: RegExp | null = null): Dataset {
  const words = pack.words
  const byId = new Map(words.map((w) => [w.id, w]))

  const concepts: ReadonlyMap<string, ConceptId[]> = new Map(
    words.map((w) => [w.id, (w.concepts ?? []).filter(isConceptId)]),
  )

  /**
   * Every gloss in the dataset, normalized with the player's article rule —
   * the same rule `classifyClue` looks a clue up with (§9.3 step 3). Grading
   * consults this so a fuzzy match can never accept one real word in place of
   * another: "year" is a word, so it is never marked correct for "hear".
   */
  const glosses: ReadonlySet<string> = new Set(
    words.flatMap((w) => w.en.map((g) => normalizeGloss(g, glossArticles))),
  )

  const headwords: ReadonlySet<string> = new Set(words.map((w) => w.da.toLowerCase()))

  const { distinctive } = pack.orthography
  const { inflections, linkers } = pack.morphology

  const isInflection = (n: string): boolean =>
    inflections.some((suffix) => {
      if (!n.endsWith(suffix) || n.length - suffix.length < 3) return false
      const stem = n.slice(0, n.length - suffix.length)
      // "hus" -> "huset", and "cykle" -> "cyklede" where the stem lost its -e.
      return headwords.has(stem) || headwords.has(`${stem}e`)
    })

  const isCompound = (n: string): boolean => {
    for (let i = 3; i <= n.length - 3; i++) {
      const head = n.slice(0, i)
      if (!headwords.has(head) && !headwords.has(`${head}e`)) continue
      for (const link of linkers) {
        const tail = n.slice(i)
        if (tail.startsWith(link) && tail.length - link.length >= 3) {
          const rest = tail.slice(link.length)
          if (headwords.has(rest) || isInflection(rest)) return true
        }
      }
    }
    return false
  }

  /**
   * The target language, the player's language, or not decidable from the
   * shipped nine hundred.
   *
   * The old check was a single test — an English gloss that is not a headword —
   * which is right about the obvious cases and silent about everything else.
   * Everything else is most good clues: Danish compounds freely, so «dyreliv»,
   * «morgenmad» and «huskeliste» are all outside the nine hundred.
   *
   * This recognises the target language three ways and the player's language
   * one way, in the order the owner's rule demands (2026-09-17, the «tank»
   * bug): the dictionary always translates FROM the UI language TO Danish.
   *
   *  - a letter only the target language has (æ, ø, å) settles it outright;
   *  - a gloss in the ACTIVE UI language is a player-language word EVEN IF it
   *    is also a Danish headword — Norwegian «tank» (combat vehicle) is also
   *    Danish «tank» (container), and the typed word has to translate
   *    player→Danish, not Danish→Danish;
   *  - an inflection of a headword is the headword (hunden, husene, cyklede);
   *  - a compound of two headwords counts (dyre+liv, morgen+mad), with the
   *    linking morphemes the language puts between the halves.
   *
   * The gloss test gates the headword tests rather than running after them:
   * Danish classification requires the word NOT be a UI-language gloss. A word
   * that is both stays a player-language word here — the composer's submit
   * then passes through judgeTargetWord (Casey asks), which is the legality
   * gate 'english' words already had, so a genuinely-Danish typed clue that is
   * NOT a gloss still submits without a Casey round-trip.
   *
   * All of it comes from the pack, so the shape holds for German — where the
   * compound test matters more, not less. 'unknown' is a real answer and the
   * caller must treat it as permission: it is where every word of the language
   * we do not ship lives. Casey settles those.
   */
  function classifyClue(raw: string): ClueLanguage {
    const n = normalizeGloss(raw, glossArticles)
    if (n.length === 0) return 'unknown'
    if (distinctive.test(n)) return 'target'
    if (glosses.has(n)) return 'english'
    if (headwords.has(n)) return 'target'
    if (isInflection(n) || isCompound(n)) return 'target'
    return 'unknown'
  }

  return {
    words,
    wordById: (id) => byId.get(id),
    conceptsOf: (id) => concepts.get(id) ?? [],
    isKnownGloss: (normalized) => glosses.has(normalized),
    normalizeGloss: (s) => normalizeGloss(s, glossArticles),
    isHeadword: (normalized) => headwords.has(normalized),
    classifyClue,
  }
}

/**
 * Teaching order. Distinct from freqRank: the first hundred were curated so
 * their words could actually be clued. The journey slices `journeyRank`
 * (src/journey/progress.ts) into cities, which is this order with a city's
 * authored roster pulled out in front — since 2026-09-11 City 1 is the roster
 * the authored boards were built on, and ranks 1–100 here are the band it
 * used to be. The curriculum projection and the research validators still
 * read this field directly, and were frozen against it.
 */
export const curriculumRank = (w: WordEntry): number => w.curriculumRank ?? w.freqRank
