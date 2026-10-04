import type { Catalogue } from '../en'
import { plural } from './plural'

/**
 * Polski. Ty, nigdy Pan/Pani. Casey jest „ona”: obstawiła, myśli, odgadła.
 * Ruch w grze to „ruch”, czyja kolej — „kolej”; pociąg zostaje pociągiem.
 * „Wskazówka” to hasło w grze, „próba” to jeden strzał, „porada” to rada
 * Casey na ekranie startowym — trzy słowa, nigdy jedno za drugie.
 * Casey „obstawia” słowo: „zgadła” po polsku znaczy, że trafiła, a ona
 * często nie trafia — „Casey obstawiła «hund» — neutralna” się nie kłóci.
 * Karta jest rodzaju żeńskiego, więc wynik to „trafiona” / „neutralna”.
 *
 * Krótko: plansza, pole wskazówki i ekran końcowy muszą wejść w 360x640 bez
 * przewijania, a polski jest tu dłuższy od angielskiego.
 */
export const game: Catalogue['game'] = {
  legacyRetiredTitle: "Twoje postępy są bezpieczne",
  legacyRetiredBody: "Starsza runda nie mogła być kontynuowana po tej aktualizacji. Zapisane postępy w nauce i pocztówki zostały zachowane. Kontynuuj od następnej nieukończonej planszy.",
  phaseGiveClue: 'Daj Casey wskazówkę',
  phaseCaseyGuessing: 'Casey zgaduje',
  phaseCaseyClue: 'Casey szykuje wskazówkę',
  phaseYourGuess: 'Teraz zgadujesz',
  phaseLastChance: 'Ostatnia szansa: brak wskazówek',
  phaseRoundOver: 'Koniec rundy',
  phasePackTheBoard: 'Pakowanie',

  announceCaseyGuess: (word, result) => `Casey obstawiła ${word}: ${result}.`,
  resultCorrect: 'trafiona',
  resultNeutral: 'neutralna',
  announceCaseyThinking: 'Casey myśli.',

  skip: 'Pomiń',
  homeAria: 'Start',
  dealNewWordsAria: 'Rozdaj nowe słowa',
  hideTranslationsAria: 'Ukryj tłumaczenia',
  showTranslationsAria:
    'Pokaż wszystkie tłumaczenia. Liczy się jako sprawdzenie każdego nierozwiązanego słowa',

  errorRetry: 'Spróbuj ponownie',
  errorCaseySettings: 'Ustawienia Casey',
  practiceNote: 'Eksperymentalny prototyp bez agenta. To nie Casey ani zwykła gra.',

  studyTitle: 'Poznaj planszę',
  studyHint: 'Wszystkie tłumaczenia są widoczne. Znikną, gdy zaczniesz, a dotknięcie sprawdza jedno.',
  studyStart: 'Zacznij rundę',

  cardYourTarget: ', twój cel',
  cardFound: ', znalezione',
  cardMissedKey: ', jedno ze słów Casey, nieznalezione',
  cardNeutralBoth: ', neutralne dla obu stron',
  cardNeutralPlayer: ', neutralne pod twoimi wskazówkami',
  cardNeutralCasey: ', neutralne pod wskazówkami Casey',
  cardUnpacked: ', niezapakowane',
  cardTranslationRevealed: ', pokazano tłumaczenie',
  cardNotYetPacked: (language) => `, jeszcze niezapakowane. Dotknij, by wpisać tłumaczenie (${language})`,
  cardNotYoursToWrap: ', jeszcze nie twoje do zawinięcia',
  cardTapToHear: '. Dotknij, by posłuchać',
  lookUpAria: (word) => `Sprawdź ${word}`,

  cluePlaceholder: 'Twoja wskazówka',
  clueFieldAria: (language) => `Twoja jednowyrazowa wskazówka (${language})`,
  fewerWordsAria: 'mniej słów',
  moreWordsAria: 'więcej słów',
  wordCountAria: (n) => `${n} ${plural(n, 'słowo', 'słowa', 'słów')}`,
  giveClue: 'Daj wskazówkę',
  giveItAnyway: 'Daj mimo to',
  askingCasey: 'Pytam Casey…',
  firstClueHint: (language) => `Jedno słowo (${language}). Brak pomysłu? Słownik obok tłumaczy.`,
  tutorialClueHint: 'Czytam hasła po duńsku. Nie masz pewności? Spróbuj. Słownik może pomóc.',
  wrapPlayerKeyHint: 'Twoja zielona ramka wróciła. To twój prywatny klucz. Casey go nie widzi.',
  looksEnglishFull: (word, language) =>
    `«${word}» wygląda jak znaczenie słowa z karty. Dotknij, by zobaczyć tłumaczenie (${language}), albo daj mimo to, a Casey sprawdzi.`,
  looksEnglishShort: 'wygląda jak znaczenie słowa z karty. Dotknij albo daj mimo to',

  caseysClueLabel: 'Wskazówka Casey',
  lookUpInDictionaryAria: (word) => `Sprawdź «${word}» w słowniku`,
  guessesLeft: (n) => `jeszcze ${n} ${plural(n, 'próba', 'próby', 'prób')}`,
  guessWord: (word) => `Obstaw «${word}»`,
  cancel: 'Anuluj',
  stopKeepWhatWeHave: 'Przestań i zachowaj, co mamy',
  guessPrompt: 'Dotknij słowa, które według ciebie ma na myśli Casey.',
  firstGuessHint: 'Teraz liczy się klucz Casey. Dotknij słowa, na które wskazuje jej wskazówka.',
  wrapCaseyKeyHint:
    'Klucz Casey jest tajny. Zgaduj, na co wskazuje jej wskazówka. Teraz liczą się jej zielone.',
  tutorialLookupHint: 'Dotknij ⓘ przy słowie, żeby wygodnie sprawdzić jego tłumaczenie.',

  suddenDeathRule: 'Wskazuj zielone, by wygrać. Cokolwiek innego kończy grę.',
  nameWord: (word) => `Wskaż «${word}»`,
  giveUpRound: 'Poddaj rundę',

  // ── koło tłumaczeń (ostatnia szansa, nowa 2026-09-16) ─────────────────────
  wheelLede: (language) => `Koło decyduje o rundzie. Przetłumacz słowa z powrotem na ${language}, aby je wypełnić, a potem zakręć. Zielone wygrywa.`,
  /** The input's placeholder and its accessible name. */
  wheelAnswerPlaceholder: (language) => `Tłumaczenie (${language})`,
  wheelAnswerAria: (language, glosses) =>
    `Tłumaczenie (${language}) dowolnego z tych słów: ${glosses.join(', ')}`,
  wheelCardStatus: (translated) =>
    translated ? ', tłumaczenie podane' : ', tłumaczenie do podania',
  wheelRetryLine: 'Nie to. Spróbuj jeszcze raz. Nic nie tracisz.',
  wheelSubmit: 'Spakuj',
  wheelSpinAria: 'Zakręć kołem',
  wheelSpinning: 'Kręci się …',
  wheelWonLine: 'Zielone! Runda wygrana.',
  wheelMissLine: 'Nie zielone. Runda przegrana.',
  wheelLedeMissed: (found, total, language) =>
    `Znaleziono ${found} z ${total}. Dla słów, które zostały na planszy, koło zostaje szare. Wpisz resztę na ${language}, a potem zakręć.`,
  wheelAnswersLine: 'Szare słowa to brakujące odpowiedzi.',
  wheelSeeResults: 'Zobacz wyniki',
  phaseTranslateChallenge: 'Czas na tłumaczenie',
  settlementFailed: 'Nie udało się jeszcze zapisać wyniku. Zachowaj tę rundę i spróbuj ponownie.',
  settlementSaving: 'Zapisywanie wyniku…',
  guidanceTranslationBody: (language) => `Walizki pokazują teraz znaczenia znalezionych słów. Przetłumacz każde z nich z powrotem na ${language}, aby wypełnić koło, a potem nim zakręć. Zielone pole oznacza wygraną rundę.`,
  guidanceStartTranslation: 'Zacznij tłumaczyć',
  phaseTranslateWheel: 'Koło: zakręcenie decyduje o rundzie',

  // ── panel powitania ostatniej szansy ──────────────────────────────────────
  /** Zdanie okienka, gdy kończą się wskazówki, a wyzwanie koła się zaczyna (właściciel, 2026-09-17) — głosem wheelLede. */
  guidanceLastChanceWheel:
    'Skończyły ci się wskazówki, więc to jest zakończenie. Przetłumacz zebrane słowa, aby wypełnić koło, a potem zakręć. Zielone wygrywa rundę.',

  caseyIsThinking: 'Casey myśli…',
  offlineCaseyIsThinking: 'Casey offline myśli. To potrwa dłużej.',
  offlineRoundPrompt: 'Brak internetu. Dokończyć tę rundę z Casey offline? Jest wolniejsza.',
  playOfflineButton: 'Graj offline',
  onlineAgainTitle: 'Internet wrócił',
  onlineAgainBody:
    'Dokończyć tę rundę ze zwykłą Casey? Jest szybsza i gra lepiej. Jeśli połączenie ciągle się zrywa, pozostanie offline może być stabilniejsze.',
  playOnlineButton: 'Graj online',
  stayOfflineButton: 'Zostań offline',
  hurryCaseyTitle: 'Dotknij, by pogonić Casey',
  hurryCaseyHint: 'Dotknij tutaj, by pogonić Casey.',
  caseyGuessedWord: (word) => `Casey obstawiła «${word}».`,
  caseyChoosingWord: 'Casey wybiera słowo…',
  caseyChoosingWhether: 'Casey zastanawia się, czy zgadywać…',
  guessGotOne: '. Trafiona!',
  guessNeutral: '. Neutralna.',

  turnTokensAria: (given, total, left) =>
    `Dano ${given} z ${total} wskazówek, ${left} ${plural(left, 'została', 'zostały', 'zostało')}.`,
  cluesGivenCount: (given, total) => `${given}/${total} wskazówek`,

  leaveTitle: 'Wyjść z tej rundy?',
  leaveBody:
    'Wstrzymanie zostawia planszę dokładnie tak, jak jest. Anulowanie ją odrzuca, więc Graj zacznie nową rundę.',
  leaveKeepPlaying: 'Graj dalej',
  leavePause: 'Wstrzymaj grę',
  leaveCancelRound: 'Anuluj rundę',

  guidanceCaseyTitle: 'Pierwsza wskazówka Casey',
  guidancePlayerTitle: 'Twoja kolej!',
  guidanceWordCount: (n) => `${n} ${plural(n, 'słowo', 'słowa', 'słów')}`,
  guidanceCaseyBody: 'Znajdź słowa, które łączą się ze wskazówką Casey.',
  guidancePlayerBody:
    'Napisz jedno duńskie słowo, które łączy 1–4 twoich zielonych słów. Skorzystaj ze słownika, jeśli nie znasz tego słowa po duńsku.',
  guidanceHideReminder: 'Nie przypominaj więcej',
  guidanceStartGuessing: 'Zacznij zgadywać',
  guidanceWriteClue: 'Napisz wskazówkę',
  guidanceLastChanceTitle: 'Ostatnia szansa',
  guidanceLastChanceBody:
    'Skończyły ci się wskazówki. Ale wciąż możesz wygrać. Zgaduj dalej na podstawie wcześniejszych wskazówek. Ale jedna zła próba i przegrywasz.',
  guidanceKeepNaming: 'Wskazuj dalej',
  guidancePackingTitle: 'Najpierw zapakuj planszę',
  guidancePackingBody:
    'Wpisz duńskie słowo do każdej karty, jedna po drugiej. Gdy wszystkie będą wpisane, albo dalej się nie da, zacznij rundę.',
  guidanceStartPacking: 'Zacznij pakować',

  dictionaryPlaceholder: 'Słownik',
  dictionaryFieldAria: (language) => `Słowo do przetłumaczenia, ${language} albo twój język`,
  dictHitAria: (entry) => `${entry}: otwórz słownik`,
  approximateFrom: (term) => ` (od ${term})`,
  onTheBoardNote: ' (na planszy)',
  translateFailed: 'Nie udało się tego przetłumaczyć.',
  lookupsUsed: 'Wyszukiwania się skończyły.',
  dictionaryPracticeOnly: 'W treningu tylko 900 słów.',
  sayAgainAria: (word) => `Powiedz ${word} jeszcze raz`,
  saySlowlyAria: (word) => `Powiedz ${word} powoli`,
  sayExampleAria: 'Powiedz zdanie przykładowe jeszcze raz',
  sayExampleSlowlyAria: 'Powiedz zdanie przykładowe powoli',
  recordingsUnavailableNote: ' · nagrania zwykłe i powolne niedostępne',
  recordingFailedNote: ' · nagranie się nie wczytało',
  close: 'Zamknij',

  caseysCalls: 'Decyzje Casey',
  turnCount: (n) => `${n} ${plural(n, 'ruch', 'ruchy', 'ruchów')}`,
  logHint: 'Dotknij ⚑ przy czymkolwiek Casey, co było złą decyzją. Widzi to, co oznaczysz.',
  logYou: 'Ty',
  // „Casey: «hund» (2) do kat, mus” — słowo między wskazówką a jej celami.
  logFor: 'do',
  flagClueLabel: (clue) => `Wskazówka Casey «${clue}»`,
  flagGuessLabel: (word) => `Próba Casey «${word}»`,
  // Obie etykiety są żeńskie (wskazówka, próba), stąd „oznaczona”.
  flagOnAria: (label) => `${label}, oznaczona jako zła decyzja. Dotknij, by cofnąć`,
  // Etykieta przychodzi w mianowniku; dwukropek oszczędza biernika.
  flagOffAria: (label) => `Oznacz jako złą decyzję: ${label}`,
  guessCorrectSr: ', trafiona',
  guessNeutralSr: ', neutralna',
  confidenceSure: (percent) => `${percent}% pewności`,
  noGuessMade: 'brak próby',

  ledgerEmpty:
    'Jeszcze nic. Linia pojawia się tu dla każdej wskazówki Casey, gdy skończysz pod nią zgadywać.',
  ledgerArmHeading: 'źródło',
  ledgerCluesHeading: 'wskazówki',
  ledgerFoundHeading: 'znalezione',
  ledgerRefusedHeading: 'odrzucone',
  ledgerHitsTitle: (hits, asked) =>
    `${hits} z ${asked} ${plural(asked, 'szukanego słowa', 'szukanych słów', 'szukanych słów')}`,
  ledgerRefusedTitle: 'Jak często pierwsza odpowiedź tego źródła była odrzucana i pytana ponownie',
  ledgerExplainer:
    '„znalezione” to udział słów, o które prosiła wskazówka, a które faktycznie zostały odkryte. „odrzucone” to jak często pierwsza odpowiedź modelu była odrzucana i pytana ponownie. Źródeł offline nie da się odrzucić.',
  ledgerClear: 'Wyczyść rejestr',

  outcomeWonTitle: 'Gratulacje!',
  outcomeWonSub: 'Wygrałeś pocztówkę!',
  outcomeLostTitle: 'Następnym razem',
  outcomeGivenUpSub: 'Runda poddana. Powiązanie tam było.',
  outcomeWheelMissSub: 'Koło zatrzymało się na walizce, której nigdy nie spakowałeś.',
  /** Zwycięski koniec koła (właściciel, 18.09.2026): koło zatrzymało się na zielonym. */
  outcomeWheelWinSub: 'Koło zatrzymało się na zielonym. Runda jest twoja.',
  outcomeWheelSpentSub: 'Żeton był wykorzystany, a wskazówki mimo to się skończyły.',

  resultLesson: 'Nowa opcjonalna lekcja jest gotowa w Przewodniku.', resultOpenGrammar: 'Otwórz gramatykę w Przewodniku', resultOpenSurvival: 'Otwórz survival w Przewodniku', resultBackToResult: 'Wróć do wyniku',

  roundStatsAria: 'Co dała ta runda',
  newWordsLabel: (n) => plural(n, 'nowe słowo', 'nowe słowa', 'nowych słów'),
  collectedForCasey: 'zebrane dla Casey',
  wrapStatsAria: 'Co zapakowała ta runda pakowania',
  // Liczba stoi przed tym tekstem, a funkcja dostaje tylko `named` —
  // „na stałe w walizce” nie wymaga zgody z liczebnikiem, „zawiniętych” by
  // wymagało („3 zawinięte”, „7 zawiniętych”).
  wrappedForGood: (named) => (named ? 'na stałe w walizce:' : 'na stałe w walizce'),
  // Tak samo: „3 bez zmian” zamiast „3 zostały” / „5 zostało”.
  stayedLabel: 'bez zmian',

  // ── gdzie runda zostawiła podróż: obszar czytany po rundzie pakowania ────
  // Liczba stoi w osobnym spanie przed tekstem: „13 zawiniętych w Ribe · 87
  // brakuje na pociąg do Kolding”.
  wrapJourneyHeading: 'Podróż',
  wrapJourneyAria: 'Podróż po tej rundzie pakowania',
  wrappedInCity: (n, city) => `${plural(n, 'zawinięte', 'zawinięte', 'zawiniętych')} w ${city}`,
  wrapJourneyTrainReady: (city) => `pociąg do ${city} jest gotowy`,
  wrapJourneyOver: 'podróż dobiegła końca',
  // „brakuje” rządzi dopełniaczem samej liczby, więc forma nie zależy od n.
  wrapJourneyToGo: (_n, city) => `brakuje na pociąg${city ? ` do ${city}` : ''}`,

  wrapUpUnlocked:
    'Runda pakowania odblokowana. Pakuje zebrane słowa do walizki na stałe. Otwórz walizkę, żeby ją wydać.',
  wrapUpEarned: (banked) => `Runda pakowania zdobyta. W zapasie: ${banked}. Wydaj jedną w walizce.`,
  postcardEarned: (banked) => `+1 pocztówka tłumaczenia · w zapasie: ${banked}`,
  wrapUpBankFull: (cap) =>
    `Zapas pełny. Walizka mieści tylko ${cap} ${plural(cap, 'rundę pakowania', 'rundy pakowania', 'rund pakowania')}. Wydaj jedną, a wygrane znów zaczną się liczyć.`,
  winsToWrapUp: (n) =>
    `Jeszcze ${n} ${plural(n, 'wygrana', 'wygrane', 'wygranych')} do rundy pakowania`,
  wrapResultFirst:
    'Zapakowane zielone karty zawijają się na stałe, czy ta runda wygrana, czy przegrana.',
  wrapResultNothing:
    'Nic nie zawinięto. Słowo zostaje zapakowane, gdy było przetłumaczone I odkryte jako zielone, wygrana czy przegrana.',
  wrapResultLost:
    'Przegrana nic cię tu nie kosztowała. Runda pakowania zachowuje to, co zapakowane i odkryte jako zielone, wygrana czy przegrana.',

  playAgain: 'Zagraj jeszcze raz',
  playNextGame: 'Następna gra',
  home: 'Start',
  postWrapChoicesAria: 'Wybory po rundzie pakowania',
  postWrapHeading: 'Co dalej?',
  postWrapGrammar: 'Gramatyka',
  postWrapSurvival: 'Rozmówki',
  postWrapBoth: 'Jedno i drugie',
  postWrapBothNote: 'Najpierw gramatyka, potem prosto do dialogu.',
  grammarNote: (city, topic, lessons) =>
    `Gramatyka, ${city}${topic ? `: ${topic}` : ''}${lessons > 1 ? `, ${lessons} ${plural(lessons, 'lekcja', 'lekcje', 'lekcji')}.` : '.'}`,
  // „Dialog” to dialog z glosariusza; rozmowa w jego środku nazywa się inaczej.
  survivalNextNote: (number, total, title) =>
    `Dialog ${number} z ${total}: ${title}. Najpierw zwroty, potem rozmowa.`,
  survivalAllReadTitle: 'Wszystkie cztery dialogi już przeczytane.',
  survivalLockedTitle: 'Ukończ rundę pakowania, by odblokować następny dialog.',
  survivalLockedNote: 'Następny dialog odblokuje się, gdy skończy się runda pakowania.',

  sentenceReviewAria: 'Przegląd zdań',
  hearItInDanish: 'Posłuchaj po duńsku',
  legendGreenLabel: 'Zielone',
  legendGreenMeaning: ': znalezione słowo.',
  legendUnderlinedLabel: 'Podkreślone',
  legendUnderlinedMeaning: (city) => `: małe słowa z ${city}.`,
  legendTapToHear: 'Dotknij, by posłuchać.',

  reviewTitle: 'Przegląd planszy',
  reviewProgress: (current, total) => `${current} z ${total}`,
  reviewOptional: 'Opcjonalnie · jedno zdanie na wskazówkę',
  reviewListen: 'Posłuchaj',
  reviewListenSlowlyAria: 'Posłuchaj powoli',
  reviewNoRecordings: 'Nagrania zwykłe i powolne niedostępne.',
  reviewRecordingUnavailable: 'Nagranie niedostępne.',
  reviewSoundOff: 'Dźwięk jest wyłączony albo odtwarzanie zatrzymane.',
  reviewShowTranslation: 'Pokaż tłumaczenie',
  reviewHideTranslation: 'Ukryj tłumaczenie',
  reviewAboutWord: 'O tym słowie',
  reviewNoNotes: 'Brak notatek o słowie.',
  reviewNextSentence: 'Następne zdanie',
  reviewNothingThisRound:
    'W tej rundzie nie ma nic do przeglądu. Zdanie pojawia się dla każdej twojej wskazówki, którą Casey odgadła.',
  sentenceBandNoGreens: 'W tej rundzie brak zielonych słów do zdania.',

  // ── dlaczego wskazówka została odrzucona ─────────────────────────────────
  clueNotSingleWord: 'wskazówka musi być jednym słowem',
  clueOnBoard: (clue) => `„${clue}” jest słowem na planszy`,
  clueTypoOf: (clue, word) => `„${clue}” może być literówką od „${word}”`,
  clueGlossOnBoard: (clue, word) => `„${clue}” to tłumaczenie „${word}” z planszy`,
  clueCompoundOfWord: (clue, word) => `„${clue}” to złożenie z „${word}”`,
  clueCompoundOfGloss: (clue, gloss, word) =>
    `„${clue}” to złożenie z „${gloss}”, tłumaczenia „${word}”`,
  clueFormOfWord: (clue, word) => `„${clue}” to forma „${word}”`,
  clueFormOfGloss: (clue, gloss, word) => `„${clue}” to forma „${gloss}”, tłumaczenia „${word}”`,

  // ── podpowiedzi rundy próbnej i zamknięty słownik (gameStore) ────────────
  practiceClueFinal: 'W tej ostatniej wskazówce próbnej połącz jedyne pozostałe zielone słowo.',
  practiceClueMany: 'W tej wskazówce próbnej połącz 2 albo 3 zielone słowa.',
  dictionaryClosed: 'Słownik jest zamknięty, aż to się skończy.',
}
