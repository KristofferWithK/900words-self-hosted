import type { Catalogue } from '../en'

/**
 * Svenska. Du; Casey är ”hon”. Tåget går här på riktigt, så ett drag i spelet
 * heter ”drag”. Ett kort PACKAS i packrundan; ett ord som klarat sig igenom
 * en och ligger i facket ÄR inslaget — det är den siffran som räknas på Hem
 * och på kartan. Resväskan är en resväska, aldrig en koffert.
 */
export const home: Catalogue['home'] = {
  brandName: '900words',
  // ── Hem ──────────────────────────────────────────────────────────────────
  settingsAria: 'Inställningar',
  openMapAria: 'Öppna kartan',
  homeMapAria: (stop, stops, city) => `Station ${stop} av ${stops}: ${city}`,
  needsPass: 'Nästa tåg kräver ett resekort',
  wrappedWord: 'inslagna',
  collectedCount: (collected) => `${collected} samlade`,
  journeyDone: (city) => `Du packade den sista resväskan i ${city}.`,
  momentumLine: 'Spela 3 bräden om dagen så kan du samla alla ord på 90 dagar.',
  dailyPlayedAria: (outcome) => `Dagens utmaning: spelad i dag (${outcome})`,
  dailyAria: 'Dagens utmaning: en gemensam spelplan per dag',
  play: 'Spela',
  continueGame: 'Fortsätt spelet',
  continueWrapUp: 'Fortsätt packrundan',
  continueReview: 'Fortsätt genomgången',
  continuePrimary: 'Fortsätt brädet', continueReplay: 'Fortsätt omspelningen', returnToPrimary: 'Tillbaka till ditt bräde',
  viewResult: 'Visa resultat', improveBoards: 'Förbättra dina bräden', postcardsEarned: 'intjänade vykort',
  postcardsRemaining: (remaining) => `${remaining} vykort kvar till resan`, postcardReadiness: (earned, remaining) => `${earned} intjänade vykort; ${remaining} kvar till resan.`,
  readyToTravel: 'Redo att resa', nextStopNotReleased: (city) => `Redo att resa. ${city} är inte släppt ännu.`, cityMedalInProgress: 'inte intjänad ännu', cityMedal: (tier) => `Stadsstämpel: ${tier}`,
  backToCity: (city) => `Tillbaka till ${city}`,

  // ── Kartan ───────────────────────────────────────────────────────────────
  back: 'Tillbaka',
  journeyTitle: 'Resan',
  mapAria: (country, stop, stops, city) =>
    `Karta över ${country}. Station ${stop} av ${stops}: ${city}.`,
  stopAria: (city, stop, status) => `${city}, station ${stop}, ${status}`,
  statusVisited: 'besökt',
  statusHere: 'du är här',
  statusNotReached: 'inte nådd än',
  statusAhead: 'längre fram',
  stopOf: (stop, stops) => `Station ${stop} av ${stops}`,
  arrivedOn: (date) => `anlände ${date}`,
  previousStopAria: 'Föregående station',
  nextStopAria: 'Nästa station',
  wordsWaiting: (words, city) => `${words} ord väntar. Nå ${city} för att låsa upp dem.`,
  lookAhead: 'Titta framåt',
  travelAhead: 'Res i förväg',
  enableTravelAhead: 'Aktivera Res i förväg',
  mapCounts: (goal, collected, discovered) =>
    `/ ${goal} inslagna · ${collected} samlade · ${discovered} upptäckta`,
  suitcasePacked: 'resväskan packad',
  lineClosedNote: 'Linjen är stängd för banarbete. Tryck på tåget för meddelandet.',
  travelBackTo: (city) => `Res tillbaka → ${city}`,
  travelOnTo: (city) => `Res vidare → ${city}`,
  trainToClosed: (city) => `Tåget till ${city}: linjen stängd`,
  getPassFor: (city) => `Skaffa ett resekort för ${city}`,
  // «Kort» är det danska ordet på själva kartan; bara källhänvisningen översätts.
  mapCredit: 'Kort · kartdata: Geodatastyrelsen / DAGI (FOT), 1:500 000',
  backToTheMap: 'Tillbaka till kartan',

  // ── Tåget, på båda skärmarna ─────────────────────────────────────────────
  trainJourneyOver: 'Resväskan är packad. Resan är slut.',
  trainReady: (city) => `Resväskan är packad. Tåget till ${city} är redo.`,
  wordsToFinish: (words) =>
    `Du behöver ${words} ${words === 1 ? 'inslaget ord' : 'inslagna ord'} till för att avsluta resan.`,
  wordsToTrain: (words, city) =>
    `Du behöver ${words} ${words === 1 ? 'inslaget ord' : 'inslagna ord'} till för att ta tåget till ${city}.`,
  boardTrain: (city) => `Stig på tåget till ${city}`,

  // ── Ankomsten ────────────────────────────────────────────────────────────
  arrivalAgain: (words) =>
    `Välkommen tillbaka. Dina ${words} ord härifrån ligger kvar i resväskan. Spela dem igen, eller res vidare när du vill.`,
  arrivalNew: (words) => `${words} nya ord att upptäcka. Casey står öppen och väntar på dem.`,
  getStarted: 'Kom igång',
  seeTheMap: 'Se kartan',

  // ── Resväskan ────────────────────────────────────────────────────────────
  suitcaseTitle: 'Resväskan',
  filterAria: 'Filtrera resväskan efter stad',
  filterAll: 'Alla',
  pagerPreviousAria: (band) => `${band}, föregående sida`,
  pagerNextAria: (band) => `${band}, nästa sida`,
  looseLabel: (words) => `Kvar där ute: ${words}`,
  looseEmpty: 'Inget löst kvar. Alla ord härifrån ligger i väskan.',
  lidEmpty: 'Tre märken samlar ett ord: ett foto, en gissning och en ledtråd.',
  trayLabel: (words, goal) => `Inslagna: ${words} av ${goal}`,
  trayEmpty: 'Inget packat i facket än. Packrundor lägger ord här för gott.',
  undiscoveredAria: 'Oupptäckt ord',
  wrapUpWords: 'Slå in ord',
  wrapUpBankedAria: (banked) => `Slå in ord: ${banked} i förråd`,
  postcardBalance: (banked) => `Vykort · ${banked}`,
  postcardHelp: 'Behöver du svaret? Använd ett vykort.',
  packingAnswerShown: 'Svaret visas. Tryck på Packa.',
  packingNoPostcards: 'Vinn en vanlig runda för att få ett vykort.',
  packingFirstPostcardHint: (language) => `Skriv ordet på ${language} för att packa. Ett vykort visar det.`,
  packingPostcardTitle: (state, language) => state === 'shown' ? 'Visa svaret igen gratis.' : state === 'select' ? 'Välj först ett opackat kort.' : state === 'empty' ? 'Vinn en vanlig runda för att få ett översättningsvykort.' : `Använd ett vykort för att visa kortets svar på ${language}.`,
  packingPostcardAria: (shown, banked) => shown ? 'Visa översättningen gratis igen' : `Använd översättningsvykort: ${banked} tillgängliga`,
  packingPostcardShowAnswer: 'Visa svar',
  usePostcard: 'Använd vykort',
  wrapUpContinueAria: 'Fortsätt den pågående packrundan',
  hintWrapUpWaiting: 'En packrunda är redan igång. Fortsätt där du slutade.',
  hintCollectFirst: (city) =>
    `Samla först ett ord i ${city}, grönt en gång i varje riktning, så har en packrunda något att packa.`,
  hintFirstWrapUp: (wins) =>
    `Vinn ${wins} ${wins === 1 ? 'runda' : 'rundor'} för att tjäna in din första packrunda.`,
  hintMoreWins: (wins) => `Vinn ${wins} ${wins === 1 ? 'runda' : 'rundor'} till för en packrunda.`,
  hintPacksRange: (collected, city) =>
    `${collected} samlade i ${city}. En packrunda packar 13 till 15, beroende på nyckeln.`,
  hintPacksUpTo: (collected, city, cap) =>
    `${collected} samlade i ${city}. Nästa packrunda packar upp till ${cap}, beroende på nyckeln.`,

  // ── Packbordet, högst upp i en packrunda ─────────────────────────────────
  // Rubrikraden delar plats med räknaren och kan inte radbrytas, därför kort.
  packWord: (word) => `Packa «${word}»`,
  packTheBoard: 'Packa ner',
  packCount: (packed, packable) => `(${packed} av ${packable})`,
  startEarlyWarning: (remaining) =>
    `Starta med ${remaining} opackade. De förblir engelska och kan inte slås in den här rundan`,
  startEarly: (remaining) => `Starta med ${remaining}`,
  tapEnglishCard: 'Tryck på ett engelskt kort',
  theWordFor: (language, word) => `${word} på ${language}`,
  tapEnglishCardFirst: 'Tryck först på ett engelskt kort',
  pack: 'Packa',
  packMiss: 'Inte rätt. Missen är noterad. Fortsätt försöka.',
  packFirstTime: 'Skriv på danska för att packa. Startar du tidigt förblir korten engelska och oinslagna.',
  packRecall: 'Ordboken är stängd. Nu gäller minnet.',
  packTapAndType: (language) => `Tryck på ett engelskt kort och skriv ordet på ${language}.`,

  // ── Resekortet ───────────────────────────────────────────────────────────
  passBackAria: 'Tillbaka till kartan',
  passTitle: 'Kommande tåg',
  passKicker: 'Dina två första städer är gratis.',
  passHeading: 'Ett resekort för resten av Danmark',
  passIntro:
    'Tyvärr är kollektivtrafiken inte gratis i Danmark. Vill du stiga på de kommande tågen behöver du ett resekort.',
  passOptionsAria: 'Alternativ för resekort',
  passMonthly: 'Månadskort',
  passMonthlyHelp: 'Res vidare så länge ditt resekort gäller.',
  passLifetime: 'Resekort för alltid',
  passLifetimeHelp: 'Ett resekort för varje resa vi någonsin ger ut.',
  passReady: 'Ditt resekort är klart. Nästa tåg är öppet.',
  passRestore: 'Återställ köp',
  passRedeem: 'Lös in en App Store-kod',
  passKindness: 'Att lära sig ska inte hänga på pengarna.',
  // ”… skicka den till ⟨adressen⟩ så får du …” — adressen står med blanksteg
  // mellan halvorna, därför inget kommatecken i början.
  passReviewBefore: 'Skriv en recension i App Store, ta en bild av den och skicka den till',
  passReviewAfter:
    'så får du en kod för ett resekort i 6 månader. Recensionen får vara bra eller dålig, beroende på vad du tycker om appen.',

  // ── Uppgradering efter den dagliga gränsen ───────────────────────────────
  dailyLimitKicker: 'Gratis får du Sightseeing två gånger och två kafégåtor om dagen.',
  dailyLimitRunsKicker: 'Du har varit på Sightseeing två gånger i dag.',
  dailyLimitPuzzlesKicker: 'Du har spelat två kafégåtor i dag.',
  dailyLimitBothKicker: 'Du har varit på Sightseeing två gånger och spelat två kafégåtor i dag.',
  dailyLimitPuzzlesLeft: (n: number) => (n === 1 ? 'Du kan fortfarande spela 1 kafégåta i dag.' : `Du kan fortfarande spela ${n} kafégåtor i dag.`),
  dailyLimitRunsLeft: (n: number) => (n === 1 ? 'Du kan fortfarande gå på Sightseeing 1 gång i dag.' : `Du kan fortfarande gå på Sightseeing ${n} gånger i dag.`),
  dailyLimitHeading: 'Fortsätt spela med Casey',
  dailyLimitBody: 'Kom tillbaka i morgon, eller lås upp obegränsad Sightseeing och obegränsade kafégåtor.',
  dailyLimitOptionsAria: 'Alternativ för obegränsat spelande',
  dailyLimitMonthly: 'Månadsvis',
  dailyLimitMonthlyHelp: 'Förnyas automatiskt varje månad tills du säger upp det.',
  dailyLimitLifetime: 'Engångsbetalning',
  dailyLimitLifetimeHelp: 'Obegränsat spelande utan prenumeration.',
  dailyLimitUnavailable: 'Inte tillgängligt',
  dailyLimitCloseAria: 'Stäng erbjudandet',
  dailyLimitRestore: 'Återställ köp',
  dailyLimitDismiss: 'Kanske i morgon',
  dailyLimitDisclosure: 'Apple visar priserna och bekräftar köp. Hantera eller avsluta prenumerationen på ditt Apple-konto.',
  dailyLimitDisclosurePlay: 'Google Play visar priserna och bekräftar köp. Hantera eller avsluta prenumerationen i Play Butik-appen.',
  purchaseTerms: 'Användarvillkor',
  purchasePrivacy: 'Integritetspolicy',
  passThanksHeading: 'Tack för att du stöder utvecklingen av 900words',
  passThanksBody: 'Obegränsat spelande är upplåst.',
  passThanksContinue: 'Spela vidare',

  // ── Den frivilliga språkstationen ────────────────────────────────────────
  stopKicker: 'Frivillig språkstation',
  stopKindGrammar: 'Grammatikövning',
  stopKindSituation: 'En liten vardagssituation',
  stopKindExit: 'Frivillig avresekontroll',
  stopKindReview: 'Dags att repetera',
  stopFocus: 'Ditt nästa språkfokus',
  stopNote:
    'Den här stationen sparas separat från resväskan. Den ändrar aldrig vilka ord du kan packa eller om tåget kan gå.',
  stopAuthoring:
    'De danska uppgifterna och bedömningen skrivs just nu tillsammans med kursinnehållet. Spara den till senare, eller låt den ligga kvar i reseguiden; ett platshållarförsök registreras aldrig som bevis på lärande.',
  stopContinue: 'Fortsätt',
  stopLater: 'Senare',
  stopSkip: 'Hoppa över stationen',
  stopStart: 'Starta',
  stopOpen: 'Språkstation',

  // ── den stängda linjen ───────────────────────────────────────────────────
  trainClosedLabel: (city) => `Tåget till ${city} går inte än. Linjen är stängd för banarbete`,
  trainClosedTitle: 'Linjen är stängd för banarbete',
  trainClosedBody: (city, here) =>
    `Tåget till ${city} går inte riktigt än. Det pågår arbete på linjen. ` +
    `Det går snart igen, och vi säger till här så fort det gör det. ` +
    `Tills dess är ${here} helt ditt: varje spelplan, varje packrunda och din svit.`,
  trainReopenedTitle: (city) => `Tåget till ${city} går igen`,
  trainReopenedBody:
    'Linjen är öppen. Resväskan är packad och Casey står på perrongen. Stig på när du vill.',

  // Current Settings and German-preview integration.
  previewHeading: "Inget ordspel ännu",
  previewNote: "Kartan och Reseguiden finns. Spelplanerna, ledtrådarna och inspelningarna är inte klara ännu.",
  previewGuideCta: "Öppna Reseguiden",
  // ── café world Home (CW-10) ──────────────────────────────────────────────
  cafePuzzle: 'Kafégåta',
  sightseeingNote: 'hitta nya kaféer',
  trainSheetTitle: (city) => `Tåget till ${city}`,
  trainSheetWords: (city, total, board, connecting) =>
    connecting > 0 ? `${city}: ${total} ord (${board} på spelplanerna, ${connecting} bindeord)` : `${city}: ${total} ord`,
  trainSheetCollected: (collected, total) => `Samlade: ${collected} av ${total}`,
  trainSheetRule: 'Loppet är det enda sättet att komma på tåget.',
  cityStampAria: (city, percent) => `${city}: ${percent} av kaféernas stämplar.`,
  stampNone: 'Ingen stämpel',
  cafeNotFoundNote: 'hitta ett kafé först',
  cafeNotFoundLine: 'Hitta ett kafé på Sightseeing först.',
  // ── café world suitcase (CW-11): marks, the lid and the stamp card ───────
  lidLegend: 'En tredjedel var för foto, gissning och ledtråd',
  markPhoto: 'foto',
  markGuess: 'gissning',
  markClue: 'ledtråd',
  markPhotoDays: (days) => (days === 1 ? 'ett foto på 1 dag' : `foton på ${days} dagar`),
  markAria: (word, earned, total, marks) =>
    marks ? `${word}, ${earned} av ${total}: ${marks}` : `${word}, ${earned} av ${total}`,
  connectingWord: 'Bindeord',
  connectingWordRule: 'Det har inget kort. Foton på tre olika dagar samlar det.',
  stampCardTitle: (city) => `Stämpelkort för ${city}`,
  stampCardLine: (percent, goal, stamped, cafes) =>
    [percent, goal, `${stamped} av ${cafes} kaféer`].filter(Boolean).join(' · '),
  stampCardGoal: (tier, percent) => `${tier} från ${percent}`,
  stampFound: 'Hittat',
  stampNotFound: 'Inte hittat',
  stampCafeNumber: (place) => `Kafé ${place}`,
  stampCellStamped: (cafe, stamp) => `${cafe}: ${stamp}`,
  stampCellFound: (cafe) => `${cafe}: hittat, inte spelat än`,
  stampCellNotFound: (place) => `Kafé ${place}: inte hittat än`,
  stampNextCafe: (cafe) => `Nästa kafé: ${cafe}`,
  stampNextCafeUnfound: 'Hitta nästa kafé på Sightseeing.',
  stampAllPlayed: 'Alla kaféer är spelade. Tryck på ett för att spela det igen.',
}
