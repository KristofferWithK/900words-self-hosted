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
      welcome: 'Visste du at 900 ord kan dekke over 80 % av det vi sier til daglig, på de fleste språk? (Trykk for å fortsette.)',
      map: (destination) => german
        ? `Dette er kartet vårt. Vi reiser gjennom Tyskland og samler hundre ord i hver by. ${destination} er målet vårt.`
        : `Dette er kartet vårt. Vi reiser gjennom Danmark og samler hundre ord i hver by. ${destination} er målet vårt.`,
      guide: german
        ? 'Åpne Reiseguiden for grammatikk og praktiske tips i tysk. Du kan lese videre når du vil.'
        : 'Åpne Reiseguiden for grammatikk og praktisk dansk. Du kan også lese videre når du vil.',
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

  // ── Caseys Hjem-introduksjon, steg for steg ─────────────────────────────
  introWelcome:
    'Visste du at 900 ord kan dekke over 80 % av det vi sier til daglig, på de fleste språk? (Trykk for å fortsette.)',
  introMap:
    'Dette er kartet vårt. Vi reiser gjennom Danmark og samler hundre ord i hver by. København er endestasjonen.',
  introGuide:
    'Trenger du grammatikk eller praktisk dansk, åpner du Reiseguiden. Du kan også bla framover når du vil.',
  introPlay: 'Det er alt du trenger for nå. Trykk på Spill, så samler vi de første ordene våre.',
  introBubbleAria: (line) => `${line} Fortsett.`,
  introCaseyOpen: 'Åpne Casey og se ordene vi har samlet',
  introCaseyContinue: 'Fortsett med Casey',
  introPlayFirst: 'Spill ditt første spill',
  introTapCasey: 'Trykk på Casey',

  // ── Veiviserne på de ekte skjermene ─────────────────────────────────────
  tourNext: 'Neste',
  tourDone: 'Da drar vi',
  tourLoose:
    'Ordsamlingen din blir her. Trykk på et ord når du vil se eller høre det igjen.',
  tourLid:
    'Dette er Caseys brettsamling. Et brettnummer og et skrevet nivå viser brettets beste forsøk.',
  tourTray:
    'Åpne et ferdig brett for å spille det igjen. En reprise kan forbedre beste nivå uten å tilbakestille neste obligatoriske brett.',
  tourWrapUp:
    'Her er ditt neste obligatoriske brett. Fullfør brett for å få nivåer. Oversettelser og hjulet kan løfte et løst brett til Platina.',
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
  resultTourPostcards: (amount: string) =>
    `Dette brettet la ${amount} til byen din. Hvert resultat viser akkurat her hva det tjente.`,
  resultTourRewardNew: (rewards: string) => `Nytt denne gangen: ${rewards}.`,
  resultTourRewardHeld: (rewards: string) =>
    `Allerede tjent før, så det telles ikke igjen: ${rewards}.`,
  resultTourNoRewards: 'Dette brettet ga ingen postkort denne gangen. Det kan skje, og du mister ingenting.',
  resultTourWinTier: (tier: string, best: string) =>
    `Dette resultatet er ${tier}. Beste resultat på dette brettet så langt: ${best}.`,
  resultTourLossTier: (best: string) =>
    `Denne runden ble tapt. Bronse viser her bare at du spilte, og er ikke en rekord. Beste resultat på dette brettet så langt: ${best}.`,
  resultTourNoBestYet: 'ikke satt ennå',
  resultTourSentence:
    'Dette er en valgfri gjennomgang. Den viser et ord fra dette brettet i en setning. Det er ingen ny test.',
  resultTourNoReview:
    'Det er ingen setning å gå gjennom denne gangen. Det er helt greit. Gjennomgangen er alltid valgfri.',
  homeTourPostcards:
    'Dette er postkorttotalen din for denne byen. Hvert postkort et brett tjener, legges til her.',
  homeTourCollection:
    'Trykk på meg for å åpne kofferten. Jeg viser deg ordene vi har samlet, og brettene dine.',

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
    `Hei, hvilke ord på brettet kan du knytte til «${clue}»? Du kan trykke på ⓘ ved ordene for å se oversettelsene. Når du er klar, trykker du på et ord og bekrefter det.`,
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
  practiceWon: 'Alle grønne er funnet. Vi vant! Fulle brett blir ikke like lette, men hvert ord vi møter, teller fortsatt.',
  practiceLost: 'Den runden glapp for oss, men hvert ord vi møtte, teller fortsatt.',
  findingAClue: 'Min tur. Jeg leter etter et hint.',
  practiceTranslation:
    'Brettet er løst! Nå er det oversettelsestid: hvert danske svar fyller et hjulsegment. Du kan spinne nå, men et fullt hjul garanterer grønt. Et løst brett kan fortsatt nå Platina her.',
  practiceWheelReady:
    'Hjulet er fullt. Spinn for å lande på grønt. På vanlige brett er det slik resultatet ditt kan nå Platina.',
  practiceFinish:
    'Øvelsen er ferdig. Denne runden gir ikke postkort eller bynivå. På vanlige brett gir løsning, oversettelse og spinn et nivå. Spill et ferdig brett igjen for å forbedre det beste.',
  demoEndTitle: "Det var ditt første hele brett.",
  demoEndLine: "I appen fortsetter jeg å spille med deg, brett etter brett, og jeg tar vare på hvert ord du samler.",
  demoAppStore: "Last ned 900words fra App Store",
  demoAppStoreSoon: "900words kommer snart til App Store.",
  demoPlayAgain: "Spill igjen",
  demoRestingTitle: "Casey hviler",
  demoRestingBody: "Mange har spilt med meg i dag, så jeg trenger en pause. Kom tilbake i morgen, eller spill med meg i appen.",
  demoCheckFailed: "Vi kunne ikke sjekke at du er et menneske. Last inn siden på nytt og prøv igjen.",
  playFullRound: 'Spill ditt første hele brett',
  returnToParkedGame: 'Gå tilbake til spillet ditt',
}
