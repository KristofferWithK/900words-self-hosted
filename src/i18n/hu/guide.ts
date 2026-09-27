import type { Catalogue } from '../en'

/**
 * Magyar. Tegezés. Az Útikönyv nyugodtan és pontosan beszél. Szótár: a
 * „Túlélés” a szakasz, egy egység benne párbeszéd, a párbeszéden belüli
 * beszéd beszélgetés; a nyelvi állomás mindenütt így hívódik.
 *
 * „3/9. oldal”, nem „3. oldal a 9-ből”: a számra tett rag hangrendje a
 * számtól függne.
 */
export const guide: Catalogue['guide'] = {
  // ── az útikönyv mint tárgy: borítók, nevek, kijáratok ────────────────────
  title: 'Útikönyv',
  openGuideAria: 'Útikönyv megnyitása',
  coverAria: 'Casey útikönyve',
  bookCoverAria: 'Az Útikönyv borítója',
  backFromGuideAria: 'Vissza az Útikönyvből',
  backToGuideAria: 'Vissza az Útikönyvhöz',
  backToHomeAria: 'Vissza a főoldalra',
  backToCoverAria: 'Vissza az Útikönyv borítójához',
  caseyFieldNotes: 'Casey úti jegyzetei',
  coverTitle: { da: 'A dán utazásod, ceruzával felvázolva.', de: "Német nyelvi utazásod, ceruzával felvázolva." },
  pocketGuideEyebrow: 'Casey zsebkalauza',
  pocketGuideTitle: { da: 'Dán az útra.', de: "Német az útra." },
  pocketGuideBlurb:
    'Gyors jegyzetek az útközben elébed kerülő szavakról, mintákról és beszélgetésekről.',
  openGrammarContentsAria: 'A Nyelvtan tartalomjegyzékének megnyitása',

  // ── a két szakasz és a regiszterfüleik ───────────────────────────────────
  sectionGrammar: 'Nyelvtan',
  sectionSurvival: 'Túlélés',
  thumbIndexesAria: 'Az Útikönyv regiszterfülei',
  grammarThumbBlurb: { da: 'Hogyan működik a dán', de: "Így működik a német" },
  survivalThumbBlurb: 'Mit mondj odakint',
  backToGrammarIndexAria: 'Vissza a Nyelvtan tartalmához',
  backToSurvivalIndexAria: 'Vissza a Túlélés tartalmához',

  // ── egy szakasz városjegyzéke ────────────────────────────────────────────
  cityIndexAria: (section) => `${section}: városjegyzék`,
  cityIndexHeading: 'Kilenc városfejezet',
  cityIndexLede: 'Válassz bármelyik várost. A neve mutatja az ajánlott tanulási szintet.',
  cityRowAria: (city, topic, current) =>
    `${city}: ${topic}${current ? ', jelenlegi város' : ''}`,
  // A megszámlált főnév egyes számban marad: „3 lecke”, „4 párbeszéd”.
  lessonCount: (n) => `${n} lecke`,
  exchangeCount: (n) => `${n} párbeszéd`,
  grammarBookTitle: (city) => `${city} nyelvtana`,
  grammarBookDescription: (n) => `${n} rövid lecke egy helyen az Útikönyvben.`,
  grammarLessonBookDescription: 'Egy oldal a szabályokról, majd példák szövegkörnyezetben.',
  grammarExamplesContext: 'Példák szövegkörnyezetben',
  grammarExamplesIntro: 'Minden mondatot teljes, használható egységként olvass.',
  englishOnlyNotice: 'Csak angolul · a fordítás készül',
  nextSurvivalLabel: 'Tovább: Túlélés →',

  // ── egy Túlélés-párbeszéd ────────────────────────────────────────────────
  exchangeAria: (title) => `Párbeszéd: ${title}`,
  recommendedCity: (city) => `Ajánlott: ${city}`,
  speakerYou: 'Te',
  speakerLocal: 'Helyi',
  listen: 'Meghallgatás',
  listenToAria: (line) => `Meghallgatás: ${line}`,
  translationToggle: 'Magyar',
  recordingDidNotLoad: 'A felvétel nem töltődött be',
  exchangeNavAria: 'Navigáció a Túlélés párbeszédei között',

  // ── egy könyv lapozása ───────────────────────────────────────────────────
  bookNavAria: 'Lapozás a könyvben',
  previous: 'Előző',
  next: 'Tovább',
  previousLabel: '← Előző',
  nextLabel: 'Tovább →',
  openBook: 'Könyv megnyitása',
  backFromAria: (book) => `Vissza innen: ${book}`,
  backToCoverOfAria: (book) => `Vissza a borítóhoz: ${book}`,
  pageOf: (page, total) => `${page}/${total}. oldal`,
  pageAnnouncement: (title, page, total) => `${title}, ${page}/${total}. oldal`,

  // ── a vonatút: a sávja, a felvétele, a kijárata ──────────────────────────
  skipLessonAria: 'Lecke kihagyása',
  skipShort: 'Kihagyás',
  continueLabel: 'Folytatás',
  toSurvivalLabel: 'Túlélés →',
  recordingSectionAria: 'A dán lecke felvétele',
  hearTheLesson: 'Lecke meghallgatása',
  hearTheLessonHelp: 'Egy természetes dán felvétel. Koppints egy sorra, hogy végigvedd.',
  stop: 'Leállítás',
  recordingLoading: 'A lecke felvétele töltődik…',
  recordingFailed: 'A lecke felvétele nem töltődött be. Próbáld újra.',
  recordingMissing: 'Ehhez a leckéhez még nincs felvétel.',
  grammarChapterAria: (chapter) => `${chapter}. nyelvtani fejezet`,

  // ── az Útikönyv jegyzékképernyője: fülek, fejezetek, gyakorlatok ─────────
  tabChapters: 'Fejezetek',
  tabPractice: 'Gyakorlatok',
  // Szándékosan rövid: három fül 360 pixelen. A kártya alatta a szótár szerint
  // „Hétköznapi helyzet”-et mond.
  tabSituations: 'Helyzetek',
  tabsAria: 'Az Útikönyv szakaszai',
  chapterKicker: (chapter, city) => `${chapter}/9. fejezet · ${city}`,
  chapterRowTitle: (chapter, city) => `${chapter}. fejezet · ${city}`,
  chapterReached: 'Elérve',
  lookAhead: 'Előretekintés',
  lookAheadNote:
    'Az előretekintés csak olvasás. Nem oldja fel ezt a várost, és nem számít teljesítésnek.',
  activityNew: 'Új',
  activityLater: 'Később',
  activityDone: 'Kész',
  activityLocked: 'Zárolt',
  activityListIntro:
    'Az „Új”, a „Később” és a „Kész” akkor is itt marad, ha leszállsz a vonatról. A zárolt gyakorlat a nyelvi állomás meghívására vár.',
  noActivitiesYet: 'Érj el egy várost, és a gyakorlatai megjelennek itt.',
  kindPractice: 'Gyakorlat',
  kindReadinessTask: 'Felkészültségi feladat',
  kindSituation: 'Hétköznapi helyzet',
  readerNote:
    'Ez egy újrajátszható olvasónézet. Első próbálkozást csak a pontozott gyakorlatfolyam rögzít, ennek az oldalnak a megnyitása soha.',

  // Current Settings and German-preview integration.
  sectionEmpty: "Ezek az oldalak még nem készültek el ehhez a nyelvhez.",
  listenNotRecordedYet: "Még nincs hangfelvétel",
  addressFormAria: (form) => "Megszólítási forma: " + form,
}
