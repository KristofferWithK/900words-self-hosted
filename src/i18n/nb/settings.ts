import type { Catalogue } from '../en'

/**
 * Norsk bokmål. Du. Innstillinger forklarer, de spiller ikke - Casey selv
 * snakker bare i påminnelsesspørsmålet og i varslingene til slutt.
 * «Tips» er rådet hennes på Hjem; et hint er det du gir i spillet.
 */
export const settings: Catalogue['settings'] = {
  // ── skjermen ─────────────────────────────────────────────────────────────
  title: 'Innstillinger',
  backAria: 'Tilbake',

  // ── språket appen snakker ────────────────────────────────────────────────
  uiLanguageLabel: 'Språket ditt',
  uiLanguageHelp:
    'Språket appen snakker til deg på. Bytter du, lastes appen inn på nytt; samlingen og reisen din beholdes.',

  // ── språket du lærer ─────────────────────────────────────────────────────
  learnerLanguageLabel: 'Språk du lærer',
  learnerLanguageHelp:
    'Hvert språk har sin egen reise. Bytt tilbake for å fortsette der du slapp.',

  // ── Caseys hjerne ────────────────────────────────────────────────────────
  caseyBrainHeading: 'Caseys hjerne',
  caseyServerNote:
    'Casey spiller fra 900words’ egen server. Ingenting må settes opp; knappen under sjekker at hun svarer.',
  normalOllamaCaseyLabel: 'Vanlig Ollama-Casey',
  normalOllamaCaseyDetail: 'gpt-oss 120B · hint og gjetninger',
  normalOllamaCaseyAria: 'Bruk vanlig Ollama-Casey',
  normalCaseyOn: 'Vanlig Casey er på',
  normalCaseyOff: 'Vanlig Casey er av',
  prototypeOn: 'Prototype uten agent er på',
  customCaseyOn: 'Egen Casey-tjeneste er på',
  normalCaseyDetail: 'Ollama spiller og oversetter. Gemma er av.',
  gemmaModeDetail:
    'Gemma 4 E4B tar hint og gjetninger. Ord som mangler i ordboken, går fortsatt til Ollama.',
  prototypeDetail: 'Denne lokale testmodusen er ikke Casey, Ollama eller Gemma.',
  customCaseyDetail:
    'En egen Casey-Worker er valgt. Ord som mangler i ordboken, slås opp på nett via den tjenesten.',


  baseUrlLabel: 'Basis-URL',
  // Stien /v1 står som <code> mellom de to halvdelene, uten eget mellomrom -
  // derfor har halvdelene mellomrommene selv.
  baseUrlHelpBefore: 'Settes av knappen over, eller skriv inn adressen til din egen Casey-Worker pluss ',
  baseUrlHelpAfter:
    '. Den må begynne med https://, så ingenting om spillet ditt sendes ukryptert.',
  baseUrlUnusable: 'Den Basis-URL-en kan ikke brukes.',

  // ── modellen på enheten ──────────────────────────────────────────────────
  gemmaUnavailableNote: 'Frakoblet modus fungerer i iPhone-appen til 900words.',
  gemmaReady: (size) => `Casey uten nett er klar (${size} på denne iPhonen).`,
  gemmaRemoveConfirm: 'Fjerne Casey uten nett fra denne iPhonen? Du kan laste henne ned igjen senere.',
  gemmaRemoveButton: 'Fjern Casey uten nett',
  gemmaProgressAria: 'Fremdrift for nedlastingen av Casey uten nett',
  // Hardt mellomrom foran prosenttegnet, som på norsk.
  gemmaDownloading: (percent) => `${percent} % - hold 900words åpen på Wi-Fi.`,
  gemmaCancelDownloadButton: 'Avbryt nedlastingen',
  gemmaDownloadNote: (size) =>
    `Casey uten nett er en nedlasting på ${size}. Bruk wifi og hold 900words åpen til den er ferdig.`,
  gemmaDownloadButton: 'Last ned Casey uten nett',
  gemmaDownloadFailed: 'Nedlastingen mislyktes.',

  // ── offline mode ─────────────────────────────────────────────────────────
  offlineModeHeading: 'Frakoblet modus',
  offlineModeExperimentalTag: 'Eksperimentell',
  offlineModeLabel: 'Spill uten internett',
  offlineModeHelp:
    'Vanlig Casey spiller via serveren til 900words. Med frakoblet modus kan du spille ferdig en runde med Casey uten nett på denne iPhonen når internett er borte. Hun er tregere.',
  offlineModeAria: 'Frakoblet modus',
  offlineModeExplain: (size, iphones, lowMemory) =>
    `Frakoblet modus er eksperimentell og blir fortsatt forbedret.\n\nFrakoblet modus laster ned Casey uten nett (${size}) til denne iPhonen. Bruk wifi og hold 900words åpen til nedlastingen er ferdig.\n\nCasey uten nett spiller tregere enn vanlig Casey.\n\nHun trenger en nyere iPhone: ${iphones}.${lowMemory ? '\n\nDenne iPhonen har mindre minne enn disse modellene. Det er ikke sikkert hun fungerer på den.' : ''}\n\nLaste ned nå?`,

  // ── Casey’s AI in a self-built (open-source) 900words ─────────────────────
  ossCaseyHeading: 'Caseys KI',
  ossCaseyHelp: 'Dette er en selvbygd 900words. Casey trenger en KI å spille med: din egen KI-nøkkel eller Gemma på denne iPhonen.',
  ownKeyOption: 'Din egen KI-nøkkel',
  ownKeyHelp: 'En hvilken som helst OpenAI-kompatibel tjeneste. Nøkkelen lagres bare på denne enheten og sendes bare til adressen nedenfor.',
  ownKeyAddressLabel: 'Tjenestens adresse',
  ownKeyModelLabel: 'Modell',
  ownKeyKeyLabel: 'API-nøkkel',
  ownKeyAnswered: 'KI-tjenesten din svarte.',
  gemmaOption: 'Gemma på denne iPhonen',
  gemmaOptionHelp: 'Casey spiller på denne iPhonen, uten internett og uten nøkkel. Hun er tregere.',
  serverOption: 'Din egen Casey-server',
  serverOptionHelp: 'En Casey-Worker du har satt opp selv (se README).',
  // Gemma in the browser, in the desktop self-build (src/ai/gemma/web.ts).
  pcCaseyHelp: 'Dette er en selvbygd 900words. Casey trenger en KI å spille med: din egen KI-nøkkel eller Gemma på denne datamaskinen.',
  pcGemmaOption: 'Gemma på denne datamaskinen',
  pcGemmaOptionHelp: 'Casey spiller på denne datamaskinen, uten internett og uten nøkkel. Hun er tregere.',
  pcGemmaNeeds: 'Gemma trenger Chrome eller Edge med WebGPU, på en datamaskin med skjermkort.',
  pcGemmaExplain: (size) =>
    `Casey kan spille med Gemma på denne datamaskinen: uten internett og uten nøkkel. Gemma er en engangsnedlasting (${size}), lagres i denne nettleseren og kjører på skjermkortet ditt i Chrome eller Edge. Hun er tregere enn en KI-tjeneste og fortsatt eksperimentell.\n\nHold denne fanen åpen til nedlastingen er ferdig.\n\nLaste ned Gemma nå?`,
  pcGemmaReady: (size) =>
    `Gemma er klar (${size} i denne nettleseren).`,
  pcGemmaRemoveConfirm: 'Fjerne Gemma fra denne nettleseren? Du kan laste henne ned igjen senere.',
  pcGemmaDownloading: (percent) =>
    `${percent} % - hold denne fanen åpen.`,
  pcGemmaDownloadNote: (size) =>
    `Gemma er en nedlasting på ${size}. Hold denne fanen åpen til den er ferdig.`,
  pcGemmaAnswered: 'Gemma svarte på denne datamaskinen.',
  ossOfflineLabel: 'Spill uten nett når internett forsvinner',
  ossOfflineHelp: 'Casey tilbyr da å spille ferdig runden med Gemma. Første gang lastes hun ned.',
  ossGemmaFirstRun: (size, iphones, lowMemory) =>
    `Denne 900words spiller med Casey på iPhonen din: ingen konto og ingen nøkkel. Hun lastes ned én gang (${size}). Bruk wifi og hold 900words åpen til nedlastingen er ferdig.\n\nHun trenger en nyere iPhone: ${iphones}.${lowMemory ? '\n\nDenne iPhonen har mindre minne enn disse modellene. Det er ikke sikkert hun fungerer på den.' : ''}\n\nDu kan også legge til din egen KI-nøkkel i Innstillinger.\n\nLaste ned Casey nå?`,

  // ── tilkoblingstesten ────────────────────────────────────────────────────
  testRunning: 'Tester…',
  testGemmaButton: 'Test Casey på enheten',
  testConnectionButton: 'Test tilkoblingen',
  connectionFailed: 'Tilkoblingen mislyktes.',
  gemmaAnswered: 'Gemma svarte på denne iPhonen.',
  normalCaseyAnswered: 'Vanlig Ollama-Casey svarte.',
  customCaseyAnswered: 'Den egne Casey-tjenesten svarte.',


  // ── spillet ──────────────────────────────────────────────────────────────
  gameHeading: 'Spill',
  soundLabel: 'Si ordene høyt når du trykker på dem',
  soundHelp: 'Ingenting spilles av seg selv - hver lyd følger et trykk, også Caseys gjetninger.',
  lookupExampleLabel: 'Spill eksempelsetningen når du slår opp en oversettelse',
  lookupExampleHelp: 'Når den er av, bruker oppslaget innstillingen for ordlyd.',
  replayIntroButton: 'Se introen igjen',
  replayIntroHelp: 'Caseys introduksjon, en gang til. Ingenting i framgangen din endres.',

  // ── reiseverktøyene for spilltesten ──────────────────────────────────────
  playtestHeading: 'TestFlight-spilltest',
  playtestTravelLabel: 'La meg hoppe mellom byer og ta alle tog',




  // ── bryteren for daglig påminnelse ───────────────────────────────────────
  reminderHeading: 'Daglig påminnelse',
  reminderWebNote:
    'Daglige påminnelser er tilgjengelige i 900words-appen for iPhone. Denne nettleseren ber aldri om tillatelse til varslinger.',
  reminderDeniedNote:
    'iPhone-varslinger er av for 900words. Slå dem på i Innstillinger på iPhonen, og kom så tilbake hit for å sette opp Caseys daglige påminnelse.',
  reminderOpenSettingsButton: 'Åpne varslingsinnstillingene',
  /** Klokkeslettet kommer inn ferdig formatert, aldri skrevet her: se REMINDER_HOUR. */
  reminderOnNote: (time) => `Casey tar kontakt kl. ${time} på denne iPhonen.`,
  reminderTurningOff: 'Slår av…',
  reminderTurnOffButton: 'Slå av daglig påminnelse',
  reminderOffNote: (time) =>
    `Casey kan sende én lokal påminnelse kl. ${time}. Meldingen lages på denne iPhonen ut fra antall fullførte dager; verken enhetstoken eller læringshistorikk forlater den.`,
  reminderAsking: 'Spør iPhonen…',
  reminderTurnOnButton: 'Slå på daglig påminnelse',

  // ── samlingen din: sikkerhetskopien ──────────────────────────────────────
  collectionHeading: 'Sikkerhetskopi',
  backupIntro:
    'Samlingen din finnes bare på denne telefonen. En sikkerhetskopi er én liten fil - ta vare på en et trygt sted før du bytter telefon eller sletter nettleserdata. API-nøkkelen din er aldri med.',
  backupSaveButton: 'Ta sikkerhetskopi',
  backupRestoreButton: 'Gjenopprett fra fil',
  backupShared: 'Sikkerhetskopien er sendt til telefonen din.',
  backupDownloaded: 'Sikkerhetskopien er lastet ned.',
  backupHideText: 'Skjul tekstkopien',
  backupShowText: 'Ingen filvelger? Bruk tekst i stedet',
  backupCopyButton: 'Kopier samlingen min',
  backupCopied: 'Sikkerhetskopien er kopiert til utklippstavlen.',
  backupPasteLabel: 'Lim inn en sikkerhetskopi her',
  backupReadButton: 'Les den',
  backupHoldsHeading: 'Denne sikkerhetskopien inneholder',
  /** Hele linjen, med tallet i egen <strong>: «34 samlede ord, 120 møtt i alt». */
  backupCollectedAfter: (met) => `samlede ord, ${met} møtt i alt`,
  /** Hele linjen, med tallet i egen <strong>: «12 innpakket · Sønderborg». */
  backupWrappedAfter: (city) => `innpakket · ${city}`,
  backupGamesLine: (games, savedOn) =>
    `${games} ${games === 1 ? 'runde' : 'runder'} spilt · lagret ${savedOn}`,
  backupMergeButton: 'Slå sammen',
  backupReplaceButton: 'Erstatt alt',
  backupCancelButton: 'Avbryt',
  backupChoiceNote:
    'Sammenslåing beholder den beste av de to oppføringene for hvert ord, så det kan aldri koste deg et grønt kort. Erstatting kaster bort framgangen på denne enheten.',
  backupReplaceConfirm:
    'Erstatte alt på denne enheten med sikkerhetskopien? Alt du har lært siden den ble laget, går tapt.',
  backupMerged: (collected) =>
    `Slått sammen. Ingenting du hadde, gikk tapt - ${collected} samlede ord ble lagt inn.`,
  backupRestored: (collected, wrapped) =>
    `Gjenopprettet ${collected} samlede og ${wrapped} innpakkede ord.`,

  // ── eierens hintlogg ─────────────────────────────────────────────────────
  clueLedgerHeading: 'Caseys hint',

  // ── data ─────────────────────────────────────────────────────────────────
  dataHeading: 'Data',
  usageStatsLabel: 'Anonym bruksstatistikk',
  usageStatsHelp:
    'Bare tall - runder spilt, hvor spillere stopper, om Casey eller et opptak sviktet. Ingen ord, ingen hint, ingen identifikator av noe slag.',
  usageStatsAria: 'Del anonym bruksstatistikk',
  dataSharingPrivateTitle: 'Privat spill',
  dataSharingPrivateDetail: 'Ingen valgfrie spilldata forlater denne telefonen.',
  dataSharingDiagnosticsTitle: 'Anonym diagnostikk',
  dataSharingDiagnosticsDetail: 'Del antall runder og utfall, aldri ordene eller hintene dine.',
  dataSharingLearningTitle: 'Diagnostikk + læringseksempler for Casey',
  dataSharingLearningDetail: 'Del også hint, gjetninger og utfall, så Casey kan bli bedre.',
  dataSharingAria: 'Datadeling',
  dataSharingCloseAria: 'Lukk uten å velge',
  dataSharingPromptTitle: 'Hvordan skal 900words bruke spillingen din?',
  dataSharingPromptNote:
    'Ingenting er forhåndsvalgt. Alle valg holder hele spillet åpent, og du kan endre det i Innstillinger.',
  dataSharingSettingsNote:
    'Uten valg gjelder Privat spill. Dette styrer bare valgfrie hendelser; Casey og den kortvarige sjekken av neste brett behandler fortsatt det minimum av data som trengs for å spille.',
  dataSharingDeleting: 'Sletter delte data…',
  dataSharingDeleteButton: 'Slett delte data',
  resetConfirm: (language) =>
    `Nullstille all læringsframgang, ${language}-reisen din og det pågående spillet?`,
  resetButton: 'Nullstill framgang',

  // ── bunnteksten med versjonen ────────────────────────────────────────────
  buildStamp: (stamp) => `Versjon ${stamp}`,
  testFlightBuild: (build) => `TestFlight-build ${build} · `,
  keyboardReadoutNote: 'Tastaturvisning på. Trykk fem ganger på versjonen for å skjule den.',
  stateOn: 'på',
  stateOff: 'av',
  composerRideWaiting: 'av (venter på dokumentet)',
  composerRideButton: (state) => `Skrivefeltet følger med: ${state}`,
  trainStoryButton: (state) => `Togfortelling: ${state}`,


  updateChecking: 'Sjekker…',
  checkUpdatesButton: 'Se etter oppdateringer',
  updateCurrent: 'Oppdatert.',
  updateFound: 'En nyere versjon lastes ned - lukk appen og åpne den igjen for å ta den i bruk.',
  updateCheckFailed: 'Kunne ikke sjekke. Lukk appen og åpne den igjen i stedet.',

  // ── Caseys ene spørsmål om den daglige påminnelsen ───────────────────────
  reminderPromptCloseAria: 'Ikke nå',
  reminderPromptTitle: 'Tre spill i kofferten!',
  reminderPromptBody: (time) =>
    `Det er dagens kvote. Skal jeg minne deg på det i morgen, rundt kl. ${time}? Ett lite dult på ettermiddagen, og du kan slå det av i Innstillinger når du vil.`,
  reminderPromptAccept: 'Ja, minn meg på det',
  reminderPromptAsking: 'Spør iPhonen din…',
  reminderPromptDecline: 'Nei takk',

  // ── selve den daglige påminnelsen, skrevet på telefonen ──────────────────
  reminderDoneTitle: 'Casey er ferdigpakket for i dag',
  reminderDoneBody: 'Tre spill ligger trygt i kofferten. Vi fortsetter i morgen.',
  reminderOneLeftTitle: 'Ett lite spill med Casey?',
  reminderStreakBody: (days) =>
    `Hold ${days}-dagersrekken din i gang med ett spill til i dag.`,
  reminderOneLeftBody: 'Ett spill til, så ligger dagens tre i kofferten.',
  reminderSeatTitle: 'Casey har holdt av en plass til deg',
  reminderSeatBody: (games) =>
    `${games} ${games === 1 ? 'lite spill' : 'små spill'} i dag er nok til å starte en rekke.`,

  // ── leverandørbrikken (src/ai/providers.ts) ──────────────────────────────



  // Current Settings and German-preview integration.
  learnerLanguagePreviewTag: "forhåndsversjon",
  learnerLanguagePreviewHelp: "Tysk er en forhåndsversjon: kartet og Reiseguiden er her, men ikke ordspillet. Leksjonene er ennå ikke gjennomgått av noen med tysk som morsmål.",
  playtestTravelHelp: "Hopp frem på kartet: velg et senere stopp og reis videre. Ingen ord pakkes, og ingen læringsfremgang legges til. Slå dette av for å teste de vanlige reisevilkårene igjen.",
}
