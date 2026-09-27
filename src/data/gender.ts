import { ACTIVE } from '../lang/active'
import type { GenderSpec } from '../lang/types'

/**
 * What to print in front of a noun.
 *
 * The indefinite article where one exists, and the gender in brackets where one
 * does not. A handful of nouns are plurale tantum — penge, bukser, briller —
 * so there is no "en penge" to show, and the board used to print nothing at all
 * beside them. That taught the learner less than any other card on the board:
 * the gender is what decides the definite ending and every agreeing adjective,
 * and it exists whether or not the word can be counted.
 *
 * The two-gender assumption is gone: the labels come from the active pack's
 * gender table, so German's three arrive as data rather than as a third branch.
 * Short forms because this sits on a 64px-wide card at 360px: (com) and (neut).
 */

/**
 * Structurally typed rather than tied to WordEntry, because the board carries
 * its own trimmed copy (BoardWord) whose `pos` is a plain string. `gender` is a
 * plain string for the same reason and because the set of them is the
 * language's business, not the board's.
 */
interface Gendered {
  pos: string
  article?: string
  gender?: string
  /** Explicitly false only for mass and abstract nouns. */
  countable?: boolean
}

const specFor = (w: Gendered): GenderSpec | undefined =>
  w.gender === undefined ? undefined : ACTIVE.grammar.genders[w.gender]

export function articleLabel(w: Gendered): string | null {
  if (w.pos !== 'noun') return null
  // German's citation form is the definite article, including for mass nouns:
  // the learner should see and hear «die Milch», not an indefinite count form.
  if (w.article && ['der', 'die', 'das'].includes(w.article)) return w.article
  // Uncountable first: a mass noun may still carry an article in the data —
  // it is the gender, recorded the only way the source had — but printing it
  // in front of the word says you can count it, and you cannot.
  if (w.countable === false) return specFor(w)?.short ?? null
  if (w.article) return w.article
  return specFor(w)?.short ?? null
}

/**
 * What is SAID in front of the word when it is tapped: the article, whenever
 * the article is what the card prints. The gender-only labels — «(com)» for
 * a mass noun, «(neut)» for a plurale tantum — are not words a Dane says, so
 * a noun that prints one of those is spoken bare. One rule for the eye and
 * the ear rather than two, so a card can never print «en» and say nothing,
 * or print «(com)» and say «en» (owner, 2026-09-07: hearing the article every
 * time the word is heard is the point; a listener meets the gender as often
 * as the word).
 */
export function spokenArticle(w: Gendered): string | null {
  const label = articleLabel(w)
  return label !== null && label === w.article ? label : null
}

/** The same thing said in full, for a screen reader and the dictionary sheet. */
export function genderLabel(w: Gendered): string | null {
  if (w.pos !== 'noun') return null
  if (w.article && ['der', 'die', 'das'].includes(w.article)) return w.article
  if (w.countable === false) return specFor(w)?.full ?? null
  if (w.article) return w.article
  return specFor(w)?.full ?? null
}
