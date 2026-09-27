import type { Catalogue } from '../en'

/**
 * Svenska. Du; Casey är ”hon”. Reseguiden talar lugnt och precist. Glossar:
 * ”Överlevnad” är avsnittet, ett stycke i det är en dialog och pratet inuti
 * dialogen ett samtal; språkstationen heter så överallt.
 */
export const guide: Catalogue['guide'] = {
  // ── guiden som föremål: omslag, namn, vägar ut ───────────────────────────
  title: 'Reseguide',
  openGuideAria: 'Öppna Reseguiden',
  coverAria: 'Caseys reseguide',
  bookCoverAria: 'Reseguidens omslag',
  backFromGuideAria: 'Tillbaka från Reseguiden',
  backToGuideAria: 'Tillbaka till Reseguiden',
  backToHomeAria: 'Tillbaka till Hem',
  backToCoverAria: 'Tillbaka till Reseguidens omslag',
  caseyFieldNotes: 'Caseys anteckningar',
  coverTitle: { da: 'Din danska resa, skissad med blyerts.', de: "Din resa genom tyskan, skissad med blyerts." },
  pocketGuideEyebrow: 'Caseys fickguide',
  pocketGuideTitle: { da: 'Danska på resande fot.', de: "Tyska för resan." },
  pocketGuideBlurb: 'Snabba anteckningar om orden, mönstren och samtalen du möter längs vägen.',
  openGrammarContentsAria: 'Öppna Grammatikens innehåll',

  // ── de två avsnitten och deras tumregister ───────────────────────────────
  sectionGrammar: 'Grammatik',
  sectionSurvival: 'Överlevnad',
  thumbIndexesAria: 'Reseguidens tumregister',
  grammarThumbBlurb: { da: 'Så fungerar danska', de: "Så fungerar tyska" },
  survivalThumbBlurb: 'Vad du säger där ute',
  backToGrammarIndexAria: 'Tillbaka till registret för Grammatik',
  backToSurvivalIndexAria: 'Tillbaka till registret för Överlevnad',

  // ── ett avsnitts stadsregister ───────────────────────────────────────────
  cityIndexAria: (section) => `Stadsregister: ${section}`,
  cityIndexHeading: 'Nio stadskapitel',
  cityIndexLede: 'Välj vilken stad du vill. Namnet visar den rekommenderade nivån.',
  cityRowAria: (city, topic, current) => `${city}: ${topic}${current ? ', aktuell stad' : ''}`,
  lessonCount: (n) => (n === 1 ? '1 lektion' : `${n} lektioner`),
  exchangeCount: (n) => (n === 1 ? '1 dialog' : `${n} dialoger`),
  grammarBookTitle: (city) => `Grammatik i ${city}`,
  grammarBookDescription: (n) => `${n} korta lektioner samlade i resehandboken.`,
  grammarLessonBookDescription: 'En sida med regler, sedan exempel i sammanhang.',
  grammarExamplesContext: 'Exempel i sammanhang',
  grammarExamplesIntro: 'Läs varje mening som en hel och användbar mening.',
  englishOnlyNotice: 'Endast engelska · översättning kommer',
  nextSurvivalLabel: 'Nästa: Överlevnad →',

  // ── en Överlevnad-dialog ─────────────────────────────────────────────────
  exchangeAria: (title) => `Dialog: ${title}`,
  recommendedCity: (city) => `Rekommenderas: ${city}`,
  speakerYou: 'Du',
  // Den som svarar dig i dialogen — utan kön, utan nationalitet.
  speakerLocal: 'Ortsbo',
  listen: 'Lyssna',
  listenToAria: (line) => `Lyssna på: ${line}`,
  translationToggle: 'Svenska',
  recordingDidNotLoad: 'Inspelningen laddades inte',
  exchangeNavAria: 'Navigering mellan dialogerna',

  // ── att bläddra i en bok ─────────────────────────────────────────────────
  bookNavAria: 'Sidnavigering i boken',
  previous: 'Föregående',
  next: 'Nästa',
  previousLabel: '← Föregående',
  nextLabel: 'Nästa →',
  openBook: 'Öppna boken',
  backFromAria: (book) => `Tillbaka från ${book}`,
  backToCoverOfAria: (book) => `Tillbaka till omslaget för ${book}`,
  pageOf: (page, total) => `Sida ${page} av ${total}`,
  pageAnnouncement: (title, page, total) => `${title}, sida ${page} av ${total}`,

  // ── tågresan: dess rad, dess inspelning, dess väg ut ─────────────────────
  skipLessonAria: 'Hoppa över lektionen',
  skipShort: 'Hoppa över',
  continueLabel: 'Fortsätt',
  toSurvivalLabel: 'Överlevnad →',
  recordingSectionAria: 'Inspelning av den danska lektionen',
  hearTheLesson: 'Lyssna på lektionen',
  hearTheLessonHelp: 'En inspelning på naturlig danska. Tryck på en rad för att gå igenom den.',
  stop: 'Stopp',
  recordingLoading: 'Laddar lektionens inspelning…',
  recordingFailed: 'Lektionens inspelning laddades inte. Försök igen.',
  recordingMissing: 'Den här lektionen har ingen inspelning än.',
  grammarChapterAria: (chapter) => `Grammatikkapitel ${chapter}`,

  // ── Reseguidens registerskärm: flikar, kapitel, aktiviteter ──────────────
  tabChapters: 'Kapitel',
  tabPractice: 'Övningar',
  // Medvetet kort: tre flikar på 360 pixlar. Kortet under säger
  // ”vardagssituation”, som glossaret.
  tabSituations: 'Situationer',
  tabsAria: 'Reseguidens avsnitt',
  chapterKicker: (chapter, city) => `Kapitel ${chapter} av 9 · ${city}`,
  chapterRowTitle: (chapter, city) => `Kapitel ${chapter} · ${city}`,
  chapterReached: 'Nått',
  lookAhead: 'Titta framåt',
  lookAheadNote:
    'Att titta framåt är bara att läsa. Det låser inte upp staden och räknas inte som avklarat.',
  /** De fyra aktivitetslägena. CSS-klassen behåller den engelska nyckeln; bara etiketten byts. */
  activityNew: 'Ny',
  activityLater: 'Senare',
  activityDone: 'Klar',
  activityLocked: 'Låst',
  activityListIntro:
    '”Ny”, ”Senare” och ”Klar” finns kvar här även när du lämnar tåget. En låst aktivitet väntar på sin inbjudan från språkstationen.',
  noActivitiesYet: 'Nå en stad så läggs dess övningar till här.',
  kindPractice: 'Övning',
  kindReadinessTask: 'Avreseuppgift',
  kindSituation: 'Vardagssituation',
  readerNote:
    'Det här är en läsvy du kan öppna hur många gånger du vill. Ett första försök registreras bara i det bedömda flödet, aldrig genom att öppna den här sidan.',

  // Current Settings and German-preview integration.
  sectionEmpty: "De här sidorna har inte skrivits för det här språket ännu.",
  listenNotRecordedYet: "Inte inspelat ännu",
  addressFormAria: (form) => "Tilltalsform: " + form,
}
