import type { TargetCopy } from '../types'

/**
 * The four places a German build speaks German at the player rather than the
 * UI language. See `TargetCopy` for why each one is an exception to the
 * chrome rule.
 *
 * The tips are NOT translations of the Danish ones, exactly as `types.ts` says:
 * Danish's are about æøå, the suffixed definite article and counting in
 * twenties. German's cover German grammar, Flensburg, and facts about the
 * country. Casey's wording is localized in `src/i18n/target-tips.ts`.
 * Country-fact sources:
 * https://en.wikipedia.org/wiki/Germany (16 states, nine neighbours)
 * https://en.wikipedia.org/wiki/States_of_Germany (the three city-states)
 * https://en.wikipedia.org/wiki/Flensburg (city centre near Denmark's border)
 * https://en.wikipedia.org/wiki/Zugspitze (Germany's highest mountain)
 * https://en.wikipedia.org/wiki/Schult%C3%BCte (school-cone custom)
 */
export const germanCopy: TargetCopy = {
  welcome: 'Willkommen in',
  journeyOver: 'Die Reise ist zu Ende',
  answerPlaceholder: 'deutsch…',
  tips: [
    'German nouns come in threes: learn «das Haus», never just «Haus».',
    'Every German noun is written with a capital letter, wherever it stands in the sentence.',
    'der and das both take «ein». Only die words take «eine», so «ein» hides a difference «der» shows.',
    'Some verbs split: «aufstehen» becomes «Ich stehe um sieben auf». The small word waits at the end.',
    'ä, ö, ü and ß are German letters. On a keyboard without them, ae, oe, ue and ss are real spellings, not workarounds.',
    'Flensburg, our first stop, is just a few kilometres from the Danish border.',
    'Germany has 16 federal states. Berlin, Hamburg and Bremen are states as well as cities!',
    'Germany borders nine countries, including Denmark, Poland and France.',
    'On their first day of school, many German children get a Schultüte: a cone full of treats.',
    'Germany’s highest mountain, the Zugspitze, rises in the Alps near the Austrian border.',
  ],
}
