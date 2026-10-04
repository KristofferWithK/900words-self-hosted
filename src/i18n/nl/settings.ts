import type { Catalogue } from '../en'

/**
 * Nederlands. Je/jij, nooit u; Casey is ‘zij’. Instellingen leggen uit, ze
 * spelen niet - Casey zelf spreekt hier alleen in de herinneringsvraag en in
 * de meldingen onderaan. Een hint is wat je in het spel geeft, een tip is wat
 * Casey op het beginscherm vertelt, en tikken doe je met je vinger.
 *
 * Inpakken doe je met een kaart in de inpakronde; verpakt IS een woord dat
 * die ronde heeft overleefd en in het vak ligt - dat is de telling die op het
 * beginscherm en op de kaart telt.
 */
export const settings: Catalogue['settings'] = {
  // ── het scherm ───────────────────────────────────────────────────────────
  title: 'Instellingen',
  backAria: 'Terug',

  // ── de taal die de app spreekt ───────────────────────────────────────────
  uiLanguageLabel: 'Jouw taal',
  uiLanguageHelp:
    'De taal waarin de app met je praat. Bij het wisselen laadt de app opnieuw; je verzameling en je reis blijven bewaard.',

  // ── de taal die je leert ─────────────────────────────────────────────────
  learnerLanguageLabel: 'Taal die je leert',
  learnerLanguageHelp:
    'Elke taal heeft een eigen reis. Schakel terug om verder te gaan waar je was gebleven.',

  // ── Casey’s brein ────────────────────────────────────────────────────────
  caseyBrainHeading: 'Casey’s brein',
  caseyServerNote:
    'Casey speelt via de eigen server van 900words. Je hoeft niets in te stellen; de knop hieronder controleert of ze antwoordt.',
  normalOllamaCaseyLabel: 'Normale Ollama-Casey',
  normalOllamaCaseyDetail: 'gpt-oss 120B · hints en gokken',
  normalOllamaCaseyAria: 'Normale Ollama-Casey gebruiken',
  normalCaseyOn: 'Normale Casey staat aan',
  normalCaseyOff: 'Normale Casey staat uit',
  prototypeOn: 'Agentloos prototype staat aan',
  customCaseyOn: 'Eigen Casey-dienst staat aan',
  normalCaseyDetail: 'Ollama speelt en vertaalt. Gemma staat uit.',
  gemmaModeDetail:
    'Gemma 4 E4B verzorgt hints en gokken. Ontbreekt een woord in het woordenboek, dan vraagt de app nog steeds Ollama.',
  prototypeDetail: 'Deze lokale testmodus is Casey niet, en ook geen Ollama of Gemma.',
  customCaseyDetail:
    'Er is een eigen Casey-Worker gekozen. Ontbreekt een woord in het woordenboek, dan vraagt de app online die dienst.',


  baseUrlLabel: 'Basis-URL',
  // Het pad /v1 staat als <code> tussen de twee helften, zonder eigen
  // witruimte - daarom dragen ze hun spaties zelf.
  baseUrlHelpBefore:
    'Wordt door de knop hierboven ingevuld - of typ het adres van je eigen Casey-Worker plus ',
  baseUrlHelpAfter:
    '. Het moet met https:// beginnen, zodat niets van je spel onversleuteld over de lijn gaat.',
  baseUrlUnusable: 'Deze basis-URL is niet te gebruiken.',

  // ── het model op het apparaat ────────────────────────────────────────────
  gemmaUnavailableNote: 'De offlinemodus werkt in de 900words-apps voor iPhone en Android.',
  gemmaReady: (size) => `Offline Casey is klaar (${size} op deze iPhone).`,
  gemmaRemoveConfirm: 'Offline Casey van deze iPhone verwijderen? Je kunt haar later opnieuw downloaden.',
  gemmaRemoveButton: 'Offline Casey verwijderen',
  gemmaProgressAria: 'Voortgang van de download van offline Casey',
  gemmaDownloading: (percent) => `${percent}% - houd 900words open op wifi.`,
  gemmaCancelDownloadButton: 'Download annuleren',
  gemmaDownloadNote: (size) =>
    `Offline Casey is een download van ${size}. Gebruik wifi en houd 900words open tot de download klaar is.`,
  gemmaDownloadButton: 'Offline Casey downloaden',
  gemmaDownloadFailed: 'Download mislukt.',

  // ── offline mode ─────────────────────────────────────────────────────────
  offlineModeHeading: 'Offlinemodus',
  offlineModeExperimentalTag: 'Experimenteel',
  offlineModeLabel: 'Spelen zonder internet',
  offlineModeHelp:
    'Normale Casey speelt via de server van 900words. Met de offlinemodus kun je een ronde afmaken met offline Casey op deze iPhone als het internet weg is. Ze is trager.',
  offlineModeAria: 'Offlinemodus',
  offlineModeExplain: (size, iphones, lowMemory) =>
    `De offlinemodus is experimenteel en wordt nog verbeterd.\n\nDe offlinemodus downloadt offline Casey (${size}) naar deze iPhone. Gebruik wifi en houd 900words open tot de download klaar is.\n\nOffline Casey speelt trager dan normale Casey.\n\nZe heeft een nieuwere iPhone nodig: ${iphones}.${lowMemory ? '\n\nDeze iPhone heeft minder geheugen dan die modellen. Misschien werkt ze er niet op.' : ''}\n\nNu downloaden?`,

  // ── Casey’s AI in a self-built (open-source) 900words ─────────────────────
  ossCaseyHeading: 'De AI van Casey',
  ossCaseyHelp: 'Deze 900words heb je zelf gebouwd. Casey heeft een AI nodig om te spelen: je eigen AI-sleutel of Gemma op deze iPhone.',
  ownKeyOption: 'Je eigen AI-sleutel',
  ownKeyHelp: 'Elke OpenAI-compatibele dienst. Je sleutel wordt alleen op dit apparaat bewaard en alleen naar het adres hieronder gestuurd.',
  ownKeyAddressLabel: 'Adres van de dienst',
  ownKeyModelLabel: 'Model',
  ownKeyKeyLabel: 'API-sleutel',
  ownKeyAnswered: 'Je AI-dienst heeft geantwoord.',
  gemmaOption: 'Gemma op deze iPhone',
  gemmaOptionHelp: 'Casey speelt op deze iPhone, zonder internet en zonder sleutel. Ze is trager.',
  ossCaseyHelpAndroid: 'Deze 900words heb je zelf gebouwd. Casey heeft een AI nodig om te spelen: je eigen AI-sleutel of Gemma op deze Android-telefoon.',
  gemmaOptionAndroid: 'Gemma op deze Android-telefoon',
  gemmaOptionHelpAndroid: 'Casey speelt op deze Android-telefoon, zonder internet en zonder sleutel. Ze is trager.',
  ossGemmaFirstRunAndroid: (size, phones, lowMemory) =>
    `Deze zelfgebouwde 900words speelt met Casey op deze Android-telefoon: geen account of sleutel nodig. Gemma hoeft maar één keer te worden gedownload (${size}). Gebruik wifi en houd 900words open tot de download klaar is.\n\nZe werkt het best op een recente Android-telefoon met minstens 12 GB geheugen, bijvoorbeeld ${phones}.${lowMemory ? '\n\nDeze telefoon heeft minder geheugen dan de aanbevolen modellen; misschien werkt ze niet goed.' : ''}\n\nJe kunt ook je eigen AI-sleutel toevoegen in Instellingen.\n\nCasey nu downloaden?`,
  serverOption: 'Je eigen Casey-server',
  serverOptionHelp: 'Een Casey-Worker die je zelf hebt uitgerold (zie de README).',
  // Gemma in the browser, in the desktop self-build (src/ai/gemma/web.ts).
  pcCaseyHelp: 'Deze 900words heb je zelf gebouwd. Casey heeft een AI nodig om te spelen: je eigen AI-sleutel of Gemma op deze computer.',
  pcGemmaOption: 'Gemma op deze computer',
  pcGemmaOptionHelp: 'Casey speelt op deze computer, zonder internet en zonder sleutel. Ze is trager.',
  pcGemmaNeeds: 'Gemma heeft Chrome of Edge met WebGPU nodig, op een computer met een videokaart.',
  pcGemmaExplain: (size) =>
    `Casey kan met Gemma op deze computer spelen: zonder internet en zonder sleutel. Gemma is een eenmalige download (${size}), blijft in deze browser en draait op je videokaart in Chrome of Edge. Ze is trager dan een AI-dienst en nog experimenteel.\n\nHoud dit tabblad open tot de download klaar is.\n\nGemma nu downloaden?`,
  pcGemmaReady: (size) =>
    `Gemma is klaar (${size} in deze browser).`,
  pcGemmaRemoveConfirm: 'Gemma uit deze browser verwijderen? Je kunt haar later opnieuw downloaden.',
  pcGemmaDownloading: (percent) =>
    `${percent}% - houd dit tabblad open.`,
  pcGemmaDownloadNote: (size) =>
    `Gemma is een download van ${size}. Houd dit tabblad open tot hij klaar is.`,
  pcGemmaAnswered: 'Gemma heeft geantwoord op deze computer.',
  ossOfflineLabel: 'Offline spelen als het internet wegvalt',
  ossOfflineHelp: 'Casey biedt dan aan de ronde met Gemma af te maken. De eerste keer wordt ze daarvoor gedownload.',
  ossGemmaFirstRun: (size, iphones, lowMemory) =>
    `Deze 900words speelt met Casey op je iPhone: zonder account en zonder sleutel. Ze is een eenmalige download (${size}). Gebruik wifi en houd 900words open tot de download klaar is.\n\nZe heeft een nieuwere iPhone nodig: ${iphones}.${lowMemory ? '\n\nDeze iPhone heeft minder geheugen dan die modellen. Misschien werkt ze er niet op.' : ''}\n\nJe kunt bij Instellingen ook je eigen AI-sleutel toevoegen.\n\nCasey nu downloaden?`,
  // ── offline Casey op Android ─────────────────────────────────────────────
  gemmaUnsupportedAndroidNote:
    'Offline Casey heeft een nieuwere Android-telefoon nodig: Android 12 of nieuwer en minstens 8 GB geheugen. Deze telefoon heeft dat niet.',
  gemmaReadyAndroid: (size) => `Offline Casey is klaar (${size} op deze telefoon).`,
  gemmaRemoveConfirmAndroid:
    'Offline Casey van deze telefoon verwijderen? Je kunt haar later opnieuw downloaden.',
  offlineModeHelpAndroid:
    'Normale Casey speelt via de server van 900words. Met de offlinemodus kun je een ronde afmaken met offline Casey op deze telefoon als het internet weg is. Ze is trager.',
  offlineModeExplainAndroid: (size, phones, lowMemory) =>
    `De offlinemodus is experimenteel en wordt nog verbeterd.\n\nDe offlinemodus downloadt offline Casey (${size}) naar deze telefoon. Gebruik wifi en houd 900words open tot de download klaar is.\n\nOffline Casey speelt trager dan normale Casey.\n\nZe heeft een nieuwere Android-telefoon nodig met 12 GB geheugen of meer, bijvoorbeeld ${phones}.${lowMemory ? '\n\nDeze telefoon heeft minder geheugen. Misschien werkt ze er niet op.' : ''}\n\nNu downloaden?`,
  gemmaAnsweredAndroid: 'Gemma heeft geantwoord op deze telefoon.',

  // ── de verbindingstest ───────────────────────────────────────────────────
  testRunning: 'Testen…',
  testGemmaButton: 'Casey op dit apparaat testen',
  testConnectionButton: 'Verbinding testen',
  connectionFailed: 'Verbinding mislukt.',
  gemmaAnswered: 'Gemma heeft geantwoord op deze iPhone.',
  normalCaseyAnswered: 'Normale Ollama-Casey heeft geantwoord.',
  customCaseyAnswered: 'De eigen Casey-dienst heeft geantwoord.',


  // ── het spel ─────────────────────────────────────────────────────────────
  gameHeading: 'Spel',
  soundLabel: 'Woorden uitspreken als je erop tikt',
  soundHelp:
    'Er speelt niets vanzelf - elk geluid volgt op een tik, ook bij Casey’s gokken.',
  lookupExampleLabel: 'Speel de voorbeeldzin af wanneer je een vertaling opzoekt',
  lookupExampleHelp: 'Uit gebruikt opzoeken de instelling voor woordgeluid.',
  replayIntroButton: 'Intro opnieuw afspelen',
  replayIntroHelp: 'Casey’s kennismaking, nog een keer. Aan je voortgang verandert niets.',

  // ── de reisgereedschappen voor de playtest ───────────────────────────────
  playtestHeading: 'TestFlight-playtest',
  playtestTravelLabel: 'Laat me steden overslaan en elke trein nemen',




  // ── de schakelaar voor de dagelijkse herinnering ─────────────────────────
  reminderHeading: 'Dagelijkse herinnering',
  reminderWebNote:
    'Dagelijkse herinneringen zitten in de 900words-app voor iPhone. Deze browser vraagt nooit om toestemming voor meldingen.',
  reminderDeniedNote:
    'Meldingen van 900words staan uit op deze iPhone. Zet ze aan in de iPhone-instellingen en kom dan hier terug om Casey’s dagelijkse herinnering in te plannen.',
  reminderOpenSettingsButton: 'Meldingsinstellingen openen',
  // `time` komt als ‘15:00’ - het ‘uur’ staat daarom hier.
  reminderOnNote: (time) => `Casey meldt zich om ${time} uur op deze iPhone.`,
  reminderTurningOff: 'Uitzetten…',
  reminderTurnOffButton: 'Dagelijkse herinnering uitzetten',
  reminderOffNote: (time) =>
    `Casey kan om ${time} uur één lokale herinnering sturen. Het bericht wordt op deze iPhone gemaakt uit je aantal afgeronde dagen; er verlaat geen apparaattoken en geen leergeschiedenis het toestel.`,
  reminderAsking: 'iPhone vragen…',
  reminderTurnOnButton: 'Dagelijkse herinnering aanzetten',

  // ── je verzameling: de back-up ───────────────────────────────────────────
  collectionHeading: 'Back-up',
  backupIntro:
    'Je verzameling staat alleen op deze telefoon. Een back-up is één klein bestand - bewaar er een op een veilige plek voordat je van telefoon wisselt of je browsergegevens wist. Je API-sleutel zit er nooit in.',
  backupSaveButton: 'Back-up opslaan',
  backupRestoreButton: 'Herstellen uit bestand',
  backupShared: 'Back-up aan je telefoon gegeven.',
  backupDownloaded: 'Back-up gedownload.',
  backupHideText: 'Tekstback-up verbergen',
  backupShowText: 'Geen bestandskiezer? Gebruik tekst',
  backupCopyButton: 'Mijn verzameling kopiëren',
  backupCopied: 'Back-up naar het klembord gekopieerd.',
  backupPasteLabel: 'Plak hier een back-up',
  backupReadButton: 'Inlezen',
  backupHoldsHeading: 'Deze back-up bevat',
  backupCollectedAfter: (met) => `verzamelde woorden, ${met} in totaal tegengekomen`,
  backupWrappedAfter: (city) => `verpakt · ${city}`,
  backupGamesLine: (games, savedOn) =>
    `${games} ${games === 1 ? 'ronde' : 'rondes'} gespeeld · opgeslagen ${savedOn}`,
  backupMergeButton: 'Samenvoegen',
  backupReplaceButton: 'Alles vervangen',
  backupCancelButton: 'Annuleren',
  backupChoiceNote:
    'Samenvoegen houdt voor elk woord de beste van de twee versies, dus het kan je nooit een groene kaart kosten. Vervangen gooit de voortgang op dit apparaat weg.',
  backupReplaceConfirm:
    'Alles op dit apparaat vervangen door de back-up? Alles wat je sinds die back-up hebt geleerd, gaat verloren.',
  backupMerged: (collected) =>
    `Samengevoegd. Je bent niets kwijt - ${collected} verzamelde woorden zijn erbij gekomen.`,
  backupRestored: (collected, wrapped) =>
    `${collected} verzamelde en ${wrapped} verpakte woorden hersteld.`,

  // ── het hintlogboek van de eigenaar ──────────────────────────────────────
  clueLedgerHeading: 'Casey’s hints',

  // ── gegevens ─────────────────────────────────────────────────────────────
  dataHeading: 'Gegevens',
  usageStatsLabel: 'Anonieme gebruiksstatistieken',
  usageStatsHelp:
    'Alleen aantallen - gespeelde rondes, waar spelers stoppen, of Casey of een opname het liet afweten. Geen woorden, geen hints, geen enkele identificatie.',
  usageStatsAria: 'Anonieme gebruiksstatistieken delen',
  dataSharingPrivateTitle: 'Privé spelen',
  dataSharingPrivateDetail: 'Er verlaten geen optionele spelgegevens deze telefoon.',
  dataSharingDiagnosticsTitle: 'Anonieme diagnose',
  dataSharingDiagnosticsDetail:
    'Deelt aantallen rondes en uitkomsten, nooit je woorden of hints.',
  dataSharingLearningTitle: 'Diagnose + leervoorbeelden voor Casey',
  dataSharingLearningDetail:
    'Deelt ook hints, gokken en uitkomsten, zodat Casey beter wordt.',
  dataSharingAria: 'Gegevens delen',
  dataSharingCloseAria: 'Sluiten zonder te kiezen',
  dataSharingPromptTitle: 'Hoe mag 900words je spel gebruiken?',
  dataSharingPromptNote:
    'Er is niets vooraf aangevinkt. Bij elke keuze blijft het hele spel open, en je kunt hem in Instellingen aanpassen.',
  dataSharingSettingsNote:
    'Zonder keuze geldt Privé spelen. Dit regelt alleen optionele gebeurtenissen; Casey en de korte controle van het volgende bord verwerken nog steeds het minimum aan gegevens dat nodig is om te spelen.',
  dataSharingDeleting: 'Gedeelde gegevens wissen…',
  dataSharingDeleteButton: 'Gedeelde gegevens wissen',
  resetConfirm: (language) =>
    `Alle leervoortgang, je reis door het ${language} en het huidige spel wissen?`,
  resetButton: 'Voortgang wissen',

  // ── de voettekst met de versie ───────────────────────────────────────────
  buildStamp: (stamp) => `Versie ${stamp}`,
  testFlightBuild: (build) => `TestFlight-build ${build} · `,
  keyboardReadoutNote: 'Toetsenbordweergave aan. Tik vijf keer op de versie om hem te verbergen.',
  stateOn: 'aan',
  stateOff: 'uit',
  composerRideWaiting: 'uit (wacht op het document)',
  composerRideButton: (state) => `Invoerveld rijdt mee: ${state}`,
  trainStoryButton: (state) => `Treinverhaal: ${state}`,


  updateChecking: 'Controleren…',
  checkUpdatesButton: 'Zoeken naar updates',
  updateCurrent: 'Je bent bij.',
  updateFound:
    'Er wordt een nieuwere versie gedownload - sluit de app en open hem opnieuw om die te gebruiken.',
  updateCheckFailed: 'Controleren lukte niet. Sluit de app en open hem opnieuw.',

  // ── Casey’s ene vraag over de dagelijkse herinnering ─────────────────────
  reminderPromptCloseAria: 'Niet nu',
  reminderPromptTitle: 'Drie spelletjes in de koffer!',
  reminderPromptBody: (time) =>
    `Dat is een dag vol. Zal ik je morgen rond ${time} uur herinneren? Eén klein duwtje in de middag, en je zet het uit in Instellingen wanneer je maar wilt.`,
  reminderPromptAccept: 'Ja, herinner me',
  reminderPromptAsking: 'Je iPhone vragen…',
  reminderPromptDecline: 'Nee, bedankt',

  // ── de dagelijkse herinnering zelf, geschreven op de telefoon ────────────
  reminderDoneTitle: 'Casey zit vol voor vandaag',
  reminderDoneBody: 'Drie spelletjes zitten veilig in de koffer. Morgen gaan we verder.',
  reminderOneLeftTitle: 'Nog één spelletje met Casey?',
  reminderStreakBody: (days) =>
    `Nog één spelletje vandaag en je reeks van ${days} ${days === 1 ? 'dag' : 'dagen'} loopt door.`,
  reminderOneLeftBody: 'Nog één spelletje en de drie van vandaag zitten in de koffer.',
  reminderSeatTitle: 'Casey heeft een plekje voor je vrijgehouden',
  reminderSeatBody: (games) =>
    `${games} ${games === 1 ? 'klein spelletje' : 'kleine spelletjes'} vandaag ${games === 1 ? 'is' : 'zijn'} genoeg om een reeks te beginnen.`,

  // ── de aanbieder-chip (src/ai/providers.ts) ──────────────────────────────



  // Current Settings and German-preview integration.
  learnerLanguagePreviewTag: "voorproefje",
  learnerLanguagePreviewHelp: "Duits is een voorproefje: de kaart en de Reisgids zijn er al, het woordspel nog niet. De lessen zijn nog niet nagekeken door iemand met Duits als moedertaal.",
  playtestTravelHelp: "Vooruitspringen doe je op de kaart: kies een latere halte en reis vooruit. Er worden geen woorden ingepakt en je leerresultaten veranderen niet. Zet dit uit om de normale reisvoorwaarden weer te testen.",

  // ── Google Play review access (Android store build only) ───────────────
  reviewAccessHeading: 'Toegang voor de Google Play-beoordeling',
  reviewAccessHelp: 'Alleen voor de app-beoordeling door Google Play. Voer de beoordelingscode uit de instructies in om onbeperkt spelen op dit apparaat te ontgrendelen.',
  reviewAccessLabel: 'Beoordelingscode',
  reviewAccessUnlock: 'Ontgrendelen',
  reviewAccessChecking: 'Controleren…',
  reviewAccessOn: (date: string) =>
    `Beoordelingstoegang staat aan. Onbeperkt spelen is op dit apparaat ontgrendeld tot ${date}.`,
  reviewAccessInvalid: 'Die beoordelingscode is niet geaccepteerd.',
  reviewAccessRateLimited: 'Te veel pogingen. Probeer het morgen nog eens.',
  reviewAccessError: 'De code kon niet worden gecontroleerd. Controleer de internetverbinding en probeer het nog eens.',

  // ── Jouw plan (alleen in de store-builds). Apple op iOS, Google Play op Android.
  planHeading: 'Jouw plan',
  planFreeShort: 'Gratis',
  planUnlimitedShort: 'Onbeperkt',
  planChipAria: (plan: string) => `Jouw plan: ${plan}`,
  planChecking: 'Je plan wordt gecontroleerd bij Apple.',
  planCheckingPlay: 'Je plan wordt gecontroleerd bij Google Play.',
  planFree: 'Gratis plan. Twee wandelingen en twee cafépuzzels per dag.',
  planMonthly: 'Onbeperkt spelen. Maandabonnement. Het wordt elke maand verlengd totdat je opzegt.',
  planLifetime: 'Onbeperkt spelen. Eenmalige aankoop. Er wordt niets verlengd.',
  planBoth: 'Je hebt de eenmalige aankoop. Je maandabonnement loopt nog, en je hebt het niet meer nodig. Zeg het op, zodat je niet opnieuw betaalt.',
  planError: 'Apple kon je plan nu niet controleren. Probeer het later opnieuw.',
  planErrorPlay: 'Google Play kon je plan nu niet controleren. Probeer het later opnieuw.',
  planGetUnlimited: 'Onbeperkt spelen',
  planManage: 'Abonnement beheren of opzeggen',
  planSwitch: 'Overstappen op eenmalige aankoop',
  planSwitchNote: 'Met de eenmalige aankoop speel je voor altijd onbeperkt. Je maandabonnement stopt daardoor niet. Zeg na de aankoop het maandabonnement op via je Apple Account, anders betaal je voor allebei.',
  planSwitchNotePlay: 'Met de eenmalige aankoop speel je voor altijd onbeperkt. Je maandabonnement stopt daardoor niet. Zeg na de aankoop het maandabonnement op in Google Play, anders betaal je voor allebei.',
  planBuyFor: (price: string) => `Kopen voor ${price}`,
  planNotNow: 'Niet nu',
}
