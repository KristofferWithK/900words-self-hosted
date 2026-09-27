import { normalize } from '../../engine/text'
import type { LegalityRules, Morphology } from '../types'
import { germanOrthography } from './orthography'

/**
 * German inflection is not suffix-only, which is the thing `da/morphology.ts`
 * warned H2 about. Three shapes the Danish stemmer cannot reach:
 *
 *  - the participle's `ge-` PREFIX (gemacht → mach, gekauft → kauf);
 *  - umlaut in the plural and the comparative (Haus/Häuser, groß/größer) —
 *    handled by folding the umlaut out of the stem, so Häuser and Haus land on
 *    the same string without a list;
 *  - separable verbs, where `aufstehen` genuinely contains `stehen` and the
 *    particle is a real constituent rather than a coincidence of letters.
 *
 * Deliberately conservative, for the reason the Danish file gives: this stemmer
 * is shared by legality and the packing grader, and loosening it makes the
 * grader start accepting one real word as the answer for another.
 */
const SUFFIXES = ['ungen', 'ung', 'enen', 'ern', 'est', 'end', 'en', 'er', 'em', 'es', 'et', 'st', 'e', 'n', 's', 't']

/** ge- only where something is left: `Geld` and `gehen` are not participles. */
const stripGe = (w: string): string => (w.startsWith('ge') && w.length >= 6 ? w.slice(2) : w)

/** Umlaut out, so Häuser and Haus stem alike without an irregular list. */
const flatten = (w: string): string =>
  w.replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')

export function germanStem(word: string): string {
  const w = flatten(stripGe(normalize(word)))
  for (const suf of SUFFIXES) {
    if (w.endsWith(suf) && w.length - suf.length >= 3) {
      return w.slice(0, w.length - suf.length)
    }
  }
  return w
}

/** Endings that make a German headword into another form of itself. */
const INFLECTIONS = ['e', 'en', 'er', 'ern', 'es', 'em', 'et', 'st', 's', 'n', 'ung', 'ungen']

/**
 * Linking morphemes between the halves of a German compound: Arbeit-s-platz,
 * Blume-n-strauß, Kind-er-garten, Tag-es-licht.
 */
const LINKERS = ['', 's', 'n', 'en', 'er', 'es', 'e']

/** The shared allowlist fallback is not how the German Worker detects compounds. */
const COMPOUND_PARTS = new Set<string>()

/**
 * Endings that count as an inflection of a word of three letters or fewer,
 * which the general guards (length >= 4) do not reach.
 */
const SHORT_INFLECTIONS = new Set([
  'e', 'n', 'r', 's', 't', 'en', 'er', 'es', 'em', 'et', 'st', 'ern', 'te', 'ten',
])

/**
 * The participle, which the stemmer reaches only from one side.
 *
 * `germanStem` strips `ge-`, so `gekauft` and `kaufen` both land on `kauf`. The
 * forms it misses are the ones that also change the vowel (`sprechen` →
 * `gesprochen`) and the separable verbs, where the participle buries `ge-` in
 * the middle (`aufstehen` → `aufgestanden`). This rule catches the regular
 * `ge-…-t` and `ge-…-en` shapes directly so legality does not depend on the
 * stemmer's length guard.
 *
 * Verbs only, following the Danish precedent: applied to every part of speech
 * the same shape blocks real, unrelated pairs.
 */
function isParticipleOf(clue: string, board: string, boardPos: string): boolean {
  if (boardPos !== 'verb') return false
  if (!board.endsWith('en') || board.length < 4) return false
  const stem = flatten(board.slice(0, -2))
  const participle = flatten(stripGe(clue))
  return participle === stem || participle === `${stem}t` || participle === `${stem}en`
}

/**
 * German forms that the shared two-sided stem comparison cannot safely infer.
 * For example, `germanStem('Zimmer')` strips its lexical `-er`, while
 * `germanStem('Zimmers')` strips the genitive `-s`; comparing those stems misses
 * a real form. Keep the Worker's conservative ending, umlaut and irregular-form
 * checks in the pack hook so the client and Worker refuse the same German forms.
 */
const FORM_ENDINGS = [
  'esten', 'este', 'sten', 'ste', 'ern', 'ten', 'end', 'em', 'en', 'er', 'es', 'et', 'st', 'te', 'e', 'n', 's', 't',
]
const UMLAUT_ENDINGS = new Set(['esten', 'este', 'sten', 'ste', 'ern', 'en', 'er', 'e'])
/** German irregulars carried by Casey's German rules and shared with the client. */
const IRREGULAR_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['gehen', 'gegangen'],
  ['stehen', 'gestanden'],
  ['nehmen', 'genommen'],
  ['finden', 'gefunden'],
  ['sitzen', 'gesessen'],
  ['liegen', 'gelegen'],
  ['denken', 'gedacht'],
  ['wissen', 'gewusst'],
  ['bringen', 'gebracht'],
  ['essen', 'gegessen'],
  ['treffen', 'getroffen'],
  ['sprechen', 'gesprochen'],
  ['sein', 'gewesen'],
  ['haben', 'gehabt'],
  ['werden', 'geworden'],
  ['gut', 'besser'],
  ['gut', 'beste'],
  ['viel', 'mehr'],
  ['viel', 'meiste'],
  ['nehmen', 'nimmt'],
  ['sehen', 'sieht'],
  ['essen', 'isst'],
  ['lesen', 'liest'],
  ['fahren', 'fährt'],
  ['halten', 'hält'],
  ['laufen', 'läuft'],
  ['mutter', 'mütter'],
  ['tochter', 'töchter'],
  ['bruder', 'brüder'],
]

const bareVowel = (word: string): string =>
  word.replace(/ä|ae/g, 'a').replace(/ö|oe/g, 'o').replace(/ü|ue/g, 'u')

function formConstituents(board: string, boardPos: string): string[] {
  const stem = board.endsWith('en') ? board.slice(0, -2) : board.endsWith('n') ? board.slice(0, -1) : board
  return boardPos === 'verb' && stem.length >= 4 && stem !== board ? [board, stem] : [board]
}

function endingForm(longer: string, targets: readonly string[], umlaut = true): boolean {
  if (longer.length < 4) return false
  for (const ending of FORM_ENDINGS) {
    if (!longer.endsWith(ending)) continue
    const base = longer.slice(0, -ending.length)
    if (base.length < 3) continue
    if (targets.some((target) =>
      base === target || (umlaut && UMLAUT_ENDINGS.has(ending) && bareVowel(base) === bareVowel(target)),
    )) return true
  }
  return false
}

/** Conservative German boundary parsing, kept in step with Casey's Worker. */
const COMPOUND_LINKERS = ['', 's', 'es', 'n', 'en', 'ns', 'e', 'er']
const COMPOUND_SUFFIXES = new Set([
  'schaft', 'schaften', 'heit', 'heiten', 'keit', 'keiten', 'ung', 'ungen', 'tum', 'nis', 'nisse',
  'chen', 'lein', 'lich', 'liche', 'isch', 'ische', 'los', 'lose', 'bar', 'bare', 'haft', 'hafte',
  'sam', 'same', 'voll', 'volle', 'frei', 'freie', 'erei', 'ling', 'linge', 'werk', 'zeug',
])
const COMPOUND_PREFIXES = [
  'zusammen', 'zurück', 'zurueck', 'entgegen', 'herunter', 'hinunter', 'heraus', 'herein', 'hinaus',
  'hinein', 'weiter', 'wieder', 'voraus', 'vorbei', 'davon', 'durch', 'statt', 'unter', 'gegen',
  'empor', 'nieder', 'fest', 'fort', 'heim', 'nach', 'über', 'ueber', 'teil', 'voll', 'dazu', 'zer',
  'auf', 'aus', 'bei', 'ein', 'ent', 'her', 'hin', 'los', 'mit', 'ver', 'vor', 'weg', 'ab', 'an',
  'be', 'er', 'um', 'zu',
]
const COMPOUND_FRAGMENTS = /^(ver|vor|be|ge|ent|er|zer|emp|miss|um|un)[bcdfghjklmnpqrstvwxzß]{1,2}$/
const LATINATE_COMPOUND = /^.{3,}ier(en|t|te|ten|st)$/
const LATINATE_WORD = /(ation|ition|ution|ktion|sion|ismus|ität|itaet)$/
const COMPOUND_TAILS = new Set(FORM_ENDINGS)

function isFreeGermanMorpheme(part: string, floor: number): boolean {
  return part.length >= floor && /[aeiouyäöü]/.test(part) &&
    !COMPOUND_FRAGMENTS.test(part) && !COMPOUND_TAILS.has(part)
}

function hasGermanCompoundConstituent(compound: string, part: string, floor: number): boolean {
  if (part.length < floor || compound.length <= part.length) return false
  if (compound.startsWith(part)) {
    const rest = compound.slice(part.length)
    for (const linker of COMPOUND_LINKERS) {
      if (!rest.startsWith(linker)) continue
      const head = rest.slice(linker.length)
      if (!LATINATE_COMPOUND.test(head) &&
        (COMPOUND_SUFFIXES.has(head) || isFreeGermanMorpheme(head, floor))) return true
    }
  }
  if (compound.endsWith(part)) {
    const rest = compound.slice(0, -part.length)
    for (const linker of COMPOUND_LINKERS) {
      if (!rest.endsWith(linker)) continue
      const modifier = rest.slice(0, rest.length - linker.length)
      if (modifier.length === 3 && part.length < 4) continue
      if (isFreeGermanMorpheme(modifier, floor)) return true
    }
  }
  return false
}

function germanPrefixed(clue: string, board: string, boardPos: string): boolean {
  for (const prefix of COMPOUND_PREFIXES) {
    if (!clue.startsWith(prefix)) continue
    const rest = clue.slice(prefix.length)
    if (rest.length < 3) continue
    if (rest === board) return true
    if (boardPos === 'verb' && endingForm(rest, formConstituents(board, boardPos), false)) return true
  }
  return false
}

function isGermanCompoundOf(clue: string, board: string, boardPos: string): boolean {
  const { fold } = germanOrthography
  const floor = 3
  for (const part of formConstituents(board, boardPos)) {
    if (part !== board && LATINATE_WORD.test(clue)) continue
    if (hasGermanCompoundConstituent(clue, part, floor) ||
      hasGermanCompoundConstituent(part, clue, floor)) return true
    if (clue === fold(clue) && hasGermanCompoundConstituent(clue, fold(part), floor)) return true
    if (part === fold(part) && hasGermanCompoundConstituent(part, fold(clue), floor)) return true
  }
  return germanPrefixed(clue, board, boardPos) || germanPrefixed(board, clue, boardPos)
}

function isGermanFormOf(clue: string, board: string, boardPos: string): boolean {
  const { fold } = germanOrthography
  for (const candidate of new Set([clue, fold(clue)])) {
    for (const target of new Set([board, fold(board)])) {
      if (
        endingForm(candidate, formConstituents(target, boardPos), boardPos !== 'verb') ||
        endingForm(target, [candidate], boardPos !== 'verb')
      ) return true
      if (boardPos === 'noun' && /(er|el|en)$/.test(target) && bareVowel(candidate) === bareVowel(target)) return true
      if (IRREGULAR_PAIRS.some(([one, other]) =>
        (candidate === one && target === other) || (candidate === other && target === one),
      )) return true
    }
  }
  return false
}

function isGermanDerivedForm(clue: string, board: string, boardPos: string): boolean {
  return isParticipleOf(clue, board, boardPos) || isGermanFormOf(clue, board, boardPos)
}

const legality: LegalityRules = {
  compoundParts: COMPOUND_PARTS,
  isCompoundOf: isGermanCompoundOf,
  shortInflections: SHORT_INFLECTIONS,
  isDerivedForm: isGermanDerivedForm,
  irregularPairs: IRREGULAR_PAIRS,
}

export const germanMorphology: Morphology = {
  stem: germanStem,
  inflections: INFLECTIONS,
  linkers: LINKERS,
  legality,
}
