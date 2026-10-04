import type { Catalogue } from '../en'

/**
 * Svenska. Du; Casey är ”hon” och talar här för första gången — kort, varmt,
 * rakt på sak. Glossar: en runda är en runda, ett drag i spelet ett drag
 * (tåget går), packas görs i packrundan, inslaget ÄR ett ord som klarat sig
 * igenom en. Orden i «» är danska och förblir danska.
 */
export const onboarding: Catalogue['onboarding'] = {
  courseText: (course) => {
    const german = course === 'de'
    return {
      languageName: german ? 'tyska' : 'danska',
      countryName: german ? 'Tyskland' : 'Danmark',
      welcome: 'Visste du att 900 ord kan täcka över 80 % av vardagligt tal i de flesta språk?',
      clueField: german
        ? 'När det är din tur skriver du ett tyskt ord här som kopplar ihop två eller tre av dina gröna ord.'
        : 'När det är din tur skriver du ett danskt ord här som kopplar ihop två eller tre av dina gröna ord.',
      dictionary: german
        ? 'Om du behöver ett tyskt ord slår du upp det här. Ordboken stängs när du skickar din ledtråd.'
        : 'Om du behöver ett danskt ord slår du upp det här. Ordboken stängs när du skickar din ledtråd.',
      tutorialHint: 'Använd ordboken för att översätta din idé.',
      practiceIntro: (clue, number) =>
        `Min ledtråd är «${clue}» för ${number}. Vilka ord på brädet kopplar du till den? Tryck på ⓘ när du vill se en översättning.`,
      practiceRationaleTime: 'En klocka visar tiden. En månad och en vecka är tidsenheter.',
      practiceRationaleTimeRecovery: 'Den här ledtråden upprepar tidskopplingen för de tidsord som finns kvar.',
      lastGreen: german
        ? 'Ett av dina gröna ord återstår. Jag kan inte se det, så ge mig en tysk ledtråd för det sista kortet.'
        : 'Ett av dina gröna ord återstår. Jag kan inte se det, så ge mig en dansk ledtråd för det sista kortet.',
      yourTurn: german
        ? 'Min tur är slut. Nu är det din tur. Ge mig en tysk ledtråd som kopplar ihop 2 eller 3 gröna kort på din sida. Jag ser dem inte, precis som du inte ser min nyckel.'
        : 'Min tur är slut. Nu är det din tur. Ge mig en dansk ledtråd som kopplar ihop 2 eller 3 gröna kort på din sida. Jag ser dem inte, precis som du inte ser min nyckel.',
    }
  },
  /** Språkvalet. Visas på ENHETENS språk, före varje val. */
  languageEyebrow: 'Välkommen ombord',
  languageHeading: 'Vilket språk talar du?',
  languageHint: 'Tryck på ditt språk.',
  languageAria: (endonym) => `Använd 900words på ${endonym}`,

  // ── Biljetten: vilket språk vill du LÄRA DIG ─────────────────────────────
  skip: 'Hoppa över',
  ticketEyebrow: 'Välj din resa',
  ticketHeading: 'Vilket språk vill du lära dig?',
  ticketAria: (country, language) => `Res genom ${country}, lär dig ${language}`,
  ticketLearnIn: 'Lär dig i',
  ticketMeta: (words, cities) => `${words} ord · ${cities} städer`,
  ticketHintMany: 'Tryck på en biljett för att välja.',
  ticketHintOne: 'Tryck på din biljett så åker vi.',
  ticketComingSoon: 'Kommer snart',

  // ── Casey before the first walk, and the first walk’s end (CW-13) ──
  introTwoGames: 'Glosor är tråkiga, så vi spelar två spel i stället: en stadsvandring där vi samlar ord, och en ordgåta på ett kafé.',
  introExplore: (city) => `Vi utforskar ${city} och ser om vi hittar ett kafé.`,
  introGo: 'Nu kör vi',
  walkEndFound: 'Gå igen, eller gå hem och spela kaféet vi hittade.',
  walkEndNotFound: 'Gå igen för att leta efter ett kafé, eller gå hem.',

  // ── Rundturens rutor på de riktiga skärmarna ─────────────────────────────
  tourNext: 'Nästa',
  tourDone: 'Nu åker vi',
  tourLoose: 'Ord vi har mött väntar här uppe. Varje ring fylls en tredjedel för varje märke: ett foto på en promenad, en gissning på min ledtråd och en egen ledtråd.',
  tourLid: 'Med tre märken är ordet samlat. Samlade ord hamnar i väskan, och den här raden räknar dem.',
  tourTray: 'Det här är stadens stämpelkort. Varje kafé du spelar får sin stämpel här. En streckad cirkel är ett kafé som hittats men inte spelats än, och ? är ett kafé som återstår att hitta.',
  mapTourHere: (city, words) =>
    `Det här är ${city}, där vi är nu. Varje stad ger ${words} ord att ta med hem.`,
  mapTourNext: (next, _words, city) =>
    `${next} ligger längre fram på linjen. Fortsätt förbättra brädena i ${city}. Nästa hållplats är stängd tills vidare.`,
  homeTourArrival: (city, words) =>
    `Vi har kommit till ${city} för att samla dina första ${words} ord.`,
  homeTourMap:
    'Det här är vår karta. Den visar var vi är nu och städerna som väntar längre fram på rutten.',
  homeTourSuitcase:
    'Tryck på mig när du vill öppna resväskan. Den visar vilka ord du har mött, samlat och packat för gott.',
  homeTourGuide:
    'Reseguiden har grammatik, praktisk danska och övningar från tidigare städer på ett och samma ställe. Du kan läsa i förväg utan att flytta tåget.',
  // ── Den guidade rundturen i övningsrundan (2026-09-18) ───────────────────
  introGameTourKey:
    'De gröna ramarna är dina hemliga ord. Jag ser dem aldrig, precis som du aldrig ser mina. Varje gissning mäts mot nyckeln hos den som gav ledtråden.',
  introGameTourClueField:
    'När det är din tur skriver du ett danskt ord här som kopplar ihop två eller tre av dina gröna ord.',
  introGameTourDictionary:
    'Behöver du ett danskt ord du inte har, slår upp det precis här. Ordboken stänger sig så snart din ledtråd är skickad.',
  introGameTourStepper:
    'Det här talet säger hur många ord din ledtråd namnger. Höj det när en koppling verkligen täcker fler av dina gröna.',
  translationTourBoard:
    'De här väsklocken visar betydelsen av orden vi har hittat. Välj ett av dem i huvudet. Du behöver inte trycka på en resväska först.',
  translationTourInput: (language: string) =>
    `Skriv ordet på ${language} här och tryck sedan på bocken. Ett fel svar kostar ingenting, så försök bara igen.`,
  translationTourWheel:
    'Varje rätt svar ger hjulet ett grönt fält. Du kan snurra när som helst, men landar det på ett tomt fält förlorar du rundan. Är hjulet fullt vinner varje snurr.',
  wheelReadyTour:
    'Hjulet är helt grönt nu, så den här snurren vinner. Tryck på hjulet för att snurra.',
  resultTourRewardNew: (rewards: string) => `Nytt den här gången: ${rewards}.`,
  resultTourRewardHeld: (rewards: string) =>
    `Redan intjänat tidigare, så det räknas inte igen: ${rewards}.`,
  resultTourWinTier: (tier: string, best: string) =>
    `Den här gåtan gav ${tier}. Kaféets bästa stämpel hittills är ${best}.`,
  resultTourLossTier: (best: string) =>
    `Den här gåtan förlorades. En förlorad gåta ger ändå en bronsstämpel. En vunnen gåta ger silver, guld eller platina. Det bästa för det här kaféet hittills är ${best}.`,
  resultTourCityPercent: (city) =>
    `Varje kaféstämpel räknas till medaljen för ${city}: brons från 25 %, silver från 50 %, guld från 75 % och platina vid 100 %.`,
  resultTourNoBestYet: 'inte fastställt ännu',
  resultTourSentence:
    'Det här är en frivillig genomgång. Den visar ett ord från det här brädet i en mening. Det är inget nytt test.',
  resultTourNoReview:
    'Det finns ingen mening att gå igenom den här gången. Det gör inget. Genomgången är alltid frivillig.',
  homeTourSightseeing: 'Stadsvandring är promenaden vi just tog. Varje promenad samlar ord, och ju mer du går, desto fler kaféer hittar du.',
  homeTourCafe: (name) =>
    name ? `Vårt första kafé är ${name}. Tryck på Kafégåta för att slå dig ner och spela.` : 'Vårt första kafé väntar. Tryck på Kafégåta för att slå dig ner och spela.',
  homeTourStamp: 'Varje kafé du spelar får en stämpel. Tillsammans blir de stadens medalj, och här ser du hur långt du har kommit.',
  homeTourCollection: 'Tryck på mig för att öppna resväskan. Jag visar orden vi har samlat och kaféets stämpel.',

  // ── Övningsrundan: Caseys skrivna motiveringar ───────────────────────────
  practiceRationaleDrink: 'Vatten, kaffe och mjölk är alla saker man dricker.',
  practiceRationaleHome: 'Ett hus är ett hem.',
  practiceRationaleRecovery:
    'Det här upprepar den konkreta dryckeskopplingen för de dryckeskort som är kvar.',

  // ── Övningsrundan: Caseys löpande kommentarer ────────────────────────────
  practiceIntro:
    'Min ledtråd är «drikke» för 3. Vilka ord på spelplanen hör ihop med den? Tryck på ⓘ när en översättning skulle hjälpa.',
  guessGreenMore: (word) =>
    `«${word}» är grönt på min nyckel. Gissa vidare, eller sluta medan vi leder.`,
  guessGreenEnd: (word) => `«${word}» är grönt på min nyckel. Där tar min ledtråd slut.`,
  guessGreenEndMine: (word) =>
    `«${word}» är grönt på min nyckel. Där tar min ledtråd slut. Dina gröna dyker upp när det är din tur. Den här ledtråden använde min nyckel.`,
  guessYoursNotMine: (word) =>
    `«${word}» är ett av dina gröna, men det är inte grönt på min nyckel. Den här ledtråden använder min nyckel, så kortet finns kvar för din.`,
  guessMiss: (word) => `«${word}» är inte grönt på min nyckel, så där tar min ledtråd slut.`,
  guessMissMine: (word) =>
    `«${word}» är inte grönt på min nyckel, så där tar min ledtråd slut. Dina gröna dyker upp när det är din tur. Den här ledtråden använde min nyckel.`,
  firstClue: (clue) =>
    `Välkommen till kaféet! Det här första bordet är en kort övning. Vilka ord på brädet kan du koppla till «${clue}»? Tryck på ⓘ på ett ord för att se översättningen, tryck sedan på ett ord och bekräfta det.`,
  clueFor: (clue, number) =>
    `Min ledtråd är «${clue}» för ${number}. Tryck på ett ord som den får dig att tänka på.`,
  lastGreenLeft:
    'Ett av dina gröna är kvar. Jag kan inte se det, så ge mig en dansk ledtråd till det sista kortet.',
  yourTurn:
    'Där tar min tur slut. Nu är det din tur. Ge mig en dansk ledtråd som kopplar ihop 2 eller 3 gröna kort på din sida. Jag kan inte se dem, precis som du inte kan se min nyckel.',
  yourFirstClue: (clue, number, tokens) =>
    `Din ledtråd är «${clue}» för ${number}. De ${tokens} prickarna högst upp är våra gemensamma polletter för rundan. Varje ledtråd, din eller min, kostar en. Jag tänker högt här nedanför.`,
  yourClue: (clue, number) =>
    `Din ledtråd är «${clue}» för ${number}. Mina gissningar använder din nyckel nu. Jag tänker högt här nedanför.`,
  practiceWon: 'Alla gröna hittade. Vi vann! Kafégåtorna blir inte lika lätta, men varje ord vi möter räknas.',
  practiceLost: 'Den rundan gled oss ur händerna, men varje ord vi mötte räknas ändå.',
  findingAClue: 'Min tur. Jag letar efter en ledtråd.',
  practiceTranslation:
    'Brädet är löst! Nu är det översättningstid: varje danskt svar fyller ett hjulsegment. Du kan snurra nu, men ett fullt hjul garanterar grönt. Ett löst bräde kan fortfarande nå Platina här.',
  practiceWheelReady:
    'Hjulet är fullt. Snurra för att landa på grönt. På vanliga bräden är det så resultatet kan nå Platina.',
  practiceFinish:
    'Övningen är klar. Det här bordet ger ingen stämpel. I en kafégåta ger lösningen, översättningen och hjulet kaféet dess stämpel. Du kan spela ett kafé igen för att förbättra stämpeln.',
  demoEndTitle: "Det var ditt första hela bräde.",
  demoEndLine: "I appen fortsätter jag att spela med dig, bräde efter bräde, och jag sparar varje ord du samlar.",
  demoAppStore: "Hämta 900words i App Store",
  demoAppStoreSoon: "900words kommer snart till App Store.",
  demoPlayAgain: "Spela igen",
  demoRestingTitle: "Casey vilar",
  demoRestingBody: "Många har spelat med mig i dag, så jag behöver vila. Kom tillbaka i morgon, eller spela med mig i appen.",
  demoCheckFailed: "Vi kunde inte kontrollera att du är en människa. Ladda om sidan och försök igen.",
  playFullRound: 'Spela kafégåtan',
  returnToParkedGame: 'Gå tillbaka till ditt spel',
}
