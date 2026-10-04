import type { Catalogue } from '../en'

/**
 * Norsk bokmål. Du. Casey er «hun». Glossar: et hint er det som gis, en
 * gjetning er svaret, «forsøk» er telleren; ett trekk er ett hint med
 * gjettingen under, og «tur» er hvem sin tur det er. Toget er alltid toget.
 * I siste sjanse PEKER du UT kort. «Tips» er Caseys råd på Hjem, aldri en
 * gjetning.
 *
 * Kort: brettet, hintdokken og avslutningsskjermen må få plass på 360×640
 * uten å rulle.
 */
export const game: Catalogue['game'] = {
  legacyRetiredTitle: "Fremgangen din er bevart",
  legacyRetiredBody: "En eldre runde kunne ikke fortsette etter oppdateringen. Det du har lært og postkortene du har lagret, er bevart. Fortsett med neste uferdige brett.",
  // ── faseteksten øverst på brettet ─────────────────────────────────────────
  phaseGiveClue: 'Gi Casey et hint',
  phaseCaseyGuessing: 'Casey gjetter',
  phaseCaseyClue: 'Casey finner et hint',
  phaseYourGuess: 'Din tur til å gjette',
  phaseLastChance: 'Siste sjanse: ingen hint igjen',
  phaseRoundOver: 'Runden er over',
  phasePackTheBoard: 'Pakk brettet',

  // ── hva det levende området sier mens Casey spiller ───────────────────────
  announceCaseyGuess: (word, result) => `Casey gjettet ${word}: ${result}.`,
  resultCorrect: 'riktig',
  resultNeutral: 'nøytralt',
  announceCaseyThinking: 'Casey tenker.',

  // ── spilltoppen ───────────────────────────────────────────────────────────
  skip: 'Hopp over',
  homeAria: 'Hjem',
  dealNewWordsAria: 'Del ut nye ord',
  hideTranslationsAria: 'Skjul oversettelsene',
  showTranslationsAria: 'Vis alle oversettelsene. Teller som oppslag av hvert uløste ord',

  // ── Casey var ikke å nå ───────────────────────────────────────────────────
  errorRetry: 'Prøv igjen',
  errorCaseySettings: 'Casey-innstillinger',
  practiceNote: 'Eksperimentell prototype uten agent. Dette er ikke Casey eller vanlig spill.',

  // ── studiefasen ───────────────────────────────────────────────────────────
  studyTitle: 'Studer brettet',
  studyHint: 'Alle oversettelsene vises. De skjules når du starter, og et trykk slår ett ord opp.',
  studyStart: 'Start runden',

  // ── et korts tilgjengelige navn, satt sammen av disse delene i denne rekkefølgen
  cardYourTarget: ', ditt mål',
  cardFound: ', funnet',
  cardMissedKey: ', et av Caseys ord, ikke funnet',
  cardNeutralBoth: ', nøytralt for begge sider',
  cardNeutralPlayer: ', nøytralt under dine hint',
  cardNeutralCasey: ', nøytralt under Caseys hint',
  cardUnpacked: ', ikke pakket',
  cardTranslationRevealed: ', oversettelse vist',
  cardNotYetPacked: (language) => `, ikke pakket ennå. Trykk for å skrive ordet på ${language}`,
  cardNotYoursToWrap: ', ikke ditt å pakke inn ennå',
  cardTapToHear: '. Trykk for å høre',
  lookUpAria: (word) => `Slå opp ${word}`,

  // ── skrivefeltet ──────────────────────────────────────────────────────────
  cluePlaceholder: 'Hintet ditt',
  clueFieldAria: (language) => `Hintet ditt på ett ord, på ${language}`,
  fewerWordsAria: 'færre ord',
  moreWordsAria: 'flere ord',
  wordCountAria: (n) => `${n} ord`,
  giveClue: 'Gi hint',
  giveItAnyway: 'Gi det likevel',
  askingCasey: 'Spør Casey…',
  firstClueHint: (language) => `Ett ord på ${language}. Står du fast? Ordboken ved siden av oversetter.`,
  tutorialClueHint: 'Jeg tolker hint på dansk. Usikker? Prøv. Ordboka kan hjelpe.',
  wrapPlayerKeyHint:
    'Den grønne rammen din er tilbake. Den er din private nøkkel. Casey kan ikke se den.',
  looksEnglishFull: (word, language) =>
    `«${word}» ser engelsk ut. Trykk på det for ordet på ${language}, eller gi det likevel, så sjekker Casey.`,
  looksEnglishShort: 'ser ut som betydningen av et kortord. Trykk på det, eller gi det likevel',

  // ── gjettelinjen ──────────────────────────────────────────────────────────
  caseysClueLabel: 'Caseys hint',
  lookUpInDictionaryAria: (word) => `Slå opp «${word}» i ordboken`,
  guessesLeft: (n) => `${n} forsøk igjen`,
  guessWord: (word) => `Gjett «${word}»`,
  cancel: 'Avbryt',
  stopKeepWhatWeHave: 'Stopp og behold det vi har',
  guessPrompt: 'Trykk på et ord du tror Casey mener.',
  firstGuessHint: 'Nå er det Caseys nøkkel som teller. Trykk på et ord hintet hennes peker mot.',
  wrapCaseyKeyHint:
    'Caseys nøkkel er hemmelig. Gjett hva hintet hennes peker mot. Nå teller hennes grønne.',
  tutorialLookupHint: 'Trykk på ⓘ ved et ord for å slå opp oversettelsen.',

  // ── siste sjanse ──────────────────────────────────────────────────────────
  suddenDeathRule: 'Pek ut grønne for å vinne. Alt annet avslutter runden.',
  nameWord: (word) => `Pek ut «${word}»`,
  giveUpRound: 'Gi opp runden',

  // ── oversettelsehjulet (siste sjanse, nytt 2026-09-16) ────────────────────
  wheelLede: (language) => `Hjulet avgjør runden. Skriv ordene tilbake på ${language} for å fylle det, og spinn så. Grønt vinner.`,
  /** The input's placeholder and its accessible name. */
  wheelAnswerPlaceholder: (language) => `Skriv på ${language}`,
  wheelAnswerAria: (language, glosses) =>
    `Skriv på ${language} oversettelsen av ett av disse ordene: ${glosses.join(', ')}`,
  wheelCardStatus: (translated) =>
    translated ? ', oversatt' : ', oversettelse mangler',
  wheelRetryLine: 'Ikke riktig. Prøv igjen. Du mister ingenting.',
  wheelSubmit: 'Pakk',
  wheelSpinAria: 'Sprett hjulet',
  wheelSpinning: 'Snurrer …',
  wheelWonLine: 'Grønt! Runden er vunnet.',
  wheelMissLine: 'Ikke grønt. Runden er tapt.',
  wheelLedeMissed: (found, total, language) =>
    `Du fant ${found} av ${total}. For ordene som ligger igjen på brettet, forblir hjulet grått. Skriv resten på ${language}, og spinn så.`,
  wheelAnswersLine: 'De grå ordene er svarene du ikke skrev.',
  wheelSeeResults: 'Se resultatet',
  phaseTranslateChallenge: 'Tid for å oversette',
  settlementFailed: 'Resultatet kunne ikke lagres ennå. Behold runden og prøv igjen.',
  settlementSaving: 'Lagrer resultatet…',
  guidanceTranslationBody: (language) => `Koffertene viser nå betydningen av ordene du fant. Skriv hvert ord tilbake på ${language} for å fylle hjulet, og snurr deretter. Stopper det på grønt, vinner du runden.`,
  guidanceStartTranslation: 'Begynn å oversette',
  phaseTranslateWheel: 'Hjulet: spinnet avgjør runden',

  // ── ankomstpanelet for siste sjanse ───────────────────────────────────────
  /** Setningen i spopp-vinduet når hintene tar slutt og hjel-utfordringen begynner (eier, 2026-09-17) — i samme tone som wheelLede. */
  guidanceLastChanceWheel:
    'Du er tom for hint, så dette er avslutningen. Oversett de samlede ordene for å fylle hjulet, og spinn så. Grønt vinner runden.',

  // ── Caseys egen tur ───────────────────────────────────────────────────────
  caseyIsThinking: 'Casey tenker…',
  offlineCaseyIsThinking: 'Casey uten nett tenker. Det tar lengre tid.',
  offlineRoundPrompt: 'Ingen internettforbindelse. Spille resten av runden med Casey uten nett? Hun er tregere.',
  playOfflineButton: 'Spill uten nett',
  onlineAgainTitle: 'Nettet er tilbake',
  onlineAgainBody:
    'Spille resten av runden med vanlig Casey? Hun er raskere og spiller bedre. Hvis forbindelsen stadig faller ut, kan det være mer stabilt å fortsette uten nett.',
  playOnlineButton: 'Spill på nett',
  stayOfflineButton: 'Fortsett uten nett',
  hurryCaseyTitle: 'Trykk for å skynde på Casey',
  hurryCaseyHint: 'Trykk her for å skynde på Casey.',
  caseyGuessedWord: (word) => `Casey gjettet «${word}».`,
  caseyChoosingWord: 'Casey velger et ord…',
  caseyChoosingWhether: 'Casey vurderer om hun skal gjette…',
  guessGotOne: '. Treff!',
  guessNeutral: '. Nøytralt.',

  // ── den felles hintbeholdningen ───────────────────────────────────────────
  turnTokensAria: (given, total, left) => `${given} av ${total} hint gitt, ${left} igjen.`,
  cluesGivenCount: (given, total) => `${given}/${total} hint gitt`,

  // ── å forlate en uferdig runde ────────────────────────────────────────────
  leaveTitle: 'Forlate runden?',
  leaveBody:
    'Pause lar brettet stå akkurat som det er. Avbryt forkaster det, så Spill starter en ny runde.',
  leaveKeepPlaying: 'Spill videre',
  leavePause: 'Sett på pause',
  leaveCancelRound: 'Avbryt runden',

  // ── dialogen som åpner en runde ───────────────────────────────────────────
  guidanceCaseyTitle: 'Caseys første hint',
  guidancePlayerTitle: 'Din tur!',
  guidanceWordCount: (n) => `${n} ord`,
  guidanceCaseyBody: 'Finn ordene som henger sammen med Caseys hint.',
  guidancePlayerBody:
    'Skriv ett dansk ord som knytter sammen 1–4 av dine grønne ord. Bruk ordboken hvis du ikke kan ordet på dansk.',
  guidanceHideReminder: 'Ikke vis dette igjen',
  guidanceStartGuessing: 'Begynn å gjette',
  guidanceWriteClue: 'Skriv et hint',
  guidanceLastChanceTitle: 'Siste sjanse',
  guidanceLastChanceBody:
    'Du er tom for hint. Men du kan fortsatt vinne. Fortsett å gjette ut fra de forrige hintene. Men én feil gjetning, og du taper.',
  guidanceKeepNaming: 'Pek ut videre',
  guidancePackingTitle: 'Pakk brettet først',
  guidancePackingBody:
    'Oversett brettet fra engelsk til dansk, ett kort om gangen. Når alle er oversatt, eller du ikke kommer lenger, starter du runden.',
  guidanceStartPacking: 'Begynn å pakke',

  // ── ordboken: feltet, det ene svaret og arket bak ─────────────────────────
  dictionaryPlaceholder: 'Ordbok',
  dictionaryFieldAria: (language) => `Ord å oversette, ${language} eller engelsk`,
  dictHitAria: (entry) => `${entry}: åpne ordboken`,
  approximateFrom: (term) => ` (fra ${term})`,
  onTheBoardNote: ' (på brettet)',
  translateFailed: 'Kunne ikke oversette det.',
  lookupsUsed: 'Ingen oppslag igjen.',
  dictionaryPracticeOnly: 'Øvingen kan bare de 900 ordene.',
  sayAgainAria: (word) => `Si ${word} igjen`,
  saySlowlyAria: (word) => `Si ${word} sakte`,
  sayExampleAria: 'Si eksempelsetningen igjen',
  sayExampleSlowlyAria: 'Si eksempelsetningen sakte',
  recordingsUnavailableNote: ' · vanlig og sakte opptak er utilgjengelig',
  recordingFailedNote: ' · opptaket ble ikke lastet inn',
  close: 'Lukk',

  // ── Caseys vurderinger: trekkloggen og flaggene ───────────────────────────
  caseysCalls: 'Caseys vurderinger',
  turnCount: (n) => `${n} trekk`,
  logHint: 'Trykk på ⚑ ved alt fra Casey som var en feilvurdering. Hun får se det du flagger.',
  logYou: 'Du',
  /** «Casey: «hund» (2) om kat, mus» — ordet mellom hintet og målene. */
  logFor: 'om',
  flagClueLabel: (clue) => `Caseys hint «${clue}»`,
  flagGuessLabel: (word) => `Caseys gjetning «${word}»`,
  flagOnAria: (label) => `${label}, flagget som feilvurdering. Trykk for å angre`,
  flagOffAria: (label) => `Flagg ${label} som feilvurdering`,
  guessCorrectSr: ', riktig',
  guessNeutralSr: ', nøytralt',
  // Hardt mellomrom foran prosenttegnet, som på norsk.
  confidenceSure: (percent) => `${percent} % sikker`,
  noGuessMade: 'ingen gjetning',

  // ── hintloggen: en tørr diagnose, ikke en poengsum ────────────────────────
  ledgerEmpty:
    'Ingenting ennå. Det kommer en linje her for hvert av Caseys hint når du er ferdig med å gjette under det.',
  ledgerArmHeading: 'kilde',
  ledgerCluesHeading: 'hint',
  ledgerFoundHeading: 'funnet',
  ledgerRefusedHeading: 'avvist',
  ledgerHitsTitle: (hits, asked) => `${hits} av ${asked} etterspurte ord`,
  ledgerRefusedTitle: 'Hvor ofte det første svaret fra denne kilden ble forkastet og spurt om igjen',
  ledgerExplainer:
    '«funnet» er andelen av ordene et hint ba om som du faktisk snudde. «avvist» er hvor ofte modellens første svar ble forkastet og spurt om igjen. Kildene uten nett kan ikke avvises.',
  ledgerClear: 'Tøm loggen',

  // ── hvordan runden endte ──────────────────────────────────────────────────
  outcomeWonTitle: 'Gratulerer!',
  outcomeWonSub: 'Du vant et postkort!',
  outcomeLostTitle: 'Neste gang',
  outcomeGivenUpSub: 'Runden ble gitt opp. Sammenhengen var der.',
  outcomeWheelMissSub: 'Hjulet landet på en koffert du aldri pakket.',
  /** Hjulets vinnende slutt (eier, 18.09.2026): det landet på grønt. */
  outcomeWheelWinSub: 'Hjulet landet på grønt. Runden er din.',
  outcomeWheelSpentSub: 'Brikken var brukt, og ledetrådene tok likevel slutt.',

  resultLesson: 'En ny valgfri Guide-leksjon er klar.', resultOpenGrammar: 'Åpne grammatikk i Guiden', resultOpenSurvival: 'Åpne overlevelse i Guiden', resultBackToResult: 'Tilbake til resultatet',

  // ── hva runden ga, som én linje under overskriften ────────────────────────
  roundStatsAria: 'Hva denne runden ga',
  newWordsLabel: (n) => (n === 1 ? 'nytt ord' : 'nye ord'),
  collectedForCasey: 'samlet for Casey',
  wrapStatsAria: 'Hva denne pakkerunden pakket',
  wrappedForGood: (named) => (named ? 'pakket inn for godt:' : 'pakket inn for godt'),
  stayedLabel: 'ble stående',

  // ── hvor runden satte reisen: pakkerundens leseområde ─────────────────────
  // Tallet står i egen spenn foran: «13 innpakket i Ribe · 87 igjen før toget
  // til Kolding».
  wrapJourneyHeading: 'Reisen',
  wrapJourneyAria: 'Reisen etter denne pakkerunden',
  wrappedInCity: (_n, city) => `innpakket i ${city}`,
  wrapJourneyTrainReady: (city) => `toget til ${city} er klart`,
  wrapJourneyOver: 'reisen er over',
  wrapJourneyToGo: (_n, city) => `igjen før toget${city ? ` til ${city}` : ''}`,

  // ── pakkerundeøkonomien, sagt på vei ut av en vunnet runde ────────────────
  wrapUpUnlocked:
    'Pakkerunde låst opp. Den pakker samlede ord i kofferten for godt. Åpne kofferten for å bruke den.',
  wrapUpEarned: (banked) => `Pakkerunde opptjent. ${banked} på lager. Bruk én i kofferten.`,
  postcardEarned: (banked) => `+1 oversettelsespostkort · ${banked} klar`,
  wrapUpBankFull: (cap) =>
    `Lageret er fullt. Kofferten rommer ikke mer enn ${cap} pakkerunder. Bruk én, så teller seirene igjen.`,
  winsToWrapUp: (n) =>
    n === 1 ? '1 seier til før en pakkerunde' : `${n} seire til før en pakkerunde`,
  wrapResultFirst: 'Pakkede grønne kort pakkes inn for godt, enten runden vinnes eller tapes.',
  wrapResultNothing:
    'Ingenting pakket inn. Et ord pakkes inn når det var oversatt OG funnet grønt, seier eller tap.',
  wrapResultLost:
    'Å tape kostet deg ingenting her. En pakkerunde beholder det du pakket og fant grønt, seier eller tap.',

  // ── veien ut av en runde ──────────────────────────────────────────────────
  playAgain: 'Spill igjen',
  playNextGame: 'Spill neste',
  home: 'Hjem',
  postWrapChoicesAria: 'Valg etter pakkerunden',
  postWrapHeading: 'Hva nå?',
  postWrapGrammar: 'Grammatikk',
  postWrapSurvival: 'Overlevelse',
  postWrapBoth: 'Begge',
  postWrapBothNote: 'Grammatikk først, så rett videre til dialogen.',
  grammarNote: (city, topic, lessons) =>
    `Grammatikk i ${city}${topic ? `: ${topic}` : ''}${lessons > 1 ? `, ${lessons} leksjoner.` : '.'}`,
  // «Dialog» er glossarets ord for én Overlevelse-dialog; praten inne i den
  // heter derfor samtalen.
  survivalNextNote: (number, total, title) =>
    `Dialog ${number} av ${total}: ${title}. Frasene først, så samtalen.`,
  survivalAllReadTitle: 'Alle fire dialogene er allerede lest.',
  survivalLockedTitle: 'Fullfør en pakkerunde for å låse opp neste dialog.',
  survivalLockedNote: 'Neste dialog låses opp når en pakkerunde er fullført.',

  // ── setningsbåndet under utfallet ─────────────────────────────────────────
  sentenceReviewAria: 'Setningsgjennomgang',
  hearItInDanish: 'Hør det på dansk',
  legendGreenLabel: 'Grønt',
  legendGreenMeaning: ': ordet du fant.',
  legendUnderlinedLabel: 'Understreket',
  legendUnderlinedMeaning: (city) => `: småordene fra ${city}.`,
  legendTapToHear: 'Trykk for å høre.',

  // ── leseren i by 1 som erstatter avslutningsflaten ────────────────────────
  reviewTitle: 'Brettgjennomgang',
  reviewProgress: (current, total) => `${current} av ${total}`,
  reviewOptional: 'Valgfritt · én setning per hint',
  reviewListen: 'Lytt',
  reviewListenSlowlyAria: 'Lytt sakte',
  reviewNoRecordings: 'Vanlig og sakte opptak er utilgjengelig.',
  reviewRecordingUnavailable: 'Opptaket er utilgjengelig.',
  reviewSoundOff: 'Lyden er av, eller avspillingen ble stoppet.',
  reviewShowTranslation: 'Vis oversettelse',
  reviewHideTranslation: 'Skjul oversettelse',
  reviewAboutWord: 'Om dette ordet',
  reviewNoNotes: 'Ingen notater om ordet.',
  reviewNextSentence: 'Neste setning',
  reviewNothingThisRound:
    'Ingenting å gå gjennom denne runden. Du får én setning for hvert av hintene dine som Casey gjettet riktig.',
  sentenceBandNoGreens: 'Ingen grønne ord å sette inn i en setning denne runden.',

  // ── hvorfor et hint ble avvist ────────────────────────────────────────────
  clueNotSingleWord: 'hintet må være ett enkelt ord',
  clueOnBoard: (clue) => `«${clue}» er et ord på brettet`,
  clueTypoOf: (clue, word) => `«${clue}» kan være en skrivefeil for «${word}»`,
  clueGlossOnBoard: (clue, word) => `«${clue}» er den engelske oversettelsen av «${word}» på brettet`,
  clueCompoundOfWord: (clue, word) => `«${clue}» er en sammensetning med «${word}»`,
  clueCompoundOfGloss: (clue, gloss, word) =>
    `«${clue}» er en sammensetning med «${gloss}», oversettelsen av «${word}»`,
  clueFormOfWord: (clue, word) => `«${clue}» er en form av «${word}»`,
  clueFormOfGloss: (clue, gloss, word) =>
    `«${clue}» er en form av «${gloss}», oversettelsen av «${word}»`,

  // ── øvingsrundens dult og den stengte ordboken (gameStore) ────────────────
  practiceClueFinal: 'For dette siste øvingshintet: knytt til det ene grønne ordet som er igjen.',
  practiceClueMany: 'For dette øvingshintet: knytt sammen 2 eller 3 grønne ord.',
  dictionaryClosed: 'Ordboken er stengt til dette er ferdig.',
}
