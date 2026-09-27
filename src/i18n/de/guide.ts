import type { Catalogue } from '../en'

/**
 * Deutsch. Du, nie Sie. Der Reiseführer spricht ruhig und genau. Glossar:
 * „Überleben“ ist der Abschnitt, ein Gespräch darin ein Dialog; die
 * Sprachstation heißt überall so.
 */
export const guide: Catalogue['guide'] = {
  // ── the guide as an object: covers, names, ways out ──────────────────────
  title: 'Reiseführer',
  openGuideAria: 'Reiseführer öffnen',
  coverAria: 'Caseys Reiseführer',
  bookCoverAria: 'Umschlag des Reiseführers',
  backFromGuideAria: 'Zurück aus dem Reiseführer',
  backToGuideAria: 'Zurück zum Reiseführer',
  backToHomeAria: 'Zurück zum Start',
  backToCoverAria: 'Zurück zum Umschlag des Reiseführers',
  caseyFieldNotes: 'Caseys Notizen',
  coverTitle: { da: 'Deine Reise durchs Dänische, mit Bleistift skizziert.', de: 'Deine Reise durchs Deutsche, mit Bleistift skizziert.' },
  pocketGuideEyebrow: 'Caseys Taschenführer',
  pocketGuideTitle: { da: 'Dänisch für unterwegs.', de: 'Deutsch für unterwegs.' },
  pocketGuideBlurb:
    'Kurze Notizen zu den Wörtern, Mustern und Gesprächen, die dir unterwegs begegnen.',
  openGrammarContentsAria: 'Inhaltsverzeichnis der Grammatik öffnen',

  // ── the two sections and their thumb indexes ─────────────────────────────
  sectionGrammar: 'Grammatik',
  sectionSurvival: 'Überleben',
  thumbIndexesAria: 'Griffregister des Reiseführers',
  grammarThumbBlurb: { da: 'Wie Dänisch funktioniert', de: 'Wie Deutsch funktioniert' },
  survivalThumbBlurb: 'Was du unterwegs sagst',
  backToGrammarIndexAria: 'Zurück zum Verzeichnis „Grammatik“',
  backToSurvivalIndexAria: 'Zurück zum Verzeichnis „Überleben“',

  // ── a section's city index ───────────────────────────────────────────────
  cityIndexAria: (section) => `Städteverzeichnis: ${section}`,
  cityIndexHeading: 'Neun Stadtkapitel',
  cityIndexLede: 'Wähl eine Stadt. Ihr Name verrät das empfohlene Lernniveau.',
  sectionEmpty: 'Diese Seiten gibt es für diese Sprache noch nicht.',
  cityRowAria: (city, topic, current) =>
    `${city}: ${topic}${current ? ', aktuelle Stadt' : ''}`,
  lessonCount: (n) => (n === 1 ? '1 Lektion' : `${n} Lektionen`),
  exchangeCount: (n) => (n === 1 ? '1 Dialog' : `${n} Dialoge`),
  grammarBookTitle: (city) => `Grammatik · ${city}`,
  grammarBookDescription: (n) => `${n} kurze Lektionen im Reiseführer zusammengefasst.`,
  grammarLessonBookDescription: 'Eine Regelseite, danach Beispiele im Zusammenhang.',
  grammarExamplesContext: 'Beispiele im Zusammenhang',
  grammarExamplesIntro: 'Lies jeden Satz als vollständige, nützliche Einheit.',
  englishOnlyNotice: 'Nur auf Englisch · Übersetzung folgt',
  nextSurvivalLabel: 'Weiter: Überleben →',

  // ── one Survival exchange ────────────────────────────────────────────────
  exchangeAria: (title) => `Dialog: ${title}`,
  recommendedCity: (city) => `Empfohlen: ${city}`,
  speakerYou: 'Du',
  // Wer dir im Dialog antwortet — ohne Geschlecht, ohne Nationalität.
  speakerLocal: 'Gegenüber',
  listen: 'Anhören',
  listenToAria: (line) => `Anhören: ${line}`,
  translationToggle: 'Deutsch',
  recordingDidNotLoad: 'Aufnahme nicht geladen',
  listenNotRecordedYet: 'Noch nicht aufgenommen',
  addressFormAria: (form: string) => `Anrede: ${form}`,
  exchangeNavAria: 'Navigation durch die Dialoge',

  // ── turning the pages of a book ──────────────────────────────────────────
  bookNavAria: 'Seitennavigation im Buch',
  previous: 'Vorherige',
  next: 'Weiter',
  previousLabel: '← Vorherige',
  nextLabel: 'Weiter →',
  openBook: 'Buch öffnen',
  backFromAria: (book) => `Zurück aus ${book}`,
  backToCoverOfAria: (book) => `Zurück zum Umschlag von ${book}`,
  pageOf: (page, total) => `Seite ${page} von ${total}`,
  pageAnnouncement: (title, page, total) => `${title}, Seite ${page} von ${total}`,

  // ── the train ride: its bar, its recording, its way out ──────────────────
  skipLessonAria: 'Lektion überspringen',
  skipShort: 'Überspringen',
  continueLabel: 'Weiter',
  toSurvivalLabel: 'Überleben →',
  recordingSectionAria: 'Aufnahme der dänischen Lektion',
  hearTheLesson: 'Lektion anhören',
  hearTheLessonHelp:
    'Eine Aufnahme in natürlichem Dänisch. Tippe auf eine Zeile, um sie durchzugehen.',
  stop: 'Stopp',
  recordingLoading: 'Aufnahme wird geladen…',
  recordingFailed: 'Die Aufnahme wurde nicht geladen. Versuch es noch einmal.',
  recordingMissing: 'Für diese Lektion gibt es noch keine Aufnahme.',
  grammarChapterAria: (chapter) => `Grammatikkapitel ${chapter}`,

  // ── the Travel Guide index screen: tabs, chapters, activities ────────────
  tabChapters: 'Kapitel',
  tabPractice: 'Übungen',
  // Bewusst kurz: drei Tabs auf 360 Pixeln. Die Karte darunter sagt
  // „Alltagssituation“, wie das Glossar.
  tabSituations: 'Situationen',
  tabsAria: 'Abschnitte des Reiseführers',
  chapterKicker: (chapter, city) => `Kapitel ${chapter} von 9 · ${city}`,
  chapterRowTitle: (chapter, city) => `Kapitel ${chapter} · ${city}`,
  chapterReached: 'Erreicht',
  lookAhead: 'Vorausschauen',
  lookAheadNote:
    'Vorausschauen heißt nur lesen. Es schaltet die Stadt nicht frei und zählt nicht als Abschluss.',
  activityNew: 'Neu',
  activityLater: 'Später',
  activityDone: 'Erledigt',
  activityLocked: 'Gesperrt',
  activityListIntro:
    '„Neu“, „Später“ und „Erledigt“ bleiben erhalten, auch wenn du den Zug verlässt. Eine gesperrte Übung wird erst an einer Sprachstation freigeschaltet.',
  noActivitiesYet: 'Erreiche eine Stadt, dann erscheinen ihre Übungen hier.',
  kindPractice: 'Übung',
  kindReadinessTask: 'Bereitschaftsaufgabe',
  kindSituation: 'Alltagssituation',
  readerNote:
    'Das ist der Lesemodus. Du kannst ihn beliebig oft öffnen. Ein erster Versuch zählt nur im bewerteten Ablauf, nie durch das Öffnen dieser Seite.',
}
