import type { Catalogue } from '../en'
import { plural } from './plural'

/**
 * Polski. Ty, nigdy Pan/Pani. Casey jest „ona” i mówi tu po raz pierwszy —
 * krótko, ciepło, wprost. Płeć gracza nie jest znana, więc żadne zdanie nie
 * zakłada „zebrałeś” ani „gotowa”: strona bierna, bezokolicznik albo „my”.
 * Glosariusz: runda to runda, ruch w grze to ruch (pociąg jedzie), pakuje
 * się w rundzie pakowania, ZAWINIĘTE jest słowo, które ją przetrwało.
 * Słowa w «» są duńskie i takie zostają.
 */
export const onboarding: Catalogue['onboarding'] = {
  courseText: (course) => {
    const german = course === 'de'
    return {
      languageName: german ? 'niemiecki' : 'duński',
      countryName: german ? 'Niemcy' : 'Danię',
      welcome: 'Czy wiesz, że w większości języków 900 słów może pokryć ponad 80% codziennej mowy? (Dotknij, aby kontynuować.)',
      map: (destination) => german
        ? `To nasza mapa. Przemierzymy Niemcy, zbierając po sto słów w każdym mieście. ${destination} to nasz cel.`
        : `To nasza mapa. Przemierzymy Danię, zbierając po sto słów w każdym mieście. ${destination} to nasz cel.`,
      guide: german
        ? 'Gramatykę i praktyczne wskazówki do niemieckiego znajdziesz w Przewodniku. Możesz czytać dalej, kiedy chcesz.'
        : 'Gramatykę i praktyczne wskazówki do duńskiego znajdziesz w Przewodniku. Możesz czytać dalej, kiedy chcesz.',
      clueField: german
        ? 'Gdy będzie twoja kolej, wpisz tu niemieckie słowo łączące dwa lub trzy twoje zielone słowa.'
        : 'Gdy będzie twoja kolej, wpisz tu duńskie słowo łączące dwa lub trzy twoje zielone słowa.',
      dictionary: german
        ? 'Jeśli potrzebujesz niemieckiego słowa, wyszukaj je tutaj. Słownik zamknie się po wysłaniu podpowiedzi.'
        : 'Jeśli potrzebujesz duńskiego słowa, wyszukaj je tutaj. Słownik zamknie się po wysłaniu podpowiedzi.',
      tutorialHint: 'Użyj Słownika, aby przetłumaczyć swój pomysł.',
      practiceIntro: (clue, number) =>
        `Moja podpowiedź to «${clue}» dla ${number}. Które słowa na tej planszy ci się z nią kojarzą? Dotknij ⓘ, gdy potrzebujesz tłumaczenia.`,
      practiceRationaleTime: 'Zegar pokazuje czas. Miesiąc i tydzień to jednostki czasu.',
      practiceRationaleTimeRecovery: 'Ta podpowiedź ponownie łączy czas z pozostałymi słowami związanymi z czasem.',
      lastGreen: german
        ? 'Zostało jeszcze jedno twoje zielone słowo. Nie widzę go, więc podaj niemiecką podpowiedź do ostatniej karty.'
        : 'Zostało jeszcze jedno twoje zielone słowo. Nie widzę go, więc podaj duńską podpowiedź do ostatniej karty.',
      yourTurn: german
        ? 'Moja tura się skończyła. Teraz twoja kolej. Podaj niemiecką podpowiedź łączącą 2 lub 3 zielone karty po twojej stronie. Nie widzę ich, tak jak ty nie widzisz mojego klucza.'
        : 'Moja tura się skończyła. Teraz twoja kolej. Podaj duńską podpowiedź łączącą 2 lub 3 zielone karty po twojej stronie. Nie widzę ich, tak jak ty nie widzisz mojego klucza.',
    }
  },
  languageEyebrow: 'Witaj na pokładzie',
  languageHeading: 'Jakim językiem mówisz?',
  languageHint: 'Dotknij swojego języka.',
  languageAria: (endonym) => `Używaj 900words w języku: ${endonym}`,

  // ── Bilet: jakiego języka chcesz się UCZYĆ ──────────────────────────────
  skip: 'Pomiń',
  ticketEyebrow: 'Wybierz podróż',
  ticketHeading: 'Jakiego języka chcesz się uczyć?',
  ticketAria: (country, language) => `Podróż: ${country}, nauka: ${language}`,
  // Nad nazwą kraju w mianowniku; „Ucz się w Dania” się nie odmieni.
  ticketLearnIn: 'Kraj nauki',
  ticketMeta: (words, cities) =>
    `${words} ${plural(words, 'słowo', 'słowa', 'słów')} · ${cities} ${plural(cities, 'miasto', 'miasta', 'miast')}`,
  ticketHintMany: 'Dotknij biletu, żeby wybrać.',
  ticketHintOne: 'Dotknij biletu i ruszamy.',

  // ── Casey przedstawia ekran startowy, krok po kroku ─────────────────────
  introWelcome:
    'Czy wiesz, że w większości języków 900 słów może pokryć ponad 80% codziennej mowy? (Dotknij, aby kontynuować.)',
  introMap:
    'To nasza mapa. Pojedziemy przez Danię, zbierając po sto słów w każdym mieście. Kopenhaga to nasz cel.',
  introGuide:
    'Jeśli kiedyś zechcesz gramatyki albo praktycznego duńskiego, otwórz Przewodnik. Możesz też zaglądać dalej, kiedy chcesz.',
  introPlay: 'To na razie wszystko, czego potrzebujesz. Dotknij Graj i zbierzmy pierwsze słowa.',
  introBubbleAria: (line) => `${line} Kontynuuj.`,
  introCaseyOpen: 'Otwórz Casey i zobacz zebrane słowa',
  introCaseyContinue: 'Dalej z Casey',
  introPlayFirst: 'Zagraj pierwszą grę',
  introTapCasey: 'Dotknij Casey',

  // ── Podpowiedzi ekranowe na prawdziwych ekranach ────────────────────────
  tourNext: 'Dalej',
  tourDone: 'Ruszamy',
  tourLoose:
    'Tu zostaje twoja kolekcja słów. Dotknij słowa, gdy chcesz je znów zobaczyć lub usłyszeć.',
  tourLid:
    'To kolekcja plansz Casey. Numer planszy i nazwana ranga pokazują jej najlepszą próbę.',
  tourTray:
    'Otwórz ukończoną planszę, aby zagrać ponownie. Powtórka może poprawić jej najlepszą rangę bez resetowania następnej obowiązkowej planszy.',
  // „trzeba co najmniej” rządzi dopełniaczem: 1 zebranego słowa, 3 zebranych słów.
  tourWrapUp:
    'Tu jest twoja następna obowiązkowa plansza. Kończ plansze, aby zdobywać rangi. Tłumaczenia i koło mogą podnieść rozwiązaną planszę do Platyny.',
  mapTourHere: (city, words) =>
    `To ${city}, tu jesteśmy. Każde miasto daje ${words} ${plural(words, 'słowo', 'słowa', 'słów')} do zabrania do domu.`,
  mapTourNext: (next, _words, city) =>
    `${next} leży dalej na trasie. Dalej poprawiaj plansze w ${city}. Następny przystanek jest na razie zamknięty.`,
  homeTourArrival: (city, words) =>
    `Jesteśmy w ${city}. Czas zebrać twoje pierwsze ${words} ${plural(words, 'słowo', 'słowa', 'słów')}.`,
  homeTourMap:
    'To nasza mapa. Pokazuje, gdzie teraz jesteśmy, i miasta czekające dalej na trasie.',
  homeTourSuitcase:
    'Dotknij mnie, kiedy chcesz otworzyć walizkę. Pokazuje, które słowa już napotkane, które zebrane, a które zapakowane na stałe.',
  homeTourGuide:
    'Przewodnik trzyma razem gramatykę, praktyczny duński i ćwiczenia z wcześniejszych miast. Możesz zaglądać dalej bez ruszania pociągu.',
  // ── Zwiedzanie z przewodnikiem w rundzie treningowej (2026-09-18) ────────
  introGameTourKey:
    'Zielone ramki to twoje tajne słowa. Ja nigdy ich nie widzę, tak jak ty nie widzisz moich. Każda próba jest mierzona kluczem tego, kto dał wskazówkę.',
  introGameTourClueField:
    'Kiedy twoja kolej, wpisz tu jedno duńskie słowo, które łączy dwa lub trzy twoje zielone słowa.',
  introGameTourDictionary:
    'Jeśli potrzebujesz duńskiego słowa, którego nie masz, wyszukaj je właśnie tutaj. Słownik zamyka się, gdy twoja wskazówka zostaje wysłana.',
  introGameTourStepper:
    'Ta liczba mówi, ile słów nazywa twoja wskazówka. Podnieś ją, gdy jedno powiązanie naprawdę obejmuje więcej twoich zielonych.',
  translationTourBoard:
    'Na tych wiekach walizek widać znaczenia słów, które udało nam się znaleźć. Wybierz w myślach jedno z nich. Nie musisz najpierw dotykać walizki.',
  translationTourInput: (language: string) =>
    `Wpisz tutaj tłumaczenie na ${language} i dotknij haczyka. Zła odpowiedź nic nie kosztuje, więc po prostu spróbuj jeszcze raz.`,
  translationTourWheel:
    'Każda dobra odpowiedź dodaje zielony segment. Możesz zakręcić w każdej chwili, ale pusty segment oznacza przegraną rundę. Gdy koło jest pełne, każdy obrót wygrywa.',
  wheelReadyTour:
    'Koło jest teraz całe zielone, więc ten obrót wygrywa. Stuknij koło, żeby zakręcić.',
  resultTourPostcards: (amount: string) =>
    `Ta plansza dodała ${amount} do twojego miasta. Każdy wynik pokazuje właśnie tutaj, co zdobył.`,
  resultTourRewardNew: (rewards: string) => `Nowe tym razem: ${rewards}.`,
  resultTourRewardHeld: (rewards: string) =>
    `Zdobyte już wcześniej, więc nie liczą się ponownie: ${rewards}.`,
  resultTourNoRewards: 'Tym razem ta plansza nie przyniosła pocztówek. Tak bywa i nic nie tracisz.',
  resultTourWinTier: (tier: string, best: string) =>
    `Ten wynik to ${tier}. Najlepszy wynik tej planszy do tej pory: ${best}.`,
  resultTourLossTier: (best: string) =>
    `Ta runda jest przegrana. Brąz oznacza tu tylko udział w grze i nie jest najlepszym wynikiem. Najlepszy wynik tej planszy do tej pory: ${best}.`,
  resultTourNoBestYet: 'jeszcze brak',
  resultTourSentence:
    'To opcjonalna powtórka. Pokazuje słowo z tej planszy w zdaniu. To nie jest kolejny test.',
  resultTourNoReview:
    'Tym razem nie ma zdania do powtórki. Nic nie szkodzi. Powtórka jest zawsze opcjonalna.',
  homeTourPostcards:
    'To łączna liczba twoich pocztówek w tym mieście. Każda pocztówka zdobyta przez planszę trafia tutaj.',
  homeTourCollection:
    'Dotknij mnie, aby otworzyć walizkę. Pokażę ci słowa, które razem zebraliśmy, i twoje plansze.',

  // ── Runda próbna: uzasadnienia Casey napisane z góry ────────────────────
  practiceRationaleDrink: 'Wodę, kawę i mleko: wszystko to się pije.',
  // Po polsku „house” i „home” to jedno słowo, więc tautologia „dom to dom”
  // nic nie tłumaczy — Casey mówi, co ją łączy.
  practiceRationaleHome: 'Dom to miejsce, w którym się mieszka.',
  practiceRationaleRecovery:
    'To powtarza konkretne powiązanie z piciem dla tych kart z napojami, które jeszcze zostały.',

  // ── Runda próbna: bieżący komentarz Casey ───────────────────────────────
  practiceIntro:
    'Moja wskazówka to «drikke» na 3. Które słowa na tej planszy się z nią łączą? Dotknij ⓘ, gdy tłumaczenie by pomogło.',
  guessGreenMore: (word) =>
    `«${word}» jest zielone na moim kluczu. Zgaduj dalej albo przestań, póki prowadzimy.`,
  guessGreenEnd: (word) => `«${word}» jest zielone na moim kluczu. To kończy moją wskazówkę.`,
  guessGreenEndMine: (word) =>
    `«${word}» jest zielone na moim kluczu. To kończy moją wskazówkę. Twoje zielone pokażą się w twojej kolejce. Ta wskazówka używała mojego klucza.`,
  guessYoursNotMine: (word) =>
    `«${word}» to jedno z twoich zielonych, ale na moim kluczu nie jest zielone. Ta wskazówka używa mojego klucza, więc karta nadal czeka na twoją.`,
  guessMiss: (word) => `«${word}» nie jest zielone na moim kluczu, więc to kończy moją wskazówkę.`,
  guessMissMine: (word) =>
    `«${word}» nie jest zielone na moim kluczu, więc to kończy moją wskazówkę. Twoje zielone pokażą się w twojej kolejce. Ta wskazówka używała mojego klucza.`,
  firstClue: (clue) =>
    `Hej, które słowa na tej planszy łączą ci się z «${clue}»? Dotknij ⓘ przy słowie, żeby zobaczyć tłumaczenie. Gdy zdecydujesz, dotknij słowa i potwierdź.`,
  clueFor: (clue, number) =>
    `Moja wskazówka to «${clue}» na ${number}. Dotknij słowa, które ci przez nią przychodzi do głowy.`,
  lastGreenLeft:
    'Zostało jeszcze jedno twoje zielone. Nie widzę go, więc daj mi jedną duńską wskazówkę do tej ostatniej karty.',
  yourTurn:
    'To koniec mojej kolejki. Teraz twoja. Daj mi duńską wskazówkę, która łączy 2 albo 3 zielone karty po twojej stronie. Nie widzę ich, tak jak ty nie widzisz mojego klucza.',
  yourFirstClue: (clue, number, tokens) =>
    `Twoja wskazówka to «${clue}» na ${number}. ${tokens} ${plural(tokens, 'kropka u góry to nasz wspólny żeton', 'kropki u góry to nasze wspólne żetony', 'kropek u góry to nasze wspólne żetony')} rundy. Każda wskazówka, twoja czy moja, zużywa jeden. Poniżej myślę na głos.`,
  yourClue: (clue, number) =>
    `Twoja wskazówka to «${clue}» na ${number}. Moje próby używają teraz twojego klucza. Poniżej myślę na głos.`,
  practiceWon: 'Wszystkie zielone znalezione. Wygrana! Pełne plansze nie będą tak łatwe, ale każde spotkane słowo nadal się liczy.',
  practiceLost: 'Ta runda nam uciekła, ale każde spotkane słowo nadal się liczy.',
  findingAClue: 'Moja kolej. Szukam wskazówki.',
  practiceTranslation:
    'Plansza rozwiązana! Teraz czas na tłumaczenia: każda duńska odpowiedź wypełnia segment koła. Możesz zakręcić już teraz, ale pełne koło gwarantuje zieleń. Rozwiązana plansza może tu jeszcze osiągnąć Platynę.',
  practiceWheelReady:
    'Koło jest pełne. Zakręć, by wylądować na zielonym. Na zwykłych planszach właśnie tak wynik może osiągnąć Platynę.',
  practiceFinish:
    'Trening ukończony. Ta runda nie daje pocztówek ani rangi miasta. Na zwykłych planszach rozwiązanie, tłumaczenie i zakręcenie dają rangę. Powtórz ukończoną planszę, aby poprawić najlepszy wynik.',
  demoEndTitle: "To była twoja pierwsza pełna plansza.",
  demoEndLine: "W aplikacji gram z tobą dalej, plansza po planszy, i zachowuję każde słowo, które zbierzesz.",
  demoAppStore: "Pobierz 900words z App Store",
  demoAppStoreSoon: "900words wkrótce w App Store.",
  demoPlayAgain: "Zagraj jeszcze raz",
  demoRestingTitle: "Casey odpoczywa",
  demoRestingBody: "Dziś grało ze mną dużo osób, więc muszę odpocząć. Wróć jutro albo zagraj ze mną w aplikacji.",
  demoCheckFailed: "Nie udało się sprawdzić, że jesteś człowiekiem. Odśwież stronę i spróbuj ponownie.",
  playFullRound: 'Zagraj na swojej pierwszej pełnej planszy',
  returnToParkedGame: 'Wróć do swojej gry',
}
