/**
 * A round: the board, the clue dock, Casey's turn panel, the turn log, the
 * dictionary sheet and the finishing screen.
 *
 * THE SOURCE OF TRUTH for this section (UL4). Every key here exists in de, es
 * and zh or the build fails; every value there differs from the English or
 * gate 3 fails. Anything with a value in it is a function, and each language
 * writes its own word order and its own plural rule.
 *
 * Two things arrive as ARGUMENTS rather than as copy: a Danish word inside
 * «», and the name of the language being learned (`ACTIVE.name`). The second
 * is still the English word "Danish" in the pack itself — a later phase gives
 * it a per-language name, and these sentences are written so it drops in.
 */
export const game = {
  legacyRetiredTitle: "Your progress is safe",
  legacyRetiredBody: "An older round could not continue after this update. Your saved learning and postcards are kept. Continue with the next unfinished board.",
  // ── the phase caption, top of the board ───────────────────────────────────
  phaseGiveClue: 'Give Casey a clue',
  phaseCaseyGuessing: 'Casey is guessing',
  phaseCaseyClue: 'Casey prepares a clue',
  phaseYourGuess: 'Your turn to guess',
  phaseLastChance: 'Last chance: no clues left',
  phaseRoundOver: 'Round over',
  /** The wrap-up round's own phase: cards are face-up and being packed. */
  phasePackTheBoard: 'Pack the board',

  // ── what the live region says while Casey plays ───────────────────────────
  /** "Casey guessed hund — correct." The result word is the pair below. */
  announceCaseyGuess: (word: string, result: string) => `Casey guessed ${word}: ${result}.`,
  resultCorrect: 'correct',
  resultNeutral: 'neutral',
  announceCaseyThinking: 'Casey is thinking.',

  // ── the game header ───────────────────────────────────────────────────────
  skip: 'Skip',
  homeAria: 'Home',
  dealNewWordsAria: 'Deal new words',
  hideTranslationsAria: 'Hide translations',
  showTranslationsAria: 'Show every translation. Counts as looking up each unsolved word',

  // ── Casey could not be reached ────────────────────────────────────────────
  errorRetry: 'Retry',
  errorCaseySettings: 'Casey settings',
  practiceNote: 'Experimental agentless prototype. This is not Casey or normal play.',

  // ── the study phase ───────────────────────────────────────────────────────
  studyTitle: 'Study the board',
  studyHint: 'Every translation is shown. They hide when you start, and a tap looks one up.',
  studyStart: 'Start the round',

  // ── a card's accessible name, built from these pieces in this order ───────
  cardYourTarget: ', your target',
  cardFound: ', found',
  /** One of Casey's key words the round never found, shown on the wheel's board. */
  cardMissedKey: ", one of Casey's words, not found",
  cardNeutralBoth: ', neutral for both sides',
  cardNeutralPlayer: ', neutral under your clues',
  cardNeutralCasey: ", neutral under Casey's clues",
  cardUnpacked: ', unpacked',
  cardTranslationRevealed: ', translation revealed',
  cardNotYetPacked: (language: string) => `, not yet packed. Tap to type the ${language}`,
  cardNotYoursToWrap: ', not yours to wrap yet',
  cardTapToHear: '. Tap to hear',
  lookUpAria: (word: string) => `Look up ${word}`,

  // ── the composer ──────────────────────────────────────────────────────────
  cluePlaceholder: 'Your clue',
  clueFieldAria: (language: string) => `Your one-word clue, in ${language}`,
  fewerWordsAria: 'fewer words',
  moreWordsAria: 'more words',
  wordCountAria: (n: number) => (n === 1 ? '1 word' : `${n} words`),
  giveClue: 'Give clue',
  giveItAnyway: 'Give it anyway',
  askingCasey: 'Asking Casey…',
  firstClueHint: (language: string) =>
    `One ${language} word. Stuck? The Dictionary beside it translates.`,
  tutorialClueHint: 'I read clues in Danish. Unsure? Try it. The Dictionary can help.',
  wrapPlayerKeyHint: 'Your green border is back. It is your private key. Casey cannot see it.',
  looksEnglishFull: (word: string, language: string) =>
    `«${word}» looks like the meaning of a card word. Tap it for the ${language}, or give it anyway and Casey will check.`,
  looksEnglishShort: "looks like a card word's meaning. Tap it, or give it anyway",

  // ── the guess bar ─────────────────────────────────────────────────────────
  caseysClueLabel: "Casey's clue",
  lookUpInDictionaryAria: (word: string) => `Look up «${word}» in the dictionary`,
  guessesLeft: (n: number) => (n === 1 ? '1 guess left' : `${n} guesses left`),
  guessWord: (word: string) => `Guess «${word}»`,
  cancel: 'Cancel',
  stopKeepWhatWeHave: 'Stop and keep what we have',
  guessPrompt: 'Tap a word you think Casey means.',
  firstGuessHint: "Casey's key counts now. Tap a word her clue points at.",
  wrapCaseyKeyHint: "Casey's key is secret. Guess what her clue points at. Her greens count now.",
  tutorialLookupHint: 'Tap ⓘ beside a word to conveniently look up its translation.',

  // ── the last chance ───────────────────────────────────────────────────────
  suddenDeathRule: 'Name greens to win. Anything else ends it.',
  nameWord: (word: string) => `Name «${word}»`,
  giveUpRound: 'Give up the round',

  // ── the translation wheel (the last chance, tap-flow 2026-09-16) ──────────
  /**
   * The dock's ONE line (owner, 2026-09-16): the board is the prompt — the
   * suitcases on it carry the words — so the dock explains only the bargain:
   * the wheel decides the ROUND now (owner, 2026-09-18), filling it improves
   * the odds, and the spin is the ending. No title, no per-word prompt, no
   * hint line.
   */
  wheelLede: (language: string) => `The wheel decides the round. Type the words back in ${language} to fill it, then spin. Green wins.`,
  /** The input's placeholder and its accessible name. */
  wheelAnswerPlaceholder: (language: string) => `Type in ${language}`,
  wheelAnswerAria: (language: string, glosses: readonly string[]) =>
    `Type a ${language} translation for any of these words: ${glosses.join(', ')}`,
  wheelCardStatus: (translated: boolean): string =>
    translated ? ', translation entered' : ', translation needed',
  /** Free retries — the line a wrong answer swaps in. */
  wheelRetryLine: 'Not it. Try again. Nothing is lost.',
  /** The confirm tick's accessible name — it submits what was typed. */
  wheelSubmit: 'Pack it',
  wheelSpinAria: 'Spin the wheel',
  /** The wheel is spinning — announced, since the result is a beat away. */
  wheelSpinning: 'Spinning…',
  /** Won: the spin landed green — the ROUND is won (owner, 2026-09-18). */
  wheelWonLine: 'Green! The round is won.',
  /** Miss: the round ends here. */
  wheelMissLine: 'Not green. The round is lost.',
  /**
   * The dock's line when the clues ran out before every key word was found
   * (owner, 2026-09-27): the wheel holds a slice for EVERY key word, and the
   * missed ones stay grey, so the line says how many were found.
   */
  wheelLedeMissed: (found: number, total: number, language: string) =>
    `You found ${found} of ${total}. The words still on the board keep their slices grey. Type the rest in ${language}, then spin.`,
  /** After the spin: the lids show every answer; the untyped ones are grey. */
  wheelAnswersLine: 'The grey words are the answers you did not type.',
  /** After the spin: leave the board for the finish screen. */
  wheelSeeResults: 'See results',
  /** Board caption for the wheel's challenge and its spin. */
  phaseTranslateChallenge: 'Translation time',
  settlementFailed: 'Your result could not be saved yet. Keep this round and try again.',
  settlementSaving: 'Saving your result…',
  guidanceTranslationBody: (language: string) => `The suitcases now show the meanings of the words you found. Type each word back in ${language} to fill the wheel, then spin. A green landing wins the round.`,
  guidanceStartTranslation: 'Start translating',
  phaseTranslateWheel: 'The wheel: the spin decides the round',

  // ── the last chance's arrival panel ────────────────────────────────────────
  /**
   * The pop-up's sentence when the round runs out of clues and the wheel's
   * challenge opens (owner, 2026-09-17): a clear transition before play
   * continues, in the wheelLede's voice so the panel and the dock read as
   * one. The sudden-death panel keeps guidanceLastChanceBody.
   */
  guidanceLastChanceWheel:
    'You ran out of clues, so this is the ending. Translate the collected words to fill the wheel, then spin. Green wins the round.',
  // ── Casey's own turn ──────────────────────────────────────────────────────
  caseyIsThinking: 'Casey is thinking…',
  offlineCaseyIsThinking: 'Offline Casey is thinking. This takes longer.',
  offlineRoundPrompt: 'No internet. Play the rest of this round with offline Casey? She is slower.',
  playOfflineButton: 'Play offline',
  /** The internet is back during an offline round: normal Casey is offered back. */
  onlineAgainTitle: 'The internet is back',
  onlineAgainBody:
    'Play the rest of this round with normal Casey? She is faster and plays better. If your connection keeps dropping, staying offline can be steadier.',
  playOnlineButton: 'Play online',
  stayOfflineButton: 'Stay offline',
  hurryCaseyTitle: 'Tap to hurry Casey along',
  hurryCaseyHint: 'Tap here to hurry Casey along.',
  caseyGuessedWord: (word: string) => `Casey guessed «${word}».`,
  caseyChoosingWord: 'Casey is choosing a word…',
  caseyChoosingWhether: 'Casey is choosing whether to guess…',
  guessGotOne: '. Got one!',
  guessNeutral: '. Neutral.',

  // ── the shared clue pool ──────────────────────────────────────────────────
  turnTokensAria: (given: number, total: number, left: number) =>
    `${given} of ${total} clues given, ${left} left.`,
  cluesGivenCount: (given: number, total: number) => `${given}/${total} clues given`,

  // ── leaving an unfinished round ───────────────────────────────────────────
  leaveTitle: 'Leave this round?',
  leaveBody:
    'Pause keeps this board exactly where it is. Cancel discards it, so Play starts a new round.',
  leaveKeepPlaying: 'Keep playing',
  leavePause: 'Pause game',
  leaveCancelRound: 'Cancel round',

  // ── the dialog that opens a round ─────────────────────────────────────────
  guidanceCaseyTitle: 'Casey’s first clue',
  guidancePlayerTitle: 'Your turn!',
  guidanceWordCount: (n: number) => (n === 1 ? '1 word' : `${n} words`),
  guidanceCaseyBody: 'Find the words that connect to Casey’s clue.',
  guidancePlayerBody:
    "Write one Danish word that connects 1–4 of your green words. Use the dictionary if you don't know the word in Danish.",
  guidanceHideReminder: 'Don’t remind me again',
  guidanceStartGuessing: 'Start guessing',
  guidanceWriteClue: 'Write a clue',
  /** Capitalised on the owner's word (2026-09-11), unlike the dock's caption. */
  guidanceLastChanceTitle: 'Last Chance',
  guidanceLastChanceBody:
    'You ran out of clues. But you can still win. Keep guessing based off the prior clues. But one wrong guess and you lose.',
  guidanceKeepNaming: 'Keep naming',
  guidancePackingTitle: 'Pack the board first',
  // PHASE 3 (step 4b, post-§9.2): glosses are now the player's own language, so
  // packing no longer names English — the cards just show their face.
  guidancePackingBody:
    'Type the Danish for every card, one at a time. When they are all typed, or you can get no further, start the round.',
  guidanceStartPacking: 'Start packing',

  // ── the dictionary: the field, its one answer, and the sheet behind it ────
  dictionaryPlaceholder: 'Dictionary',
  dictionaryFieldAria: (language: string) => `Word to translate, ${language} or your language`,
  dictHitAria: (entry: string) => `${entry}: open the dictionary`,
  approximateFrom: (term: string) => ` (from ${term})`,
  onTheBoardNote: ' (on the board)',
  translateFailed: 'Could not translate that.',
  /** The website demo's dictionary allowance is spent (short: one line). */
  lookupsUsed: 'No lookups left on this visit.',
  /** The practice round's dictionary answers only the 900 (short: one line). */
  dictionaryPracticeOnly: 'Practice only knows the 900 words.',
  sayAgainAria: (word: string) => `Say ${word} again`,
  saySlowlyAria: (word: string) => `Say ${word} slowly`,
  sayExampleAria: 'Say the example sentence again',
  sayExampleSlowlyAria: 'Say the example sentence slowly',
  recordingsUnavailableNote: ' · normal and slow recordings unavailable',
  recordingFailedNote: ' · recording did not load',
  close: 'Close',

  // ── Casey's calls: the turn log and its flags ─────────────────────────────
  caseysCalls: "Casey's calls",
  turnCount: (n: number) => (n === 1 ? '1 turn' : `${n} turns`),
  logHint: "Tap ⚑ on anything of Casey's that was a bad call. She is shown the ones you flag.",
  logYou: 'You',
  /** "Casey: «hund» (2) for kat, mus" — the word between the clue and its targets. */
  logFor: 'for',
  flagClueLabel: (clue: string) => `Casey's clue «${clue}»`,
  flagGuessLabel: (word: string) => `Casey's guess «${word}»`,
  flagOnAria: (label: string) => `${label}, flagged as a bad call. Tap to undo`,
  flagOffAria: (label: string) => `Flag ${label} as a bad call`,
  guessCorrectSr: ', correct',
  guessNeutralSr: ', neutral',
  confidenceSure: (percent: number) => `${percent}% sure`,
  noGuessMade: 'no guess made',

  // ── the clue ledger: a dull diagnostic, not a score ───────────────────────
  ledgerEmpty:
    'Nothing yet. A line appears here for each of Casey’s clues once you have finished guessing under it.',
  ledgerArmHeading: 'arm',
  ledgerCluesHeading: 'clues',
  ledgerFoundHeading: 'found',
  ledgerRefusedHeading: 'refused',
  ledgerHitsTitle: (hits: number, asked: number) => `${hits} of ${asked} words asked for`,
  ledgerRefusedTitle: 'How often this arm’s first reply was thrown out and asked again',
  ledgerExplainer:
    '“found” is the share of the words a clue asked for that you actually turned over. “refused” is how often the model’s first answer was thrown out and asked again. The offline arms cannot be refused.',
  ledgerClear: 'Clear the ledger',

  // ── how the round ended ───────────────────────────────────────────────────
  // The headline is a congratulation on a win and "Next time" on a loss,
  // whichever way it was lost, with the reason under it (owner, 2026-09-11).
  // Owner, 2026-09-18: the win's sub is now the postcard reward line; the
  // sudden-death loss says only the headline — no "too far" sentence and no
  // named culprit card.
  outcomeWonTitle: 'Congratulations!',
  outcomeWonSub: 'You won a postcard!',
  outcomeLostTitle: 'Next time',
  outcomeGivenUpSub: 'Round given up. The connection was there.',
  /** The wheel landed on a segment the challenge never filled. */
  outcomeWheelMissSub: 'The wheel landed on a suitcase you never packed.',
  /** The wheel ending's win (owner, 2026-09-18): the spin landed green. */
  outcomeWheelWinSub: 'The wheel landed green. The round is yours.',
  outcomeWheelSpentSub: 'The token was spent, and the clues still ran out.',

  resultLesson: 'A new optional Guide lesson is ready.',
  resultOpenGrammar: 'Open Grammar in the Guide',
  resultOpenSurvival: 'Open Survival in the Guide',
  resultBackToResult: 'Back to result',

  // ── what the round did, as one line under the headline ────────────────────
  roundStatsAria: 'What this round did',
  // The return type is spelled out because both branches are plain literals:
  // without it the English types as a union of those two strings and no other
  // language's wording is assignable to it.
  newWordsLabel: (n: number): string => (n === 1 ? 'new word' : 'new words'),
  collectedForCasey: 'collected for Casey',
  wrapStatsAria: 'What this wrap-up round packed',
  /** "7 wrapped for good: hund, kat" — the colon only when names follow. */
  wrappedForGood: (named: boolean): string => (named ? 'wrapped for good:' : 'wrapped for good'),
  stayedLabel: 'stayed',

  // ── where the round left the journey: the wrap-up's reader region ─────────
  //
  // The train Home and the map draw, with the same `trainLabel` sentence under
  // it, then one line of two counts: "13 wrapped in Ribe · 87 to go before
  // the train to Kolding". The digit is drawn by the page in its own span, so
  // these are the words after it; a language that agrees with the count gets
  // it as the first argument.
  wrapJourneyHeading: 'The journey',
  wrapJourneyAria: 'The journey after this wrap-up',
  wrappedInCity: (_n: number, city: string) => `wrapped in ${city}`,
  wrapJourneyTrainReady: (city: string) => `the train to ${city} is ready`,
  wrapJourneyOver: 'the journey is over',
  /** Null city: the last stop has no onward train. */
  wrapJourneyToGo: (_n: number, city: string | null) =>
    `to go before the train${city ? ` to ${city}` : ''}`,

  // ── the wrap-up economy, said on the way out of a won round ───────────────
  wrapUpUnlocked:
    'Wrap-up round unlocked. It packs collected words into the suitcase for good. Open the suitcase to spend it.',
  wrapUpEarned: (banked: number) => `Wrap-up round earned. ${banked} banked. Spend one in the suitcase.`,
  postcardEarned: (banked: number) => `+1 translation postcard · ${banked} ready for wrap-up packing`,
  wrapUpBankFull: (cap: number) =>
    `The bank is full. ${cap} wrap-up rounds is all the suitcase holds. Spend one and wins start counting again.`,
  winsToWrapUp: (n: number) =>
    n === 1 ? '1 more win for a wrap-up round' : `${n} more wins for a wrap-up round`,
  wrapResultFirst: 'Packed green cards wrap for good, whether this round is won or lost.',
  wrapResultNothing:
    'Nothing wrapped. A word is wrapped when it was translated AND found green, win or lose.',
  wrapResultLost:
    'Losing cost you nothing here. A wrap-up banks what you packed and found green, win or lose.',

  // ── the way out of a round ────────────────────────────────────────────────
  playAgain: 'Play again',
  playNextGame: 'Play next game',
  home: 'Home',
  postWrapChoicesAria: 'After wrap-up choices',
  postWrapHeading: 'What’s next?',
  postWrapGrammar: 'Grammar',
  postWrapSurvival: 'Survival',
  postWrapBoth: 'Both',
  postWrapBothNote: 'Grammar first, then straight on to the exchange.',
  /**
   * "Sønderborg grammar: En, et, and “the”, 2 lessons." — the topic is the
   * lesson's own title from the pack and may be absent; one lesson says
   * nothing about its count.
   */
  grammarNote: (city: string, topic: string | undefined, lessons: number) =>
    `${city} grammar${topic ? `: ${topic}` : ''}${lessons > 1 ? `, ${lessons} lessons.` : '.'}`,
  /** "Exchange 1 of 4: At the station. The phrases, then the dialogue." */
  survivalNextNote: (number: number, total: number, title: string) =>
    `Exchange ${number} of ${total}: ${title}. The phrases, then the dialogue.`,
  survivalAllReadTitle: 'All four exchanges are already read.',
  survivalLockedTitle: 'Complete a wrap-up to unlock the next exchange.',
  survivalLockedNote: 'The next exchange unlocks when a wrap-up finishes.',

  // ── the sentence band under the outcome ───────────────────────────────────
  sentenceReviewAria: 'Sentence review',
  hearItInDanish: 'Hear it in Danish',
  /** "Green: the word you found." The label is inside the <mark>. */
  legendGreenLabel: 'Green',
  legendGreenMeaning: ': the word you found.',
  /** "Underlined: Aarhus's small words." The label is inside the <mark>. */
  legendUnderlinedLabel: 'Underlined',
  legendUnderlinedMeaning: (city: string) => `: ${city}'s small words.`,
  legendTapToHear: 'Tap to hear.',

  // ── the City 1 reader that replaces the finish surface ────────────────────
  reviewTitle: 'Board review',
  reviewProgress: (current: number, total: number) => `${current} of ${total}`,
  reviewOptional: 'Optional · one sentence per clue',
  reviewListen: 'Listen',
  reviewListenSlowlyAria: 'Listen slowly',
  reviewNoRecordings: 'Normal and slow recordings unavailable.',
  reviewRecordingUnavailable: 'Recording unavailable.',
  reviewSoundOff: 'Sound is off or playback was stopped.',
  reviewShowTranslation: 'Show translation',
  reviewHideTranslation: 'Hide translation',
  reviewAboutWord: 'About this word',
  reviewNoNotes: 'Word notes unavailable.',
  reviewNextSentence: 'Next sentence',
  /** The reader's place at City 1 when a round left the queue empty. */
  reviewNothingThisRound:
    'Nothing to review this round. A sentence is offered for each clue of yours that Casey guessed right.',
  /** The band's place at cities 2–9 when the round found no green. */
  sentenceBandNoGreens: 'No green words to put in a sentence this round.',

  // ── why a clue was refused ───────────────────────────────────────────────
  //
  // The engine decides WHAT was wrong (src/engine/legality.ts) and names the
  // words; these turn that into a sentence. Two shapes for each of the last
  // two, because a translation has to name the board word the player can
  // actually SEE — the glosses are hidden by default.
  //
  // PHASE 3: `clueGlossOnBoard` says "English translation". That becomes false
  // the moment the glosses are the player's language. See the plan, §9.3.
  clueNotSingleWord: 'clue must be a single word',
  clueOnBoard: (clue: string) => `"${clue}" is a word on the board`,
  clueTypoOf: (clue: string, word: string) => `"${clue}" may be a typo of "${word}"`,
  clueGlossOnBoard: (clue: string, word: string) =>
    `"${clue}" is the translation of "${word}" on the board`,
  clueCompoundOfWord: (clue: string, word: string) => `"${clue}" is a compound of "${word}"`,
  clueCompoundOfGloss: (clue: string, gloss: string, word: string) =>
    `"${clue}" is a compound of "${gloss}", the translation of "${word}"`,
  clueFormOfWord: (clue: string, word: string) => `"${clue}" is a form of "${word}"`,
  clueFormOfGloss: (clue: string, gloss: string, word: string) =>
    `"${clue}" is a form of "${gloss}", the translation of "${word}"`,

  // ── the practice round's nudges and the closed dictionary (gameStore) ─────
  practiceClueFinal: 'For this final practice clue, connect the one green word left.',
  practiceClueMany: 'For this practice clue, connect 2 or 3 green words.',
  dictionaryClosed: 'The dictionary is closed until this is finished.',
}
