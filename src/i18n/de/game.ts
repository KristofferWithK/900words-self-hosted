import type { Catalogue } from '../en'

/**
 * Deutsch. Du, nie Sie. Casey ist „sie“. Ein Zug im Spiel heißt Spielzug
 * (Glossar), auch im Rundenprotokoll: „3 Züge“ liest sich in einer App voller
 * Bahnhöfe wie ein Fahrplan. „Tipp“ ist Caseys Rat auf Home, nie ein
 * Rateversuch — sonst hießen Hinweis, Rat und Raten alle gleich.
 *
 * Kurz halten: das Spielfeld, der Hinweis-Dock und der Abschlussbildschirm
 * müssen bei 360x640 ohne Scrollen passen, und Deutsch ist die längste
 * Sprache hier.
 */
export const game: Catalogue['game'] = {
  legacyRetiredTitle: "Dein Fortschritt ist sicher",
  legacyRetiredBody: "Eine ältere Runde konnte nach diesem Update nicht fortgesetzt werden. Deine gespeicherten Lernfortschritte und Postkarten bleiben erhalten. Fahre mit dem nächsten unvollendeten Brett fort.",
  phaseGiveClue: 'Gib Casey einen Hinweis',
  phaseCaseyGuessing: 'Casey rät',
  phaseCaseyClue: 'Casey sucht einen Hinweis',
  phaseYourGuess: 'Du bist dran mit Raten',
  phaseLastChance: 'Letzte Chance: keine Hinweise mehr',
  phaseRoundOver: 'Runde vorbei',
  phasePackTheBoard: 'Einpacken',

  announceCaseyGuess: (word, result) => `Casey hat ${word} geraten: ${result}.`,
  resultCorrect: 'richtig',
  resultNeutral: 'neutrale Karte',
  announceCaseyThinking: 'Casey denkt nach.',

  skip: 'Überspringen',
  homeAria: 'Start',
  dealNewWordsAria: 'Neue Wörter austeilen',
  hideTranslationsAria: 'Übersetzungen verbergen',
  showTranslationsAria:
    'Alle Übersetzungen zeigen. Zählt als Nachschlagen für jedes ungelöste Wort',

  errorRetry: 'Erneut versuchen',
  errorCaseySettings: 'Casey-Einstellungen',
  practiceNote:
    'Experimenteller Prototyp ohne Agent. Das ist nicht Casey und kein normales Spiel.',

  studyTitle: 'Spielfeld studieren',
  studyHint:
    'Alle Übersetzungen sind zu sehen. Sobald du startest, verschwinden sie; dann schlägst du ein Wort per Antippen nach.',
  studyStart: 'Runde starten',

  cardYourTarget: ', dein Ziel',
  cardFound: ', gefunden',
  cardMissedKey: ', eines von Caseys Wörtern, nicht gefunden',
  cardNeutralBoth: ', neutral für beide Seiten',
  cardNeutralPlayer: ', neutral unter deinen Hinweisen',
  cardNeutralCasey: ', neutral unter Caseys Hinweisen',
  cardUnpacked: ', nicht eingepackt',
  cardTranslationRevealed: ', Übersetzung gezeigt',
  cardNotYetPacked: (language) =>
    `, noch nicht eingepackt. Tippe, um das Wort auf ${language} einzugeben`,
  cardNotYoursToWrap: ', kannst du noch nicht einwickeln',
  cardTapToHear: '. Zum Anhören tippen',
  lookUpAria: (word) => `${word} nachschlagen`,

  cluePlaceholder: 'Dein Hinweis',
  clueFieldAria: (language) => `Dein Ein-Wort-Hinweis auf ${language}`,
  fewerWordsAria: 'weniger Wörter',
  moreWordsAria: 'mehr Wörter',
  wordCountAria: (n) => (n === 1 ? '1 Wort' : `${n} Wörter`),
  giveClue: 'Hinweis geben',
  giveItAnyway: 'Trotzdem geben',
  askingCasey: 'Casey wird gefragt…',
  firstClueHint: (language) =>
    `Ein Wort auf ${language}. Keine Idee? Das Wörterbuch daneben übersetzt.`,
  tutorialClueHint:
    'Ich lese Hinweise auf Dänisch. Unsicher? Versuch es einfach. Das Wörterbuch hilft dir.',
  wrapPlayerKeyHint:
    'Dein grüner Rahmen ist zurück. Er ist dein geheimer Schlüssel. Casey sieht ihn nicht.',
  looksEnglishFull: (word, language) =>
    `«${word}» sieht aus wie die Bedeutung eines Kartenworts. Tippe darauf für das Wort auf ${language}, oder gib es trotzdem, dann prüft Casey es.`,
  looksEnglishShort: 'sieht aus wie die Bedeutung eines Kartenworts. Tippe darauf oder gib es trotzdem',

  caseysClueLabel: 'Caseys Hinweis',
  lookUpInDictionaryAria: (word) => `«${word}» im Wörterbuch nachschlagen`,
  guessesLeft: (n) => (n === 1 ? 'noch 1 Versuch' : `noch ${n} Versuche`),
  guessWord: (word) => `«${word}» raten`,
  cancel: 'Abbrechen',
  stopKeepWhatWeHave: 'Aufhören und behalten, was wir haben',
  guessPrompt: 'Tippe auf ein Wort, das Casey meinen könnte.',
  firstGuessHint: 'Jetzt zählt Caseys Schlüssel. Tippe auf ein Wort, auf das ihr Hinweis zeigt.',
  wrapCaseyKeyHint:
    'Caseys Schlüssel ist geheim. Rate, worauf ihr Hinweis zeigt. Jetzt zählen ihre grünen Karten.',
  tutorialLookupHint:
    'Tippe auf das ⓘ neben einem Wort, um seine Übersetzung nachzuschlagen.',

  suddenDeathRule: 'Nenne grüne Karten, um zu gewinnen. Alles andere beendet die Runde.',
  nameWord: (word) => `«${word}» nennen`,
  giveUpRound: 'Runde aufgeben',

  // ── das Übersetzungsrad (die letzte Chance, neu 2026-09-16) ───────────────
  wheelLede: (language) => `Das Rad entscheidet die Runde. Schreib die Wörter wieder auf ${language}, um es zu füllen, und dreh dann. Grün gewinnt.`,
  /** The input's placeholder and its accessible name. */
  wheelAnswerPlaceholder: (language) => `${language} eingeben`,
  wheelAnswerAria: (language, glosses) =>
    `Gib eine Übersetzung auf ${language} für eines dieser Wörter ein: ${glosses.join(', ')}`,
  wheelCardStatus: (translated) =>
    translated ? ', Übersetzung eingetragen' : ', Übersetzung gesucht',
  wheelRetryLine: 'Nicht ganz. Versuch es nochmal. Nichts ist verloren.',
  wheelSubmit: 'Einpacken',
  wheelSpinAria: 'Das Rad drehen',
  wheelSpinning: 'Dreht …',
  wheelWonLine: 'Grün! Die Runde ist gewonnen.',
  wheelMissLine: 'Kein Grün. Die Runde ist verloren.',
  wheelLedeMissed: (found, total, language) =>
    `Du hast ${found} von ${total} gefunden. Für die Wörter, die noch auf dem Spielfeld liegen, bleibt das Rad grau. Schreib den Rest auf ${language} und dreh dann.`,
  wheelAnswersLine: 'Die grauen Wörter sind die Antworten, die du nicht geschrieben hast.',
  wheelSeeResults: 'Ergebnis ansehen',
  phaseTranslateChallenge: 'Zeit zum Übersetzen',
  settlementFailed: 'Dein Ergebnis konnte noch nicht gespeichert werden. Behalte diese Runde und versuche es erneut.',
  settlementSaving: 'Dein Ergebnis wird gespeichert…',
  guidanceTranslationBody: (language) => `Die Koffer zeigen jetzt, was die gefundenen Wörter bedeuten. Schreib jedes wieder auf ${language}, um das Rad zu füllen, dann dreh. Grün gewinnt die Runde.`,
  guidanceStartTranslation: 'Übersetzen starten',
  phaseTranslateWheel: 'Das Rad: der Dreh entscheidet die Runde',

  // ── das Ankunftspanel der letzten Chance ──────────────────────────────────
  /** Der Satz des Pop-ups, wenn die Hinweise ausgehen und die Rad-Herausforderung beginnt (Eigentümer, 2026-09-17) — in der Stimme des wheelLede. */
  guidanceLastChanceWheel:
    'Deine Hinweise sind aufgebraucht, also ist das jetzt das Ende. Übersetze die gesammelten Wörter, um das Rad zu füllen, und dreh dann. Grün gewinnt die Runde.',

  caseyIsThinking: 'Casey denkt nach…',
  offlineCaseyIsThinking: 'Offline-Casey denkt nach. Das dauert länger.',
  offlineRoundPrompt: 'Kein Internet. Den Rest dieser Runde mit Offline-Casey spielen? Sie ist langsamer.',
  playOfflineButton: 'Offline spielen',
  onlineAgainTitle: 'Das Internet ist wieder da',
  onlineAgainBody:
    'Den Rest dieser Runde mit der normalen Casey spielen? Sie ist schneller und spielt besser. Wenn deine Verbindung immer wieder abbricht, kann es stabiler sein, offline zu bleiben.',
  playOnlineButton: 'Online spielen',
  stayOfflineButton: 'Offline bleiben',
  hurryCaseyTitle: 'Antippen, damit Casey sich beeilt',
  hurryCaseyHint: 'Tippe hier, damit Casey sich beeilt.',
  caseyGuessedWord: (word) => `Casey hat «${word}» geraten.`,
  caseyChoosingWord: 'Casey wählt ein Wort…',
  caseyChoosingWhether: 'Casey überlegt, ob sie raten soll…',
  guessGotOne: '. Treffer!',
  guessNeutral: '. Neutrale Karte.',

  turnTokensAria: (given, total, left) =>
    `${given} von ${total} Hinweisen gegeben, ${left} übrig.`,
  cluesGivenCount: (given, total) => `${given}/${total} Hinweise gegeben`,

  leaveTitle: 'Diese Runde verlassen?',
  leaveBody:
    'Pausieren lässt das Spielfeld genau so stehen. Abbrechen verwirft es, und Spielen startet dann eine neue Runde.',
  leaveKeepPlaying: 'Weiterspielen',
  leavePause: 'Spiel pausieren',
  leaveCancelRound: 'Runde abbrechen',

  guidanceCaseyTitle: 'Caseys erster Hinweis',
  guidancePlayerTitle: 'Du bist dran!',
  guidanceWordCount: (n) => (n === 1 ? '1 Wort' : `${n} Wörter`),
  guidanceCaseyBody: 'Finde die Wörter, die zu Caseys Hinweis passen.',
  guidancePlayerBody:
    'Schreibe ein dänisches Wort, das 1–4 deiner grünen Wörter verbindet. Benutze das Wörterbuch, wenn du das Wort auf Dänisch nicht kennst.',
  guidanceHideReminder: 'Nicht mehr anzeigen',
  guidanceStartGuessing: 'Jetzt raten',
  guidanceWriteClue: 'Hinweis schreiben',
  guidanceLastChanceTitle: 'Letzte Chance',
  guidanceLastChanceBody:
    'Die Hinweise sind aufgebraucht. Aber du kannst noch gewinnen. Rate weiter nach den bisherigen Hinweisen. Aber ein falscher Versuch, und du verlierst.',
  guidanceKeepNaming: 'Weiter nennen',
  guidancePackingTitle: 'Zuerst das Spielfeld einpacken',
  guidancePackingBody:
    'Schreibe zu jeder Karte das Dänische, eine nach der anderen. Wenn alle geschrieben sind, oder du nicht weiterkommst, starte die Runde.',
  guidanceStartPacking: 'Einpacken beginnen',

  dictionaryPlaceholder: 'Wörterbuch',
  dictionaryFieldAria: (language) => `Wort zum Übersetzen, ${language} oder deine Sprache`,
  dictHitAria: (entry) => `${entry}: Wörterbuch öffnen`,
  approximateFrom: (term) => ` (von ${term})`,
  onTheBoardNote: ' (auf dem Spielfeld)',
  translateFailed: 'Das ließ sich nicht übersetzen.',
  lookupsUsed: 'Keine Wortsuchen mehr übrig.',
  dictionaryPracticeOnly: 'Im Training nur die 900 Wörter.',
  sayAgainAria: (word) => `${word} noch einmal sagen`,
  saySlowlyAria: (word) => `${word} langsam sagen`,
  sayExampleAria: 'Beispielsatz noch einmal sagen',
  sayExampleSlowlyAria: 'Beispielsatz langsam sagen',
  recordingsUnavailableNote: ' · normale und langsame Aufnahme nicht verfügbar',
  recordingFailedNote: ' · Aufnahme nicht geladen',
  close: 'Schließen',

  caseysCalls: 'Caseys Entscheidungen',
  turnCount: (n) => (n === 1 ? '1 Spielzug' : `${n} Spielzüge`),
  logHint:
    'Tippe auf ⚑, wenn etwas von Casey eine Fehlentscheidung war. Was du markierst, bekommt sie zu sehen.',
  logYou: 'Du',
  logFor: 'für',
  flagClueLabel: (clue) => `Caseys Hinweis «${clue}»`,
  flagGuessLabel: (word) => `Caseys Rateversuch «${word}»`,
  flagOnAria: (label) => `${label}, als Fehlentscheidung markiert. Zum Aufheben tippen`,
  flagOffAria: (label) => `${label} als Fehlentscheidung markieren`,
  guessCorrectSr: ', richtig',
  guessNeutralSr: ', neutrale Karte',
  // Geschütztes Leerzeichen vor dem Prozentzeichen, wie im Deutschen üblich.
  confidenceSure: (percent) => `${percent} % sicher`,
  noGuessMade: 'kein Rateversuch',

  ledgerEmpty:
    'Noch nichts. Für jeden Hinweis von Casey erscheint hier eine Zeile, sobald du darunter fertig geraten hast.',
  ledgerArmHeading: 'Quelle',
  ledgerCluesHeading: 'Hinweise',
  ledgerFoundHeading: 'gefunden',
  ledgerRefusedHeading: 'abgelehnt',
  ledgerHitsTitle: (hits, asked) => `${hits} von ${asked} gesuchten Wörtern`,
  ledgerRefusedTitle: 'Wie oft die erste Antwort dieser Quelle verworfen und neu angefragt wurde',
  ledgerExplainer:
    '„gefunden“ ist der Anteil der Wörter, die ein Hinweis gesucht hat und die du wirklich umgedreht hast. „abgelehnt“ ist, wie oft die erste Antwort des Modells verworfen und neu angefragt wurde. Die Offline-Quellen können nicht abgelehnt werden.',
  ledgerClear: 'Protokoll leeren',

  // Kurz, weil die Schlagzeile bei 360px auf 6,8vw gedeckelt ist:
  // „Herzlichen Glückwunsch!“ passt dort nicht in eine Zeile.
  outcomeWonTitle: 'Glückwunsch!',
  outcomeWonSub: 'Du hast eine Postkarte gewonnen!',
  outcomeLostTitle: 'Nächstes Mal',
  outcomeGivenUpSub: 'Runde aufgegeben. Die Verbindung war da.',
  outcomeWheelMissSub: 'Das Rad landete auf einem Koffer, den du nie gepackt hast.',
  /** Das Gewinn-Ende des Rads (Eigentümer, 18.09.2026): das Rad landete grün. */
  outcomeWheelWinSub: 'Das Rad landete auf Grün. Die Runde gehört dir.',
  outcomeWheelSpentSub: 'Der Token war eingesetzt, und die Hinweise gingen trotzdem aus.',

  resultLesson: 'Eine neue optionale Guide-Lektion ist bereit.', resultOpenGrammar: 'Grammatik im Guide öffnen', resultOpenSurvival: 'Survival im Guide öffnen', resultBackToResult: 'Zurück zum Ergebnis',

  roundStatsAria: 'Was diese Runde gebracht hat',
  newWordsLabel: (n) => (n === 1 ? 'neues Wort' : 'neue Wörter'),
  collectedForCasey: 'für Casey gesammelt',
  wrapStatsAria: 'Was diese Packrunde eingepackt hat',
  wrappedForGood: (named) => (named ? 'endgültig eingewickelt:' : 'endgültig eingewickelt'),
  stayedLabel: 'geblieben',

  // ── wo die Runde die Reise hingebracht hat: der Lesebereich der Packrunde ──
  // Die Zahl steht in eigener Spanne davor: „13 in Ribe eingewickelt · 87
  // fehlen noch für den Zug nach Kolding“.
  wrapJourneyHeading: 'Die Reise',
  wrapJourneyAria: 'Die Reise nach dieser Packrunde',
  wrappedInCity: (_n, city) => `in ${city} eingewickelt`,
  wrapJourneyTrainReady: (city) => `der Zug nach ${city} steht bereit`,
  wrapJourneyOver: 'die Reise ist zu Ende',
  wrapJourneyToGo: (n, city) =>
    `${n === 1 ? 'fehlt' : 'fehlen'} noch für den Zug${city ? ` nach ${city}` : ''}`,

  wrapUpUnlocked:
    'Packrunde freigeschaltet. Sie packt gesammelte Wörter endgültig in den Koffer. Öffne den Koffer, um sie einzulösen.',
  wrapUpEarned: (banked) =>
    `Packrunde verdient. ${banked} auf Vorrat. Löse eine im Koffer ein.`,
  postcardEarned: (banked) => `+1 Übersetzungspostkarte · ${banked} bereit`,
  wrapUpBankFull: (cap) =>
    `Der Vorrat ist voll. Mehr als ${cap} Packrunden fasst der Koffer nicht. Löse eine ein, dann zählen Siege wieder.`,
  winsToWrapUp: (n) =>
    n === 1 ? 'noch 1 Sieg bis zur Packrunde' : `noch ${n} Siege bis zur Packrunde`,
  wrapResultFirst:
    'Eingepackte grüne Karten sind endgültig eingewickelt, egal, ob du diese Runde gewinnst oder verlierst.',
  wrapResultNothing:
    'Nichts eingewickelt. Ein Wort wird nur eingewickelt, wenn es eingepackt UND grün gefunden wurde, egal, ob gewonnen oder verloren.',
  wrapResultLost:
    'Verlieren kostet dich hier nichts. Eine Packrunde behält, was du eingepackt und grün gefunden hast, egal, ob gewonnen oder verloren.',

  playAgain: 'Noch mal spielen',
  playNextGame: 'Nächstes Spiel',
  home: 'Start',
  postWrapChoicesAria: 'Auswahl nach der Packrunde',
  postWrapHeading: 'Wie geht’s weiter?',
  postWrapGrammar: 'Grammatik',
  postWrapSurvival: 'Überleben',
  postWrapBoth: 'Beides',
  postWrapBothNote: 'Zuerst Grammatik, dann direkt weiter zum Dialog.',
  grammarNote: (city, topic, lessons) =>
    `Grammatik in ${city}${topic ? `: ${topic}` : ''}${lessons > 1 ? `, ${lessons} Lektionen.` : '.'}`,
  // „Dialog“ ist der Dialog des Glossars; das Gespräch darin heißt darum anders.
  survivalNextNote: (number, total, title) =>
    `Dialog ${number} von ${total}: ${title}. Erst die Sätze, dann das Gespräch.`,
  survivalAllReadTitle: 'Alle vier Dialoge sind schon gelesen.',
  survivalLockedTitle: 'Schließe eine Packrunde ab, um den nächsten Dialog freizuschalten.',
  survivalLockedNote: 'Der nächste Dialog wird frei, sobald eine Packrunde abgeschlossen ist.',

  sentenceReviewAria: 'Satz-Rückblick',
  hearItInDanish: 'Auf Dänisch anhören',
  legendGreenLabel: 'Grün',
  legendGreenMeaning: ': das Wort, das du gefunden hast.',
  legendUnderlinedLabel: 'Unterstrichen',
  legendUnderlinedMeaning: (city) => `: die kleinen Wörter von ${city}.`,
  legendTapToHear: 'Zum Anhören tippen.',

  reviewTitle: 'Spielfeld-Rückblick',
  reviewProgress: (current, total) => `${current} von ${total}`,
  reviewOptional: 'Optional · ein Satz pro Hinweis',
  reviewListen: 'Anhören',
  reviewListenSlowlyAria: 'Langsam anhören',
  reviewNoRecordings: 'Normale und langsame Aufnahme nicht verfügbar.',
  reviewRecordingUnavailable: 'Aufnahme nicht verfügbar.',
  reviewSoundOff: 'Der Ton ist aus oder die Wiedergabe wurde gestoppt.',
  reviewShowTranslation: 'Übersetzung zeigen',
  reviewHideTranslation: 'Übersetzung verbergen',
  reviewAboutWord: 'Zu diesem Wort',
  reviewNoNotes: 'Keine Notizen zu diesem Wort.',
  reviewNextSentence: 'Nächster Satz',
  reviewNothingThisRound:
    'Diesmal nichts zum Rückblick. Für jeden deiner Hinweise, den Casey richtig geraten hat, gibt es einen Satz.',
  sentenceBandNoGreens: 'Diesmal keine grünen Wörter für einen Satz.',

  // ── warum ein Hinweis abgelehnt wurde ────────────────────────────────────
  clueNotSingleWord: 'Ein Hinweis muss ein einzelnes Wort sein',
  clueOnBoard: (clue) => `„${clue}“ steht auf dem Spielfeld`,
  clueTypoOf: (clue, word) => `„${clue}“ könnte ein Tippfehler für „${word}“ sein`,
  clueGlossOnBoard: (clue, word) =>
    `„${clue}“ ist die Übersetzung von „${word}“ auf dem Spielfeld`,
  clueCompoundOfWord: (clue, word) => `„${clue}“ ist eine Zusammensetzung mit „${word}“`,
  clueCompoundOfGloss: (clue, gloss, word) =>
    `„${clue}“ ist eine Zusammensetzung mit „${gloss}“, der Übersetzung von „${word}“`,
  clueFormOfWord: (clue, word) => `„${clue}“ ist eine Form von „${word}“`,
  clueFormOfGloss: (clue, gloss, word) =>
    `„${clue}“ ist eine Form von „${gloss}“, der Übersetzung von „${word}“`,

  // ── die Anstupser der Übungsrunde und das geschlossene Wörterbuch ─────────
  practiceClueFinal: 'Letzter Übungshinweis: Verbinde die eine grüne Karte, die noch übrig ist.',
  practiceClueMany: 'Übungshinweis: Verbinde 2 oder 3 grüne Karten.',
  dictionaryClosed: 'Das Wörterbuch bleibt zu, bis du hier fertig bist.',
}
