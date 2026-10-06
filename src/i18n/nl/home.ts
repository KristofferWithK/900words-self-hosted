import type { Catalogue } from '../en'

/**
 * Nederlands. Je/jij, nooit u. De ‘kaart’ is hier zowel de landkaart als een
 * speelkaart — net als in het Duits — maar ze staan nooit op hetzelfde
 * scherm. Een halte op de route is een station; de optionele taalstop heet
 * overal zo.
 *
 * Inpakken doe je met een kaart in de inpakronde; verpakt IS een woord dat
 * die ronde heeft overleefd en in het vak ligt — dat is de telling die op het
 * beginscherm en op de kaart telt. De koffer zelf is ‘gepakt’ als hij vol is.
 */
export const home: Catalogue['home'] = {
  brandName: '900words',
  // ── Beginscherm ─────────────────────────────────────────────────────────
  settingsAria: 'Instellingen',
  openMapAria: 'Kaart openen',
  homeMapAria: (stop, stops, city) => `Station ${stop} van ${stops}: ${city}`,
  needsPass: 'Volgende trein: reispas nodig',
  wrappedWord: 'verpakt',
  collectedCount: (collected) => `${collected} verzameld`,
  journeyDone: (city) => `Je hebt de laatste koffer gepakt in ${city}.`,
  momentumLine: 'Speel 3 borden per dag en je kunt elk woord in 90 dagen verzamelen.',
  dailyPlayedAria: (outcome) => `Dagelijkse uitdaging: vandaag gespeeld (${outcome})`,
  dailyAria: 'Dagelijkse uitdaging: één gedeeld bord per dag',
  play: 'Spelen',
  continueGame: 'Spel hervatten',
  continueWrapUp: 'Inpakronde hervatten',
  continueReview: 'Terugblik hervatten',
  continuePrimary: 'Bord hervatten', continueReplay: 'Herhaling hervatten', returnToPrimary: 'Terug naar je bord',
  viewResult: 'Resultaat bekijken', improveBoards: 'Je borden verbeteren', postcardsEarned: 'ansichtkaarten verdiend',
  postcardsRemaining: (remaining) => `${remaining} ansichtkaart${remaining === 1 ? '' : 'en'} tot de reis`, postcardReadiness: (earned, remaining) => `${earned} ansichtkaarten verdiend; ${remaining} tot de reis.`,
  readyToTravel: 'Klaar om te reizen', nextStopNotReleased: (city) => `Klaar om te reizen. ${city} is nog niet beschikbaar.`, cityMedalInProgress: 'nog niet behaald', cityMedal: (tier) => `Stadsstempel: ${tier}`,
  backToCity: (city) => `Terug naar ${city}`,

  // ── De kaart ────────────────────────────────────────────────────────────
  back: 'Terug',
  journeyTitle: 'De reis',
  mapAria: (country, stop, stops, city) =>
    `Kaart van ${country}. Station ${stop} van ${stops}: ${city}.`,
  stopAria: (city, stop, status) => `${city}, station ${stop}, ${status}`,
  statusVisited: 'bezocht',
  statusHere: 'je bent hier',
  statusNotReached: 'nog niet bereikt',
  statusAhead: 'verderop',
  stopOf: (stop, stops) => `Station ${stop} van ${stops}`,
  arrivedOn: (date) => `aangekomen op ${date}`,
  previousStopAria: 'Vorig station',
  nextStopAria: 'Volgend station',
  wordsWaiting: (words, city) =>
    `${words} woorden wachten. Bereik ${city} om ze vrij te spelen.`,
  lookAhead: 'Vooruitkijken',
  travelAhead: 'Vooruitreizen',
  enableTravelAhead: 'Vooruitreizen aanzetten',
  mapCounts: (goal, collected, discovered) =>
    `/ ${goal} verpakt · ${collected} verzameld · ${discovered} ontdekt`,
  suitcasePacked: 'koffer gepakt',
  lineClosedNote: 'Spoor dicht wegens werkzaamheden. Tik op de trein voor het bericht.',
  travelBackTo: (city) => `Terugreizen → ${city}`,
  travelOnTo: (city) => `Doorreizen → ${city}`,
  trainToClosed: (city) => `Trein naar ${city}: spoor dicht`,
  getPassFor: (city) => `Reispas halen voor ${city}`,
  mapCredit: 'Kort · kaartgegevens: Geodatastyrelsen / DAGI (FOT), 1:500 000',
  backToTheMap: 'Terug naar de kaart',

  // ── De trein, op beide schermen ─────────────────────────────────────────
  trainJourneyOver: 'De koffer is gepakt. De reis is voorbij.',
  trainReady: (city) => `De koffer is gepakt. De trein naar ${city} staat klaar.`,
  wordsToFinish: (words) =>
    `Je hebt nog ${words} ${words === 1 ? 'verpakt woord' : 'verpakte woorden'} nodig om de reis af te maken.`,
  wordsToTrain: (words, city) =>
    `Je hebt nog ${words} ${words === 1 ? 'verpakt woord' : 'verpakte woorden'} nodig voor de trein naar ${city}.`,
  boardTrain: (city) => `Stap in de trein naar ${city}`,

  // ── Aankomen ────────────────────────────────────────────────────────────
  arrivalAgain: (words) =>
    `Terug van weggeweest. Je ${words} woorden van hier zitten nog in de koffer. Speel ze opnieuw, of reis door wanneer je wilt.`,
  arrivalNew: (words) =>
    `${words} nieuwe woorden om te ontdekken. Casey staat open en wacht erop.`,
  getStarted: 'Aan de slag',
  seeTheMap: 'Kaart bekijken',

  // ── De koffer ───────────────────────────────────────────────────────────
  suitcaseTitle: 'De koffer',
  filterAria: 'Koffer filteren op stad',
  filterAll: 'Alle',
  pagerPreviousAria: (band) => `${band}, vorige pagina`,
  pagerNextAria: (band) => `${band}, volgende pagina`,
  looseLabel: (words) => `Nog buiten: ${words}`,
  looseEmpty: 'Niets meer buiten. Elk woord van hier zit in de koffer.',
  lidEmpty: 'Drie tekens verzamelen een woord: een foto, een gok en een hint.',
  trayLabel: (words, goal) => `Verpakt: ${words} van ${goal}`,
  trayEmpty: 'Nog niets in het vak. Inpakrondes leggen woorden hier voorgoed neer.',
  undiscoveredAria: 'Onontdekt woord',
  wrapUpWords: 'Woorden verpakken',
  wrapUpBankedAria: (banked) => `Woorden verpakken: ${banked} gespaard`,
  postcardBalance: (banked) => `Postkaarten · ${banked}`,
  postcardHelp: 'Antwoord nodig? Gebruik een postkaart.',
  packingAnswerShown: 'Antwoord getoond. Druk op Inpakken.',
  packingNoPostcards: 'Win een gewone ronde om een postkaart te verdienen.',
  packingFirstPostcardHint: (language) => `Typ het ${language}-woord om in te pakken. Een postkaart onthult het.`,
  packingPostcardTitle: (state, language) => state === 'shown' ? 'Toon dit antwoord gratis opnieuw.' : state === 'select' ? 'Kies eerst een niet-ingepakte kaart.' : state === 'empty' ? 'Win een gewone ronde om een vertaalpostkaart te verdienen.' : `Gebruik een postkaart om het ${language}-antwoord van deze kaart te onthullen.`,
  packingPostcardAria: (shown, banked) => shown ? 'Vertaling gratis opnieuw tonen' : `Vertaalpostkaart gebruiken: ${banked} beschikbaar`,
  packingPostcardShowAnswer: 'Antwoord tonen',
  usePostcard: 'Postkaart gebruiken',
  wrapUpContinueAria: 'De lopende inpakronde hervatten',
  hintWrapUpWaiting: 'Er loopt al een inpakronde. Ga verder waar je gebleven was.',
  hintCollectFirst: (city) =>
    `Verzamel eerst een woord in ${city}, één keer groen in beide richtingen, dan heeft een inpakronde iets om in te pakken.`,
  hintFirstWrapUp: (wins) =>
    `Win ${wins} ${wins === 1 ? 'ronde' : 'rondes'} voor je eerste inpakronde.`,
  hintMoreWins: (wins) =>
    `Nog ${wins} ${wins === 1 ? 'ronde' : 'rondes'} winnen voor een inpakronde.`,
  hintPacksRange: (collected, city) =>
    `${collected} verzameld in ${city}. Een inpakronde pakt er 13 tot 15 in, afhankelijk van de sleutel.`,
  hintPacksUpTo: (collected, city, cap) =>
    `${collected} verzameld in ${city}. De volgende inpakronde pakt er tot ${cap} in, afhankelijk van de sleutel.`,

  // ── Het inpakdok, bovenaan een inpakronde ───────────────────────────────
  packWord: (word) => `«${word}» inpakken`,
  // Bewust kort: de titelregel deelt zo’n 206px met de telling en kan niet
  // afbreken — ‘Bord inpakken — 3 van 12’ paste daar niet.
  packTheBoard: 'Inpakken',
  packCount: (packed, packable) => `(${packed} van ${packable})`,
  startEarlyWarning: (remaining) =>
    `Beginnen met ${remaining} niet ingepakt. Die blijven Engels en worden deze ronde niet verpakt`,
  startEarly: (remaining) => `Beginnen met ${remaining}`,
  tapEnglishCard: 'Tik op een Engelse kaart',
  theWordFor: (language, word) => `Het ${language} voor ${word}`,
  tapEnglishCardFirst: 'Tik eerst op een Engelse kaart',
  pack: 'Inpakken',
  packMiss: 'Mis. Die fout wordt onthouden. Blijf proberen.',
  packFirstTime:
    'Typ het Deens om in te pakken. Vroeg beginnen laat kaarten Engels en onverpakt.',
  packRecall: 'Het woordenboek is dicht. Nu komt het op je geheugen aan.',
  packTapAndType: (language) => `Tik op een Engelse kaart en typ het ${language} ervan.`,

  // ── De reispas ──────────────────────────────────────────────────────────
  passBackAria: 'Terug naar de kaart',
  passTitle: 'Volgende treinen',
  passKicker: 'Je eerste twee steden zijn gratis.',
  passHeading: 'Een reispas voor de rest van Denemarken',
  passIntro:
    'Helaas is het openbaar vervoer in Denemarken niet gratis. Wil je de volgende treinen nemen, dan heb je een reispas nodig.',
  passOptionsAria: 'Reispasopties',
  passMonthly: 'Reispas per maand',
  passMonthlyHelp: 'Reis door zolang je reispas geldig is.',
  passLifetime: 'Reispas voor altijd',
  passLifetimeHelp: 'Eén reispas voor elke reis die we ooit uitbrengen.',
  passReady: 'Je reispas is klaar. De volgende trein staat open.',
  passRestore: 'Aankopen herstellen',
  passRedeem: 'App Store-code inwisselen',
  passKindness: 'Leren mag niet van geld afhangen.',
  // ‘… stuur die naar ⟨adres⟩ voor een …’: het adres staat met spaties tussen
  // de twee helften, daarom begint de tweede zonder komma.
  passReviewBefore:
    'Schrijf een recensie in de App Store, maak er een foto van en stuur die naar',
  passReviewAfter:
    'voor een reispascode van 6 maanden. Je recensie mag goed of slecht zijn, net hoe je de app vindt.',

  // ── Upgrade na de dagelijkse limiet ──────────────────────────────────────
  dailyLimitKicker: 'Gratis krijg je twee keer Sightseeing en twee cafépuzzels per dag.',
  dailyLimitRunsKicker: 'Je hebt vandaag al twee keer Sightseeing gedaan.',
  dailyLimitPuzzlesKicker: 'Je hebt vandaag al twee cafépuzzels gespeeld.',
  dailyLimitBothKicker: 'Je hebt vandaag al twee keer Sightseeing gedaan en twee cafépuzzels gespeeld.',
  dailyLimitPuzzlesLeft: (n: number) => (n === 1 ? 'Je kunt vandaag nog 1 cafépuzzel spelen.' : `Je kunt vandaag nog ${n} cafépuzzels spelen.`),
  dailyLimitRunsLeft: (n: number) => (n === 1 ? 'Je kunt vandaag nog 1 keer Sightseeing doen.' : `Je kunt vandaag nog ${n} keer Sightseeing doen.`),
  dailyLimitHeading: 'Speel verder met Casey',
  dailyLimitBody: 'Kom morgen terug, of ontgrendel onbeperkt Sightseeing en cafépuzzels.',
  dailyLimitOptionsAria: 'Opties voor onbeperkt spelen',
  dailyLimitMonthly: 'Maandelijks',
  dailyLimitMonthlyHelp: 'Wordt elke maand automatisch verlengd totdat je opzegt.',
  dailyLimitLifetime: 'Eenmalig',
  dailyLimitLifetimeHelp: 'Onbeperkt spelen, zonder abonnement.',
  dailyLimitUnavailable: 'Niet beschikbaar',
  dailyLimitCloseAria: 'Upgradedialoog sluiten',
  dailyLimitRestore: 'Aankopen herstellen',
  dailyLimitDismiss: 'Misschien morgen',
  dailyLimitDisclosure: 'Apple toont de prijzen en bevestigt aankopen. Beheer of zeg je abonnement op via je Apple Account.',
  dailyLimitDisclosurePlay: 'Google Play toont de prijzen en bevestigt aankopen. Beheer of zeg je abonnement op in de Play Store-app.',
  purchaseTerms: 'Gebruiksvoorwaarden',
  purchasePrivacy: 'Privacybeleid',
  passThanksHeading: 'Bedankt dat je de ontwikkeling van 900words steunt',
  passThanksBody: 'Onbeperkt spelen is ontgrendeld.',
  passThanksContinue: 'Verder spelen',

  // ── De optionele taalstop ───────────────────────────────────────────────
  stopKicker: 'Optionele taalstop',
  stopKindGrammar: 'Grammaticaoefening',
  stopKindSituation: 'Een kleine situatie',
  stopKindExit: 'Optionele vertrekopdracht',
  stopKindReview: 'Tijd voor herhaling',
  stopFocus: 'Je volgende taalfocus',
  stopNote:
    'Deze stop wordt los van je koffer opgeslagen. Hij verandert nooit welke woorden je kunt inpakken, en ook niet of de trein kan vertrekken.',
  stopAuthoring:
    'De Deense opdrachten en hun beoordeling worden nog geschreven, samen met de cursusinhoud. Bewaar deze stop voor later of laat hem in je reisgids staan; een poging op een plaatshouder telt nooit als leerbewijs.',
  stopContinue: 'Doorgaan',
  // Zelfde woord als de activiteitstoestand in de reisgids: de knop zet die.
  stopLater: 'Later',
  stopSkip: 'Deze stop overslaan',
  stopStart: 'Starten',
  stopOpen: 'Taalstop',

  // ── het gesloten spoor (src/journey/trainService.ts) ─────────────────────
  trainClosedLabel: (city) =>
    `De trein naar ${city} rijdt nog niet. Het spoor is dicht wegens werkzaamheden`,
  trainClosedTitle: 'Het spoor is dicht wegens werkzaamheden',
  trainClosedBody: (city, here) =>
    `De trein naar ${city} rijdt nog even niet. Er wordt aan het spoor gewerkt. ` +
    `Hij rijdt binnenkort weer, en zodra het zover is, lees je het hier. ` +
    `Tot die tijd is ${here} helemaal van jou: elk bord, elke inpakronde en je reeks.`,
  trainReopenedTitle: (city) => `De trein naar ${city} rijdt weer`,
  trainReopenedBody:
    'Het spoor is open. Je koffer is gepakt en Casey staat op het perron. Stap in wanneer je wilt.',

  // Current Settings and German-preview integration.
  previewHeading: "Nog geen woordspel",
  previewNote: "De kaart en de Reisgids zijn er al. De borden, aanwijzingen en opnamen zijn nog niet klaar.",
  previewGuideCta: "Open de Reisgids",
  // ── café world Home (CW-10) ──────────────────────────────────────────────
  cafePuzzle: 'Cafépuzzel',
  sightseeingNote: 'vind nieuwe cafés',
  trainSheetTitle: (city) => `De trein naar ${city}`,
  trainSheetWords: (city, total, board, connecting) =>
    connecting > 0 ? `${city}: ${total} woorden (${board} op de borden, ${connecting} verbindingswoorden)` : `${city}: ${total} woorden`,
  trainSheetCollected: (collected, total) => `Verzameld: ${collected} van ${total}`,
  trainSheetRule: 'De run is de enige weg de trein in.',
  cityStampAria: (city, percent) => `${city}: ${percent} van de stempels van de cafés.`,
  stampNone: 'Geen stempel',
  cafeNotFoundNote: 'vind eerst een café',
  cafeNotFoundLine: 'Vind eerst een café tijdens Sightseeing.',
  // ── café world suitcase (CW-11): marks, the lid and the stamp card ───────
  lidLegend: 'Een derde elk voor een foto, een gok en een hint',
  markPhoto: 'foto',
  markGuess: 'gok',
  markClue: 'hint',
  markPhotoDays: (days) => (days === 1 ? 'een foto op 1 dag' : `foto’s op ${days} dagen`),
  markAria: (word, earned, total, marks) =>
    marks ? `${word}, ${earned} van ${total}: ${marks}` : `${word}, ${earned} van ${total}`,
  connectingWord: 'Verbindingswoord',
  connectingWordRule: 'Het heeft geen kaart. Foto’s op drie verschillende dagen verzamelen het.',
  stampCardTitle: (city) => `Stempelkaart van ${city}`,
  stampCardLine: (percent, goal, stamped, cafes) =>
    [percent, goal, `${stamped} van ${cafes} cafés`].filter(Boolean).join(' · '),
  stampCardGoal: (tier, percent) => `${tier} vanaf ${percent}`,
  stampFound: 'Gevonden',
  stampNotFound: 'Niet gevonden',
  stampCafeNumber: (place) => `Café ${place}`,
  stampCellStamped: (cafe, stamp) => `${cafe}: ${stamp}`,
  stampCellFound: (cafe) => `${cafe}: gevonden, nog niet gespeeld`,
  stampCellNotFound: (place) => `Café ${place}: nog niet gevonden`,
  stampNextCafe: (cafe) => `Volgend café: ${cafe}`,
  stampNextCafeUnfound: 'Vind het volgende café tijdens Sightseeing.',
  stampAllPlayed: 'Elk café is gespeeld. Tik er een aan om het opnieuw te spelen.',
}
