import type { Catalogue } from '../en'
import { az, Az, hol } from './toldalek'

/**
 * Magyar. Tegezés. A nyom az, amit adsz (egy szó és egy szám); a tipp az,
 * amit rá mondasz — ez a magyar játéknyelv szava, ezért Casey Főoldali
 * tanácsa „tanács”, nem „tipp”, és a koppintás koppintás. Egy lépés a
 * naplóban lépés: egy vasútállomásokkal teli appban a „menet” menetrendnek
 * olvasódna.
 *
 * Rövidre fogva: a tábla, a nyommező és a záróképernyő 360x640-en görgetés
 * nélkül kell elférjen, és a magyar toldalékolva hosszú.
 *
 * Számra tett rag sehol: „3 szóra”, „3/12”, „5 kért szó közül” — a rag
 * hangrendje a számtól függne, és a szám paraméter.
 */
export const game: Catalogue['game'] = {
  legacyRetiredTitle: "A haladásod megmaradt",
  legacyRetiredBody: "Egy régebbi kör nem folytatható a frissítés után. A mentett tanulási eredményeid és képeslapjaid megmaradtak. Folytasd a következő befejezetlen táblával.",
  phaseGiveClue: 'Adj Casey-nek egy nyomot',
  phaseCaseyGuessing: 'Casey tippel',
  phaseCaseyClue: 'Casey nyomot készít',
  phaseYourGuess: 'Te tippelsz',
  phaseLastChance: 'Utolsó esély: nincs több nyom',
  phaseRoundOver: 'A kör véget ért',
  phasePackTheBoard: 'Bepakolás',

  // A dán szó tárgyesetét („«hund»-ot”) elkerüli: a rag hangrendje a szótól függne.
  announceCaseyGuess: (word, result) => `Casey tippje: ${word}: ${result}.`,
  resultCorrect: 'helyes',
  resultNeutral: 'semleges',
  announceCaseyThinking: 'Casey gondolkodik.',

  skip: 'Kihagyás',
  homeAria: 'Főoldal',
  dealNewWordsAria: 'Új szavak osztása',
  hideTranslationsAria: 'Fordítások elrejtése',
  showTranslationsAria:
    'Minden fordítás megjelenítése. Minden megoldatlan szónál kikeresésnek számít',

  errorRetry: 'Újra',
  errorCaseySettings: 'Casey-beállítások',
  practiceNote: 'Kísérleti, ügynök nélküli prototípus. Ez nem Casey és nem a normál játék.',

  studyTitle: 'Tanulmányozd a táblát',
  studyHint: 'Minden fordítás látszik. Indításkor elrejtjük őket; utána egy koppintás keres ki egyet.',
  studyStart: 'Kör indítása',

  cardYourTarget: ', a te célod',
  cardFound: ', megtalálva',
  cardNeutralBoth: ', mindkét oldalon semleges',
  cardNeutralPlayer: ', a te nyomaid alatt semleges',
  cardNeutralCasey: ', Casey nyomai alatt semleges',
  cardUnpacked: ', nincs bepakolva',
  cardTranslationRevealed: ', fordítás megjelenítve',
  cardNotYetPacked: (language) =>
    `, még nincs bepakolva. Koppints, és írd be ${az(language)} ${language} megfelelőjét`,
  cardNotYoursToWrap: ', ezt még nem csomagolhatod be',
  cardTapToHear: '. Koppints a meghallgatáshoz',
  lookUpAria: (word) => `${word} kikeresése`,

  cluePlaceholder: 'A nyomod',
  clueFieldAria: (language) => `Az egyszavas nyomod ${language} nyelven`,
  fewerWordsAria: 'kevesebb szó',
  moreWordsAria: 'több szó',
  wordCountAria: (n) => `${n} szó`,
  giveClue: 'Nyom megadása',
  giveItAnyway: 'Mégis megadom',
  askingCasey: 'Casey kérdezése…',
  firstClueHint: (language) => `Egy ${language} szó. Elakadtál? A mellette lévő Szótár fordít.`,
  tutorialClueHint: 'Dánul értelmezem a nyomokat. Bizonytalan vagy? Próbáld ki. A szótár segít.',
  wrapPlayerKeyHint: 'A zöld kereted visszatért. Ez a te titkos kulcsod. Casey nem látja.',
  looksEnglishFull: (word, language) =>
    `${Az(word)} «${word}» angolnak tűnik. Koppints rá ${az(language)} ${language} megfelelőjéért, vagy add meg mégis, és Casey ellenőrzi.`,
  looksEnglishShort: 'egy kártyaszó jelentésének tűnik. Koppints rá, vagy add meg mégis',

  caseysClueLabel: 'Casey nyoma',
  lookUpInDictionaryAria: (word) => `«${word}» kikeresése a szótárban`,
  guessesLeft: (n) => `még ${n} tipp`,
  guessWord: (word) => `Tipp: «${word}»`,
  cancel: 'Mégse',
  stopKeepWhatWeHave: 'Megállunk, és megtartjuk, amink van',
  guessPrompt: 'Koppints arra a szóra, amire Casey szerinted gondol.',
  firstGuessHint: 'Most Casey kulcsa számít. Koppints egy szóra, amerre a nyoma mutat.',
  wrapCaseyKeyHint:
    'Casey kulcsa titkos. Tippeld meg, mire mutat a nyoma. Most az ő zöldjei számítanak.',
  tutorialLookupHint: 'Koppints a szó melletti ⓘ-re, hogy kényelmesen kikeresd a fordítását.',

  suddenDeathRule: 'Zöldeket nevezz meg a győzelemhez. Bármi más véget vet a körnek.',
  nameWord: (word) => `«${word}» megnevezése`,
  giveUpRound: 'Kör feladása',

  // ── a fordítási kerék (az utolsó esély, új 2026-09-16) ────────────────────
  wheelLede: (language) => `A kerék dönti el a kört. Írd vissza a szavakat ${language} nyelven, hogy megtöltsd, aztán pörgess. A zöld nyer.`,
  /** The input's placeholder and its accessible name. */
  wheelAnswerPlaceholder: (language) => `Írj ${language} nyelven`,
  wheelAnswerAria: (language, glosses) =>
    `Írd be ${language} nyelven az egyik szó fordítását: ${glosses.join(', ')}`,
  wheelCardStatus: (translated) =>
    translated ? ', lefordítva' : ', fordításra vár',
  wheelRetryLine: 'Nem az. Próbáld újra. Semmit sem veszítesz.',
  wheelSubmit: 'Bepakolás',
  wheelSpinAria: 'Pörgesd meg a kereket',
  wheelSpinning: 'Pörög …',
  wheelWonLine: 'Zöld! A kör megnyerve.',
  wheelMissLine: 'A kerék egy be nem pakolt bőröndön állt meg.',
  phaseTranslateChallenge: 'Fordítási idő',
  settlementFailed: 'Az eredményedet még nem sikerült menteni. Tartsd meg ezt a kört, és próbáld újra.',
  settlementSaving: 'Eredmény mentése…',
  guidanceTranslationBody: (language) => `A bőröndök most a talált szavak jelentését mutatják. Írd vissza őket ${language} nyelven, hogy megteljen a kerék, aztán pörgess. A zöld nyer.`,
  guidanceStartTranslation: 'Fordítás indítása',
  phaseTranslateWheel: 'A kerék: a pörgetés dönti el a kört',

  // ── az utolsó esély érkezőpanelje ─────────────────────────────────────────
  /** Az ablak mondata, amikor elfogynak a nyomok, és kezdődik a kerékpróba (tulaj, 2026-09-17) — a wheelLede hangjában. */
  guidanceLastChanceWheel:
    'Elfogytak a nyomok, így ez a befejezés. Fordítsd le a begyűjtött szavakat, hogy megtöltsd a kereket, aztán pörgess. A zöld megnyeri a kört.',

  caseyIsThinking: 'Casey gondolkodik…',
  offlineCaseyIsThinking: 'Az offline Casey gondolkodik. Ez tovább tart.',
  offlineRoundPrompt: 'Nincs internet. A kör hátralévő részét az offline Casey-vel játszod? Ő lassabb.',
  playOfflineButton: 'Offline játék',
  hurryCaseyTitle: 'Koppints, hogy Casey siessen',
  hurryCaseyHint: 'Koppints ide, hogy Casey siessen.',
  caseyGuessedWord: (word) => `Casey tippje: «${word}».`,
  caseyChoosingWord: 'Casey szót választ…',
  caseyChoosingWhether: 'Casey mérlegeli, tippeljen-e…',
  guessGotOne: '. Talált!',
  guessNeutral: '. Semleges.',

  turnTokensAria: (given, total, left) => `${given}/${total} nyom megadva, ${left} maradt.`,
  cluesGivenCount: (given, total) => `${given}/${total} nyom megadva`,

  leaveTitle: 'Kilépsz ebből a körből?',
  leaveBody:
    'A szünet pontosan így hagyja a táblát. A megszakítás eldobja, és a Játék új kört kezd.',
  leaveKeepPlaying: 'Játszom tovább',
  leavePause: 'Szünet',
  leaveCancelRound: 'Kör megszakítása',

  guidanceCaseyTitle: 'Casey első nyoma',
  guidancePlayerTitle: 'Te jössz!',
  guidanceWordCount: (n) => `${n} szó`,
  guidanceCaseyBody: 'Találd meg a szavakat, amelyek Casey nyomához kapcsolódnak.',
  guidancePlayerBody:
    'Írj egy dán szót, amely összeköti a zöld szavaid közül 1–4-et. Használd a szótárt, ha nem tudod a szót dánul.',
  guidanceHideReminder: 'Ne emlékeztess többé',
  guidanceStartGuessing: 'Tippelés indítása',
  guidanceWriteClue: 'Nyom írása',
  guidanceLastChanceTitle: 'Utolsó esély',
  guidanceLastChanceBody:
    'Elfogytak a nyomok. De még nyerhetsz. Tippelj tovább a korábbi nyomok alapján. De egy rossz tipp, és vesztettél.',
  guidanceKeepNaming: 'Nevezz tovább',
  guidancePackingTitle: 'Először pakold be a táblát',
  guidancePackingBody:
    'Fordítsd le a táblát angolról dánra, kártyánként. Amikor mind le van fordítva, vagy nem jutsz tovább, indítsd el a kört.',
  guidanceStartPacking: 'Bepakolás indítása',

  dictionaryPlaceholder: 'Szótár',
  dictionaryFieldAria: (language) => `Lefordítandó szó, ${language} vagy angol`,
  dictHitAria: (entry) => `${entry}: szótár megnyitása`,
  approximateFrom: (term) => ` (ebből: ${term})`,
  onTheBoardNote: ' (a táblán)',
  translateFailed: 'Ezt nem sikerült lefordítani.',
  lookupsUsed: 'Elfogytak a keresések.',
  dictionaryPracticeOnly: 'Gyakorláskor csak a 900 szó megy.',
  sayAgainAria: (word) => `${word} még egyszer`,
  saySlowlyAria: (word) => `${word} lassan`,
  sayExampleAria: 'Példamondat még egyszer',
  sayExampleSlowlyAria: 'Példamondat lassan',
  recordingsUnavailableNote: ' · normál és lassú felvétel nem érhető el',
  recordingFailedNote: ' · a felvétel nem töltődött be',
  close: 'Bezárás',

  caseysCalls: 'Casey döntései',
  turnCount: (n) => `${n} lépés`,
  logHint: 'Koppints a ⚑-ra bármelyik Casey-döntésnél, amely rossz volt. Amit megjelölsz, ő is látja.',
  logYou: 'Te',
  // „Casey: «hund» (2) erre: kat, mus”
  logFor: 'erre:',
  flagClueLabel: (clue) => `Casey nyoma: «${clue}»`,
  flagGuessLabel: (word) => `Casey tippje: «${word}»`,
  flagOnAria: (label) => `${label}, rossz döntésként megjelölve. Koppints a visszavonáshoz`,
  flagOffAria: (label) => `${label} megjelölése rossz döntésként`,
  guessCorrectSr: ', helyes',
  guessNeutralSr: ', semleges',
  // A rag a százalékra tapad („80%-ban”), így a hangrendje nem a számtól függ.
  confidenceSure: (percent) => `${percent}%-ban biztos`,
  noGuessMade: 'nem tippelt',

  ledgerEmpty:
    'Még semmi. Casey minden nyomához megjelenik itt egy sor, amint befejezted alatta a tippelést.',
  ledgerArmHeading: 'forrás',
  ledgerCluesHeading: 'nyom',
  ledgerFoundHeading: 'talált',
  ledgerRefusedHeading: 'elutasítva',
  ledgerHitsTitle: (hits, asked) => `${hits} találat ${asked} kért szó közül`,
  ledgerRefusedTitle: 'Hányszor dobtuk el e forrás első válaszát, és kérdeztünk újra',
  ledgerExplainer:
    'A „talált” azt mutatja, a nyom által kért szavak mekkora hányadát fordítottad fel valóban. Az „elutasítva” azt, hányszor dobtuk el a modell első válaszát és kérdeztünk újra. Az offline forrásokat nem lehet elutasítani.',
  ledgerClear: 'Napló törlése',

  // Rövid, mert a szalagcím 360 pixelen 6,8vw-re van fogva.
  outcomeWonTitle: 'Gratulálunk!',
  outcomeWonSub: 'Postkartét nyertél!',
  outcomeLostTitle: 'Majd legközelebb',
  outcomeGivenUpSub: 'Feladott kör. A kapcsolat pedig ott volt.',
  outcomeWheelMissSub: 'A kerék egy bőröndön állt meg, amit sosem pakoltál be.',
  /** A kerék nyertes vége (tulaj, 2026-09-18): zöldre állt meg. */
  outcomeWheelWinSub: 'A kerék zöldre állt meg. A kör a tiéd.',
  outcomeWheelSpentSub: 'A zseton el volt költve, és a nyomok mégis elfogytak.',

  resultLesson: 'Új választható Guide-lecke áll készen.', resultOpenGrammar: 'Nyisd meg a nyelvtant a Guide-ban', resultOpenSurvival: 'Nyisd meg a túlélést a Guide-ban', resultBackToResult: 'Vissza az eredményhez',

  roundStatsAria: 'Mit hozott ez a kör',
  // A megszámlált főnév magyarul egyes számban marad: „3 új szó”.
  newWordsLabel: (_n) => 'új szó',
  collectedForCasey: 'begyűjtve Casey-nek',
  wrapStatsAria: 'Mit pakolt be ez a csomagolókör',
  wrappedForGood: (named) => (named ? 'végleg becsomagolva:' : 'végleg becsomagolva'),
  stayedLabel: 'maradt',

  // ── hová vitte a kör az utazást: a csomagolókör olvasósávja ───────────────
  // A szám külön spanben áll előtte: „13 becsomagolva Ribében · 87 kell még
  // a vonathoz Kolding felé”.
  wrapJourneyHeading: 'Az utazás',
  wrapJourneyAria: 'Az utazás e csomagolókör után',
  wrappedInCity: (_n, city) => `becsomagolva ${hol(city)}`,
  wrapJourneyTrainReady: (city) => `a vonat ${city} felé indulásra kész`,
  wrapJourneyOver: 'az utazás véget ért',
  wrapJourneyToGo: (_n, city) => `kell még a vonathoz${city ? ` ${city} felé` : ''}`,

  wrapUpUnlocked:
    'Csomagolókör feloldva. Ez a kör pakolja be végleg a begyűjtött szavakat a bőröndbe. Nyisd ki a bőröndöt, és használd fel.',
  wrapUpEarned: (banked) =>
    `Csomagolókört szereztél. ${banked} van tartalékban. Használj fel egyet a bőröndben.`,
  postcardEarned: (banked) => `+1 fordítási képeslap · ${banked} használható`,
  wrapUpBankFull: (cap) =>
    `A tartalék megtelt. A bőröndbe legfeljebb ${cap} csomagolókör fér. Használj fel egyet, és a győzelmek újra számítanak.`,
  winsToWrapUp: (n) => `Még ${n} győzelem a csomagolókörig`,
  wrapResultFirst:
    'A bepakolt zöld kártyák végleg be vannak csomagolva, akár nyered ezt a kört, akár veszted.',
  wrapResultNothing:
    'Semmi nem lett becsomagolva. Egy szó akkor lesz becsomagolva, ha le volt fordítva ÉS zöldnek találtad, nyerve vagy vesztve.',
  wrapResultLost:
    'A vesztés itt semmibe nem került. A csomagolókör megtartja, amit bepakoltál és zöldnek találtál, nyerve vagy vesztve.',

  playAgain: 'Még egyszer',
  playNextGame: 'Következő játék',
  home: 'Főoldal',
  postWrapChoicesAria: 'Választás a csomagolókör után',
  postWrapHeading: 'Hogyan tovább?',
  postWrapGrammar: 'Nyelvtan',
  postWrapSurvival: 'Túlélés',
  postWrapBoth: 'Mindkettő',
  postWrapBothNote: 'Először nyelvtan, aztán egyenesen a párbeszédre.',
  grammarNote: (city, topic, lessons) =>
    `${city} nyelvtana${topic ? `: ${topic}` : ''}${lessons > 1 ? `, ${lessons} lecke.` : '.'}`,
  // „Párbeszéd” a szótár szava az egységre; a benne folyó beszéd „beszélgetés”.
  survivalNextNote: (number, total, title) =>
    `${number}/${total}. párbeszéd: ${title}. Először a mondatok, aztán a beszélgetés.`,
  survivalAllReadTitle: 'Mind a négy párbeszédet elolvastad már.',
  survivalLockedTitle: 'Fejezz be egy csomagolókört a következő párbeszéd feloldásához.',
  survivalLockedNote: 'A következő párbeszéd akkor nyílik meg, amikor befejeződik egy csomagolókör.',

  sentenceReviewAria: 'Mondatáttekintés',
  hearItInDanish: 'Hallgasd meg dánul',
  legendGreenLabel: 'Zöld',
  legendGreenMeaning: ': a szó, amit megtaláltál.',
  legendUnderlinedLabel: 'Aláhúzott',
  legendUnderlinedMeaning: (city) => `: ${city} kis szavai.`,
  legendTapToHear: 'Koppintásra megszólal.',

  reviewTitle: 'Táblaáttekintés',
  reviewProgress: (current, total) => `${current}/${total}`,
  reviewOptional: 'Nem kötelező · nyomonként egy mondat',
  reviewListen: 'Meghallgatás',
  reviewListenSlowlyAria: 'Lassú meghallgatás',
  reviewNoRecordings: 'Normál és lassú felvétel nem érhető el.',
  reviewRecordingUnavailable: 'A felvétel nem érhető el.',
  reviewSoundOff: 'A hang ki van kapcsolva, vagy a lejátszás leállt.',
  reviewShowTranslation: 'Fordítás megjelenítése',
  reviewHideTranslation: 'Fordítás elrejtése',
  reviewAboutWord: 'Erről a szóról',
  reviewHighFrequencyWord: 'Gyakori szó:',
  reviewNoNotes: 'Nincs jegyzet a szóhoz.',
  reviewNextSentence: 'Következő mondat',
  reviewNothingThisRound:
    'Ebben a körben nincs mit áttekinteni. Minden olyan nyomodhoz jár egy mondat, amelyet Casey helyesen tippelt meg.',
  sentenceBandNoGreens: 'Ebben a körben nem volt zöld szó, amit mondatba tehetnénk.',

  // ── miért lett elutasítva egy nyom ───────────────────────────────────────
  // A nyom és a táblaszó nem dán idézet a «» értelmében, hanem idézett szöveg,
  // ezért magyar idézőjelet kap.
  clueNotSingleWord: 'a nyom csak egyetlen szó lehet',
  clueOnBoard: (clue) => `${az(clue)} „${clue}” szerepel a táblán`,
  clueTypoOf: (clue, word) => `„${clue}” elírás lehet: „${word}”`,
  clueGlossOnBoard: (clue, word) =>
    `${az(clue)} „${clue}” a táblán lévő „${word}” angol fordítása`,
  clueCompoundOfWord: (clue, word) =>
    `${az(clue)} „${clue}” ${az(word)} „${word}” szóból képzett összetétel`,
  clueCompoundOfGloss: (clue, gloss, word) =>
    `${az(clue)} „${clue}” ${az(gloss)} „${gloss}” szóból képzett összetétel, ez ${az(word)} „${word}” fordítása`,
  clueFormOfWord: (clue, word) => `${az(clue)} „${clue}” ${az(word)} „${word}” egyik alakja`,
  clueFormOfGloss: (clue, gloss, word) =>
    `${az(clue)} „${clue}” ${az(gloss)} „${gloss}” egyik alakja, ez ${az(word)} „${word}” fordítása`,

  // ── a gyakorlókör noszogatásai és a zárt szótár ──────────────────────────
  practiceClueFinal: 'Ehhez az utolsó gyakorlónyomhoz kösd össze az egyetlen megmaradt zöld szót.',
  practiceClueMany: 'Ehhez a gyakorlónyomhoz köss össze 2 vagy 3 zöld szót.',
  dictionaryClosed: 'A szótár zárva marad, amíg ez be nem fejeződik.',
}
