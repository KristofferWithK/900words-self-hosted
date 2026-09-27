import type { Catalogue } from '../en'
import { plural } from './plural'

/**
 * Polski. Ty, nigdy Pan/Pani. Ustawienia tłumaczą, nie grają - Casey sama
 * odzywa się tylko w pytaniu o przypomnienie i w powiadomieniach na końcu.
 * Casey to walizka, więc jest „ona”: spakowana, zajęła, odpowiedziała.
 * Imię „Casey” się nie odmienia (żeńskie imię obce zakończone na -y).
 */
export const settings: Catalogue['settings'] = {
  // ── ekran ────────────────────────────────────────────────────────────────
  title: 'Ustawienia',
  backAria: 'Wstecz',

  // ── język, w którym mówi aplikacja ───────────────────────────────────────
  uiLanguageLabel: 'Twój język',
  uiLanguageHelp:
    'Język, w którym aplikacja do ciebie mówi. Po zmianie aplikacja uruchomi się ponownie; kolekcja i podróż zostają.',

  // ── język, którego się uczysz ────────────────────────────────────────────
  learnerLanguageLabel: 'Język nauki',
  learnerLanguageHelp:
    'Każdy język ma własną podróż. Wróć do niego, aby kontynuować od miejsca, w którym skończono.',

  // ── mózg Casey ───────────────────────────────────────────────────────────
  caseyBrainHeading: 'Mózg Casey',
  caseyServerNote:
    'Casey gra przez własny serwer 900words. Nie trzeba nic ustawiać; przycisk poniżej sprawdza, czy odpowiada.',
  normalOllamaCaseyLabel: 'Zwykła Casey Ollama',
  normalOllamaCaseyDetail: 'gpt-oss 120B · wskazówki i próby',
  normalOllamaCaseyAria: 'Użyj zwykłej Casey Ollama',
  normalCaseyOn: 'Zwykła Casey włączona',
  normalCaseyOff: 'Zwykła Casey wyłączona',
  prototypeOn: 'Prototyp bez agenta włączony',
  customCaseyOn: 'Własna usługa Casey włączona',
  normalCaseyDetail: 'Ollama gra i tłumaczy. Gemma jest wyłączona.',
  gemmaModeDetail:
    'Gemma 4 E4B daje wskazówki i zgaduje. Gdy słownik nie zna słowa, aplikacja nadal pyta Ollamę.',
  prototypeDetail: 'Ten lokalny tryb testowy to nie Casey, Ollama ani Gemma.',
  customCaseyDetail:
    'Wybrany jest własny Worker Casey. Gdy słownik nie zna słowa, aplikacja pyta online tę usługę.',


  baseUrlLabel: 'Adres bazowy',
  // Ścieżka /v1 stoi jako <code> między obiema połówkami, bez własnych
  // odstępów - dlatego same niosą spacje.
  baseUrlHelpBefore:
    'Ustawia go przycisk powyżej - albo wpisz adres własnego Workera Casey z końcówką ',
  baseUrlHelpAfter:
    '. Musi zaczynać się od https://, żeby nic z twojej gry nie szło przez sieć nieszyfrowane.',
  baseUrlUnusable: 'Tego adresu bazowego nie da się użyć.',

  // ── model na urządzeniu ──────────────────────────────────────────────────
  gemmaUnavailableNote: 'Tryb offline działa w aplikacji 900words na iPhone’a.',
  gemmaReady: (size) => `Casey offline jest gotowa (${size} na tym iPhonie).`,
  gemmaRemoveConfirm: 'Usunąć Casey offline z tego iPhone’a? Możesz ją później pobrać ponownie.',
  gemmaRemoveButton: 'Usuń Casey offline',
  gemmaProgressAria: 'Postęp pobierania Casey offline',
  gemmaDownloading: (percent) => `${percent}% - trzymaj 900words otwarte na Wi-Fi.`,
  gemmaCancelDownloadButton: 'Anuluj pobieranie',
  gemmaDownloadNote: (size) =>
    `Casey offline to pobranie ${size}. Użyj Wi-Fi i nie zamykaj 900words, dopóki się nie skończy.`,
  gemmaDownloadButton: 'Pobierz Casey offline',
  gemmaDownloadFailed: 'Pobieranie nie powiodło się.',

  // ── offline mode ─────────────────────────────────────────────────────────
  offlineModeHeading: 'Tryb offline',
  offlineModeExperimentalTag: 'Eksperymentalny',
  offlineModeLabel: 'Graj bez internetu',
  offlineModeHelp:
    'Zwykła Casey gra przez serwer 900words. W trybie offline możesz dokończyć rundę z Casey offline na tym iPhonie, gdy nie ma internetu. Jest wolniejsza.',
  offlineModeAria: 'Tryb offline',
  offlineModeExplain: (size, iphones, lowMemory) =>
    `Tryb offline jest eksperymentalny i wciąż jest ulepszany.\n\nTryb offline pobiera Casey offline (${size}) na ten iPhone. Użyj Wi-Fi i nie zamykaj 900words, dopóki pobieranie się nie skończy.\n\nCasey offline gra wolniej niż zwykła Casey.\n\nPotrzebuje nowszego iPhone’a: ${iphones}.${lowMemory ? '\n\nTen iPhone ma mniej pamięci niż te modele. Może na nim nie działać.' : ''}\n\nPobrać teraz?`,

  // ── Casey’s AI in a self-built (open-source) 900words ─────────────────────
  ossCaseyHeading: 'SI Casey',
  ossCaseyHelp: 'To wersja 900words zbudowana samodzielnie. Casey potrzebuje SI do gry: twojego własnego klucza SI albo Gemmy na tym iPhonie.',
  ownKeyOption: 'Twój własny klucz SI',
  ownKeyHelp: 'Dowolna usługa zgodna z OpenAI. Twój klucz jest zapisany tylko na tym urządzeniu i wysyłany tylko pod adres poniżej.',
  ownKeyAddressLabel: 'Adres usługi',
  ownKeyModelLabel: 'Model',
  ownKeyKeyLabel: 'Klucz API',
  ownKeyAnswered: 'Twoja usługa SI odpowiedziała.',
  gemmaOption: 'Gemma na tym iPhonie',
  gemmaOptionHelp: 'Casey gra na tym iPhonie, bez internetu i bez klucza. Jest wolniejsza.',
  serverOption: 'Twój własny serwer Casey',
  serverOptionHelp: 'Worker Casey wdrożony przez ciebie (zobacz README).',
  // Gemma in the browser, in the desktop self-build (src/ai/gemma/web.ts).
  pcCaseyHelp: 'To wersja 900words zbudowana samodzielnie. Casey potrzebuje SI do gry: twojego własnego klucza SI albo Gemmy na tym komputerze.',
  pcGemmaOption: 'Gemma na tym komputerze',
  pcGemmaOptionHelp: 'Casey gra na tym komputerze, bez internetu i bez klucza. Jest wolniejsza.',
  pcGemmaNeeds: 'Gemma potrzebuje Chrome’a lub Edge’a z WebGPU, na komputerze z kartą graficzną.',
  pcGemmaExplain: (size) =>
    `Casey może grać z Gemmą na tym komputerze: bez internetu i bez klucza. Gemma to jednorazowe pobranie (${size}), zostaje w tej przeglądarce i działa na twojej karcie graficznej w Chrome lub Edge. Jest wolniejsza niż usługa SI i wciąż eksperymentalna.\n\nNie zamykaj tej karty, dopóki pobieranie się nie skończy.\n\nPobrać Gemmę teraz?`,
  pcGemmaReady: (size) =>
    `Gemma jest gotowa (${size} w tej przeglądarce).`,
  pcGemmaRemoveConfirm: 'Usunąć Gemmę z tej przeglądarki? Możesz ją później pobrać ponownie.',
  pcGemmaDownloading: (percent) =>
    `${percent}% - nie zamykaj tej karty.`,
  pcGemmaDownloadNote: (size) =>
    `Gemma to pobranie o rozmiarze ${size}. Nie zamykaj tej karty, dopóki się nie skończy.`,
  pcGemmaAnswered: 'Gemma odpowiedziała na tym komputerze.',
  ossOfflineLabel: 'Graj offline, gdy nie ma internetu',
  ossOfflineHelp: 'Casey zaproponuje wtedy dokończenie rundy z Gemmą. Za pierwszym razem zostanie ona pobrana.',
  ossGemmaFirstRun: (size, iphones, lowMemory) =>
    `Ta wersja 900words gra z Casey na twoim iPhonie: bez konta i bez klucza. Casey pobierasz raz (${size}). Użyj Wi-Fi i nie zamykaj 900words, dopóki pobieranie się nie skończy.\n\nPotrzebuje nowszego iPhone’a: ${iphones}.${lowMemory ? '\n\nTen iPhone ma mniej pamięci niż te modele. Może na nim nie działać.' : ''}\n\nW Ustawieniach możesz też dodać własny klucz SI.\n\nPobrać Casey teraz?`,

  // ── sprawdzenie połączenia ───────────────────────────────────────────────
  testRunning: 'Testowanie…',
  testGemmaButton: 'Testuj Casey na urządzeniu',
  testConnectionButton: 'Sprawdź połączenie',
  connectionFailed: 'Połączenie nie powiodło się.',
  gemmaAnswered: 'Gemma odpowiedziała na tym iPhonie.',
  normalCaseyAnswered: 'Zwykła Casey Ollama odpowiedziała.',
  customCaseyAnswered: 'Własna usługa Casey odpowiedziała.',


  // ── gra ──────────────────────────────────────────────────────────────────
  gameHeading: 'Gra',
  soundLabel: 'Czytaj słowa na głos po dotknięciu',
  soundHelp:
    'Nic nie gra samo - każdy dźwięk to odpowiedź na dotknięcie, także przy próbach Casey.',
  lookupExampleLabel: 'Odtwarzaj zdanie przykładowe przy sprawdzaniu tłumaczenia',
  lookupExampleHelp: 'Gdy jest wyłączone, sprawdzanie używa ustawienia dźwięku słów.',
  replayIntroButton: 'Powtórz wstęp',
  replayIntroHelp: 'Jeszcze raz przedstawienie Casey. Postępy zostają bez zmian.',

  // ── narzędzia podróżne do testów ─────────────────────────────────────────
  playtestHeading: 'Testy TestFlight',
  playtestTravelLabel: 'Skakanie po miastach i każdy pociąg',




  // ── przełącznik codziennego przypomnienia ────────────────────────────────
  reminderHeading: 'Codzienne przypomnienie',
  reminderWebNote:
    'Codzienne przypomnienia są dostępne w aplikacji 900words na iPhone’a. Ta przeglądarka nigdy nie prosi o zgodę na powiadomienia.',
  reminderDeniedNote:
    'Powiadomienia iPhone’a dla 900words są wyłączone. Włącz je w Ustawieniach iPhone’a i wróć tutaj, żeby zaplanować codzienne przypomnienie Casey.',
  reminderOpenSettingsButton: 'Otwórz ustawienia powiadomień',
  reminderOnNote: (time) => `Casey odezwie się o ${time} na tym iPhonie.`,
  reminderTurningOff: 'Wyłączanie…',
  reminderTurnOffButton: 'Wyłącz przypomnienie',
  reminderOffNote: (time) =>
    `Casey może wysłać jedno lokalne przypomnienie o ${time}. Wiadomość powstaje na tym iPhonie z liczby ukończonych dni; żaden token urządzenia ani historia nauki go nie opuszczają.`,
  reminderAsking: 'Pytanie iPhone’a…',
  reminderTurnOnButton: 'Włącz przypomnienie',

  // ── twoja kolekcja: kopia zapasowa ───────────────────────────────────────
  collectionHeading: 'Kopia zapasowa',
  backupIntro:
    'Twoja kolekcja jest tylko na tym telefonie. Kopia zapasowa to jeden mały plik - zachowaj ją w bezpiecznym miejscu, zanim zmienisz telefon albo wyczyścisz dane przeglądarki. Nigdy nie ma w niej twojego klucza API.',
  backupSaveButton: 'Zapisz kopię',
  backupRestoreButton: 'Przywróć z pliku',
  backupShared: 'Kopia przekazana do telefonu.',
  backupDownloaded: 'Kopia pobrana.',
  backupHideText: 'Ukryj kopię tekstową',
  backupShowText: 'Brak wyboru pliku? Użyj tekstu',
  backupCopyButton: 'Kopiuj kolekcję',
  backupCopied: 'Kopia skopiowana do schowka.',
  backupPasteLabel: 'Wklej kopię tutaj',
  backupReadButton: 'Wczytaj',
  backupHoldsHeading: 'Ta kopia zawiera',
  // Liczba zebranych stoi w <strong> PRZED tym tekstem i nie przychodzi jako
  // argument - „w kolekcji” nie wymaga zgody z liczebnikiem, „zebranych słów”
  // wymagałoby („3 zebrane słowa”, ale „12 zebranych słów”).
  backupCollectedAfter: (met) => `w kolekcji, z ${met} napotkanych w sumie`,
  // Tu też liczba stoi przed tekstem bez argumentu; dopełniacz jest poprawny
  // dla 0, 5+ i 12–14 - dla 2–4 powinno być „zawinięte”. Zgłoszone.
  backupWrappedAfter: (city) => `zawiniętych · ${city}`,
  backupGamesLine: (games, savedOn) =>
    `${games} ${plural(games, 'rozegrana runda', 'rozegrane rundy', 'rozegranych rund')} · zapisano ${savedOn}`,
  backupMergeButton: 'Scal z urządzeniem',
  backupReplaceButton: 'Zastąp wszystko',
  backupCancelButton: 'Anuluj',
  backupChoiceNote:
    'Scalanie zachowuje dla każdego słowa lepszy z dwóch zapisów, więc nigdy nie kosztuje cię zielonej. Zastąpienie wyrzuca postępy z tego urządzenia.',
  backupReplaceConfirm:
    'Zastąpić wszystko na tym urządzeniu kopią zapasową? Cała nauka od czasu jej zapisania przepadnie.',
  backupMerged: (collected) =>
    `Scalono. Nic z twoich rzeczy nie przepadło - dołączono ${collected} ${plural(collected, 'zebrane słowo', 'zebrane słowa', 'zebranych słów')}.`,
  backupRestored: (collected, wrapped) =>
    `Przywrócono ${collected} ${plural(collected, 'zebrane', 'zebrane', 'zebranych')} i ${wrapped} ${plural(wrapped, 'zawinięte słowo', 'zawinięte słowa', 'zawiniętych słów')}.`,

  // ── rejestr wskazówek właściciela ────────────────────────────────────────
  clueLedgerHeading: 'Wskazówki Casey',

  // ── dane ─────────────────────────────────────────────────────────────────
  dataHeading: 'Dane',
  usageStatsLabel: 'Anonimowe statystyki użycia',
  usageStatsHelp:
    'Tylko liczby - rozegrane rundy, gdzie gracze przestają, czy zawiodła Casey albo nagranie. Żadnych słów, wskazówek ani identyfikatorów.',
  usageStatsAria: 'Udostępniaj anonimowe statystyki użycia',
  dataSharingPrivateTitle: 'Gra prywatna',
  dataSharingPrivateDetail: 'Żadne opcjonalne dane z gry nie opuszczają telefonu.',
  dataSharingDiagnosticsTitle: 'Anonimowa diagnostyka',
  dataSharingDiagnosticsDetail: 'Udostępniaj liczbę rund i wyniki, nigdy słowa ani wskazówki.',
  dataSharingLearningTitle: 'Diagnostyka + przykłady do nauki Casey',
  dataSharingLearningDetail:
    'Udostępniaj też wskazówki, próby i wyniki, żeby Casey mogła się poprawiać.',
  dataSharingAria: 'Udostępnianie danych',
  dataSharingCloseAria: 'Zamknij bez wyboru',
  dataSharingPromptTitle: 'Jak 900words ma używać twojej gry?',
  dataSharingPromptNote:
    'Nic nie jest zaznaczone z góry. Każdy wybór zostawia całą grę otwartą, a zmienisz go w Ustawieniach.',
  dataSharingSettingsNote:
    'Brak wyboru działa jak „Gra prywatna”. To steruje tylko zdarzeniami opcjonalnymi; Casey i krótkie sprawdzenie następnej planszy nadal przetwarzają minimum danych potrzebne do gry.',
  dataSharingDeleting: 'Usuwanie udostępnionych danych…',
  dataSharingDeleteButton: 'Usuń udostępnione dane',
  resetConfirm: (language) =>
    `Zresetować wszystkie postępy w nauce, podróż „${language}” i bieżącą grę?`,
  resetButton: 'Zresetuj postępy',

  // ── stopka z wersją ──────────────────────────────────────────────────────
  buildStamp: (stamp) => `Wersja ${stamp}`,
  testFlightBuild: (build) => `TestFlight ${build} · `,
  keyboardReadoutNote: 'Odczyt klawiatury włączony. Dotknij wersji pięć razy, żeby go ukryć.',
  stateOn: 'wł.',
  stateOff: 'wył.',
  composerRideWaiting: 'wył. (czeka na dokument)',
  composerRideButton: (state) => `Pole wpisu jedzie z klawiaturą: ${state}`,
  trainStoryButton: (state) => `Historia pociągu: ${state}`,


  updateChecking: 'Sprawdzanie…',
  checkUpdatesButton: 'Sprawdź aktualizacje',
  updateCurrent: 'Wszystko aktualne.',
  updateFound:
    'Nowsza wersja się pobiera - zamknij aplikację i otwórz ją ponownie, żeby ją przyjąć.',
  updateCheckFailed: 'Nie udało się sprawdzić. Zamknij aplikację i otwórz ją ponownie.',

  // ── jedno pytanie Casey o codzienne przypomnienie ────────────────────────
  reminderPromptCloseAria: 'Nie teraz',
  reminderPromptTitle: 'Trzy gry w walizce!',
  reminderPromptBody: (time) =>
    `To cała dzienna porcja. Mam ci przypomnieć jutro, koło ${time}? Jedno małe pukanie po południu - a wyłączysz je w Ustawieniach, kiedy chcesz.`,
  reminderPromptAccept: 'Tak, przypomnij',
  reminderPromptAsking: 'Pytam twojego iPhone’a…',
  reminderPromptDecline: 'Nie, dziękuję',

  // ── samo codzienne przypomnienie, pisane na telefonie ────────────────────
  reminderDoneTitle: 'Casey spakowana na dziś',
  reminderDoneBody: 'Trzy gry leżą bezpiecznie w walizce. Jutro gramy dalej.',
  reminderOneLeftTitle: 'Mała gra z Casey?',
  reminderStreakBody: (days) =>
    `Twoja seria: ${days} ${plural(days, 'dzień', 'dni', 'dni')}. Jeszcze jedna gra dzisiaj i trwa dalej.`,
  reminderOneLeftBody: 'Jeszcze jedna gra i dzisiejsze trzy są w walizce.',
  reminderSeatTitle: 'Casey zajęła ci miejsce',
  reminderSeatBody: (games) =>
    `${games} ${plural(games, 'mała gra dzisiaj wystarczy', 'małe gry dzisiaj wystarczą', 'małych gier dzisiaj wystarczy')}, żeby zacząć serię.`,

  // ── plakietka dostawcy ───────────────────────────────────────────────────



  // Current Settings and German-preview integration.
  learnerLanguagePreviewTag: "wersja poglądowa",
  learnerLanguagePreviewHelp: "Niemiecki jest wersją poglądową: mapa i Przewodnik są dostępne, ale gry słownej jeszcze nie ma. Lekcji nie sprawdziła jeszcze osoba, dla której niemiecki jest językiem ojczystym.",
  playtestTravelHelp: "Przeskocz dalej na mapie: wybierz późniejszy przystanek i podróż naprzód. Żadne słowo nie zostanie zapakowane i nie zyskasz postępów w nauce. Wyłącz tę opcję, aby ponownie sprawdzić zwykłe warunki podróży.",
}
