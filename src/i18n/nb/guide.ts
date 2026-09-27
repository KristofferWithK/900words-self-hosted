import type { Catalogue } from '../en'

/**
 * Norsk bokmål. Du. Reiseguiden snakker rolig og presist. Glossar:
 * «Overlevelse» er delen, én samtale i den er en dialog, og praten inne i en
 * dialog er samtalen; språkstasjonen heter det samme overalt.
 *
 * Undervisningsteksten inne i guiden er IKKE her — den kommer fra den danske
 * pakken. Kapitteltitler, leksjonstitler og bytemaer kommer som argumenter.
 */
export const guide: Catalogue['guide'] = {
  // ── guiden som gjenstand: omslag, navn, veier ut ─────────────────────────
  title: 'Reiseguide',
  openGuideAria: 'Åpne Reiseguiden',
  coverAria: 'Caseys reiseguide',
  bookCoverAria: 'Omslaget til Reiseguiden',
  backFromGuideAria: 'Tilbake fra Reiseguiden',
  backToGuideAria: 'Tilbake til Reiseguiden',
  backToHomeAria: 'Tilbake til Hjem',
  backToCoverAria: 'Tilbake til omslaget til Reiseguiden',
  caseyFieldNotes: 'Caseys feltnotater',
  coverTitle: { da: 'Din danske reise, skissert med blyant.', de: "Reisen din gjennom tysk, skissert med blyant." },
  pocketGuideEyebrow: 'Caseys lommeguide',
  pocketGuideTitle: { da: 'Dansk underveis.', de: "Tysk på reisen." },
  pocketGuideBlurb: 'Korte notater om ordene, mønstrene og samtalene du møter på veien.',
  openGrammarContentsAria: 'Åpne innholdet i Grammatikk',

  // ── de to delene og registerfanene deres ─────────────────────────────────
  sectionGrammar: 'Grammatikk',
  sectionSurvival: 'Overlevelse',
  thumbIndexesAria: 'Registerfaner i Reiseguiden',
  grammarThumbBlurb: { da: 'Slik fungerer dansk', de: "Slik fungerer tysk" },
  survivalThumbBlurb: 'Hva du sier der ute',
  backToGrammarIndexAria: 'Tilbake til registeret for Grammatikk',
  backToSurvivalIndexAria: 'Tilbake til registeret for Overlevelse',

  // ── en dels byregister ───────────────────────────────────────────────────
  cityIndexAria: (section) => `Byregister: ${section}`,
  cityIndexHeading: 'Ni bykapitler',
  cityIndexLede: 'Velg en hvilken som helst by. Navnet viser anbefalt læringsnivå.',
  cityRowAria: (city, topic, current) => `${city}: ${topic}${current ? ', nåværende by' : ''}`,
  lessonCount: (n) => (n === 1 ? '1 leksjon' : `${n} leksjoner`),
  exchangeCount: (n) => (n === 1 ? '1 dialog' : `${n} dialoger`),
  grammarBookTitle: (city) => `Grammatikk i ${city}`,
  grammarBookDescription: (n) => `${n} korte leksjoner samlet i Reiseguiden.`,
  grammarLessonBookDescription: 'Én side med regler, deretter eksempler i sammenheng.',
  grammarExamplesContext: 'Eksempler i sammenheng',
  grammarExamplesIntro: 'Les hver setning som en hel og nyttig setning.',
  englishOnlyNotice: 'Bare på engelsk · oversettelse kommer',
  nextSurvivalLabel: 'Neste: Overlevelse →',

  // ── én dialog i Overlevelse ──────────────────────────────────────────────
  exchangeAria: (title) => `Dialog: ${title}`,
  recommendedCity: (city) => `Anbefalt: ${city}`,
  speakerYou: 'Du',
  // Den som svarer deg i dialogen — uten kjønn, uten nasjonalitet.
  speakerLocal: 'Lokalkjent',
  listen: 'Lytt',
  listenToAria: (line) => `Lytt til: ${line}`,
  translationToggle: 'Norsk',
  recordingDidNotLoad: 'Opptaket ble ikke lastet inn',
  exchangeNavAria: 'Navigasjon mellom dialogene',

  // ── å bla i en bok ───────────────────────────────────────────────────────
  bookNavAria: 'Sidenavigasjon i boken',
  previous: 'Forrige',
  next: 'Neste',
  previousLabel: '← Forrige',
  nextLabel: 'Neste →',
  openBook: 'Åpne boken',
  backFromAria: (book) => `Tilbake fra ${book}`,
  backToCoverOfAria: (book) => `Tilbake til omslaget til ${book}`,
  pageOf: (page, total) => `Side ${page} av ${total}`,
  pageAnnouncement: (title, page, total) => `${title}, side ${page} av ${total}`,

  // ── togturen: linjen, opptaket, veien ut ─────────────────────────────────
  skipLessonAria: 'Hopp over leksjonen',
  skipShort: 'Hopp over',
  continueLabel: 'Fortsett',
  toSurvivalLabel: 'Overlevelse →',
  recordingSectionAria: 'Opptak av den danske leksjonen',
  hearTheLesson: 'Hør leksjonen',
  hearTheLessonHelp: 'Ett opptak på naturlig dansk. Trykk på en linje for å jobbe deg gjennom den.',
  stop: 'Stopp',
  recordingLoading: 'Laster inn opptaket av leksjonen…',
  recordingFailed: 'Opptaket av leksjonen ble ikke lastet inn. Prøv igjen.',
  recordingMissing: 'Denne leksjonen har ikke noe opptak ennå.',
  grammarChapterAria: (chapter) => `Grammatikkapittel ${chapter}`,

  // ── Reiseguidens registerskjerm: faner, kapitler, aktiviteter ────────────
  tabChapters: 'Kapitler',
  tabPractice: 'Øvelser',
  tabSituations: 'Situasjoner',
  tabsAria: 'Deler av Reiseguiden',
  chapterKicker: (chapter, city) => `Kapittel ${chapter} av 9 · ${city}`,
  chapterRowTitle: (chapter, city) => `Kapittel ${chapter} · ${city}`,
  chapterReached: 'Nådd',
  lookAhead: 'Se framover',
  lookAheadNote:
    'Å se framover er bare lesing. Det låser ikke opp byen og teller ikke som fullført.',
  /** De fire aktivitetstilstandene. CSS-klassen beholder den engelske nøkkelen; bare teksten flyttes. */
  activityNew: 'Ny',
  activityLater: 'Senere',
  activityDone: 'Ferdig',
  activityLocked: 'Låst',
  activityListIntro:
    'Ny, Senere og Ferdig blir stående her selv når du går av toget. En låst aktivitet venter på invitasjonen fra språkstasjonen sin.',
  noActivitiesYet: 'Nå en by, så kommer øvelsene dens hit.',
  kindPractice: 'Øvelse',
  kindReadinessTask: 'Avreiseoppgave',
  kindSituation: 'Situasjon',
  readerNote:
    'Dette er en leser du kan åpne så ofte du vil. Et førsteforsøk registreres bare i den poengsatte aktiviteten, aldri ved å åpne denne siden.',

  // Current Settings and German-preview integration.
  sectionEmpty: "Disse sidene er ikke skrevet for dette språket ennå.",
  listenNotRecordedYet: "Ikke spilt inn ennå",
  addressFormAria: (form) => "Tiltaleform: " + form,
}
