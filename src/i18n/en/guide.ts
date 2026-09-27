/**
 * The Travel Guide's own chrome — its covers, its thumb indexes, the train
 * ride and the notices — but NOT the teaching copy inside it, which lives in
 * the Danish pack and is translated through sidecars in Phase 2.
 *
 * The line between the two: everything here is what the guide says ABOUT
 * itself. A chapter's title, a lesson's prompt, an exchange's name and a
 * city's theme all arrive as arguments (`titleEn`, `themeEn`, `topicEn`, a
 * book's own `title`) and are never keys in this file.
 */
export const guide = {
  // ── the guide as an object: covers, names, ways out ──────────────────────
  /** The Guide's name. Also the aria-label of the shelf button when it is not a control. */
  title: 'Travel Guide',
  openGuideAria: 'Open Travel Guide',
  /** The old Travel Guide screen's cover section. */
  coverAria: "Casey's travel guide",
  /** The pocket book's cover page. */
  bookCoverAria: 'Travel Guide cover',
  backFromGuideAria: 'Back from Travel Guide',
  backToGuideAria: 'Back to Travel Guide',
  backToHomeAria: 'Back to home',
  backToCoverAria: 'Back to Travel Guide cover',
  /** The eyebrow over a Guide cover and over the city index. */
  caseyFieldNotes: 'Casey’s field notes',
  /**
   * Keyed by the language being LEARNED, not interpolated with its name: a
   * language name inflects and capitalises differently in every UI language
   * (Spanish writes «danés» mid-sentence and «Danés» at the start), so the
   * whole sentence is translated rather than a slot filled.
   */
  coverTitle: { da: 'Your Danish journey, pencilled in.', de: 'Your German journey, pencilled in.' },
  pocketGuideEyebrow: 'Casey’s pocket guide',
  pocketGuideTitle: { da: 'Danish for the road.', de: 'German for the road.' },
  pocketGuideBlurb:
    'Quick notes for the words, patterns, and conversations you meet along the way.',
  openGrammarContentsAria: 'Open Grammar contents',

  // ── the two sections and their thumb indexes ─────────────────────────────
  sectionGrammar: 'Grammar',
  sectionSurvival: 'Survival',
  thumbIndexesAria: 'Travel Guide thumb indexes',
  grammarThumbBlurb: { da: 'How Danish works', de: 'How German works' },
  survivalThumbBlurb: 'What to say out there',
  backToGrammarIndexAria: 'Back to Grammar index',
  backToSurvivalIndexAria: 'Back to Survival index',

  // ── a section's city index ───────────────────────────────────────────────
  /** `section` is sectionGrammar or sectionSurvival. */
  cityIndexAria: (section: string) => `${section} city index`,
  cityIndexHeading: 'Nine city chapters',
  cityIndexLede: 'Choose any city. Its name shows the recommended learning level.',
  /** A section with nothing authored for the language being learned. */
  sectionEmpty: 'These pages have not been written for this language yet.',
  /** `topic` is the chapter's own subject, from the pack. */
  cityRowAria: (city: string, topic: string, current: boolean) =>
    `${city}: ${topic}${current ? ', current city' : ''}`,
  lessonCount: (n: number) => (n === 1 ? '1 lesson' : `${n} lessons`),
  exchangeCount: (n: number) => (n === 1 ? '1 exchange' : `${n} exchanges`),
  grammarBookTitle: (city: string) => `${city} grammar`,
  grammarBookDescription: (n: number) => `${n} short lessons kept together in the Travel Guide.`,
  grammarLessonBookDescription: 'One rules page, then examples in context.',
  grammarExamplesContext: 'Examples in context',
  grammarExamplesIntro: 'Read these as complete, useful sentences.',
  englishOnlyNotice: 'English only · translation pending',
  nextSurvivalLabel: 'Next: Survival →',

  // ── one Survival exchange ────────────────────────────────────────────────
  /** `title` is the exchange's own name, from the pack. */
  exchangeAria: (title: string) => `${title} exchange`,
  recommendedCity: (city: string) => `Recommended: ${city}`,
  /** Who says a line of the dialogue. */
  speakerYou: 'You',
  speakerLocal: 'Local',
  listen: 'Listen',
  /** `line` is the Danish line itself and stays Danish. */
  listenToAria: (line: string) => `Listen to: ${line}`,
  /** The tab that shows the line in the player's language; named for that language. */
  translationToggle: 'English',
  recordingDidNotLoad: 'Recording did not load',
  /** Listen is greyed out until the language has an audio bake of its own. */
  listenNotRecordedYet: 'Not recorded yet',
  /** `form` is the language's own word — du, Sie, De. */
  addressFormAria: (form: string) => `Address form: ${form}`,
  exchangeNavAria: 'Survival exchange navigation',

  // ── turning the pages of a book ──────────────────────────────────────────
  bookNavAria: 'Book page navigation',
  previous: 'Previous',
  next: 'Next',
  previousLabel: '← Previous',
  nextLabel: 'Next →',
  openBook: 'Open book',
  /** `book` is the book's own title, from the pack. */
  backFromAria: (book: string) => `Back from ${book}`,
  backToCoverOfAria: (book: string) => `Back to ${book} cover`,
  pageOf: (page: number, total: number) => `Page ${page} of ${total}`,
  pageAnnouncement: (title: string, page: number, total: number) =>
    `${title}, page ${page} of ${total}`,

  // ── the train ride: its bar, its recording, its way out ──────────────────
  skipLessonAria: 'Skip the lesson',
  skipShort: 'Skip',
  continueLabel: 'Continue',
  toSurvivalLabel: 'Survival →',
  recordingSectionAria: 'Danish lesson recording',
  hearTheLesson: 'Hear the lesson',
  hearTheLessonHelp: 'One natural Danish recording. Tap a line to work through it.',
  stop: 'Stop',
  recordingLoading: 'Loading the lesson recording…',
  recordingFailed: 'The lesson recording did not load. Try again.',
  recordingMissing: 'This lesson has no recording yet.',
  grammarChapterAria: (chapter: number) => `Grammar chapter ${chapter}`,

  // ── the Travel Guide index screen: tabs, chapters, activities ────────────
  tabChapters: 'Chapters',
  tabPractice: 'Practice',
  tabSituations: 'Situations',
  tabsAria: 'Travel Guide sections',
  chapterKicker: (chapter: number, city: string) => `Chapter ${chapter} of 9 · ${city}`,
  chapterRowTitle: (chapter: number, city: string) => `Chapter ${chapter} · ${city}`,
  chapterReached: 'Reached',
  lookAhead: 'Look ahead',
  lookAheadNote:
    'Looking ahead is only reading. It does not unlock this city or count as completion.',
  /** The four activity states. The CSS class keeps the English key; only the label moves. */
  activityNew: 'New',
  activityLater: 'Later',
  activityDone: 'Done',
  activityLocked: 'Locked',
  activityListIntro:
    'New, Later and Done stay here even when you leave the train. A locked activity is waiting for its language-stop invitation.',
  noActivitiesYet: 'Reach a city to add its practice here.',
  kindPractice: 'Practice',
  kindReadinessTask: 'Readiness task',
  kindSituation: 'Situation',
  readerNote:
    'This is a replayable guide reader. A first-attempt record is only created by the scored activity flow, never by opening this page.',
}
