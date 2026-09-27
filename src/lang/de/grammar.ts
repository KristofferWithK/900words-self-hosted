import type { Grammar } from '../types'

/**
 * Which German nouns have no ordinary indefinite singular.
 *
 * THE RULE, the same one the Danish file states, applied to German:
 *
 *   A noun is UNCOUNTABLE here when "ein X" / "eine X" would be wrong or
 *   clearly odd in everyday German. Where both readings are ordinary the
 *   article stays, because "ein Bier", "ein Brot", "ein Eis", "ein Kaffee" and
 *   "ein Wasser" are all things German speakers say AND they teach the gender
 *   in the form a learner meets. German counts drinks and portions freely;
 *   that is not an error to fix.
 *
 * Deliberately NOT included, each for that reason: Bier, Brot, Eis, Kaffee,
 * Tee, Wein, Wasser, Käse, Suppe, Papier, Glas, Holz, Haar, Arbeit.
 *
 * Checked against the current 100-word German City 1 roster. Keep the
 * exclusion rule above explicit; playtest availability does not certify the
 * German list or the draft Guide as natively reviewed.
 */

/** Substances and materials: measured, not counted. */
const SUBSTANCES = [
  'Milch', 'Fleisch', 'Butter', 'Salz', 'Zucker', 'Mehl', 'Blut',
  'Luft', 'Erde', 'Schnee', 'Regen', 'Feuer', 'Schokolade', 'Seife', 'Pfeffer',
]

/** Collectives: already plural, or already the whole of the thing. */
const COLLECTIVES = ['Kleidung', 'Geld', 'Gepäck', 'Obst', 'Gemüse']

/** Weather and the natural world, as conditions rather than events. */
const CONDITIONS = ['Wetter', 'Wind', 'Sonnenschein', 'Wärme', 'Kälte', 'Natur', 'Nebel']

/** States of mind and other abstractions you have rather than have one of. */
const ABSTRACTIONS = [
  'Liebe', 'Glück', 'Trauer', 'Frieden', 'Wissen', 'Hilfe', 'Wut', 'Angst',
  'Stolz', 'Scham', 'Einsamkeit', 'Vertrauen', 'Ruhe', 'Gesundheit',
  'Hoffnung', 'Freude', 'Zeit', 'Freizeit',
]

/** Fields and pursuits, and the illnesses you simply have. */
const DOMAINS = [
  'Musik', 'Kultur', 'Sport', 'Bewegung', 'Internet',
  'Fieber', 'Grippe', 'Husten',
]

export const UNCOUNTABLE: ReadonlySet<string> = new Set([
  ...SUBSTANCES,
  ...COLLECTIVES,
  ...CONDITIONS,
  ...ABSTRACTIONS,
  ...DOMAINS,
])

/** The classes, named, so a validator can report which one a word came from. */
export const UNCOUNTABLE_CLASSES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['substance', SUBSTANCES],
  ['collective', COLLECTIVES],
  ['condition', CONDITIONS],
  ['abstraction', ABSTRACTIONS],
  ['domain', DOMAINS],
]

// German capitalises its nouns, so the lookup is case-folded on both sides
// rather than assuming a lower-case headword the way the Danish one can.
const FOLDED: ReadonlySet<string> = new Set([...UNCOUNTABLE].map((noun) => noun.toLowerCase()))

export const isUncountable = (headword: string): boolean => FOLDED.has(headword.toLowerCase())

/**
 * German has three genders, and each prints three ways.
 *
 * `article` is stated per gender rather than derived from it, and German is
 * exactly why: der and das both take "ein". The short forms are short because
 * this sits on a 64px-wide card at 360px.
 *
 * Below the UNCOUNTABLE export, matching the Danish file: `validate-words.mjs`
 * reads word lists out of a grammar module by taking every quoted string ABOVE
 * that export, so nothing up there may be anything but a headword.
 */
const GENDERS = {
  masculine: { article: 'ein', short: '(der)', full: 'masculine · der' },
  feminine: { article: 'eine', short: '(die)', full: 'feminine · die' },
  neuter: { article: 'ein', short: '(das)', full: 'neuter · das' },
} as const

export const germanGrammar: Grammar = {
  genders: GENDERS,
  isUncountable,
  // "der Tisch", "ein Haus", "zu gehen" — the articles, and the infinitive
  // marker. Both definite and indefinite, because a German learner typing an
  // answer is at least as likely to reach for the definite article, which is
  // the one the card teaches.
  answerFiller: ['der', 'die', 'das', 'ein', 'eine', 'zu'],
}
