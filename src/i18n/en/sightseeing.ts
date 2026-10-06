/**
 * Sightseeing: the running game (café world, docs/roadmap/cafe-world.md §2).
 * Casey runs down a street; a tag shows a word in the player's language and
 * three suitcases show words in the learner language. Each right answer is a
 * photo. Where the course has articles, every seventh gate is an article gate
 * (its own lines below).
 *
 * The bar's three small labels (photosLabel, bestLabel, askLabel) are drawn in
 * capitals on the run's canvas, so write them in ordinary case here.
 */
export const sightseeing = {
  /** The game's name, on its first panel and as the screen's accessible name. */
  title: 'Sightseeing',
  rules: 'One wrong word is forgiven. The second ends the run.',
  steerHint: 'Swipe or tap left and right to steer.',
  start: 'Start sightseeing',
  /** The run-end tag that starts another run of the same walk. */
  sightseeingAgain: 'More sightseeing',
  /** The small round button during a run. */
  pauseAria: 'Pause',
  paused: 'Paused',
  resume: 'Keep sightseeing',
  // ── the bar at the top of the run ────────────────────────────────────────
  photosLabel: 'Photos',
  bestLabel: 'Best',
  /** Over the word on the tag: "WHICH ONE MEANS / house". */
  askLabel: 'Which one means',
  /** The pill in the bar: the forgiven wrong words still left. */
  slipsLeft: (n: number) => (n === 0 ? 'no slips left' : n === 1 ? '1 slip left' : `${n} slips left`),
  faster: 'Faster!',
  /** A word and its meaning side by side: "house = hus". The same in every language. */
  pair: (prompt: string, target: string) => `${prompt} = ${target}`,
  /** A verb's meaning on the tag. English adds "to"; most languages show the gloss as it is. */
  verbPrompt: (gloss: string) => `to ${gloss}`,
  // ── when the run ends ────────────────────────────────────────────────────
  wrongWord: 'Wrong word',
  /** Under the right answer: what the player steered into. */
  youPicked: (target: string, prompt: string) => `You picked ${target} (${prompt}).`,
  photosTotal: (photos: number) => (photos === 1 ? '1 photo' : `${photos} photos`),
  bestTotal: (best: number) => `Best ${best}`,
  newBest: 'New best!',
  comingBack: 'These come back more often:',
  /** Read out for a screen reader when a gate's words become readable. */
  gateAria: (prompt: string, choices: string) => `Which one means ${prompt}? ${choices}`,
  // ── article gates (CW-06; part of the walk since 2026-10-05): the noun is
  // on the tag, the suitcases are its possible articles, each always in its
  // own lane ───────────────────────────────────────────────────────────────
  /**
   * Over the noun in the bar: the articles to choose from, as a question
   * ("en or et?", "der, die or das?"). `others` is every article but the
   * last, joined with ", " ("der, die"); `last` is the last ("das"). Drawn in capitals.
   */
  articleAsk: (others: string, last: string) => `${others} or ${last}?`,
  /** The title when a walk ends on a wrong article. The prototype's Article Crossroads said "Wrong way". */
  wrongArticle: 'Wrong way',
  /** Read out for a screen reader when an article gate comes near. */
  articleGateAria: (noun: string, choices: string) => `Which article goes with ${noun}? ${choices}`,
  // ── Catch the train (CW-07): every word of the city, each once. Slips come
  // from collected words; the run is the only way onto the train ─────────────
  /** The train run's name: on its first panel and on the train sheet. */
  trainTitle: 'Catch the train',
  /** Where the train goes: "Sønderborg to Ribe". City names come from the route. */
  trainRoute: (from: string, to: string) => `${from} to ${to}`,
  /** The run's rule in one plain line, on its first panel and on the train sheet. */
  trainRule: 'Every word of the city, once each. Each slip forgives a wrong word. One more ends the run.',
  /** On the first panel: the words this run asks and the slips it allows. */
  trainCount: (words: number, slips: number) => `${words} words, ${slips === 1 ? '1 slip' : `${slips} slips`}.`,
  trainStart: 'Run for the train',
  /** The bar's two small labels on the train run: words answered, and words still to go. Drawn in capitals. */
  wordsLabel: 'Words',
  toGoLabel: 'To go',
  /** The title when a train run ends on one wrong word more than its slips. */
  trainMissed: 'Missed the train',
  /** How far the run got: "52 of 147 words". */
  trainProgress: (answered: number, total: number) => `${answered} of ${total} words`,
  trainAgain: 'Run again',
  /** The title when every word of the city is answered. */
  caughtTitle: 'You caught the train!',
  /** Under the ticket: the run's numbers. */
  caughtSummary: (words: number, slips: number) =>
    slips === 0
      ? `${words} words, no slips. Here is your ticket.`
      : slips === 1
        ? `${words} words, one slip. Here is your ticket.`
        : `${words} words, ${slips} slips. Here is your ticket.`,
  /** The word printed across the top of the ticket. */
  ticketLabel: 'Ticket',
  /** On the ticket: the day the train was caught, already written as a date. */
  ticketDate: (date: string) => `Caught on ${date}`,
  /** From the ticket to the next screen. */
  next: 'Next',
  /** After the ticket, while the next city is not released yet (owner O3). */
  opensSoonTitle: (city: string) => `${city} opens soon`,
  opensSoonBody: (city: string) => `Your ticket is kept. When ${city} opens, it takes you there.`,
  // ── the train sheet: opened from Home's "Catch the train" tag ─────────────
  sheetSlips: (slips: number) => `Slips: ${slips}`,
  /** The slip rule, read off the train in the train sheet: `per` is the words one wagon holds (20). */
  sheetSlipsHint: (per: number) => `The engine is your first slip. Each wagon holds ${per} words, and a full one gives one more.`,
  /** Under the train in the train sheet while a wagon is still filling: words to the next full wagon. */
  sheetNextSlip: (words: number) => (words === 1 ? 'Next slip in 1 word.' : `Next slip in ${words} words.`),
  /** Under the train once every wagon is full. `rest` is the city's words past the last wagon, which add no slip (7 in Sønderborg). */
  sheetSlipsAll: (rest: number) => (rest === 0 ? 'Every wagon is full.' : rest === 1 ? 'Every wagon is full. The last word adds no slip.' : `Every wagon is full. The last ${rest} words add no slip.`),
  /** On the "Catch the train" tag: the run's size and its slips. */
  sheetCatchLine: (words: number, slips: number) => `${words} words to run, ${slips === 1 ? '1 slip' : `${slips} slips`} allowed.`,
  sheetTicketTitle: 'Your ticket',
  sheetTicketHint: (city: string) => `Kept for ${city}. You can board when ${city} opens.`,
  /** The train strip's accessible name on Home and the map while the train is not boardable: the city's collected words. */
  trainStripLabel: (collected: number, total: number, slips: number) => `${collected} of ${total} words collected, ${slips === 1 ? '1 slip' : `${slips} slips`}. The train run takes you on.`,
  // ── a café found on a walk (contract §5 and §7): on the first session's
  // walk the run holds on a panel until the player carries on with "Keep
  // walking" (`resume`); every other walk keeps walking ─────────────────────
  /** The panel's title when a photo finds a café. The café's own name follows it, on its own line. */
  cafeFoundTitle: 'You found a café.',
  /** Under the café's name on that panel. */
  cafeFoundLater: 'You can play it later from home.',
  /** Written on the café on the road when it has no name of its own (a course without café names). */
  cafeSign: 'Café',
  /**
   * On the run-end panel of a walk that found cafés without stopping (every
   * walk but the first session's): the café's own name when it found one
   * that has a name ("Café found: Café Solen"), otherwise how many ("Cafés
   * found: 2"). The name is a Danish proper name, never translated.
   */
  cafesFound: (count: number, name: string | null) => (name ? `Café found: ${name}` : `Cafés found: ${count}`),
}
