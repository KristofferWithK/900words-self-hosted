import type { Catalogue } from '../en'

/**
 * Norsk bokmål. Du. Casey er «hun» og snakker her for første gang — kort,
 * varmt, direkte. Glossar: en runde er en runde, et trekk er ett hint med
 * gjettingen under, det pakkes i pakkerunden, og innpakket ER et ord som har
 * overlevd den. «»-ordene er danske og forblir danske.
 */
export const onboarding: Catalogue['onboarding'] = {
  courseText: (course) => {
    const german = course === 'de'
    return {
      languageName: german ? 'tysk' : 'dansk',
      countryName: german ? 'Tyskland' : 'Danmark',
      welcome: 'Visste du at 900 ord kan dekke over 80 % av det vi sier til daglig, på de fleste språk?',
      clueField: german
        ? 'Når det er din tur, skriver du ett tysk ord her som knytter sammen to eller tre av de grønne ordene dine.'
        : 'Når det er din tur, skriver du ett dansk ord her som knytter sammen to eller tre av de grønne ordene dine.',
      dictionary: german
        ? 'Hvis du trenger et tysk ord, slår du det opp her. Ordboka lukkes når du sender hintet.'
        : 'Hvis du trenger et dansk ord, slår du det opp her. Ordboka lukkes når du sender hintet.',
      tutorialHint: 'Bruk ordboka til å oversette ideen din.',
      practiceIntro: (clue, number) =>
        `Hintet mitt er «${clue}» for ${number}. Hvilke ord på brettet forbinder du med det? Trykk på ⓘ når du trenger en oversettelse.`,
      practiceRationaleTime: 'En klokke viser tiden. En måned og en uke er tidsenheter.',
      practiceRationaleTimeRecovery: 'Dette gjentar tidsforbindelsen for tidsordene som fortsatt er igjen.',
      lastGreen: german
        ? 'Ett av de grønne ordene dine står igjen. Jeg kan ikke se det, så gi meg et tysk hint til det siste kortet.'
        : 'Ett av de grønne ordene dine står igjen. Jeg kan ikke se det, så gi meg et dansk hint til det siste kortet.',
      yourTurn: german
        ? 'Turen min er over. Nå er det din tur. Gi meg et tysk hint som kobler sammen 2 eller 3 grønne kort på din side. Jeg ser dem ikke, akkurat som du ikke ser nøkkelen min.'
        : 'Turen min er over. Nå er det din tur. Gi meg et dansk hint som kobler sammen 2 eller 3 grønne kort på din side. Jeg ser dem ikke, akkurat som du ikke ser nøkkelen min.',
    }
  },
  /** Språkvalget. Vises på ENHETENS språk, før noe er valgt. */
  languageEyebrow: 'Velkommen om bord',
  languageHeading: 'Hvilket språk snakker du?',
  languageHint: 'Trykk på språket ditt.',
  languageAria: (endonym) => `Bruk 900words på ${endonym}`,

  // ── Billetten: hvilket språk vil du LÆRE ─────────────────────────────────
  skip: 'Hopp over',
  ticketEyebrow: 'Velg reisen din',
  ticketHeading: 'Hvilket språk vil du lære?',
  ticketAria: (country, language) => `Reis gjennom ${country}, lær ${language}`,
  ticketLearnIn: 'Lær i',
  ticketMeta: (words, cities) => `${words} ord · ${cities} byer`,
  ticketHintMany: 'Trykk på en billett for å velge.',
  ticketHintOne: 'Trykk på billetten din, så drar vi.',
  ticketComingSoon: 'Kommer snart',

  // ── Casey before the first walk, and the first walk’s end (CW-13) ──
  introTwoGames: 'Gloseøving er kjedelig, så vi spiller to spill i stedet: en byvandring for å samle ord, og et ordspill på en kafé.',
  introExplore: (city) => `La oss utforske ${city} og se om vi finner en kafé.`,
  introGo: 'Kom igjen',
  walkEndFound: 'Gå igjen, eller dra hjem og spill kafeen vi fant.',
  walkEndNotFound: 'Gå igjen for å lete etter en kafé, eller dra hjem.',

  // ── Veiviserne på de ekte skjermene ─────────────────────────────────────
  tourNext: 'Neste',
  tourDone: 'Da drar vi',
  tourLoose: 'Ord vi har møtt, venter her oppe. Hver ring fylles en tredel for hvert merke: et bilde på en tur, en gjetning på hintet mitt og et hint fra deg.',
  tourLid: 'Med tre merker er ordet samlet. Samlede ord havner i kofferten, og denne linjen teller dem.',
  tourTray: 'Dette er byens stempelkort. Hver kafé du spiller, får stempelet sitt her. En stiplet sirkel er en kafé som er funnet, men ikke spilt ennå, og ? er en kafé som gjenstår å finne.',
  mapTourHere: (city, words) =>
    `Dette er ${city}, der vi er nå. Hver by har ${words} ord å ta med hjem.`,
  mapTourNext: (next, _words, city) =>
    `${next} ligger lenger ut på ruten. Fortsett å forbedre brettene i ${city}. Neste stopp er stengt inntil videre.`,
  homeTourArrival: (city, words) =>
    `Vi har kommet til ${city} for å samle dine første ${words} ord.`,
  homeTourMap:
    'Dette er kartet vårt. Det viser hvor vi er nå, og byene som venter lenger framme på ruten.',
  homeTourSuitcase:
    'Trykk på meg når du vil åpne kofferten. Den viser hvilke ord du har møtt, samlet og pakket inn for godt.',
  homeTourGuide:
    'Reiseguiden samler grammatikk, praktisk dansk og øvelser fra tidligere byer på ett sted. Du kan bla framover uten at toget flytter seg.',
  // ── Den guidede omvisningen i øvingsrunden (2026-09-18) ──────────────────
  introGameTourKey:
    'De grønne rammene er dine hemmelige ord. Jeg ser dem aldri, akkurat som du aldri ser mine. Hver gjetning måles mot nøkkelen til den som ga hintet.',
  introGameTourClueField:
    'Når det er din tur, skriver du ett dansk ord her som knytter sammen to eller tre av dine grønne ord.',
  introGameTourDictionary:
    'Trenger du et dansk ord du ikke har, slår det opp akkurat her. Ordboken lukker seg så snart hintet ditt er sendt.',
  introGameTourStepper:
    'Dette tallet sier hvor mange ord hintet ditt navngir. Sett det opp når én sammenheng virkelig dekker flere av dine grønne.',
  translationTourBoard:
    'Disse kofferlokkene viser betydningen av ordene vi har funnet. Velg ett av dem i hodet. Du trenger ikke trykke på en koffert først.',
  translationTourInput: (language: string) =>
    `Skriv ordet på ${language} her, og trykk på haken. Et feil svar koster ingenting, så bare prøv igjen.`,
  translationTourWheel:
    'Hvert riktige svar gir hjulet et grønt felt. Du kan snurre når som helst, men lander du på et tomt felt, taper du runden. Er hjulet fullt, vinner hvert snurr.',
  wheelReadyTour:
    'Hjulet er helt grønt nå, så dette snurret vinner. Trykk på hjulet for å snurre.',
  resultTourRewardNew: (rewards: string) => `Nytt denne gangen: ${rewards}.`,
  resultTourRewardHeld: (rewards: string) =>
    `Allerede tjent før, så det telles ikke igjen: ${rewards}.`,
  resultTourWinTier: (tier: string, best: string) =>
    `Denne gåten ga ${tier}. Kafeens beste stempel så langt er ${best}.`,
  resultTourLossTier: (best: string) =>
    `Denne gåten ble tapt. En tapt gåte gir likevel et bronsestempel. En vunnet gåte gir sølv, gull eller platina. Det beste for denne kafeen så langt er ${best}.`,
  resultTourCityPercent: (city) =>
    `Hvert kafestempel teller for medaljen til ${city}: bronse fra 25 %, sølv fra 50 %, gull fra 75 % og platina ved 100 %.`,
  resultTourNoBestYet: 'ikke satt ennå',
  resultTourSentence:
    'Dette er en valgfri gjennomgang. Den viser et ord fra dette brettet i en setning. Det er ingen ny test.',
  resultTourNoReview:
    'Det er ingen setning å gå gjennom denne gangen. Det er helt greit. Gjennomgangen er alltid valgfri.',
  homeTourSightseeing: 'Byvandring er turen vi nettopp gikk. Hver tur samler ord, og jo mer du går, jo flere kafeer finner du.',
  homeTourCafe: (name) =>
    name ? `Vår første kafé er ${name}. Trykk på Kafégåte for å sette deg og spille.` : 'Vår første kafé venter. Trykk på Kafégåte for å sette deg og spille.',
  homeTourStamp: 'Hver kafé du spiller, får et stempel. Sammen blir de byens medalje, og her ser du hvor langt du har kommet.',
  homeTourCollection: 'Trykk på meg for å åpne kofferten. Jeg viser deg ordene vi har samlet og kafeens stempel.',

  // ── Øvingsrunden: Caseys ferdigskrevne begrunnelser ─────────────────────
  practiceRationaleDrink: 'Vann, kaffe og melk er alle ting man drikker.',
  practiceRationaleHome: 'Et hus er et hjem.',
  practiceRationaleRecovery:
    'Dette gjentar den konkrete drikke-koblingen for de drikkekortene som er igjen.',

  // ── Øvingsrunden: Caseys løpende kommentarer ────────────────────────────
  practiceIntro:
    'Hintet mitt er «drikke» for 3. Hvilke ord på brettet henger sammen med det? Trykk på ⓘ når en oversettelse kan hjelpe.',
  guessGreenMore: (word) =>
    `«${word}» er grønt på min nøkkel. Gjett videre, eller slutt mens leken er god.`,
  guessGreenEnd: (word) => `«${word}» er grønt på min nøkkel. Det avslutter hintet mitt.`,
  guessGreenEndMine: (word) =>
    `«${word}» er grønt på min nøkkel. Det avslutter hintet mitt. Dine grønne kommer fram når det er din tur. Dette hintet brukte min nøkkel.`,
  guessYoursNotMine: (word) =>
    `«${word}» er et av dine grønne, men det er ikke grønt på min nøkkel. Dette hintet bruker min nøkkel, så kortet er fortsatt i spill for din.`,
  guessMiss: (word) => `«${word}» er ikke grønt på min nøkkel, så det avslutter hintet mitt.`,
  guessMissMine: (word) =>
    `«${word}» er ikke grønt på min nøkkel, så det avslutter hintet mitt. Dine grønne kommer fram når det er din tur. Dette hintet brukte min nøkkel.`,
  firstClue: (clue) =>
    `Velkommen til kafeen! Dette første bordet er en kort øvelse. Hvilke ord på brettet kan du knytte til «${clue}»? Trykk på ⓘ på et ord for å se oversettelsen, trykk så på et ord og bekreft det.`,
  clueFor: (clue, number) =>
    `Hintet mitt er «${clue}» for ${number}. Trykk på et ord det får deg til å tenke på.`,
  lastGreenLeft:
    'Ett av dine grønne er igjen. Jeg kan ikke se det, så gi meg ett dansk hint for det siste kortet.',
  yourTurn:
    'Der var min tur ferdig. Nå er det din tur. Gi meg et dansk hint som knytter sammen 2 eller 3 grønne kort på din side. Jeg kan ikke se dem, akkurat som du ikke kan se min nøkkel.',
  yourFirstClue: (clue, number, tokens) =>
    `Hintet ditt er «${clue}» for ${number}. De ${tokens} prikkene øverst er de felles brikkene våre for runden. Hvert hint, ditt eller mitt, bruker én. Jeg tenker høyt nedenfor.`,
  yourClue: (clue, number) =>
    `Hintet ditt er «${clue}» for ${number}. Gjetningene mine bruker din nøkkel nå. Jeg tenker høyt nedenfor.`,
  practiceWon: 'Alle grønne funnet. Vi vant! Kafégåtene blir ikke så lette, men hvert ord vi møter teller.',
  practiceLost: 'Den runden glapp for oss, men hvert ord vi møtte, teller fortsatt.',
  findingAClue: 'Min tur. Jeg leter etter et hint.',
  practiceTranslation:
    'Brettet er løst! Nå er det oversettelsestid: hvert danske svar fyller et hjulsegment. Du kan spinne nå, men et fullt hjul garanterer grønt. Et løst brett kan fortsatt nå Platina her.',
  practiceWheelReady:
    'Hjulet er fullt. Spinn for å lande på grønt. På vanlige brett er det slik resultatet ditt kan nå Platina.',
  practiceFinish:
    'Øvelsen er ferdig. Dette bordet gir ikke noe stempel. I en kafégåte gir løsning, oversettelse og hjulet kafeen stempelet sitt. Du kan spille en kafé på nytt for å forbedre stempelet.',
  demoEndTitle: "Det var ditt første hele brett.",
  demoEndLine: "I appen fortsetter jeg å spille med deg, brett etter brett, og jeg tar vare på hvert ord du samler.",
  demoAppStore: "Last ned 900words fra App Store",
  demoAppStoreSoon: "900words kommer snart til App Store.",
  demoPlayAgain: "Spill igjen",
  demoRestingTitle: "Casey hviler",
  demoRestingBody: "Mange har spilt med meg i dag, så jeg trenger en pause. Kom tilbake i morgen, eller spill med meg i appen.",
  demoCheckFailed: "Vi kunne ikke sjekke at du er et menneske. Last inn siden på nytt og prøv igjen.",
  playFullRound: 'Spill kafégåten',
}
