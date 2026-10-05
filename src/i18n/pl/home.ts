import type { Catalogue } from '../en'
import { plural } from './plural'

/**
 * Polski. Ty, nigdy Pan/Pani. Kartę ZAPAKOWUJE się w rundzie pakowania;
 * ZAWINIĘTE jest słowo, które taką rundę przetrwało i leży na dnie walizki —
 * to ta liczba, która liczy się na ekranie startowym i na mapie.
 *
 * Nazwy miast przychodzą jako argumenty w mianowniku i nie da się ich
 * odmienić, więc zdania są budowane tak, żeby mianownik po „do”, „w” i „→”
 * czytał się jak nazwa na tablicy peronowej, nie jak błąd.
 */
export const home: Catalogue['home'] = {
  brandName: '900words',
  // ── Ekran startowy ──────────────────────────────────────────────────────
  settingsAria: 'Ustawienia',
  openMapAria: 'Otwórz mapę',
  homeMapAria: (stop, stops, city) => `Stacja ${stop} z ${stops}: ${city}`,
  needsPass: 'Następny pociąg wymaga karty podróżnej',
  // Liczba stoi w <strong> przed tym słowem i nie przychodzi jako argument.
  // Dopełniacz jest poprawny dla 0, 5+ i 12–14; dla 2–4 powinno być
  // „zawinięte”. Zgłoszone jako brak parametru w angielskim.
  wrappedWord: 'zawiniętych',
  collectedCount: (collected) =>
    `${collected} ${plural(collected, 'zebrane', 'zebrane', 'zebranych')}`,
  journeyDone: (city) => `Ostatnia walizka spakowana w ${city}.`,
  momentumLine: 'Graj na 3 planszach dziennie, a możesz zebrać wszystkie słowa w 90 dni.',
  dailyPlayedAria: (outcome) => `Wyzwanie dnia: dziś rozegrane (${outcome})`,
  dailyAria: 'Wyzwanie dnia: jedna wspólna plansza na każdą datę',
  play: 'Graj',
  continueGame: 'Kontynuuj grę',
  continueWrapUp: 'Kontynuuj pakowanie',
  continueReview: 'Kontynuuj przegląd',
  continuePrimary: 'Kontynuuj planszę', continueReplay: 'Kontynuuj powtórkę', returnToPrimary: 'Wróć do swojej planszy',
  viewResult: 'Zobacz wynik', improveBoards: 'Ulepsz swoje plansze', postcardsEarned: 'zdobyte pocztówki',
  postcardsRemaining: (remaining) => `${remaining} ${plural(remaining, 'pocztówka', 'pocztówki', 'pocztówek')} do podróży`, postcardReadiness: (earned, remaining) => `${earned} zdobyte pocztówki; ${remaining} do podróży.`,
  readyToTravel: 'Gotowe do podróży', nextStopNotReleased: (city) => `Gotowe do podróży. ${city} nie jest jeszcze dostępne.`, cityMedalInProgress: 'jeszcze niezdobyty', cityMedal: (tier) => `Medal miasta: ${tier}`,
  backToCity: (city) => `Wróć do ${city}`,

  // ── Mapa ────────────────────────────────────────────────────────────────
  back: 'Wstecz',
  journeyTitle: 'Podróż',
  mapAria: (country, stop, stops, city) =>
    `Mapa: ${country}. Stacja ${stop} z ${stops}: ${city}.`,
  stopAria: (city, stop, status) => `${city}, stacja ${stop}, ${status}`,
  statusVisited: 'odwiedzona',
  statusHere: 'jesteś tutaj',
  statusNotReached: 'jeszcze nieosiągnięta',
  statusAhead: 'przed tobą',
  stopOf: (stop, stops) => `Stacja ${stop} z ${stops}`,
  arrivedOn: (date) => `przyjazd ${date}`,
  previousStopAria: 'Poprzednia stacja',
  nextStopAria: 'Następna stacja',
  wordsWaiting: (words, city) =>
    `${words} ${plural(words, 'słowo czeka', 'słowa czekają', 'słów czeka')}. Dotrzyj do ${city}, żeby je odblokować.`,
  lookAhead: 'Zajrzyj dalej',
  travelAhead: 'Jedź naprzód',
  enableTravelAhead: 'Włącz jazdę naprzód',
  mapCounts: (goal, collected, discovered) =>
    `/ ${goal} zawiniętych · ${collected} ${plural(collected, 'zebrane', 'zebrane', 'zebranych')} · ${discovered} ${plural(discovered, 'odkryte', 'odkryte', 'odkrytych')}`,
  suitcasePacked: 'walizka spakowana',
  lineClosedNote: 'Linia zamknięta z powodu prac. Dotknij pociągu, by zobaczyć komunikat.',
  travelBackTo: (city) => `Wróć → ${city}`,
  travelOnTo: (city) => `Jedź dalej → ${city}`,
  trainToClosed: (city) => `Pociąg do ${city}: linia zamknięta`,
  getPassFor: (city) => `Zdobądź kartę podróżną do ${city}`,
  mapCredit: 'Kort · dane mapy: Geodatastyrelsen / DAGI (FOT), 1:500 000',
  backToTheMap: 'Wróć do mapy',

  // ── Pociąg, na obu ekranach ─────────────────────────────────────────────
  trainJourneyOver: 'Walizka spakowana. Podróż dobiegła końca.',
  trainReady: (city) => `Walizka spakowana. Pociąg do ${city} jest gotowy.`,
  // „Brakuje” rządzi dopełniaczem: 1 słowa, 3 słów, 5 słów.
  wordsToFinish: (words) =>
    `Brakuje ci jeszcze ${words} ${plural(words, 'zawiniętego słowa', 'zawiniętych słów', 'zawiniętych słów')}, żeby dokończyć podróż.`,
  wordsToTrain: (words, city) =>
    `Brakuje ci jeszcze ${words} ${plural(words, 'zawiniętego słowa', 'zawiniętych słów', 'zawiniętych słów')} na pociąg do ${city}.`,
  boardTrain: (city) => `Wsiądź do pociągu do ${city}`,

  // ── Przyjazd ────────────────────────────────────────────────────────────
  arrivalAgain: (words) =>
    `Znów tutaj. Twoje ${words} ${plural(words, 'słowo stąd wciąż jest', 'słowa stąd wciąż są', 'słów stąd wciąż jest')} w walizce. Zagraj nimi jeszcze raz albo jedź dalej, kiedy chcesz.`,
  arrivalNew: (words) =>
    `${words} ${plural(words, 'nowe słowo do odkrycia', 'nowe słowa do odkrycia', 'nowych słów do odkrycia')}. Casey jest otwarta i na nie czeka.`,
  getStarted: 'Zaczynamy',
  seeTheMap: 'Zobacz mapę',

  // ── Walizka ─────────────────────────────────────────────────────────────
  suitcaseTitle: 'Walizka',
  filterAria: 'Filtruj walizkę według miasta',
  filterAll: 'Wszystkie',
  pagerPreviousAria: (band) => `${band}, poprzednia strona`,
  pagerNextAria: (band) => `${band}, następna strona`,
  looseLabel: (words) => `Jeszcze na zewnątrz: ${words}`,
  looseEmpty: 'Nic nie leży luzem. Każde słowo stąd jest w walizce.',
  lidEmpty: 'Trzy znaki zbierają słowo: zdjęcie, próba i wskazówka.',
  trayLabel: (words, goal) => `Zawinięte: ${words} z ${goal}`,
  trayEmpty: 'Na dnie jeszcze nic nie leży. Rundy pakowania odkładają tu słowa na stałe.',
  undiscoveredAria: 'Nieodkryte słowo',
  wrapUpWords: 'Zawiń słowa',
  wrapUpBankedAria: (banked) => `Zawiń słowa: ${banked} w zapasie`,
  postcardBalance: (banked) => `Pocztówki · ${banked}`,
  postcardHelp: 'Potrzebujesz odpowiedzi? Użyj pocztówki.',
  packingAnswerShown: 'Pokazano odpowiedź. Naciśnij Zapakuj.',
  packingNoPostcards: 'Wygraj zwykłą rundę, aby zdobyć pocztówkę.',
  packingFirstPostcardHint: (language) => `Wpisz słowo po ${language}, aby zapakować. Pocztówka je odkryje.`,
  packingPostcardTitle: (state, language) => state === 'shown' ? 'Pokaż tę odpowiedź ponownie za darmo.' : state === 'select' ? 'Najpierw wybierz niezapakowaną kartę.' : state === 'empty' ? 'Wygraj zwykłą rundę, aby zdobyć pocztówkę tłumaczenia.' : `Użyj pocztówki, aby odkryć odpowiedź po ${language} na tej karcie.`,
  packingPostcardAria: (shown, banked) => shown ? 'Pokaż tłumaczenie ponownie za darmo' : `Użyj pocztówki tłumaczenia. Dostępnych: ${banked}`,
  packingPostcardShowAnswer: 'Pokaż odpowiedź',
  usePostcard: 'Użyj pocztówki',
  wrapUpContinueAria: 'Kontynuuj trwającą rundę pakowania',
  hintWrapUpWaiting: 'Runda pakowania już trwa. Podejmij ją tam, gdzie się zatrzymała.',
  hintCollectFirst: (city) =>
    `Najpierw zbierz słowo w ${city} (zielone w obie strony), a runda pakowania będzie miała co pakować.`,
  hintFirstWrapUp: (wins) =>
    `Wygraj ${wins} ${plural(wins, 'rundę', 'rundy', 'rund')}, żeby zdobyć pierwszą rundę pakowania.`,
  hintMoreWins: (wins) =>
    `Jeszcze ${wins} ${plural(wins, 'wygrana', 'wygrane', 'wygranych')} do rundy pakowania.`,
  hintPacksRange: (collected, city) =>
    `${collected} ${plural(collected, 'zebrane', 'zebrane', 'zebranych')} w ${city}. Runda pakowania pakuje od 13 do 15, zależnie od klucza.`,
  hintPacksUpTo: (collected, city, cap) =>
    `${collected} ${plural(collected, 'zebrane', 'zebrane', 'zebranych')} w ${city}. Następna runda pakowania zapakuje do ${cap}, zależnie od klucza.`,

  // ── Stół pakowania, u góry rundy pakowania ──────────────────────────────
  packWord: (word) => `Zapakuj «${word}»`,
  // Krótko: tytuł stołu z licznikiem („Pakowanie — 3 z 12”) ma ok. 206 px
  // przy 360 i nie może się zawinąć. „Zapakuj planszę — 3 z 12” by nie weszło.
  packTheBoard: 'Pakowanie',
  packCount: (packed, packable) => `(${packed} z ${packable})`,
  // Narzędnik po „z”: 1 niezapakowaną kartą, 3 niezapakowanymi kartami.
  startEarlyWarning: (remaining) =>
    `Zacznij z ${remaining} ${plural(remaining, 'niezapakowaną kartą', 'niezapakowanymi kartami', 'niezapakowanymi kartami')}. Zostaną po angielsku i w tej rundzie nie da się ich zawinąć`,
  startEarly: (remaining) => `Zacznij z ${remaining}`,
  tapEnglishCard: 'Dotknij angielskiej karty',
  // Nazwa języka przychodzi w mianowniku („Danish”, kiedyś „duński”) i nie
  // wejdzie w polską odmianę — strzałka nie wymaga przypadka.
  theWordFor: (language, word) => `${word} → ${language}`,
  tapEnglishCardFirst: 'Najpierw dotknij angielskiej karty',
  pack: 'Zapakuj',
  packMiss: 'Nie to. Pudło zapamiętane. Próbuj dalej.',
  packFirstTime:
    'Wpisz duńskie słowo, żeby zapakować. Wczesny start zostawia karty angielskie i niezawinięte.',
  packRecall: 'Słownik zamknięty. Teraz liczy się pamięć.',
  packTapAndType: (language) => `Dotknij angielskiej karty i wpisz jej tłumaczenie (${language}).`,

  // ── Karta podróżna ──────────────────────────────────────────────────────
  passBackAria: 'Wróć do mapy',
  passTitle: 'Następne pociągi',
  passKicker: 'Pierwsze dwa miasta są za darmo.',
  passHeading: 'Karta podróżna na resztę Danii',
  passIntro:
    'Niestety, transport publiczny w Danii nie jest darmowy. Żeby wsiąść do następnych pociągów, potrzebujesz karty podróżnej.',
  passOptionsAria: 'Opcje karty podróżnej',
  passMonthly: 'Karta miesięczna',
  passMonthlyHelp: 'Jedź dalej, póki karta podróżna jest aktywna.',
  passLifetime: 'Karta dożywotnia',
  passLifetimeHelp: 'Jedna karta na każdą podróż, jaką kiedykolwiek wydamy.',
  passReady: 'Twoja karta podróżna jest gotowa. Następny pociąg otwarty.',
  passRestore: 'Przywróć zakupy',
  passRedeem: 'Wykorzystaj kod App Store',
  passKindness: 'Nauka nie powinna zależeć od pieniędzy.',
  // „… wyślij je na ⟨adres⟩ — dostaniesz …”: adres stoi między połówkami ze
  // spacjami, stąd myślnik na początku drugiej.
  passReviewBefore: 'Napisz recenzję w App Store, zrób jej zdjęcie i wyślij je na',
  passReviewAfter:
    'a dostaniesz kod na 6-miesięczną kartę podróżną. Recenzja może być dobra albo zła, zależnie od tego, jak ci się podoba aplikacja.',

  // ── Oferta po dziennym limicie ───────────────────────────────────────────
  dailyLimitKicker: 'Za darmo masz dwa spacery i dwie kawiarniane łamigłówki dziennie.',
  dailyLimitRunsKicker: 'Dzisiejsze dwa spacery masz już za sobą.',
  dailyLimitPuzzlesKicker: 'Dzisiejsze dwie kawiarniane łamigłówki masz już za sobą.',
  dailyLimitBothKicker: 'Dzisiejsze dwa spacery i dwie kawiarniane łamigłówki masz już za sobą.',
  dailyLimitPuzzlesLeft: (n: number) => (n === 1 ? 'Dziś możesz jeszcze rozwiązać 1 kawiarnianą łamigłówkę.' : n < 5 ? `Dziś możesz jeszcze rozwiązać ${n} kawiarniane łamigłówki.` : `Dziś możesz jeszcze rozwiązać ${n} kawiarnianych łamigłówek.`),
  dailyLimitRunsLeft: (n: number) => (n === 1 ? 'Dziś możesz jeszcze pójść na 1 spacer.' : n < 5 ? `Dziś możesz jeszcze pójść na ${n} spacery.` : `Dziś możesz jeszcze pójść na ${n} spacerów.`),
  dailyLimitHeading: 'Graj dalej z Casey',
  dailyLimitBody: 'Wróć jutro albo odblokuj nielimitowane spacery i kawiarniane łamigłówki.',
  dailyLimitOptionsAria: 'Opcje nielimitowanej gry',
  dailyLimitMonthly: 'Co miesiąc',
  dailyLimitMonthlyHelp: 'Subskrypcja odnawia się co miesiąc, dopóki jej nie anulujesz.',
  dailyLimitLifetime: 'Jednorazowo',
  dailyLimitLifetimeHelp: 'Nielimitowana gra bez subskrypcji.',
  dailyLimitUnavailable: 'Niedostępne',
  dailyLimitCloseAria: 'Zamknij okno oferty',
  dailyLimitRestore: 'Przywróć zakupy',
  dailyLimitDismiss: 'Może jutro',
  dailyLimitDisclosure: 'Apple podaje ceny i potwierdza zakupy. Zarządzaj subskrypcją lub anuluj ją na swoim koncie Apple.',
  dailyLimitDisclosurePlay: 'Google Play podaje ceny i potwierdza zakupy. Zarządzaj subskrypcją lub anuluj ją w aplikacji Sklep Play.',
  purchaseTerms: 'Warunki korzystania',
  purchasePrivacy: 'Polityka prywatności',
  passThanksHeading: 'Dziękujemy za wspieranie rozwoju 900words',
  passThanksBody: 'Nieograniczona gra jest odblokowana.',
  passThanksContinue: 'Graj dalej',

  // ── Opcjonalna stacja językowa ──────────────────────────────────────────
  stopKicker: 'Opcjonalna stacja językowa',
  stopKindGrammar: 'Ćwiczenie z gramatyki',
  stopKindSituation: 'Mała sytuacja',
  stopKindExit: 'Opcjonalne zadanie sprawdzające',
  stopKindReview: 'Zaległa powtórka',
  stopFocus: 'Twój następny cel językowy',
  stopNote:
    'Ta stacja jest zapisywana osobno od walizki. Nigdy nie zmienia, które słowa możesz pakować ani czy pociąg może odjechać.',
  stopAuthoring:
    'Duńskie polecenia i ocenianie powstają razem z treścią kursu. Odłóż to na później albo zostaw w przewodniku; żadna próba na zadaniu zastępczym nie liczy się jako dowód nauki.',
  stopContinue: 'Kontynuuj',
  stopLater: 'Później',
  stopSkip: 'Pomiń tę stację',
  // „Start” to po polsku też „Start” — brama 3 by go odrzuciła, a „Zacznij”
  // czyta się lepiej na przycisku.
  stopStart: 'Zacznij',
  stopOpen: 'Stacja językowa',

  // ── zamknięta linia ──────────────────────────────────────────────────────
  trainClosedLabel: (city) =>
    `Pociąg do ${city} jeszcze nie jeździ. Linia zamknięta z powodu prac`,
  trainClosedTitle: 'Linia zamknięta z powodu prac',
  trainClosedBody: (city, here) =>
    `Pociąg do ${city} jeszcze nie jeździ. Na linii trwają prace. ` +
    `Wkrótce ruszy znowu, a my damy ci znać tutaj, gdy tylko to nastąpi. ` +
    `Do tego czasu masz ${here} tylko dla siebie: każdą planszę, każdą rundę pakowania i swoją serię.`,
  trainReopenedTitle: (city) => `Pociąg do ${city} znów jeździ`,
  trainReopenedBody:
    'Linia jest otwarta. Walizka spakowana, Casey stoi na peronie. Wsiadaj, kiedy chcesz.',

  // Current Settings and German-preview integration.
  previewHeading: "Jeszcze nie ma gry słownej",
  previewNote: "Mapa i Przewodnik są dostępne. Plansze, wskazówki i nagrania nie są jeszcze gotowe.",
  previewGuideCta: "Otwórz Przewodnik",
  // ── café world Home (CW-10) ──────────────────────────────────────────────
  cafePuzzle: 'Kawiarniana łamigłówka',
  sightseeingNote: 'znajdź nowe kawiarnie',
  sightseeingAsk: 'Na co chcesz zwracać uwagę?',
  wordsWalkNote: 'Co to znaczy? Sfotografuj właściwe słowo i znajdź nowe kawiarnie.',
  articlesWalkNote: (ask, lanes) =>
    lanes === 2 ? `${ask} Wybierz drogę w lewo albo w prawo.` : `${ask} Każdy rodzajnik ma swój pas.`,
  trainSheetTitle: (city) => `Pociąg do ${city}`,
  trainSheetWords: (city, total, board, connecting) =>
    connecting > 0 ? `${city}: ${total} słów (${board} na planszach, ${connecting} łączących)` : `${city}: ${total} słów`,
  trainSheetCollected: (collected, total) => `Zebrane: ${collected} z ${total}`,
  trainSheetRule: 'Bieg to jedyny sposób, by wsiąść do pociągu.',
  cityStampAria: (city, percent) => `${city}: ${percent} pieczątek kawiarni.`,
  stampNone: 'Bez pieczątki',
  cafeNotFoundNote: 'najpierw znajdź kawiarnię',
  cafeNotFoundLine: 'Najpierw znajdź kawiarnię podczas zwiedzania.',
  // ── café world suitcase (CW-11): marks, the lid and the stamp card ───────
  lidLegend: 'Po jednej trzeciej za zdjęcie, próbę i wskazówkę',
  markPhoto: 'zdjęcie',
  markGuess: 'próba',
  markClue: 'wskazówka',
  markPhotoDays: (days) => (days === 1 ? 'zdjęcie w 1 dniu' : `zdjęcia w ${days} dniach`),
  markAria: (word, earned, total, marks) =>
    marks ? `${word}, ${earned} z ${total}: ${marks}` : `${word}, ${earned} z ${total}`,
  connectingWord: 'Słowo łączące',
  connectingWordRule: 'Nie ma karty. Zbierają je zdjęcia z trzech różnych dni.',
  stampCardTitle: (city) => `Karta pieczątek: ${city}`,
  stampCardLine: (percent, goal, stamped, cafes) =>
    [percent, goal, `${stamped} z ${cafes} kawiarni`].filter(Boolean).join(' · '),
  stampCardGoal: (tier, percent) => `${tier} od ${percent}`,
  stampFound: 'Znaleziona',
  stampNotFound: 'Nieznaleziona',
  stampCafeNumber: (place) => `Kawiarnia ${place}`,
  stampCellStamped: (cafe, stamp) => `${cafe}: ${stamp}`,
  stampCellFound: (cafe) => `${cafe}: znaleziona, jeszcze nierozegrana`,
  stampCellNotFound: (place) => `Kawiarnia ${place}: jeszcze nieznaleziona`,
  stampNextCafe: (cafe) => `Następna kawiarnia: ${cafe}`,
  stampNextCafeUnfound: 'Znajdź następną kawiarnię podczas zwiedzania.',
  stampAllPlayed: 'Wszystkie kawiarnie rozegrane. Dotknij jednej, by zagrać ponownie.',
}
