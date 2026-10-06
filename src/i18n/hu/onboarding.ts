import type { Catalogue } from '../en'
import { az, Az, hol, hova } from './toldalek'

/**
 * Magyar. Tegezés. Casey itt szólal meg először — röviden, melegen, egyenesen.
 * Szótár: a kör kör, a lépés a játékban lépés (a vonat az, ami jár), a
 * csomagolókörben bepakolunk, becsomagolt AZ a szó, amely túlélte. A «»-ban
 * álló szavak dánok és azok maradnak; Casey neve kötőjellel toldalékolódik
 * (Casey-nek, Casey-re), mert a szóvégi -ey a magyar írásrendben szokatlan.
 */
export const onboarding: Catalogue['onboarding'] = {
  courseText: (course) => {
    const german = course === 'de'
    return {
      languageName: german ? 'német' : 'dán',
      countryName: german ? 'Németország' : 'Dánia',
      welcome: 'Tudtad, hogy a legtöbb nyelvben 900 szó a mindennapi beszéd több mint 80%-át lefedheti?',
      clueField: german
        ? 'Amikor te következel, írj ide egy német szót, amely összeköt két vagy három zöld szavadat.'
        : 'Amikor te következel, írj ide egy dán szót, amely összeköt két vagy három zöld szavadat.',
      dictionary: german
        ? 'Ha szükséged van egy német szóra, keresd meg itt. A Szótár bezárul, amikor elküldöd a nyomot.'
        : 'Ha szükséged van egy dán szóra, keresd meg itt. A Szótár bezárul, amikor elküldöd a nyomot.',
      tutorialHint: 'A Szótárral lefordíthatod az ötletedet.',
      practiceIntro: (clue, number) =>
        `A nyomom: «${clue}», ${number} szóhoz. Melyik szavakat kapcsolod hozzá a táblán? Koppints a ⓘ ikonra, ha fordításra van szükséged.`,
      practiceRationaleTime: 'Az óra az időt mutatja. A hónap és a hét időegység.',
      practiceRationaleTimeRecovery: 'Ez a nyom újra az idő kapcsolatára épít a megmaradt időszavakkal.',
      lastGreen: german
        ? 'Még egy zöld szavad maradt. Nem látom, ezért adj egy német nyomot az utolsó kártyához.'
        : 'Még egy zöld szavad maradt. Nem látom, ezért adj egy dán nyomot az utolsó kártyához.',
      yourTurn: german
        ? 'Véget ért a köröm. Most te jössz. Adj egy német nyomot, amely összeköt 2 vagy 3 zöld kártyát a te oldaladon. Nem látom őket, ahogy te sem látod a kulcsomat.'
        : 'Véget ért a köröm. Most te jössz. Adj egy dán nyomot, amely összeköt 2 vagy 3 zöld kártyát a te oldaladon. Nem látom őket, ahogy te sem látod a kulcsomat.',
    }
  },
  languageEyebrow: 'Üdv a fedélzeten',
  languageHeading: 'Milyen nyelven beszélsz?',
  languageHint: 'Koppints a nyelvedre.',
  languageAria: (endonym) => `A 900words használata ${endonym} nyelven`,

  // ── A jegy: melyik nyelvet akarod TANULNI ───────────────────────────────
  skip: 'Kihagyás',
  ticketEyebrow: 'Válaszd ki az utazásodat',
  ticketHeading: 'Milyen nyelvet szeretnél tanulni?',
  ticketAria: (country, language) => `${country} beutazása, ${language} tanulása`,
  ticketLearnIn: 'Tanulás itt:',
  ticketMeta: (words, cities) => `${words} szó · ${cities} város`,
  ticketHintMany: 'Koppints egy jegyre a választáshoz.',
  ticketHintOne: 'Koppints a jegyedre, és indulunk.',
  ticketComingSoon: 'Hamarosan',

  // ── Casey before the first walk, and the first walk’s end (CW-13) ──
  introTwoGames: 'A szókártyák unalmasak, ezért két játékot játszunk: Sightseeinget, amin szavakat gyűjtünk, és egy szórejtvényt egy kávézóban.',
  introExplore: (city) => `Nézzünk körül ${hol(city)}! Hátha találunk egy kávézót.`,
  introGo: 'Indulás',
  walkEndFound: 'Indulj még egy Sightseeingre, vagy menj a Főoldalra, és játssz a kávézóban, amit találtunk.',
  walkEndNotFound: 'Indulj még egy Sightseeingre, hogy kávézót keress, vagy menj a Főoldalra.',

  // ── A súgóbuborékok az élő képernyőkön ───────────────────────────────────
  tourNext: 'Tovább',
  tourDone: 'Mehetünk',
  tourLoose: 'A szavak, amikkel találkoztunk, itt fent várnak. Minden gyűrű egy harmaddal telik jelenként: egy fotó Sightseeing közben, egy tipp a nyomomra, és egy saját nyomod.',
  tourLid: 'Három jellel a szó össze van gyűjtve. Az összegyűjtött szavak a bőröndbe kerülnek, és ez a sor számolja őket.',
  tourTray: 'Ez a város pecsétkártyája. Minden kávézó, ahol játszol, itt kapja meg a pecsétjét. A szaggatott kör egy megtalált, de még nem játszott kávézó, a ? pedig egy még megtalálandó.',
  mapTourHere: (city, words) =>
    `Ez ${city}, itt vagyunk most. Minden városban ${words} szót viszünk haza.`,
  mapTourNext: (next, _words, city) =>
    `${next} messzebb van az útvonalon. Javítsd tovább ${city} tábláit. A következő megálló egyelőre zárva van.`,
  homeTourArrival: (city, words) =>
    `Megérkeztünk ${hova(city)}, hogy begyűjtsük az első ${words} szavadat.`,
  homeTourMap:
    'Ez a térképünk. Mutatja, hol vagyunk most, és a városokat, amelyek az út mentén várnak.',
  homeTourSuitcase:
    'Koppints rám, amikor ki akarod nyitni a bőröndöt. Megmutatja, mely szavakkal találkoztál, melyeket gyűjtötted be, és melyeket pakoltad be végleg.',
  homeTourGuide:
    'Az Útikönyvben együtt van a nyelvtan, a gyakorlati dán és a korábbi városok gyakorlatai. Előre is lapozhatsz, anélkül hogy a vonat elindulna.',
  // ── A gyakorlójáték vezetett körútja (2026-09-18) ────────────────────────
  introGameTourKey:
    'A zöld keretek a te titkos szavaid. Én soha nem látom őket, ahogy te sem látod az enyéimet. Minden tipp annak a kulcsán mérődik, aki a nyomot adta.',
  introGameTourClueField:
    'Amikor te jössz, írj ide egy dán szót, amely két vagy három zöld szavadat köti össze.',
  introGameTourDictionary:
    'Ha olyan dán szóra van szükséged, amit nem tudsz, keresd itt. A szótár bezárul, amint a nyomod elment.',
  introGameTourStepper:
    'Ez a szám mondja meg, hány szót nevez meg a nyomod. Emeld meg, ha egy kapcsolat tényleg több zöldedet fedi le.',
  translationTourBoard:
    'Ezeken a bőröndfedeleken a talált szavaink jelentése látszik. Gondolatban válassz ki egyet közülük. Nem kell előbb bőröndre koppintanod.',
  translationTourInput: (language: string) =>
    `Ide írd be a ${language} szót, majd koppints a pipára. A rossz válasz semmibe sem kerül, úgyhogy nyugodtan próbáld újra.`,
  translationTourWheel:
    'Minden jó válasz egy zöld mezőt ad a kerékhez. Bármikor pörgethetsz, de ha üres mezőn áll meg, elveszíted a kört. Ha tele a kerék, minden pörgetés nyer.',
  wheelReadyTour:
    'A kerék most már teljesen zöld, így ez a pörgetés nyer. Koppints a kerékre a pörgetéshez.',
  resultTourRewardNew: (rewards: string) => `Most először: ${rewards}.`,
  resultTourRewardHeld: (rewards: string) =>
    `Korábban már megszerezted, ezért nem számít újra: ${rewards}.`,
  resultTourWinTier: (tier: string, best: string) =>
    `Ez a rejtvény ${tier} szintet ért el. A kávézó eddigi legjobb pecsétje: ${best}.`,
  resultTourLossTier: (best: string) =>
    `Ez a rejtvény elveszett. Egy elvesztett rejtvény is bronz pecsétet ér. A megnyert rejtvény ezüstöt, aranyat vagy platinát ér. A kávézó eddigi legjobbja: ${best}.`,
  resultTourCityPercent: (city) =>
    `${city}: minden kávézópecsét a városi pecsétbe számít. A százalék az összes kávézópecséted együtt: a jobb pecsétek növelik. Bronz 25%-tól, ezüst 50%-tól, arany 75%-tól, platina 100%-nál.`,
  resultTourNoBestYet: 'még nincs',
  resultTourSentence:
    'Ez egy választható ismétlés. Egy szót mutat ebből a táblából egy mondatban. Ez nem újabb teszt.',
  resultTourNoReview:
    'Most nincs átismételhető mondat. Semmi baj. Az ismétlés mindig választható.',
  homeTourSightseeing: 'A Sightseeing az, amit most csináltunk. Minden kör szavakat gyűjt, és minél többet játszol, annál több kávézót találsz.',
  homeTourCafe: (name) =>
    name ? `Az első kávézónk: ${name}. Koppints a Kávézós rejtvényre, ülj le, és játssz.` : 'Az első kávézónk vár. Koppints a Kávézós rejtvényre, ülj le, és játssz.',
  homeTourStamp: 'Ez a városi pecsét. A százaléka az összes kávézópecséted együtt, és a jobb pecsét többet ér. Játssz újra egy kávézóban egy jobb pecsétért, és nő.',
  homeTourCollection: 'Koppints rám, és kinyitom a bőröndöt. Benne vannak a szavaink és a kávézó pecsétje.',

  // ── A gyakorlókör: Casey megírt indoklásai ──────────────────────────────
  practiceRationaleDrink: 'A víz, a kávé és a tej mind olyasmi, amit iszunk.',
  practiceRationaleHome: 'A ház az otthon.',
  practiceRationaleRecovery:
    'Ez megismétli a konkrét ivás-kapcsolatot a még kint lévő italkártyákra.',

  // ── A gyakorlókör: Casey folyamatos kommentárja ─────────────────────────
  // „3-ra” helyett „3 szóra”: a számra tett rag hangrendje a számtól függne.
  practiceIntro:
    'A nyomom: «drikke», 3 szóra. Mely szavak kapcsolódnak hozzá ezen a táblán? Koppints az ⓘ-re, ha segítene egy fordítás.',
  guessGreenMore: (word) =>
    `${Az(word)} «${word}» zöld a kulcsomon. Tippelj tovább, vagy állj meg, amíg nyerésben vagyunk.`,
  guessGreenEnd: (word) => `${Az(word)} «${word}» zöld a kulcsomon. Ezzel a nyomom véget ért.`,
  guessGreenEndMine: (word) =>
    `${Az(word)} «${word}» zöld a kulcsomon. Ezzel a nyomom véget ért. A te zöldjeid akkor jelennek meg, amikor te jössz. Ez a nyom az én kulcsomat használta.`,
  guessYoursNotMine: (word) =>
    `${Az(word)} «${word}» a te zöldjeid egyike, de az én kulcsomon nem zöld. Ez a nyom az én kulcsomat használja, ezért a kártya a tiédhez még megmarad.`,
  guessMiss: (word) => `${Az(word)} «${word}» nem zöld a kulcsomon, így a nyomom véget ért.`,
  guessMissMine: (word) =>
    `${Az(word)} «${word}» nem zöld a kulcsomon, így a nyomom véget ért. A te zöldjeid akkor jelennek meg, amikor te jössz. Ez a nyom az én kulcsomat használta.`,
  firstClue: (clue) =>
    `Üdv a kávézóban! Ez az első asztal egy rövid gyakorlás. Mely szavakat tudod ezen a táblán ${az(clue)} «${clue}» szóhoz kapcsolni? Koppints egy szó ⓘ jelére a fordításért, aztán koppints egy szóra, és erősítsd meg.`,
  clueFor: (clue, number) =>
    `A nyomom: «${clue}», ${number} szóra. Koppints bármelyik szóra, ami eszedbe jut róla.`,
  lastGreenLeft:
    'Még egy zöld kártyád maradt. Én nem látom, ezért adj egy dán nyomot arra az utolsó kártyára.',
  yourTurn:
    'Az én köröm véget ért. Most te jössz. Adj nekem egy dán nyomot, amely 2 vagy 3 zöld kártyát köt össze a te oldaladon. Én nem látom őket, ahogy te sem látod az én kulcsomat.',
  yourFirstClue: (clue, number, tokens) =>
    `A nyomod: «${clue}», ${number} szóra. A fenti ${tokens} pont a közös körzsetonunk. Minden nyom, a tiéd vagy az enyém, elhasznál egyet. Lent hangosan gondolkodom.`,
  yourClue: (clue, number) =>
    `A nyomod: «${clue}», ${number} szóra. A tippjeim most a te kulcsodat használják. Lent hangosan gondolkodom.`,
  practiceWon: 'Minden zöld megvan. Nyertünk! A kávézós rejtvények nem lesznek ilyen könnyűek, de minden szó számít, amivel találkozunk.',
  practiceLost: 'Ez a kör elszaladt előlünk, de minden szó számít, amivel találkoztunk.',
  findingAClue: 'Én jövök. Nyomot keresek.',
  practiceTranslation:
    'A tábla megoldva! Most fordítunk: minden dán válasz kitölt egy kerékszeletet. Már pörgethetsz, de a teli kerék garantálja a zöldet. Egy megoldott tábla itt még Platina lehet.',
  practiceWheelReady:
    'A kerék tele van. Pörgesd meg, hogy zöldön álljon meg. Normál táblán így lehet az eredményed Platina.',
  practiceFinish:
    'A gyakorlás kész. Ez az asztal nem ad pecsétet. Egy kávézós rejtvényben a megfejtés, a fordítás és a pörgetés adja a kávézó pecsétjét. Egy kávézót újra is játszhatsz, hogy javíts a pecsétjén.',
  demoEndTitle: "Ez volt az első teljes táblád.",
  demoEndLine: "Az appban tovább játszom veled, tábláról táblára, és megőrzök minden szót, amit gyűjtesz.",
  demoAppStore: "900words letöltése az App Store-ból",
  demoAppStoreSoon: "A 900words hamarosan az App Store-ban.",
  demoPlayAgain: "Újra",
  demoRestingTitle: "Casey pihen",
  demoRestingBody: "Ma sokan játszottak velem, ezért pihennem kell. Gyere vissza holnap, vagy játssz velem az appban.",
  demoCheckFailed: "Nem tudtuk ellenőrizni, hogy ember vagy. Töltsd újra az oldalt, és próbáld újra.",
  playFullRound: 'Játssz a kávézós rejtvénnyel',
}
