import type { Catalogue } from '../en'
import { az, hol, hova } from './toldalek'

/**
 * Magyar. Tegezés. Itt a vonat tényleg vonat. Bepakolni a csomagolókörben
 * LEHET egy kártyát; becsomagolt AZ a szó, amely túlélte a kört és a
 * rekeszben fekszik — ez a szám számít a Főoldalon és a térképen.
 *
 * A városnév paraméter, ezért a -ba/-ban toldalékot a `toldalek.ts` számolja
 * (Aalborgba, Skagenbe, Ribébe); ahol lehet, névutó áll helyette („Aalborg
 * felé”), az rövidebb és nem téveszthető el.
 */
export const home: Catalogue['home'] = {
  brandName: '900words',
  // ── Főoldal ─────────────────────────────────────────────────────────────
  settingsAria: 'Beállítások',
  openMapAria: 'Térkép megnyitása',
  homeMapAria: (stop, stops, city) => `${stop}/${stops}. állomás: ${city}`,
  needsPass: 'A következő vonathoz bérlet kell',
  wrappedWord: 'becsomagolva',
  collectedCount: (collected) => `${collected} begyűjtve`,
  journeyDone: (city) => `${hol(city)} pakoltad be az utolsó bőröndöt.`,
  momentumLine: 'Játssz naponta 3 táblát, és 90 nap alatt összegyűjtheted az összes szót.',
  dailyPlayedAria: (outcome) => `Napi kihívás: ma már játszottad (${outcome})`,
  dailyAria: 'Napi kihívás: egy közös tábla minden napra',
  play: 'Játék',
  continueGame: 'Játék folytatása',
  continueWrapUp: 'Csomagolókör folytatása',
  continueReview: 'Áttekintés folytatása',
  continuePrimary: 'Tábla folytatása', continueReplay: 'Újrajátszás folytatása', returnToPrimary: 'Vissza a tábládhoz',
  viewResult: 'Eredmény megtekintése', improveBoards: 'Táblák fejlesztése', postcardsEarned: 'szerzett képeslap',
  postcardsRemaining: (remaining) => `${remaining} képeslap kell az utazáshoz`, postcardReadiness: (earned, remaining) => `${earned} szerzett képeslap; még ${remaining} kell az utazáshoz.`,
  readyToTravel: 'Készen állsz az utazásra', nextStopNotReleased: (city) => `Készen állsz az utazásra. ${city} még nem érhető el.`, cityMedalInProgress: 'még nincs megszerezve', cityMedal: (tier) => `Városi érem: ${tier}`,
  backToCity: (city) => `Vissza ${hova(city)}`,

  // ── A térkép ────────────────────────────────────────────────────────────
  back: 'Vissza',
  journeyTitle: 'Az utazás',
  mapAria: (country, stop, stops, city) =>
    `${country} térképe. ${stop}/${stops}. állomás: ${city}.`,
  stopAria: (city, stop, status) => `${city}, ${stop}. állomás, ${status}`,
  statusVisited: 'meglátogatva',
  statusHere: 'itt vagy',
  statusNotReached: 'még nem érted el',
  statusAhead: 'előtted áll',
  stopOf: (stop, stops) => `${stop}/${stops}. állomás`,
  arrivedOn: (date) => `érkezés: ${date}`,
  previousStopAria: 'Előző állomás',
  nextStopAria: 'Következő állomás',
  wordsWaiting: (words, city) =>
    `${words} szó vár rád. Akkor nyílnak meg, ha eljutsz ${hova(city)}.`,
  lookAhead: 'Előretekintés',
  travelAhead: 'Előreutazás',
  enableTravelAhead: 'Előreutazás bekapcsolása',
  mapCounts: (goal, collected, discovered) =>
    `/ ${goal} becsomagolva · ${collected} begyűjtve · ${discovered} felfedezve`,
  suitcasePacked: 'bőrönd bepakolva',
  lineClosedNote: 'A vonal karbantartás miatt zárva. Koppints a vonatra a közleményért.',
  travelBackTo: (city) => `Vissza → ${city}`,
  travelOnTo: (city) => `Tovább → ${city}`,
  trainToClosed: (city) => `Vonat ${city} felé: a vonal zárva`,
  getPassFor: (city) => `Bérlet ${hova(city)}`,
  mapCredit: 'Kort · térképadatok: Geodatastyrelsen / DAGI (FOT), 1:500 000',
  backToTheMap: 'Vissza a térképre',

  // ── A vonat, mindkét képernyőn ──────────────────────────────────────────
  trainJourneyOver: 'A bőrönd bepakolva. Az utazás véget ért.',
  trainReady: (city) => `A bőrönd bepakolva. A vonat ${city} felé indulásra kész.`,
  wordsToFinish: (words) => `Még ${words} becsomagolt szó kell az utazás befejezéséhez.`,
  wordsToTrain: (words, city) =>
    `Még ${words} becsomagolt szó kell, hogy vonatra szállhass ${hova(city)}.`,
  boardTrain: (city) => `Irány ${city}!`,

  // ── Megérkezés ──────────────────────────────────────────────────────────
  arrivalAgain: (words) =>
    `Újra itt! Az innen való ${words} szavad még a bőröndben van. Játszd újra őket, vagy utazz tovább, amikor csak akarsz.`,
  arrivalNew: (words) =>
    `${words} új szó vár felfedezésre. Casey nyitva áll, és már várja őket.`,
  getStarted: 'Kezdjük',
  seeTheMap: 'A térképre',

  // ── A bőrönd ────────────────────────────────────────────────────────────
  suitcaseTitle: 'A bőrönd',
  filterAria: 'A bőrönd szűrése város szerint',
  filterAll: 'Mind',
  pagerPreviousAria: (band) => `${band}, előző oldal`,
  pagerNextAria: (band) => `${band}, következő oldal`,
  looseLabel: (words) => `Még odakint: ${words}`,
  looseEmpty: 'Semmi nincs odakint. Minden itteni szó a bőröndben van.',
  lidLabel: (words) => `Begyűjtve: ${words}`,
  lidEmpty:
    'Adj nyomot egy szóra, és tippeld is meg (oda-vissza egy-egy zöld), és a fedélbe kerül.',
  trayLabel: (words, goal) => `Becsomagolva: ${words}/${goal}`,
  trayEmpty: 'A rekeszben még nincs semmi. A csomagolókörök ide teszik a szavakat, végleg.',
  undiscoveredAria: 'Felfedezetlen szó',
  wordAria: {
    undiscovered: (word) => `${word}, felfedezetlen`,
    discovered: (word) => `${word}, felfedezve`,
    collected: (word) => `${word}, begyűjtve`,
    wrapped: (word) => `${word}, becsomagolva`,
  },
  wrapUpWords: 'Szavak becsomagolása',
  wrapUpBankedAria: (banked) => `Szavak becsomagolása: ${banked} tartalékban`,
  postcardBalance: (banked) => `Képeslapok · ${banked}`,
  postcardHelp: 'Kell a válasz? Használj képeslapot.',
  packingAnswerShown: 'A válasz látszik. Nyomd meg a Bepakolást.',
  packingNoPostcards: 'Nyerj meg egy rendes kört, hogy képeslapot szerezz.',
  packingFirstPostcardHint: (language) => `Írd be a ${language} szót a csomagoláshoz. Egy képeslap felfedi.`,
  packingPostcardTitle: (state, language) => state === 'shown' ? 'Mutasd újra ingyen ezt a választ.' : state === 'select' ? 'Először válassz egy be nem pakolt kártyát.' : state === 'empty' ? 'Nyerj meg egy rendes kört, hogy fordítási képeslapot szerezz.' : `Használj képeslapot e kártya ${language} válaszának felfedésére.`,
  packingPostcardAria: (shown, banked) => shown ? 'Mutasd újra ingyen a fordítást' : `Fordítási képeslap használata: ${banked} elérhető`,
  packingPostcardShowAnswer: 'Válasz mutatása',
  usePostcard: 'Képeslap használata',
  wrapUpContinueAria: 'A folyamatban lévő csomagolókör folytatása',
  hintWrapUpWaiting: 'Már fut egy csomagolókör. Folytasd ott, ahol abbahagytad.',
  hintCollectFirst: (city) =>
    `Először gyűjts be egy szót ${hol(city)} (oda-vissza egy-egy zöld), és lesz mit bepakolnia a csomagolókörnek.`,
  hintFirstWrapUp: (wins) => `Nyerj ${wins} kört, és megkapod az első csomagolókörödet.`,
  hintMoreWins: (wins) => `Még ${wins} győzelem, és jár egy csomagolókör.`,
  hintPacksRange: (collected, city) =>
    `${collected} begyűjtve ${hol(city)}. Egy csomagolókör 13–15 szót pakol be, a kulcsától függően.`,
  hintPacksUpTo: (collected, city, cap) =>
    `${collected} begyűjtve ${hol(city)}. A következő csomagolókör legfeljebb ${cap} szót pakol be, a kulcsától függően.`,

  // ── A pakolóasztal, a csomagolókör tetején ──────────────────────────────
  // A cím sora nem törhet: „Bepakolás — 3/12” fér el 360 pixelen.
  packWord: (word) => `«${word}» bepakolása`,
  packTheBoard: 'Bepakolás',
  packCount: (packed, packable) => `(${packed}/${packable})`,
  startEarlyWarning: (remaining) =>
    `Indítás ${remaining} bepakolatlan kártyával. Azok angolul maradnak, és ebben a körben nem csomagolhatók be`,
  startEarly: (remaining) => `Indítás ${remaining} nélkül`,
  tapEnglishCard: 'Koppints egy angol kártyára',
  // Az angol szó nem dán, ezért magyar idézőjelet kap, nem «»-t.
  theWordFor: (language, word) => `„${word}” ${language} nyelven`,
  tapEnglishCardFirst: 'Először koppints egy angol kártyára',
  pack: 'Bepakolás',
  packMiss: 'Nem az. A hibát megjegyeztük. Próbáld tovább.',
  packFirstTime:
    'Írd be dánul a bepakoláshoz. A korai indítással a kártyák angolul és becsomagolatlanul maradnak.',
  packRecall: 'A szótár zárva. Most az emlékezeted számít.',
  packTapAndType: (language) =>
    `Koppints egy angol kártyára, és írd be ${az(language)} ${language} megfelelőjét.`,

  // ── A bérlet ────────────────────────────────────────────────────────────
  passBackAria: 'Vissza a térképre',
  passTitle: 'Következő vonatok',
  passKicker: 'Az első két város ingyenes.',
  passHeading: 'Bérlet Dánia többi részére',
  passIntro:
    'Dániában sajnos nem ingyenes a tömegközlekedés. Ha fel akarsz szállni a következő vonatokra, bérlet kell.',
  passOptionsAria: 'Bérletlehetőségek',
  passMonthly: 'Havi bérlet',
  passMonthlyHelp: 'Utazz tovább, amíg a bérleted érvényes.',
  passLifetime: 'Örökös bérlet',
  passLifetimeHelp: 'Egy bérlet minden utazásra, amit valaha kiadunk.',
  passPriceMonthly: '1,99 / hó',
  passPriceLifetime: '19,99 egyszer',
  passReady: 'A bérleted kész. A következő vonat nyitva áll.',
  passRestore: 'Vásárlások visszaállítása',
  passRedeem: 'App Store-kód beváltása',
  passKindness: 'A tanulás ne függjön a pénztől.',
  // „… küldd el a ⟨cím⟩ címre — cserébe …”: a cím szóközzel áll a két fél között.
  passReviewBefore: 'Írj egy értékelést az App Store-ban, fotózd le, és küldd el a',
  passReviewAfter:
    'címre, és cserébe kapsz egy 6 hónapos bérletkódot. Az értékelésed lehet jó vagy rossz, attól függően, mennyire tetszik az app.',

  // ── Napi korlát utáni ajánlat ────────────────────────────────────────────
  dailyLimitKicker: 'Mára elfogyott a két ingyenes játékod.',
  dailyLimitHeading: 'Játssz tovább Caseyvel',
  dailyLimitBody: 'Gyere vissza holnap még két ingyenes játékért, vagy oldd fel a korlátlan játékot.',
  dailyLimitOptionsAria: 'Korlátlan játék lehetőségei',
  dailyLimitMonthly: 'Havi',
  dailyLimitMonthlyHelp: 'Havonta automatikusan megújul, amíg le nem mondod.',
  dailyLimitLifetime: 'Egyszeri fizetés',
  dailyLimitLifetimeHelp: 'Korlátlan játék előfizetés nélkül.',
  dailyLimitUnavailable: 'Nem érhető el',
  dailyLimitCloseAria: 'Ajánlat bezárása',
  dailyLimitRestore: 'Vásárlások visszaállítása',
  dailyLimitDismiss: 'Talán holnap',
  dailyLimitDisclosure: 'Az árakat és a vásárlás visszaigazolását az Apple biztosítja. Az előfizetést az Apple-fiókodban kezelheted vagy mondhatod le.',
  passThanksHeading: 'Köszönjük, hogy támogatod a 900words fejlesztését',
  passThanksBody: 'A korlátlan játék feloldva.',
  passThanksContinue: 'Játék folytatása',

  // ── A választható nyelvi állomás ────────────────────────────────────────
  stopKicker: 'Választható nyelvi állomás',
  stopKindGrammar: 'Nyelvtani gyakorlat',
  stopKindSituation: 'Egy kis hétköznapi helyzet',
  stopKindExit: 'Választható felkészültségi próba',
  stopKindReview: 'Esedékes ismétlés',
  stopFocus: 'A következő nyelvi fókuszod',
  stopNote:
    'Ez az állomás a bőröndödtől külön mentődik. Soha nem változtat azon, mely szavakat pakolhatod be, és azon sem, indulhat-e a vonat.',
  stopAuthoring:
    'A dán feladatok és a pontozás még a tananyaggal együtt készülnek. Tedd el későbbre, vagy hagyd az útikönyvedben; helykitöltő próbálkozás nem számít tanulási bizonyítéknak.',
  stopContinue: 'Folytatás',
  stopLater: 'Később',
  stopSkip: 'Állomás kihagyása',
  stopStart: 'Indítás',
  stopOpen: 'Nyelvi állomás',

  // ── a lezárt vonal ───────────────────────────────────────────────────────
  trainClosedLabel: (city) =>
    `A vonat ${city} felé még nem indul. A vonalat karbantartás miatt lezárták`,
  trainClosedTitle: 'A vonal karbantartás miatt zárva',
  trainClosedBody: (city, here) =>
    `A vonat ${city} felé még nem indul. Dolgoznak a vonalon. ` +
    `Hamarosan újra jár, és amint így lesz, itt szólunk. ` +
    `Addig ${here} teljesen a tiéd: minden tábla, minden csomagolókör és a sorozatod.`,
  trainReopenedTitle: (city) => `A vonat ${city} felé újra jár`,
  trainReopenedBody:
    'A vonal szabad. A bőröndöd bepakolva, Casey a peronon vár. Szállj fel, amikor kedved tartja.',

  // Current Settings and German-preview integration.
  previewHeading: "Még nincs szójáték",
  previewNote: "A térkép és az Útikalauz már elérhető. A táblák, a nyomok és a hangfelvételek még nem készültek el.",
  previewGuideCta: "Útikalauz megnyitása",
}
