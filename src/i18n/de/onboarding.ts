import type { Catalogue } from '../en'

/**
 * Deutsch. Du, nie Sie. Casey ist „sie“ und spricht hier zum ersten Mal — kurz,
 * warm, direkt. Glossar: eine Runde ist eine Runde, ein Zug im Spiel ein
 * Spielzug (der Zug fährt), gepackt wird in der Packrunde, eingewickelt IST ein
 * Wort, das sie überstanden hat. Die «»-Wörter sind Dänisch und bleiben es.
 */
export const onboarding: Catalogue['onboarding'] = {
  courseText: (course) => {
    const german = course === 'de'
    return {
      languageName: german ? 'Deutsch' : 'Dänisch',
      countryName: german ? 'Deutschland' : 'Dänemark',
      welcome: 'Wusstest du, dass 900 Wörter in den meisten Sprachen über 80 % der gesprochenen Alltagssprache abdecken können? (Tippe, dann geht’s weiter.)',
      map: (destination) => german
        ? `Das ist unsere Karte. Wir reisen durch Deutschland und sammeln in jeder Stadt hundert Wörter. ${destination} ist unser Ziel.`
        : `Das ist unsere Karte. Wir reisen durch Dänemark und sammeln in jeder Stadt hundert Wörter. ${destination} ist unser Ziel.`,
      guide: german
        ? 'Wenn du Grammatik oder praktische Tipps zum Deutschlernen brauchst, öffne den Reiseführer. Du kannst jederzeit vorausblättern.'
        : 'Wenn du Grammatik oder praktisches Dänisch brauchst, öffne den Reiseführer. Du kannst darin auch jederzeit vorausblättern.',
      clueField: german
        ? 'Wenn du dran bist, tippe hier ein Wort auf Deutsch ein, das zwei oder drei deiner grünen Wörter verbindet.'
        : 'Wenn du dran bist, tippe hier ein dänisches Wort ein, das zwei oder drei deiner grünen Wörter verbindet.',
      dictionary: german
        ? 'Wenn du ein deutsches Wort brauchst, schlag es genau hier nach. Das Wörterbuch schließt sich, sobald dein Hinweis abgeschickt ist.'
        : 'Wenn du ein dänisches Wort brauchst, das dir fehlt, schlag es genau hier nach. Das Wörterbuch schließt sich, sobald dein Hinweis abgeschickt ist.',
      tutorialHint: 'Übersetze deine Idee mit dem Wörterbuch.',
      practiceIntro: (clue, number) =>
        `Mein Hinweis ist «${clue}» für ${number}. Welche Wörter auf diesem Spielfeld passen dazu? Tippe auf ⓘ, wenn du eine Übersetzung brauchst.`,
      practiceRationaleTime: 'Eine Uhr zeigt die Zeit. Monat und Woche sind Zeiteinheiten.',
      practiceRationaleTimeRecovery: 'Das greift die Zeitverbindung für die noch übrigen Zeitkarten wieder auf.',
      lastGreen: german
        ? 'Eine deiner grünen Karten fehlt noch. Ich sehe sie nicht, also gib mir einen deutschen Hinweis für diese letzte Karte.'
        : 'Eine deiner grünen Karten fehlt noch. Ich sehe sie nicht, also gib mir einen dänischen Hinweis für diese letzte Karte.',
      yourTurn: german
        ? 'Mein Spielzug ist vorbei. Jetzt bist du dran. Gib mir einen deutschen Hinweis, der 2 oder 3 grüne Karten auf deiner Seite verbindet. Ich sehe sie nicht, genauso wenig wie du meinen Schlüssel.'
        : 'Mein Spielzug ist vorbei. Jetzt bist du dran. Gib mir einen dänischen Hinweis, der 2 oder 3 grüne Karten auf deiner Seite verbindet. Ich sehe sie nicht, genauso wenig wie du meinen Schlüssel.',
    }
  },
  languageEyebrow: 'Willkommen an Bord',
  languageHeading: 'Welche Sprache sprichst du?',
  languageHint: 'Tippe auf deine Sprache.',
  languageAria: (endonym) => `900words auf ${endonym} verwenden`,

  // ── Die Fahrkarte: welche Sprache willst du LERNEN ──────────────────────
  skip: 'Überspringen',
  ticketEyebrow: 'Wähl deine Reise',
  ticketHeading: 'Welche Sprache willst du lernen?',
  ticketAria: (country, language) => `Reise durch ${country}, lerne ${language}`,
  ticketLearnIn: 'Lernen in',
  ticketMeta: (words, cities) => `${words} Wörter · ${cities} Städte`,
  ticketHintMany: 'Tippe auf eine Fahrkarte, um zu wählen.',
  ticketHintOne: 'Tippe auf deine Fahrkarte, dann geht’s los.',

  // ── Caseys Home-Einführung, Schritt für Schritt ─────────────────────────
  introWelcome:
    'Wusstest du, dass 900 Wörter in den meisten Sprachen über 80 % der gesprochenen Alltagssprache abdecken können? (Tippe, dann geht’s weiter.)',
  introMap:
    'Das ist unsere Karte. Wir reisen durch Dänemark und sammeln in jeder Stadt hundert Wörter. Kopenhagen ist unser Ziel.',
  introGuide:
    'Wenn du Grammatik oder praktisches Dänisch brauchst, öffne den Reiseführer. Du kannst darin auch jederzeit vorausblättern.',
  introPlay: 'Mehr brauchst du fürs Erste nicht. Tippe auf Spielen, dann sammeln wir unsere ersten Wörter.',
  introBubbleAria: (line) => `${line} Weiter.`,
  introCaseyOpen: 'Casey öffnen und die gesammelten Wörter ansehen',
  introCaseyContinue: 'Mit Casey weiter',
  introPlayFirst: 'Spiel deine erste Runde',
  introTapCasey: 'Tippe auf Casey',

  // ── Die Hinweisfenster auf den echten Screens ───────────────────────────
  tourNext: 'Weiter',
  tourDone: 'Weiter geht’s',
  tourLoose:
    'Hier bleibt deine Wortsammlung. Tippe ein Wort an, wenn du es noch einmal sehen oder hören möchtest.',
  tourLid:
    'Das ist Caseys Brettsammlung. Eine Brettnummer und die ausgeschriebene Stufe zeigen den besten Versuch dieses Bretts.',
  tourTray:
    'Öffne ein abgeschlossenes Brett, um es erneut zu spielen. Eine Wiederholung kann seine beste Stufe verbessern, ohne dein nächstes Pflichtbrett zurückzusetzen.',
  tourWrapUp:
    'Hier steht dein nächstes Pflichtbrett. Schließe Bretter ab, um Stufen zu verdienen. Übersetzungen und das Rad können ein gelöstes Brett bis auf Platin heben.',
  mapTourHere: (city, _words) =>
    `Das ist ${city}, hier sind wir gerade. Brettergebnisse bauen deine Stadtbereitschaft auf.`,
  mapTourNext: (next, _words, city) =>
    `${next} liegt weiter auf der Route. Verbessere weiter die Bretter in ${city}. Der nächste Halt ist vorerst geschlossen.`,
  homeTourArrival: (city, _words) => `Wir sind in ${city} für deine ersten Bretter angekommen.`,
  homeTourMap:
    'Das ist unsere Karte. Sie zeigt, wo wir gerade sind, und die Städte, die noch vor uns liegen.',
  homeTourSuitcase:
    'Tipp mich an, wann immer du den Koffer öffnen willst. Er vereint deine Wortsammlung und Caseys Brettsammlung.',
  homeTourGuide:
    'Im Reiseführer findest du Grammatik, praktisches Dänisch und die Übungen früherer Städte an einem Ort. Du kannst vorausblättern, ohne dass der Zug weiterfährt.',
  // ── Die geführte Tour im Übungsspiel (2026-09-18) ─────────────────────────
  introGameTourKey:
    'Die grünen Rahmen sind deine geheimen Wörter. Ich sehe sie nie, genauso wenig wie du meine. Jeder Tipp wird am Schlüssel dessen gemessen, der den Hinweis gegeben hat.',
  introGameTourClueField:
    'Wenn du dran bist, tippe hier ein dänisches Wort ein, das zwei oder drei deiner grünen Wörter verbindet.',
  introGameTourDictionary:
    'Wenn du ein dänisches Wort brauchst, das dir fehlt, schlag es genau hier nach. Das Wörterbuch schließt sich, sobald dein Hinweis abgeschickt ist.',
  introGameTourStepper:
    'Diese Zahl sagt, für wie viele Wörter dein Hinweis gilt. Erhöhe sie, wenn eine Verbindung wirklich mehr von deinen Grünen abdeckt.',
  translationTourBoard:
    'Diese Kofferdeckel zeigen die Bedeutungen der Wörter, die wir gefunden haben. Such dir im Kopf eins davon aus. Du musst vorher keinen Koffer antippen.',
  translationTourInput: (language: string) =>
    `Tippe hier das Wort auf ${language} ein und dann auf das Häkchen. Eine falsche Antwort kostet nichts, also versuch es einfach nochmal.`,
  translationTourWheel:
    'Jede richtige Antwort bringt ein grünes Feld aufs Rad. Du kannst jederzeit drehen, aber landest du auf einem leeren Feld, verlierst du die Runde. Ist das Rad voll, gewinnt jeder Dreh.',
  wheelReadyTour:
    'Das Rad ist jetzt ganz grün, also gewinnt dieser Dreh. Tippe aufs Rad, um zu drehen.',
  resultTourPostcards: (amount: string) =>
    `Dieses Brett hat deiner Stadt ${amount} eingebracht. Jedes Ergebnis zeigt genau hier, was es verdient hat.`,
  resultTourRewardNew: (rewards: string) => `Diesmal neu: ${rewards}.`,
  resultTourRewardHeld: (rewards: string) =>
    `Schon früher verdient, deshalb nicht noch einmal gezählt: ${rewards}.`,
  resultTourNoRewards:
    'Dieses Brett hat diesmal keine Postkarten eingebracht. Das kann passieren, und dir wird nichts weggenommen.',
  resultTourWinTier: (tier: string, best: string) =>
    `Dieses Ergebnis ist ${tier}. Die Bestleistung für dieses Brett ist bisher ${best}.`,
  resultTourLossTier: (best: string) =>
    `Diese Runde ging verloren. Bronze zeigt hier nur, dass du gespielt hast, und ist keine Bestleistung. Die Bestleistung für dieses Brett ist bisher ${best}.`,
  resultTourNoBestYet: 'noch offen',
  resultTourSentence:
    'Das ist eine freiwillige Wiederholung. Sie zeigt ein Wort von diesem Brett in einem Satz. Das ist kein weiterer Test.',
  resultTourNoReview:
    'Diesmal gibt es keinen Satz zum Wiederholen. Das ist in Ordnung. Die Wiederholung ist immer freiwillig.',
  homeTourPostcards:
    'Das ist deine Postkartenzahl für diese Stadt. Jede Postkarte, die ein Brett verdient, kommt hier dazu.',
  homeTourCollection:
    'Tipp mich an, um den Koffer zu öffnen. Ich zeige dir die Wörter, die wir gesammelt haben, und deine Bretter.',

  // ── Die Übungsrunde: Caseys geschriebene Begründungen ───────────────────
  practiceRationaleDrink: 'Wasser, Kaffee und Milch sind alles Dinge, die man trinkt.',
  practiceRationaleHome: 'Ein Haus ist ein Zuhause.',
  practiceRationaleRecovery:
    'Das greift die Verbindung zum Trinken noch einmal auf, für die Getränkekarten, die noch übrig sind.',

  // ── Die Übungsrunde: Caseys laufende Kommentare ─────────────────────────
  practiceIntro:
    'Mein Hinweis ist «drikke» für 3. Welche Wörter auf diesem Spielfeld passen dazu? Tippe auf ⓘ, wenn du eine Übersetzung brauchst.',
  guessGreenMore: (word) =>
    `«${word}» ist grün auf meinem Schlüssel. Rate weiter oder hör auf, solange wir vorn liegen.`,
  guessGreenEnd: (word) => `«${word}» ist grün auf meinem Schlüssel. Damit endet mein Hinweis.`,
  guessGreenEndMine: (word) =>
    `«${word}» ist grün auf meinem Schlüssel. Damit endet mein Hinweis. Deine grünen Karten erscheinen, wenn du dran bist. Bei diesem Hinweis zählte mein Schlüssel.`,
  guessYoursNotMine: (word) =>
    `«${word}» ist eine deiner grünen Karten, aber auf meinem Schlüssel ist sie nicht grün. Bei diesem Hinweis zählt mein Schlüssel, also bleibt die Karte für deinen im Spiel.`,
  guessMiss: (word) => `«${word}» ist auf meinem Schlüssel nicht grün, damit endet mein Hinweis.`,
  guessMissMine: (word) =>
    `«${word}» ist auf meinem Schlüssel nicht grün, damit endet mein Hinweis. Deine grünen Karten erscheinen, wenn du dran bist. Bei diesem Hinweis zählte mein Schlüssel.`,
  firstClue: (clue) =>
    `Hey, welche Wörter auf diesem Spielfeld verbindest du mit «${clue}»? Tippe auf das ⓘ neben einem Wort, um die Übersetzung zu sehen. Wenn du so weit bist, tippe ein Wort an und bestätige es.`,
  clueFor: (clue, number) =>
    `Mein Hinweis ist «${clue}» für ${number}. Tippe auf ein Wort, an das du dabei denkst.`,
  lastGreenLeft:
    'Eine deiner grünen Karten fehlt noch. Ich sehe sie nicht, also gib mir einen dänischen Hinweis für diese letzte Karte.',
  yourTurn:
    'Mein Spielzug ist vorbei. Jetzt bist du dran. Gib mir einen dänischen Hinweis, der 2 oder 3 grüne Karten auf deiner Seite verbindet. Ich sehe sie nicht, genauso wenig wie du meinen Schlüssel.',
  yourFirstClue: (clue, number, tokens) =>
    `Dein Hinweis ist «${clue}» für ${number}. Die ${tokens} Punkte oben sind unsere gemeinsamen Hinweismarken. Jeder Hinweis, deiner oder meiner, kostet eine. Unten denke ich laut nach.`,
  yourClue: (clue, number) =>
    `Dein Hinweis ist «${clue}» für ${number}. Jetzt zählt beim Raten dein Schlüssel. Unten denke ich laut nach.`,
  practiceWon: 'Alle grünen Karten gefunden. Wir haben gewonnen! Volle Spielfelder werden nicht so leicht, aber jedes Wort, dem wir begegnen, zählt.',
  practiceLost:
    'Diese Runde ist uns entwischt, aber jedes Wort, dem wir begegnet sind, zählt trotzdem.',
  findingAClue: 'Ich bin dran. Ich suche einen Hinweis.',
  practiceTranslation:
    'Das Brett ist gelöst! Jetzt ist Übersetzungszeit: Jede dänische Antwort füllt ein Feld im Rad. Du kannst schon drehen, aber ein volles Rad garantiert Grün. Ein gelöstes Brett kann hier noch Platin erreichen.',
  practiceWheelReady:
    'Das Rad ist voll. Dreh es, um auf Grün zu landen. In normalen Brettern kann dein Ergebnis so Platin erreichen.',
  practiceFinish:
    'Übung abgeschlossen. Diese Runde bringt keine Postkarten und keine Stadtstufe. In normalen Brettern ergeben Lösen, Übersetzen und Drehen eine Stufe. Spiel ein abgeschlossenes Brett erneut, um sein Bestes zu verbessern.',
  demoEndTitle: "Das war dein erstes ganzes Brett.",
  demoEndLine: "In der App spiele ich weiter mit dir, Brett für Brett, und ich behalte jedes Wort, das du sammelst.",
  demoAppStore: "900words im App Store laden",
  demoAppStoreSoon: "900words kommt bald in den App Store.",
  demoPlayAgain: "Noch einmal spielen",
  demoRestingTitle: "Casey ruht sich aus",
  demoRestingBody: "Heute haben viele mit mir gespielt, deshalb brauche ich eine Pause. Komm morgen wieder oder spiel in der App mit mir.",
  demoCheckFailed: "Wir konnten nicht prüfen, dass du ein Mensch bist. Lade die Seite bitte neu und versuch es noch einmal.",
  playFullRound: 'Spiel dein erstes ganzes Brett',
  returnToParkedGame: 'Zurück zu deiner Runde',
}
