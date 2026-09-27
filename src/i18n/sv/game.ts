import type { Catalogue } from '../en'

/**
 * Svenska. Du; Casey är ”hon”. Ett drag i spelet heter ”drag” — tåget är
 * det enda som är ett tåg. ”Tips” är Caseys råd på Hem, aldrig en gissning.
 * ”Neutral” stavas likadant på engelska, så ett neutralt kort heter just
 * ”neutralt kort” — en nominalfras, som dessutom läses bättre.
 *
 * Håll det kort: spelplanen, ledtrådsrutan och slutskärmen ska gå in på
 * 360×640 utan att rulla.
 *
 * Två saker kommer som ARGUMENT, inte som text: ett danskt ord inom «» och
 * namnet på språket som lärs (`ACTIVE.name`). Det senare är fortfarande det
 * engelska ordet ”Danish” i själva paketet; meningarna här är skrivna så att
 * det faller in ändå.
 */
export const game: Catalogue['game'] = {
  legacyRetiredTitle: "Dina framsteg är sparade",
  legacyRetiredBody: "En äldre omgång kunde inte fortsätta efter uppdateringen. Dina sparade kunskaper och vykort finns kvar. Fortsätt med nästa oavslutade bräde.",
  // ── fasraden högst upp på spelplanen ─────────────────────────────────────
  phaseGiveClue: 'Ge Casey en ledtråd',
  phaseCaseyGuessing: 'Casey gissar',
  phaseCaseyClue: 'Casey förbereder en ledtråd',
  phaseYourGuess: 'Din tur att gissa',
  phaseLastChance: 'Sista chansen: inga ledtrådar kvar',
  phaseRoundOver: 'Rundan är slut',
  phasePackTheBoard: 'Packa ner',

  // ── vad den levande regionen säger medan Casey spelar ────────────────────
  announceCaseyGuess: (word, result) => `Casey gissade ${word}: ${result}.`,
  resultCorrect: 'rätt',
  resultNeutral: 'neutralt kort',
  announceCaseyThinking: 'Casey tänker.',

  // ── spelets sidhuvud ─────────────────────────────────────────────────────
  skip: 'Hoppa över',
  homeAria: 'Hem',
  dealNewWordsAria: 'Dela ut nya ord',
  hideTranslationsAria: 'Dölj översättningarna',
  showTranslationsAria: 'Visa alla översättningar. Räknas som att slå upp varje olöst ord',

  // ── Casey gick inte att nå ───────────────────────────────────────────────
  errorRetry: 'Försök igen',
  errorCaseySettings: 'Casey-inställningar',
  practiceNote: 'Experimentell agentlös prototyp. Det här är inte Casey och inte vanligt spel.',

  // ── studiefasen ──────────────────────────────────────────────────────────
  studyTitle: 'Studera spelplanen',
  studyHint: 'Alla översättningar visas. De döljs när du startar, och sedan slår ett tryck upp ett ord.',
  studyStart: 'Starta rundan',

  // ── ett korts tillgängliga namn, byggt av dessa delar i denna ordning ─────
  cardYourTarget: ', ditt mål',
  cardFound: ', hittat',
  cardNeutralBoth: ', neutralt för båda sidor',
  cardNeutralPlayer: ', neutralt under dina ledtrådar',
  cardNeutralCasey: ', neutralt under Caseys ledtrådar',
  cardUnpacked: ', opackat',
  cardTranslationRevealed: ', översättning visad',
  cardNotYetPacked: (language) => `, inte packat än. Tryck för att skriva ordet på ${language}`,
  cardNotYoursToWrap: ', inte ditt att slå in än',
  cardTapToHear: '. Tryck för att lyssna',
  lookUpAria: (word) => `Slå upp ${word}`,

  // ── ledtrådsrutan ────────────────────────────────────────────────────────
  cluePlaceholder: 'Din ledtråd',
  clueFieldAria: (language) => `Din ledtråd på ett ord, på ${language}`,
  fewerWordsAria: 'färre ord',
  moreWordsAria: 'fler ord',
  wordCountAria: (n) => `${n} ord`,
  giveClue: 'Ge ledtråd',
  giveItAnyway: 'Ge den ändå',
  askingCasey: 'Frågar Casey…',
  firstClueHint: (language) => `Ett ord på ${language}. Kört fast? Ordboken bredvid översätter.`,
  tutorialClueHint: 'Jag tolkar ledtrådar på danska. Osäker? Prova. Ordboken kan hjälpa.',
  wrapPlayerKeyHint: 'Din gröna ram är tillbaka. Det är din privata nyckel. Casey kan inte se den.',
  looksEnglishFull: (word, language) =>
    `«${word}» ser ut som betydelsen av ett kortord. Tryck på det för ordet på ${language}, eller ge det ändå så kontrollerar Casey.`,
  looksEnglishShort: 'ser ut som betydelsen av ett kortord. Tryck på det, eller ge det ändå',

  // ── gissningsraden ───────────────────────────────────────────────────────
  caseysClueLabel: 'Caseys ledtråd',
  lookUpInDictionaryAria: (word) => `Slå upp «${word}» i ordboken`,
  guessesLeft: (n) => (n === 1 ? '1 gissning kvar' : `${n} gissningar kvar`),
  guessWord: (word) => `Gissa «${word}»`,
  cancel: 'Avbryt',
  stopKeepWhatWeHave: 'Sluta och behåll det vi har',
  guessPrompt: 'Tryck på ett ord du tror Casey menar.',
  firstGuessHint: 'Nu räknas Caseys nyckel. Tryck på ett ord som hennes ledtråd pekar på.',
  wrapCaseyKeyHint: 'Caseys nyckel är hemlig. Gissa vad hennes ledtråd pekar på. Hennes gröna räknas nu.',
  tutorialLookupHint: 'Tryck på ⓘ vid ett ord för att enkelt slå upp dess översättning.',

  // ── sista chansen ────────────────────────────────────────────────────────
  suddenDeathRule: 'Nämn gröna för att vinna. Allt annat avslutar rundan.',
  nameWord: (word) => `Nämn «${word}»`,
  giveUpRound: 'Ge upp rundan',

  // ── översättningshjulet (sista chansen, ny 2026-09-16) ───────────────────
  wheelLede: (language) => `Hjulet avgör omgången. Skriv tillbaka orden på ${language} för att fylla det, och snurra sedan. Grönt vinner.`,
  /** The input's placeholder and its accessible name. */
  wheelAnswerPlaceholder: (language) => `Skriv på ${language}`,
  wheelAnswerAria: (language, glosses) =>
    `Skriv på ${language} översättningen av något av de här orden: ${glosses.join(', ')}`,
  wheelCardStatus: (translated) =>
    translated ? ', översatt' : ', översättning behövs',
  wheelRetryLine: 'Inte riktigt. Försök igen. Inget går förlorat.',
  wheelSubmit: 'Packa',
  wheelSpinAria: 'Snurra hjulet',
  wheelSpinning: 'Snurrar …',
  wheelWonLine: 'Grönt! Omgången är vunnen.',
  wheelMissLine: 'Hjulet landade på en oppackad väska.',
  phaseTranslateChallenge: 'Dags att översätta',
  settlementFailed: 'Ditt resultat kunde inte sparas än. Behåll rundan och försök igen.',
  settlementSaving: 'Sparar ditt resultat…',
  guidanceTranslationBody: (language) => `Väskorna visar nu betydelsen av orden du hittat. Skriv tillbaka varje ord på ${language} för att fylla hjulet och snurra sedan. Om det stannar på grönt vinner du rundan.`,
  guidanceStartTranslation: 'Börja översätta',
  phaseTranslateWheel: 'Hjulet: snurren avgör omgången',

  // ── sista chansens ankomstpanel ───────────────────────────────────────────
  /** Meningen i rutan när ledtrådarna tar slut och hjulutmaningen börjar (ägaren, 2026-09-17) — i wheelLedes ton. */
  guidanceLastChanceWheel:
    'Ledtrådarna är slut, så det här är avslutningen. Översätt de insamlade orden för att fylla hjulet, och snurra sedan. Grönt vinner omgången.',

  // ── Caseys egen tur ──────────────────────────────────────────────────────
  caseyIsThinking: 'Casey tänker…',
  offlineCaseyIsThinking: 'Offline-Casey tänker. Det tar längre tid.',
  offlineRoundPrompt: 'Inget internet. Spela resten av rundan med offline-Casey? Hon är långsammare.',
  playOfflineButton: 'Spela offline',
  hurryCaseyTitle: 'Tryck för att skynda på Casey',
  hurryCaseyHint: 'Tryck här för att skynda på Casey.',
  caseyGuessedWord: (word) => `Casey gissade «${word}».`,
  caseyChoosingWord: 'Casey väljer ett ord…',
  caseyChoosingWhether: 'Casey funderar på om hon ska gissa…',
  guessGotOne: '. Träff!',
  guessNeutral: '. Neutralt kort.',

  // ── den gemensamma ledtrådspoolen ────────────────────────────────────────
  turnTokensAria: (given, total, left) => `${given} av ${total} ledtrådar givna, ${left} kvar.`,
  cluesGivenCount: (given, total) => `${given}/${total} ledtrådar givna`,

  // ── att lämna en oavslutad runda ─────────────────────────────────────────
  leaveTitle: 'Lämna rundan?',
  leaveBody:
    'Pausa lämnar spelplanen precis där den är. Avbryt kastar den, så att Spela startar en ny runda.',
  leaveKeepPlaying: 'Fortsätt spela',
  leavePause: 'Pausa spelet',
  leaveCancelRound: 'Avbryt rundan',

  // ── dialogen som öppnar en runda ─────────────────────────────────────────
  guidanceCaseyTitle: 'Caseys första ledtråd',
  guidancePlayerTitle: 'Din tur!',
  guidanceWordCount: (n) => `${n} ord`,
  guidanceCaseyBody: 'Hitta orden som hör ihop med Caseys ledtråd.',
  guidancePlayerBody:
    'Skriv ett danskt ord som kopplar ihop 1–4 av dina gröna ord. Använd ordboken om du inte kan ordet på danska.',
  guidanceHideReminder: 'Påminn mig inte igen',
  guidanceStartGuessing: 'Börja gissa',
  guidanceWriteClue: 'Skriv en ledtråd',
  guidanceLastChanceTitle: 'Sista chansen',
  guidanceLastChanceBody:
    'Ledtrådarna är slut. Men du kan fortfarande vinna. Gissa vidare utifrån de tidigare ledtrådarna. Men en felgissning och du förlorar.',
  guidanceKeepNaming: 'Fortsätt nämna',
  guidancePackingTitle: 'Packa ner spelplanen först',
  guidancePackingBody:
    'Skriv det danska ordet till varje kort, ett i taget. När alla är skrivna, eller du inte kommer längre, startar du rundan.',
  guidanceStartPacking: 'Börja packa',

  // ── ordboken: fältet, dess enda svar och arket bakom ─────────────────────
  dictionaryPlaceholder: 'Ordbok',
  dictionaryFieldAria: (language) => `Ord att översätta, ${language} eller ditt språk`,
  dictHitAria: (entry) => `${entry}: öppna ordboken`,
  approximateFrom: (term) => ` (från ${term})`,
  onTheBoardNote: ' (på spelplanen)',
  translateFailed: 'Det gick inte att översätta.',
  lookupsUsed: 'Inga uppslag kvar.',
  dictionaryPracticeOnly: 'Övningen kan bara de 900 orden.',
  sayAgainAria: (word) => `Säg ${word} igen`,
  saySlowlyAria: (word) => `Säg ${word} långsamt`,
  sayExampleAria: 'Säg exempelmeningen igen',
  sayExampleSlowlyAria: 'Säg exempelmeningen långsamt',
  recordingsUnavailableNote: ' · normal och långsam inspelning saknas',
  recordingFailedNote: ' · inspelningen laddades inte',
  close: 'Stäng',

  // ── Caseys bedömningar: dragloggen och dess flaggor ──────────────────────
  caseysCalls: 'Caseys bedömningar',
  turnCount: (n) => `${n} drag`,
  logHint: 'Tryck på ⚑ vid det Casey gjorde som var en felbedömning. Hon får se dem du flaggar.',
  logYou: 'Du',
  logFor: 'för',
  flagClueLabel: (clue) => `Caseys ledtråd «${clue}»`,
  flagGuessLabel: (word) => `Caseys gissning «${word}»`,
  flagOnAria: (label) => `${label}, flaggad som felbedömning. Tryck för att ångra`,
  flagOffAria: (label) => `Flagga ${label} som felbedömning`,
  guessCorrectSr: ', rätt',
  guessNeutralSr: ', neutralt kort',
  // Hårt blanksteg före procenttecknet, som svenskan vill ha det.
  confidenceSure: (percent) => `${percent} % säker`,
  noGuessMade: 'ingen gissning',

  // ── ledtrådsloggen: en torr diagnostik, ingen poäng ──────────────────────
  ledgerEmpty:
    'Inget än. En rad dyker upp här för varje ledtråd från Casey när du har gissat klart under den.',
  ledgerArmHeading: 'källa',
  ledgerCluesHeading: 'ledtrådar',
  ledgerFoundHeading: 'hittade',
  ledgerRefusedHeading: 'avvisade',
  ledgerHitsTitle: (hits, asked) => `${hits} av ${asked} efterfrågade ord`,
  ledgerRefusedTitle: 'Hur ofta den här källans första svar kastades och frågades om',
  ledgerExplainer:
    '”hittade” är andelen av de ord en ledtråd bad om som du faktiskt vände upp. ”avvisade” är hur ofta modellens första svar kastades och frågades om. Offlinekällorna kan inte avvisas.',
  ledgerClear: 'Rensa loggen',

  // ── hur rundan slutade ───────────────────────────────────────────────────
  outcomeWonTitle: 'Grattis!',
  outcomeWonSub: 'Du vann ett vykort!',
  outcomeLostTitle: 'Nästa gång',
  outcomeGivenUpSub: 'Rundan uppgiven. Kopplingen fanns där.',
  outcomeWheelMissSub: 'Hjulet landade på en väska du aldrig packade.',
  /** Hjulets vinnande slut (ägare, 2026-09-18): det landade på grönt. */
  outcomeWheelWinSub: 'Hjulet landade på grönt. Omgången är din.',
  outcomeWheelSpentSub: 'Poletten var spendrad, och ledtrådarna tog ändå slut.',

  resultLesson: 'En ny valfri Guide-lektion är klar.', resultOpenGrammar: 'Öppna grammatik i Guiden', resultOpenSurvival: 'Öppna överlevnad i Guiden', resultBackToResult: 'Tillbaka till resultatet',

  // ── vad rundan gav, på en rad under rubriken ─────────────────────────────
  roundStatsAria: 'Vad rundan gav',
  newWordsLabel: (n) => (n === 1 ? 'nytt ord' : 'nya ord'),
  collectedForCasey: 'samlade för Casey',
  wrapStatsAria: 'Vad packrundan packade',
  wrappedForGood: (named) => (named ? 'inslagna för gott:' : 'inslagna för gott'),
  stayedLabel: 'blev kvar',

  // ── var rundan lämnade resan: packrundans läsområde ──────────────────────
  // Siffran står i sin egen span före: ”13 inslagna i Ribe · 87 kvar innan
  // tåget till Kolding går”.
  wrapJourneyHeading: 'Resan',
  wrapJourneyAria: 'Resan efter den här packrundan',
  wrappedInCity: (_n, city) => `inslagna i ${city}`,
  wrapJourneyTrainReady: (city) => `tåget till ${city} är redo`,
  wrapJourneyOver: 'resan är slut',
  wrapJourneyToGo: (_n, city) => `kvar innan tåget${city ? ` till ${city}` : ''} går`,

  // ── packrundans ekonomi, sagd på väg ut ur en vunnen runda ───────────────
  wrapUpUnlocked:
    'Packrunda upplåst. Den packar ner samlade ord i resväskan för gott. Öppna resväskan för att använda den.',
  wrapUpEarned: (banked) => `Packrunda intjänad. ${banked} i förråd. Använd en i resväskan.`,
  postcardEarned: (banked) => `+1 översättningsvykort · ${banked} redo`,
  wrapUpBankFull: (cap) =>
    `Förrådet är fullt. ${cap} packrundor är allt resväskan rymmer. Använd en så börjar vinsterna räknas igen.`,
  winsToWrapUp: (n) =>
    n === 1 ? '1 vinst till för en packrunda' : `${n} vinster till för en packrunda`,
  wrapResultFirst: 'Packade gröna kort slås in för gott, oavsett om rundan vinns eller förloras.',
  wrapResultNothing:
    'Inget inslaget. Ett ord slås in när det både var översatt OCH hittades grönt, vinst eller förlust.',
  wrapResultLost:
    'Förlusten kostade dig inget här. En packrunda sparar det du packade och hittade grönt, vinst eller förlust.',

  // ── vägen ut ur en runda ─────────────────────────────────────────────────
  playAgain: 'Spela igen',
  playNextGame: 'Spela nästa',
  home: 'Hem',
  postWrapChoicesAria: 'Val efter packrundan',
  postWrapHeading: 'Vad händer nu?',
  postWrapGrammar: 'Grammatik',
  postWrapSurvival: 'Överlevnad',
  postWrapBoth: 'Båda',
  postWrapBothNote: 'Grammatik först, sedan direkt vidare till dialogen.',
  grammarNote: (city, topic, lessons) =>
    `Grammatik i ${city}${topic ? `: ${topic}` : ''}${lessons > 1 ? `, ${lessons} lektioner.` : '.'}`,
  // ”Dialog” är glossarets ord för ett Överlevnad-avsnitt; pratet inuti heter samtal.
  survivalNextNote: (number, total, title) =>
    `Dialog ${number} av ${total}: ${title}. Först fraserna, sedan samtalet.`,
  survivalAllReadTitle: 'Alla fyra dialogerna är redan lästa.',
  survivalLockedTitle: 'Slutför en packrunda för att låsa upp nästa dialog.',
  survivalLockedNote: 'Nästa dialog låses upp när en packrunda är klar.',

  // ── meningsbandet under utfallet ─────────────────────────────────────────
  sentenceReviewAria: 'Meningsgenomgång',
  hearItInDanish: 'Lyssna på danska',
  legendGreenLabel: 'Grönt',
  legendGreenMeaning: ': ordet du hittade.',
  legendUnderlinedLabel: 'Understruket',
  legendUnderlinedMeaning: (city) => `: småorden från ${city}.`,
  legendTapToHear: 'Tryck för att lyssna.',

  // ── Stad 1-läsaren som ersätter slutskärmen ──────────────────────────────
  reviewTitle: 'Spelplansgenomgång',
  reviewProgress: (current, total) => `${current} av ${total}`,
  reviewOptional: 'Frivilligt · en mening per ledtråd',
  reviewListen: 'Lyssna',
  reviewListenSlowlyAria: 'Lyssna långsamt',
  reviewNoRecordings: 'Normal och långsam inspelning saknas.',
  reviewRecordingUnavailable: 'Inspelning saknas.',
  reviewSoundOff: 'Ljudet är av eller uppspelningen stoppades.',
  reviewShowTranslation: 'Visa översättning',
  reviewHideTranslation: 'Dölj översättning',
  reviewAboutWord: 'Om det här ordet',
  reviewHighFrequencyWord: 'Högfrekvent ord:',
  reviewNoNotes: 'Inga anteckningar om ordet.',
  reviewNextSentence: 'Nästa mening',
  reviewNothingThisRound:
    'Inget att gå igenom den här rundan. En mening erbjuds för varje ledtråd av dina som Casey gissade rätt på.',
  sentenceBandNoGreens: 'Inga gröna ord att sätta i en mening den här rundan.',

  // ── varför en ledtråd avvisades ──────────────────────────────────────────
  clueNotSingleWord: 'ledtråden måste vara ett enda ord',
  clueOnBoard: (clue) => `”${clue}” är ett ord på spelplanen`,
  clueTypoOf: (clue, word) => `”${clue}” kan vara ett stavfel av ”${word}”`,
  clueGlossOnBoard: (clue, word) =>
    `”${clue}” är översättningen av ”${word}” på spelplanen`,
  clueCompoundOfWord: (clue, word) => `”${clue}” är en sammansättning av ”${word}”`,
  clueCompoundOfGloss: (clue, gloss, word) =>
    `”${clue}” är en sammansättning av ”${gloss}”, översättningen av ”${word}”`,
  clueFormOfWord: (clue, word) => `”${clue}” är en form av ”${word}”`,
  clueFormOfGloss: (clue, gloss, word) =>
    `”${clue}” är en form av ”${gloss}”, översättningen av ”${word}”`,

  // ── övningsrundans knuffar och den stängda ordboken ──────────────────────
  practiceClueFinal: 'För den här sista övningsledtråden: koppla ihop det enda gröna ord som är kvar.',
  practiceClueMany: 'För den här övningsledtråden: koppla ihop 2 eller 3 gröna ord.',
  dictionaryClosed: 'Ordboken är stängd tills det här är klart.',
}
