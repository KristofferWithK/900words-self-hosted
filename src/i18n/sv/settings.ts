import type { Catalogue } from '../en'

/**
 * Svenska. Du; Casey är ”hon”. Inställningar förklarar, de spelar inte upp
 * något - Casey själv talar bara i påminnelsefrågan och i notiserna längst
 * ner. Det är ”tryck på”, aldrig ”tappa”; en gissning är en gissning, ett tips
 * är Caseys råd på Hem.
 */
export const settings: Catalogue['settings'] = {
  // ── skärmen ──────────────────────────────────────────────────────────────
  title: 'Inställningar',
  backAria: 'Tillbaka',

  // ── språket appen talar ──────────────────────────────────────────────────
  uiLanguageLabel: 'Ditt språk',
  uiLanguageHelp:
    'Språket appen talar med dig. Byter du laddas appen om; din samling och din resa behålls.',

  // ── språket du lär dig ───────────────────────────────────────────────────
  learnerLanguageLabel: 'Språket du lär dig',
  learnerLanguageHelp:
    'Varje språk har sin egen resa. Byt tillbaka för att fortsätta där du slutade.',

  // ── Caseys hjärna ────────────────────────────────────────────────────────
  caseyBrainHeading: 'Caseys hjärna',
  caseyServerNote:
    'Casey spelar från 900words egen server. Inget behöver ställas in; knappen nedan kontrollerar att hon svarar.',
  normalOllamaCaseyLabel: 'Vanliga Ollama-Casey',
  normalOllamaCaseyDetail: 'gpt-oss 120B · ledtrådar och gissningar',
  normalOllamaCaseyAria: 'Använd vanliga Ollama-Casey',
  normalCaseyOn: 'Vanliga Casey är på',
  normalCaseyOff: 'Vanliga Casey är av',
  prototypeOn: 'Agentlös prototyp är på',
  customCaseyOn: 'Egen Casey-tjänst är på',
  normalCaseyDetail: 'Ollama spelar och översätter. Gemma är av.',
  gemmaModeDetail:
    'Gemma 4 E4B sköter ledtrådar och gissningar. Ord som saknas i ordboken går fortfarande till Ollama.',
  prototypeDetail: 'Det här lokala testläget är varken Casey, Ollama eller Gemma.',
  customCaseyDetail:
    'En egen Casey-Worker är vald. Ord som saknas i ordboken slås upp online via den tjänsten.',


  baseUrlLabel: 'Bas-URL',
  // Sökvägen /v1 står som <code> mellan de två halvorna, utan eget
  // mellanrum - därför bär de sina blanksteg själva.
  baseUrlHelpBefore: 'Sätts av knappen ovan, eller skriv adressen till din egen Casey-Worker plus ',
  baseUrlHelpAfter:
    '. Den måste börja med https://, så att inget om ditt spel skickas okrypterat.',
  baseUrlUnusable: 'Den bas-URL:en kan inte användas.',

  // ── modellen på enheten ──────────────────────────────────────────────────
  gemmaUnavailableNote: 'Offlineläget fungerar i 900words appar för iPhone och Android.',
  gemmaReady: (size) => `Offline-Casey är klar (${size} på den här iPhonen).`,
  gemmaRemoveConfirm: 'Ta bort offline-Casey från den här iPhonen? Du kan ladda ner henne igen senare.',
  gemmaRemoveButton: 'Ta bort offline-Casey',
  gemmaProgressAria: 'Förlopp för nedladdningen av offline-Casey',
  gemmaDownloading: (percent) => `${percent} % - håll 900words öppet på wifi.`,
  gemmaCancelDownloadButton: 'Avbryt nedladdningen',
  gemmaDownloadNote: (size) =>
    `Offline-Casey är en nedladdning på ${size}. Använd wifi och håll 900words öppen tills den är klar.`,
  gemmaDownloadButton: 'Ladda ner offline-Casey',
  gemmaDownloadFailed: 'Nedladdningen misslyckades.',

  // ── offline mode ─────────────────────────────────────────────────────────
  offlineModeHeading: 'Offlineläge',
  offlineModeExperimentalTag: 'Experimentellt',
  offlineModeLabel: 'Spela utan internet',
  offlineModeHelp:
    'Vanliga Casey spelar via 900words server. Med offlineläget kan du spela klart en runda med offline-Casey på den här iPhonen när internet är borta. Hon är långsammare.',
  offlineModeAria: 'Offlineläge',
  offlineModeExplain: (size, iphones, lowMemory) =>
    `Offlineläget är experimentellt och förbättras fortfarande.\n\nOfflineläget laddar ner offline-Casey (${size}) till den här iPhonen. Använd wifi och håll 900words öppen tills nedladdningen är klar.\n\nOffline-Casey spelar långsammare än vanliga Casey.\n\nHon behöver en nyare iPhone: ${iphones}.${lowMemory ? '\n\nDen här iPhonen har mindre minne än de modellerna. Hon kanske inte fungerar på den.' : ''}\n\nLadda ner nu?`,

  // ── Casey’s AI in a self-built (open-source) 900words ─────────────────────
  ossCaseyHeading: 'Caseys AI',
  ossCaseyHelp: 'Det här är ett egenbyggt 900words. Casey behöver en AI att spela med: din egen AI-nyckel eller Gemma på den här iPhonen.',
  ownKeyOption: 'Din egen AI-nyckel',
  ownKeyHelp: 'Vilken OpenAI-kompatibel tjänst som helst. Din nyckel sparas bara på den här enheten och skickas bara till adressen nedan.',
  ownKeyAddressLabel: 'Tjänstens adress',
  ownKeyModelLabel: 'Modell',
  ownKeyKeyLabel: 'API-nyckel',
  ownKeyAnswered: 'Din AI-tjänst svarade.',
  gemmaOption: 'Gemma på den här iPhonen',
  gemmaOptionHelp: 'Casey spelar på den här iPhonen, utan internet och utan nyckel. Hon är långsammare.',
  ossCaseyHelpAndroid: 'Det här är ett egenbyggt 900words. Casey behöver en AI att spela med: din egen AI-nyckel eller Gemma på den här Android-telefonen.',
  gemmaOptionAndroid: 'Gemma på den här Android-telefonen',
  gemmaOptionHelpAndroid: 'Casey spelar på den här Android-telefonen, utan internet och utan nyckel. Hon är långsammare.',
  ossGemmaFirstRunAndroid: (size, phones, lowMemory) =>
    `Det här egenbyggda 900words spelar med Casey på den här Android-telefonen: inget konto eller någon nyckel behövs. Gemma behöver bara hämtas en gång (${size}). Använd wifi och låt 900words vara öppet tills hämtningen är klar.\n\nHon fungerar bäst på en nyare Android-telefon med minst 12 GB minne, till exempel ${phones}.${lowMemory ? '\n\nDen här telefonen har mindre minne än de rekommenderade modellerna, så hon kanske inte fungerar bra.' : ''}\n\nDu kan också lägga till din egen AI-nyckel i Inställningar.\n\nHämta Casey nu?`,
  serverOption: 'Din egen Casey-server',
  serverOptionHelp: 'En Casey-Worker som du själv har driftsatt (se README).',
  // Gemma in the browser, in the desktop self-build (src/ai/gemma/web.ts).
  pcCaseyHelp: 'Det här är ett egenbyggt 900words. Casey behöver en AI att spela med: din egen AI-nyckel eller Gemma på den här datorn.',
  pcGemmaOption: 'Gemma på den här datorn',
  pcGemmaOptionHelp: 'Casey spelar på den här datorn, utan internet och utan nyckel. Hon är långsammare.',
  pcGemmaNeeds: 'Gemma behöver Chrome eller Edge med WebGPU, på en dator med grafikkort.',
  pcGemmaExplain: (size) =>
    `Casey kan spela med Gemma på den här datorn: utan internet och utan nyckel. Gemma är en engångsnedladdning (${size}), sparas i den här webbläsaren och körs på ditt grafikkort i Chrome eller Edge. Hon är långsammare än en AI-tjänst och fortfarande experimentell.\n\nHåll den här fliken öppen tills nedladdningen är klar.\n\nLadda ner Gemma nu?`,
  pcGemmaReady: (size) =>
    `Gemma är klar (${size} i den här webbläsaren).`,
  pcGemmaRemoveConfirm: 'Ta bort Gemma från den här webbläsaren? Du kan ladda ner henne igen senare.',
  pcGemmaDownloading: (percent) =>
    `${percent} % - håll den här fliken öppen.`,
  pcGemmaDownloadNote: (size) =>
    `Gemma är en nedladdning på ${size}. Håll den här fliken öppen tills den är klar.`,
  pcGemmaAnswered: 'Gemma svarade på den här datorn.',
  ossOfflineLabel: 'Spela offline när internet försvinner',
  ossOfflineHelp: 'Casey erbjuder då att spela klart rundan med Gemma. Första gången laddas hon ner.',
  ossGemmaFirstRun: (size, iphones, lowMemory) =>
    `Det här 900words spelar med Casey på din iPhone: inget konto och ingen nyckel. Hon laddas ner en gång (${size}). Använd wifi och håll 900words öppen tills nedladdningen är klar.\n\nHon behöver en nyare iPhone: ${iphones}.${lowMemory ? '\n\nDen här iPhonen har mindre minne än de modellerna. Hon kanske inte fungerar på den.' : ''}\n\nDu kan också lägga till din egen AI-nyckel i Inställningar.\n\nLadda ner Casey nu?`,
  // ── offline-Casey på Android ─────────────────────────────────────────────
  gemmaUnsupportedAndroidNote:
    'Offline-Casey behöver en nyare Android-telefon: Android 12 eller senare och minst 8 GB minne. Den här telefonen har inte det.',
  gemmaReadyAndroid: (size) => `Offline-Casey är klar (${size} på den här telefonen).`,
  gemmaRemoveConfirmAndroid:
    'Ta bort offline-Casey från den här telefonen? Du kan ladda ner henne igen senare.',
  offlineModeHelpAndroid:
    'Vanliga Casey spelar via 900words server. Med offlineläget kan du spela klart en runda med offline-Casey på den här telefonen när internet är borta. Hon är långsammare.',
  offlineModeExplainAndroid: (size, phones, lowMemory) =>
    `Offlineläget är experimentellt och förbättras fortfarande.\n\nOfflineläget laddar ner offline-Casey (${size}) till den här telefonen. Använd wifi och håll 900words öppen tills nedladdningen är klar.\n\nOffline-Casey spelar långsammare än vanliga Casey.\n\nHon behöver en nyare Android-telefon med 12 GB minne eller mer, till exempel ${phones}.${lowMemory ? '\n\nDen här telefonen har mindre minne än så. Hon kanske inte fungerar på den.' : ''}\n\nLadda ner nu?`,
  gemmaAnsweredAndroid: 'Gemma svarade på den här telefonen.',

  // ── anslutningstestet ────────────────────────────────────────────────────
  testRunning: 'Testar…',
  testGemmaButton: 'Testa Casey på enheten',
  testConnectionButton: 'Testa anslutningen',
  connectionFailed: 'Anslutningen misslyckades.',
  gemmaAnswered: 'Gemma svarade på den här iPhonen.',
  normalCaseyAnswered: 'Vanliga Ollama-Casey svarade.',
  customCaseyAnswered: 'Den egna Casey-tjänsten svarade.',


  // ── spelet ───────────────────────────────────────────────────────────────
  gameHeading: 'Spel',
  soundLabel: 'Säg orden högt när du trycker på dem',
  soundHelp: 'Inget spelas av sig självt - varje ljud följer på ett tryck, Caseys gissningar inräknade.',
  lookupExampleLabel: 'Spela exempelmeningen när du slår upp en översättning',
  lookupExampleHelp: 'När den är av använder uppslagningen inställningen för ordljud.',
  replayIntroButton: 'Visa introt igen',
  replayIntroHelp: 'Caseys presentation en gång till. Inget i dina framsteg ändras.',

  // ── reseverktygen för speltestet ─────────────────────────────────────────
  playtestHeading: 'TestFlight-speltest',
  playtestTravelLabel: 'Låt mig hoppa mellan städer och ta vilket tåg som helst',




  // ── brytaren för den dagliga påminnelsen ─────────────────────────────────
  reminderHeading: 'Daglig påminnelse',
  reminderWebNote:
    'Dagliga påminnelser finns i 900words iPhone-app. Den här webbläsaren ber aldrig om tillåtelse för notiser.',
  reminderDeniedNote:
    'Notiser från 900words är av på iPhonen. Slå på dem i iPhonens Inställningar och kom sedan tillbaka hit för att schemalägga Caseys dagliga påminnelse.',
  reminderOpenSettingsButton: 'Öppna notisinställningarna',
  // `time` kommer som ”15:00” - därför står ”kl.” här.
  reminderOnNote: (time) => `Casey hör av sig kl. ${time} på den här iPhonen.`,
  reminderTurningOff: 'Stänger av…',
  reminderTurnOffButton: 'Stäng av daglig påminnelse',
  reminderOffNote: (time) =>
    `Casey kan skicka en lokal påminnelse kl. ${time}. Meddelandet skrivs på den här iPhonen utifrån antalet avklarade dagar; ingen enhetstoken och ingen inlärningshistorik lämnar den.`,
  reminderAsking: 'Frågar iPhonen…',
  reminderTurnOnButton: 'Slå på daglig påminnelse',

  // ── din samling: säkerhetskopian ─────────────────────────────────────────
  collectionHeading: 'Säkerhetskopia',
  backupIntro:
    'Din samling finns bara på den här telefonen. En säkerhetskopia är en liten fil - lägg en på ett säkert ställe innan du byter telefon eller rensar webbläsardata. Din API-nyckel finns aldrig i den.',
  backupSaveButton: 'Spara säkerhetskopia',
  backupRestoreButton: 'Återställ från fil',
  backupShared: 'Säkerhetskopian lämnad till telefonen.',
  backupDownloaded: 'Säkerhetskopian nedladdad.',
  backupHideText: 'Dölj textkopian',
  backupShowText: 'Ingen filväljare? Använd text i stället',
  backupCopyButton: 'Kopiera min samling',
  backupCopied: 'Säkerhetskopian kopierad till urklipp.',
  backupPasteLabel: 'Klistra in en säkerhetskopia här',
  backupReadButton: 'Läs in',
  backupHoldsHeading: 'Den här kopian innehåller',
  backupCollectedAfter: (met) => `samlade ord, ${met} mötta totalt`,
  backupWrappedAfter: (city) => `inslagna · ${city}`,
  backupGamesLine: (games, savedOn) =>
    `${games} ${games === 1 ? 'runda spelad' : 'rundor spelade'} · sparad ${savedOn}`,
  backupMergeButton: 'Sammanfoga',
  backupReplaceButton: 'Ersätt allt',
  backupCancelButton: 'Avbryt',
  backupChoiceNote:
    'Sammanfogning behåller den bättre av de två posterna för varje ord, så det kan aldrig kosta dig ett grönt kort. Att ersätta kastar bort den här enhetens framsteg.',
  backupReplaceConfirm:
    'Ersätt allt på den här enheten med säkerhetskopian? Allt du har lärt dig sedan den gjordes går förlorat.',
  backupMerged: (collected) =>
    `Sammanfogat. Inget av ditt gick förlorat - ${collected} samlade ord lades till.`,
  backupRestored: (collected, wrapped) =>
    `Återställde ${collected} samlade och ${wrapped} inslagna ord.`,

  // ── ägarens ledtrådslogg ─────────────────────────────────────────────────
  clueLedgerHeading: 'Caseys ledtrådar',

  // ── data ─────────────────────────────────────────────────────────────────
  // Bara ”Data” vore identiskt med engelskan och stoppas av gate 3; ”Dina data”
  // är vad svenska Apple och Google skriver, så rubriken tar den formen.
  dataHeading: 'Data',
  usageStatsLabel: 'Anonym användningsstatistik',
  usageStatsHelp:
    'Bara antal - spelade rundor, var spelare slutar, om Casey eller en inspelning fallerade. Inga ord, inga ledtrådar, ingen identifierare av något slag.',
  usageStatsAria: 'Dela anonym användningsstatistik',
  dataSharingPrivateTitle: 'Privat spel',
  dataSharingPrivateDetail: 'Inga valfria speldata lämnar telefonen.',
  dataSharingDiagnosticsTitle: 'Anonym diagnostik',
  dataSharingDiagnosticsDetail: 'Dela antal rundor och utfall, aldrig dina ord eller ledtrådar.',
  dataSharingLearningTitle: 'Diagnostik + inlärningsexempel för Casey',
  dataSharingLearningDetail: 'Dela också ledtrådar, gissningar och utfall så att Casey kan bli bättre.',
  dataSharingAria: 'Datadelning',
  dataSharingCloseAria: 'Stäng utan att välja',
  dataSharingPromptTitle: 'Hur får 900words använda ditt spelande?',
  dataSharingPromptNote:
    'Inget är förvalt. Varje val håller hela spelet öppet, och du kan ändra det i Inställningar.',
  dataSharingSettingsNote:
    'Ett ogjort val fungerar som Privat spel. Det här styr bara valfria händelser; Casey och den tillfälliga kontrollen av nästa spelplan behandlar ändå det minimum av data som krävs för att spela.',
  dataSharingDeleting: 'Raderar delade data…',
  dataSharingDeleteButton: 'Radera delade data',
  resetConfirm: (language) =>
    `Nollställa alla framsteg, din ${language}-resa och det pågående spelet?`,
  resetButton: 'Nollställ framsteg',

  // ── sidfoten med versionen ───────────────────────────────────────────────
  buildStamp: (stamp) => `Version ${stamp}`,
  testFlightBuild: (build) => `TestFlight-bygge ${build} · `,
  keyboardReadoutNote: 'Tangentbordsavläsning på. Tryck fem gånger på versionen för att dölja den.',
  stateOn: 'på',
  stateOff: 'av',
  composerRideWaiting: 'av (väntar på dokumentet)',
  composerRideButton: (state) => `Fältet följer med: ${state}`,
  trainStoryButton: (state) => `Tågberättelse: ${state}`,


  updateChecking: 'Kontrollerar…',
  checkUpdatesButton: 'Sök efter uppdateringar',
  updateCurrent: 'Redan uppdaterad.',
  updateFound: 'En nyare version laddas ner - stäng appen och öppna den igen för att ta den i bruk.',
  updateCheckFailed: 'Kunde inte kontrollera. Stäng appen och öppna den igen i stället.',

  // ── Caseys enda fråga om den dagliga påminnelsen ─────────────────────────
  reminderPromptCloseAria: 'Inte nu',
  reminderPromptTitle: 'Tre spel i väskan!',
  reminderPromptBody: (time) =>
    `Det räcker för en dag. Ska jag påminna dig i morgon, runt ${time}? En liten puff på eftermiddagen, och du kan stänga av den i Inställningar när du vill.`,
  reminderPromptAccept: 'Ja, påminn mig',
  reminderPromptAsking: 'Frågar din iPhone…',
  reminderPromptDecline: 'Nej tack',

  // ── den dagliga påminnelsen själv, skriven på telefonen ──────────────────
  reminderDoneTitle: 'Casey har packat klart för i dag',
  reminderDoneBody: 'Tre spel ligger tryggt i väskan. Vi fortsätter i morgon.',
  reminderOneLeftTitle: 'Ett litet spel med Casey?',
  reminderStreakBody: (days) =>
    `Håll igång din svit på ${days} ${days === 1 ? 'dag' : 'dagar'} med ett spel till i dag.`,
  reminderOneLeftBody: 'Ett spel till så ligger dagens tre i väskan.',
  reminderSeatTitle: 'Casey har sparat en plats åt dig',
  reminderSeatBody: (games) =>
    `${games} ${games === 1 ? 'litet spel' : 'små spel'} i dag räcker för att börja en svit.`,

  // ── leverantörsmärket ────────────────────────────────────────────────────



  // Current Settings and German-preview integration.
  learnerLanguagePreviewTag: "förhandsversion",
  learnerLanguagePreviewHelp: "Tyska är en förhandsversion: kartan och Reseguiden finns, men inte ordspelet. Lektionerna har ännu inte granskats av någon med tyska som modersmål.",
  playtestTravelHelp: "Hoppa framåt på kartan: välj en senare hållplats och res vidare. Inga ord packas och inga framsteg i lärandet läggs till. Stäng av detta för att testa de vanliga resevillkoren igen.",

  // ── Google Play review access (Android store build only) ───────────────
  reviewAccessHeading: 'Åtkomst för Google Play-granskning',
  reviewAccessHelp: 'Endast för appgranskningen i Google Play. Ange granskningskoden från instruktionerna för att låsa upp obegränsat spelande på den här enheten.',
  reviewAccessLabel: 'Granskningskod',
  reviewAccessUnlock: 'Lås upp',
  reviewAccessChecking: 'Kontrollerar…',
  reviewAccessOn: (date: string) =>
    `Granskningsåtkomsten är på. Obegränsat spelande är upplåst på den här enheten till ${date}.`,
  reviewAccessInvalid: 'Den granskningskoden godtogs inte.',
  reviewAccessRateLimited: 'För många försök. Försök igen i morgon.',
  reviewAccessError: 'Koden kunde inte kontrolleras. Kontrollera internetanslutningen och försök igen.',

  // ── Din plan (bara i butiksversionerna). Apple på iOS, Google Play på Android.
  planHeading: 'Din plan',
  planFreeShort: 'Gratis',
  planUnlimitedShort: 'Obegränsat',
  planChipAria: (plan: string) => `Din plan: ${plan}`,
  planChecking: 'Kontrollerar din plan hos Apple.',
  planCheckingPlay: 'Kontrollerar din plan hos Google Play.',
  planFree: 'Gratisplan. Två promenader och två kafégåtor om dagen.',
  planMonthly: 'Obegränsat spelande. Månadsprenumeration. Den förnyas varje månad tills du säger upp den.',
  planLifetime: 'Obegränsat spelande. Engångsköp. Inget förnyas.',
  planBoth: 'Du äger engångsköpet. Din månadsprenumeration är fortfarande aktiv, och du behöver den inte längre. Säg upp den så att du inte debiteras igen.',
  planError: 'Apple kunde inte kontrollera din plan just nu. Försök igen senare.',
  planErrorPlay: 'Google Play kunde inte kontrollera din plan just nu. Försök igen senare.',
  planGetUnlimited: 'Spela obegränsat',
  planManage: 'Hantera eller avsluta prenumerationen',
  planSwitch: 'Byt till engångsköp',
  planSwitchNote: 'Engångsköpet ger dig obegränsat spelande för alltid. Det avslutar inte din månadsprenumeration. När du har köpt det, avsluta månadsprenumerationen på ditt Apple-konto, annars betalar du för båda.',
  planSwitchNotePlay: 'Engångsköpet ger dig obegränsat spelande för alltid. Det avslutar inte din månadsprenumeration. När du har köpt det, avsluta månadsprenumerationen i Google Play, annars betalar du för båda.',
  planBuyFor: (price: string) => `Köp för ${price}`,
  planNotNow: 'Inte nu',
}
