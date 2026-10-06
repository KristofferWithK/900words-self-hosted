import type { Catalogue } from '../en'

/**
 * Nederlands. Je/jij, nooit u. Casey is ‘zij’ en spreekt hier voor het eerst —
 * kort, warm, direct. Glossarium: een ronde is een ronde, een beurt is een
 * beurt (de trein rijdt), ingepakt wordt er in de inpakronde, verpakt IS een
 * woord dat die ronde heeft overleefd. De «»-woorden zijn Deens en blijven dat.
 */
export const onboarding: Catalogue['onboarding'] = {
  courseText: (course) => {
    const german = course === 'de'
    return {
      languageName: german ? 'Duits' : 'Deens',
      countryName: german ? 'Duitsland' : 'Denemarken',
      welcome: 'Wist je dat 900 woorden in de meeste talen meer dan 80% van de dagelijkse spreektaal kunnen dekken?',
      clueField: german
        ? 'Typ als je aan de beurt bent hier één woord in het Duits dat twee of drie van je groene woorden verbindt.'
        : 'Typ als je aan de beurt bent hier één woord in het Deens dat twee of drie van je groene woorden verbindt.',
      dictionary: german
        ? 'Zoek een Duits woord dat je nodig hebt hier op. Het woordenboek sluit zodra je je aanwijzing verstuurt.'
        : 'Zoek een Deens woord dat je nodig hebt hier op. Het woordenboek sluit zodra je je aanwijzing verstuurt.',
      tutorialHint: 'Gebruik het woordenboek om je idee te vertalen.',
      practiceIntro: (clue, number) =>
        `Mijn aanwijzing is «${clue}» voor ${number}. Welke woorden op dit bord passen erbij? Tik op ⓘ als je een vertaling nodig hebt.`,
      practiceRationaleTime: 'Een klok geeft de tijd aan. Een maand en een week zijn tijdseenheden.',
      practiceRationaleTimeRecovery: 'Deze aanwijzing herhaalt de tijdsverbinding voor de tijdwoorden die nog over zijn.',
      lastGreen: german
        ? 'Er is nog één groen woord over. Ik kan het niet zien, dus geef me een Duitse aanwijzing voor die laatste kaart.'
        : 'Er is nog één groen woord over. Ik kan het niet zien, dus geef me een Deense aanwijzing voor die laatste kaart.',
      yourTurn: german
        ? 'Mijn beurt is voorbij. Nu ben jij aan de beurt. Geef me een Duitse aanwijzing die 2 of 3 groene kaarten aan jouw kant verbindt. Ik kan ze niet zien, net zoals jij mijn sleutel niet kunt zien.'
        : 'Mijn beurt is voorbij. Nu ben jij aan de beurt. Geef me een Deense aanwijzing die 2 of 3 groene kaarten aan jouw kant verbindt. Ik kan ze niet zien, net zoals jij mijn sleutel niet kunt zien.',
    }
  },
  /** De taalkeuze. Getoond in de taal van het APPARAAT, vóór enige keuze. */
  languageEyebrow: 'Welkom aan boord',
  languageHeading: 'Welke taal spreek je?',
  languageHint: 'Tik op je taal.',
  languageAria: (endonym) => `900words in het ${endonym} gebruiken`,

  // ── Het kaartje: welke taal wil je LEREN ─────────────────────────────────
  skip: 'Overslaan',
  ticketEyebrow: 'Kies je reis',
  ticketHeading: 'Welke taal wil je leren?',
  ticketAria: (country, language) => `Reis door ${country}, leer ${language}`,
  ticketLearnIn: 'Leren in',
  ticketMeta: (words, cities) => `${words} woorden · ${cities} steden`,
  ticketHintMany: 'Tik op een kaartje om te kiezen.',
  ticketHintOne: 'Tik op je kaartje en we gaan.',
  ticketComingSoon: 'Binnenkort',

  // ── Casey before the first walk, and the first walk’s end (CW-13) ──
  introTwoGames: 'Flashcards zijn saai, dus spelen we twee spellen: Sightseeing om woorden te verzamelen, en een woordpuzzel in een café.',
  introExplore: (city) => `Laten we ${city} verkennen en kijken of we een café vinden.`,
  introGo: 'Op pad',
  walkEndFound: 'Doe nog een keer Sightseeing, of ga naar het beginscherm en speel het café dat we vonden.',
  walkEndNotFound: 'Doe nog een keer Sightseeing om een café te zoeken, of ga naar het beginscherm.',

  // ── De uitlegwolkjes op de echte schermen ───────────────────────────────
  tourNext: 'Volgende',
  tourDone: 'Op weg',
  tourLoose: 'Woorden die we tegenkwamen wachten hier boven. Elke ring vult zich een derde per teken: een foto tijdens Sightseeing, een gok bij mijn hint en een hint van jezelf.',
  tourLid: 'Met drie tekens is een woord verzameld. Verzamelde woorden gaan in de koffer, en deze regel telt ze.',
  tourTray: 'Dit is de stempelkaart van de stad. Elk café dat je speelt krijgt hier zijn stempel. Een gestippelde cirkel is een gevonden café dat nog niet gespeeld is, en ? een café dat nog gevonden moet worden.',
  mapTourHere: (city, words) =>
    `Dit is ${city}, waar we nu zijn. Elke stad heeft ${words} woorden om mee naar huis te nemen.`,
  mapTourNext: (next, _words, city) =>
    `${next} ligt verderop langs de route. Blijf de borden in ${city} verbeteren. De volgende halte is voorlopig gesloten.`,
  homeTourArrival: (city, words) =>
    `We zijn aangekomen in ${city} om je eerste ${words} woorden te verzamelen.`,
  homeTourMap:
    'Dit is onze kaart. Hij laat zien waar we nu zijn en welke steden verderop langs de route wachten.',
  homeTourSuitcase:
    'Tik op mij wanneer je de koffer wilt openen. Hij laat zien welke woorden je bent tegengekomen, hebt verzameld en voorgoed hebt ingepakt.',
  homeTourGuide:
    'De reisgids houdt grammatica, praktisch Deens en de oefeningen van eerdere steden bij elkaar. Je kunt vooruitbladeren zonder dat de trein verder rijdt.',
  // ── De rondleiding door het oefenspel (2026-09-18) ───────────────────────
  introGameTourKey:
    'De groene randen zijn je geheime woorden. Ik zie ze nooit, net zoals jij de mijne nooit ziet. Elke gok wordt gemeten aan de sleutel van wie de hint gaf.',
  introGameTourClueField:
    'Als jij aan de beurt bent, typ hier één Deens woord dat twee of drie van je groene woorden verbindt.',
  introGameTourDictionary:
    'Als je een Deens woord nodig hebt dat je niet hebt, zoek het hier op. Het woordenboek sluit zodra je hint is verstuurd.',
  introGameTourStepper:
    'Dit getal zegt voor hoeveel woorden je hint geldt. Verhoog het wanneer één verband echt meer van je groene kaarten raakt.',
  translationTourBoard:
    'Deze kofferdeksels tonen de betekenis van de woorden die we hebben gevonden. Kies er in gedachten één uit. Je hoeft niet eerst op een koffer te tikken.',
  translationTourInput: (language: string) =>
    `Typ hier het woord in het ${language} en tik dan op het vinkje. Een fout antwoord kost niets, dus probeer het gewoon opnieuw.`,
  translationTourWheel:
    'Elk goed antwoord voegt een groen segment toe. Je mag altijd draaien, maar land je op een leeg segment, dan verlies je de ronde. Is het wiel vol, dan wint elke draai.',
  wheelReadyTour:
    'Het wiel is nu helemaal groen, dus deze draai wint. Tik op het wiel om te draaien.',
  resultTourRewardNew: (rewards: string) => `Nieuw deze keer: ${rewards}.`,
  resultTourRewardHeld: (rewards: string) =>
    `Al eerder verdiend, dus niet nog eens geteld: ${rewards}.`,
  resultTourWinTier: (tier: string, best: string) =>
    `Deze puzzel haalde ${tier}. De beste stempel van het café tot nu toe is ${best}.`,
  resultTourLossTier: (best: string) =>
    `Deze puzzel ging verloren. Een verloren puzzel levert toch een bronzen stempel op. Een gewonnen puzzel levert zilver, goud of platina op. Het beste voor dit café tot nu toe is ${best}.`,
  resultTourCityPercent: (city) =>
    `Elke cafestempel telt mee voor de stadsstempel van ${city}. Het percentage is al je cafestempels samen: betere stempels brengen het omhoog. Brons vanaf 25%, zilver vanaf 50%, goud vanaf 75% en platina bij 100%.`,
  resultTourNoBestYet: 'nog niet bepaald',
  resultTourSentence:
    'Dit is een optionele herhaling. Je ziet een woord van dit bord in een zin. Het is geen nieuwe test.',
  resultTourNoReview:
    'Er is deze keer geen zin om terug te kijken. Dat is prima. Terugkijken is altijd optioneel.',
  homeTourSightseeing: 'Sightseeing is wat we net deden. Elke ronde verzamelt woorden, en hoe meer rondes je doet, hoe meer cafés je vindt.',
  homeTourCafe: (name) =>
    name ? `Ons eerste café is ${name}. Tik op Cafépuzzel om te gaan zitten en te spelen.` : 'Ons eerste café wacht. Tik op Cafépuzzel om te gaan zitten en te spelen.',
  homeTourStamp: 'Dit is de stadsstempel. Het percentage is al je cafestempels samen, en een betere stempel telt zwaarder. Speel een café opnieuw voor een betere stempel, dan gaat hij omhoog.',
  homeTourCollection: 'Tik op mij om de koffer te openen. Erin zitten onze woorden en de stempel van het café.',

  // ── De oefenronde: Casey’s geschreven redeneringen ──────────────────────
  practiceRationaleDrink: 'Water, koffie en melk zijn allemaal dingen die je drinkt.',
  practiceRationaleHome: 'Een huis is een thuis.',
  practiceRationaleRecovery:
    'Dit herhaalt het concrete drinkverband voor de drankkaarten die nog over zijn.',

  // ── De oefenronde: Casey’s lopende commentaar ───────────────────────────
  practiceIntro:
    'Mijn hint is «drikke» voor 3. Welke woorden op dit bord passen erbij? Tik op ⓘ als een vertaling zou helpen.',
  guessGreenMore: (word) =>
    `«${word}» is groen op mijn sleutel. Raad verder, of stop nu we voorstaan.`,
  guessGreenEnd: (word) => `«${word}» is groen op mijn sleutel. Daarmee is mijn hint klaar.`,
  guessGreenEndMine: (word) =>
    `«${word}» is groen op mijn sleutel. Daarmee is mijn hint klaar. Jouw groene kaarten verschijnen als jij aan de beurt bent. Deze hint gebruikte mijn sleutel.`,
  guessYoursNotMine: (word) =>
    `«${word}» is een van jouw groene kaarten, maar op mijn sleutel is hij niet groen. Deze hint gebruikt mijn sleutel, dus de kaart blijft beschikbaar voor die van jou.`,
  guessMiss: (word) =>
    `«${word}» is niet groen op mijn sleutel, dus daarmee is mijn hint klaar.`,
  guessMissMine: (word) =>
    `«${word}» is niet groen op mijn sleutel, dus daarmee is mijn hint klaar. Jouw groene kaarten verschijnen als jij aan de beurt bent. Deze hint gebruikte mijn sleutel.`,
  firstClue: (clue) =>
    `Welkom in het café! Deze eerste tafel is een korte oefening. Welke woorden op dit bord kun je verbinden met «${clue}»? Tik op de ⓘ bij een woord om de vertaling te zien, tik dan op een woord en bevestig het.`,
  clueFor: (clue, number) =>
    `Mijn hint is «${clue}» voor ${number}. Tik op elk woord waar je aan moet denken.`,
  lastGreenLeft:
    'Een van jouw groene kaarten is nog over. Ik kan hem niet zien, dus geef me één Deense hint voor die laatste kaart.',
  yourTurn:
    'Dat was mijn beurt. Nu ben jij. Geef me een Deense hint die 2 of 3 groene kaarten aan jouw kant verbindt. Ik zie ze niet, net zoals jij mijn sleutel niet ziet.',
  yourFirstClue: (clue, number, tokens) =>
    `Jouw hint is «${clue}» voor ${number}. De ${tokens} stippen bovenin zijn onze gedeelde hintfiches. Elke hint, van jou of van mij, kost er een. Hieronder denk ik hardop.`,
  yourClue: (clue, number) =>
    `Jouw hint is «${clue}» voor ${number}. Mijn gokken gebruiken nu jouw sleutel. Hieronder denk ik hardop.`,
  practiceWon: 'Alle groene gevonden. We hebben gewonnen! De cafépuzzels worden niet zo makkelijk, maar elk woord dat we tegenkomen telt.',
  practiceLost:
    'Die ronde ontglipte ons, maar elk woord dat we tegenkwamen telt nog steeds.',
  findingAClue: 'Mijn beurt. Ik zoek een hint.',
  practiceTranslation:
    'Bord opgelost! Nu is het vertaaltijd: elk Deens antwoord vult een wielsegment. Je kunt nu draaien, maar een vol wiel garandeert groen. Een opgelost bord kan hier nog Platina bereiken.',
  practiceWheelReady:
    'Het wiel is vol. Draai het om op groen te landen. Op gewone borden kan je resultaat zo Platina bereiken.',
  practiceFinish:
    'Oefening klaar. Deze tafel levert geen stempel op. In een cafépuzzel leveren oplossen, vertalen en het rad het café zijn stempel op. Je kunt een café opnieuw spelen om de stempel te verbeteren.',
  demoEndTitle: "Dat was je eerste volledige bord.",
  demoEndLine: "In de app speel ik verder met je, bord na bord, en ik bewaar elk woord dat je verzamelt.",
  demoAppStore: "Download 900words in de App Store",
  demoAppStoreSoon: "900words komt binnenkort naar de App Store.",
  demoPlayAgain: "Opnieuw spelen",
  demoRestingTitle: "Casey rust uit",
  demoRestingBody: "Vandaag hebben veel mensen met me gespeeld, dus ik moet even rusten. Kom morgen terug, of speel met me in de app.",
  demoCheckFailed: "We konden niet controleren of je een mens bent. Laad de pagina opnieuw en probeer het nog eens.",
  playFullRound: 'Speel de cafépuzzel',
}
