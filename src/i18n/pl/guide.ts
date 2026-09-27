import type { Catalogue } from '../en'
import { plural } from './plural'

/**
 * Polski. Ty, nigdy Pan/Pani. Przewodnik mówi spokojnie i dokładnie. Glosariusz:
 * „Rozmówki” to sekcja (angielskie „Survival” — po polsku dramatyczne
 * „Przetrwanie” nikomu nie powie, że chodzi o zwroty na co dzień), jedna
 * wymiana zdań w niej to „dialog”, a rozmowa wewnątrz dialogu to „rozmowa”;
 * stacja językowa nazywa się wszędzie tak samo.
 */
export const guide: Catalogue['guide'] = {
  // ── przewodnik jako przedmiot: okładki, nazwy, wyjścia ───────────────────
  title: 'Przewodnik',
  openGuideAria: 'Otwórz przewodnik',
  coverAria: 'Przewodnik Casey',
  bookCoverAria: 'Okładka przewodnika',
  backFromGuideAria: 'Wróć z przewodnika',
  backToGuideAria: 'Wróć do przewodnika',
  backToHomeAria: 'Wróć do startu',
  backToCoverAria: 'Wróć do okładki przewodnika',
  caseyFieldNotes: 'Notatki Casey',
  coverTitle: { da: 'Twoja duńska podróż, naszkicowana ołówkiem.', de: "Twoja podróż przez niemiecki, naszkicowana ołówkiem." },
  pocketGuideEyebrow: 'Kieszonkowy przewodnik Casey',
  pocketGuideTitle: { da: 'Duński na drogę.', de: "Niemiecki w podróży." },
  pocketGuideBlurb:
    'Krótkie notatki o słowach, wzorach i rozmowach, które spotkasz po drodze.',
  openGrammarContentsAria: 'Otwórz spis treści Gramatyki',

  // ── dwie sekcje i ich zakładki ───────────────────────────────────────────
  sectionGrammar: 'Gramatyka',
  sectionSurvival: 'Rozmówki',
  thumbIndexesAria: 'Zakładki przewodnika',
  grammarThumbBlurb: { da: 'Jak działa duński', de: "Jak działa niemiecki" },
  survivalThumbBlurb: 'Co mówić na miejscu',
  backToGrammarIndexAria: 'Wróć do spisu Gramatyki',
  backToSurvivalIndexAria: 'Wróć do spisu Rozmówek',

  // ── spis miast jednej sekcji ─────────────────────────────────────────────
  cityIndexAria: (section) => `${section}: spis miast`,
  cityIndexHeading: 'Dziewięć rozdziałów miast',
  cityIndexLede: 'Wybierz dowolne miasto. Jego nazwa pokazuje zalecany poziom nauki.',
  cityRowAria: (city, topic, current) =>
    `${city}: ${topic}${current ? ', obecne miasto' : ''}`,
  lessonCount: (n) => `${n} ${plural(n, 'lekcja', 'lekcje', 'lekcji')}`,
  exchangeCount: (n) => `${n} ${plural(n, 'dialog', 'dialogi', 'dialogów')}`,
  grammarBookTitle: (city) => `Gramatyka: ${city}`,
  grammarBookDescription: (n) => `${n} krótkie lekcje zebrane w Przewodniku.`,
  grammarLessonBookDescription: 'Jedna strona z regułami, a potem przykłady w kontekście.',
  grammarExamplesContext: 'Przykłady w kontekście',
  grammarExamplesIntro: 'Czytaj każde zdanie jako całość, której możesz użyć.',
  englishOnlyNotice: 'Tylko po angielsku · tłumaczenie w przygotowaniu',
  nextSurvivalLabel: 'Dalej: Przetrwanie →',

  // ── jeden dialog z Rozmówek ──────────────────────────────────────────────
  exchangeAria: (title) => `Dialog: ${title}`,
  recommendedCity: (city) => `Zalecane: ${city}`,
  speakerYou: 'Ty',
  // Kto ci odpowiada w dialogu — bez płci i bez narodowości.
  speakerLocal: 'Rozmówca',
  listen: 'Posłuchaj',
  listenToAria: (line) => `Posłuchaj: ${line}`,
  translationToggle: 'Polski',
  recordingDidNotLoad: 'Nagranie się nie wczytało',
  exchangeNavAria: 'Nawigacja po dialogach',

  // ── kartkowanie książki ──────────────────────────────────────────────────
  bookNavAria: 'Nawigacja po stronach książki',
  previous: 'Poprzednia',
  next: 'Dalej',
  previousLabel: '← Poprzednia',
  nextLabel: 'Dalej →',
  openBook: 'Otwórz książkę',
  backFromAria: (book) => `Wróć z: ${book}`,
  backToCoverOfAria: (book) => `Wróć do okładki: ${book}`,
  pageOf: (page, total) => `Strona ${page} z ${total}`,
  pageAnnouncement: (title, page, total) => `${title}, strona ${page} z ${total}`,

  // ── jazda pociągiem: pasek, nagranie, wyjście ────────────────────────────
  skipLessonAria: 'Pomiń lekcję',
  skipShort: 'Pomiń',
  continueLabel: 'Kontynuuj',
  toSurvivalLabel: 'Rozmówki →',
  recordingSectionAria: 'Nagranie duńskiej lekcji',
  hearTheLesson: 'Posłuchaj lekcji',
  hearTheLessonHelp: 'Jedno naturalne duńskie nagranie. Dotknij linijki, żeby ją przerobić.',
  stop: 'Zatrzymaj',
  recordingLoading: 'Wczytywanie nagrania lekcji…',
  recordingFailed: 'Nagranie lekcji się nie wczytało. Spróbuj ponownie.',
  recordingMissing: 'Ta lekcja nie ma jeszcze nagrania.',
  grammarChapterAria: (chapter) => `Rozdział gramatyki ${chapter}`,

  // ── ekran spisu przewodnika: karty, rozdziały, ćwiczenia ─────────────────
  tabChapters: 'Rozdziały',
  tabPractice: 'Ćwiczenia',
  tabSituations: 'Sytuacje',
  tabsAria: 'Sekcje przewodnika',
  chapterKicker: (chapter, city) => `Rozdział ${chapter} z 9 · ${city}`,
  chapterRowTitle: (chapter, city) => `Rozdział ${chapter} · ${city}`,
  chapterReached: 'Osiągnięty',
  lookAhead: 'Zajrzyj dalej',
  lookAheadNote:
    'Zaglądanie dalej to tylko czytanie. Nie odblokowuje miasta ani nie liczy się jako ukończenie.',
  activityNew: 'Nowe',
  activityLater: 'Później',
  activityDone: 'Gotowe',
  activityLocked: 'Zablokowane',
  activityListIntro:
    '„Nowe”, „Później” i „Gotowe” zostają tutaj, nawet gdy wyjdziesz z pociągu. Zablokowane ćwiczenie czeka na zaproszenie ze stacji językowej.',
  noActivitiesYet: 'Dotrzyj do miasta, a jego ćwiczenia pojawią się tutaj.',
  kindPractice: 'Ćwiczenie',
  kindReadinessTask: 'Zadanie sprawdzające',
  kindSituation: 'Sytuacja',
  readerNote:
    'To czytnik przewodnika. Możesz go otwierać dowolnie często. Pierwsza próba zapisuje się tylko w ocenianym przebiegu, nigdy przez otwarcie tej strony.',

  // Current Settings and German-preview integration.
  sectionEmpty: "Te strony nie zostały jeszcze napisane dla tego języka.",
  listenNotRecordedYet: "Jeszcze bez nagrania",
  addressFormAria: (form) => "Forma zwracania się: " + form,
}
