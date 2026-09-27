import type { PromptStrings } from '../types'

/**
 * The German half of what Casey is told.
 *
 * Everything here is a rule OF GERMAN rather than a rule of the game — the
 * game's own rules stay in `src/ai/prompts.ts` and are shared verbatim by every
 * language. `seam.test.ts` asserts that a prompt built for a language other
 * than Danish contains no Danish letter, which is how the last three of these
 * were found when the seam was built.
 *
 * Written, not verified: no German round has been played through a model. The
 * pack is a preview (`readiness: 'preview'`) and play is off, so these strings
 * exist to keep the seam honest rather than to be trusted in a live round.
 */

/**
 * How gender, articles and countability work, for the translate prompt.
 *
 * Two things differ from Danish and both matter. German has three genders but
 * only two indefinite articles — der and das words share "ein" — so the model
 * is asked for both and cannot derive one from the other. And German
 * capitalises its nouns, so the citation form of a noun is capitalised while a
 * verb and an adjective are not.
 */
const translateRules = `- Give the citation form: a noun in the nominative singular WITH ITS CAPITAL LETTER, a verb as the bare infinitive in lower case, an adjective in its uninflected form.
- For a NOUN, always give the gender: "masculine" (der), "feminine" (die) or "neuter" (das). Give "article" as well ONLY when the noun has an ordinary indefinite singular — most do. Note that masculine and neuter nouns BOTH take "ein"; only feminine takes "eine".
- Mass and abstract nouns do not: nobody says "eine Milch", "ein Blut", "eine Liebe", "ein Verkehr". For those set "countable": false and give the gender with no article.
- Where BOTH readings are ordinary German the noun IS countable and keeps its article — "ein Bier", "ein Brot" (a loaf), "ein Eis", "ein Wasser" and "ein Kaffee" are all things people order, so do not strip those.

Respond with ONLY a JSON object: {"da": string, "en": string, "article": "ein" | "eine" (countable nouns only), "gender": "masculine" | "feminine" | "neuter" (all nouns), "countable": boolean (nouns only), "note": string (optional)}

Example for "Fahrrad": {"da": "Fahrrad", "en": "bicycle", "article": "ein", "gender": "neuter", "countable": true}
Example for "afternoon": {"da": "Nachmittag", "en": "afternoon", "article": "ein", "gender": "masculine", "countable": true}
Example for "Verkehr": {"da": "Verkehr", "en": "traffic", "gender": "masculine", "countable": false}
Example for "to cycle": {"da": "fahren", "en": "to cycle"}`

export const germanPrompts: PromptStrings = {
  translateRules,
  spellingRule: 'Write German with ä, ö, ü and ß — never ae, oe, ue or ss. Capitalise every noun.',
  functionWordNote:
    'auf, an, aus, mit, doch, mal, schon, eben, gleich, noch, wieder and the like. Association clues do not reach these, so never hang one on the back of a real clue. Take one only alone, with number 1, pointing at the everyday phrase it lives in (aufstehen, noch einmal, gerade jetzt)',
  clueExampleWord: 'Haustier',
  // Player-language rationale examples now belong to the player-language layer.
  compoundExample: 'with "Zimmer" on the board, "Schlafzimmer" is illegal',
}
