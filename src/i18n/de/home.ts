import type { Catalogue } from '../en'

/**
 * Deutsch. Du, nie Sie. Der Zug fährt hier wirklich, also heißt nichts anderes
 * „Zug“. Eingepackt WIRD eine Karte in der Packrunde; eingewickelt IST ein
 * Wort, das sie überstanden hat und im Fach liegt — das ist die Zahl, die auf
 * Home und der Karte zählt.
 */
export const home: Catalogue['home'] = {
  brandName: '900words',
  // ── Home ────────────────────────────────────────────────────────────────
  settingsAria: 'Einstellungen',
  openMapAria: 'Karte öffnen',
  homeMapAria: (stop, stops, city) => `Station ${stop} von ${stops}: ${city}`,
  needsPass: 'Nächster Zug braucht ein Reiseticket',
  wrappedWord: 'eingewickelt',
  collectedCount: (collected) => `${collected} gesammelt`,
  journeyDone: (city) => `Du hast den letzten Koffer in ${city} gepackt.`,
  momentumLine: 'Spiele 3 Bretter am Tag und du kannst alle Wörter in 90 Tagen sammeln.',
  dailyPlayedAria: (outcome) => `Tagesaufgabe: heute gespielt (${outcome})`,
  dailyAria: 'Tagesaufgabe: ein gemeinsames Spielfeld pro Tag',
  play: 'Spielen',
  previewHeading: 'Noch kein Wortspiel',
  previewNote:
    'Karte und Reiseführer sind da. Spielfelder, Hinweise und Audioaufnahmen fehlen noch.',
  previewGuideCta: 'Reiseführer öffnen',
  continueGame: 'Spiel fortsetzen',
  continueWrapUp: 'Packrunde fortsetzen',
  continueReview: 'Rückblick fortsetzen',
  continuePrimary: 'Brett fortsetzen',
  continueReplay: 'Wiederholung fortsetzen',
  returnToPrimary: 'Zu deinem Brett zurück',
  viewResult: 'Ergebnis ansehen',
  improveBoards: 'Bretter verbessern',
  postcardsEarned: 'Postkarten verdient',
  postcardsRemaining: (remaining) => `${remaining} Postkarte${remaining === 1 ? '' : 'n'} bis zur Reise`,
  postcardReadiness: (earned, remaining) => `${earned} Postkarten verdient; ${remaining} bis zur Reise.`,
  readyToTravel: 'Bereit zum Reisen',
  nextStopNotReleased: (city) => `Bereit zum Reisen. ${city} ist noch nicht veröffentlicht.`,
  cityMedalInProgress: 'noch nicht verdient',
  cityMedal: (tier) => `Stadtmedaille: ${tier}`,
  backToCity: (city) => `Zurück nach ${city}`,

  // ── Die Karte ───────────────────────────────────────────────────────────
  back: 'Zurück',
  journeyTitle: 'Die Reise',
  mapAria: (country, stop, stops, city) =>
    `Karte von ${country}. Station ${stop} von ${stops}: ${city}.`,
  stopAria: (city, stop, status) => `${city}, Station ${stop}, ${status}`,
  statusVisited: 'besucht',
  statusHere: 'du bist hier',
  statusNotReached: 'noch nicht erreicht',
  statusAhead: 'liegt voraus',
  stopOf: (stop, stops) => `Station ${stop} von ${stops}`,
  arrivedOn: (date) => `angekommen am ${date}`,
  previousStopAria: 'Vorherige Station',
  nextStopAria: 'Nächste Station',
  wordsWaiting: (words, city) =>
    `${words} Wörter warten. Erreiche ${city}, um sie freizuschalten.`,
  lookAhead: 'Vorausschauen',
  travelAhead: 'Vorausreisen',
  enableTravelAhead: 'Vorausreisen einschalten',
  mapCounts: (goal, collected, discovered) =>
    `/ ${goal} eingewickelt · ${collected} gesammelt · ${discovered} entdeckt`,
  suitcasePacked: 'Koffer gepackt',
  lineClosedNote: 'Strecke gesperrt. Tippe auf den Zug für die Meldung.',
  travelBackTo: (city) => `Zurückreisen → ${city}`,
  travelOnTo: (city) => `Weiterreisen → ${city}`,
  trainToClosed: (city) => `Zug nach ${city}: Strecke gesperrt`,
  getPassFor: (city) => `Reiseticket für ${city} holen`,
  mapCredit: 'Kort · Kartendaten: Geodatastyrelsen / DAGI (FOT), 1:500 000',
  backToTheMap: 'Zurück zur Karte',

  // ── Der Zug, auf beiden Screens ─────────────────────────────────────────
  trainJourneyOver: 'Der Koffer ist gepackt. Die Reise ist zu Ende.',
  trainReady: (city) => `Der Koffer ist gepackt. Der Zug nach ${city} steht bereit.`,
  wordsToFinish: (words) =>
    `Dir ${words === 1 ? 'fehlt' : 'fehlen'} noch ${words} ${words === 1 ? 'eingewickeltes Wort' : 'eingewickelte Wörter'} bis ans Ziel.`,
  wordsToTrain: (words, city) =>
    `Dir ${words === 1 ? 'fehlt' : 'fehlen'} noch ${words} ${words === 1 ? 'eingewickeltes Wort' : 'eingewickelte Wörter'} für den Zug nach ${city}.`,
  boardTrain: (city) => `In den Zug nach ${city} steigen`,

  // ── Ankommen ────────────────────────────────────────────────────────────
  arrivalAgain: (words) =>
    `Wieder da! Deine ${words} Wörter von hier liegen noch im Koffer. Spiel sie noch mal oder reise weiter, wann immer du willst.`,
  arrivalNew: (words) =>
    `${words} neue Wörter gibt es zu entdecken. Casey steht offen und wartet schon auf sie.`,
  getStarted: 'Los geht’s',
  seeTheMap: 'Karte ansehen',

  // ── Der Koffer ──────────────────────────────────────────────────────────
  suitcaseTitle: 'Der Koffer',
  filterAria: 'Koffer nach Stadt filtern',
  filterAll: 'Alle',
  pagerPreviousAria: (band) => `${band}, vorherige Seite`,
  pagerNextAria: (band) => `${band}, nächste Seite`,
  looseLabel: (words) => `Noch draußen: ${words}`,
  looseEmpty: 'Nichts mehr draußen. Jedes Wort von hier liegt im Koffer.',
  lidLabel: (words) => `Gesammelt: ${words}`,
  lidEmpty:
    'Gib einen Hinweis auf ein Wort und rate es, einmal in jede Richtung grün, dann liegt es im Deckel.',
  trayLabel: (words, goal) => `Eingewickelt: ${words} von ${goal}`,
  trayEmpty: 'Im Fach liegt noch nichts. Packrunden legen Wörter hier für immer ab.',
  undiscoveredAria: 'Unentdecktes Wort',
  wordAria: {
    undiscovered: (word) => `${word}, unentdeckt`,
    discovered: (word) => `${word}, entdeckt`,
    collected: (word) => `${word}, gesammelt`,
    wrapped: (word) => `${word}, eingewickelt`,
  },
  wrapUpWords: 'Wörter einwickeln',
  wrapUpBankedAria: (banked) => `Wörter einwickeln: ${banked} auf Vorrat`,
  postcardBalance: (banked) => `Postkarten · ${banked}`,
  postcardHelp: 'Brauchst du die Antwort? Nutze eine Postkarte.',
  packingAnswerShown: 'Antwort gezeigt. Drücke Einpacken.',
  packingNoPostcards: 'Gewinne eine normale Runde, um eine Postkarte zu verdienen.',
  packingFirstPostcardHint: (language) => `Tippe das ${language}-Wort zum Packen. Eine Postkarte zeigt es dir.`,
  packingPostcardTitle: (state, language) => state === 'shown' ? 'Zeige diese Antwort kostenlos noch einmal.' : state === 'select' ? 'Wähle zuerst eine ungepackte Karte.' : state === 'empty' ? 'Gewinne eine normale Runde, um eine Übersetzungspostkarte zu verdienen.' : `Gib eine Postkarte aus, um die ${language}-Antwort dieser Karte zu zeigen.`,
  packingPostcardAria: (shown, banked) => shown ? 'Übersetzung kostenlos noch einmal zeigen' : `Übersetzungspostkarte nutzen: ${banked} verfügbar`,
  packingPostcardShowAnswer: 'Antwort zeigen',
  usePostcard: 'Postkarte nutzen',
  wrapUpContinueAria: 'Laufende Packrunde fortsetzen',
  hintWrapUpWaiting: 'Eine Packrunde läuft schon. Mach da weiter, wo du aufgehört hast.',
  hintCollectFirst: (city) =>
    `Sammle erst ein Wort in ${city}, einmal in jede Richtung grün, dann hat eine Packrunde etwas zu packen.`,
  hintFirstWrapUp: (wins) =>
    `Gewinne ${wins} ${wins === 1 ? 'Runde' : 'Runden'} für deine erste Packrunde.`,
  hintMoreWins: (wins) => `Noch ${wins} ${wins === 1 ? 'Sieg' : 'Siege'} bis zu einer Packrunde.`,
  hintPacksRange: (collected, city) =>
    `${collected} gesammelt in ${city}. Eine Packrunde packt 13 bis 15, je nach Schlüssel.`,
  hintPacksUpTo: (collected, city, cap) =>
    `${collected} gesammelt in ${city}. Die nächste Packrunde packt bis zu ${cap}, je nach Schlüssel.`,

  // ── Der Packtisch, oben in einer Packrunde ──────────────────────────────
  packWord: (word) => `«${word}» einpacken`,
  packTheBoard: 'Einpacken',
  packCount: (packed, packable) => `(${packed} von ${packable})`,
  startEarlyWarning: (remaining) =>
    `Mit ${remaining} ungepackten Karten starten. Sie bleiben englisch und werden diese Runde nicht eingewickelt`,
  startEarly: (remaining) => `Mit ${remaining} starten`,
  tapEnglishCard: 'Tippe auf eine englische Karte',
  theWordFor: (language, word) => `${word} auf ${language}`,
  tapEnglishCardFirst: 'Tippe zuerst auf eine englische Karte',
  pack: 'Einpacken',
  packMiss: 'Nicht ganz. Der Fehlversuch ist notiert. Probier weiter.',
  packFirstTime:
    'Gib das dänische Wort ein, um es einzupacken. Früh starten lässt Karten englisch und uneingewickelt.',
  packRecall: 'Das Wörterbuch ist zu. Jetzt zählt dein Gedächtnis.',
  packTapAndType: (language) =>
    `Tippe auf eine englische Karte und gib das Wort auf ${language} ein.`,

  // ── Das Reiseticket ─────────────────────────────────────────────────────
  passBackAria: 'Zurück zur Karte',
  passTitle: 'Nächste Züge',
  passKicker: 'Deine ersten zwei Städte sind kostenlos.',
  passHeading: 'Ein Reiseticket für den Rest von Dänemark',
  passIntro:
    'Bus und Bahn sind in Dänemark leider nicht kostenlos. Wenn du die nächsten Züge nehmen willst, brauchst du ein Reiseticket.',
  passOptionsAria: 'Reiseticket-Optionen',
  passMonthly: 'Reiseticket für einen Monat',
  passMonthlyHelp: 'Reise weiter, solange dein Reiseticket gilt.',
  passLifetime: 'Reiseticket für immer',
  passLifetimeHelp: 'Ein Reiseticket für jede Reise, die wir je herausbringen.',
  passPriceMonthly: '1,99 / Monat',
  passPriceLifetime: '19,99 einmalig',
  passReady: 'Dein Reiseticket ist da. Der nächste Zug steht bereit.',
  passRestore: 'Käufe wiederherstellen',
  passRedeem: 'App-Store-Code einlösen',
  passKindness: 'Lernen sollte nicht vom Geld abhängen.',
  // „… schick es an ⟨Adresse⟩ — dafür bekommst du …“: die Adresse steht mit
  // Leerzeichen zwischen den beiden Hälften, darum kein Komma am Anfang.
  passReviewBefore: 'Schreib eine Rezension im App Store, mach ein Foto davon und schick es an',
  passReviewAfter:
    'und bekomm dafür einen Reiseticket-Code für 6 Monate. Deine Rezension darf gut oder schlecht sein, je nachdem, wie dir die App gefällt.',

  // ── Tageslimit-Upgrade ───────────────────────────────────────────────────
  dailyLimitKicker: 'Deine zwei kostenlosen Spiele für heute sind aufgebraucht.',
  dailyLimitHeading: 'Spiel weiter mit Casey',
  dailyLimitBody: 'Komm morgen für zwei weitere kostenlose Spiele zurück oder schalte unbegrenztes Spielen frei.',
  dailyLimitOptionsAria: 'Optionen für unbegrenztes Spielen',
  dailyLimitMonthly: 'Monatlich',
  dailyLimitMonthlyHelp: 'Verlängert sich monatlich, bis du kündigst.',
  dailyLimitLifetime: 'Einmalig',
  dailyLimitLifetimeHelp: 'Unbegrenzt spielen, ohne Abo.',
  dailyLimitUnavailable: 'Nicht verfügbar',
  dailyLimitCloseAria: 'Upgrade-Dialog schließen',
  dailyLimitRestore: 'Käufe wiederherstellen',
  dailyLimitDismiss: 'Vielleicht morgen',
  dailyLimitDisclosure: 'Preise und Kaufbestätigung kommen von Apple. Verwalte oder kündige dein Abo in deinem Apple Account.',
  passThanksHeading: 'Danke, dass du die Entwicklung von 900words unterstützt',
  passThanksBody: 'Unbegrenztes Spielen ist freigeschaltet.',
  passThanksContinue: 'Weiterspielen',

  // ── Die optionale Sprachstation ─────────────────────────────────────────
  stopKicker: 'Optionale Sprachstation',
  stopKindGrammar: 'Grammatikübung',
  stopKindSituation: 'Eine kleine Alltagssituation',
  stopKindExit: 'Optionale Bereitschaftsaufgabe',
  stopKindReview: 'Fällige Wiederholung',
  stopFocus: 'Dein nächster Sprachschwerpunkt',
  stopNote:
    'Diese Station wird getrennt von deinem Koffer gespeichert. Sie ändert nie, welche Wörter du packen kannst oder ob der Zug abfahren kann.',
  stopAuthoring:
    'Die dänischen Aufgaben und ihre Bewertung entstehen gerade zusammen mit dem Kursinhalt. Heb dir die Station für später auf oder lass sie im Reiseführer; ein Platzhalter-Versuch zählt nie als Lernnachweis.',
  stopContinue: 'Weiter',
  stopLater: 'Später',
  stopSkip: 'Station überspringen',
  stopStart: 'Starten',
  stopOpen: 'Sprachstation',

  // ── die gesperrte Strecke ────────────────────────────────────────────────
  trainClosedLabel: (city) =>
    `Der Zug nach ${city} fährt noch nicht. Die Strecke ist wegen Bauarbeiten gesperrt`,
  trainClosedTitle: 'Die Strecke ist wegen Bauarbeiten gesperrt',
  trainClosedBody: (city, here) =>
    `Der Zug nach ${city} fährt noch nicht. An der Strecke wird gearbeitet. ` +
    `Bald fährt er wieder, und sobald es so weit ist, erfährst du es hier. ` +
    `Bis dahin gehört ${here} ganz dir: jedes Spielfeld, jede Packrunde und deine Serie.`,
  trainReopenedTitle: (city) => `Der Zug nach ${city} fährt wieder`,
  trainReopenedBody:
    'Die Strecke ist frei. Dein Koffer ist gepackt, und Casey steht am Bahnsteig. Steig ein, wann du magst.',
}
