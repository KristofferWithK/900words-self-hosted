/**
 * Casey's own voice: her tips, her beats, the way she explains a call, and the
 * connection screen. Phase 1e fills this file.
 *
 * Casey is SHE in every language (UL12). The English here is the corrected
 * English — older lines said "his", and a string moving into this file is
 * corrected as it moves.
 *
 * Her lines sit in a speech bubble measured at 360x640, so they are short.
 * Warm, direct, never a manual.
 *
 * A few values here carry a LEADING OR TRAILING SPACE on purpose: they are the
 * halves of a sentence that wraps a <strong> or a <code>, and the JSX around
 * them adds no whitespace of its own so that Chinese can close the gap the
 * European languages need. Each one says so at its key.
 */
export const casey = {
  // ── Home: the rotating tips (cluey-tips.ts) ──────────────────────────────
  // CRITICAL_TIPS, in priority order: the four a new player must not wait a
  // fortnight of rotation for. The array's order and length are pinned by
  // cluey-tips.test.ts.
  tipCaseyKeyCounts: "While you guess, it is Casey's greens that count. Her key, not yours.",
  tipCollectBothWays: 'Collect a word by cluing it AND guessing it: one green each way.',
  tipWrapToKeep: 'Collected words still break on the road. Wrap them up to keep them.',
  tipEarnWrapUp:
    'Three won rounds earn a wrap-up round. Bank up to three, and spend one when you have plenty collected. It packs up to fifteen.',

  // RULE_TIPS: how the game works, interleaved with the pack's own language
  // tips. The two that name the language being learned take it as an argument,
  // because the pack supplies that name (`ACTIVE.name`) and each language puts
  // it in a different place in the sentence.
  tipTapCaseyForCase: 'Tap Casey to open the case. Every word you collect travels in here.',
  tipWrapUpCardsStartInEnglish: (language: string) =>
    `In a wrap-up round the cards start on their card face. Type the ${language} to pack them.`,
  tipWrapUpSkipAllowed:
    'Skipping a card in a wrap-up is allowed, but it cannot be wrapped that round.',
  tipLastChance: 'Out of clues is not out of game: last chance lets you keep naming words.',
  tipLookUpMidRound: (language: string) =>
    `Look a word up mid-round from the clue box. Your language in, the ${language} words out.`,
  tipWrapCityOpensRoad: 'Wrap all hundred words of a city and the road onward opens.',

  /**
   * The word of the day. `word` arrives with its Danish article already on it
   * ("et hus") and `meaning` is the gloss — both are content, not chrome, so
   * only the frame around them is here.
   */
  wordOfTheDay: (word: string, meaning: string) => `Word of the day: ${word} (${meaning}).`,

  // Lines about the player's own play (casey-personal.ts). `word` arrives in
  // the language being learned, with its article where it has one; `meaning`
  // is its gloss. Counts are written «3×» so no language needs a plural rule.
  personalTrickyWord: (word: string, meaning: string, misses: number) =>
    `A word to watch: ${word} (${meaning}). It has tripped you up ${misses}×.`,
  personalBestWord: (word: string, meaning: string, greens: number) =>
    `You really know ${word} (${meaning}). Green ${greens}× already.`,
  personalCluedTogether: (a: string, b: string, times: number) =>
    `You and I click on ${a} and ${b}. Your clues found them together ${times}×.`,
  personalFavouriteClue: (clue: string, times: number) =>
    `Your go-to clue is «${clue}». You have given it ${times}×.`,
  personalGames: (played: number, won: number) => `Our games together: ${played}. Our wins: ${won}.`,

  // ── Casey on Home (components/Cluey.tsx) ─────────────────────────────────
  /** The bubble when a key of the player's own has never produced a reply. */
  notAnsweredBubble: 'I have not answered yet. Tap here to test the connection →',
  notAnsweredAria: 'Casey has not answered yet. Open Settings and test the connection',
  /** The bubble's own label; `line` is whatever she is saying right now. */
  bubbleAria: (line: string) => `Casey says: ${line} Tap for another tip.`,
  suitcaseAria: 'Open the suitcase: your collection',

  // ── How she explains a call (caseyJustification.ts) ──────────────────────
  // The rationale itself comes back from the model and is English until Phase
  // 4; only these fixed frames are here.
  /** When there is still a guess queued but no reasoning for it. */
  lookingAgain: 'Let me look at the board again.',
  /** When she has stopped, and has nothing more to say about why. */
  asFarAsIDare: 'That is as far as I dare go.',
  /** `reasoning` is her own sentence; `word` is the Danish card she nearly took. */
  withSecondChoice: (reasoning: string, word: string) =>
    `${reasoning} My second choice would have been ${word}.`,
}
