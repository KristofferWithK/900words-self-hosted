/**
 * The language-shaped part of Casey's server brain.
 *
 * It deliberately has no dependency on the browser's language pack. The
 * Worker is a separately deployed trust boundary, so its legality rules and
 * prompt strings must arrive with that deployment rather than being supplied
 * by a caller.
 */
import targetWordsRaw from '../../src/data/words.da.json' with { type: 'json' }

export const normalize = (value) => value.normalize('NFC').trim().toLowerCase()
export const foldDanish = (value) => value.replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa')

const SUFFIXES = ['erne', 'ene', 'ede', 'er', 'en', 'et', 'e', 'r', 's', 't']

export function danishStem(word) {
  const value = normalize(word)
  for (const suffix of SUFFIXES) {
    if (value.endsWith(suffix) && value.length - suffix.length >= 3) {
      return value.slice(0, value.length - suffix.length)
    }
  }
  return value
}
const SHORT_INFLECTIONS = new Set([
  'r', 't', 's', 'e', 'en', 'et', 'er', 'es', 'ne',
  'ede', 'ene', 'ere', 'est', 'erne', 'hed', 'heden',
])
const DANISH_MINIMAL_PAIRS = [['lige', 'pige']]
const TARGET_WORDS = typeof targetWordsRaw === 'string' ? JSON.parse(targetWordsRaw) : targetWordsRaw
const DANISH_HEADWORDS = new Set(TARGET_WORDS.map((word) => normalize(word.da)))
const PAST_SUFFIXES = ['ede', 'te', 'et']
const IRREGULAR_PLURALS = [
  ['mand', 'mænd'], ['barn', 'børn'], ['and', 'ænder'], ['hånd', 'hænder'],
  ['tand', 'tænder'], ['nat', 'nætter'], ['bog', 'bøger'], ['fod', 'fødder'],
  ['ko', 'køer'], ['datter', 'døtre'], ['søster', 'søstre'],
]
const COMPOUND_PARTS = new Set([
  'fald', 'hund', 'hus', 'jagt', 'vogn', 'holdning', 'sove',
])

function shortInflection(longer, short) {
  if (!longer.startsWith(short)) return false
  let rest = longer.slice(short.length)
  if (rest.length === 0) return true
  if (rest[0] === short[short.length - 1]) rest = rest.slice(1)
  return SHORT_INFLECTIONS.has(rest)
}

function inflectionOfShort(longer, short) {
  if (short.length > 3) return false
  if (shortInflection(longer, short)) return true
  const folded = foldDanish(short)
  return folded !== short && longer === foldDanish(longer) && shortInflection(foldDanish(longer), folded)
}

function isPastOf(clue, board, pos) {
  if (pos !== 'verb' || !board.endsWith('e') || board.length < 3) return false
  const stem = board.slice(0, -1)
  return PAST_SUFFIXES.some((suffix) => clue === stem + suffix)
}

function isIrregularPair(a, b) {
  return IRREGULAR_PLURALS.some(
    ([one, other]) => (a === one && b === other) || (a === other && b === one),
  )
}

function hasCompoundConstituent(compound, constituent) {
  if (constituent.length < 3 || compound.length <= constituent.length) return false
  const follows = compound.slice(constituent.length)
  if (compound.startsWith(constituent) && follows.length > 0) {
    if (['', 's', 'e'].some((linker) => {
      const other = follows.slice(linker.length)
      return follows.startsWith(linker) && COMPOUND_PARTS.has(other)
    })) return true
  }
  const before = compound.slice(0, -constituent.length)
  if (compound.endsWith(constituent) && before.length > 0) {
    if (['', 's', 'e'].some((linker) => {
      const other = before.slice(0, before.length - linker.length)
      return before.endsWith(linker) && COMPOUND_PARTS.has(other)
    })) return true
  }
  return false
}

function isCompoundOf(clue, board) {
  const check = (compound, constituent) => hasCompoundConstituent(compound, constituent)
  if (check(clue, board) || check(board, clue)) return true
  const foldedClue = foldDanish(clue)
  const foldedBoard = foldDanish(board)
  return (clue === foldedClue && check(foldedClue, foldedBoard)) ||
    (board === foldedBoard && check(foldedBoard, foldedClue))
}

function clearTypoOf(a, b) {
  const left = Array.from(a)
  const right = Array.from(b)
  if (Math.max(left.length, right.length) < 4) return false

  if (left.length === right.length) {
    for (let i = 0; i < left.length - 1; i++) {
      if (
        left[i] === right[i + 1] &&
        left[i + 1] === right[i] &&
        left.slice(0, i).every((letter, offset) => letter === right[offset]) &&
        left.slice(i + 2).every((letter, offset) => letter === right[i + 2 + offset])
      ) return true
    }
  }

  if (right.length === left.length + 1) {
    for (let i = 1; i < right.length - 1; i++) {
      const isVowel = 'aeiouyæøå'.includes(right[i].toLowerCase())
      const surroundedByConsonants =
        !'aeiouyæøå'.includes(right[i - 1].toLowerCase()) &&
        !'aeiouyæøå'.includes(right[i + 1].toLowerCase())
      if (
        isVowel &&
        surroundedByConsonants &&
        right.filter((_, index) => index !== i).every((letter, index) => letter === left[index])
      ) return true
    }
  }

  if (left.length === right.length + 1) {
    for (let i = 1; i < left.length; i++) {
      if (
        left[i] === left[i - 1] &&
        left.filter((_, index) => index !== i).every((letter, index) => letter === right[index])
      ) return true
    }
  }
  return false
}

const forbiddenSpellingsByWord = new Map()

function likelyForbiddenSpellings(board, pos) {
  const key = `${pos}:${board}`
  const cached = forbiddenSpellingsByWord.get(key)
  if (cached) return cached
  const forms = new Set([board])
  const suffixes = new Set([...SUFFIXES, ...SHORT_INFLECTIONS])
  for (const suffix of suffixes) {
    forms.add(`${board}${suffix}`)
    if (board.length <= 3 && board.length > 0) forms.add(`${board}${board[board.length - 1]}${suffix}`)
  }
  if (pos === 'verb' && board.endsWith('e')) {
    const stem = board.slice(0, -1)
    for (const suffix of PAST_SUFFIXES) forms.add(`${stem}${suffix}`)
  }
  for (const [one, other] of IRREGULAR_PLURALS) {
    if (board === one) forms.add(other)
    if (board === other) forms.add(one)
  }
  for (const part of COMPOUND_PARTS) {
    for (const linker of ['', 's', 'e']) {
      for (const compound of [`${board}${linker}${part}`, `${part}${linker}${board}`]) {
        if (isCompoundOf(compound, board)) forms.add(compound)
      }
    }
  }
  forbiddenSpellingsByWord.set(key, forms)
  return forms
}

function typoOf(candidate, board, pos) {
  if (DANISH_MINIMAL_PAIRS.some(([one, other]) =>
    (candidate === one && board === other) || (candidate === other && board === one),
  )) return null
  if (DANISH_HEADWORDS.has(candidate) || DANISH_HEADWORDS.has(foldDanish(candidate))) return null
  for (const forbidden of likelyForbiddenSpellings(board, pos)) {
    if (
      clearTypoOf(candidate, forbidden) ||
      clearTypoOf(foldDanish(candidate), foldDanish(forbidden))
    ) return board
  }
  return null
}

/** The same Danish clue-legality rule the game applies to a player's clue. */
export function checkClueLegality(clue, words) {
  const candidate = normalize(clue)
  if (!candidate) return { legal: false, reason: 'empty clue' }
  if (/\s/.test(candidate)) return { legal: false, reason: 'clue must be a single word' }
  const candidateStem = danishStem(candidate)

  for (const word of words) {
    const board = normalize(word.da)
    if (!board) continue
    if (candidate === board || (foldDanish(candidate) === foldDanish(board) && candidate !== board)) {
      return { legal: false, reason: `"${clue}" is a word on the board`, conflictWord: word.da }
    }
    if (isCompoundOf(candidate, board)) {
      return { legal: false, reason: `"${clue}" is a compound of "${word.da}"`, conflictWord: word.da }
    }
    if (candidateStem === danishStem(board)) {
      return { legal: false, reason: `"${clue}" is a form of "${word.da}"`, conflictWord: word.da }
    }
    if (inflectionOfShort(candidate, board) || inflectionOfShort(board, candidate)) {
      return { legal: false, reason: `"${clue}" is a form of "${word.da}"`, conflictWord: word.da }
    }
    if (isPastOf(candidate, board, word.pos) || isIrregularPair(candidate, board)) {
      return { legal: false, reason: `"${clue}" is a form of "${word.da}"`, conflictWord: word.da }
    }
    const typo = typoOf(candidate, board, word.pos)
    if (typo) {
      return { legal: false, reason: `"${clue}" looks like a typo of "${typo}"`, conflictWord: word.da }
    }
  }
  return { legal: true }
}

const translateRules = `- Give the citation form: a noun in the singular indefinite, a verb as the bare infinitive, an adjective in the common gender.
- For a NOUN, always give the gender: "common" (en-word) or "neuter" (et-word). Give "article" as well ONLY when the noun has an ordinary indefinite singular — most do.
- Mass and abstract nouns do not: nobody says "en trafik", "et blod", "en mælk", "en kærlighed". For those set "countable": false and give no article, just the gender. Where BOTH readings are ordinary Danish the noun IS countable and keeps its article — "en øl" (a beer), "et brød" (a loaf), "en ost" (a whole cheese), "et hår" (a single hair) are all things Danes say, so do not strip those.

Respond with ONLY a JSON object: {"da": string, "en": string, "article": "en" | "et" (countable nouns only), "gender": "common" | "neuter" (all nouns), "countable": boolean (nouns only), "note": string (optional)}`

/** Only prompt-facing fields are present; the server never accepts a pack from the client. */
export const DANISH_LANGUAGE = {
  code: 'da',
  name: 'Danish',
  prompts: {
    translateRules,
    spellingRule: 'Write Danish with æ, ø and å — never ae, oe or aa.',
    functionWordNote:
      'op, ind, ud, ned, så, lige, jo, gang, samme, anden, altid, igen and the like. Association clues do not reach these, so never hang one on the back of a real clue. Take one only alone, with number 1, pointing at the everyday phrase it lives in (stå op, en gang til, lige nu)',
    clueExampleWord: 'kæledyr',
    compoundExample: 'with "værelse" on the board, "soveværelse" is illegal',
  },
}
