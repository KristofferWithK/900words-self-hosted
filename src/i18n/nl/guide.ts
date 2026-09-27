import type { Catalogue } from '../en'

/**
 * Nederlands. Je/jij, nooit u. De reisgids spreekt rustig en precies.
 * Glossarium: ‘Overleven’ is het onderdeel, één onderdeel daarin een dialoog
 * en het gesprek erin een gesprek; de taalstop heet overal zo.
 */
export const guide: Catalogue['guide'] = {
  // ── de gids als voorwerp: omslagen, namen, uitgangen ─────────────────────
  title: 'Reisgids',
  openGuideAria: 'Reisgids openen',
  coverAria: 'Casey’s reisgids',
  bookCoverAria: 'Omslag van de reisgids',
  backFromGuideAria: 'Terug uit de reisgids',
  backToGuideAria: 'Terug naar de reisgids',
  backToHomeAria: 'Terug naar het beginscherm',
  backToCoverAria: 'Terug naar de omslag van de reisgids',
  caseyFieldNotes: 'Casey’s reisnotities',
  coverTitle: { da: 'Jouw Deense reis, met potlood ingetekend.', de: "Je reis door het Duits, in potlood geschetst." },
  pocketGuideEyebrow: 'Casey’s zakgids',
  pocketGuideTitle: { da: 'Deens voor onderweg.', de: "Duits voor onderweg." },
  pocketGuideBlurb:
    'Korte notities bij de woorden, patronen en gesprekken die je onderweg tegenkomt.',
  openGrammarContentsAria: 'Inhoud van Grammatica openen',

  // ── de twee onderdelen en hun duimregisters ──────────────────────────────
  sectionGrammar: 'Grammatica',
  sectionSurvival: 'Overleven',
  thumbIndexesAria: 'Duimregisters van de reisgids',
  grammarThumbBlurb: { da: 'Hoe Deens werkt', de: "Hoe Duits werkt" },
  survivalThumbBlurb: 'Wat je onderweg zegt',
  backToGrammarIndexAria: 'Terug naar de index van Grammatica',
  backToSurvivalIndexAria: 'Terug naar de index van Overleven',

  // ── de stedenindex van een onderdeel ─────────────────────────────────────
  cityIndexAria: (section) => `Stedenindex: ${section}`,
  cityIndexHeading: 'Negen stadshoofdstukken',
  cityIndexLede: 'Kies een stad. De naam laat het aanbevolen niveau zien.',
  cityRowAria: (city, topic, current) =>
    `${city}: ${topic}${current ? ', huidige stad' : ''}`,
  lessonCount: (n) => (n === 1 ? '1 les' : `${n} lessen`),
  exchangeCount: (n) => (n === 1 ? '1 dialoog' : `${n} dialogen`),
  grammarBookTitle: (city) => `Grammatica van ${city}`,
  grammarBookDescription: (n) => `${n} korte lessen bij elkaar in de Reisgids.`,
  grammarLessonBookDescription: 'Eerst een pagina met regels, daarna voorbeelden in context.',
  grammarExamplesContext: 'Voorbeelden in context',
  grammarExamplesIntro: 'Lees elke zin als een volledige, bruikbare zin.',
  englishOnlyNotice: 'Alleen Engels · vertaling volgt',
  nextSurvivalLabel: 'Volgende: Overleven →',

  // ── één Overleven-dialoog ────────────────────────────────────────────────
  exchangeAria: (title) => `Dialoog: ${title}`,
  recommendedCity: (city) => `Aanbevolen: ${city}`,
  speakerYou: 'Jij',
  // Wie je in het gesprek antwoordt — zonder geslacht, zonder nationaliteit.
  speakerLocal: 'Inwoner',
  listen: 'Luisteren',
  listenToAria: (line) => `Luister naar: ${line}`,
  translationToggle: 'Nederlands',
  recordingDidNotLoad: 'Opname niet geladen',
  exchangeNavAria: 'Navigatie door de dialogen',

  // ── de bladzijden van een boek omslaan ───────────────────────────────────
  bookNavAria: 'Paginanavigatie van het boek',
  previous: 'Vorige',
  next: 'Volgende',
  previousLabel: '← Vorige',
  nextLabel: 'Volgende →',
  openBook: 'Boek openen',
  backFromAria: (book) => `Terug uit ${book}`,
  backToCoverOfAria: (book) => `Terug naar de omslag van ${book}`,
  pageOf: (page, total) => `Pagina ${page} van ${total}`,
  pageAnnouncement: (title, page, total) => `${title}, pagina ${page} van ${total}`,

  // ── de treinrit: zijn balk, zijn opname, zijn uitgang ────────────────────
  skipLessonAria: 'De les overslaan',
  skipShort: 'Overslaan',
  continueLabel: 'Doorgaan',
  toSurvivalLabel: 'Overleven →',
  recordingSectionAria: 'Opname van de Deense les',
  hearTheLesson: 'De les beluisteren',
  hearTheLessonHelp: 'Eén natuurlijke Deense opname. Tik op een regel om die door te nemen.',
  stop: 'Stoppen',
  recordingLoading: 'De opname van de les wordt geladen…',
  recordingFailed: 'De opname van de les is niet geladen. Probeer het nog eens.',
  recordingMissing: 'Deze les heeft nog geen opname.',
  grammarChapterAria: (chapter) => `Grammaticahoofdstuk ${chapter}`,

  // ── het indexscherm van de reisgids: tabs, hoofdstukken, activiteiten ────
  // Drie tabs op 360 pixels; ‘Hoofdstukken’ is het langste dat het
  // Nederlands hier heeft.
  tabChapters: 'Hoofdstukken',
  tabPractice: 'Oefeningen',
  tabSituations: 'Situaties',
  tabsAria: 'Onderdelen van de reisgids',
  chapterKicker: (chapter, city) => `Hoofdstuk ${chapter} van 9 · ${city}`,
  chapterRowTitle: (chapter, city) => `Hoofdstuk ${chapter} · ${city}`,
  chapterReached: 'Bereikt',
  lookAhead: 'Vooruitkijken',
  lookAheadNote:
    'Vooruitkijken is alleen lezen. Het speelt deze stad niet vrij en telt niet als afgerond.',
  /** De vier activiteitstoestanden. De CSS-klasse houdt de Engelse sleutel; alleen het label verhuist. */
  activityNew: 'Nieuw',
  // ‘Later’ alleen is ook het Engelse woord en wordt door poort 3 geweigerd;
  // ‘Voor later’ is wat de toestand betekent en staat ook op de knop van de
  // taalstop die hem zet.
  activityLater: 'Later',
  activityDone: 'Klaar',
  activityLocked: 'Op slot',
  activityListIntro:
    '‘Nieuw’, ‘Voor later’ en ‘Klaar’ blijven hier staan, ook als je de trein verlaat. Een activiteit op slot wacht op de uitnodiging van een taalstop.',
  noActivitiesYet: 'Bereik een stad om haar oefeningen hier toe te voegen.',
  kindPractice: 'Oefening',
  kindReadinessTask: 'Vertrekopdracht',
  kindSituation: 'Situatie',
  readerNote:
    'Dit is de leesweergave, die je zo vaak mag openen als je wilt. Een eerste poging wordt alleen vastgelegd in de beoordeelde activiteit, nooit door deze pagina te openen.',

  // Current Settings and German-preview integration.
  sectionEmpty: "Deze pagina’s zijn nog niet geschreven voor deze taal.",
  listenNotRecordedYet: "Nog niet opgenomen",
  addressFormAria: (form) => "Aanspreekvorm: " + form,
}
