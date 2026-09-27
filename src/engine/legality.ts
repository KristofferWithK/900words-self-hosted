import type { LanguagePack } from '../lang/types'
import { normalize } from './text'
import type { BoardWord } from './types'

/**
 * Why a clue was refused, as data rather than as a sentence.
 *
 * `reason` below is the same refusal written out in English, and it stays:
 * it is what the engine's own tests read, what a log shows, and what the
 * Worker's parallel copy produces. But it is also the only string in this file
 * a PLAYER sees, and a player who set the app to German should read it in
 * German. Rendering it here would mean the game rules importing the UI
 * language, which is backwards — the engine does not know or care what
 * language the chrome speaks.
 *
 * So the engine says WHAT was wrong and names the words involved, and the clue
 * dock turns that into a sentence out of the catalogue. `word` present on the
 * last two means `candidate` is a translation OF that board word rather than
 * the board word itself, which is the distinction the message has to keep:
 * translations are hidden by default, so an error about a gloss must also name
 * the word the player can actually see.
 */
export type LegalityReason =
  | { kind: 'empty' }
  | { kind: 'not-single-word' }
  | { kind: 'on-board'; clue: string }
  | { kind: 'compound-of'; clue: string; candidate: string }
  | { kind: 'form-of'; clue: string; candidate: string }
  | { kind: 'typo-of'; clue: string; candidate: string }

export interface LegalityVerdict {
  legal: boolean
  /** The refusal in English, for tests, logs and the engine's own contract. */
  reason?: string
  /** The same refusal as data, for the one place a player reads it. */
  why?: LegalityReason
  conflictWord?: string
}

/**
 * Clue legality, with the language's own rules injected.
 *
 * The ALGORITHM here is language-neutral — exact match, containment, shared
 * stem, inflection of a short word, derived form, irregular pair — and every
 * one of those steps asks the pack what counts. What used to be a file of
 * Danish suffix lists is now a file of questions; the Danish answers live in
 * `src/lang/da/morphology.ts` and are unchanged, which is why this refactor
 * moves no behaviour.
 */

/**
 * The general guards below all require length >= 4, so short words like gå, år,
 * by, se would otherwise only be blocked on exact equality — 'går' would be a
 * legal clue for 'gå'. The pack supplies the endings that count, and the
 * gemination step is shared: a doubled final consonant before an ending is a
 * Germanic habit, not a Danish one (øl → øllet, æg → ægget).
 */
function isInflectionOfShort(
  longer: string,
  short: string,
  suffixes: ReadonlySet<string>,
): boolean {
  if (!longer.startsWith(short)) return false
  let rest = longer.slice(short.length)
  if (rest.length === 0) return true
  if (rest[0] === short[short.length - 1]) rest = rest.slice(1) // gemination
  return suffixes.has(rest)
}

/**
 * The same test, also in the folded ASCII spelling — because every other guard
 * here folds and this one did not, so with "dør" on the board "døren" was
 * rejected while "doeren" was legal. 41 board words are three letters or fewer
 * and contain a Danish letter, so that is not a corner: øl/oellet, æg/aegget,
 * søn/soennen.
 *
 * Two details the obvious version gets wrong, both measured against the whole
 * dataset. The fold is applied only when the SHORT word really contains a
 * language-specific letter, and the length test stays on the unfolded spelling
 * — folding unconditionally lengthens the short word into a prefix it never
 * was, and blocks four real pairs: "to" swallows "tør", "ko" swallows "køre",
 * "sko" swallows "skøn", "ro" swallows "røre". Guarded this way it catches all
 * twelve ASCII forms and adds no new block anywhere in the set.
 */
function inflectionOfShort(longer: string, short: string, lang: LanguagePack): boolean {
  if (short.length > 3) return false
  const suffixes = lang.morphology.legality.shortInflections
  if (isInflectionOfShort(longer, short, suffixes)) return true
  const fold = lang.orthography.fold
  const folded = fold(short)
  // Only an ASCII keyboard spelling gets this second reading. Folding a
  // properly Danish word creates false morphology (sko/skøn → sko/skoen).
  return folded !== short && longer === fold(longer) && isInflectionOfShort(fold(longer), folded, suffixes)
}

function isIrregularFormOf(a: string, b: string, lang: LanguagePack): boolean {
  return lang.morphology.legality.irregularPairs.some(
    ([one, other]) => (a === one && b === other) || (a === other && b === one),
  )
}

/**
 * Does one word put the other at a compound boundary?  This is deliberately
 * narrower than `includes`: spelling overlap is not morphology.  In
 * particular, `te`/`telefon` must remain legal; `telefon` is not a compound
 * made from the Danish word `te`.
 *
 * Danish compounds can join directly (vand-fald, jagt-hund) or through a
 * linker (hund-e-hus).  A constituent at either edge is the mechanical
 * evidence available to the legality guard; a fragment in the middle is not.
 * The three-letter floor protects short function-like words from becoming
 * arbitrary prefixes while retaining real constituents such as hus.
 */
function hasCompoundConstituent(
  compound: string,
  constituent: string,
  linkers: readonly string[],
  compoundParts: ReadonlySet<string>,
): boolean {
  if (constituent.length < 3 || compound.length <= constituent.length) return false
  const follows = compound.slice(constituent.length)
  if (compound.startsWith(constituent) && follows.length > 0) {
    if (linkers.some((linker) => {
      const other = follows.slice(linker.length)
      return follows.startsWith(linker) && compoundParts.has(other)
    })) return true
  }
  const before = compound.slice(0, -constituent.length)
  if (compound.endsWith(constituent) && before.length > 0) {
    if (linkers.some((linker) => {
      const other = before.slice(0, before.length - linker.length)
      return before.endsWith(linker) && compoundParts.has(other)
    })) return true
  }
  return false
}

function isCompoundOf(clue: string, board: string, lang: LanguagePack, boardPos: string): boolean {
  if (lang.morphology.legality.isCompoundOf?.(clue, board, boardPos)) return true
  const check = (compound: string, constituent: string) =>
    hasCompoundConstituent(
      compound,
      constituent,
      lang.morphology.linkers,
      lang.morphology.legality.compoundParts,
    )
  if (check(clue, board) || check(board, clue)) return true
  const fold = lang.orthography.fold
  const foldedClue = fold(clue)
  const foldedBoard = fold(board)
  // Fold only an ASCII keyboard spelling of the *compound*. Applying it to a
  // correctly-spelled word invents boundaries (skøn → skoen beside sko).
  return (
    (clue === foldedClue && check(foldedClue, foldedBoard)) ||
    (board === foldedBoard && check(foldedBoard, foldedClue))
  )
}

const knownHeadwordsByLanguage = new WeakMap<LanguagePack, ReadonlySet<string>>()

function knownHeadwords(lang: LanguagePack): ReadonlySet<string> {
  let known = knownHeadwordsByLanguage.get(lang)
  if (!known) {
    known = new Set(lang.words.map((word) => normalize(word.da)))
    knownHeadwordsByLanguage.set(lang, known)
  }
  return known
}

const forbiddenSpellingsByLanguage = new WeakMap<LanguagePack, Map<string, ReadonlySet<string>>>()
const likelyTyposByLanguage = new WeakMap<LanguagePack, Map<string, ReadonlySet<string>>>()

function likelyForbiddenSpellings(board: string, pos: string, lang: LanguagePack): ReadonlySet<string> {
  let cache = forbiddenSpellingsByLanguage.get(lang)
  if (!cache) {
    cache = new Map()
    forbiddenSpellingsByLanguage.set(lang, cache)
  }
  const key = `${pos}:${board}`
  const cached = cache.get(key)
  if (cached) return cached

  const forms = new Set([board])
  const suffixes = new Set([
    ...lang.morphology.inflections,
    ...lang.morphology.legality.shortInflections,
  ])
  for (const suffix of suffixes) {
    forms.add(`${board}${suffix}`)
    if (board.length <= 3 && board.length > 0) forms.add(`${board}${board[board.length - 1]}${suffix}`)
  }
  if (pos === 'verb' && board.endsWith('e')) {
    const stem = board.slice(0, -1)
    for (const suffix of ['ede', 'te', 'et']) forms.add(`${stem}${suffix}`)
  }
  for (const [one, other] of lang.morphology.legality.irregularPairs) {
    if (board === one) forms.add(other)
    if (board === other) forms.add(one)
  }
  for (const part of lang.morphology.legality.compoundParts) {
    for (const linker of lang.morphology.linkers) {
      for (const compound of [`${board}${linker}${part}`, `${part}${linker}${board}`]) {
        if (isCompoundOf(compound, board, lang, pos)) forms.add(compound)
      }
    }
  }
  cache.set(key, forms)
  return forms
}

function likelyTypoSpellings(board: string, pos: string, lang: LanguagePack): ReadonlySet<string> {
  let cache = likelyTyposByLanguage.get(lang)
  if (!cache) {
    cache = new Map()
    likelyTyposByLanguage.set(lang, cache)
  }
  const key = `${pos}:${board}`
  const cached = cache.get(key)
  if (cached) return cached

  const typos = new Set<string>()
  const fold = lang.orthography.fold
  for (const forbidden of likelyForbiddenSpellings(board, pos, lang)) {
    const spellings = new Set([forbidden, fold(forbidden)])
    for (const spelling of spellings) {
      const letters = Array.from(spelling)
      if (letters.length < 4) {
        // The Worker accepts a duplicated keystroke on a three-letter form,
        // but keeps transpositions and vowel deletion above this length floor.
        if (letters.length === 3) {
          for (let i = 0; i < letters.length; i++) {
            typos.add([...letters.slice(0, i + 1), letters[i]!, ...letters.slice(i + 1)].join(''))
          }
        }
        continue
      }

      // Adjacent transposition: hudnen → hunden; vandfadl → vandfald.
      for (let i = 0; i < letters.length - 1; i++) {
        if (letters[i] === letters[i + 1]) continue
        const swapped = [...letters]
        ;[swapped[i], swapped[i + 1]] = [swapped[i + 1]!, swapped[i]!]
        typos.add(swapped.join(''))
      }

      // Dropping a vowel between consonants: hnd → hund. Avoid general
      // insert/delete/substitute distance, which rejects unknown words.
      for (let i = 1; i < letters.length - 1; i++) {
        const vowel = (letter: string) => 'aeiouyæøå'.includes(letter.toLowerCase())
        if (vowel(letters[i]!) && !vowel(letters[i - 1]!) && !vowel(letters[i + 1]!)) {
          typos.add(letters.filter((_, index) => index !== i).join(''))
        }
      }

      // One duplicated adjacent keystroke, with no other edit.
      for (let i = 0; i < letters.length; i++) {
        typos.add([...letters.slice(0, i + 1), letters[i]!, ...letters.slice(i + 1)].join(''))
      }
    }
  }
  cache.set(key, typos)
  return typos
}

function typoOf(candidate: string, board: string, pos: string, lang: LanguagePack): string | null {
  const fold = lang.orthography.fold
  if (lang.code !== 'da') return null
  if (lang.morphology.legality.minimalPairs?.some(([one, other]) =>
    (candidate === one && board === other) || (candidate === other && board === one),
  )) return null
  if (knownHeadwords(lang).has(candidate) || knownHeadwords(lang).has(fold(candidate))) return null
  const typos = likelyTypoSpellings(board, pos, lang)
  return typos.has(candidate) || typos.has(fold(candidate)) ? board : null
}

/**
 * A clue is illegal when it is too close to a visible board word in the
 * language being learned. English card glosses are not part of the rule.
 */
export function checkClueLegality(
  clue: string,
  words: readonly BoardWord[],
  lang: LanguagePack,
): LegalityVerdict {
  const c = normalize(clue)
  if (!c) return { legal: false, reason: 'empty clue', why: { kind: 'empty' } }
  if (/\s/.test(c)) {
    return { legal: false, reason: 'clue must be a single word', why: { kind: 'not-single-word' } }
  }

  const { fold } = lang.orthography
  const { stem } = lang.morphology
  const { isDerivedForm } = lang.morphology.legality
  const cStem = stem(c)

  for (const w of words) {
    const b = normalize(w.da)
    if (!b) continue
    const candidate = w.da
    if (c === b || (fold(c) === fold(b) && c !== b)) {
      return {
        legal: false,
        reason: `"${clue}" is a word on the board`,
        why: { kind: 'on-board', clue },
        conflictWord: w.da,
      }
    }
    if (isCompoundOf(c, b, lang, w.pos)) {
      return {
        legal: false,
        reason: `"${clue}" is a compound of "${candidate}"`,
        why: { kind: 'compound-of', clue, candidate },
        conflictWord: w.da,
      }
    }
    if (cStem === stem(b)) {
      return {
        legal: false,
        reason: `"${clue}" is a form of "${candidate}"`,
        why: { kind: 'form-of', clue, candidate },
        conflictWord: w.da,
      }
    }
    if (inflectionOfShort(c, b, lang) || inflectionOfShort(b, c, lang)) {
      return {
        legal: false,
        reason: `"${clue}" is a form of "${candidate}"`,
        why: { kind: 'form-of', clue, candidate },
        conflictWord: w.da,
      }
    }
    if (isDerivedForm(c, b, w.pos) || isIrregularFormOf(c, b, lang)) {
      return {
        legal: false,
        reason: `"${clue}" is a form of "${candidate}"`,
        why: { kind: 'form-of', clue, candidate },
        conflictWord: w.da,
      }
    }
    const typo = typoOf(c, b, w.pos, lang)
    if (typo) {
      return {
        legal: false,
        reason: `"${clue}" looks like a typo of "${typo}"`,
        why: { kind: 'typo-of', clue, candidate: w.da },
        conflictWord: w.da,
      }
    }
  }
  return { legal: true }
}
