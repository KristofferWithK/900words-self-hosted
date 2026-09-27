import type { Catalogue } from '../en'

/**
 * Deutsch. Du, nie Sie. Einstellungen erklären, sie spielen nicht - Casey
 * selbst spricht nur in der Erinnerungsfrage und den Mitteilungen am Ende.
 * „Tipp“ heißt hier nirgends „antippen“ und nirgends „Rateversuch“.
 */
export const settings: Catalogue['settings'] = {
  // ── der Bildschirm ───────────────────────────────────────────────────────
  title: 'Einstellungen',
  backAria: 'Zurück',

  // ── die Sprache, in der die App spricht ──────────────────────────────────
  uiLanguageLabel: 'Deine Sprache',
  uiLanguageHelp:
    'Die Sprache, in der die App mit dir spricht. Beim Wechseln lädt die App neu; deine Sammlung und deine Reise bleiben erhalten.',

  // ── die Sprache, die du lernst ───────────────────────────────────────────
  learnerLanguageLabel: 'Lernsprache',
  learnerLanguageHelp:
    'Jede Sprache hat ihre eigene Reise. Wechsle zurück, um dort weiterzumachen, wo du aufgehört hast.',
  learnerLanguagePreviewTag: 'Vorschau',
  learnerLanguagePreviewHelp:
    'Deutsch ist eine Vorschau: Karte und Reiseführer sind da, das Wortspiel noch nicht. Die Lektionen wurden noch nicht von einer muttersprachlichen Person geprüft.',

  // ── Caseys Gehirn ────────────────────────────────────────────────────────
  caseyBrainHeading: 'Caseys Gehirn',
  caseyServerNote:
    'Casey spielt über den eigenen Server von 900words. Du musst nichts einrichten; der Knopf unten prüft, ob sie antwortet.',
  normalOllamaCaseyLabel: 'Normale Ollama-Casey',
  normalOllamaCaseyDetail: 'gpt-oss 120B · Hinweise und Rateversuche',
  normalOllamaCaseyAria: 'Normale Ollama-Casey verwenden',
  normalCaseyOn: 'Normale Casey ist an',
  normalCaseyOff: 'Normale Casey ist aus',
  prototypeOn: 'Agentloser Prototyp ist an',
  customCaseyOn: 'Eigener Casey-Dienst ist an',
  normalCaseyDetail: 'Ollama spielt und übersetzt. Gemma ist aus.',
  gemmaModeDetail:
    'Gemma 4 E4B übernimmt Hinweise und Rateversuche. Fehlt ein Wort im Wörterbuch, fragt die App weiterhin Ollama.',
  prototypeDetail: 'Dieser lokale Testmodus ist weder Casey noch Ollama noch Gemma.',
  customCaseyDetail:
    'Ein eigener Casey-Worker ist ausgewählt. Fehlt ein Wort im Wörterbuch, fragt die App online diesen Dienst.',
  baseUrlLabel: 'Basis-URL',
  // Der Pfad /v1 steht als <code> zwischen den beiden Hälften, ohne eigenen
  // Abstand - darum tragen sie ihre Leerzeichen selbst.
  baseUrlHelpBefore:
    'Wird vom Schalter oben gesetzt - oder gib die Adresse deines eigenen Casey-Workers plus ',
  baseUrlHelpAfter:
    ' ein. Sie muss mit https:// beginnen, damit nichts aus deinem Spiel unverschlüsselt unterwegs ist.',
  baseUrlUnusable: 'Diese Basis-URL kann nicht verwendet werden.',

  // ── das Modell auf dem Gerät ─────────────────────────────────────────────
  gemmaUnavailableNote: 'Den Offline-Modus gibt es in der iPhone-App von 900words.',
  gemmaReady: (size) => `Offline-Casey ist bereit (${size} auf diesem iPhone).`,
  gemmaRemoveConfirm: 'Offline-Casey von diesem iPhone entfernen? Du kannst sie später wieder herunterladen.',
  gemmaRemoveButton: 'Offline-Casey entfernen',
  gemmaProgressAria: 'Fortschritt des Offline-Casey-Downloads',
  gemmaDownloading: (percent) => `${percent} % - lass 900words im WLAN geöffnet.`,
  gemmaCancelDownloadButton: 'Download abbrechen',
  gemmaDownloadNote: (size) =>
    `Offline-Casey ist ein Download von ${size}. Nutze WLAN und lass 900words geöffnet, bis er fertig ist.`,
  gemmaDownloadButton: 'Offline-Casey herunterladen',
  gemmaDownloadFailed: 'Download fehlgeschlagen.',

  // ── offline mode ─────────────────────────────────────────────────────────
  offlineModeHeading: 'Offline-Modus',
  offlineModeExperimentalTag: 'Experimentell',
  offlineModeLabel: 'Ohne Internet spielen',
  offlineModeHelp:
    'Die normale Casey spielt über den Server von 900words. Mit dem Offline-Modus kannst du eine Runde auf diesem iPhone mit Offline-Casey zu Ende spielen, wenn das Internet weg ist. Sie ist langsamer.',
  offlineModeAria: 'Offline-Modus',
  offlineModeExplain: (size, iphones, lowMemory) =>
    `Der Offline-Modus ist experimentell und wird noch verbessert.\n\nDer Offline-Modus lädt Offline-Casey (${size}) auf dieses iPhone. Nutze WLAN und lass 900words geöffnet, bis der Download fertig ist.\n\nOffline-Casey spielt langsamer als die normale Casey.\n\nSie braucht ein neueres iPhone: ${iphones}.${lowMemory ? '\n\nDieses iPhone hat weniger Arbeitsspeicher als diese Modelle. Vielleicht läuft sie darauf nicht.' : ''}\n\nJetzt herunterladen?`,

  // ── Casey’s AI in a self-built (open-source) 900words ─────────────────────
  ossCaseyHeading: 'Caseys KI',
  ossCaseyHelp: 'Das ist ein selbst gebautes 900words. Casey braucht eine KI zum Spielen: deinen eigenen KI-Schlüssel oder Gemma auf diesem iPhone.',
  ownKeyOption: 'Dein eigener KI-Schlüssel',
  ownKeyHelp: 'Jeder OpenAI-kompatible Dienst. Dein Schlüssel wird nur auf diesem Gerät gespeichert und nur an die Adresse unten gesendet.',
  ownKeyAddressLabel: 'Adresse des Dienstes',
  ownKeyModelLabel: 'Modell',
  ownKeyKeyLabel: 'API-Schlüssel',
  ownKeyAnswered: 'Dein KI-Dienst hat geantwortet.',
  gemmaOption: 'Gemma auf diesem iPhone',
  gemmaOptionHelp: 'Casey spielt auf diesem iPhone, ohne Internet und ohne Schlüssel. Sie ist langsamer.',
  serverOption: 'Dein eigener Casey-Server',
  serverOptionHelp: 'Ein Casey-Worker, den du selbst bereitgestellt hast (siehe README).',
  ossGemmaFirstRun: (size, iphones, lowMemory) =>
    `Dieses 900words spielt mit Casey auf deinem iPhone: ohne Konto und ohne Schlüssel. Sie ist ein einmaliger Download (${size}). Nutze WLAN und lass 900words geöffnet, bis er fertig ist.\n\nSie braucht ein neueres iPhone: ${iphones}.${lowMemory ? '\n\nDieses iPhone hat weniger Arbeitsspeicher als diese Modelle. Vielleicht läuft sie darauf nicht.' : ''}\n\nDu kannst in den Einstellungen auch deinen eigenen KI-Schlüssel hinzufügen.\n\nCasey jetzt herunterladen?`,

  // ── die Verbindungsprüfung ───────────────────────────────────────────────
  testRunning: 'Wird getestet…',
  testGemmaButton: 'Casey auf dem Gerät testen',
  testConnectionButton: 'Verbindung testen',
  connectionFailed: 'Verbindung fehlgeschlagen.',
  gemmaAnswered: 'Gemma hat auf diesem iPhone geantwortet.',
  normalCaseyAnswered: 'Normale Ollama-Casey hat geantwortet.',
  customCaseyAnswered: 'Der eigene Casey-Dienst hat geantwortet.',

  // ── das Spiel ────────────────────────────────────────────────────────────
  gameHeading: 'Spiel',
  soundLabel: 'Wörter vorlesen, wenn du sie antippst',
  soundHelp:
    'Nichts spielt von selbst - jeder Ton folgt auf ein Antippen, auch bei Caseys Rateversuchen.',
  lookupExampleLabel: 'Spiele den Beispielsatz ab, wenn du eine Übersetzung nachschlägst',
  lookupExampleHelp: 'Wenn aus, nutzt das Nachschlagen die Wort-Audioeinstellung.',
  replayIntroButton: 'Intro wiederholen',
  replayIntroHelp: 'Caseys Vorstellung noch einmal. An deinem Fortschritt ändert sich nichts.',

  // ── der Schalter für den Playtest ────────────────────────────────────────
  playtestHeading: 'TestFlight-Playtest',
  playtestTravelLabel: 'Städte überspringen und jeden Zug nehmen',
  playtestTravelHelp:
    'Der Sprung selbst passiert auf der Karte: eine Station voraus wählen und Vorausreisen. Das packt keine Wörter ein und zählt nicht als Lernfortschritt; schalte es aus, um die normale Freigabe der Weiterfahrt wieder zu testen.',

  // ── der Schalter für die tägliche Erinnerung ─────────────────────────────
  reminderHeading: 'Tägliche Erinnerung',
  reminderWebNote:
    'Tägliche Erinnerungen gibt es in der 900words-App fürs iPhone. Dieser Browser fragt nie nach der Erlaubnis für Mitteilungen.',
  reminderDeniedNote:
    'Die iPhone-Mitteilungen für 900words sind aus. Schalte sie in den iPhone-Einstellungen ein und komm dann hierher zurück, um Caseys tägliche Erinnerung einzurichten.',
  reminderOpenSettingsButton: 'Mitteilungseinstellungen öffnen',
  // `time` kommt als „15:00“ - das „Uhr“ steht darum hier.
  reminderOnNote: (time) => `Casey meldet sich um ${time} Uhr auf diesem iPhone.`,
  reminderTurningOff: 'Wird ausgeschaltet…',
  reminderTurnOffButton: 'Tägliche Erinnerung ausschalten',
  reminderOffNote: (time) =>
    `Casey kann dir um ${time} Uhr eine lokale Erinnerung schicken. Die Nachricht entsteht auf diesem iPhone aus der Zahl deiner abgeschlossenen Tage; kein Gerätetoken und kein Lernverlauf verlässt das Gerät.`,
  reminderAsking: 'iPhone wird gefragt…',
  reminderTurnOnButton: 'Tägliche Erinnerung einschalten',

  // ── deine Sammlung: die Sicherung ────────────────────────────────────────
  collectionHeading: 'Sicherung',
  backupIntro:
    'Deine Sammlung liegt nur auf diesem Telefon. Eine Sicherung ist eine kleine Datei - bewahre eine an einem sicheren Ort auf, bevor du das Telefon wechselst oder deine Browserdaten löschst.',
  backupSaveButton: 'Sicherung speichern',
  backupRestoreButton: 'Aus Datei wiederherstellen',
  backupShared: 'Sicherung an dein Telefon übergeben.',
  backupDownloaded: 'Sicherung heruntergeladen.',
  backupHideText: 'Textsicherung ausblenden',
  backupShowText: 'Keine Dateiauswahl? Dann als Text',
  backupCopyButton: 'Sammlung kopieren',
  backupCopied: 'Sicherung in die Zwischenablage kopiert.',
  backupPasteLabel: 'Sicherung hier einfügen',
  backupReadButton: 'Einlesen',
  backupHoldsHeading: 'Diese Sicherung enthält',
  backupCollectedAfter: (met) => `gesammelte Wörter, insgesamt ${met} begegnet`,
  backupWrappedAfter: (city) => `eingewickelt · ${city}`,
  backupGamesLine: (games, savedOn) =>
    `${games} ${games === 1 ? 'Runde' : 'Runden'} gespielt · gesichert am ${savedOn}`,
  backupMergeButton: 'Zusammenführen',
  backupReplaceButton: 'Alles ersetzen',
  backupCancelButton: 'Abbrechen',
  backupChoiceNote:
    'Beim Zusammenführen bleibt für jedes Wort der bessere der beiden Einträge - es kann dich also nie eine grüne Karte kosten. Ersetzen wirft den Fortschritt dieses Geräts weg.',
  backupReplaceConfirm:
    'Alles auf diesem Gerät durch die Sicherung ersetzen? Alles, was du seit der Sicherung gelernt hast, geht verloren.',
  backupMerged: (collected) =>
    `Zusammengeführt. Nichts von dir ging verloren - ${collected} gesammelte Wörter kamen dazu.`,
  backupRestored: (collected, wrapped) =>
    `${collected} gesammelte und ${wrapped} eingewickelte Wörter wiederhergestellt.`,

  // ── das Hinweisprotokoll des Entwicklers ─────────────────────────────────
  clueLedgerHeading: 'Caseys Hinweise',

  // ── Daten ────────────────────────────────────────────────────────────────
  dataHeading: 'Daten',
  usageStatsLabel: 'Anonyme Nutzungsstatistik',
  usageStatsHelp:
    'Nur Zahlen - gespielte Runden, wo Spieler aufhören, ob Casey oder eine Aufnahme ausgefallen ist. Keine Wörter, keine Hinweise, keine Kennung irgendeiner Art.',
  usageStatsAria: 'Anonyme Nutzungsstatistik teilen',
  dataSharingPrivateTitle: 'Privates Spiel',
  dataSharingPrivateDetail: 'Keine optionalen Spieldaten verlassen dieses Telefon.',
  dataSharingDiagnosticsTitle: 'Anonyme Diagnosedaten',
  dataSharingDiagnosticsDetail:
    'Teilt Rundenzahlen und Ergebnisse, nie deine Wörter oder Hinweise.',
  dataSharingLearningTitle: 'Diagnosedaten + Lernbeispiele für Casey',
  dataSharingLearningDetail:
    'Teilt auch Hinweise, Rateversuche und Ergebnisse, damit Casey besser wird.',
  dataSharingAria: 'Datenfreigabe',
  dataSharingCloseAria: 'Ohne Auswahl schließen',
  dataSharingPromptTitle: 'Wie soll 900words dein Spiel nutzen?',
  dataSharingPromptNote:
    'Nichts ist vorausgewählt. Mit jeder Wahl bleibt dir das ganze Spiel offen, und du kannst sie in den Einstellungen ändern.',
  dataSharingSettingsNote:
    'Ohne Wahl gilt „Privates Spiel“. Das steuert nur optionale Ereignisse; Casey und die kurze Prüfung des nächsten Spielfelds verarbeiten weiterhin das Minimum an Daten, das zum Spielen nötig ist.',
  dataSharingDeleting: 'Geteilte Daten werden gelöscht…',
  dataSharingDeleteButton: 'Geteilte Daten löschen',
  resetConfirm: (language) =>
    `Den ganzen Lernfortschritt, deine ${language}-Reise und das laufende Spiel zurücksetzen?`,
  resetButton: 'Fortschritt zurücksetzen',

  // ── die Fußzeile mit der Version ─────────────────────────────────────────
  buildStamp: (stamp) => `Version ${stamp}`,
  testFlightBuild: (build) => `TestFlight-Build ${build} · `,
  keyboardReadoutNote: 'Tastaturanzeige an. Tippe fünfmal auf die Version, um sie auszublenden.',
  stateOn: 'an',
  stateOff: 'aus',
  composerRideWaiting: 'aus (wartet auf das Dokument)',
  composerRideButton: (state) => `Eingabe fährt mit: ${state}`,
  trainStoryButton: (state) => `Zuggeschichte: ${state}`,
  updateChecking: 'Wird geprüft…',
  checkUpdatesButton: 'Nach Updates suchen',
  updateCurrent: 'Alles aktuell.',
  updateFound:
    'Eine neuere Version wird geladen - schließe die App und öffne sie neu, um sie zu übernehmen.',
  updateCheckFailed: 'Prüfung nicht möglich. Schließe die App und öffne sie neu.',

  // ── Caseys eine Frage zur täglichen Erinnerung ───────────────────────────
  reminderPromptCloseAria: 'Jetzt nicht',
  reminderPromptTitle: 'Drei Spiele im Koffer!',
  reminderPromptBody: (time) =>
    `Damit ist dein Tag geschafft. Soll ich dich morgen gegen ${time} Uhr erinnern? Nur ein kleiner Schubs am Nachmittag - ausschalten kannst du ihn jederzeit in den Einstellungen.`,
  reminderPromptAccept: 'Ja, erinnere mich',
  reminderPromptAsking: 'Dein iPhone wird gefragt…',
  reminderPromptDecline: 'Nein, danke',

  // ── die tägliche Erinnerung selbst, auf dem Telefon geschrieben ──────────
  reminderDoneTitle: 'Casey hat für heute gepackt',
  reminderDoneBody: 'Drei Spiele liegen sicher im Koffer. Morgen machen wir weiter.',
  reminderOneLeftTitle: 'Ein kleines Spiel mit Casey?',
  reminderStreakBody: (days) =>
    `Noch ein Spiel heute, und deine Serie von ${days === 1 ? '1 Tag' : `${days} Tagen`} läuft weiter.`,
  reminderOneLeftBody: 'Noch ein Spiel, und die drei von heute liegen im Koffer.',
  reminderSeatTitle: 'Casey hat dir einen Platz freigehalten',
  reminderSeatBody: (games) =>
    `${games} ${games === 1 ? 'kleines Spiel' : 'kleine Spiele'} heute ${games === 1 ? 'reicht' : 'reichen'} für den Anfang einer Serie.`,
}
