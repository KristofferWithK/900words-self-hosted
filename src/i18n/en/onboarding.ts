/**
 * The first-run flow: the language act, the ticket, Casey before the walk, the
 * practice round and the suitcase tour. Phase 1c fills the rest of this file;
 * the language act's own strings are Phase 1a's, because the act is what 1a
 * builds.
 */
export const onboarding = {
  courseText: (course: string) => {
    const german = course === 'de'
    return {
      languageName: german ? 'German' : 'Danish',
      countryName: german ? 'Germany' : 'Denmark',
      welcome: 'Did you know that 900 words can cover over 80% of daily speech in most languages?',
      clueField: german
        ? 'When it is your turn, type one German word here that connects two or three of your green words.'
        : 'When it is your turn, type one Danish word here that connects two or three of your green words.',
      dictionary: german
        ? 'If you need a German word, look it up right here. The Dictionary closes once your clue is sent.'
        : 'If you need a Danish word you do not have, look it up right here. The Dictionary closes once your clue is sent.',
      tutorialHint: 'Use the Dictionary to translate your idea.',
      practiceIntro: (clue: string, number: number) =>
        `My clue is «${clue}» for ${number}. What words on this board connect with it? Tap ⓘ whenever a translation would help.`,
      practiceRationaleTime: 'A clock tells the time. A month and a week are units of time.',
      practiceRationaleTimeRecovery: 'This repeats the time connection for whichever time words remain.',
      lastGreen: german
        ? 'One of your greens is still left. I can’t see it, so give me one German clue for that final card.'
        : 'One of your greens is still left. I can’t see it, so give me one Danish clue for that final card.',
      yourTurn: german
        ? 'That’s the end of my turn. Now it’s your turn. Give me a German clue that connects 2 or 3 green cards on your side. I can’t see them, just as you can’t see my key.'
        : 'That’s the end of my turn. Now it’s your turn. Give me a Danish clue that connects 2 or 3 green cards on your side. I can’t see them, just as you can’t see my key.',
    }
  },
  /** The language act. Shown in the DEVICE's language, before any choice. */
  languageEyebrow: 'Welcome aboard',
  languageHeading: 'Which language do you speak?',
  languageHint: 'Tap your language.',
  languageAria: (endonym: string) => `Use 900words in ${endonym}`,

  // ── The ticket: which language do you want to LEARN ──────────────────────
  /** Leaves the whole intro, from the ticket and from every tour. */
  skip: 'Skip',
  ticketEyebrow: 'Choose your journey',
  ticketHeading: 'Which language do you want to learn?',
  ticketAria: (country: string, language: string) => `Travel ${country}, learn ${language}`,
  /** Above the country's name on the ticket. */
  ticketLearnIn: 'Learn in',
  ticketMeta: (words: number, cities: number) => `${words} words · ${cities} cities`,
  ticketHintMany: 'Tap a ticket to choose.',
  ticketHintOne: 'Tap your ticket and we’re off.',
  /** Over a course that is not playable yet: France, the UK (src/lang/upcoming.ts). */
  ticketComingSoon: 'Coming soon',

  // ── Casey before the first walk, and the first walk’s end (CW-13) ──
  introTwoGames: 'Flashcards are boring, so we play two games instead: sightseeing to collect words, and a word puzzle in a café.',
  introExplore: (city: string) => `Let’s explore ${city} and see if we can find a café.`,
  introGo: 'Let’s go',
  walkEndFound: 'Go sightseeing again, or head home and play the café we found.',
  walkEndNotFound: 'Go sightseeing again to look for a café, or head home.',

  // ── The coach marks, on the live screens ────────────────────────────────
  tourNext: 'Next',
  /** The last coach mark's button, where Next would otherwise stand. */
  tourDone: 'On we go',
  tourLoose: 'Words we have met wait up here. Each ring fills a third for every mark: a photo while sightseeing, a guess from my clue, and a clue of your own.',
  tourLid: 'Three marks and a word is collected. Collected words go into the case, and this line counts them.',
  tourTray: 'This is the city’s stamp card. Every café you play gets its stamp here. A dashed circle is a café found but not played yet, and a ? is a café still to find.',
  // Retained as historical tour entry points. The current first-run flow no
  // longer mounts them, but they must never revive the retired wrap-up rules.
  mapTourHere: (city: string, _words: number) =>
    `This is ${city}, where we are. Board results build your city readiness.`,
  mapTourNext: (next: string, _words: number, city: string) =>
    `${next} is farther along the route. Keep improving ${city}'s boards. The next stop is closed for now.`,
  homeTourArrival: (city: string, _words: number) =>
    `We have arrived in ${city} for your first boards.`,
  homeTourMap:
    'This is our map. It shows where we are now and the cities waiting farther along the route.',
  homeTourSuitcase:
    'Tap me whenever you want to open the suitcase. It keeps your word collection and Casey’s board collection together.',
  homeTourGuide:
    'The Travel Guide keeps grammar, practical Danish, and earlier-city practice together. You can read ahead without moving the train.',
  // ── The intro game's four-beat guided tour (2026-09-18) ──────────────────
  /** Beat 1: the player's green frames, on their first practice clue turn. */
  introGameTourKey:
    'The green frames are your secret words. I never see them, just as you never see mine. Every guess is judged against whoever gave the clue.',
  /** Beat 2: the composer's clue field. */
  introGameTourClueField:
    'When it is your turn, type one Danish word here that connects two or three of your green words.',
  /** Beat 3: the dictionary beside the composer. */
  introGameTourDictionary:
    'If you need a Danish word you do not have, look it up right here. The dictionary closes once your clue is sent.',
  /** Beat 4: the number stepper. */
  introGameTourStepper:
    'This number says how many words your clue names. Raise it when one connection really covers more of your greens.',
  // ── The translation lesson, on the live controls after Translation time ──
  /** The suitcase lids of words still waiting for a translation. */
  translationTourBoard:
    'These suitcase lids show the meanings of the words we found. Pick one in your head. You do not need to tap a suitcase first.',
  /** The answer field and its tick; the course language is named. */
  translationTourInput: (language: string) =>
    `Type its ${language} word here, then tap the tick. A wrong answer costs nothing, so just try again.`,
  /** The wheel, while it still has empty segments. */
  translationTourWheel:
    'Each correct answer adds a green segment. You can spin any time, but landing on an empty segment loses the round. Fill the wheel and any spin wins.',
  /** The one-beat lesson on a full wheel, before the spin. */
  wheelReadyTour:
    'The wheel is all green now, so this spin wins. Tap the wheel to spin.',

  // ── The first full board's result, read from its saved receipt ──────────
  /** Rewards this board earned for the first time. */
  resultTourRewardNew: (rewards: string) => `New this time: ${rewards}.`,
  /** Rewards the board had already earned, which are not paid twice. */
  resultTourRewardHeld: (rewards: string) =>
    `Already earned before, so not counted again: ${rewards}.`,
  resultTourWinTier: (tier: string, best: string) =>
    `This puzzle earned ${tier}. The café’s best stamp so far is ${best}.`,
  /**
   * A completed loss earns a Bronze stamp (owner, 2026-10-04). `best` is the
   * café's stamp after the round: its won best, or Bronze (`cafeStamp`).
   */
  resultTourLossTier: (best: string) =>
    `This puzzle was lost. A lost puzzle still earns a Bronze stamp. A won one earns Silver, Gold or Platinum. This café’s best so far is ${best}.`,
  resultTourCityPercent: (city: string) =>
    `Every café stamp counts toward ${city}’s city stamp. The percentage is all your café stamps together: better stamps raise it. Bronze at 25%, Silver at 50%, Gold at 75%, Platinum at 100%.`,
  resultTourNoBestYet: 'not set yet',
  resultTourSentence:
    'This is an optional review. It shows a word from this board in a sentence. It is not another test.',
  resultTourNoReview:
    'There is no sentence to review this time. That is fine. Review is always optional.',

  // ── Back on Home after the first full board ──────────────────────────────
  homeTourSightseeing: 'Sightseeing is what we just did. Every sightseeing trip collects words, and more sightseeing finds more cafés.',
  homeTourCafe: (name: string | null) =>
    name ? `Our first café is ${name}. Tap Café puzzle to sit down and play it.` : 'Our first café is waiting. Tap Café puzzle to sit down and play it.',
  homeTourStamp: 'This is the city stamp. Its percentage is all your café stamps together, and a better stamp counts more. Play a café again for a better stamp, and it goes up.',
  homeTourCollection: 'Tap me to open the suitcase. Inside are our words and the café’s stamp.',

  // ── The practice round: Casey's authored rationales ─────────────────────
  practiceRationaleDrink: 'Water, coffee and milk are all things you drink.',
  practiceRationaleHome: 'A house is a home.',
  practiceRationaleRecovery:
    'This repeats the concrete drink connection for whichever drink cards remain.',

  // ── The practice round: Casey's running commentary ──────────────────────
  practiceIntro:
    'My clue is «drikke» for 3. What words on this board connect with it? Tap ⓘ whenever a translation would help.',
  guessGreenMore: (word: string) =>
    `«${word}» is green on my key. Keep guessing, or stop while we’re ahead.`,
  guessGreenEnd: (word: string) => `«${word}» is green on my key. That ends my clue.`,
  /** The same, plus the reason no green frames have appeared yet. */
  guessGreenEndMine: (word: string) =>
    `«${word}» is green on my key. That ends my clue. Your greens will appear when it is your turn. This clue used my key.`,
  guessYoursNotMine: (word: string) =>
    `«${word}» is one of your greens, but it is not green on my key. This clue uses my key, so the card is still there for yours.`,
  guessMiss: (word: string) => `«${word}» is not green on my key, so that ends my clue.`,
  guessMissMine: (word: string) =>
    `«${word}» is not green on my key, so that ends my clue. Your greens will appear when it is your turn. This clue used my key.`,
  firstClue: (clue: string) =>
    `Welcome to the café! This first table is a short practice. What words on this board can you connect with «${clue}»? Tap the ⓘ on a word to see its translation, then tap a word and confirm it.`,
  clueFor: (clue: string, number: number) =>
    `My clue is «${clue}» for ${number}. Tap any word it makes you think of.`,
  lastGreenLeft:
    'One of your greens is still left. I can’t see it, so give me one Danish clue for that final card.',
  yourTurn:
    'That’s the end of my turn. Now it’s your turn. Give me a Danish clue that connects 2 or 3 green cards on your side. I can’t see them, just as you can’t see my key.',
  yourFirstClue: (clue: string, number: number, tokens: number) =>
    `Your clue is «${clue}» for ${number}. The ${tokens} dots at the top are our shared round tokens. Every clue, yours or mine, uses one. I’ll think out loud below.`,
  yourClue: (clue: string, number: number) =>
    `Your clue is «${clue}» for ${number}. My guesses use your key now. I’ll think out loud below.`,
  practiceWon: 'Every green found. We won! The café puzzles won’t be this easy, but every word we meet still counts.',
  practiceLost: 'That round got away from us, but every word we met still counts.',
  findingAClue: 'My turn. I’m finding a clue.',
  practiceTranslation:
    'Solved the board! Translation time: each Danish answer fills a wheel segment. You can spin now, but a full wheel guarantees green. A solved board can still reach Platinum here.',
  practiceWheelReady:
    'The wheel is full. Spin it to land green. On normal boards, this is how your result can reach Platinum.',
  practiceFinish:
    'Practice complete. This table earns no stamp. In a café puzzle, solving, translating and the spin earn the café its stamp. You can replay a café to improve its stamp.',
  // ── The website demo (900words.app/play/): its end card and resting state ──
  demoEndTitle: "That was your first full board.",
  demoEndLine: "In the app, I keep playing with you, board after board, and I keep every word you collect.",
  demoAppStore: "Get 900words on the App Store",
  demoAppStoreSoon: "900words is coming to the App Store soon.",
  demoPlayAgain: "Play again",
  demoRestingTitle: "Casey is resting",
  demoRestingBody: "Lots of people played with me today, so I need a rest. Come back tomorrow, or play with me in the app.",
  demoCheckFailed: "We could not check that you are a person. Please reload the page and try again.",
  playFullRound: 'Play the café puzzle',
}
