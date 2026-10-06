/**
 * Home, the map, the suitcase and the packing dock — everything outside a
 * round. Phase 1c fills this file.
 *
 * The first-run flow is NOT here: the ticket, Casey's staged Home, the
 * practice round, the suitcase tour and the rules card live in `onboarding`.
 */
export const home = {
  brandName: '900words',
  // ── Home ────────────────────────────────────────────────────────────────
  settingsAria: 'Settings',
  openMapAria: 'Open the map',
  /** The small route map's accessible name. */
  homeMapAria: (stop: number, stops: number, city: string) => `Stop ${stop} of ${stops}: ${city}`,
  /** On both Home and the map: the door to the pass screen. */
  needsPass: 'Next train needs a travel pass',
  /** The bold wrapped count is drawn before this word: "12 wrapped · 5 collected". */
  wrappedWord: 'wrapped',
  collectedCount: (collected: number) => `${collected} collected`,
  /** Follows the pack's own Danish closing line: "‹dansk› — you packed …". */
  journeyDone: (city: string) => `You packed the last suitcase in ${city}.`,
  momentumLine: 'Play 3 boards a day and you can collect every word in 90 days.',
  /** `outcome` is the stored 'won'/'lost' of today's daily board. */
  dailyPlayedAria: (outcome: string) => `Daily challenge: played today (${outcome})`,
  dailyAria: 'Daily challenge: one shared board per date',
  play: 'Play',
  // ── a preview language: route and Guide, no boards ───────────────────────
  previewHeading: 'No word game yet',
  previewNote:
    'The map and the Travel Guide are here. The boards, the clues and the audio are not built yet.',
  previewGuideCta: 'Open the Travel Guide',
  continueGame: 'Continue game',
  /** Also the suitcase's button once a wrap-up round is waiting. */
  continueWrapUp: 'Continue wrap-up',
  continueReview: 'Continue review',
  continuePrimary: 'Continue board',
  continueReplay: 'Continue replay',
  returnToPrimary: 'Return to your board',
  viewResult: 'View result',
  improveBoards: 'Improve your boards',
  postcardsEarned: 'postcards earned',
  postcardsRemaining: (remaining: number) => `${remaining} postcard${remaining === 1 ? '' : 's'} to travel`,
  postcardReadiness: (earned: number, remaining: number) => `${earned} postcards earned; ${remaining} to travel.`,
  readyToTravel: 'Ready to travel',
  nextStopNotReleased: (city: string) => `Ready to travel. ${city} is not released yet.`,
  cityMedalInProgress: 'not earned yet',
  cityMedal: (tier: string) => `City stamp: ${tier}`,
  /** The maintenance notice's way out, back to the city you are standing in. */
  backToCity: (city: string) => `Back to ${city}`,

  // ── The map ─────────────────────────────────────────────────────────────
  back: 'Back',
  journeyTitle: 'The journey',
  mapAria: (country: string, stop: number, stops: number, city: string) =>
    `Map of ${country}. Stop ${stop} of ${stops}: ${city}.`,
  /** `status` is one of the four status words below. */
  stopAria: (city: string, stop: number, status: string) => `${city}, stop ${stop}, ${status}`,
  statusVisited: 'visited',
  statusHere: 'you are here',
  statusNotReached: 'not reached yet',
  statusAhead: 'ahead',
  stopOf: (stop: number, stops: number) => `Stop ${stop} of ${stops}`,
  arrivedOn: (date: string) => `arrived ${date}`,
  previousStopAria: 'Previous stop',
  nextStopAria: 'Next stop',
  wordsWaiting: (words: number, city: string) =>
    `${words} words waiting. Reach ${city} to unlock them.`,
  lookAhead: 'Look ahead',
  travelAhead: 'Travel ahead',
  enableTravelAhead: 'Enable Travel ahead',
  /** The bold wrapped count is drawn before this: "12 / 100 wrapped · 5 …". */
  mapCounts: (goal: number, collected: number, discovered: number) =>
    `/ ${goal} wrapped · ${collected} collected · ${discovered} discovered`,
  suitcasePacked: 'suitcase packed',
  lineClosedNote: 'Line closed for maintenance. Tap the train for the notice.',
  travelBackTo: (city: string) => `Travel back → ${city}`,
  travelOnTo: (city: string) => `Travel on → ${city}`,
  trainToClosed: (city: string) => `Train to ${city}: line closed`,
  getPassFor: (city: string) => `Get a travel pass for ${city}`,
  /** «Kort» is the Danish word on the map itself; only the credit translates. */
  mapCredit: 'Kort · map data: Geodatastyrelsen / DAGI (FOT), 1:500 000',
  backToTheMap: 'Back to the map',

  // ── The train, on both screens ──────────────────────────────────────────
  trainJourneyOver: 'The suitcase is packed. The journey is over.',
  trainReady: (city: string) => `The suitcase is packed. The train to ${city} is ready.`,
  wordsToFinish: (words: number) =>
    `You need ${words} more wrapped-up ${words === 1 ? 'word' : 'words'} to finish the journey.`,
  wordsToTrain: (words: number, city: string) =>
    `You need ${words} more wrapped-up ${words === 1 ? 'word' : 'words'} to take the train to ${city}.`,
  boardTrain: (city: string) => `Board the train to ${city}`,

  // ── Arriving ────────────────────────────────────────────────────────────
  arrivalAgain: (words: number) =>
    `Back again. Your ${words} words from here are still in the suitcase. Play them again, or travel on whenever you like.`,
  arrivalNew: (words: number) =>
    `${words} new words to discover. Casey is open and waiting for them.`,
  getStarted: 'Get started',
  seeTheMap: 'See the map',

  // ── The suitcase ────────────────────────────────────────────────────────
  suitcaseTitle: 'The suitcase',
  filterAria: 'Filter the suitcase by city',
  filterAll: 'All',
  /** `band` is the band's own label, "Collected — 7". */
  pagerPreviousAria: (band: string) => `${band}, previous page`,
  pagerNextAria: (band: string) => `${band}, next page`,
  looseLabel: (words: number) => `Still out there: ${words}`,
  looseEmpty: 'Nothing loose. Every word here is in the case.',
  lidEmpty: 'Three marks collect a word: a photo, a guess and a clue.',
  trayLabel: (words: number, goal: number) => `Wrapped: ${words} of ${goal}`,
  trayEmpty: 'Nothing packed in the tray yet. Wrap-up rounds put words here for good.',
  undiscoveredAria: 'Undiscovered word',
  wrapUpWords: 'Wrap up words',
  wrapUpBankedAria: (banked: number) => `Wrap up words: ${banked} banked`,
  postcardBalance: (banked: number) => `Postcards · ${banked}`,
  postcardHelp: 'Need the answer? Use a postcard.',
  packingAnswerShown: 'Answer shown. Press Pack.',
  packingNoPostcards: 'Win a normal round to earn a postcard.',
  packingFirstPostcardHint: (language: string) => `Type ${language} to pack. A postcard reveals it.`,
  packingPostcardTitle: (state: string, language: string) =>
    state === 'shown' ? 'Show this answer again for free.' : state === 'select' ? 'Select an unpacked card first.' : state === 'empty' ? 'Win a normal round to earn a translation postcard.' : `Spend one postcard to reveal this card’s ${language} answer.`,
  packingPostcardAria: (shown: boolean, banked: number) => shown ? 'Show translation again for free' : `Use translation postcard: ${banked} available`,
  packingPostcardShowAnswer: 'Show answer',
  usePostcard: 'Use postcard',
  wrapUpContinueAria: 'Continue the wrap-up round under way',
  hintWrapUpWaiting: 'A wrap-up round is already under way. Pick it up where you left it.',
  hintCollectFirst: (city: string) =>
    `Collect a word in ${city} first, one green each way, and a wrap-up round will have something to pack.`,
  hintFirstWrapUp: (wins: number) =>
    wins === 1
      ? 'Win 1 round to earn your first wrap-up round.'
      : `Win ${wins} rounds to earn your first wrap-up round.`,
  hintMoreWins: (wins: number) =>
    `Win ${wins} more ${wins === 1 ? 'round' : 'rounds'} to earn a wrap-up.`,
  hintPacksRange: (collected: number, city: string) =>
    `${collected} collected in ${city}. A wrap-up packs 13 to 15, depending on its key.`,
  hintPacksUpTo: (collected: number, city: string, cap: number) =>
    `${collected} collected in ${city}. The next wrap-up can pack up to ${cap}, depending on its key.`,

  // ── The packing dock, at the top of a wrap-up round ──────────────────────
  packWord: (word: string) => `Pack «${word}»`,
  packTheBoard: 'Pack the board',
  /** Rides the dock title: "Pack the board — 3 of 12". */
  packCount: (packed: number, packable: number) => `(${packed} of ${packable})`,
  startEarlyWarning: (remaining: number) =>
    `Start with ${remaining} unpacked. They stay English and cannot be wrapped this round`,
  startEarly: (remaining: number) => `Start with ${remaining}`,
  tapEnglishCard: 'Tap an English card',
  /** `language` is the language being learned, as its pack names it. */
  theWordFor: (language: string, word: string) => `The ${language} for ${word}`,
  tapEnglishCardFirst: 'Tap an English card first',
  pack: 'Pack',
  packMiss: 'Not it. That miss is remembered. Keep trying.',
  packFirstTime: 'Type Danish to pack. Start early leaves cards English and unwrapped.',
  packRecall: 'The dictionary is shut. This is the recall.',
  packTapAndType: (language: string) => `Tap an English card and type its ${language}.`,

  // ── The travel pass ─────────────────────────────────────────────────────
  passBackAria: 'Back to map',
  passTitle: 'Next trains',
  passKicker: 'Your first two cities are free.',
  passHeading: 'A travel pass for the rest of Denmark',
  passIntro:
    'Unfortunately, public transport is not free in Denmark. If you want to board the next trains, you need a travel pass.',
  passOptionsAria: 'Travel pass options',
  passMonthly: 'Monthly travel pass',
  passMonthlyHelp: 'Keep travelling while your travel pass is active.',
  passLifetime: 'Lifetime travel pass',
  passLifetimeHelp: 'One travel pass for every journey we ship.',
  passReady: 'Your travel pass is ready. The next train is open.',
  passRestore: 'Restore purchases',
  passRedeem: 'Redeem an App Store code',
  passKindness: 'Learning should not depend on money.',
  /**
   * One sentence around the owner's address:
   * "Write a review in the App Store, take a picture of it, and send it to
   * ⟨address⟩ to get a 6-month travel pass code. Your review can be good or
   * bad, depending on how you like the app."
   */
  passReviewBefore: 'Write a review in the App Store, take a picture of it, and send it to',
  passReviewAfter:
    'to get a 6-month travel pass code. Your review can be good or bad, depending on how you like the app.',

  // ── Daily games upgrade ──────────────────────────────────────────────────
  /** When today's counts cannot be read: no claim about today, only what free play is. */
  dailyLimitKicker: 'Free play is two sightseeing trips and two café puzzles a day.',
  /** Which of today's free limits was reached (CW-15): two walks, two café puzzles, or both. */
  dailyLimitRunsKicker: 'You’ve been sightseeing twice today.',
  dailyLimitPuzzlesKicker: 'You’ve played two café puzzles today.',
  dailyLimitBothKicker: 'You’ve been sightseeing twice and played two café puzzles today.',
  /** After one limit only: how many of the other kind are still free today. */
  dailyLimitPuzzlesLeft: (n: number) => (n === 1 ? 'You can still play 1 café puzzle today.' : `You can still play ${n} café puzzles today.`),
  dailyLimitRunsLeft: (n: number) => (n === 1 ? 'You can still go sightseeing once today.' : `You can still go sightseeing ${n} times today.`),
  dailyLimitHeading: 'Keep playing with Casey',
  dailyLimitBody: 'Come back tomorrow for more, or unlock unlimited sightseeing and café puzzles.',
  dailyLimitOptionsAria: 'Unlimited play options',
  dailyLimitMonthly: 'Monthly',
  dailyLimitMonthlyHelp: 'Auto-renews each month until cancelled.',
  dailyLimitLifetime: 'One-time',
  dailyLimitLifetimeHelp: 'Unlimited play, no subscription.',
  dailyLimitUnavailable: 'Unavailable',
  dailyLimitCloseAria: 'Close upgrade dialog',
  dailyLimitRestore: 'Restore purchases',
  dailyLimitDismiss: 'Maybe tomorrow',
  dailyLimitDisclosure: 'Prices and purchase confirmation come from Apple. Manage or cancel a subscription in your Apple Account.',
  dailyLimitDisclosurePlay: 'Prices and purchase confirmation come from Google Play. Manage or cancel a subscription in the Play Store app.',
  /** Link labels under every purchase offer; App Review guideline 3.1.2 wants both. */
  purchaseTerms: 'Terms of Use',
  purchasePrivacy: 'Privacy Policy',
  passThanksHeading: 'Thank you for supporting the 900words development',
  passThanksBody: 'Unlimited play is unlocked.',
  passThanksContinue: 'Keep playing',

  // ── The optional language stop ──────────────────────────────────────────
  stopKicker: 'Optional language stop',
  stopKindGrammar: 'Grammar practice',
  stopKindSituation: 'A small situation',
  stopKindExit: 'Optional readiness check',
  stopKindReview: 'Due review',
  stopFocus: 'Your next language focus',
  stopNote:
    'This stop is saved separately from your suitcase. It never changes which words you can pack or whether the train can leave.',
  stopAuthoring:
    'Danish prompts and scoring are being authored with the course content. Save it for later, or leave it in your guide; no placeholder attempt is recorded as learning evidence.',
  stopContinue: 'Continue',
  stopLater: 'Later',
  stopSkip: 'Skip this stop',
  stopStart: 'Start',
  stopOpen: 'Language stop',

  // ── the closed line (src/journey/trainService.ts) ────────────────────────
  //
  // CROSSING: the pipeline lane's "City 1 generalisation" task rewrites these
  // same three, to stop hard-coding one city. Sequence the two changes.
  trainClosedLabel: (city: string) =>
    `The train to ${city} is not running yet. The line is closed for maintenance`,
  trainClosedTitle: 'The line is closed for maintenance',
  trainClosedBody: (city: string, here: string) =>
    `The train to ${city} isn’t running just yet. There’s work on the line. ` +
    `It will run again soon, and we’ll let you know here the moment it does. ` +
    `Until then ${here} is all yours: every board, every wrap-up, and your streak.`,
  trainReopenedTitle: (city: string) => `The train to ${city} is running again`,
  trainReopenedBody:
    'The line is open. Your suitcase is packed and Casey is on the platform. Board whenever you like.',
  // ── café world Home (CW-10): two tags, the ticket, the stamp ─────────────
  /** The tag that starts the board game, in place of Play. */
  cafePuzzle: 'Café puzzle',
  /** Under "Sightseeing" on Home's second tag. Lower case, as a note. */
  sightseeingNote: 'find new cafés',
  /** The train sheet's title. */
  trainSheetTitle: (city: string) => `The train to ${city}`,
  /** Under the title: the city's words, the length of the train run. */
  trainSheetWords: (city: string, total: number, board: number, connecting: number) =>
    connecting > 0 ? `${city}: ${total} words (${board} on the boards, ${connecting} connecting)` : `${city}: ${total} words`,
  trainSheetCollected: (collected: number, total: number) => `Collected: ${collected} of ${total}`,
  trainSheetRule: 'The run is the only way onto the train.',
  /** Read out for the stamp on Home, before the city stamp line. `percent` is already formatted. */
  cityStampAria: (city: string, percent: string) => `${city}: ${percent} of the café stamps.`,
  /** Written inside Home's empty stamp circle while the city stamp has no tier yet. */
  stampNone: 'No stamp',
  /** The Café puzzle tag's note while no café is found yet (CW-04's rule). Lower case, as a note. */
  cafeNotFoundNote: 'find a café first',
  /** At the top of the Sightseeing sheet, when the Café puzzle tag sent the player there. */
  cafeNotFoundLine: 'Find a café in Sightseeing first.',
  // ── café world suitcase (CW-11): marks, the lid and the stamp card ───────
  // The lid's own label is `trainSheetCollected`: "Collected: n of N".
  /** Under the lid's label (S2): what fills a word's ring. */
  lidLegend: 'A third each for a photo, a guess and a clue',
  /** The three marks, named in a word tile's accessible name. Lower case. */
  markPhoto: 'photo',
  markGuess: 'guess',
  markClue: 'clue',
  /** A connecting word's marks: photos on different days (1 to 3). */
  markPhotoDays: (days: number) => (days === 1 ? 'a photo on 1 day' : `photos on ${days} days`),
  /**
   * A word tile's accessible name: "hus, 2 of 3: photo, guess". `marks` is
   * the marks already listed in the language's own list style, empty with none.
   */
  markAria: (word: string, earned: number, total: number, marks: string) =>
    marks ? `${word}, ${earned} of ${total}: ${marks}` : `${word}, ${earned} of ${total}`,
  /** The small heading over a connecting word opened from the suitcase. */
  connectingWord: 'Connecting word',
  connectingWordRule: 'It has no card. Photos on three different days collect it.',
  /** The board collection, now the city's stamp card. */
  stampCardTitle: (city: string) => `${city} stamp card`,
  /**
   * Under the title: "24% · Bronze at 25% · 7 of 100 cafés". `percent` is
   * already formatted; `goal` is `stampCardGoal`, or empty at Platinum.
   */
  stampCardLine: (percent: string, goal: string, stamped: number, cafes: number) =>
    [percent, goal, `${stamped} of ${cafes} cafés`].filter(Boolean).join(' · '),
  /** The city stamp's next tier and where it starts: "Bronze at 25%". */
  stampCardGoal: (tier: string, percent: string) => `${tier} at ${percent}`,
  /** A café's cell labels, under its stamp. */
  stampFound: 'Found',
  stampNotFound: 'Not found',
  /** A café with no name yet, for the screen reader. */
  stampCafeNumber: (place: number) => `Café ${place}`,
  /** A cell's accessible name. `stamp` is the stamp in words, "Gold stamp". */
  stampCellStamped: (cafe: string, stamp: string) => `${cafe}: ${stamp}`,
  stampCellFound: (cafe: string) => `${cafe}: found, not played yet`,
  stampCellNotFound: (place: number) => `Café ${place}: not found yet`,
  /** The line under the card's summary: the café the Café puzzle deals next. */
  stampNextCafe: (cafe: string) => `Next café: ${cafe}`,
  stampNextCafeUnfound: 'Find the next café in Sightseeing.',
  stampAllPlayed: 'Every café is played. Tap one to play it again.',
}
