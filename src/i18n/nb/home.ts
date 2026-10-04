import type { Catalogue } from '../en'

/**
 * Norsk bokmål. Du. Toget går faktisk her, så «tur» og «trekk» hører spillet
 * til og toget er alltid toget. Et kort PAKKES i pakkerunden; et ord som har
 * overlevd den og ligger i bunnen ER innpakket — det er tallet som teller på
 * Hjem og på kartet. «Rekke» er dagene på rad.
 */
export const home: Catalogue['home'] = {
  brandName: '900words',
  // ── Hjem ────────────────────────────────────────────────────────────────
  settingsAria: 'Innstillinger',
  openMapAria: 'Åpne kartet',
  homeMapAria: (stop, stops, city) => `Stasjon ${stop} av ${stops}: ${city}`,
  needsPass: 'Neste tog krever reisekort',
  /** Det fete tallet tegnes foran dette ordet: «12 innpakket · 5 samlet». */
  wrappedWord: 'innpakket',
  collectedCount: (collected) => `${collected} samlet`,
  journeyDone: (city) => `Du pakket den siste kofferten i ${city}.`,
  momentumLine: 'Spill 3 brett om dagen, så kan du samle alle ordene på 90 dager.',
  dailyPlayedAria: (outcome) => `Dagens utfordring: spilt i dag (${outcome})`,
  dailyAria: 'Dagens utfordring: ett felles brett per dato',
  play: 'Spill',
  continueGame: 'Fortsett spillet',
  continueWrapUp: 'Fortsett pakkerunden',
  continueReview: 'Fortsett gjennomgang',
  continuePrimary: 'Fortsett brettet', continueReplay: 'Fortsett omspilling', returnToPrimary: 'Tilbake til brettet ditt',
  viewResult: 'Se resultat', improveBoards: 'Forbedre brettene dine', postcardsEarned: 'opptjente postkort',
  postcardsRemaining: (remaining) => `${remaining} postkort igjen til reisen`, postcardReadiness: (earned, remaining) => `${earned} postkort opptjent; ${remaining} igjen til reisen.`,
  readyToTravel: 'Klar til å reise', nextStopNotReleased: (city) => `Klar til å reise. ${city} er ikke lansert ennå.`, cityMedalInProgress: 'ikke oppnådd ennå', cityMedal: (tier) => `Bymedalje: ${tier}`,
  backToCity: (city) => `Tilbake til ${city}`,

  // ── Kartet ──────────────────────────────────────────────────────────────
  back: 'Tilbake',
  journeyTitle: 'Reisen',
  mapAria: (country, stop, stops, city) =>
    `Kart over ${country}. Stasjon ${stop} av ${stops}: ${city}.`,
  stopAria: (city, stop, status) => `${city}, stasjon ${stop}, ${status}`,
  statusVisited: 'besøkt',
  statusHere: 'du er her',
  statusNotReached: 'ikke nådd ennå',
  statusAhead: 'lenger framme',
  stopOf: (stop, stops) => `Stasjon ${stop} av ${stops}`,
  arrivedOn: (date) => `ankom ${date}`,
  previousStopAria: 'Forrige stasjon',
  nextStopAria: 'Neste stasjon',
  wordsWaiting: (words, city) => `${words} ord venter. Nå ${city} for å låse dem opp.`,
  lookAhead: 'Se framover',
  travelAhead: 'Reis framover',
  enableTravelAhead: 'Slå på Reis framover',
  mapCounts: (goal, collected, discovered) =>
    `/ ${goal} innpakket · ${collected} samlet · ${discovered} oppdaget`,
  suitcasePacked: 'koffert pakket',
  lineClosedNote: 'Strekningen er stengt for vedlikehold. Trykk på toget for meldingen.',
  travelBackTo: (city) => `Reis tilbake → ${city}`,
  travelOnTo: (city) => `Reis videre → ${city}`,
  trainToClosed: (city) => `Toget til ${city}: strekningen er stengt`,
  getPassFor: (city) => `Skaff reisekort til ${city}`,
  /** «Kort» er det danske ordet som står på selve kartet; bare krediteringen oversettes. */
  mapCredit: 'Kort · kartdata: Geodatastyrelsen / DAGI (FOT), 1:500 000',
  backToTheMap: 'Tilbake til kartet',

  // ── Toget, på begge skjermene ───────────────────────────────────────────
  trainJourneyOver: 'Kofferten er pakket. Reisen er over.',
  trainReady: (city) => `Kofferten er pakket. Toget til ${city} er klart.`,
  wordsToFinish: (words) =>
    `Du trenger ${words} ${words === 1 ? 'innpakket ord' : 'innpakkede ord'} til for å fullføre reisen.`,
  wordsToTrain: (words, city) =>
    `Du trenger ${words} ${words === 1 ? 'innpakket ord' : 'innpakkede ord'} til for å ta toget til ${city}.`,
  boardTrain: (city) => `Gå på toget til ${city}`,

  // ── Å ankomme ───────────────────────────────────────────────────────────
  arrivalAgain: (words) =>
    `Tilbake igjen. De ${words} ordene dine herfra ligger fortsatt i kofferten. Spill dem igjen, eller reis videre når du vil.`,
  arrivalNew: (words) => `${words} nye ord å oppdage. Casey står åpen og venter på dem.`,
  getStarted: 'Kom i gang',
  seeTheMap: 'Se kartet',

  // ── Kofferten ───────────────────────────────────────────────────────────
  suitcaseTitle: 'Kofferten',
  filterAria: 'Filtrer kofferten etter by',
  filterAll: 'Alle',
  pagerPreviousAria: (band) => `${band}, forrige side`,
  pagerNextAria: (band) => `${band}, neste side`,
  looseLabel: (words) => `Fortsatt der ute: ${words}`,
  looseEmpty: 'Ingenting løst. Alle ordene herfra ligger i kofferten.',
  lidEmpty: 'Tre merker samler et ord: et bilde, en gjetning og et hint.',
  trayLabel: (words, goal) => `Innpakket: ${words} av ${goal}`,
  trayEmpty: 'Ingenting i bunnen ennå. Pakkerunder legger ord her for godt.',
  undiscoveredAria: 'Uoppdaget ord',
  wrapUpWords: 'Pakk inn ord',
  wrapUpBankedAria: (banked) => `Pakk inn ord: ${banked} på lager`,
  postcardBalance: (banked) => `Postkort · ${banked}`,
  postcardHelp: 'Trenger du svaret? Bruk et postkort.',
  packingAnswerShown: 'Svaret vises. Trykk Pakk.',
  packingNoPostcards: 'Vinn en vanlig runde for å få et postkort.',
  packingFirstPostcardHint: (language) => `Skriv ordet på ${language} for å pakke. Et postkort viser det.`,
  packingPostcardTitle: (state, language) => state === 'shown' ? 'Vis dette svaret gratis igjen.' : state === 'select' ? 'Velg først et upakket kort.' : state === 'empty' ? 'Vinn en vanlig runde for å få et oversettelsespostkort.' : `Bruk et postkort for å vise kortets svar på ${language}.`,
  packingPostcardAria: (shown, banked) => shown ? 'Vis oversettelsen gratis igjen' : `Bruk oversettelsespostkort: ${banked} tilgjengelige`,
  packingPostcardShowAnswer: 'Vis svar',
  usePostcard: 'Bruk postkort',
  wrapUpContinueAria: 'Fortsett pakkerunden som er i gang',
  hintWrapUpWaiting: 'En pakkerunde er allerede i gang. Fortsett der du slapp.',
  hintCollectFirst: (city) =>
    `Samle et ord i ${city} først, grønt én gang i hver retning, så har en pakkerunde noe å pakke.`,
  hintFirstWrapUp: (wins) =>
    `Vinn ${wins} ${wins === 1 ? 'runde' : 'runder'} for å få din første pakkerunde.`,
  hintMoreWins: (wins) => `Vinn ${wins} ${wins === 1 ? 'runde' : 'runder'} til for å få en pakkerunde.`,
  hintPacksRange: (collected, city) =>
    `${collected} samlet i ${city}. En pakkerunde pakker 13 til 15, avhengig av nøkkelen.`,
  hintPacksUpTo: (collected, city, cap) =>
    `${collected} samlet i ${city}. Neste pakkerunde kan pakke opptil ${cap}, avhengig av nøkkelen.`,

  // ── Pakkedokken, øverst i en pakkerunde ─────────────────────────────────
  packWord: (word) => `Pakk «${word}»`,
  packTheBoard: 'Pakk brettet',
  /** Følger dokktittelen: «Pakk brettet — 3 av 12». */
  packCount: (packed, packable) => `(${packed} av ${packable})`,
  startEarlyWarning: (remaining) =>
    `Start med ${remaining} upakket. De blir stående på engelsk og kan ikke pakkes inn denne runden`,
  startEarly: (remaining) => `Start med ${remaining}`,
  tapEnglishCard: 'Trykk på et engelsk kort',
  theWordFor: (language, word) => `${word} på ${language}`,
  tapEnglishCardFirst: 'Trykk på et engelsk kort først',
  pack: 'Pakk',
  packMiss: 'Ikke det. Bommen er notert. Prøv videre.',
  packFirstTime:
    'Skriv dansk for å pakke. Starter du tidlig, blir kortene stående på engelsk og uten innpakning.',
  packRecall: 'Ordboken er stengt. Nå gjelder det å huske.',
  packTapAndType: (language) => `Trykk på et engelsk kort og skriv ordet på ${language}.`,

  // ── Reisekortet ─────────────────────────────────────────────────────────
  passBackAria: 'Tilbake til kartet',
  passTitle: 'Neste tog',
  passKicker: 'De to første byene dine er gratis.',
  passHeading: 'Et reisekort for resten av Danmark',
  passIntro:
    'Kollektivtransporten i Danmark er dessverre ikke gratis. Vil du ta de neste togene, trenger du et reisekort.',
  passOptionsAria: 'Reisekortalternativer',
  passMonthly: 'Reisekort for én måned',
  passMonthlyHelp: 'Reis videre så lenge reisekortet ditt er gyldig.',
  passLifetime: 'Reisekort for alltid',
  passLifetimeHelp: 'Ett reisekort for hver reise vi noen gang lager.',
  passReady: 'Reisekortet ditt er klart. Neste tog er åpent.',
  passRestore: 'Gjenopprett kjøp',
  passRedeem: 'Løs inn en App Store-kode',
  passKindness: 'Læring skal ikke avhenge av penger.',
  // «… og send det til ⟨adresse⟩ for å få …»: adressen står med mellomrom
  // mellom de to halvdelene.
  passReviewBefore: 'Skriv en omtale i App Store, ta et bilde av den og send det til',
  passReviewAfter:
    'for å få en reisekortkode som gjelder i 6 måneder. Omtalen kan være god eller dårlig, alt etter hvordan du liker appen.',

  // ── Oppgradering etter den daglige grensen ────────────────────────────────
  dailyLimitKicker: 'Gratis får du to turer og to kafégåter om dagen.',
  dailyLimitRunsKicker: 'Du har gått to turer i dag.',
  dailyLimitPuzzlesKicker: 'Du har spilt to kafégåter i dag.',
  dailyLimitBothKicker: 'Du har gått to turer og spilt to kafégåter i dag.',
  dailyLimitPuzzlesLeft: (n: number) => (n === 1 ? 'Du kan fortsatt spille 1 kafégåte i dag.' : `Du kan fortsatt spille ${n} kafégåter i dag.`),
  dailyLimitRunsLeft: (n: number) => (n === 1 ? 'Du kan fortsatt gå 1 tur i dag.' : `Du kan fortsatt gå ${n} turer i dag.`),
  dailyLimitHeading: 'Spill videre med Casey',
  dailyLimitBody: 'Kom tilbake i morgen, eller lås opp ubegrensede turer og kafégåter.',
  dailyLimitOptionsAria: 'Alternativer for ubegrenset spilling',
  dailyLimitMonthly: 'Månedlig',
  dailyLimitMonthlyHelp: 'Fornyes automatisk hver måned til du sier opp.',
  dailyLimitLifetime: 'Én betaling',
  dailyLimitLifetimeHelp: 'Ubegrenset spilling uten abonnement.',
  dailyLimitUnavailable: 'Ikke tilgjengelig',
  dailyLimitCloseAria: 'Lukk tilbudet',
  dailyLimitRestore: 'Gjenopprett kjøp',
  dailyLimitDismiss: 'Kanskje i morgen',
  dailyLimitDisclosure: 'Apple oppgir prisene og bekrefter kjøp. Administrer eller si opp abonnementet på Apple-kontoen din.',
  dailyLimitDisclosurePlay: 'Google Play oppgir prisene og bekrefter kjøp. Administrer eller si opp abonnementet i Play Butikk-appen.',
  purchaseTerms: 'Vilkår for bruk',
  purchasePrivacy: 'Personvernerklæring',
  passThanksHeading: 'Takk for at du støtter utviklingen av 900words',
  passThanksBody: 'Ubegrenset spilling er låst opp.',
  passThanksContinue: 'Spill videre',

  // ── Den valgfrie språkstasjonen ─────────────────────────────────────────
  stopKicker: 'Valgfri språkstasjon',
  stopKindGrammar: 'Grammatikkøvelse',
  stopKindSituation: 'En liten situasjon',
  stopKindExit: 'Valgfri avreisesjekk',
  stopKindReview: 'Tid for repetisjon',
  stopFocus: 'Ditt neste språkfokus',
  stopNote:
    'Denne stasjonen lagres atskilt fra kofferten din. Den endrer aldri hvilke ord du kan pakke, eller om toget kan gå.',
  stopAuthoring:
    'De danske oppgavene og poengsettingen skrives fortsatt sammen med kursinnholdet. Ta den senere, eller la den ligge i guiden; et plassholderforsøk registreres aldri som læring.',
  stopContinue: 'Fortsett',
  stopLater: 'Senere',
  stopSkip: 'Hopp over stasjonen',
  stopStart: 'Begynn',
  stopOpen: 'Språkstasjon',

  // ── den stengte strekningen (src/journey/trainService.ts) ────────────────
  trainClosedLabel: (city) =>
    `Toget til ${city} går ikke ennå. Strekningen er stengt for vedlikehold`,
  trainClosedTitle: 'Strekningen er stengt for vedlikehold',
  trainClosedBody: (city, here) =>
    `Toget til ${city} går ikke helt ennå. Det er arbeid på strekningen. ` +
    `Det går snart igjen, og vi sier fra her i samme øyeblikk det skjer. ` +
    `Fram til da er ${here} helt din: hvert brett, hver pakkerunde og rekken din.`,
  trainReopenedTitle: (city) => `Toget til ${city} går igjen`,
  trainReopenedBody:
    'Strekningen er åpen. Kofferten din er pakket og Casey står på perrongen. Gå på når du vil.',

  // Current Settings and German-preview integration.
  previewHeading: "Ikke noe ordspill ennå",
  previewNote: "Kartet og Reiseguiden er her. Brettene, hintene og opptakene er ikke klare ennå.",
  previewGuideCta: "Åpne Reiseguiden",
  // ── café world Home (CW-10) ──────────────────────────────────────────────
  cafePuzzle: 'Kafégåte',
  sightseeingNote: 'finn nye kafeer',
  sightseeingAsk: 'Hva vil du se etter?',
  wordsWalkNote: 'Hva betyr det? Ta bilde av det riktige ordet og finn nye kafeer.',
  articlesWalkNote: (ask, lanes) =>
    lanes === 2 ? `${ask} Ta veien til venstre eller til høyre.` : `${ask} Hver artikkel har sitt eget felt.`,
  trainSheetTitle: (city) => `Toget til ${city}`,
  trainSheetWords: (city, total, board, connecting) =>
    connecting > 0 ? `${city}: ${total} ord (${board} på brettene, ${connecting} bindeord)` : `${city}: ${total} ord`,
  trainSheetCollected: (collected, total) => `Samlet: ${collected} av ${total}`,
  trainSheetRule: 'Løpet er den eneste veien på toget.',
  cityStampAria: (city, percent) => `${city}: ${percent} av kafeenes stempler.`,
  cafeNotFoundNote: 'finn en kafé først',
  cafeNotFoundLine: 'Finn en kafé på byvandringen først.',
  // ── café world suitcase (CW-11): marks, the lid and the stamp card ───────
  lidLegend: 'En tredel hver for bilde, gjetning og hint',
  markPhoto: 'bilde',
  markGuess: 'gjetning',
  markClue: 'hint',
  markPhotoDays: (days) => (days === 1 ? 'et bilde på 1 dag' : `bilder på ${days} dager`),
  markAria: (word, earned, total, marks) =>
    marks ? `${word}, ${earned} av ${total}: ${marks}` : `${word}, ${earned} av ${total}`,
  connectingWord: 'Bindeord',
  connectingWordRule: 'Det har ikke noe kort. Bilder på tre forskjellige dager samler det.',
  stampCardTitle: (city) => `Stempelkort for ${city}`,
  stampCardLine: (percent, goal, stamped, cafes) =>
    [percent, goal, `${stamped} av ${cafes} kafeer`].filter(Boolean).join(' · '),
  stampCardGoal: (tier, percent) => `${tier} fra ${percent}`,
  stampFound: 'Funnet',
  stampNotFound: 'Ikke funnet',
  stampCafeNumber: (place) => `Kafé ${place}`,
  stampCellStamped: (cafe, stamp) => `${cafe}: ${stamp}`,
  stampCellFound: (cafe) => `${cafe}: funnet, ikke spilt ennå`,
  stampCellNotFound: (place) => `Kafé ${place}: ikke funnet ennå`,
  stampNextCafe: (cafe) => `Neste kafé: ${cafe}`,
  stampNextCafeUnfound: 'Finn neste kafé på byvandringen.',
  stampAllPlayed: 'Alle kafeene er spilt. Trykk på en for å spille den igjen.',
}
